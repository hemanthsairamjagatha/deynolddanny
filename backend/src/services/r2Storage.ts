/**
 * Cloudflare R2 storage service with path-traversal protection and magic-byte image validation.
 */

const ALLOWED_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Inspects file header magic bytes to confirm actual binary image type.
 */
export function detectImageMimeFromBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // AVIF: ....ftypavif
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    bytes[11] === 0x66
  ) {
    return 'image/avif';
  }

  return null;
}

/**
 * Sanitizes upload folder name against traversal & invalid characters.
 */
export function sanitizeUploadFolder(rawFolder: string): string {
  const clean = rawFolder
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => seg.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .slice(0, 3)
    .join('/');

  return clean || 'products';
}

export function buildR2Key(folder: string, mimeType: string): string {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  const uid = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const ext = ALLOWED_EXT_MAP[mimeType] ?? 'jpg';
  const safeFolder = sanitizeUploadFolder(folder);
  return `${safeFolder}/image-${uid}.${ext}`;
}

export async function uploadObject(
  r2: R2Bucket,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await r2.put(key, body, { httpMetadata: { contentType } });
}

export function getPublicUrl(bucketPublicUrl: string, key: string): string {
  const base = bucketPublicUrl.replace(/\/$/, '');
  return `${base}/${key}`;
}

export async function deleteR2Object(r2: R2Bucket, key: string): Promise<void> {
  await r2.delete(key);
}
