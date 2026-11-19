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
import type { CmsPage, CmsSection, SectionType } from '../../lib/types';
import { Button, Badge, statusVariant, Modal, Input, Textarea, Select, Spinner, InfoTooltip } from '../../components/ui';

const SECTION_TYPES: Array<{ value: SectionType; label: string; description: string }> = [
  { value: 'hero_banner', label: 'Hero Banner', description: 'Full-width hero with image, headline and CTA' },
  { value: 'product_carousel', label: 'Product Carousel', description: 'Horizontal scrolling product showcase' },
  { value: 'category_grid', label: 'Category Grid', description: 'Visual category navigation grid' },
  { value: 'editorial_duo', label: 'Editorial Duo', description: 'Two-column editorial image and text layout' },
  { value: 'style_layering', label: 'Style Layering', description: 'Layered fashion editorial with product links' },
  { value: 'newsletter_cta', label: 'Newsletter CTA', description: 'Email subscription call-to-action block' },
  { value: 'announcement', label: 'Announcement', description: 'Banner bar for promotions and announcements' },
  { value: 'legal_document', label: 'Legal Document', description: 'Rich text block for legal / policy content' },
  { value: 'contact_page', label: 'Contact Page', description: 'Contact form and information layout' },
  { value: 'pdp_template', label: 'PDP Template', description: 'Product detail page configuration' },
];

function SectionFields({ type, config, onChange }: {
  type: SectionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...config, [k]: v });
  const inp = (k: string, label: string, tooltip: string, type_ = 'text', wide = false) => (
    <div className={wide ? 'col-span-2' : ''}>
      <Input label={label} type={type_} value={(config[k] as string) ?? ''} onChange={e => set(k, e.target.value)} tooltip={tooltip} />
    </div>
  );
  const ta = (k: string, label: string, tooltip: string, rows = 4) => (
    <div className="col-span-2">
      <Textarea label={label} value={(config[k] as string) ?? ''} onChange={e => set(k, e.target.value)} rows={rows} tooltip={tooltip} />
    </div>
  );

  const fields: Record<string, React.ReactNode> = {
    hero_banner: <>{inp('headline', 'Headline', 'Main hero heading, e.g. "The New Season"', 'text', true)}{inp('subheadline', 'Subheadline', 'Supporting text below the headline', 'text', true)}{inp('ctaText', 'CTA Button Text', 'Call-to-action button label, e.g. "Explore Collection"')}{inp('ctaUrl', 'CTA URL', 'Link for the CTA button, e.g. /collections/new-arrivals')}{inp('imageUrl', 'Image URL', 'Hero background image URL. Recommended size: 2560×1440px', 'text', true)}{inp('imageAlt', 'Image Alt Text', 'Descriptive text for screen readers and SEO', 'text', true)}{inp('overlayOpacity', 'Overlay Opacity (0–1)', 'Dark overlay transparency over the image for text legibility. 0 = none, 1 = fully opaque')}</>,
    product_carousel: <>{inp('title', 'Section Title', 'Heading above the product carousel, e.g. "New Arrivals"', 'text', true)}{ta('productIds', 'Product IDs (one per line)', 'Product UUIDs to display. Leave blank to use latest products.', 4)}{inp('viewAllUrl', 'View All URL', 'Optional link for a "View all" button at the end of the carousel')}</>,
    category_grid: <>{inp('title', 'Section Title', 'Heading above the category grid', 'text', true)}{ta('categories', 'Categories (JSON array)', 'JSON array: [{"id":"...","label":"...","imageUrl":"..."}]', 6)}</>,
    editorial_duo: <>{inp('leftImageUrl', 'Left Image URL', 'Image for the left panel', 'text', true)}{inp('leftCaption', 'Left Caption', 'Small caption beneath the left image')}{inp('rightTitle', 'Right Title', 'Heading for the right text panel')}{ta('rightBody', 'Right Body Text', 'Editorial copy for the right panel', 4)}{inp('rightCtaText', 'CTA Text', 'Button label for the right panel CTA')}{inp('rightCtaUrl', 'CTA URL', 'Destination URL for the right panel CTA')}</>,
    newsletter_cta: <>{inp('headline', 'Headline', 'Main heading for the newsletter sign-up block', 'text', true)}{inp('subtext', 'Subtext', 'Supporting sentence explaining the newsletter value')}{inp('buttonText', 'Button Text', 'CTA button label, e.g. "Subscribe"')}{inp('placeholderText', 'Input Placeholder', 'Email input placeholder text, e.g. "Your email address"')}</>,
    announcement: <>{inp('text', 'Announcement Text', 'The message shown in the announcement bar', 'text', true)}{inp('link', 'Link URL', 'Optional URL the bar links to')}{inp('linkText', 'Link Text', 'Anchor text for the link, e.g. "Shop Now"')}{inp('backgroundColor', 'Background Color', 'Hex color for the bar background, e.g. #1a1a1a')}</>,
    legal_document: <>{ta('content', 'Document Content (Markdown)', 'Markdown-formatted legal document content. Headings, paragraphs and lists are supported.', 12)}</>,
    contact_page: <>{inp('heading', 'Page Heading', 'Title shown at the top of the contact page')}{ta('intro', 'Introduction Text', 'Introductory paragraph above the contact form', 3)}</>,
    pdp_template: <>{inp('reviewsEnabled', 'Show Reviews (true/false)', 'Whether to display customer reviews section on PDPs')}{inp('fitFinderEnabled', 'Show Fit Finder (true/false)', 'Whether to show the AI fit finder button on PDPs')}</>,
    style_layering: <>{inp('title', 'Section Title', 'Heading above the style layering section', 'text', true)}{ta('items', 'Style Items (JSON array)', 'JSON array of style items: [{"imageUrl":"...","productId":"...","label":"..."}]', 6)}</>,
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields[type] ?? <p className="col-span-2 text-sm text-ink-500">No configurable fields for this section type.</p>}
    </div>
  );
}

