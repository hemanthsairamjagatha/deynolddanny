import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import {
  buildR2Key,
  detectMediaMimeFromBytes,
  storeMediaBinary,
} from '../../services/r2Storage.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';
import { requirePermission } from '../../middleware/adminAuth.js';

const adminUploads = new Hono<{ Bindings: Env }>();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

adminUploads.post('/', requirePermission('media.write'), async (c) => {
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
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
      { success: false, error: { code: 'BAD_REQUEST', message: 'Failed to parse form data.', status: 400 } },
      400,
    );
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'No file field found.', status: 400 } },
      400,
    );
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File size must be between 1 byte and 10 MB.',
          status: 413,
        },
      },
      413,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const realMime = detectMediaMimeFromBytes(arrayBuffer);
  if (!realMime) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_IMAGE_CONTENT',
          message: 'Uploaded file header bytes do not match a supported image or video signature.',
          status: 400,
        },
      },
      400,
    );
  }

  const folder = String(formData.get('folder') ?? 'uploads');
  const key = buildR2Key(folder, realMime);
  const now = nowIso();

  const sourceType = await storeMediaBinary(c.env, key, arrayBuffer, realMime, now);
  const url = `/api/media/file/${key}`;

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'UPLOAD_MEDIA', 'media_asset', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      generateId('log_'),
      adminId,
      key,
      JSON.stringify({ size: file.size, mime: realMime, sourceType }),
      ip,
      now,
    )
    .run();

  return c.json({ success: true, data: { key, url, mimeType: realMime, sourceType } }, 201);
});

export default adminUploads;
