import { useState, useEffect, useMemo } from 'react';
import { categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Card, DataTable, Modal, Input, Textarea, Badge, SearchBar } from '../../components/ui';
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
  seoTitle: string;
  seoDescription: string;
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
  seoTitle: '',
  seoDescription: '',
};

export default function CategoriesPage() {
  const [cats, setCats] = useState<NormalizedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
            arr.map((c) => {
              const seo = (c.seo ?? {}) as Record<string, unknown>;
              return {
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
                seoTitle: String(seo.title ?? ''),
                seoDescription: String(seo.description ?? ''),
              };
            }),
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const filteredCats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q),
    );
  }, [cats, search]);

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
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
    });
    setEditId(c.id);
    setError('');
    setModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        heroTitle: form.heroTitle.trim() || form.title.trim(),
        eyebrow: form.eyebrow.trim() || null,
        subtitle: form.subtitle.trim() || null,
        tagline: form.tagline.trim() || 'SCOPRI ORA',
        imageUrl: form.imageUrl.trim(),
        mobileImage: form.mobileImage.trim(),
        focalX: Math.round(form.focalX),
        focalY: Math.round(form.focalY),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive ? 1 : 0,
        seo: {
          ...(form.seoTitle.trim() ? { title: form.seoTitle.trim() } : {}),
          ...(form.seoDescription.trim() ? { description: form.seoDescription.trim() } : {}),
        },
      };
      const res = editId ? await catsApi.update(editId, payload) : await catsApi.create(payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Save failed');
        return;
      }
      setModal(false);
      setNotice(editId ? 'Category updated live.' : 'Category created live.');
      load();
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm('Archive this category?')) return;
    await catsApi.delete(id);
    setNotice('Category archived.');
    load();
  };

  const restore = async (id: string) => {
    await catsApi.restore(id);
    setNotice('Category restored live.');
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
    {
      key: 'slug',
      header: 'Route',
      render: (c) => (
        <a
          href={`/categories/${c.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs bg-ink-100 hover:bg-ink-900 hover:text-white px-2 py-0.5 rounded transition-colors font-mono"
        >
          /categories/{c.slug} ↗
        </a>
      ),
    },
    { key: 'productCount', header: 'Products', render: (c) => <span className="text-xs text-ink-600">{c.productCount}</span> },
    { key: 'isActive', header: 'Status', render: (c) => <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Archived'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex gap-2 justify-end">
          <a
            href={`/categories/${c.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-xs font-medium text-ink-700 border border-ink-200 rounded-lg hover:border-ink-900 transition-colors"
          >
            View Live ↗
          </a>
          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
            Edit
          </Button>
          {c.isActive ? (
            <Button size="sm" variant="ghost" onClick={() => del(c.id)} className="text-red-500 hover:bg-red-50">
              Archive
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => restore(c.id)} className="text-emerald-600 hover:bg-emerald-50">
              Restore
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage product browsing categories, hero headlines, SEO metadata, and imagery."
        actions={<Button onClick={openCreate}>+ New Category</Button>}
      />
      {notice && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2.5 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">Dismiss</button>
        </div>
      )}
      <div className="mb-4 max-w-sm">
        <SearchBar value={search} onChange={setSearch} placeholder="Search categories by name or slug…" />
      </div>
      <Card padding={false}>
        <DataTable columns={cols} data={filteredCats} loading={loading} emptyTitle="No categories yet" />
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
          <Input label="SEO Meta Title (Optional)" value={form.seoTitle} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} placeholder="Luxury Shirts | DEYNOLD DANNY" />
          <Input label="Sort Order" type="number" value={String(form.sortOrder)} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
          <div className="sm:col-span-2">
            <Textarea label="SEO Meta Description (Optional)" value={form.seoDescription} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))} rows={2} placeholder="Tailored luxury collection…" />
          </div>
          <div className="sm:col-span-2 flex items-end pb-1">
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
