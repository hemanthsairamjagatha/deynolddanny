import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cms, products as productsApi } from '../../lib/api';
import type { SectionType } from '../../lib/types';
import { Button, Badge, statusVariant, Modal, Input, Textarea, Select, Spinner } from '../../components/ui';
import { ImageUrlField } from '../../components/MediaPickerModal';

interface NormalizedPage {
  id: string;
  slug: string;
  routePath: string;
  title: string;
  pageType: string;
  status: string;
  draftSeo: Record<string, unknown>;
}

interface NormalizedSection {
  id: string;
  pageId: string;
  sectionKey: string;
  sectionType: SectionType;
  title: string;
  sortOrder: number;
  isDraftVisible: boolean;
  draftProps: Record<string, unknown>;
}

interface LegalClause {
  heading: string;
  body: string;
}

interface CategoryCardItem {
  title: string;
  subtitle: string;
  href: string;
  desktopImage: string;
  mobileImage?: string;
  focalX?: number;
  focalY?: number;
}

interface EditorialDuoItem {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  desktopImage: string;
  mobileImage?: string;
  focalX?: number;
  focalY?: number;
}

interface StyleLayeringPiece {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  price: string;
  originalPrice?: string;
  discount?: string;
}

interface StyleLayeringTab {
  key: string;
  label: string;
  backdropImage: string;
  focalX?: number;
  focalY?: number;
  pieces: StyleLayeringPiece[];
}

interface CarouselCategoryTab {
  label: string;
  value: string;
}

interface CarouselProductItem {
  id: string;
  slug: string;
  title: string;
  section_group: string;
  price_paise: number;
  min_price_paise: number;
  max_price_paise: number;
  default_img: string;
  colors: Array<{ name: string; hex: string }>;
}

const DEFAULT_CAROUSEL_CATEGORIES: CarouselCategoryTab[] = [
  { label: 'ALL', value: 'all' },
  { label: 'TAILORING', value: 'tailoring' },
  { label: 'SHIRTS', value: 'shirts' },
  { label: 'TROUSERS', value: 'trousers' },
  { label: 'KNITWEAR', value: 'knitwear' },
  { label: 'OUTERWEAR', value: 'outerwear' },
  { label: 'FOOTWEAR', value: 'footwear' },
  { label: 'ACCESSORIES', value: 'accessories' },
];

const SECTION_TYPES: Array<{ value: SectionType; label: string; description: string }> = [
  { value: 'hero_banner', label: 'Hero Banner', description: 'Full-width editorial hero with desktop/mobile imagery, overlay tint, focal point, headline & CTA buttons' },
  { value: 'product_carousel', label: 'Product Carousel', description: 'Horizontal scrolling product showcase with category tabs and View All link' },
  { value: 'category_grid', label: 'Category Grid', description: 'Visual 3-column luxury category navigation grid with custom imagery' },
  { value: 'editorial_duo', label: 'Editorial Duo', description: 'Two-column full-bleed editorial showcase panels (e.g. Footwear & Accessories)' },
  { value: 'style_layering', label: 'Style Layering Lookbook', description: 'Interactive layered outfit showcase with shoppable pieces' },
  { value: 'newsletter_cta', label: 'Newsletter CTA Banner', description: 'Editorial email subscription invitation strip' },
  { value: 'announcement', label: 'Promotional Announcement Strip', description: 'Full-width promotional callout banner inside the page' },
  { value: 'legal_document', label: 'Editorial / Legal Document', description: 'Structured multi-clause policy or brand story (Privacy, Refunds, Terms, About Us)' },
  { value: 'contact_page', label: 'Contact & Concierge Header', description: 'Concierge page header, intro copy, and inquiry subjects' },
  { value: 'pdp_template', label: 'PDP Global Defaults', description: 'Product Detail Page badges, exclusive banners, and section headings' },
];

function moveArr<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const t = idx + dir;
  if (t < 0 || t >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[t]] = [copy[t], copy[idx]];
  return copy;
}

