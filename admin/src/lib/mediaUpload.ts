import { media as mediaApi } from './api';

export interface UploadedMediaResult {
  id: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  altText: string;
  defaultFocalX: number;
  defaultFocalY: number;
}

const MAX_DIMENSION = 2200;
const OPTIMIZE_THRESHOLD_BYTES = 1.6 * 1024 * 1024; // Optimize images larger than 1.6 MB

/**
 * Optimizes very large camera/DSLR photos on the client via Canvas so uploads
 * from local devices are fast, crisp, and never hit payload size walls.
 */
export async function prepareFileForUpload(file: File): Promise<File> {
  const isVideo =
    file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
  if (isVideo) return file;

  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
  if (isGif) return file;

  const isAlreadySupportedSmall =
    file.size <= OPTIMIZE_THRESHOLD_BYTES &&
    /^(image\/(jpeg|jpg|png|webp|avif))$/.test(file.type);
  if (isAlreadySupportedSmall) return file;

  // Try Canvas resize/compress (also converts exotic image formats like BMP/TIFF/HEIC-if-decoded to WebP/JPEG)
  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image decode failed'));
        el.src = objectUrl;
      });

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const targetW = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const targetH = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const keepPng = file.type === 'image/png' || /\.png$/i.test(file.name);
      const outMime = keepPng ? 'image/webp' : 'image/jpeg';
      const outExt = keepPng ? 'webp' : 'jpg';

      let blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), outMime, 0.88),
      );
      // Fallback to JPEG if WebP encoding isn't supported by browser
      if (!blob) {
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88),
        );
      }
      if (!blob) return file;

      // Only replace if converted from unsupported format OR meaningfully smaller
      const isSupportedOrig = /^(image\/(jpeg|jpg|png|webp|avif))$/.test(file.type);
      if (isSupportedOrig && blob.size >= file.size && file.size <= 4.5 * 1024 * 1024) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
      return new File([blob], `${baseName}.${outExt}`, {
        type: blob.type || outMime,
        lastModified: Date.now(),
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}

export async function uploadLocalMediaFile(
  rawFile: File,
  opts?: { folderId?: string; folder?: string; altText?: string },
): Promise<{ success: true; asset: UploadedMediaResult } | { success: false; message: string }> {
  try {
    const file = await prepareFileForUpload(rawFile);
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.folderId) fd.append('folderId', opts.folderId);
    if (opts?.folder) fd.append('folder', opts.folder);
    if (opts?.altText) fd.append('altText', opts.altText);

    const res = await mediaApi.upload(fd);
    if (!res.success || !res.data) {
      return {
        success: false,
        message: res.error?.message || 'Upload failed. Supported: JPG, PNG, WebP, AVIF, GIF (up to 10 MB) or MP4/WebM (up to 15 MB).',
      };
    }

    const d = res.data as Record<string, unknown>;
    return {
      success: true,
      asset: {
        id: String(d.id ?? ''),
        key: String(d.key ?? ''),
        url: String(d.url ?? ''),
        filename: String(d.filename ?? file.name),
        mimeType: String(d.mimeType ?? file.type ?? 'image/jpeg'),
        sizeBytes: Number(d.sizeBytes ?? file.size),
        altText: String(d.altText ?? ''),
        defaultFocalX: Number(d.defaultFocalX ?? 50),
        defaultFocalY: Number(d.defaultFocalY ?? 50),
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Network error during file upload.',
    };
  }
}

