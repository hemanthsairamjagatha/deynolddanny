import { useEffect, useRef, useState } from 'react';
import { media as mediaApi } from '../lib/api';
import { uploadLocalMediaFile } from '../lib/mediaUpload';
import { Button, Modal, Spinner } from './ui';

export interface PickedMediaAsset {
  id: string;
  url: string;
  filename: string;
  mimeType?: string;
  altText: string;
  defaultFocalX: number;
  defaultFocalY: number;
  sourceType?: string;
}

interface FolderItem {
  id: string;
  name: string;
}

function isVideoAsset(url: string, mimeType?: string): boolean {
  if (mimeType && mimeType.startsWith('video/')) return true;
  return /\.(mp4|webm)(\?|$)/i.test(url);
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  title = 'Choose or Upload Media',
  allowVideo = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: PickedMediaAsset) => void;
  title?: string;
  allowVideo?: boolean;
}) {
  const [assets, setAssets] = useState<PickedMediaAsset[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (folderId?: string, q?: string) => {
    setLoading(true);
    setError('');
    mediaApi
      .list(folderId, q)
      .then((res) => {
        if (res.success && res.data) {
          const rawItems = (res.data.items ?? res.data.assets ?? []) as Record<string, unknown>[];
          const mapped: PickedMediaAsset[] = rawItems.map((a) => ({
            id: String(a.id ?? ''),
            url: String(a.url ?? ''),
            filename: String(a.filename ?? a.original_name ?? 'image'),
            mimeType: String(a.mimeType ?? a.mime_type ?? 'image/jpeg'),
            altText: String(a.altText ?? a.alt_text ?? ''),
            defaultFocalX: Number(a.defaultFocalX ?? a.focal_x ?? 50),
            defaultFocalY: Number(a.defaultFocalY ?? a.focal_y ?? 50),
            sourceType: String(a.sourceType ?? 'r2'),
          }));
          setAssets(allowVideo ? mapped : mapped.filter((m) => !isVideoAsset(m.url, m.mimeType)));
          const rawFolders = (res.data.folders ?? []) as Record<string, unknown>[];
          setFolders(rawFolders.map((f) => ({ id: String(f.id ?? ''), name: String(f.name ?? '') })));
        } else if (!res.success) {
          setError(res.error?.message || 'Unable to load media library.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to reach media library.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open) {
      setConfirmDeleteId(null);
      load(activeFolderId, search || undefined);
    }
  }, [open, activeFolderId]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      let lastPicked: PickedMediaAsset | null = null;
      for (const file of files) {
        const result = await uploadLocalMediaFile(file, { folderId: activeFolderId });
        if (!result.success) {
          setError(result.message);
          return;
        }
        lastPicked = {
          id: result.asset.id,
          url: result.asset.url,
          filename: result.asset.filename,
          mimeType: result.asset.mimeType,
          altText: result.asset.altText,
          defaultFocalX: result.asset.defaultFocalX,
          defaultFocalY: result.asset.defaultFocalY,
        };
      }
      if (files.length === 1 && lastPicked) {
        onSelect(lastPicked);
        onClose();
      } else {
        load(activeFolderId, search || undefined);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    setDeletingId(assetId);
    setError('');
    try {
      const res = await mediaApi.delete(assetId, true);
      if (!res.success) {
        setError(res.error?.message || 'Failed to delete asset.');
        return;
      }
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="space-y-4">
        {/* Dropzone + Local Device Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
          }}
          className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border-2 border-dashed transition-colors ${
            dragActive ? 'border-gold-500 bg-gold-50/70' : 'border-ink-200 bg-ink-50/50'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-ink-900">
              {uploading ? 'Uploading from your device…' : 'Drop files here or upload from your device'}
            </p>
            <p className="text-xs text-ink-500">
              {allowVideo
                ? 'JPG, PNG, WebP, AVIF, GIF (auto-optimized) or MP4/WebM video up to 15 MB.'
                : 'JPG, PNG, WebP, AVIF, GIF — large photos are auto-optimized for fast storefront loading.'}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={allowVideo ? 'image/*,video/mp4,video/webm' : 'image/*'}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files);
            }}
          />
          <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'Uploading…' : '+ Upload from Device'}
          </Button>
        </div>

        {/* Search Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(activeFolderId, search || undefined)}
            placeholder="Search library by filename or tag…"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => load(activeFolderId, search || undefined)}>
            Search
          </Button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

        {/* Folder pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFolderId(undefined)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !activeFolderId ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            All Assets
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFolderId(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFolderId === f.id ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : assets.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-ink-200 rounded-xl">
            <p className="text-sm font-medium text-ink-800">No media in this folder</p>
            <p className="text-xs text-ink-500 mt-1">Click &ldquo;+ Upload from Device&rdquo; above to add imagery.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[46vh] overflow-y-auto pr-1">
            {assets.map((asset) => {
              const isVid = isVideoAsset(asset.url, asset.mimeType);
              const isConfirming = confirmDeleteId === asset.id;
              return (
                <div
                  key={asset.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-ink-200 hover:border-gold-500 hover:ring-2 hover:ring-gold-200 transition-all bg-ink-50"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset);
                      onClose();
                    }}
                    className="w-full h-full block text-left"
                  >
                    {isVid ? (
                      <video src={asset.url} muted playsInline className="w-full h-full object-cover" />
                    ) : (
                      <img src={asset.url} alt={asset.altText || asset.filename} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-1.5">
                      <p className="text-[10px] text-white truncate font-medium">{asset.filename}</p>
                    </div>
                  </button>

                  {/* Remove / Delete from Library button */}
                  {!isConfirming ? (
                    <button
                      type="button"
                      title="Delete from Media Library"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(asset.id);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  ) : (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 text-center gap-2 z-10"
                    >
                      <p className="text-[11px] text-white font-medium">Delete permanently?</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-white/20 text-white text-[10px] hover:bg-white/30"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === asset.id}
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold hover:bg-red-700"
                        >
                          {deletingId === asset.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Reusable Image/Video Field with live thumbnail preview, 1-click Local Device Upload,
 * Media Library Browser, Drag-and-Drop, and 1-click Remove/Clear button.
 */
export function ImageUrlField({
  label,
  value,
  onChange,
  onPickMeta,
  tooltip,
  placeholder = '/images/... or upload from device',
  allowVideo = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onPickMeta?: (asset: PickedMediaAsset) => void;
  tooltip?: string;
  placeholder?: string;
  allowVideo?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const quickFileRef = useRef<HTMLInputElement>(null);

  const handleDirectUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadLocalMediaFile(file);
      if (!result.success) {
        setUploadError(result.message);
        return;
      }
      onChange(result.asset.url);
      onPickMeta?.({
        id: result.asset.id,
        url: result.asset.url,
        filename: result.asset.filename,
        mimeType: result.asset.mimeType,
        altText: result.asset.altText,
        defaultFocalX: result.asset.defaultFocalX,
        defaultFocalY: result.asset.defaultFocalY,
      });
    } finally {
      setUploading(false);
      if (quickFileRef.current) quickFileRef.current.value = '';
    }
  };

  const isVid = value ? isVideoAsset(value) : false;

  return (
    <div
      className={`space-y-1.5 rounded-xl transition-colors ${dragActive ? 'ring-2 ring-gold-400 bg-gold-50/40 p-2 -m-2' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleDirectUpload(file);
      }}
    >
      <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
        {label}
        {tooltip && (
          <span
            className="w-4 h-4 rounded-full bg-ink-200 text-ink-500 text-xs flex items-center justify-center cursor-help font-semibold"
            title={tooltip}
          >
            i
          </span>
        )}
      </label>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        {value && (
          <div className="relative w-12 h-12 rounded-lg border border-ink-200 bg-ink-50 overflow-hidden flex-shrink-0">
            {isVid ? (
              <video src={value} muted playsInline className="w-full h-full object-cover" />
            ) : (
              <img
                src={value}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = '0.2';
                }}
              />
            )}
          </div>
        )}

        <input
          type="text"
          value={value}
          onChange={(e) => {
            setUploadError('');
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="flex-1 min-w-[160px] px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
        />

        <input
          ref={quickFileRef}
          type="file"
          accept={allowVideo ? 'image/*,video/mp4,video/webm' : 'image/*'}
          className="hidden"
          onChange={(e) => handleDirectUpload(e.target.files?.[0])}
        />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={uploading}
            onClick={() => quickFileRef.current?.click()}
            title="Upload directly from your device"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            Library
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 px-2"
              title="Remove image"
              onClick={() => {
                setUploadError('');
                onChange('');
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Select ${label}`}
        allowVideo={allowVideo}
        onSelect={(asset) => {
          setUploadError('');
          onChange(asset.url);
          onPickMeta?.(asset);
        }}
      />
    </div>
  );
}
