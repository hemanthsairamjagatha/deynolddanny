import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cms } from '../../lib/api';
import type { SectionType } from '../../lib/types';
import { Button, Badge, statusVariant, Modal, Input, Textarea, Select, Spinner } from '../../components/ui';

interface NormalizedPage {
  id: string;
  slug: string;
  routePath: string;
  title: string;
  pageType: string;
  status: string;
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

const SECTION_TYPES: Array<{ value: SectionType; label: string; description: string }> = [
  { value: 'hero_banner', label: 'Hero Banner', description: 'Full-width hero with desktop/mobile imagery, focal point, headline & CTA' },
  { value: 'product_carousel', label: 'Product Carousel', description: 'Horizontal scrolling product showcase with category tabs' },
  { value: 'category_grid', label: 'Category Grid', description: 'Visual category navigation grid' },
  { value: 'editorial_duo', label: 'Editorial Duo', description: 'Two-column editorial image and text layout' },
  { value: 'style_layering', label: 'Style Layering', description: 'Layered fashion editorial with product links' },
  { value: 'newsletter_cta', label: 'Newsletter CTA', description: 'Email subscription call-to-action block' },
  { value: 'announcement', label: 'Announcement', description: 'Top banner bar for promotions and global announcements' },
  { value: 'legal_document', label: 'Legal / Editorial Document', description: 'Structured multi-clause legal policy or brand narrative (Privacy, Refunds, Terms, About Us)' },
  { value: 'contact_page', label: 'Contact Page', description: 'Concierge page header, intro, and inquiry subject list' },
  { value: 'pdp_template', label: 'PDP Template', description: 'Global Product Detail Page configuration' },
];

function LegalDocumentEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const clauses = Array.isArray(config.sections)
    ? (config.sections as LegalClause[])
    : [];

