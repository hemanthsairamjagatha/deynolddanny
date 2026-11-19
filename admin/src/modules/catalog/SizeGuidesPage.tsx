import React, { useEffect, useState } from 'react';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Select, Badge, Spinner, InfoTooltip, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { sizeGuides, categories as categoriesApi } from '../../lib/api';
import type { SizeGuide, Category } from '../../lib/types';

export default function SizeGuidesPage() {
  const [guides, setGuides] = useState<SizeGuide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SizeGuide | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category_id: '', unit_system: 'metric', size_data_json: '[]' });
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([sizeGuides.list(), categoriesApi.list()]);
      const gRaw = gRes.data as unknown;
      const cRaw = cRes.data as unknown;
      setGuides((Array.isArray(gRaw) ? gRaw : (gRaw as { items?: SizeGuide[] })?.items ?? []) as SizeGuide[]);
      setCategories((Array.isArray(cRaw) ? cRaw : (cRaw as { categories?: Category[] })?.categories ?? []) as Category[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', category_id: '', unit_system: 'metric', size_data_json: '[]' });
    setError('');
    setModalOpen(true);
  }

  function openEdit(g: SizeGuide) {
    setEditing(g);
    setForm({ name: g.name, category_id: g.category_id ?? '', unit_system: g.unit_system ?? 'metric', size_data_json: JSON.stringify(g.size_data ?? [], null, 2) });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setError('');
    let parsed;
    try { parsed = JSON.parse(form.size_data_json); } catch { setError('Size data must be valid JSON.'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, category_id: form.category_id, unit_system: form.unit_system, size_data: parsed };
      if (editing) await sizeGuides.update(editing.id, payload);
      else await sizeGuides.create(payload);
      setModalOpen(false);
      load();
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this size guide? This cannot be undone.')) return;
    setDeleting(id);
    try { await sizeGuides.delete(id); load(); } finally { setDeleting(null); }
  }

  const columns: Column<SizeGuide>[] = [
    { key: 'name', header: 'Name', render: r => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'category', header: 'Category', render: r => <span className="text-ink-500">{categories.find(c => c.id === r.category_id)?.name ?? '—'}</span> },
    { key: 'unit_system', header: 'Unit System', render: r => <Badge variant="default">{r.unit_system ?? 'metric'}</Badge> },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" loading={deleting === r.id} onClick={() => handleDelete(r.id)}>Delete</Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Size Guides" description="Manage garment size charts shown on product pages." actions={<Button onClick={openCreate}>+ Add Size Guide</Button>} />
      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : guides.length === 0 ? <EmptyState title="No size guides yet" description="Create a size guide to help customers find the right fit." action={<Button onClick={openCreate}>Add Size Guide</Button>} /> : <DataTable columns={columns} data={guides} />}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Size Guide' : 'New Size Guide'}>
        <div className="space-y-4">
          <div>
            <label className="label-sm flex items-center gap-1">Name <InfoTooltip content="Display name for this size guide, e.g. 'Trousers & Chinos'" /></label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tailored Trousers" />
          </div>
          <div>
            <label className="label-sm flex items-center gap-1">Category <InfoTooltip content="Restrict this guide to a specific product category, or leave blank for global." /></label>
            <Select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="label-sm flex items-center gap-1">Unit System <InfoTooltip content="Metric = cm; Imperial = inches; Both = show both columns." /></label>
            <Select value={form.unit_system} onChange={e => setForm(f => ({ ...f, unit_system: e.target.value }))}>
              <option value="metric">Metric (cm)</option>
              <option value="imperial">Imperial (in)</option>
              <option value="both">Both</option>
            </Select>
          </div>
          <div>
            <label className="label-sm flex items-center gap-1">Size Data (JSON) <InfoTooltip content='JSON array of size rows. Each row: { "label": "S", "chest": 36, "waist": 30, "hips": 38, "length": 29 }' /></label>
            <Textarea value={form.size_data_json} onChange={e => setForm(f => ({ ...f, size_data_json: e.target.value }))} rows={8} className="font-mono text-xs" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editing ? 'Save Changes' : 'Create Guide'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