// ─── 1. VISUAL LEGAL / EDITORIAL CLAUSES EDITOR ───────────────────────────────
function LegalDocumentEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }) {
  const clauses = Array.isArray(config.sections) ? (config.sections as LegalClause[]) : [];

  const updateClause = (idx: number, patch: Partial<LegalClause>) =>
    onChange({ ...config, sections: clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });

  return (
    <div className="col-span-2 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Eyebrow Label" value={String(config.eyebrow ?? '')} onChange={(e) => onChange({ ...config, eyebrow: e.target.value })} />
        <Input label="Effective Date / Subtitle" value={String(config.effectiveDate ?? '')} onChange={(e) => onChange({ ...config, effectiveDate: e.target.value })} />
      </div>
      <Input label="Document Main Heading" value={String(config.heading ?? '')} onChange={(e) => onChange({ ...config, heading: e.target.value })} />

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Document Clauses ({clauses.length})</h3>
            <p className="text-xs text-ink-500">Edit each numbered clause directly. Click Publish Live when ready.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onChange({ ...config, sections: [...clauses, { heading: `${clauses.length + 1}. New Clause`, body: '' }] })}>
            + Add Clause
          </Button>
        </div>

        {clauses.map((clause, idx) => (
          <div key={idx} className="p-4 border border-ink-200 rounded-xl bg-ink-50/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-400">Clause {idx + 1}</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => onChange({ ...config, sections: moveArr(clauses, idx, -1) })}>↑</Button>
                <Button size="sm" variant="ghost" disabled={idx === clauses.length - 1} onClick={() => onChange({ ...config, sections: moveArr(clauses, idx, 1) })}>↓</Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => onChange({ ...config, sections: clauses.filter((_, i) => i !== idx) })}>Remove</Button>
              </div>
            </div>
            <Input label="Clause Heading" value={clause.heading ?? ''} onChange={(e) => updateClause(idx, { heading: e.target.value })} />
            <Textarea label="Clause Text" rows={4} value={clause.body ?? ''} onChange={(e) => updateClause(idx, { body: e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. VISUAL HERO BANNER EDITOR (3D RUNWAY LOOKS + NATIVE VIDEO + PREVIEW) ─
interface RunwayLookDraft {
  code?: string;
  title?: string;
  subtitle?: string;
  image?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  focalX?: number;
  focalY?: number;
}

function HeroBannerEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...config, [k]: v });
  const fx = Number(config.focalX ?? 64);
  const fy = Number(config.focalY ?? 26);
  const overlayOpacity = Number(config.overlayOpacity ?? 18);
  const overlayColor = String(config.overlayColor ?? '#000000');
  const videoUrl = String(config.videoUrl ?? '');
  const looks: RunwayLookDraft[] = Array.isArray(config.runwayLooks) ? (config.runwayLooks as RunwayLookDraft[]) : [];
  const previewImg = String(looks[0]?.image || config.desktopImage || '/hero-banner.jpg');

  const updateLooks = (next: RunwayLookDraft[]) => set('runwayLooks', next);

  return (
    <div className="col-span-2 space-y-5">
      {/* Live Hero Visual Preview */}
      <div className="relative w-full aspect-[16/9] max-h-72 rounded-xl overflow-hidden border border-ink-200 bg-ink-900">
        {videoUrl ? (
          <video src={videoUrl} poster={previewImg} muted loop autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          previewImg && (
            <img
              src={previewImg}
              alt="Hero preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: `${fx}% ${fy}%` }}
            />
          )
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: overlayColor, opacity: Math.max(0, Math.min(85, overlayOpacity)) / 100 }}
        />
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <p className="text-[10px] uppercase tracking-[0.28em] opacity-90">{String(config.eyebrow ?? '')}</p>
          <p className="text-xl sm:text-2xl font-light tracking-wider mt-0.5">{String(config.headline ?? '')}</p>
          <p className="text-[11px] uppercase tracking-[0.16em] opacity-85 mt-1">{String(config.description ?? config.tagline ?? '')}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {Boolean(config.ctaLabel) && (
              <span className="px-3 py-1.5 bg-white text-black text-[10px] uppercase tracking-[0.16em] font-medium">
                {String(config.ctaLabel)}
              </span>
            )}
            {Boolean(config.secondaryCtaLabel) && (
              <span className="px-3 py-1.5 border border-white/80 text-white text-[10px] uppercase tracking-[0.16em] font-medium">
                {String(config.secondaryCtaLabel)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Eyebrow Text" value={String(config.eyebrow ?? '')} onChange={(e) => set('eyebrow', e.target.value)} placeholder="AUTUMN / WINTER 2026 · MENSWEAR RUNWAY" />
        <Input label="Main Hero Headline" value={String(config.headline ?? '')} onChange={(e) => set('headline', e.target.value)} placeholder="DEYNOLD DANNY" />
        <div className="sm:col-span-2">
          <Input
            label="Subheadline / Tagline"
            value={String(config.description ?? config.tagline ?? '')}
            onChange={(e) => onChange({ ...config, description: e.target.value, tagline: e.target.value })}
            placeholder="Architectural Bespoke Tailoring & Cashmere"
          />
        </div>

        <div className="sm:col-span-2 p-4 rounded-xl border border-gold-300 bg-gold-50/40 space-y-2">
          <ImageUrlField
            label="Optional Looping Runway Video (.mp4 / .webm)"
            value={videoUrl}
            onChange={(url) => set('videoUrl', url)}
            allowVideo
            placeholder="Upload .mp4 / .webm or paste URL (leave blank for 3D Multi-Look Runway)"
          />
          <p className="text-[11px] text-ink-500">
            When a video is uploaded or linked, the homepage plays a silent looping runway film automatically (with your Desktop Image as instant poster). Remove or leave blank to display the interactive 3D-Depth Runway Looks below.
          </p>
        </div>

        <div className="sm:col-span-2">
          <ImageUrlField
            label="Primary Hero / Video Poster Image (16:9 recommended)"
            value={String(config.desktopImage ?? '')}
            onChange={(url) => set('desktopImage', url)}
            onPickMeta={(a) => onChange({ ...config, desktopImage: a.url, focalX: a.defaultFocalX, focalY: a.defaultFocalY })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-700">Focal Point X ({fx}%)</label>
          <input type="range" min={0} max={100} value={fx} onChange={(e) => set('focalX', Number(e.target.value))} className="w-full accent-gold-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-700">Focal Point Y ({fy}%)</label>
          <input type="range" min={0} max={100} value={fy} onChange={(e) => set('focalY', Number(e.target.value))} className="w-full accent-gold-500" />
        </div>

        <div className="flex items-center gap-3">
          <input type="color" value={overlayColor} onChange={(e) => set('overlayColor', e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
          <div className="flex-1">
            <label className="text-xs font-medium text-ink-700 block">Overlay Tint Opacity ({overlayOpacity}%)</label>
            <input type="range" min={0} max={75} value={overlayOpacity} onChange={(e) => set('overlayOpacity', Number(e.target.value))} className="w-full accent-gold-500" />
          </div>
        </div>

        <div />

        <Input label="Default Primary CTA Label" value={String(config.ctaLabel ?? '')} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Shop This Look" />
        <Input label="Default Primary CTA URL" value={String(config.ctaUrl ?? '')} onChange={(e) => set('ctaUrl', e.target.value)} placeholder="/categories/overcoats" />
        <Input label="Secondary CTA Label" value={String(config.secondaryCtaLabel ?? '')} onChange={(e) => set('secondaryCtaLabel', e.target.value)} placeholder="Explore Collection" />
        <Input label="Secondary CTA URL" value={String(config.secondaryCtaUrl ?? '')} onChange={(e) => set('secondaryCtaUrl', e.target.value)} placeholder="/categories" />
      </div>

      {/* 3D Runway Looks Sequence Editor */}
      <div className="pt-4 border-t border-ink-200 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">3D Runway Looks Sequence ({looks.length})</h3>
            <p className="text-xs text-ink-500">Models advance one-by-one in 3D depth with per-look &quot;Shop This Look&quot; links.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateLooks([
                ...looks,
                {
                  code: `LOOK 0${looks.length + 1}`,
                  title: 'New Menswear Runway Look',
                  subtitle: 'Italian Virgin Wool · Artisanal Tailoring',
                  image: '/images/hero-runway-1.jpg',
                  ctaLabel: 'Shop This Look',
                  ctaUrl: '/categories/tailoring',
                  focalX: 64,
                  focalY: 26,
                },
              ])
            }
          >
            + Add Runway Look
          </Button>
        </div>

        {looks.map((look, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-ink-200 bg-ink-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-ink-600">{look.code || `LOOK 0${idx + 1}`}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => updateLooks(moveArr(looks, idx, -1))}>↑</Button>
                <Button size="sm" variant="ghost" disabled={idx === looks.length - 1} onClick={() => updateLooks(moveArr(looks, idx, 1))}>↓</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => updateLooks(looks.filter((_, i) => i !== idx))}>Remove</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Look Code" value={look.code ?? ''} onChange={(e) => updateLooks(looks.map((l, i) => (i === idx ? { ...l, code: e.target.value } : l)))} placeholder="LOOK 01" />
              <Input label="Look Title" value={look.title ?? ''} onChange={(e) => updateLooks(looks.map((l, i) => (i === idx ? { ...l, title: e.target.value } : l)))} />
              <div className="sm:col-span-2">
                <Input label="Fabric / Garment Subtitle" value={look.subtitle ?? ''} onChange={(e) => updateLooks(looks.map((l, i) => (i === idx ? { ...l, subtitle: e.target.value } : l)))} />
              </div>
              <Input label="Shop CTA Label" value={look.ctaLabel ?? ''} onChange={(e) => updateLooks(looks.map((l, i) => (i === idx ? { ...l, ctaLabel: e.target.value } : l)))} placeholder="Shop This Look" />
              <Input label="Shop Destination URL" value={look.ctaUrl ?? ''} onChange={(e) => updateLooks(looks.map((l, i) => (i === idx ? { ...l, ctaUrl: e.target.value } : l)))} placeholder="/categories/overcoats" />
              <div className="sm:col-span-2">
                <ImageUrlField
                  label="Runway Look Image"
                  value={look.image ?? ''}
                  onChange={(url) => updateLooks(looks.map((l, i) => (i === idx ? { ...l, image: url } : l)))}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 3. VISUAL CATEGORY GRID EDITOR ──────────────────────────────────────────
function CategoryGridEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }) {
  const items: CategoryCardItem[] = Array.isArray(config.items) ? (config.items as CategoryCardItem[]) : [];
  const updateItems = (next: CategoryCardItem[]) => onChange({ ...config, items: next });

  return (
    <div className="col-span-2 space-y-5">
      <Input label="Section Heading (Optional)" value={String(config.heading ?? '')} onChange={(e) => onChange({ ...config, heading: e.target.value })} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Category Cards ({items.length})</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            updateItems([
              ...items,
              { title: 'New Category', subtitle: 'DEYNOLD DANNY Collection', href: '/categories', desktopImage: '/images/category-abiti.jpg', focalX: 50, focalY: 35 },
            ])
          }
        >
          + Add Category Card
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((card, idx) => (
          <div key={idx} className="p-4 border border-ink-200 rounded-xl bg-ink-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-ink-400">Card #{idx + 1}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => updateItems(moveArr(items, idx, -1))}>↑</Button>
                <Button size="sm" variant="ghost" disabled={idx === items.length - 1} onClick={() => updateItems(moveArr(items, idx, 1))}>↓</Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => updateItems(items.filter((_, i) => i !== idx))}>Remove</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Card Title" value={card.title ?? ''} onChange={(e) => updateItems(items.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c)))} />
              <Input label="Destination URL" value={card.href ?? ''} onChange={(e) => updateItems(items.map((c, i) => (i === idx ? { ...c, href: e.target.value } : c)))} />
              <div className="sm:col-span-2">
                <Input label="Alt / Subtitle" value={card.subtitle ?? ''} onChange={(e) => updateItems(items.map((c, i) => (i === idx ? { ...c, subtitle: e.target.value } : c)))} />
              </div>
              <div className="sm:col-span-2">
                <ImageUrlField
                  label="Card Image"
                  value={card.desktopImage ?? ''}
                  onChange={(url) => updateItems(items.map((c, i) => (i === idx ? { ...c, desktopImage: url, mobileImage: url } : c)))}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 4. VISUAL EDITORIAL DUO EDITOR ──────────────────────────────────────────
function EditorialDuoEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }) {
  const items: EditorialDuoItem[] = Array.isArray(config.items) ? (config.items as EditorialDuoItem[]) : [];
  const updateItems = (next: EditorialDuoItem[]) => onChange({ ...config, items: next });

  return (
    <div className="col-span-2 space-y-5">
      <Input label="Section Heading (Optional)" value={String(config.heading ?? '')} onChange={(e) => onChange({ ...config, heading: e.target.value })} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Editorial Panels ({items.length})</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            updateItems([
              ...items,
              { eyebrow: 'ATELIER CRAFT', title: 'New Editorial Feature', description: '', ctaLabel: 'Explore Now', href: '/categories', desktopImage: '/images/category-scarpe.jpg' },
            ])
          }
        >
          + Add Panel
        </Button>
      </div>
      <div className="space-y-4">
        {items.map((panel, idx) => (
          <div key={idx} className="p-4 border border-ink-200 rounded-xl bg-ink-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-ink-400">Panel #{idx + 1}</span>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => updateItems(items.filter((_, i) => i !== idx))}>
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Eyebrow" value={panel.eyebrow ?? ''} onChange={(e) => updateItems(items.map((p, i) => (i === idx ? { ...p, eyebrow: e.target.value } : p)))} />
              <Input label="Headline" value={panel.title ?? ''} onChange={(e) => updateItems(items.map((p, i) => (i === idx ? { ...p, title: e.target.value } : p)))} />
              <div className="sm:col-span-2">
                <Textarea label="Description" rows={2} value={panel.description ?? ''} onChange={(e) => updateItems(items.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p)))} />
              </div>
              <Input label="CTA Label" value={panel.ctaLabel ?? ''} onChange={(e) => updateItems(items.map((p, i) => (i === idx ? { ...p, ctaLabel: e.target.value } : p)))} />
              <Input label="Destination URL" value={panel.href ?? ''} onChange={(e) => updateItems(items.map((p, i) => (i === idx ? { ...p, href: e.target.value } : p)))} />
              <div className="sm:col-span-2">
                <ImageUrlField
                  label="Panel Image"
                  value={panel.desktopImage ?? ''}
                  onChange={(url) => updateItems(items.map((p, i) => (i === idx ? { ...p, desktopImage: url, mobileImage: url } : p)))}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5. VISUAL STYLE LAYERING EDITOR ─────────────────────────────────────────
function StyleLayeringEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }) {
  const navigate = useNavigate();
  const tabs: StyleLayeringTab[] = Array.isArray(config.tabs) ? (config.tabs as StyleLayeringTab[]) : [];
  const updateTabs = (next: StyleLayeringTab[]) => onChange({ ...config, tabs: next });

  const updatePiece = (tIdx: number, pIdx: number, patch: Partial<StyleLayeringPiece>) => {
    updateTabs(
      tabs.map((t, i) => {
        if (i !== tIdx) return t;
        const pieces = Array.isArray(t.pieces) ? t.pieces : [];
        return {
          ...t,
          pieces: pieces.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)),
        };
      }),
    );
  };

  const addPiece = (tIdx: number) => {
    updateTabs(
      tabs.map((t, i) => {
        if (i !== tIdx) return t;
        const pieces = Array.isArray(t.pieces) ? t.pieces : [];
        return {
          ...t,
          pieces: [
            ...pieces,
            {
              title: 'Tailored Garment',
              subtitle: '100% Virgin Wool',
              image: '/images/mastery-1-product.jpg',
              href: '/products/tailored-virgin-wool-suit',
              price: '₹ 2,700.00',
              originalPrice: '₹ 3,200.00',
              discount: '15%',
            },
          ],
        };
      }),
    );
  };

  const removePiece = (tIdx: number, pIdx: number) => {
    updateTabs(
      tabs.map((t, i) => {
        if (i !== tIdx) return t;
        const pieces = Array.isArray(t.pieces) ? t.pieces : [];
        return { ...t, pieces: pieces.filter((_, j) => j !== pIdx) };
      }),
    );
  };

  return (
    <div className="col-span-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-gold-50/70 border border-gold-200">
        <p className="text-xs text-ink-800">
          Want a full-screen 3-panel live preview &amp; 1-click catalogue product picker for Style Layering?
        </p>
        <Button size="sm" variant="primary" onClick={() => navigate('/style-layering')}>
          Open Style Layering Studio →
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Section Title" value={String(config.title ?? '')} onChange={(e) => onChange({ ...config, title: e.target.value })} />
        <Input label="CTA Label" value={String(config.ctaLabel ?? '')} onChange={(e) => onChange({ ...config, ctaLabel: e.target.value })} />
        <Input label="CTA URL" value={String(config.ctaUrl ?? '')} onChange={(e) => onChange({ ...config, ctaUrl: e.target.value })} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Lookbook Tabs ({tabs.length})</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            updateTabs([...tabs, { key: `look_${Date.now().toString(36)}`, label: 'NEW LOOK', backdropImage: '/images/style-1-model.jpg', pieces: [] }])
          }
        >
          + Add Look Tab
        </Button>
      </div>

      {tabs.map((tab, tIdx) => {
        const pieces = Array.isArray(tab.pieces) ? tab.pieces : [];
        return (
          <div key={tab.key || tIdx} className="p-4 border border-ink-200 rounded-xl bg-ink-50/40 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">Look #{tIdx + 1}: {tab.label}</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={tIdx === 0} onClick={() => updateTabs(moveArr(tabs, tIdx, -1))}>↑</Button>
                <Button size="sm" variant="ghost" disabled={tIdx === tabs.length - 1} onClick={() => updateTabs(moveArr(tabs, tIdx, 1))}>↓</Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => updateTabs(tabs.filter((_, i) => i !== tIdx))}>
                  Remove Look
                </Button>
              </div>
            </div>
            <Input
              label="Tab Label"
              value={tab.label ?? ''}
              onChange={(e) => updateTabs(tabs.map((t, i) => (i === tIdx ? { ...t, label: e.target.value } : t)))}
            />
            <ImageUrlField
              label="Backdrop Model Image"
              value={tab.backdropImage ?? ''}
              onChange={(url) => updateTabs(tabs.map((t, i) => (i === tIdx ? { ...t, backdropImage: url } : t)))}
            />

            {/* Shoppable Pieces Inside Look Tab */}
            <div className="pt-3 border-t border-ink-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-800">Shoppable Product Cards in This Look ({pieces.length})</span>
                <Button size="sm" variant="outline" onClick={() => addPiece(tIdx)}>
                  + Add Piece
                </Button>
              </div>
              {pieces.map((piece, pIdx) => (
                <div key={pIdx} className="p-3 bg-white rounded-lg border border-ink-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-ink-500">Piece #{pIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removePiece(tIdx, pIdx)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Input label="Garment Title" value={piece.title ?? ''} onChange={(e) => updatePiece(tIdx, pIdx, { title: e.target.value })} />
                    <Input label="Product Link URL" value={piece.href ?? ''} onChange={(e) => updatePiece(tIdx, pIdx, { href: e.target.value })} placeholder="/products/cady-trousers" />
                    <Input label="Display Price" value={piece.price ?? ''} onChange={(e) => updatePiece(tIdx, pIdx, { price: e.target.value })} placeholder="₹ 2,700.00" />
                    <Input label="Subtitle / Fabric" value={piece.subtitle ?? ''} onChange={(e) => updatePiece(tIdx, pIdx, { subtitle: e.target.value })} />
                    <div className="sm:col-span-2">
                      <ImageUrlField
                        label="Piece Thumbnail Image"
                        value={piece.image ?? ''}
                        onChange={(url) => updatePiece(tIdx, pIdx, { image: url })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 6. VISUAL PRODUCT CAROUSEL EDITOR (OUR BEST SELLERS & NEW ARRIVAL) ──────
function ProductCarouselEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (n: Record<string, unknown>) => void;
}) {
  const navigate = useNavigate();
  const set = (k: string, v: unknown) => onChange({ ...config, [k]: v });

  const rawCategories: CarouselCategoryTab[] = useMemo(() => {
    if (Array.isArray(config.categories) && config.categories.length > 0) {
      return config.categories as CarouselCategoryTab[];
    }
    if (Array.isArray(config.tabs) && config.tabs.length > 0) {
      const converted = (config.tabs as Array<{ label?: string; value?: string; href?: string }>)
        .filter((t) => t && t.label)
        .map((t) => ({
          label: String(t.label).toUpperCase(),
          value: String(t.value || (t.href || '').replace(/^\/categories\//, '') || t.label).toLowerCase(),
        }));
      return converted.some((c) => c.value === 'all') ? converted : [{ label: 'ALL', value: 'all' }, ...converted];
    }
    return DEFAULT_CAROUSEL_CATEGORIES;
  }, [config.categories, config.tabs]);

  const updateCategories = (next: CarouselCategoryTab[]) => onChange({ ...config, categories: next });

  const sectionGroup =
    String(config.sectionGroup || config.sectionId || 'mastery') === 'new-collection' ||
    String(config.sectionGroup || config.sectionId || '') === 'new-arrival'
      ? 'style_space'
      : String(config.sectionGroup || 'mastery');

  const selectedProductIds: string[] = Array.isArray(config.productIds) ? (config.productIds as string[]) : [];

  const [catalogProducts, setCatalogProducts] = useState<CarouselProductItem[]>([]);
  const [availableColors, setAvailableColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [colorFilter, setColorFilter] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('section');
  const [loadingProds, setLoadingProds] = useState<boolean>(true);

  const loadCatalog = () => {
    setLoadingProds(true);
    productsApi
      .list({ status: 'active' })
      .then((res) => {
        if (res.success && res.data) {
          const items = (res.data.items ?? []) as Record<string, unknown>[];
          if (Array.isArray(res.data.availableColors)) {
            setAvailableColors(res.data.availableColors);
          }
          setCatalogProducts(
            items.map((p) => {
              const base = Number(p.price_paise ?? 0);
              return {
                id: String(p.id ?? ''),
                slug: String(p.slug ?? ''),
                title: String(p.title ?? ''),
                section_group: String(p.section_group ?? 'mastery'),
                price_paise: base,
                min_price_paise: Number(p.min_price_paise ?? base),
                max_price_paise: Number(p.max_price_paise ?? base),
                default_img: String(p.default_img ?? ''),
                colors: Array.isArray(p.colors) ? (p.colors as Array<{ name: string; hex: string }>) : [],
              };
            }),
          );
        }
      })
      .finally(() => setLoadingProds(false));
  };

  useEffect(loadCatalog, []);

  const toggleProductInSection = async (prod: CarouselProductItem) => {
    const isCurrentlyInSection = prod.section_group === sectionGroup;
    const nextGroup = isCurrentlyInSection ? (sectionGroup === 'mastery' ? 'style_space' : 'mastery') : sectionGroup;
    await productsApi.update(prod.id, { section_group: nextGroup });
    loadCatalog();
  };

  const toggleCustomPin = (prodId: string) => {
    const exists = selectedProductIds.includes(prodId);
    const next = exists ? selectedProductIds.filter((x) => x !== prodId) : [...selectedProductIds, prodId];
    set('productIds', next);
  };

  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((p) => {
      if (groupFilter === 'section' && p.section_group !== sectionGroup && !selectedProductIds.includes(p.id)) {
        return false;
      }
      if (colorFilter && !p.colors.some((c) => c.name.toLowerCase() === colorFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [catalogProducts, groupFilter, sectionGroup, colorFilter, selectedProductIds]);

  const fmtInr = (paise: number) => '₹ ' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="col-span-2 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Section Title"
          value={String(config.title ?? 'Our Best Sellers')}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Our Best Sellers"
        />
        <Input
          label="Eyebrow Label"
          value={String(config.eyebrow ?? '')}
          onChange={(e) => set('eyebrow', e.target.value)}
          placeholder="SIGNATURE SELECTION"
        />
        <Input
          label="View All Link Label"
          value={String(config.ctaLabel ?? '')}
          onChange={(e) => set('ctaLabel', e.target.value)}
          placeholder="Shop Our Best Sellers"
        />
        <Input
          label="View All Destination URL"
          value={String(config.ctaUrl ?? '/categories')}
          onChange={(e) => set('ctaUrl', e.target.value)}
          placeholder="/categories"
        />
        <Select
          label="Primary Product Group"
          value={sectionGroup}
          onChange={(e) => onChange({ ...config, sectionGroup: e.target.value, sectionId: e.target.value === 'mastery' ? 'mastery' : 'new-collection' })}
          options={[
            { value: 'mastery', label: 'Our Best Sellers (mastery)' },
            { value: 'style_space', label: 'New Arrivals (style_space)' },
            { value: 'news', label: 'Editorial / News (news)' },
          ]}
        />
        <Input
          label="Maximum Products Shown"
          type="number"
          value={String(config.limit ?? 12)}
          onChange={(e) => set('limit', Math.max(1, Number(e.target.value) || 12))}
        />
      </div>

      {/* Display Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-ink-200 bg-ink-50/40 cursor-pointer">
          <div>
            <span className="text-xs font-semibold text-ink-900 block">Show &quot;MODEL VIEW&quot; Toggle</span>
            <span className="text-[11px] text-ink-500">Lets patrons switch between model &amp; product shot</span>
          </div>
          <input
            type="checkbox"
            checked={config.showModelView !== false}
            onChange={(e) => set('showModelView', e.target.checked)}
            className="h-4 w-4 accent-ink-900"
          />
        </label>
        <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-ink-200 bg-ink-50/40 cursor-pointer">
          <div>
            <span className="text-xs font-semibold text-ink-900 block">Default to Model View</span>
            <span className="text-[11px] text-ink-500">Start cards on model photography</span>
          </div>
          <input
            type="checkbox"
            checked={config.defaultModelView !== false}
            onChange={(e) => set('defaultModelView', e.target.checked)}
            className="h-4 w-4 accent-ink-900"
          />
        </label>
        <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-ink-200 bg-ink-50/40 cursor-pointer">
          <div>
            <span className="text-xs font-semibold text-ink-900 block">Show Colour Filter Bar</span>
            <span className="text-[11px] text-ink-500">Lets patrons filter carousel by colour swatch</span>
          </div>
          <input
            type="checkbox"
            checked={config.showColorFilter !== false}
            onChange={(e) => set('showColorFilter', e.target.checked)}
            className="h-4 w-4 accent-ink-900"
          />
        </label>
      </div>

      {/* Category Filter Tabs Editor */}
      <div className="p-4 rounded-xl border border-ink-200 bg-ink-50/30 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-800">
              Category Filter Tabs ({rawCategories.length})
            </h4>
            <p className="text-[11px] text-ink-500">
              Edit the subhead filter tabs (e.g. ALL, TAILORING, SHIRTS, TROUSERS, KNITWEAR, OUTERWEAR, FOOTWEAR, ACCESSORIES).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateCategories([...rawCategories, { label: 'NEW TAB', value: 'tailoring' }])}
          >
            + Add Category Tab
          </Button>
        </div>
        <div className="space-y-2">
          {rawCategories.map((cat, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center bg-white p-2 rounded-lg border border-ink-200">
              <input
                value={cat.label}
                onChange={(e) =>
                  updateCategories(rawCategories.map((c, i) => (i === idx ? { ...c, label: e.target.value.toUpperCase() } : c)))
                }
                placeholder="Tab Label (e.g. TAILORING)"
                className="px-2.5 py-1.5 text-xs font-semibold border border-ink-200 rounded"
              />
              <input
                value={cat.value}
                onChange={(e) =>
                  updateCategories(rawCategories.map((c, i) => (i === idx ? { ...c, value: e.target.value.toLowerCase() } : c)))
                }
                placeholder="Filter key (e.g. tailoring, shirts, all)"
                className="px-2.5 py-1.5 text-xs font-mono border border-ink-200 rounded"
              />
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => updateCategories(moveArr(rawCategories, idx, -1))}>↑</Button>
                <Button size="sm" variant="ghost" disabled={idx === rawCategories.length - 1} onClick={() => updateCategories(moveArr(rawCategories, idx, 1))}>↓</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => updateCategories(rawCategories.filter((_, i) => i !== idx))}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Carousel Products & Colour-Wise Manager */}
      <div className="p-4 rounded-xl border border-ink-200 bg-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-900">
              Products in This Carousel &amp; Colour Filter Manager
            </h4>
            <p className="text-[11px] text-ink-500">
              Filter by colour swatch, add/remove garments from <strong>{String(config.title || 'this section')}</strong>, or open any garment to edit colour-shift photos &amp; colour/size prices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGroupFilter('section')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                groupFilter === 'section'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-200'
              }`}
            >
              In This Section
            </button>
            <button
              type="button"
              onClick={() => setGroupFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                groupFilter === 'all'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-200'
              }`}
            >
              All Catalog ({catalogProducts.length})
            </button>
          </div>
        </div>

        {/* Colour Swatch Filter Pills inside Carousel Editor */}
        {availableColors.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400 mr-1">Filter by Colour:</span>
            <button
              type="button"
              onClick={() => setColorFilter('')}
              className={`px-2 py-0.5 rounded-full text-[11px] border ${
                !colorFilter ? 'bg-ink-900 text-white border-ink-900' : 'bg-ink-50 text-ink-600 border-ink-200'
              }`}
            >
              All
            </button>
            {availableColors.map((c) => {
              const active = colorFilter.toLowerCase() === c.name.toLowerCase();
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColorFilter(active ? '' : c.name)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
                    active ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-700 border-ink-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-ink-300" style={{ backgroundColor: c.hex }} />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {loadingProds ? (
          <div className="py-6 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredCatalog.map((prod) => {
              const inGroup = prod.section_group === sectionGroup;
              const isPinned = selectedProductIds.includes(prod.id);
              return (
                <div
                  key={prod.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border border-ink-200 bg-ink-50/40 hover:bg-ink-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {prod.default_img && (
                      <img src={prod.default_img} alt="" className="w-10 h-12 rounded-lg object-cover border border-ink-200 bg-white flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-900 truncate">{prod.title}</p>
                      <p className="text-[11px] text-ink-500">
                        {prod.min_price_paise !== prod.max_price_paise
                          ? `${fmtInr(prod.min_price_paise)} – ${fmtInr(prod.max_price_paise)}`
                          : fmtInr(prod.min_price_paise || prod.price_paise)}
                      </p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {prod.colors.map((c) => (
                          <span
                            key={c.name}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-ink-200 text-[10px] text-ink-700"
                          >
                            <span className="w-2 h-2 rounded-full border border-ink-300" style={{ backgroundColor: c.hex }} />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={inGroup ? 'secondary' : 'outline'}
                      onClick={() => toggleProductInSection(prod)}
                    >
                      {inGroup ? '✓ In Section' : '+ Move Here'}
                    </Button>
                    <Button
                      size="sm"
                      variant={isPinned ? 'primary' : 'ghost'}
                      onClick={() => toggleCustomPin(prod.id)}
                      title="Pin to explicit carousel product list"
                    >
                      {isPinned ? '★ Pinned' : 'Pin'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/catalog/products/${prod.id}`)}
                    >
                      Colours &amp; Prices →
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 6. VISUAL PDP GLOBAL DEFAULTS EDITOR ────────────────────────────────────
function PdpTemplateEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...config, [k]: v });
  const bool = (k: string, def = true) => (typeof config[k] === 'boolean' ? (config[k] as boolean) : def);

  const toggleCard = (key: string, label: string, description: string, def = true) => {
    const checked = bool(key, def);
    return (
      <label className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-ink-200 bg-ink-50/40 cursor-pointer hover:border-ink-400 transition-colors">
        <div>
          <span className="text-xs font-semibold text-ink-900 block">{label}</span>
          <span className="text-[11px] text-ink-500">{description}</span>
        </div>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => set(key, e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-gold-500 accent-ink-900"
        />
      </label>
    );
  };

  return (
    <div className="col-span-2 space-y-5">
      <div className="p-3.5 rounded-xl bg-gold-50/60 border border-gold-200 text-xs text-ink-700">
        These defaults apply globally across every Product Detail Page (<code className="font-mono">/products/*</code>). Publish changes to update all live product pages immediately.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {toggleCard('showOriginBadge', 'Show Origin Provenance Badge', 'Displays the boxed provenance badge next to the garment title & in description details')}
        {toggleCard('showExclusiveBanner', 'Show Exclusive Packaging Banner', 'Displays the blush callout banner beneath the Composition accordion')}
        {toggleCard('showFitFinder', 'Enable "Find Your Size" Fit Finder', 'Allows patrons to launch the interactive size recommendation assistant')}
        {toggleCard('showSizeGuide', 'Enable "Size Guide" Matrix Modal', 'Allows patrons to open the category size conversion & measurement chart')}
        {toggleCard('showReviews', 'Show Client Reviews Section', 'Displays verified patron reviews, star ratings, fit breakdown, and review submission')}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ink-100">
        <Input
          label="Origin Badge Text"
          value={String(config.originBadgeText ?? 'MADE IN INDIA')}
          onChange={(e) => set('originBadgeText', e.target.value)}
          placeholder="MADE IN INDIA"
          tooltip="Boxed provenance badge text (e.g. MADE IN INDIA)"
        />
        <Input
          label="Concierge Contact Lead-In"
          value={String(config.conciergeHeading ?? 'For more information, contact us at')}
          onChange={(e) => set('conciergeHeading', e.target.value)}
          placeholder="For more information, contact us at"
          tooltip="Introductory text shown before the concierge email link on every PDP"
        />
        <div className="sm:col-span-2">
          <Input
            label="Exclusive Packaging / Callout Banner Text"
            value={String(config.exclusiveBannerText ?? '')}
            onChange={(e) => set('exclusiveBannerText', e.target.value)}
            placeholder="Online exclusive — Dispatched in DEYNOLD DANNY archival keepsake packaging."
            tooltip="Highlight notice displayed in the right-hand product specification column"
          />
        </div>
        <Input
          label="Shipping Notice Override (Optional)"
          value={String(config.shippingNoticeText ?? '')}
          onChange={(e) => set('shippingNoticeText', e.target.value)}
          placeholder="Leave blank for automatic free-shipping threshold"
          tooltip="Optional custom shipping line above the editorial mosaic"
        />
        <Input
          label="Return Policy Line Override (Optional)"
          value={String(config.returnNoticeText ?? '')}
          onChange={(e) => set('returnNoticeText', e.target.value)}
          placeholder="Leave blank for automatic 14-day return window"
          tooltip="Optional custom return window line above the editorial mosaic"
        />
        <Input
          label="Style It With Section Heading"
          value={String(config.styleItWithHeading ?? 'Style it with')}
          onChange={(e) => set('styleItWithHeading', e.target.value)}
          placeholder="Style it with"
          tooltip="Heading for the cross-sell styling section"
        />
        <Input
          label="Related Products Section Heading"
          value={String(config.relatedHeading ?? 'More Suggestions')}
          onChange={(e) => set('relatedHeading', e.target.value)}
          placeholder="More Suggestions"
          tooltip="Heading for the related products suggestions grid"
        />
        <div className="sm:col-span-2">
          <Input
            label="Client Reviews Section Heading"
            value={String(config.reviewsHeading ?? 'Reviews')}
            onChange={(e) => set('reviewsHeading', e.target.value)}
            placeholder="Reviews"
            tooltip="Main heading for the client reviews & fit assessment block"
          />
        </div>
      </div>
    </div>
  );
}

// ─── SECTION FIELDS ROUTER ───────────────────────────────────────────────────
function SectionFields({
  type,
  config,
  onChange,
}: {
  type: SectionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...config, [k]: v });
  const inp = (k: string, label: string, tooltip: string, type_ = 'text', wide = false) => (
    <div className={wide ? 'col-span-2' : ''}>
      <Input label={label} type={type_} value={String(config[k] ?? '')} onChange={(e) => set(k, e.target.value)} tooltip={tooltip} />
    </div>
  );

  if (type === 'legal_document') return <div className="grid grid-cols-2 gap-4"><LegalDocumentEditor config={config} onChange={onChange} /></div>;
  if (type === 'hero_banner') return <div className="grid grid-cols-2 gap-4"><HeroBannerEditor config={config} onChange={onChange} /></div>;
  if (type === 'category_grid') return <div className="grid grid-cols-2 gap-4"><CategoryGridEditor config={config} onChange={onChange} /></div>;
  if (type === 'editorial_duo') return <div className="grid grid-cols-2 gap-4"><EditorialDuoEditor config={config} onChange={onChange} /></div>;
  if (type === 'style_layering') return <div className="grid grid-cols-2 gap-4"><StyleLayeringEditor config={config} onChange={onChange} /></div>;
  if (type === 'product_carousel') return <div className="grid grid-cols-2 gap-4"><ProductCarouselEditor config={config} onChange={onChange} /></div>;
  if (type === 'pdp_template') return <div className="grid grid-cols-2 gap-4"><PdpTemplateEditor config={config} onChange={onChange} /></div>;

  const fields: Record<string, React.ReactNode> = {
    newsletter_cta: (
      <>
        {inp('headline', 'Headline', 'Main heading for the newsletter block', 'text', true)}
        {inp('subtext', 'Subtext', 'Supporting description explaining newsletter benefits', 'text', true)}
        {inp('buttonText', 'Button Text', 'Subscribe button label')}
        {inp('placeholderText', 'Input Placeholder', 'Email field placeholder')}
      </>
    ),
    announcement: (
      <>
        {inp('text', 'Announcement Text', 'Message displayed in the promotional banner', 'text', true)}
        {inp('linkUrl', 'Link URL (Optional)', 'Destination URL when clicked')}
        {inp('bgColor', 'Background Hex', 'Hex background color (e.g. #111111)')}
        {inp('textColor', 'Text Hex', 'Hex text color (e.g. #ffffff)')}
      </>
    ),
    contact_page: (
      <>
        {inp('eyebrow', 'Eyebrow', 'Label above page title', 'text', true)}
        {inp('title', 'Page Heading', 'Main contact page heading', 'text', true)}
        <div className="col-span-2">
          <Textarea label="Introduction Copy" value={String(config.subtitle ?? '')} onChange={(e) => set('subtitle', e.target.value)} rows={3} />
        </div>
      </>
    ),
  };

  return <div className="grid grid-cols-2 gap-4">{fields[type] ?? <p className="col-span-2 text-sm text-ink-500">No configurable fields for this section type.</p>}</div>;
}

function SortableSectionCard({
  section,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleVisibility,
}: {
  section: NormalizedSection;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const previewThumb =
    typeof section.draftProps.desktopImage === 'string'
      ? section.draftProps.desktopImage
      : Array.isArray(section.draftProps.items) && typeof (section.draftProps.items[0] as Record<string, unknown> | undefined)?.desktopImage === 'string'
        ? String((section.draftProps.items[0] as Record<string, unknown>).desktopImage)
        : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow ${
        section.isDraftVisible ? 'border-ink-200' : 'border-dashed border-ink-300 opacity-70'
      }`}
    >
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 touch-none" aria-label="Drag to reorder">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 5a1 1 0 100 2 1 1 0 000-2zM15 5a1 1 0 100 2 1 1 0 000-2zM9 11a1 1 0 100 2 1 1 0 000-2zM15 11a1 1 0 100 2 1 1 0 000-2zM9 17a1 1 0 100 2 1 1 0 000-2zM15 17a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      </button>

      {previewThumb && (
        <div className="w-14 h-10 rounded-lg overflow-hidden border border-ink-200 bg-ink-100 flex-shrink-0">
          <img src={previewThumb} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900 truncate">{section.title}</span>
          {!section.isDraftVisible && <Badge variant="default">Hidden</Badge>}
        </div>
        <span className="text-xs text-ink-500 font-mono">{section.sectionType}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit Content
        </Button>
        <button onClick={onToggleVisibility} title={section.isDraftVisible ? 'Hide section' : 'Show section'} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {section.isDraftVisible ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            )}
          </svg>
        </button>
        <button onClick={onDuplicate} title="Duplicate section" className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 hover:text-ink-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button onClick={onDelete} title="Delete section" className="p-1.5 rounded-lg hover:bg-red-50 text-ink-300 hover:text-red-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function PageEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<NormalizedPage | null>(null);
  const [sections, setSections] = useState<NormalizedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [seoModal, setSeoModal] = useState(false);
  const [revModal, setRevModal] = useState(false);
  const [revisions, setRevisions] = useState<Record<string, unknown>[]>([]);
  const [seoForm, setSeoForm] = useState({ pageTitle: '', metaTitle: '', metaDescription: '', ogImage: '' });
  const [editSection, setEditSection] = useState<NormalizedSection | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [newType, setNewType] = useState<SectionType>('hero_banner');
  const [newLabel, setNewLabel] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const load = () => {
    if (!pageId) return;
    cms.pages
      .get(pageId)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as { page?: Record<string, unknown>; sections?: Record<string, unknown>[] };
          const p = d.page ?? (res.data as unknown as Record<string, unknown>);
          const draftSeo = (p.draftSeo ?? p.publishedSeo ?? {}) as Record<string, unknown>;
          setPage({
            id: String(p.id ?? ''),
            slug: String(p.slug ?? ''),
            routePath: String(p.routePath ?? p.route_path ?? `/${p.slug ?? ''}`),
            title: String(p.title ?? ''),
            pageType: String(p.pageType ?? p.page_type ?? 'custom'),
            status: String(p.status ?? 'draft'),
            draftSeo,
          });
          setSeoForm({
            pageTitle: String(p.title ?? ''),
            metaTitle: String(draftSeo.title ?? ''),
            metaDescription: String(draftSeo.description ?? ''),
            ogImage: String(draftSeo.ogImage ?? ''),
          });
          const rawSecs = Array.isArray(d.sections) ? d.sections : [];
          const normalized: NormalizedSection[] = rawSecs
            .map((s) => ({
              id: String(s.id ?? ''),
              pageId: String(s.pageId ?? s.page_id ?? pageId),
              sectionKey: String(s.sectionKey ?? s.section_key ?? ''),
              sectionType: String(s.sectionType ?? s.section_type ?? 'legal_document') as SectionType,
              title: String(s.title ?? s.label ?? 'Untitled Section'),
              sortOrder: Number(s.sortOrder ?? s.sort_order ?? 0),
              isDraftVisible: Boolean(s.isDraftVisible ?? s.is_draft_visible ?? true),
              draftProps: (s.draftProps ?? s.config_json ?? {}) as Record<string, unknown>,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          setSections(normalized);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, [pageId]);

  const openRevisions = async () => {
    if (!pageId) return;
    const res = await cms.pages.revisions(pageId);
    if (res.success && res.data) {
      const raw = res.data as unknown;
      setRevisions((Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[]);
    }
    setRevModal(true);
  };

  const restoreRevision = async (revId: string) => {
    if (!pageId) return;
    await cms.pages.restore(pageId, revId);
    setRevModal(false);
    setNotice('Previous revision restored into draft. Review and click Publish Live.');
    load();
  };

  const saveSeo = async () => {
    if (!pageId) return;
    setSavingSection(true);
    await cms.pages.update(pageId, {
      title: seoForm.pageTitle.trim() || page?.title,
      seo: {
        title: seoForm.metaTitle.trim(),
        description: seoForm.metaDescription.trim(),
        ogImage: seoForm.ogImage.trim(),
      },
    });
    setSeoModal(false);
    setNotice('Page SEO & Title saved to draft.');
    load();
    setSavingSection(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pageId) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIdx, newIdx);
    setSections(reordered);
    await cms.sections.reorder(pageId, reordered.map((s) => s.id));
    setNotice('Section order saved to draft.');
  };

  const defaultPropsForType = (t: SectionType, label: string): Record<string, unknown> => {
    if (t === 'hero_banner') {
      return {
        eyebrow: 'NEW SEASON CAMPAIGN',
        headline: label.toUpperCase(),
        description: 'Architectural tailoring crafted in India',
        desktopImage: '/hero-banner.jpg',
        mobileImage: '/hero-banner.jpg',
        focalX: 50,
        focalY: 35,
        overlayColor: '#000000',
        overlayOpacity: 28,
        ctaLabel: 'Explore Collection',
        ctaUrl: '/categories',
      };
    }
    if (t === 'legal_document') {
      return { eyebrow: 'HOUSE GOVERNANCE', heading: label, effectiveDate: 'November 2026', sections: [{ heading: '1. Overview', body: '' }] };
    }
    if (t === 'editorial_duo') {
      return {
        heading: label,
        items: [
          { eyebrow: 'ATELIER', title: 'Featured Story 1', description: '', ctaLabel: 'Discover', href: '/categories', desktopImage: '/images/category-scarpe.jpg' },
          { eyebrow: 'ATELIER', title: 'Featured Story 2', description: '', ctaLabel: 'Discover', href: '/categories', desktopImage: '/images/category-accessori.jpg' },
        ],
      };
    }
    if (t === 'category_grid') {
      return { heading: label, columns: 3, items: [] };
    }
    if (t === 'announcement') {
      return { text: 'COMPLIMENTARY EXPRESS DELIVERY ON ORDERS ABOVE ₹10,000', linkUrl: '/categories', bgColor: '#111111', textColor: '#ffffff' };
    }
    if (t === 'pdp_template') {
      return {
        showOriginBadge: true,
        originBadgeText: 'MADE IN INDIA',
        showExclusiveBanner: true,
        exclusiveBannerText: 'Online exclusive — Dispatched in DEYNOLD DANNY archival keepsake packaging.',
        styleItWithHeading: 'Style it with',
        relatedHeading: 'More Suggestions',
        reviewsHeading: 'Reviews',
        conciergeHeading: 'For more information, contact us at',
        showReviews: true,
        showFitFinder: true,
        showSizeGuide: true,
        shippingNoticeText: '',
        returnNoticeText: '',
      };
    }
    return {};
  };

  const addSection = async () => {
    if (!pageId || !newLabel.trim()) return;
    setSavingSection(true);
    await cms.sections.add(pageId, {
      sectionType: newType,
      title: newLabel.trim(),
      isDraftVisible: true,
      props: defaultPropsForType(newType, newLabel.trim()),
    });
    setAddModal(false);
    setNewLabel('');
    setNotice('Section added to draft. Click "Edit Content" to customize it, then Publish Live.');
    load();
    setSavingSection(false);
  };

  const saveSection = async () => {
    if (!pageId || !editSection) return;
    setSavingSection(true);
    await cms.sections.update(pageId, editSection.id, {
      title: editTitle.trim() || editSection.title,
      props: editConfig,
    });
    setEditModal(false);
    setNotice('Draft saved. Click "Publish Live" to push changes to the storefront.');
    load();
    setSavingSection(false);
  };

  const toggleVisibility = async (section: NormalizedSection) => {
    if (!pageId) return;
    await cms.sections.update(pageId, section.id, { isDraftVisible: !section.isDraftVisible });
    load();
  };

  const duplicateSection = async (section: NormalizedSection) => {
    if (!pageId) return;
    await cms.sections.duplicate(pageId, section.id);
    load();
  };

  const deleteSection = async (section: NormalizedSection) => {
    if (!pageId || !confirm(`Delete "${section.title}"?`)) return;
    await cms.sections.delete(pageId, section.id);
    load();
  };

  const publish = async () => {
    if (!pageId) return;
    setPublishing(true);
    await cms.pages.publish(pageId);
    setNotice('Published live to the storefront and edge cache refreshed!');
    load();
    setPublishing(false);
  };

  const preview = async () => {
    if (!pageId) return;
    const res = await cms.pages.previewToken(pageId);
    const target = res.data?.previewPath || res.data?.url;
    if (res.success && target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (!page) return <div className="text-center py-20 text-ink-500">Page not found.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => navigate('/studio')} className="p-2 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors" aria-label="Back to studio">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-semibold text-ink-900">{page.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs text-ink-500">{page.routePath}</code>
            <Badge variant={statusVariant(page.status)}>{page.status}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSeoModal(true)}>
          SEO &amp; Title
        </Button>
        <Button variant="ghost" size="sm" onClick={openRevisions}>
          History
        </Button>
        <Button variant="outline" size="sm" onClick={preview}>
          Preview Draft
        </Button>
        <Button variant="secondary" size="sm" onClick={publish} loading={publishing}>
          Publish Live
        </Button>
      </div>

      {notice && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 mb-6">
            {sections.map((section) => (
              <SortableSectionCard
                key={section.id}
                section={section}
                onEdit={() => {
                  setEditSection(section);
                  setEditTitle(section.title);
                  setEditConfig(section.draftProps ?? {});
                  setEditModal(true);
                }}
                onDuplicate={() => duplicateSection(section)}
                onDelete={() => deleteSection(section)}
                onToggleVisibility={() => toggleVisibility(section)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <div className="border-2 border-dashed border-ink-200 rounded-2xl p-16 text-center mb-6">
          <p className="text-sm font-medium text-ink-900 mb-1">No sections yet</p>
          <p className="text-sm text-ink-500">Add a Hero Banner, Category Grid, Editorial Duo, or Document section to compose this page.</p>
        </div>
      )}

      <Button variant="outline" onClick={() => setAddModal(true)} className="w-full justify-center border-dashed">
        + Add Section
      </Button>

      {/* Add Section Modal */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add Section"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button loading={savingSection} onClick={addSection} disabled={!newLabel.trim()}>
              Add Section
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Section Type"
            value={newType}
            onChange={(e) => setNewType(e.target.value as SectionType)}
            options={SECTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          {newType && <p className="text-xs text-ink-500">{SECTION_TYPES.find((t) => t.value === newType)?.description}</p>}
          <Input
            label="Section Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Festive Campaign Hero Banner"
          />
        </div>
      </Modal>

      {/* Visual Edit Section Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit Section: ${editSection?.title ?? ''}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setEditModal(false)}>
              Cancel
            </Button>
            <Button loading={savingSection} onClick={saveSection}>
              Save Draft
            </Button>
          </>
        }
      >
        {editSection && (
          <div className="space-y-5">
            <Input label="Section Label (Studio Name)" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <SectionFields type={editSection.sectionType} config={editConfig} onChange={setEditConfig} />
          </div>
        )}
      </Modal>

      {/* SEO Modal */}
      <Modal
        open={seoModal}
        onClose={() => setSeoModal(false)}
        title="Page Title & SEO Metadata"
        footer={
          <>
            <Button variant="outline" onClick={() => setSeoModal(false)}>
              Cancel
            </Button>
            <Button loading={savingSection} onClick={saveSeo}>
              Save SEO
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Page Display Title" value={seoForm.pageTitle} onChange={(e) => setSeoForm((f) => ({ ...f, pageTitle: e.target.value }))} />
          <Input label="SEO Meta Title (max 60 chars)" value={seoForm.metaTitle} onChange={(e) => setSeoForm((f) => ({ ...f, metaTitle: e.target.value }))} />
          <Textarea label="SEO Meta Description (max 160 chars)" rows={3} value={seoForm.metaDescription} onChange={(e) => setSeoForm((f) => ({ ...f, metaDescription: e.target.value }))} />
          <ImageUrlField label="Social Share (OG) Image" value={seoForm.ogImage} onChange={(url) => setSeoForm((f) => ({ ...f, ogImage: url }))} />
        </div>
      </Modal>

      {/* Revision History Modal */}
      <Modal open={revModal} onClose={() => setRevModal(false)} title="Page Revision History">
        {revisions.length === 0 ? (
          <p className="text-sm text-ink-500 py-6 text-center">No published revisions yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {revisions.map((r, i) => (
              <div key={String(r.id ?? i)} className="flex items-center justify-between p-3 border border-ink-100 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    v{String(r.versionNumber ?? revisions.length - i)} · <span className="capitalize text-ink-500">{String(r.action ?? 'publish').replace('_', ' ')}</span>
                  </p>
                  <p className="text-xs text-ink-500">{new Date(String(r.createdAt ?? '')).toLocaleString('en-IN')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreRevision(String(r.id))}>
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
