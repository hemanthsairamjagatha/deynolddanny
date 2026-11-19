import { useState, useEffect } from 'react';
import { categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Spinner } from '../../components/ui';
import type { Column } from '../../components/ui';

type Category = Record<string, unknown>;

const EMPTY_FORM = { name: '', slug: '', hero_title: '', eyebrow: '', description: '', mobile_image: '', focal_x: '50', focal_y: '50', editorial_json: '[]', seo_json: '{}' };

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    catsApi.list().then(r => { if (r.success && r.data) setCats(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setModal(true); };
  const openEdit = (c: Category) => {
    setForm({
      name: (c.name as string) ?? '',
      slug: (c.slug as string) ?? '',
      hero_title: (c.hero_title as string) ?? '',
      eyebrow: (c.eyebrow as string) ?? '',
      description: (c.description as string) ?? '',
      mobile_image: (c.mobile_image as string) ?? '',
      focal_x: String(c.focal_x ?? 50),
      focal_y: String(c.focal_y ?? 50),
      editorial_json: c.editorial_json ? JSON.stringify(c.editorial_json, null, 2) : '[]',
      seo_json: c.seo_json ? JSON.stringify(c.seo_json, null, 2) : '{}',
    });
    setEditId(c.id as string);
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      focal_x: parseFloat(form.focal_x),
      focal_y: parseFloat(form.focal_y),
      editorial_json: JSON.parse(form.editorial_json || '[]'),
      seo_json: JSON.parse(form.seo_json || '{}'),
    };
    if (editId) await catsApi.update(editId, payload);
    else await catsApi.create(payload);
    setModal(false);
    load();
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await catsApi.delete(id);
    load();
  };

  const cols: Column<Category>[] = [
    { key: 'name', header: 'Name', render: c => <span className="font-medium text-ink-900">{c.name as string}</span> },
    { key: 'slug', header: 'Slug', render: c => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">{c.slug as string}</code> },
    { key: 'hero_title', header: 'Hero Title', render: c => <span className="text-sm text-ink-600 truncate max-w-xs block">{(c.hero_title as string) ?? '—'}</span> },
    { key: 'actions', header: '', render: c => (
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => del(c.id as string)} className="text-red-500 hover:bg-red-50">Delete</Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Categories" description="Manage product browsing categories and their page content." actions={<Button onClick={openCreate}>+ New Category</Button>} />
      <Card padding={false}>
        <DataTable columns={cols} data={cats} loading={loading} emptyTitle="No categories yet" />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Category' : 'Create Category'} wide
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name" value={form.name} onChange={e => { setF('name', e.target.value); if (!editId) setF('slug', autoSlug(e.target.value)); }} tooltip="Internal and URL-visible category name." />
          <Input label="Slug" value={form.slug} onChange={e => setF('slug', e.target.value)} tooltip="URL path segment, e.g. 'formal-shirts'" />
          <Input label="Hero Title" value={form.hero_title} onChange={e => setF('hero_title', e.target.value)} tooltip="Large headline shown in the category hero banner." />
          <Input label="Eyebrow" value={form.eyebrow} onChange={e => setF('eyebrow', e.target.value)} tooltip="Small label above the hero headline, e.g. 'New Arrivals'" />
          <div className="col-span-2"><Textarea label="Description" value={form.description} onChange={e => setF('description', e.target.value)} rows={3} tooltip="Short category description shown in SEO meta and browse pages." /></div>
          <div className="col-span-2"><Input label="Mobile Image URL" value={form.mobile_image} onChange={e => setF('mobile_image', e.target.value)} tooltip="Separate image optimized for mobile viewports. Use portrait aspect ratio." /></div>
          <Input label="Focal X (0–100)" type="number" value={form.focal_x} onChange={e => setF('focal_x', e.target.value)} tooltip="Horizontal focal point for automatic image cropping. 0=left, 50=center, 100=right." />
          <Input label="Focal Y (0–100)" type="number" value={form.focal_y} onChange={e => setF('focal_y', e.target.value)} tooltip="Vertical focal point for automatic image cropping. 0=top, 50=center, 100=bottom." />
          <div className="col-span-2"><Textarea label="Editorial JSON" value={form.editorial_json} onChange={e => setF('editorial_json', e.target.value)} rows={5} tooltip="Editorial content blocks for the category page. JSON array of content block objects." className="font-mono text-xs" /></div>
          <div className="col-span-2"><Textarea label="SEO JSON" value={form.seo_json} onChange={e => setF('seo_json', e.target.value)} rows={4} tooltip='SEO overrides: { "title": "...", "description": "...", "og_image": "..." }' className="font-mono text-xs" /></div>
        </div>
      </Modal>
    </div>
  );
}
