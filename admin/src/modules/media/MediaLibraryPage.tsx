import { useState, useEffect, useRef } from 'react';
import { media as mediaApi } from '../../lib/api';
import { uploadLocalMediaFile } from '../../lib/mediaUpload';
import { PageHeader, Button, Input, Spinner, Modal, Badge } from '../../components/ui';

interface NormalizedAsset {
  id: string;
  folderId: string | null;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  altText: string;
  defaultFocalX: number;
  defaultFocalY: number;
  inUse: boolean;
  sourceType: string;
}

interface NormalizedFolder {
  id: string;
  name: string;
  slug: string;
}

function formatBytes(b: number) {
  if (!b) return 'Built-in asset';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function isVideo(asset: { url: string; mimeType?: string }) {
  return Boolean(asset.mimeType?.startsWith('video/') || /\.(mp4|webm)(\?|$)/i.test(asset.url));
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<NormalizedAsset[]>([]);
  const [folders, setFolders] = useState<NormalizedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<NormalizedAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NormalizedAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [altText, setAltText] = useState('');
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const [moveFolderId, setMoveFolderId] = useState<string>('');
  const [folderModal, setFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (folderId?: string, q?: string) => {
    setLoading(true);
    mediaApi
      .list(folderId, q)
      .then((res) => {
        if (res.success && res.data) {
          const rawItems = (res.data.items ?? res.data.assets ?? []) as Record<string, unknown>[];
          const normalized: NormalizedAsset[] = rawItems.map((a) => ({
            id: String(a.id ?? ''),
            folderId: a.folderId ? String(a.folderId) : null,
            url: String(a.url ?? ''),
            filename: String(a.filename ?? a.original_name ?? 'image'),
            mimeType: String(a.mimeType ?? a.mime_type ?? 'image/jpeg'),
            sizeBytes: Number(a.sizeBytes ?? a.size_bytes ?? 0),
            altText: String(a.altText ?? a.alt_text ?? ''),
            defaultFocalX: Number(a.defaultFocalX ?? a.focal_x ?? 50),
            defaultFocalY: Number(a.defaultFocalY ?? a.focal_y ?? 50),
            inUse: Boolean(a.inUse),
            sourceType: String(a.sourceType ?? 'local_seed'),
          }));
          setAssets(normalized);

          const rawFolders = (res.data.folders ?? []) as Record<string, unknown>[];
          setFolders(
            rawFolders.map((f) => ({
              id: String(f.id ?? ''),
              name: String(f.name ?? ''),
              slug: String(f.slug ?? ''),
            })),
          );
        } else if (!res.success) {
          setError(res.error?.message || 'Failed to load media library.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Network error while loading media library.');
        setLoading(false);
      });
  };

  useEffect(() => {
    load(activeFolderId, search || undefined);
  }, [activeFolderId]);

  const handleSearch = () => load(activeFolderId, search || undefined);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    setNotice('');
    let uploadedCount = 0;
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}…`);
        const res = await uploadLocalMediaFile(file, { folderId: activeFolderId });
        if (!res.success) {
          setError(`"${file.name}": ${res.message}`);
          continue;
        }
        uploadedCount += 1;
      }
      if (uploadedCount > 0) {
        setNotice(`Uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''} from your device.`);
        load(activeFolderId, search || undefined);
      }
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await mediaApi.createFolder(newFolderName.trim());
    if (!res.success) {
      setError(res.error?.message || 'Failed to create folder.');
      return;
    }
    const createdName = newFolderName.trim();
    setNewFolderName('');
    setFolderModal(false);
    setNotice(`Folder "${createdName}" created.`);
    load(activeFolderId);
  };

  const removeFolder = async (folder: NormalizedFolder) => {
    const res = await mediaApi.deleteFolder(folder.id);
    if (!res.success) {
      setError(res.error?.message || 'Failed to delete folder.');
      return;
    }
    if (activeFolderId === folder.id) setActiveFolderId(undefined);
    setNotice(`Folder "${folder.name}" removed. Assets inside remain in All Assets.`);
    load(activeFolderId === folder.id ? undefined : activeFolderId);
  };

  const saveAssetMeta = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    const res = await mediaApi.update(selected.id, {
      altText,
      defaultFocalX: focalX,
      defaultFocalY: focalY,
      folderId: moveFolderId || null,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to save metadata.');
      return;
    }
    setNotice('Image metadata, folder, and focal point saved.');
    load(activeFolderId);
  };

  const confirmDeleteAsset = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const res = await mediaApi.delete(deleteTarget.id, true);
      if (!res.success) {
        setError(res.error?.message ?? 'Delete failed.');
        return;
      }
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      setNotice(`Removed "${deleteTarget.filename}" permanently.`);
      load(activeFolderId, search || undefined);
    } finally {
      setDeleting(false);
    }
  };

  const selectAsset = (asset: NormalizedAsset) => {
    setSelected(asset);
    setAltText(asset.altText);
    setFocalX(asset.defaultFocalX);
    setFocalY(asset.defaultFocalY);
    setMoveFolderId(asset.folderId ?? '');
    setCopied(false);
  };

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Upload images or runway videos from your local device, organize folders, adjust focal points, and remove unused assets."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFolderModal(true)}>
              + New Folder
            </Button>
            <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : '+ Upload from Device'}
            </Button>
          </div>
        }
      />

      {uploadProgress && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2.5 rounded-xl">
          {uploadProgress}
        </div>
      )}
      {notice && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2.5 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Banner */}
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
        onClick={() => fileRef.current?.click()}
        className={`mb-5 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragActive ? 'border-gold-500 bg-gold-50/70' : 'border-ink-200 bg-white hover:border-gold-400'
        }`}
      >
        <p className="text-sm font-medium text-ink-900">
          Drag &amp; drop photos or videos here, or click to select from your computer / phone
        </p>
        <p className="text-xs text-ink-500 mt-1">
          Supports JPG, PNG, WebP, AVIF, GIF (up to 10 MB, auto-optimized) &amp; MP4/WebM runway video (up to 15 MB). Multiple files supported.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-300px)]">
        {/* Folder Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="bg-white border border-ink-200 rounded-xl p-3 lg:h-full overflow-y-auto space-y-1">
            <button
              onClick={() => {
                setActiveFolderId(undefined);
                load(undefined, search || undefined);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !activeFolderId ? 'bg-ink-900 text-white font-medium' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              All Assets {!activeFolderId ? `(${assets.length})` : ''}
            </button>
            {folders.map((f) => (
              <div key={f.id} className="group flex items-center gap-1">
                <button
                  onClick={() => setActiveFolderId(f.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                    activeFolderId === f.id ? 'bg-ink-900 text-white font-medium' : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  📁 {f.name}
                </button>
                <button
                  type="button"
                  title={`Delete folder "${f.name}"`}
                  onClick={() => removeFolder(f)}
                  className="p-1 text-xs text-ink-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
                placeholder="Search by filename, alt text, or tag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch} size="sm">
                Search
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) uploadFiles(e.target.files);
                }}
              />
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-ink-200 rounded-xl">
                <p className="text-sm font-medium text-ink-900">No assets in this folder</p>
                <p className="text-xs text-ink-500 mt-1 mb-4">Upload images or videos directly from your local device.</p>
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                  + Upload First Asset
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pb-4">
                {assets.map((asset) => {
                  const vid = isVideo(asset);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => selectAsset(asset)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && selectAsset(asset)}
                      className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-ink-100 cursor-pointer ${
                        selected?.id === asset.id ? 'border-gold-500 ring-2 ring-gold-200' : 'border-transparent hover:border-ink-300'
                      }`}
                    >
                      {vid ? (
                        <video src={asset.url} muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img src={asset.url} alt={asset.altText || asset.filename} className="w-full h-full object-cover" loading="lazy" />
                      )}
                      {vid && (
                        <span className="absolute top-2 left-2 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase">
                          Video
                        </span>
                      )}
                      <button
                        type="button"
                        title="Delete asset"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(asset);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 py-2 text-left">
                        <p className="text-[11px] text-white font-medium truncate">{asset.filename}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="lg:w-80 flex-shrink-0 bg-white border border-ink-200 rounded-xl p-5 overflow-y-auto">
              <div className="relative aspect-video rounded-lg overflow-hidden mb-4 bg-ink-100 border border-ink-200">
                {isVideo(selected) ? (
                  <video src={selected.url} controls muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <>
                    <img
                      src={selected.url}
                      alt={selected.altText}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${focalX}% ${focalY}%` }}
                    />
                    <div
                      className="absolute w-3.5 h-3.5 rounded-full border-2 border-white bg-gold-500 shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${focalX}%`, top: `${focalY}%` }}
                    />
                  </>
                )}
              </div>

              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-ink-900 truncate">{selected.filename}</p>
                {selected.inUse && <Badge variant="success">In Use</Badge>}
              </div>
              <p className="text-xs text-ink-400 mb-4">
                {formatBytes(selected.sizeBytes)} · {selected.mimeType}
              </p>

              <div className="space-y-4">
                <Input
                  label="Alt Text (SEO & Accessibility)"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  tooltip="Descriptive text for search engines and screen readers."
                />

                <div>
                  <label className="text-sm font-medium text-ink-700 mb-1 block">Folder</label>
                  <select
                    value={moveFolderId}
                    onChange={(e) => setMoveFolderId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
                  >
                    <option value="">Uncategorized (All Assets)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!isVideo(selected) && (
                  <div>
                    <label className="text-sm font-medium text-ink-700 mb-2 block">Focal Point Preview</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-ink-500 mb-1 block">X ({focalX}%)</label>
                        <input type="range" min={0} max={100} value={focalX} onChange={(e) => setFocalX(Number(e.target.value))} className="w-full accent-gold-500" />
                      </div>
                      <div>
                        <label className="text-xs text-ink-500 mb-1 block">Y ({focalY}%)</label>
                        <input type="range" min={0} max={100} value={focalY} onChange={(e) => setFocalY(Number(e.target.value))} className="w-full accent-gold-500" />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selected.url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="w-full text-left text-xs font-mono text-gold-700 bg-gold-50 border border-gold-200 px-3 py-2 rounded-lg hover:bg-gold-100 transition-colors truncate"
                  title="Click to copy URL"
                >
                  {copied ? '✓ Copied URL!' : `📋 ${selected.url}`}
                </button>

                <Button size="sm" loading={saving} onClick={saveAssetMeta} className="w-full justify-center">
                  Save Metadata
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(selected)} className="w-full justify-center">
                  Remove / Delete Asset
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      <Modal
        open={folderModal}
        onClose={() => setFolderModal(false)}
        title="Create Media Folder"
        footer={
          <>
            <Button variant="outline" onClick={() => setFolderModal(false)}>
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </>
        }
      >
        <Input
          label="Folder Name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="e.g. Summer 2026 Campaign"
          tooltip="Organize uploaded photos into named folders."
        />
      </Modal>

      {/* Delete Asset Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Media Asset"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDeleteAsset}>
              Delete Permanently
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3">
            <p className="text-sm text-ink-700">
              Are you sure you want to permanently remove <strong>{deleteTarget.filename}</strong> from the Media Library?
            </p>
            {deleteTarget.inUse && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                Warning: This asset is currently referenced by a product, brand setting, or CMS section. Update that item after deleting.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
