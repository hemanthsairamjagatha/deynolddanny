import { useState, useEffect } from 'react';
import { collections as colApi, products as productsApi } from '../../lib/api';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { ImageUrlField } from '../../components/MediaPickerModal';

interface NormalizedCollection {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  heroImage: string;
  isActive: boolean;
  productCount: number;
}

export default function CollectionsPage() {
  const [cols, setCols] = useState<NormalizedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', eyebrow: 'Curated Capsule', description: '', heroImage: '/images/category-abiti.jpg', isActive: true });
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const load = () => {
    setLoading(true);
    colApi
      .list()
      .then((r) => {
        if (r.success && r.data) {
          const raw = r.data as unknown;
          const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
          setCols(
            arr.map((c) => ({
              id: String(c.id ?? ''),
              slug: String(c.slug ?? c.handle ?? ''),
              title: String(c.title ?? ''),
              eyebrow: String(c.eyebrow ?? 'Curated Capsule'),
              description: String(c.description ?? ''),
              heroImage: String(c.heroImage ?? c.hero_image ?? ''),
              isActive: Boolean(c.isActive ?? c.is_active ?? true),
              productCount: Number(c.productCount ?? c.product_count ?? 0),
            })),
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const openAssign = async (id: string) => {
    setAssignTarget(id);
    const [pRes, colRes] = await Promise.all([productsApi.list({ status: 'active' }), colApi.get(id)]);
    if (pRes.success && pRes.data) setProducts((pRes.data.items ?? []) as Record<string, unknown>[]);
    if (colRes.success && colRes.data) {
      const existingProds = ((colRes.data as { products?: Array<{ id: string }> }).products ?? []).map((p) => p.id);
      setSelectedProductIds(existingProds);
    } else {
      setSelectedProductIds([]);
    }
    setAssignModal(true);
  };

  const saveCollection = async () => {
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        eyebrow: form.eyebrow.trim() || 'Curated Capsule',
        description: form.description.trim(),
        heroImage: form.heroImage.trim() || '/images/category-abiti.jpg',
        isActive: form.isActive ? 1 : 0,
      };
      const res = editId ? await colApi.update(editId, payload) : await colApi.create(payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Save failed');
        return;
      }
      setModal(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const saveAssign = async () => {
    if (!assignTarget) return;
    await colApi.assignProducts(assignTarget, selectedProductIds);
    setAssignModal(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this collection?')) return;
    await colApi.delete(id);
    load();
  };

  const columns: Column<NormalizedCollection>[] = [
    {
      key: 'title',
      header: 'Collection',
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.heroImage && <img src={c.heroImage} alt="" className="w-10 h-10 rounded-lg object-cover border border-ink-200 bg-ink-50" />}
          <div>
            <p className="font-medium text-ink-900">{c.title}</p>
            <p className="text-xs text-ink-500">{c.eyebrow}</p>
          </div>
        </div>
      ),
    },
    { key: 'slug', header: 'Handle', render: (c) => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">/collections/{c.slug}</code> },
    { key: 'productCount', header: 'Pieces', render: (c) => <span className="text-xs text-ink-600">{c.productCount}</span> },
    { key: 'isActive', header: 'Status', render: (c) => <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setForm({ title: c.title, slug: c.slug, eyebrow: c.eyebrow, description: c.description, heroImage: c.heroImage, isActive: c.isActive });
              setEditId(c.id);
              setError('');
              setModal(true);
            }}
          >
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAssign(c.id)}>
            Assign Products
          </Button>
          <Button size="sm" variant="ghost" onClick={() => del(c.id)} className="text-red-500 hover:bg-red-50">
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Curated product collections for seasonal campaigns and editorial features."
        actions={
          <Button
            onClick={() => {
              setForm({ title: '', slug: '', eyebrow: 'Curated Capsule', description: '', heroImage: '/images/category-abiti.jpg', isActive: true });
              setEditId(null);
              setError('');
              setModal(true);
            }}
          >
            + New Collection
          </Button>
        }
      />
      <Card padding={false}>
        <DataTable columns={columns} data={cols} loading={loading} emptyTitle="No collections yet" />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Edit Collection' : 'Create Collection'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={saveCollection}>
              Save Collection
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: editId ? f.slug : autoSlug(e.target.value) }))} />
          <Input label="Handle (Slug)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
          <Input label="Eyebrow" value={form.eyebrow} onChange={(e) => setForm((f) => ({ ...f, eyebrow: e.target.value }))} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
          <ImageUrlField label="Hero Banner Image" value={form.heroImage} onChange={(url) => setForm((f) => ({ ...f, heroImage: url }))} />
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-gold-500" />
            Active (visible to customers)
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={assignModal}
        onClose={() => setAssignModal(false)}
        title="Assign Products to Collection"
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveAssign}>Save Assignment</Button>
          </>
        }
      >
        <p className="text-sm text-ink-500 mb-3">Select products to include in this collection.</p>
        <div className="space-y-1 max-h-80 overflow-y-auto border border-ink-200 rounded-xl p-3">
          {products.map((p) => (
            <label key={String(p.id)} className="flex items-center gap-3 p-2 hover:bg-ink-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProductIds.includes(String(p.id))}
                onChange={(e) =>
                  setSelectedProductIds((ids) => (e.target.checked ? [...ids, String(p.id)] : ids.filter((id) => id !== String(p.id))))
                }
                className="accent-gold-500"
              />
              <span className="text-sm text-ink-900">{String(p.title ?? p.name ?? '')}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-500 mt-2">{selectedProductIds.length} selected</p>
      </Modal>
    </div>
  );
}
