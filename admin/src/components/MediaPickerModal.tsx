import { useEffect, useRef, useState } from 'react';
import { media as mediaApi } from '../lib/api';
import { Button, Modal, Spinner } from './ui';

export interface PickedMediaAsset {
  id: string;
  url: string;
  filename: string;
  altText: string;
  defaultFocalX: number;
  defaultFocalY: number;
}

interface FolderItem {
  id: string;
  name: string;
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  title = 'Choose or Upload Image',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: PickedMediaAsset) => void;
  title?: string;
}) {
  const [assets, setAssets] = useState<PickedMediaAsset[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
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
          setAssets(
            rawItems.map((a) => ({
              id: String(a.id ?? ''),
              url: String(a.url ?? ''),
              filename: String(a.filename ?? a.original_name ?? 'image'),
              altText: String(a.altText ?? a.alt_text ?? ''),
              defaultFocalX: Number(a.defaultFocalX ?? a.focal_x ?? 50),
              defaultFocalY: Number(a.defaultFocalY ?? a.focal_y ?? 50),
            })),
          );
          const rawFolders = (res.data.folders ?? []) as Record<string, unknown>[];
          setFolders(rawFolders.map((f) => ({ id: String(f.id ?? ''), name: String(f.name ?? '') })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load(activeFolderId, search || undefined);
  }, [open, activeFolderId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (activeFolderId) fd.append('folderId', activeFolderId);
      const res = await mediaApi.upload(fd);
      if (!res.success || !res.data) {
        setError(res.error?.message ?? 'Upload failed. Only JPEG, PNG, WebP, or AVIF up to 5 MB allowed.');
        return;
      }
      const d = res.data as Record<string, unknown>;
      const picked: PickedMediaAsset = {
        id: String(d.id ?? ''),
        url: String(d.url ?? ''),
        filename: String(d.filename ?? file.name),
        altText: String(d.altText ?? ''),
        defaultFocalX: Number(d.defaultFocalX ?? 50),
        defaultFocalY: Number(d.defaultFocalY ?? 50),
      };
      onSelect(picked);
      onClose();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(activeFolderId, search || undefined)}
            placeholder="Search library by filename or tag…"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <Button size="sm" variant="outline" onClick={() => load(activeFolderId, search || undefined)}>
            Search
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'Uploading…' : '+ Upload New Image'}
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
            <p className="text-sm font-medium text-ink-800">No images in this folder</p>
            <p className="text-xs text-ink-500 mt-1">Click &ldquo;+ Upload New Image&rdquo; above to upload directly from your device.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  onSelect(asset);
                  onClose();
                }}
                className="group relative aspect-square rounded-xl overflow-hidden border border-ink-200 hover:border-gold-500 hover:ring-2 hover:ring-gold-200 transition-all bg-ink-50 text-left"
              >
                <img src={asset.url} alt={asset.altText || asset.filename} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white truncate font-medium">{asset.filename}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Reusable Image Field with live thumbnail preview + 1-click "Choose / Upload" Media Picker trigger.
 */
export function ImageUrlField({
  label,
  value,
  onChange,
  onPickMeta,
  tooltip,
  placeholder = '/images/... or upload',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onPickMeta?: (asset: PickedMediaAsset) => void;
  tooltip?: string;
  placeholder?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-1.5">
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
      <div className="flex items-center gap-2">
        {value && (
          <div className="w-10 h-10 rounded-lg border border-ink-200 bg-ink-50 overflow-hidden flex-shrink-0">
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = '0.2';
              }}
            />
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          Browse / Upload
        </Button>
      </div>
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Select ${label}`}
        onSelect={(asset) => {
          onChange(asset.url);
          onPickMeta?.(asset);
        }}
      />
    </div>
  );
}
