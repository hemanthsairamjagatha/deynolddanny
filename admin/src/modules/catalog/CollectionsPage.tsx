import { useState, useEffect } from 'react';
import { collections as colApi, products as productsApi } from '../../lib/api';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Badge, statusVariant, Spinner } from '../../components/ui';
import type { Column } from '../../components/ui';

type Collection = Record<string, unknown>;

export default function CollectionsPage() {
  const [cols, setCols] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', handle: '', description: '', is_active: true });
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const load = () => {
    setLoading(true);
    colApi.list().then(r => { if (r.success && r.data) setCols(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const openAssign = async (id: string) => {
    setAssignTarget(id);
    const res = await productsApi.list({ status: 'active' });
    if (res.success && res.data) setProducts(res.data.items as unknown as Record<string, unknown>[]);
    setAssignModal(true);
  };

  const saveCollection = async () => {
    setSaving(true);
    if (editId) await colApi.update(editId, form);
    else await colApi.create(form);
    setModal(false);
    load();
    setSaving(false);
  };

  const saveAssign = async () => {
    if (!assignTarget) return;
    await colApi.assignProducts(assignTarget, selectedProductIds);
    setAssignModal(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this collection?')) return;
    await colApi.delete(id);
    load();
  };

  const columns: Column<Collection>[] = [
    { key: 'title', header: 'Title', render: c => <span className="font-medium text-ink-900">{c.title as string}</span> },
    { key: 'handle', header: 'Handle', render: c => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">{c.handle as string}</code> },
    { key: 'is_active', header: 'Status', render: c => <Badge variant={(c.is_active as number) ? 'success' : 'default'}>{(c.is_active as number) ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', header: '', render: c => (
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => { setForm({ title: c.title as string, handle: c.handle as string, description: (c.description as string) ?? '', is_active: Boolean(c.is_active) }); setEditId(c.id as string); setModal(true); }}>Edit</Button>
        <Button size="sm" variant="outline" onClick={() => openAssign(c.id as string)}>Assign Products</Button>
        <Button size="sm" variant="ghost" onClick={() => del(c.id as string)} className="text-red-500 hover:bg-red-50">Delete</Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Collections" description="Curated product collections for campaigns and editorial features." actions={<Button onClick={() => { setForm({ title: '', handle: '', description: '', is_active: true }); setEditId(null); setModal(true); }}>+ New Collection</Button>} />
      <Card padding={false}><DataTable columns={columns} data={cols} loading={loading} emptyTitle="No collections yet" /></Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Collection' : 'Create Collection'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancel</Button><Button loading={saving} onClick={saveCollection}>Save</Button></>}>
        <Input label="Title" value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value, handle: editId ? f.handle : autoSlug(e.target.value) })); }} tooltip="Public collection name shown on the storefront." />
        <Input label="Handle (Slug)" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} tooltip="URL path for the collection, e.g. /collections/summer-24" />
        <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} tooltip="Short editorial description of this collection." />
        <label className="flex items-center gap-2 text-sm font-medium text-ink-700 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="accent-gold-500" />
          Active (visible to customers)
        </label>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Products" wide
        footer={<><Button variant="outline" onClick={() => setAssignModal(false)}>Cancel</Button><Button onClick={saveAssign}>Save Assignment</Button></>}>
        <p className="text-sm text-ink-500 mb-3">Select products to include in this collection.</p>
        <div className="space-y-1 max-h-80 overflow-y-auto border border-ink-200 rounded-xl p-3">
          {products.map(p => (
            <label key={p.id as string} className="flex items-center gap-3 p-2 hover:bg-ink-50 rounded-lg cursor-pointer">
              <input type="checkbox" checked={selectedProductIds.includes(p.id as string)} onChange={e => setSelectedProductIds(ids => e.target.checked ? [...ids, p.id as string] : ids.filter(id => id !== p.id as string))} className="accent-gold-500" />
              <span className="text-sm text-ink-900">{p.name as string}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-500 mt-2">{selectedProductIds.length} selected</p>
      </Modal>
    </div>
  );
}
