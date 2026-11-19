import { useState, useEffect } from 'react';
import { categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { ImageUrlField } from '../../components/MediaPickerModal';

interface NormalizedCategory {
  id: string;
  slug: string;
  title: string;
  heroTitle: string;
  eyebrow: string;
  subtitle: string;
  tagline: string;
  imageUrl: string;
  mobileImage: string;
  focalX: number;
  focalY: number;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

const EMPTY_FORM = {
  title: '',
  slug: '',
  heroTitle: '',
  eyebrow: '',
  subtitle: '',
  tagline: 'SCOPRI ORA',
  imageUrl: '/images/category-abiti.jpg',
  mobileImage: '',
  focalX: 50,
  focalY: 35,
  sortOrder: 0,
  isActive: true,
};

export default function CategoriesPage() {
  const [cats, setCats] = useState<NormalizedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    catsApi
      .list()
      .then((r) => {
        if (r.success && r.data) {
          const raw = r.data as unknown;
          const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
          setCats(
            arr.map((c) => ({
              id: String(c.id ?? ''),
              slug: String(c.slug ?? ''),
              title: String(c.title ?? c.name ?? ''),
              heroTitle: String(c.heroTitle ?? c.hero_title ?? c.title ?? ''),
              eyebrow: String(c.eyebrow ?? ''),
              subtitle: String(c.subtitle ?? c.description ?? ''),
              tagline: String(c.tagline ?? 'SCOPRI ORA'),
              imageUrl: String(c.imageUrl ?? c.image_url ?? ''),
              mobileImage: String(c.mobileImage ?? c.mobile_image ?? ''),
              focalX: Number(c.focalX ?? c.focal_x ?? 50),
              focalY: Number(c.focalY ?? c.focal_y ?? 35),
              sortOrder: Number(c.sortOrder ?? c.sort_order ?? 0),
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

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setError('');
    setModal(true);
  };
  const openEdit = (c: NormalizedCategory) => {
    setForm({
      title: c.title,
      slug: c.slug,
      heroTitle: c.heroTitle,
      eyebrow: c.eyebrow,
      subtitle: c.subtitle,
      tagline: c.tagline,
      imageUrl: c.imageUrl,
      mobileImage: c.mobileImage,
      focalX: c.focalX,
      focalY: c.focalY,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    });
    setEditId(c.id);
    setError('');
    setModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        heroTitle: form.heroTitle.trim() || form.title.trim(),
        eyebrow: form.eyebrow.trim() || null,
        subtitle: form.subtitle.trim() || null,
        tagline: form.tagline.trim() || 'SCOPRI ORA',
        imageUrl: form.imageUrl.trim() || '/images/category-abiti.jpg',
        mobileImage: form.mobileImage.trim() || form.imageUrl.trim() || '/images/category-abiti.jpg',
        focalX: Math.round(form.focalX),
        focalY: Math.round(form.focalY),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive ? 1 : 0,
      };
      const res = editId ? await catsApi.update(editId, payload) : await catsApi.create(payload);
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

  const del = async (id: string) => {
    if (!confirm('Archive this category?')) return;
    await catsApi.delete(id);
    load();
  };

  const cols: Column<NormalizedCategory>[] = [
    {
      key: 'title',
      header: 'Category',
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.imageUrl && <img src={c.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-ink-200 bg-ink-50" />}
          <div>
            <p className="font-medium text-ink-900">{c.title}</p>
            <p className="text-xs text-ink-500 truncate max-w-xs">{c.subtitle || c.heroTitle}</p>
          </div>
        </div>
      ),
    },
    { key: 'slug', header: 'Route', render: (c) => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">/categories/{c.slug}</code> },
    { key: 'productCount', header: 'Products', render: (c) => <span className="text-xs text-ink-600">{c.productCount}</span> },
    { key: 'isActive', header: 'Status', render: (c) => <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Archived'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => del(c.id)} className="text-red-500 hover:bg-red-50">
            Archive
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage product browsing categories, hero headlines, and imagery."
        actions={<Button onClick={openCreate}>+ New Category</Button>}
      />
      <Card padding={false}>
        <DataTable columns={cols} data={cats} loading={loading} emptyTitle="No categories yet" />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Edit Category' : 'Create Category'}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save Category
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Category Name"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: editId ? f.slug : autoSlug(e.target.value) }))}
          />
          <Input label="URL Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
          <Input label="Hero Banner Title" value={form.heroTitle} onChange={(e) => setForm((f) => ({ ...f, heroTitle: e.target.value }))} />
          <Input label="Eyebrow Label" value={form.eyebrow} onChange={(e) => setForm((f) => ({ ...f, eyebrow: e.target.value }))} placeholder="COLLECTION" />
          <div className="sm:col-span-2">
            <Textarea label="Subtitle / Description" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} rows={2} />
          </div>
          <div className="sm:col-span-2">
            <ImageUrlField label="Category Cover Image" value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
          </div>
          <div className="sm:col-span-2">
            <ImageUrlField label="Mobile Image (Optional)" value={form.mobileImage} onChange={(url) => setForm((f) => ({ ...f, mobileImage: url }))} />
          </div>
          <Input label="Sort Order" type="number" value={String(form.sortOrder)} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-700 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-gold-500" />
              Active (visible on storefront)
            </label>
          </div>
          {error && <p className="sm:col-span-2 text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
