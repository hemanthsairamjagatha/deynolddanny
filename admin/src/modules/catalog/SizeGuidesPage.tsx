import { useEffect, useState } from 'react';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Select, Spinner, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { sizeGuides, categories as categoriesApi } from '../../lib/api';

interface NormalizedGuide {
  id: string;
  slug: string;
  title: string;
  categorySlug: string | null;
  tables: unknown[];
  measurementNotes: string[];
}

interface CatOption {
  slug: string;
  title: string;
}

export default function SizeGuidesPage() {
  const [guides, setGuides] = useState<NormalizedGuide[]>([]);
  const [categories, setCategories] = useState<CatOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NormalizedGuide | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', categorySlug: '', notesText: '', tablesJson: '[]' });
  const [error, setError] = useState('');

  const autoSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function load() {
    setLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([sizeGuides.list(), categoriesApi.list()]);
      const gRaw = gRes.data as unknown;
      const gArr = (Array.isArray(gRaw) ? gRaw : (gRaw as { items?: Record<string, unknown>[] })?.items ?? []) as Record<string, unknown>[];
      setGuides(
        gArr.map((g) => ({
          id: String(g.id ?? ''),
          slug: String(g.slug ?? ''),
          title: String(g.title ?? g.name ?? ''),
          categorySlug: g.categorySlug ? String(g.categorySlug) : null,
          tables: Array.isArray(g.tables) ? g.tables : [],
          measurementNotes: Array.isArray(g.measurementNotes) ? (g.measurementNotes as string[]) : [],
        })),
      );

      const cRaw = cRes.data as unknown;
      const cArr = (Array.isArray(cRaw) ? cRaw : (cRaw as { items?: Record<string, unknown>[] })?.items ?? []) as Record<string, unknown>[];
      setCategories(cArr.map((c) => ({ slug: String(c.slug ?? ''), title: String(c.title ?? c.name ?? '') })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', slug: '', categorySlug: '', notesText: '', tablesJson: '[{"name":"Measurements","headers":["Size","Chest (cm)","Waist (cm)"],"rows":[["S","92-95","78-81"],["M","96-99","82-85"],["L","100-103","86-89"]]}]' });
    setError('');
    setModalOpen(true);
  }

  function openEdit(g: NormalizedGuide) {
    setEditing(g);
    setForm({
      title: g.title,
      slug: g.slug,
      categorySlug: g.categorySlug ?? '',
      notesText: g.measurementNotes.join('\n'),
      tablesJson: JSON.stringify(g.tables ?? [], null, 2),
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setError('');
    let parsed: unknown[];
    try {
      parsed = JSON.parse(form.tablesJson);
      if (!Array.isArray(parsed)) throw new Error();
    } catch {
      setError('Size chart tables must be a valid JSON array.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        categorySlug: form.categorySlug || null,
        tables: parsed,
        measurementNotes: form.notesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = editing ? await sizeGuides.update(editing.id, payload) : await sizeGuides.create(payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Save failed');
        return;
      }
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this size guide?')) return;
    setDeleting(id);
    try {
      await sizeGuides.delete(id);
      load();
    } finally {
      setDeleting(null);
    }
  }

  const columns: Column<NormalizedGuide>[] = [
    { key: 'title', header: 'Title', render: (r) => <span className="font-medium text-ink-900">{r.title}</span> },
    { key: 'slug', header: 'Slug', render: (r) => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">{r.slug}</code> },
    { key: 'categorySlug', header: 'Category', render: (r) => <span className="text-ink-600">{r.categorySlug ?? 'Global'}</span> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" loading={deleting === r.id} onClick={() => handleDelete(r.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Size Guides" description="Manage garment measurement matrices and fit notes shown on product detail pages." actions={<Button onClick={openCreate}>+ Add Size Guide</Button>} />
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : guides.length === 0 ? (
          <EmptyState title="No size guides yet" description="Create a size guide to help customers choose the right fit." action={<Button onClick={openCreate}>Add Size Guide</Button>} />
        ) : (
          <DataTable columns={columns} data={guides} />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Size Guide' : 'New Size Guide'} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Guide Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: editing ? f.slug : autoSlug(e.target.value) }))}
              placeholder="Italian Tailoring Size Matrix"
            />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
          </div>
          <Select label="Assigned Category" value={form.categorySlug} onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))}>
            <option value="">All Categories (Global)</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </Select>
          <Textarea label="Fit & Atelier Notes (one per line)" rows={3} value={form.notesText} onChange={(e) => setForm((f) => ({ ...f, notesText: e.target.value }))} />
          <Textarea label="Measurement Tables (JSON)" rows={8} className="font-mono text-xs" value={form.tablesJson} onChange={(e) => setForm((f) => ({ ...f, tablesJson: e.target.value }))} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editing ? 'Save Changes' : 'Create Guide'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
