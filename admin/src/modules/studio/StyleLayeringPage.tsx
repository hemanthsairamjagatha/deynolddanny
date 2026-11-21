import { useState, useEffect, useMemo } from 'react';
import { cms, products as productsApi } from '../../lib/api';
import { PageHeader, Button, Card, Input, Badge, Spinner, Select } from '../../components/ui';
import { ImageUrlField } from '../../components/MediaPickerModal';

interface StylePiece {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  price: string;
  originalPrice?: string;
  discount?: string;
}

interface StyleTab {
  key: string;
  label: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  backdropImage: string;
  focalX?: number;
  focalY?: number;
  pieces: StylePiece[];
}

interface StyleLayeringConfig {
  title: string;
  ctaLabel: string;
  ctaUrl: string;
  tabs: StyleTab[];
}

interface CatalogProductOption {
  id: string;
  slug: string;
  title: string;
  price_paise: number;
  compare_paise: number | null;
  default_img: string;
}

function formatInrPaise(paise: number): string {
  return `₹ ${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function moveArr<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
  return copy;
}

export default function StyleLayeringPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [sectionStatus, setSectionStatus] = useState<string>('published');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [catalog, setCatalog] = useState<CatalogProductOption[]>([]);

  const [config, setConfig] = useState<StyleLayeringConfig>({
    title: 'Style Layering',
    ctaLabel: 'Shop All Looks',
    ctaUrl: '/categories',
    tabs: [],
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pageRes, prodsRes] = await Promise.all([
        cms.pages.get('page_home'),
        productsApi.list({ status: 'active' }),
      ]);

      if (prodsRes.success && prodsRes.data?.items) {
        setCatalog(
          (prodsRes.data.items as Record<string, unknown>[]).map((p) => ({
            id: String(p.id ?? ''),
            slug: String(p.slug ?? ''),
            title: String(p.title ?? ''),
            price_paise: Number(p.price_paise ?? 0),
            compare_paise: p.compare_paise != null ? Number(p.compare_paise) : null,
            default_img: String(p.default_img ?? '/images/mastery-1-product.jpg'),
          })),
        );
      }

      if (pageRes.success && pageRes.data) {
        const data = pageRes.data as Record<string, unknown>;
        const rawSections = (data.sections ?? []) as Record<string, unknown>[];
        const sec = rawSections.find(
          (s) => String(s.sectionType ?? s.section_type) === 'style_layering',
        );
        if (sec) {
          setSectionId(String(sec.id));
          setIsVisible(Boolean(sec.isDraftVisible ?? sec.is_draft_visible ?? true));
          setSectionStatus(String(sec.status ?? 'published'));
          const props = (sec.draftProps ?? sec.draft_props ?? sec.props ?? {}) as Record<string, unknown>;
          setConfig({
            title: String(props.title ?? 'Style Layering'),
            ctaLabel: String(props.ctaLabel ?? 'Shop All Looks'),
            ctaUrl: String(props.ctaUrl ?? '/categories'),
            tabs: Array.isArray(props.tabs) ? (props.tabs as StyleTab[]) : [],
          });
        }
      }
    } catch {
      setError('Failed to load Style Layering configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentTab = config.tabs[activeTabIdx] ?? config.tabs[0] ?? null;

  const updateTab = (idx: number, patch: Partial<StyleTab>) => {
    setConfig((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  };

  const addLook = () => {
    const newTab: StyleTab = {
      key: `look_${Date.now().toString(36)}`,
      label: `NEW LOOK ${config.tabs.length + 1}`,
      subtitle: 'Curated Seasonal Silhouette',
      ctaLabel: 'Shop Look',
      ctaUrl: '/categories',
      backdropImage: '/images/mastery-1-model.jpg',
      focalX: 50,
      focalY: 22,
      pieces: catalog.slice(0, 3).map((p) => ({
        title: p.title,
        subtitle: 'DEYNOLD DANNY Atelier',
        image: p.default_img,
        href: `/products/${p.slug}`,
        price: formatInrPaise(p.price_paise),
        originalPrice: p.compare_paise && p.compare_paise > p.price_paise ? formatInrPaise(p.compare_paise) : '',
        discount:
          p.compare_paise && p.compare_paise > p.price_paise
            ? `${Math.round(((p.compare_paise - p.price_paise) / p.compare_paise) * 100)}%`
            : '',
      })),
    };
    setConfig((prev) => ({ ...prev, tabs: [...prev.tabs, newTab] }));
    setActiveTabIdx(config.tabs.length);
  };

  const duplicateLook = (idx: number) => {
    const src = config.tabs[idx];
    if (!src) return;
    const copy: StyleTab = {
      ...src,
      key: `${src.key}_copy_${Date.now().toString(36)}`,
      label: `${src.label} COPY`,
      pieces: src.pieces.map((p) => ({ ...p })),
    };
    const nextTabs = [...config.tabs];
    nextTabs.splice(idx + 1, 0, copy);
    setConfig((prev) => ({ ...prev, tabs: nextTabs }));
    setActiveTabIdx(idx + 1);
  };

  const removeLook = (idx: number) => {
    if (!confirm(`Remove look "${config.tabs[idx]?.label}"?`)) return;
    setConfig((prev) => ({ ...prev, tabs: prev.tabs.filter((_, i) => i !== idx) }));
    setActiveTabIdx((prev) => Math.max(0, Math.min(prev, config.tabs.length - 2)));
  };

  const moveLook = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= config.tabs.length) return;
    setConfig((prev) => ({ ...prev, tabs: moveArr(prev.tabs, idx, dir) }));
    setActiveTabIdx(nextIdx);
  };

  const updatePiece = (tIdx: number, pIdx: number, patch: Partial<StylePiece>) => {
    setConfig((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t, i) => {
        if (i !== tIdx) return t;
        const pieces = Array.isArray(t.pieces) ? t.pieces : [];
        return { ...t, pieces: pieces.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) };
      }),
    }));
  };

  const addPieceFromCatalog = (tIdx: number, productId?: string) => {
    const picked = productId ? catalog.find((c) => c.id === productId) : catalog[0];
    const nextPiece: StylePiece = picked
      ? {
          title: picked.title,
          subtitle: 'DEYNOLD DANNY Atelier',
          image: picked.default_img,
          href: `/products/${picked.slug}`,
          price: formatInrPaise(picked.price_paise),
          originalPrice:
            picked.compare_paise && picked.compare_paise > picked.price_paise
              ? formatInrPaise(picked.compare_paise)
              : '',
          discount:
            picked.compare_paise && picked.compare_paise > picked.price_paise
              ? `${Math.round(((picked.compare_paise - picked.price_paise) / picked.compare_paise) * 100)}%`
              : '',
        }
      : {
          title: 'Tailored Garment',
          subtitle: '100% Virgin Wool',
          image: '/images/mastery-1-product.jpg',
          href: '/products/tailored-virgin-wool-suit',
          price: '₹ 2,700.00',
          originalPrice: '',
          discount: '',
        };

    setConfig((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t, i) => (i === tIdx ? { ...t, pieces: [...(t.pieces || []), nextPiece] } : t)),
    }));
  };

  const linkPieceToCatalog = (tIdx: number, pIdx: number, productId: string) => {
    const picked = catalog.find((c) => c.id === productId);
    if (!picked) return;
    updatePiece(tIdx, pIdx, {
      title: picked.title,
      href: `/products/${picked.slug}`,
      image: picked.default_img,
      price: formatInrPaise(picked.price_paise),
      originalPrice:
        picked.compare_paise && picked.compare_paise > picked.price_paise
          ? formatInrPaise(picked.compare_paise)
          : '',
      discount:
        picked.compare_paise && picked.compare_paise > picked.price_paise
          ? `${Math.round(((picked.compare_paise - picked.price_paise) / picked.compare_paise) * 100)}%`
          : '',
    });
  };

  const removePiece = (tIdx: number, pIdx: number) => {
    setConfig((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t, i) =>
        i === tIdx ? { ...t, pieces: (t.pieces || []).filter((_, j) => j !== pIdx) } : t,
      ),
    }));
  };

  const movePiece = (tIdx: number, pIdx: number, dir: -1 | 1) => {
    setConfig((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t, i) =>
        i === tIdx ? { ...t, pieces: moveArr(t.pieces || [], pIdx, dir) } : t,
      ),
    }));
  };

  const ensureSectionAndSaveDraft = async (): Promise<boolean> => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (sectionId) {
        const res = await cms.sections.update('page_home', sectionId, {
          title: 'Style Layering Interactive Wardrobe',
          isDraftVisible: isVisible,
          props: config as unknown as Record<string, unknown>,
        });
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to save draft');
          return false;
        }
      } else {
        const res = await cms.sections.add('page_home', {
          sectionType: 'style_layering',
          title: 'Style Layering Interactive Wardrobe',
          sectionKey: 'style-layering',
          isDraftVisible: isVisible,
          props: config as unknown as Record<string, unknown>,
        });
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to create Style Layering section');
          return false;
        }
        const created = res.data as Record<string, unknown> | undefined;
        if (created?.id) setSectionId(String(created.id));
      }
      setNotice('Draft saved. Click "Publish Live" to update the homepage immediately.');
      return true;
    } finally {
      setSaving(false);
    }
  };

  const publishLive = async () => {
    const saved = await ensureSectionAndSaveDraft();
    if (!saved) return;
    setPublishing(true);
    setError('');
    try {
      const res = await cms.pages.publish('page_home');
      if (!res.success) {
        setError(res.error?.message ?? 'Publish failed');
        return;
      }
      setSectionStatus('published');
      setNotice('Published live! Homepage Style Layering section is now updated.');
    } finally {
      setPublishing(false);
    }
  };

  const previewDraft = async () => {
    const saved = await ensureSectionAndSaveDraft();
    if (!saved) return;
    const res = await cms.pages.previewToken('page_home');
    const target = res.data?.previewPath || res.data?.url;
    if (res.success && target) {
      window.open(`${target}#style-layering`, '_blank', 'noopener,noreferrer');
    }
  };

  const prevTab = useMemo(() => {
    if (config.tabs.length < 2) return null;
    return config.tabs[(activeTabIdx - 1 + config.tabs.length) % config.tabs.length];
  }, [config.tabs, activeTabIdx]);

  const nextTab = useMemo(() => {
    if (config.tabs.length < 2) return null;
    return config.tabs[(activeTabIdx + 1) % config.tabs.length];
  }, [config.tabs, activeTabIdx]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Style Layering Lookbook"
        description="Visually curate the homepage Style Layering 3-panel lookbook carousel, tabs, model backdrops, focal points, and shoppable garment cards."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/#style-layering"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs font-medium text-ink-700 bg-white border border-ink-200 rounded-lg hover:border-ink-900 transition-colors"
            >
              View Live ↗
            </a>
            <Button variant="outline" size="sm" onClick={previewDraft} disabled={saving || publishing}>
              Preview Draft
            </Button>
            <Button variant="secondary" size="sm" onClick={ensureSectionAndSaveDraft} loading={saving}>
              Save Draft
            </Button>
            <Button size="sm" onClick={publishLive} loading={publishing}>
              Publish Live
            </Button>
          </div>
        }
      />

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-700 font-semibold">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* LIVE INTERACTIVE 3-PANEL STOREFRONT PREVIEW */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-ink-900">Live Storefront Preview</h2>
            <Badge variant={isVisible ? 'success' : 'default'}>{isVisible ? 'Visible on Homepage' : 'Hidden'}</Badge>
            <Badge variant={sectionStatus === 'published' ? 'success' : 'warning'}>{sectionStatus}</Badge>
          </div>
          <span className="text-xs text-ink-500">Click any tab or side card to preview &amp; edit</span>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white overflow-hidden">
          {/* Simulated Section Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-ink-100">
            <h3 className="text-lg font-medium uppercase tracking-[0.14em] text-ink-900">
              {config.title || 'STYLE LAYERING'}
            </h3>
            <span className="text-xs font-medium text-ink-700 underline underline-offset-4">
              {config.ctaLabel || 'Shop All Looks'}
            </span>
          </div>

          {/* Simulated Brand Tabs Row */}
          <div className="flex items-center justify-center gap-5 overflow-x-auto px-4 py-3 border-b border-ink-100">
            {config.tabs.map((tab, idx) => (
              <button
                key={tab.key || idx}
                type="button"
                onClick={() => setActiveTabIdx(idx)}
                className={`text-xs uppercase tracking-[0.08em] whitespace-nowrap pb-1 transition-colors ${
                  idx === activeTabIdx
                    ? 'text-ink-900 font-bold border-b-2 border-ink-900'
                    : 'text-ink-400 hover:text-ink-700 font-medium'
                }`}
              >
                {tab.label || `LOOK ${idx + 1}`}
              </button>
            ))}
            <button
              type="button"
              onClick={addLook}
              className="text-xs font-semibold text-gold-700 hover:text-gold-900 px-2 py-0.5 rounded border border-dashed border-gold-400 whitespace-nowrap"
            >
              + Add Look
            </button>
          </div>

          {/* Simulated 3-Panel Center-Mode Carousel */}
          {currentTab ? (
            <div className="grid grid-cols-12 gap-3 p-4 bg-ink-50/50 items-stretch">
              {/* Left peek card */}
              <button
                type="button"
                onClick={() =>
                  setActiveTabIdx((activeTabIdx - 1 + config.tabs.length) % Math.max(1, config.tabs.length))
                }
                className="hidden md:block col-span-3 relative rounded-lg overflow-hidden bg-ink-900 min-h-[360px] opacity-55 hover:opacity-80 transition-opacity"
              >
                {prevTab?.backdropImage && (
                  <img
                    src={prevTab.backdropImage}
                    alt={prevTab.label}
                    style={{ objectPosition: `${prevTab.focalX ?? 50}% ${prevTab.focalY ?? 25}%` }}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-3">
                  <span className="text-xs text-white/90 font-semibold uppercase tracking-[0.14em] text-center">
                    {prevTab?.label}
                  </span>
                </div>
              </button>

              {/* Active center look card */}
              <div className="col-span-12 md:col-span-6 relative rounded-lg overflow-hidden bg-ink-900 min-h-[420px] shadow-xl">
                {currentTab.backdropImage && (
                  <img
                    src={currentTab.backdropImage}
                    alt={currentTab.label}
                    style={{ objectPosition: `${currentTab.focalX ?? 50}% ${currentTab.focalY ?? 25}%` }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/20" />
                <div className="relative z-10 h-full flex flex-col justify-between p-5 min-h-[420px]">
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded bg-black/50 text-[10px] font-mono text-white/80">
                      Focal {currentTab.focalX ?? 50}% / {currentTab.focalY ?? 25}%
                    </span>
                  </div>
                  <div className="text-center my-auto py-4">
                    <p className="text-xl sm:text-2xl font-semibold uppercase tracking-[0.16em] text-white drop-shadow">
                      {currentTab.label}
                    </p>
                    {currentTab.subtitle && (
                      <p className="text-[11px] text-white/80 uppercase tracking-[0.12em] mt-1">
                        {currentTab.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(currentTab.pieces || []).slice(0, 3).map((piece, pi) => (
                      <div key={pi} className="text-left">
                        <div className="aspect-[3/4] bg-white rounded-sm overflow-hidden mb-1.5 shadow">
                          <img src={piece.image} alt={piece.title} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] font-medium text-white truncate">{piece.title}</p>
                        {piece.originalPrice && (
                          <p className="text-[9px] text-white/50 line-through leading-tight">{piece.originalPrice}</p>
                        )}
                        <p className="text-[10px] font-semibold text-white flex items-center gap-1">
                          {piece.discount && <span className="text-rose-400">{piece.discount}</span>}
                          <span>{piece.price}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right peek card */}
              <button
                type="button"
                onClick={() => setActiveTabIdx((activeTabIdx + 1) % Math.max(1, config.tabs.length))}
                className="hidden md:block col-span-3 relative rounded-lg overflow-hidden bg-ink-900 min-h-[360px] opacity-55 hover:opacity-80 transition-opacity"
              >
                {nextTab?.backdropImage && (
                  <img
                    src={nextTab.backdropImage}
                    alt={nextTab.label}
                    style={{ objectPosition: `${nextTab.focalX ?? 50}% ${nextTab.focalY ?? 25}%` }}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-3">
                  <span className="text-xs text-white/90 font-semibold uppercase tracking-[0.14em] text-center">
                    {nextTab?.label}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-ink-500">
              No look tabs configured yet. Click &ldquo;+ Add Look&rdquo; to create your first Style Layering showcase.
            </div>
          )}
        </div>
      </Card>

      {/* SECTION HEADER SETTINGS */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-ink-900">Section Header &amp; Visibility</h2>
          <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 accent-ink-900"
            />
            Show Style Layering Section on Homepage
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Section Heading"
            value={config.title}
            onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="STYLE LAYERING"
          />
          <Input
            label="Top-Right CTA Label"
            value={config.ctaLabel}
            onChange={(e) => setConfig((prev) => ({ ...prev, ctaLabel: e.target.value }))}
            placeholder="Shop All Looks"
          />
          <Input
            label="Top-Right CTA URL"
            value={config.ctaUrl}
            onChange={(e) => setConfig((prev) => ({ ...prev, ctaUrl: e.target.value }))}
            placeholder="/categories"
          />
        </div>
      </Card>

      {/* LOOK TABS RAIL + ACTIVE LOOK EDITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Look Tabs Order & Management */}
        <Card className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Look Tabs ({config.tabs.length})</h2>
            <Button size="sm" variant="outline" onClick={addLook}>
              + Add Look
            </Button>
          </div>
          <div className="space-y-2">
            {config.tabs.map((tab, idx) => (
              <div
                key={tab.key || idx}
                onClick={() => setActiveTabIdx(idx)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                  idx === activeTabIdx
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-200 bg-white hover:border-ink-400 text-ink-900'
                }`}
              >
                <img
                  src={tab.backdropImage || '/images/mastery-1-model.jpg'}
                  alt=""
                  className="w-10 h-12 rounded-lg object-cover flex-shrink-0 border border-white/20"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{tab.label || `Look ${idx + 1}`}</p>
                  <p className={`text-[11px] ${idx === activeTabIdx ? 'text-ink-300' : 'text-ink-500'}`}>
                    {(tab.pieces || []).length} shoppable piece(s)
                  </p>
                </div>
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveLook(idx, -1)}
                    className="p-1 text-xs rounded hover:bg-white/10 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx === config.tabs.length - 1}
                    onClick={() => moveLook(idx, 1)}
                    className="p-1 text-xs rounded hover:bg-white/10 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: Active Look Editor */}
        <Card className="lg:col-span-8 space-y-5">
          {currentTab ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-ink-100">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400">
                    Editing Look #{activeTabIdx + 1}
                  </span>
                  <h2 className="text-base font-semibold text-ink-900">{currentTab.label}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => duplicateLook(activeTabIdx)}>
                    Duplicate Look
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => removeLook(activeTabIdx)}
                  >
                    Remove Look
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Tab & Slide Overlay Title"
                  value={currentTab.label ?? ''}
                  onChange={(e) => updateTab(activeTabIdx, { label: e.target.value })}
                  placeholder="ATELIER DEYNOLD"
                />
                <Input
                  label="Look Subtitle (Optional)"
                  value={currentTab.subtitle ?? ''}
                  onChange={(e) => updateTab(activeTabIdx, { subtitle: e.target.value })}
                  placeholder="Full-Canvas Virgin Wool Tailoring"
                />
                <div className="sm:col-span-2">
                  <ImageUrlField
                    label="Backdrop Model Image"
                    value={currentTab.backdropImage ?? ''}
                    onChange={(url) => updateTab(activeTabIdx, { backdropImage: url })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">
                    Image Horizontal Focal Point ({currentTab.focalX ?? 50}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={currentTab.focalX ?? 50}
                    onChange={(e) => updateTab(activeTabIdx, { focalX: Number(e.target.value) })}
                    className="w-full accent-ink-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">
                    Image Vertical Focal Point ({currentTab.focalY ?? 25}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={currentTab.focalY ?? 25}
                    onChange={(e) => updateTab(activeTabIdx, { focalY: Number(e.target.value) })}
                    className="w-full accent-ink-900"
                  />
                </div>
              </div>

              {/* Shoppable Garment Cards inside this Look */}
              <div className="pt-4 border-t border-ink-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">
                      Shoppable Product Cards ({(currentTab.pieces || []).length} / 3 shown on slide)
                    </h3>
                    <p className="text-xs text-ink-500">
                      Pick directly from your live catalogue to sync image, URL &amp; price, or customize manually.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => addPieceFromCatalog(activeTabIdx)}>
                    + Add Garment Card
                  </Button>
                </div>

                {(currentTab.pieces || []).map((piece, pIdx) => (
                  <div key={pIdx} className="p-4 rounded-xl border border-ink-200 bg-ink-50/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-800">Card #{pIdx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pIdx === 0}
                          onClick={() => movePiece(activeTabIdx, pIdx, -1)}
                        >
                          ←
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pIdx === (currentTab.pieces || []).length - 1}
                          onClick={() => movePiece(activeTabIdx, pIdx, 1)}
                        >
                          →
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => removePiece(activeTabIdx, pIdx)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* 1-Click Catalog Auto-Fill */}
                    {catalog.length > 0 && (
                      <Select
                        label="Quick-Fill from Storefront Catalogue"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) linkPieceToCatalog(activeTabIdx, pIdx, e.target.value);
                        }}
                        options={[
                          { value: '', label: '— Choose a product to auto-fill title, image, URL & price —' },
                          ...catalog.map((c) => ({
                            value: c.id,
                            label: `${c.title} (${formatInrPaise(c.price_paise)})`,
                          })),
                        ]}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Garment Title"
                        value={piece.title ?? ''}
                        onChange={(e) => updatePiece(activeTabIdx, pIdx, { title: e.target.value })}
                      />
                      <Input
                        label="Product Link URL"
                        value={piece.href ?? ''}
                        onChange={(e) => updatePiece(activeTabIdx, pIdx, { href: e.target.value })}
                        placeholder="/products/tailored-virgin-wool-suit"
                      />
                      <Input
                        label="Display Price"
                        value={piece.price ?? ''}
                        onChange={(e) => updatePiece(activeTabIdx, pIdx, { price: e.target.value })}
                        placeholder="₹ 2,700.00"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Original Price (Optional)"
                          value={piece.originalPrice ?? ''}
                          onChange={(e) => updatePiece(activeTabIdx, pIdx, { originalPrice: e.target.value })}
                          placeholder="₹ 3,200.00"
                        />
                        <Input
                          label="Discount Badge"
                          value={piece.discount ?? ''}
                          onChange={(e) => updatePiece(activeTabIdx, pIdx, { discount: e.target.value })}
                          placeholder="15%"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <ImageUrlField
                          label="Card Thumbnail Image"
                          value={piece.image ?? ''}
                          onChange={(url) => updatePiece(activeTabIdx, pIdx, { image: url })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-ink-500">
              Select or add a look from the left rail to start editing.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
