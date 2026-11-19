import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import {
  buildR2Key,
  deleteR2Object,
  detectImageMimeFromBytes,
  sanitizeUploadFolder,
  uploadObject,
} from '../../services/r2Storage.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';
import { safeJsonParse } from '../../services/storefrontCache.js';

const adminMedia = new Hono<{ Bindings: Env }>();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ─── GET /api/admin/media ────────────────────────────────────────────────────
adminMedia.get('/', requirePermission('media.read', 'cms.read', 'catalog.read'), async (c) => {
  const folderId = c.req.query('folderId')?.trim();
  const q = c.req.query('q')?.trim().toLowerCase() ?? '';

  const [foldersRes, assetsRes, prodImgs, secImgs, brandRow] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM media_folders ORDER BY sort_order ASC, name ASC`).all<Record<string, unknown>>(),
    c.env.DB
      .prepare(
        folderId
          ? `SELECT * FROM media_assets WHERE folder_id = ?1 ORDER BY created_at DESC`
          : `SELECT * FROM media_assets ORDER BY created_at DESC`,
      )
      .bind(...(folderId ? [folderId] : []))
      .all<Record<string, unknown>>(),
    c.env.DB.prepare(`SELECT default_img, hover_img FROM products`).all<{ default_img: string; hover_img: string }>(),
    c.env.DB.prepare(`SELECT draft_props_json FROM cms_sections`).all<{ draft_props_json: string }>(),
    c.env.DB.prepare(`SELECT draft_json FROM brand_settings WHERE id = 'default'`).first<{ draft_json: string }>(),
  ]);

  const corpus = JSON.stringify({
    p: prodImgs.results ?? [],
    s: secImgs.results ?? [],
    b: brandRow?.draft_json ?? '',
  });

  const items = (assetsRes.results ?? [])
    .filter((a) => {
      if (!q) return true;
      const haystack = `${a.filename} ${a.alt_text} ${a.tags_json}`.toLowerCase();
      return haystack.includes(q);
    })
    .map((a) => {
      const url = String(a.url);
      return {
        id: a.id,
        folderId: a.folder_id,
        key: a.key,
        url,
        filename: a.filename,
        mimeType: a.mime_type,
        sizeBytes: Number(a.size_bytes ?? 0),
        width: a.width ?? null,
        height: a.height ?? null,
        altText: a.alt_text,
        defaultFocalX: Number(a.default_focal_x ?? 50),
        defaultFocalY: Number(a.default_focal_y ?? 50),
        tags: safeJsonParse<string[]>(String(a.tags_json ?? '[]'), []),
        sourceType: a.source_type,
        inUse: corpus.includes(url),
        createdAt: a.created_at,
      };
    });

  return c.json({
    success: true,
    data: {
      folders: (foldersRes.results ?? []).map((f) => ({
        id: f.id,
        parentId: f.parent_id,
        name: f.name,
        slug: f.slug,
        sortOrder: Number(f.sort_order ?? 0),
      })),
      items,
    },
  });
});

// ─── POST /api/admin/media/folders ───────────────────────────────────────────
adminMedia.post(
  '/folders',
  requirePermission('media.write'),
  zValidator('json', z.object({ name: z.string().min(1).max(60), parentId: z.string().nullable().optional() })),
  async (c) => {
    const { name, parentId } = c.req.valid('json');
    const slug = `${sanitizeUploadFolder(name).toLowerCase()}-${Date.now().toString(36).slice(-4)}`;
    const id = generateId('fld_');

    await c.env.DB
      .prepare(`INSERT INTO media_folders (id, parent_id, name, slug, sort_order, created_at) VALUES (?1, ?2, ?3, ?4, 10, ?5)`)
      .bind(id, parentId ?? null, name.trim(), slug, nowIso())
      .run();

    await auditAdminAction(c, 'CREATE_MEDIA_FOLDER', 'media_folder', id, { name });
    return c.json({ success: true, data: { id, name: name.trim(), slug } }, 201);
  },
);

// ─── POST /api/admin/media/upload ────────────────────────────────────────────
adminMedia.post('/upload', requirePermission('media.write'), async (c) => {
  const adminId = c.get('userId');
  const contentType = c.req.header('Content-Type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Must be multipart/form-data.', status: 400 } },
      400,
    );
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Malformed multipart payload.', status: 400 } },
      400,
    );
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'File is required.', status: 400 } }, 400);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return c.json(
      { success: false, error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Allowed types: JPEG, PNG, WebP, AVIF.', status: 415 } },
      415,
    );
  }
  if (file.size === 0 || file.size > MAX_SIZE_BYTES) {
    return c.json(
      { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Image must be between 1 byte and 5 MB.', status: 413 } },
      413,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const realMime = detectImageMimeFromBytes(arrayBuffer);
  if (!realMime) {
    return c.json(
      { success: false, error: { code: 'INVALID_IMAGE_CONTENT', message: 'File header does not match an authentic raster image.', status: 400 } },
      400,
    );
  }

  const folderSlug = sanitizeUploadFolder(String(formData.get('folder') ?? 'uploads'));
  const folderId = String(formData.get('folderId') ?? '').trim() || null;
  const altText = String(formData.get('altText') ?? '').trim().slice(0, 240);
  const focalX = Math.min(100, Math.max(0, Number(formData.get('focalX') ?? 50) || 50));
  const focalY = Math.min(100, Math.max(0, Number(formData.get('focalY') ?? 50) || 50));

  const key = buildR2Key(folderSlug, realMime);
  const now = nowIso();
  let sourceType: 'r2' | 'db_blob' = 'db_blob';

  if (c.env.MEDIA_BUCKET) {
    await uploadObject(c.env.MEDIA_BUCKET, key, arrayBuffer, realMime);
    sourceType = 'r2';
  } else {
    const base64 = encodeBytesToBase64(new Uint8Array(arrayBuffer));
    await c.env.DB
      .prepare(`INSERT INTO media_blobs (asset_key, mime_type, data_base64, created_at) VALUES (?1, ?2, ?3, ?4)`)
      .bind(key, realMime, base64, now)
      .run();
  }

  const url = `/api/media/file/${key}`;
  const assetId = generateId('med_');

  await c.env.DB
    .prepare(
      `INSERT INTO media_assets
       (id, folder_id, key, url, filename, mime_type, size_bytes, alt_text, default_focal_x, default_focal_y, tags_json, source_type, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, '[]', ?11, ?12, ?13, ?13)`,
    )
    .bind(
      assetId,
      folderId,
      key,
      url,
      file.name.slice(0, 140) || 'image',
      realMime,
      file.size,
      altText,
      focalX,
      focalY,
      sourceType,
      adminId,
      now,
    )
    .run();

  await auditAdminAction(c, 'UPLOAD_MEDIA_ASSET', 'media_asset', assetId, { key, sourceType, size: file.size });
  return c.json(
    {
      success: true,
      data: {
        id: assetId,
        key,
        url,
        filename: file.name,
        mimeType: realMime,
        sizeBytes: file.size,
        altText,
        defaultFocalX: focalX,
        defaultFocalY: focalY,
      },
    },
    201,
  );
});

// ─── PATCH /api/admin/media/assets/:assetId ──────────────────────────────────
adminMedia.patch(
  '/assets/:assetId',
  requirePermission('media.write'),
  zValidator(
    'json',
    z.object({
      altText: z.string().max(240).optional(),
      defaultFocalX: z.number().int().min(0).max(100).optional(),
      defaultFocalY: z.number().int().min(0).max(100).optional(),
      folderId: z.string().nullable().optional(),
      tags: z.array(z.string().max(30)).optional(),
    }),
  ),
  async (c) => {
    const assetId = c.req.param('assetId');
    const body = c.req.valid('json');
    const sets: string[] = ['updated_at = ?1'];
    const vals: unknown[] = [nowIso()];
    const addSet = (col: string, val: unknown) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.altText !== undefined) addSet('alt_text', body.altText);
    if (body.defaultFocalX !== undefined) addSet('default_focal_x', body.defaultFocalX);
    if (body.defaultFocalY !== undefined) addSet('default_focal_y', body.defaultFocalY);
    if (body.folderId !== undefined) addSet('folder_id', body.folderId);
    if (body.tags !== undefined) addSet('tags_json', JSON.stringify(body.tags));

    vals.push(assetId);
    await c.env.DB
      .prepare(`UPDATE media_assets SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await auditAdminAction(c, 'UPDATE_MEDIA_METADATA', 'media_asset', assetId, body);
    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── DELETE /api/admin/media/assets/:assetId ─────────────────────────────────
adminMedia.delete('/assets/:assetId', requirePermission('media.delete'), async (c) => {
  const assetId = c.req.param('assetId');
  const force = c.req.query('force') === 'true';
  const asset = await c.env.DB
    .prepare(`SELECT * FROM media_assets WHERE id = ?1 LIMIT 1`)
    .bind(assetId)
    .first<{ id: string; key: string; url: string; source_type: string }>();

  if (!asset) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found.', status: 404 } }, 404);
  }

  if (asset.source_type === 'local_seed' && !force) {
    return c.json(
      { success: false, error: { code: 'PROTECTED_ASSET', message: 'Built-in storefront seed assets cannot be deleted without force=true.', status: 409 } },
      409,
    );
  }

  if (asset.source_type === 'r2' && c.env.MEDIA_BUCKET) {
    await deleteR2Object(c.env.MEDIA_BUCKET, asset.key).catch(() => {});
  } else if (asset.source_type === 'db_blob') {
    await c.env.DB.prepare(`DELETE FROM media_blobs WHERE asset_key = ?1`).bind(asset.key).run();
  }

  await c.env.DB.prepare(`DELETE FROM media_assets WHERE id = ?1`).bind(assetId).run();
  await auditAdminAction(c, 'DELETE_MEDIA_ASSET', 'media_asset', assetId, { key: asset.key });
  return c.json({ success: true, data: { deleted: true } });
});

export default adminMedia;
