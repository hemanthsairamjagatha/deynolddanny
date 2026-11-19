import { useState, useEffect, useRef } from 'react';
import { media as mediaApi } from '../../lib/api';
import type { MediaAsset, MediaFolder } from '../../lib/types';
import { PageHeader, Button, Input, Spinner } from '../../components/ui';

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState('');
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (folderId?: string, q?: string) => {
    setLoading(true);
    mediaApi.list(folderId, q).then(res => {
      if (res.success && res.data) {
        setAssets(res.data.assets ?? []);
        setFolders(res.data.folders ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(activeFolderId, search || undefined); }, [activeFolderId]);

  const handleSearch = () => load(activeFolderId, search || undefined);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (activeFolderId) fd.append('folder_id', activeFolderId);
    await mediaApi.upload(fd);
    load(activeFolderId);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveAssetMeta = async () => {
    if (!selected) return;
    await mediaApi.update(selected.id, { alt_text: altText, focal_x: focalX, focal_y: focalY });
    load(activeFolderId);
  };

  const deleteAsset = async () => {
    if (!selected || !confirm('Delete this asset? It cannot be recovered.')) return;
    await mediaApi.delete(selected.id);
    setSelected(null);
    load(activeFolderId);
  };

  const selectAsset = (asset: MediaAsset) => {
    setSelected(asset);
    setAltText(asset.alt_text ?? '');
    setFocalX(asset.focal_x ?? 50);
    setFocalY(asset.focal_y ?? 50);
  };

  return (
    <div>
      <PageHeader title="Media Library" description="Upload, organise and manage all storefront media assets." />

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Folder Sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white border border-ink-200 rounded-xl p-3 h-full overflow-y-auto">
            <button
              onClick={() => { setActiveFolderId(undefined); load(); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!activeFolderId ? 'bg-ink-900 text-white font-medium' : 'text-ink-600 hover:bg-ink-50'}`}
            >
              All Assets
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFolderId(f.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-0.5 truncate ${activeFolderId === f.id ? 'bg-ink-900 text-white font-medium' : 'text-ink-600 hover:bg-ink-50'}`}
              >
                📁 {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex gap-4 min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex gap-3 mb-4">
              <input
                className="flex-1 px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
                placeholder="Search assets…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch} size="sm">Search</Button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
              <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'Uploading…' : '+ Upload'}
              </Button>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-sm font-medium text-ink-900">No assets here</p>
                <p className="text-sm text-ink-500 mt-1">Upload an image to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pb-4">
                {assets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => selectAsset(asset)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${selected?.id === asset.id ? 'border-gold-500 ring-2 ring-gold-200' : 'border-transparent hover:border-ink-300'}`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt_text ?? asset.original_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="w-72 flex-shrink-0 bg-white border border-ink-200 rounded-xl p-5 overflow-y-auto">
              <img src={selected.url} alt={selected.alt_text ?? ''} className="w-full aspect-video object-cover rounded-lg mb-4 bg-ink-100" />
              <p className="text-sm font-semibold text-ink-900 truncate mb-0.5">{selected.original_name}</p>
              <p className="text-xs text-ink-400 mb-4">{formatBytes(selected.size_bytes)} · {selected.width}×{selected.height}px</p>

              <div className="space-y-4">
                <Input
                  label="Alt Text"
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  tooltip="Descriptive text for screen readers and search engines. Describe what is in the image."
                />

                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700 mb-2">
                    Focal Point
                    <span className="w-4 h-4 rounded-full bg-ink-200 text-ink-500 text-xs flex items-center justify-center cursor-help font-semibold" title="The focal point tells automatic cropping tools where to focus. 50,50 = center. Use values 0–100 for X (left→right) and Y (top→bottom).">i</span>
                  </label>
                  <div className="flex gap-3">
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">X ({focalX}%)</label>
                      <input type="range" min={0} max={100} value={focalX} onChange={e => setFocalX(Number(e.target.value))} className="w-full accent-gold-500" />
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Y ({focalY}%)</label>
                      <input type="range" min={0} max={100} value={focalY} onChange={e => setFocalY(Number(e.target.value))} className="w-full accent-gold-500" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { navigator.clipboard.writeText(selected.url); }}
                  className="w-full text-left text-xs font-mono text-gold-700 bg-gold-50 border border-gold-200 px-3 py-2 rounded-lg hover:bg-gold-100 transition-colors truncate"
                  title="Click to copy URL"
                >
                  📋 {selected.url}
                </button>

                <Button size="sm" onClick={saveAssetMeta} className="w-full justify-center">Save Changes</Button>
                <Button size="sm" variant="danger" onClick={deleteAsset} className="w-full justify-center">Delete Asset</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
