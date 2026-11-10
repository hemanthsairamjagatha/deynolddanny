import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { uploadObject, getPublicUrl } from '../../services/r2Storage.js';
import { generateId } from '../../services/crypto.js';

const adminUploads = new Hono<{ Bindings: Env }>();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── POST /api/admin/uploads — single file upload ────────────────────────────

adminUploads.post('/', async (c) => {
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

  // Validate MIME type
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

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `File exceeds maximum size of 5 MB.`,
          status: 413,
        },
      },
      413,
    );
  }

  // Generate a unique key
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        success: false,
        error: { code: 'R2_NOT_ENABLED', message: 'R2 storage bucket is not configured. Enable R2 in Cloudflare Dashboard.' },
      },
      503,
    );
  }
  const ext = file.name.split('.').pop() ?? 'jpg';
  const folder = (formData.get('folder') as string) ?? 'uploads';
  const key = `${folder}/${generateId('img_')}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await uploadObject(c.env.MEDIA_BUCKET, key, arrayBuffer, file.type);

  const url = getPublicUrl(c.env.MEDIA_BUCKET_PUBLIC_URL, key);

  return c.json({ success: true, data: { key, url } }, 201);
});

export default adminUploads;

