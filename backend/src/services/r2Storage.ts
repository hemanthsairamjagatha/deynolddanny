/**
 * Cloudflare R2 storage service.
 * Product images are stored in R2 with $0 egress fees.
 * Admins upload directly to R2 via presigned PUT URLs.
 */

/**
 * Generates a unique R2 object key for an uploaded product image.
 * Example: products/mastery-1/image-a1b2c3d4.jpg
 */
export function buildR2Key(productId: string, filename: string): string {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const uid = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  const ext = filename.split('.').pop() ?? 'jpg';
  return `products/${productId}/image-${uid}.${ext}`;
}

/**
 * Puts an object directly into R2.
 * Used for server-side uploads (not for large admin uploads — use presigned URL for those).
 */
export async function putR2Object(
  r2: R2Bucket,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string> {
  await r2.put(key, body, { httpMetadata: { contentType } });
  return `/${key}`;
}

/**
 * Alias used by admin upload route.
 */
export async function uploadObject(
  r2: R2Bucket,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await r2.put(key, body, { httpMetadata: { contentType } });
}

/**
 * Returns the full public CDN URL for an R2 object.
 */
export function getPublicUrl(bucketPublicUrl: string, key: string): string {
  const base = bucketPublicUrl.replace(/\/$/, '');
  return `${base}/${key}`;
}

/**
 * Deletes a single R2 object by key.
 */
export async function deleteR2Object(r2: R2Bucket, key: string): Promise<void> {
  await r2.delete(key);
}

/**
 * Creates a presigned upload URL for direct client-to-R2 uploads.
 * The admin client uses this to upload high-res images without routing
 * through the Worker (zero CPU cost for large file transfers).
 *
 * Note: Cloudflare R2 presigned URLs require the R2 public bucket URL base
 * to be configured. Returns the key so the admin can construct the public URL.
 */
export async function createPresignedUploadKey(
  _r2: R2Bucket,
  productId: string,
  filename: string,
): Promise<{ key: string; uploadUrl: string }> {
  const key = buildR2Key(productId, filename);
  // In production: use R2 binding's createMultipartUpload or wrangler R2 presigned URLs
  // For the initial implementation, return the key; the admin panel constructs the upload URL
  // via POST /api/admin/uploads/presign which the worker will sign using R2 SDK
  const uploadUrl = `https://r2-upload.deynolddanny.com/${key}`;
  return { key, uploadUrl };
}