  const updateClause = (idx: number, patch: Partial<LegalClause>) => {
    const next = clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...config, sections: next });
  };

  const addClause = () => {
    const next = [...clauses, { heading: `${clauses.length + 1}. New Clause`, body: '' }];
    onChange({ ...config, sections: next });
  };

  const removeClause = (idx: number) => {
    const next = clauses.filter((_, i) => i !== idx);
    onChange({ ...config, sections: next });
  };

  const moveClause = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= clauses.length) return;
    const next = [...clauses];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...config, sections: next });
  };

  return (
    <div className="col-span-2 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Eyebrow Label"
          value={String(config.eyebrow ?? '')}
          onChange={e => onChange({ ...config, eyebrow: e.target.value })}
          tooltip="Small uppercase classification line above the document title (e.g. LEGAL GOVERNANCE)."
        />
        <Input
          label="Effective Date / Subtitle"
          value={String(config.effectiveDate ?? '')}
          onChange={e => onChange({ ...config, effectiveDate: e.target.value })}
          tooltip="Displayed beneath the heading to indicate policy effective date and jurisdiction."
        />
      </div>

      <Input
        label="Document Main Heading"
        value={String(config.heading ?? '')}
        onChange={e => onChange({ ...config, heading: e.target.value })}
        tooltip="Primary H1 heading rendered on the storefront page."
      />

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Document Clauses ({clauses.length})</h3>
            <p className="text-xs text-ink-500">Edit each numbered legal clause or editorial paragraph directly. Click Publish Live when ready.</p>
          </div>
          <Button size="sm" variant="outline" onClick={addClause}>+ Add Clause</Button>
        </div>

        {clauses.map((clause, idx) => (
          <div key={idx} className="p-4 border border-ink-200 rounded-xl bg-ink-50/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-400">Clause {idx + 1}</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveClause(idx, -1)}>↑</Button>
                <Button size="sm" variant="ghost" disabled={idx === clauses.length - 1} onClick={() => moveClause(idx, 1)}>↓</Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => removeClause(idx)}>Remove</Button>
              </div>
            </div>
            <Input
              label="Clause Heading"
              value={clause.heading ?? ''}
              onChange={e => updateClause(idx, { heading: e.target.value })}
              tooltip="Section title for this clause (e.g. '7. 14-Day Returns & Exchanges')."
            />
            <Textarea
              label="Clause Text"
              rows={4}
              value={clause.body ?? ''}
              onChange={e => updateClause(idx, { body: e.target.value })}
              tooltip="Full legal or editorial text rendered inside this clause."
            />
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <Input label={label} type={type_} value={String(config[k] ?? '')} onChange={e => set(k, e.target.value)} tooltip={tooltip} />
    </div>
  );
  const ta = (k: string, label: string, tooltip: string, rows = 4) => (
    <div className="col-span-2">
      <Textarea label={label} value={typeof config[k] === 'string' ? (config[k] as string) : JSON.stringify(config[k] ?? '', null, 2)} onChange={e => set(k, e.target.value)} rows={rows} tooltip={tooltip} />
    </div>
  );

  if (type === 'legal_document') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <LegalDocumentEditor config={config} onChange={onChange} />
      </div>
    );
  }

  const fields: Record<string, React.ReactNode> = {
    hero_banner: (
      <>
        {inp('eyebrow', 'Eyebrow', 'Small uppercase campaign eyebrow above the headline', 'text', true)}
        {inp('headline', 'Headline', 'Main hero display heading (e.g. DEYNOLD DANNY)', 'text', true)}
        {inp('description', 'Tagline / Subheadline', 'Supporting line beneath the hero headline', 'text', true)}
        {inp('desktopImage', 'Desktop Image URL', 'High-resolution widescreen hero image (2560×1429px)', 'text', true)}
        {inp('mobileImage', 'Mobile Image URL', 'Portrait/mobile-optimized hero image URL', 'text', true)}
        {inp('focalX', 'Focal Point X (0–100)', 'Horizontal crop focus percentage (50 = centered)', 'number')}
        {inp('focalY', 'Focal Point Y (0–100)', 'Vertical crop focus percentage (35 = upper third)', 'number')}
        {inp('ctaLabel', 'Primary CTA Label', 'Button text (e.g. Discover Collection)')}
        {inp('ctaUrl', 'Primary CTA URL', 'Destination link (e.g. /categories)')}
      </>
    ),
    product_carousel: (
      <>
        {inp('eyebrow', 'Eyebrow', 'Small label above the carousel heading')}
        {inp('title', 'Section Title', 'Heading above the product carousel')}
        {inp('ctaLabel', 'View All Label', 'Button/link label')}
        {inp('ctaUrl', 'View All URL', 'Destination URL for viewing the full collection')}
      </>
    ),
    category_grid: (
      <>
        {inp('heading', 'Section Heading', 'Title above the editorial category grid', 'text', true)}
        {ta('items', 'Category Cards (JSON)', 'JSON array of category cards with title, subtitle, href, desktopImage, focalX, focalY', 8)}
      </>
    ),
    editorial_duo: (
      <>
        {inp('heading', 'Section Heading', 'Optional heading above the duo panels', 'text', true)}
        {ta('items', 'Duo Panels (JSON)', 'JSON array of two editorial panels with eyebrow, title, description, ctaLabel, href, desktopImage', 8)}
      </>
    ),
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
        {inp('text', 'Announcement Text', 'Message displayed in the top storefront bar', 'text', true)}
        {inp('linkUrl', 'Link URL', 'Optional destination URL')}
        {inp('bgColor', 'Background Hex', 'Hex background color (e.g. #111111)')}
        {inp('textColor', 'Text Hex', 'Hex text color (e.g. #ffffff)')}
      </>
    ),
    contact_page: (
      <>
        {inp('eyebrow', 'Eyebrow', 'Label above page title', 'text', true)}
        {inp('title', 'Page Heading', 'Main contact page heading', 'text', true)}
        {ta('subtitle', 'Introduction Copy', 'Introductory text above the concierge contact form', 3)}
      </>
    ),
    pdp_template: (
      <>
        {inp('originBadgeText', 'Origin Badge Text', 'Boxed provenance badge text (e.g. MADE IN INDIA)', 'text', true)}
        {inp('exclusiveBannerText', 'Exclusive Notice Text', 'Highlight notice displayed in product specification column', 'text', true)}
        {inp('styleItWithHeading', 'Style It With Heading', 'Heading for cross-sell styling section')}
        {inp('relatedHeading', 'Related Products Heading', 'Heading for related suggestions grid')}
      </>
    ),
    style_layering: (
      <>
        {inp('title', 'Section Title', 'Heading above the style layering lookbook', 'text', true)}
        {inp('ctaLabel', 'CTA Label', 'Action label')}
        {inp('ctaUrl', 'CTA URL', 'Destination URL')}
        {ta('tabs', 'Lookbook Tabs (JSON)', 'JSON array of curated look tabs with pieces and imagery', 8)}
      </>
    ),
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields[type] ?? <p className="col-span-2 text-sm text-ink-500">No configurable fields for this section type.</p>}
    </div>
  );
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

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow ${section.isDraftVisible ? 'border-ink-200' : 'border-dashed border-ink-300 opacity-70'}`}>
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 touch-none" aria-label="Drag to reorder">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 5a1 1 0 100 2 1 1 0 000-2zM15 5a1 1 0 100 2 1 1 0 000-2zM9 11a1 1 0 100 2 1 1 0 000-2zM15 11a1 1 0 100 2 1 1 0 000-2zM9 17a1 1 0 100 2 1 1 0 000-2zM15 17a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900 truncate">{section.title}</span>
          {!section.isDraftVisible && <Badge variant="default">Hidden</Badge>}
        </div>
        <span className="text-xs text-ink-500 font-mono">{section.sectionType}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onEdit}>Edit Content</Button>
        <button onClick={onToggleVisibility} title={section.isDraftVisible ? 'Hide section' : 'Show section'} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {section.isDraftVisible
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            }
          </svg>
        </button>
        <button onClick={onDuplicate} title="Duplicate section" className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 hover:text-ink-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
        <button onClick={onDelete} title="Delete section" className="p-1.5 rounded-lg hover:bg-red-50 text-ink-300 hover:text-red-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
  const [editSection, setEditSection] = useState<NormalizedSection | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [newType, setNewType] = useState<SectionType>('legal_document');
  const [newLabel, setNewLabel] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const load = () => {
    if (!pageId) return;
    cms.pages.get(pageId).then(res => {
      if (res.success && res.data) {
        const d = res.data as { page?: Record<string, unknown>; sections?: Record<string, unknown>[] };
        const p = d.page ?? (res.data as unknown as Record<string, unknown>);
        setPage({
          id: String(p.id ?? ''),
          slug: String(p.slug ?? ''),
          routePath: String(p.routePath ?? p.route_path ?? `/${p.slug ?? ''}`),
          title: String(p.title ?? ''),
          pageType: String(p.pageType ?? p.page_type ?? 'custom'),
          status: String(p.status ?? 'draft'),
        });
        const rawSecs = Array.isArray(d.sections) ? d.sections : [];
        const normalized: NormalizedSection[] = rawSecs
          .map(s => ({
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
    }).catch(() => setLoading(false));
  };

  useEffect(load, [pageId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pageId) return;
    const oldIdx = sections.findIndex(s => s.id === active.id);
    const newIdx = sections.findIndex(s => s.id === over.id);
    const reordered = arrayMove(sections, oldIdx, newIdx);
    setSections(reordered);
    await cms.sections.reorder(pageId, reordered.map(s => s.id));
    setNotice('Section order saved to draft.');
  };

  const addSection = async () => {
    if (!pageId || !newLabel.trim()) return;
    setSavingSection(true);
    await cms.sections.add(pageId, {
      sectionType: newType,
      title: newLabel.trim(),
      isDraftVisible: true,
      props: newType === 'legal_document' ? { eyebrow: '', heading: newLabel.trim(), effectiveDate: '', sections: [{ heading: '1. Overview', body: '' }] } : {},
    });
    setAddModal(false);
    setNewLabel('');
    setNotice('Section added to draft.');
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
    setNotice('Published live to the storefront and edge cache refreshed.');
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

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!page) return <div className="text-center py-20 text-ink-500">Page not found.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button onClick={() => navigate('/studio')} className="p-2 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors" aria-label="Back to studio">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-semibold text-ink-900">{page.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs text-ink-500">{page.routePath}</code>
            <Badge variant={statusVariant(page.status)}>{page.status}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={preview}>Preview Draft</Button>
        <Button variant="secondary" onClick={publish} loading={publishing}>Publish Live</Button>
      </div>

      {notice && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 mb-6">
            {sections.map(section => (
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
          <p className="text-sm text-ink-500">Add your first section to compose this page.</p>
        </div>
      )}

      <Button variant="outline" onClick={() => setAddModal(true)} className="w-full justify-center border-dashed">
        + Add Section
      </Button>

      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add Section"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button loading={savingSection} onClick={addSection} disabled={!newLabel.trim()}>Add Section</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Section Type"
            value={newType}
            onChange={e => setNewType(e.target.value as SectionType)}
            options={SECTION_TYPES.map(t => ({ value: t.value, label: t.label }))}
            tooltip="Determines the storefront layout and editable content fields for this section."
          />
          {newType && <p className="text-xs text-ink-500">{SECTION_TYPES.find(t => t.value === newType)?.description}</p>}
          <Input
            label="Section Label"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g. Privacy Policy Clauses"
            tooltip="Internal label shown in the Visual Content Studio canvas."
          />
        </div>
      </Modal>

      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit Section: ${editSection?.title ?? ''}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button loading={savingSection} onClick={saveSection}>Save Draft</Button>
          </>
        }
      >
        {editSection && (
          <div className="space-y-5">
            <Input
              label="Section Label"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              tooltip="Internal studio name for this section."
            />
            <SectionFields
              type={editSection.sectionType}
              config={editConfig}
              onChange={setEditConfig}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