function SortableSectionCard({ section, onEdit, onDuplicate, onDelete, onToggleVisibility }: {
  section: CmsSection;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow ${section.is_visible ? 'border-ink-200' : 'border-dashed border-ink-300 opacity-70'}`}>
      {/* Drag Handle */}
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 touch-none">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 5a1 1 0 100 2 1 1 0 000-2zM15 5a1 1 0 100 2 1 1 0 000-2zM9 11a1 1 0 100 2 1 1 0 000-2zM15 11a1 1 0 100 2 1 1 0 000-2zM9 17a1 1 0 100 2 1 1 0 000-2zM15 17a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900 truncate">{section.label}</span>
          {!section.is_visible && <Badge variant="default">Hidden</Badge>}
        </div>
        <span className="text-xs text-ink-500 font-mono">{section.section_type}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={onToggleVisibility} title={section.is_visible ? 'Hide section' : 'Show section'}
          className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {section.is_visible
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            }
          </svg>
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 hover:text-ink-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button onClick={onDuplicate} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 hover:text-ink-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-ink-300 hover:text-red-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}

export default function PageEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [sections, setSections] = useState<CmsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editSection, setEditSection] = useState<CmsSection | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [newType, setNewType] = useState<SectionType>('hero_banner');
  const [newLabel, setNewLabel] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const load = () => {
    if (!pageId) return;
    cms.pages.get(pageId).then(res => {
      if (res.success && res.data) {
        setPage(res.data);
        setSections((res.data.sections ?? []).sort((a, b) => a.sort_order - b.sort_order));
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
  };

  const addSection = async () => {
    if (!pageId || !newLabel) return;
    setSavingSection(true);
    await cms.sections.add(pageId, {
      section_type: newType,
      label: newLabel,
      config_json: {},
      is_visible: 1,
    });
    setAddModal(false);
    setNewLabel('');
    load();
    setSavingSection(false);
  };

  const saveSection = async () => {
    if (!pageId || !editSection) return;
    setSavingSection(true);
    await cms.sections.update(pageId, editSection.id, { config_json: editConfig });
    setEditModal(false);
    load();
    setSavingSection(false);
  };

  const toggleVisibility = async (section: CmsSection) => {
    if (!pageId) return;
    await cms.sections.update(pageId, section.id, { is_visible: section.is_visible ? 0 : 1 });
    load();
  };

  const duplicateSection = async (section: CmsSection) => {
    if (!pageId) return;
    await cms.sections.duplicate(pageId, section.id);
    load();
  };

  const deleteSection = async (section: CmsSection) => {
    if (!pageId || !confirm(`Delete "${section.label}"?`)) return;
    await cms.sections.delete(pageId, section.id);
    load();
  };

  const publish = async () => {
    if (!pageId) return;
    setPublishing(true);
    await cms.pages.publish(pageId);
    load();
    setPublishing(false);
  };

  const preview = async () => {
    if (!pageId) return;
    const res = await cms.pages.previewToken(pageId);
    if (res.success && res.data?.url) window.open(res.data.url, '_blank');
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!page) return <div className="text-center py-20 text-ink-500">Page not found.</div>;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/studio')} className="p-2 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-semibold text-ink-900">{page.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs text-ink-400">/{page.slug}</code>
            <Badge variant={statusVariant(page.status)}>{page.status}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={preview}>Preview</Button>
        <Button variant="secondary" onClick={publish} loading={publishing}>Publish Live</Button>
      </div>

      {/* Section Canvas */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 mb-6">
            {sections.map(section => (
              <SortableSectionCard
                key={section.id}
                section={section}
                onEdit={() => { setEditSection(section); setEditConfig(section.config_json ?? {}); setEditModal(true); }}
                onDuplicate={() => duplicateSection(section)}
                onDelete={() => deleteSection(section)}
                onToggleVisibility={() => toggleVisibility(section)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <div className="border-2 border-dashed border-ink-200 rounded-2xl p-16 text-center">
          <p className="text-sm font-medium text-ink-900 mb-1">No sections yet</p>
          <p className="text-sm text-ink-500 mb-4">Add your first section to start building this page.</p>
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
            <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button loading={savingSection} onClick={addSection}>Add Section</Button>
          </>
        }
      >
        <Select
          label="Section Type"
          value={newType}
          onChange={e => setNewType(e.target.value as SectionType)}
          options={SECTION_TYPES.map(t => ({ value: t.value, label: t.label }))}
          tooltip="The type determines the layout and configurable fields for this section."
        />
        {newType && <p className="text-xs text-ink-500 mt-1">{SECTION_TYPES.find(t => t.value === newType)?.description}</p>}
        <Input
          label="Section Label"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="e.g. Hero — Summer Campaign"
          tooltip="Internal label to identify this section in the studio. Not shown publicly."
        />
      </Modal>

      {/* Edit Section Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit: ${editSection?.label ?? ''}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button loading={savingSection} onClick={saveSection}>Save Changes</Button>
          </>
        }
      >
        {editSection && (
          <SectionFields
            type={editSection.section_type}
            config={editConfig}
            onChange={setEditConfig}
          />
        )}
      </Modal>
    </div>
  );
}
