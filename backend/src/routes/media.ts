import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';

const media = new Hono<{ Bindings: Env }>();

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Serves uploaded binary assets cleanly from R2 bucket (primary) or D1 `media_blobs` fallback
 * for local/Miniflare runtimes without external R2 buckets provisioned.
 */
media.get('/*', async (c) => {
  const rawPath = c.req.path;
  let key = rawPath;
  if (key.startsWith('/api/media/file/')) {
    key = key.slice('/api/media/file/'.length);
  } else if (key.startsWith('/media/')) {
    key = key.slice('/media/'.length);
  } else if (key.startsWith('/api/products/media/')) {
    key = key.slice('/api/products/media/'.length);
  }

  key = decodeURIComponent(key).replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\')) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid asset key.', status: 400 } },
      400,
    );
  }

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

  const blob = await c.env.DB
    .prepare(`SELECT mime_type, data_base64 FROM media_blobs WHERE asset_key = ?1 LIMIT 1`)
    .bind(key)
    .first<{ mime_type: string; data_base64: string }>();

  if (blob) {
    const bytes = decodeBase64ToBytes(blob.data_base64);
    return new Response(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': blob.mime_type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Media asset not found.', status: 404 } },
    404,
  );
});

export default media;
