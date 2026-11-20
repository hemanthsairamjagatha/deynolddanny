import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import { decodeBase64ToBytes } from '../services/r2Storage.js';

const media = new Hono<{ Bindings: Env }>();

function buildMediaHeaders(contentType: string): Headers {
  const headers = new Headers();
  headers.set('Content-Type', contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

/**
 * Serves uploaded binary assets cleanly from:
 * 1) R2 bucket (primary when bound)
 * 2) Cloudflare Edge KV (`media:bin:<key>`, supports up to 25 MiB)
 * 3) D1 `media_blobs` (single-row or chunked parts, with KV backfill)
 */
media.get('/*', async (c) => {
  const rawPath = c.req.path;
  let key = rawPath;
  if (key.startsWith('/api/media/file/')) {
    key = key.slice('/api/media/file/'.length);
  } else if (key.startsWith('/api/media/')) {
    key = key.slice('/api/media/'.length);
  } else if (key.startsWith('/media/')) {
    key = key.slice('/media/'.length);
  } else if (key.startsWith('/api/products/media/')) {
    key = key.slice('/api/products/media/'.length);
  }

  try {
    key = decodeURIComponent(key).replace(/^\/+/, '');
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Malformed asset key.', status: 400 } },
      400,
    );
  }

  if (!key || key.includes('..') || key.includes('\\')) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid asset key.', status: 400 } },
      400,
    );
  }

  // 1. Cloudflare R2 primary
  if (c.env.MEDIA_BUCKET) {
    const obj = await c.env.MEDIA_BUCKET.get(key);
    if (obj) {
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      if (!headers.get('Content-Type')) {
        headers.set('Content-Type', 'image/jpeg');
      }
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(obj.body as BodyInit, { status: 200, headers });
    }
  }

  // 2. Cloudflare Edge KV binary store (fast edge reads & up to 25 MiB)
  if (c.env.CATALOG_KV) {
    try {
      const kvRes = await c.env.CATALOG_KV.getWithMetadata<{ mimeType?: string }>(
        `media:bin:${key}`,
        'arrayBuffer',
      );
      if (kvRes.value) {
        return new Response(kvRes.value, {
          status: 200,
          headers: buildMediaHeaders(kvRes.metadata?.mimeType || 'image/jpeg'),
        });
      }
    } catch {
      // Fall through to D1
    }
  }

  // 3. D1 `media_blobs` durable fallback (supports both single-row & chunked parts)
  const blob = await c.env.DB
    .prepare(`SELECT mime_type, data_base64 FROM media_blobs WHERE asset_key = ?1 LIMIT 1`)
    .bind(key)
    .first<{ mime_type: string; data_base64: string }>();

  if (blob) {
    let fullBase64 = blob.data_base64;
    if (fullBase64.startsWith('__CHUNKED__:')) {
      const parts = await c.env.DB
        .prepare(
          `SELECT data_base64 FROM media_blobs
           WHERE asset_key LIKE ?1
           ORDER BY asset_key ASC`,
        )
        .bind(`${key}::part::%`)
        .all<{ data_base64: string }>();
      fullBase64 = (parts.results ?? []).map((p) => p.data_base64).join('');
    }

    if (fullBase64) {
      const bytes = decodeBase64ToBytes(fullBase64);
      // Warm KV cache asynchronously for ultra-fast subsequent requests
      if (c.env.CATALOG_KV) {
        c.executionCtx.waitUntil(
          c.env.CATALOG_KV
            .put(`media:bin:${key}`, bytes.buffer as ArrayBuffer, {
              metadata: { mimeType: blob.mime_type },
            })
            .catch(() => {}),
        );
      }
      return new Response(bytes.buffer as ArrayBuffer, {
        status: 200,
        headers: buildMediaHeaders(blob.mime_type),
      });
    }
  }

  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Media asset not found.', status: 404 } },
    404,
  );
});

export default media;
