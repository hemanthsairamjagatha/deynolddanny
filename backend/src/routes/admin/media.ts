import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import {
  buildR2Key,
  deleteMediaBinary,
  detectMediaMimeFromBytes,
  sanitizeUploadFolder,
  storeMediaBinary,
} from '../../services/r2Storage.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';
import { invalidateStorefrontCache, safeJsonParse } from '../../services/storefrontCache.js';

const adminMedia = new Hono<{ Bindings: Env }>();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

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

// ─── DELETE /api/admin/media/folders/:folderId ──────────────────────────────
adminMedia.delete('/folders/:folderId', requirePermission('media.delete'), async (c) => {
  const folderId = c.req.param('folderId');
  await c.env.DB
    .prepare(`UPDATE media_assets SET folder_id = NULL WHERE folder_id = ?1`)
    .bind(folderId)
    .run();
  await c.env.DB.prepare(`DELETE FROM media_folders WHERE id = ?1`).bind(folderId).run();
  await auditAdminAction(c, 'DELETE_MEDIA_FOLDER', 'media_folder', folderId);
  return c.json({ success: true, data: { deleted: true } });
});

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

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Uploaded file is empty.', status: 400 } },
      400,
    );
  }

  // Inspect actual binary signature first so Windows/macOS files with blank or alternate MIME types work reliably
  const realMime = detectMediaMimeFromBytes(arrayBuffer);
  if (!realMime) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Unsupported or invalid file format. Allowed: JPEG, PNG, WebP, AVIF, GIF, MP4, WebM.',
          status: 415,
        },
      },
      415,
    );
  }

  const isVideo = realMime.startsWith('video/');
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (arrayBuffer.byteLength > maxBytes) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: isVideo
            ? 'Runway video must be 15 MB or smaller.'
            : 'Image must be 10 MB or smaller.',
          status: 413,
        },
      },
      413,
    );
  }

  const folderSlug = sanitizeUploadFolder(String(formData.get('folder') ?? 'uploads'));
  const folderId = String(formData.get('folderId') ?? '').trim() || null;
  const altText = String(formData.get('altText') ?? '').trim().slice(0, 240);
  const focalX = Math.min(100, Math.max(0, Number(formData.get('focalX') ?? 50) || 50));
  const focalY = Math.min(100, Math.max(0, Number(formData.get('focalY') ?? 50) || 50));

  const key = buildR2Key(folderSlug, realMime);
  const now = nowIso();
  const sourceType = await storeMediaBinary(c.env, key, arrayBuffer, realMime, now);

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
      arrayBuffer.byteLength,
      altText,
      focalX,
      focalY,
      sourceType,
      adminId,
      now,
    )
    .run();

  await auditAdminAction(c, 'UPLOAD_MEDIA_ASSET', 'media_asset', assetId, {
    key,
    sourceType,
    size: arrayBuffer.byteLength,
    mimeType: realMime,
  });
  return c.json(
    {
      success: true,
      data: {
        id: assetId,
        key,
        url,
        filename: file.name,
        mimeType: realMime,
        sizeBytes: arrayBuffer.byteLength,
        altText,
        defaultFocalX: focalX,
        defaultFocalY: focalY,
        sourceType,
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

  if (asset.source_type === 'r2' || asset.source_type === 'db_blob') {
    await deleteMediaBinary(c.env, asset.key);
  }

  await c.env.DB.prepare(`DELETE FROM media_assets WHERE id = ?1`).bind(assetId).run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'DELETE_MEDIA_ASSET', 'media_asset', assetId, { key: asset.key });
  return c.json({ success: true, data: { deleted: true } });
});

export default adminMedia;
