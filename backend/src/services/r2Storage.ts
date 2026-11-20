/**
 * Cloudflare R2 storage service with path-traversal protection and magic-byte image validation.
 */

const ALLOWED_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const D1_BLOB_CHUNK_CHARS = 450_000; // Safe well below D1 1 MB statement/row limit
const D1_MAX_PERSIST_BYTES = 5 * 1024 * 1024; // Persist up to 5 MB images in D1 chunks; larger videos rely on R2/KV

/**
 * Inspects file header magic bytes to confirm actual binary image or video type.
 */
export function detectMediaMimeFromBytes(buffer: ArrayBuffer): string | null {
  const img = detectImageMimeFromBytes(buffer);
  if (img) return img;
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length < 12) return null;
  // MP4 / MOV ISO Base Media: ....ftyp (bytes 4..7 = 'ftyp')
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'video/mp4';
  }
  // WebM / EBML: 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  return null;
}

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
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  // GIF: GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
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
  // AVIF: ....ftypavif or ....ftypavis or ....ftypmif1
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    ((bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && (bytes[11] === 0x66 || bytes[11] === 0x73)) ||
      (bytes[8] === 0x6d && bytes[9] === 0x69 && bytes[10] === 0x66 && bytes[11] === 0x31))
  ) {
    return 'image/avif';
  }

  return null;
}

export function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Stores binary media safely across R2 (when bound), KV edge cache (up to 25 MiB),
 * and chunked D1 `media_blobs` fallback (chunked <= 450 KB per row to never hit D1 1 MB limits).
 */
export async function storeMediaBinary(
  env: { MEDIA_BUCKET?: R2Bucket; CATALOG_KV?: KVNamespace; DB: D1Database },
  key: string,
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  now: string,
): Promise<'r2' | 'db_blob'> {
  if (env.MEDIA_BUCKET) {
    await uploadObject(env.MEDIA_BUCKET, key, arrayBuffer, mimeType);
    return 'r2';
  }

  let kvStored = false;
  if (env.CATALOG_KV) {
    try {
      await env.CATALOG_KV.put(`media:bin:${key}`, arrayBuffer, {
        metadata: { mimeType },
      });
      kvStored = true;
    } catch {
      kvStored = false;
    }
  }

  // Persist durably in D1 `media_blobs` in safe chunks for images (<= 5 MB) or if KV wasn't available
  if (arrayBuffer.byteLength <= D1_MAX_PERSIST_BYTES || !kvStored) {
    const base64 = encodeBytesToBase64(new Uint8Array(arrayBuffer));
    if (base64.length <= D1_BLOB_CHUNK_CHARS) {
      await env.DB
        .prepare(
          `INSERT OR REPLACE INTO media_blobs (asset_key, mime_type, data_base64, created_at)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(key, mimeType, base64, now)
        .run();
    } else {
      const totalParts = Math.ceil(base64.length / D1_BLOB_CHUNK_CHARS);
      const stmts: D1PreparedStatement[] = [
        env.DB
          .prepare(
            `INSERT OR REPLACE INTO media_blobs (asset_key, mime_type, data_base64, created_at)
             VALUES (?1, ?2, ?3, ?4)`,
          )
          .bind(key, mimeType, `__CHUNKED__:${totalParts}`, now),
      ];
      for (let i = 0; i < totalParts; i += 1) {
        const part = base64.slice(i * D1_BLOB_CHUNK_CHARS, (i + 1) * D1_BLOB_CHUNK_CHARS);
        const partKey = `${key}::part::${String(i).padStart(4, '0')}`;
        stmts.push(
          env.DB
            .prepare(
              `INSERT OR REPLACE INTO media_blobs (asset_key, mime_type, data_base64, created_at)
               VALUES (?1, ?2, ?3, ?4)`,
            )
            .bind(partKey, mimeType, part, now),
        );
      }
      // Run in safe D1 batch sizes (up to 10 statements per batch)
      for (let i = 0; i < stmts.length; i += 10) {
        await env.DB.batch(stmts.slice(i, i + 10));
      }
    }
  }

  return 'db_blob';
}

/**
 * Deletes binary media cleanly from R2, KV edge cache, and D1 `media_blobs` (including chunked parts).
 */
export async function deleteMediaBinary(
  env: { MEDIA_BUCKET?: R2Bucket; CATALOG_KV?: KVNamespace; DB: D1Database },
  key: string,
): Promise<void> {
  const ops: Promise<unknown>[] = [];
  if (env.MEDIA_BUCKET) {
    ops.push(deleteR2Object(env.MEDIA_BUCKET, key).catch(() => {}));
  }
  if (env.CATALOG_KV) {
    ops.push(env.CATALOG_KV.delete(`media:bin:${key}`).catch(() => {}));
  }
  ops.push(
    env.DB
      .prepare(`DELETE FROM media_blobs WHERE asset_key = ?1 OR asset_key LIKE ?2`)
      .bind(key, `${key}::part::%`)
      .run()
      .catch(() => {}),
  );
  await Promise.all(ops);
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
