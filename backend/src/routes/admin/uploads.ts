import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import {
  buildR2Key,
  detectImageMimeFromBytes,
  getPublicUrl,
  uploadObject,
} from '../../services/r2Storage.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminUploads = new Hono<{ Bindings: Env }>();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

adminUploads.post('/', async (c) => {
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

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, AVIF.`,
          status: 415,
        },
      },
      415,
    );
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File size must be between 1 byte and 5 MB.',
          status: 413,
        },
      },
      413,
    );
  }

  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        success: false,
        error: {
          code: 'R2_NOT_ENABLED',
          message: 'R2 storage bucket is not configured. Enable R2 in Cloudflare Dashboard.',
          status: 503,
        },
      },
      503,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const realMime = detectImageMimeFromBytes(arrayBuffer);
  if (!realMime) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_IMAGE_CONTENT',
          message: 'Uploaded file header bytes do not match a supported image signature.',
          status: 400,
        },
      },
      400,
    );
  }

  const folder = String(formData.get('folder') ?? 'uploads');
  const key = buildR2Key(folder, realMime);

  await uploadObject(c.env.MEDIA_BUCKET, key, arrayBuffer, realMime);
  const url = getPublicUrl(c.env.MEDIA_BUCKET_PUBLIC_URL, key);

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'UPLOAD_MEDIA', 'r2_object', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      generateId('log_'),
      adminId,
      key,
      JSON.stringify({ size: file.size, mime: realMime }),
      ip,
      nowIso(),
    )
    .run();

  return c.json({ success: true, data: { key, url, mimeType: realMime } }, 201);
});

export default adminUploads;
