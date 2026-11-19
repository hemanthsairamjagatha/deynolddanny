import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Input, Textarea, Select, Card, Badge, Tabs, Spinner, Modal } from '../../components/ui';
import { ImageUrlField, MediaPickerModal } from '../../components/MediaPickerModal';

interface CatOption {
  id: string;
  title: string;
}

interface VariantRow {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  price_paise: number;
  stock: number;
  reserved: number;
  is_active: number;
}

function fmt(paise: number) {
  return (paise / 100).toFixed(2);
}

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [categories, setCategories] = useState<CatOption[]>([]);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    sku_prefix: '',
    category_id: '',
    priceRupees: '',
    compareRupees: '',
    badge: '',
    section_group: 'mastery',
    gender: 'Men',
    default_img: '/images/mastery-1-model.jpg',
    hover_img: '/images/mastery-1-product.jpg',
    description: '',
    material: '',
    care_guide: '',
    hsn_code: '6203',
    gst_rate_bps: 1200,
    is_active: 1,
    is_featured: 0,
  });
  const [gallery, setGallery] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantModal, setVariantModal] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [variantForm, setVariantForm] = useState({ sku: '', color: 'Black', color_hex: '#111111', size: 'M', price: '', stock: '5' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    catsApi.list().then((r) => {
      if (r.success && r.data) {
        const raw = r.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setCategories(arr.map((c) => ({ id: String(c.id ?? ''), title: String(c.title ?? c.name ?? '') })));
      }
    });

    if (!isNew && id) {
      productsApi
        .get(id)
        .then((res) => {
          if (res.success && res.data) {
            const p = res.data as Record<string, unknown>;
            setForm({
              title: String(p.title ?? p.name ?? ''),
              slug: String(p.slug ?? ''),
              sku_prefix: String(p.sku_prefix ?? ''),
              category_id: String(p.category_id ?? ''),
              priceRupees: p.price_paise ? String(Number(p.price_paise) / 100) : '',
              compareRupees: p.compare_paise ? String(Number(p.compare_paise) / 100) : '',
              badge: String(p.badge ?? ''),
              section_group: String(p.section_group ?? 'mastery'),
              gender: String(p.gender ?? 'Men'),
              default_img: String(p.default_img ?? ''),
              hover_img: String(p.hover_img ?? ''),
              description: String(p.description ?? ''),
              material: String(p.material ?? ''),
              care_guide: String(p.care_guide ?? ''),
              hsn_code: String(p.hsn_code ?? '6203'),
              gst_rate_bps: Number(p.gst_rate_bps ?? 1200),
              is_active: Number(p.is_active ?? 1),
              is_featured: Number(p.is_featured ?? 0),
            });
            setVariants((p.variants ?? []) as VariantRow[]);
            const imgs = (p.images ?? []) as Array<string | { url?: string; image_url?: string }>;
            setGallery(imgs.map((x) => (typeof x === 'string' ? x : String(x.url ?? x.image_url ?? ''))).filter(Boolean));
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id, isNew]);

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const autoSku = (name: string) =>
    'DD-' +
    name
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toUpperCase()
      .slice(0, 6);

  const save = async () => {
    setError('');
    setNotice('');
    const pricePaise = Math.round(parseFloat(form.priceRupees || '0') * 100);
    if (!form.title.trim() || !form.slug.trim() || pricePaise <= 0) {
      setError('Product Title, URL Slug, and a positive Price (₹) are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        sku_prefix: form.sku_prefix.trim() || autoSku(form.title),
        category_id: form.category_id || null,
        price_paise: pricePaise,
        compare_paise: form.compareRupees ? Math.round(parseFloat(form.compareRupees) * 100) : null,
        badge: form.badge.trim() || null,
        section_group: form.section_group,
        gender: form.gender,
        default_img: form.default_img.trim() || '/images/mastery-1-model.jpg',
        hover_img: form.hover_img.trim() || form.default_img.trim() || '/images/mastery-1-product.jpg',
        description: form.description,
        material: form.material,
        care_guide: form.care_guide,
        hsn_code: form.hsn_code || '6203',
        gst_rate_bps: Number(form.gst_rate_bps) || 1200,
        is_active: form.is_active ? 1 : 0,
        is_featured: form.is_featured ? 1 : 0,
      };

      const res = isNew ? await productsApi.create(payload) : await productsApi.update(id!, payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Save failed');
        return;
      }
      if (isNew && res.data?.id) {
        navigate(`/catalog/products/${String(res.data.id)}`);
      } else {
        setNotice('Product saved live and catalog cache refreshed!');
      }
    } finally {
      setSaving(false);
    }
  };

  const addVariant = async () => {
    if (!id || !variantForm.sku.trim()) return;
    const pricePaise = Math.round(parseFloat(variantForm.price || form.priceRupees || '0') * 100);
    const res = await productsApi.variants.create(id, {
      sku: variantForm.sku.trim(),
      color: variantForm.color || 'Black',
      color_hex: variantForm.color_hex || '#111111',
      size: variantForm.size || 'M',
      price_paise: pricePaise,
      stock: parseInt(variantForm.stock || '0', 10),
    });
    if (!res.success) {
      setError(res.error?.message ?? 'Failed to add variant.');
      return;
    }
    const fresh = await productsApi.get(id);
    if (fresh.success && fresh.data) setVariants((fresh.data.variants ?? []) as VariantRow[]);
    setVariantModal(false);
    setVariantForm({ sku: '', color: 'Black', color_hex: '#111111', size: 'M', price: form.priceRupees, stock: '5' });
    setNotice('Variant added.');
  };

  const deleteVariant = async (vid: string) => {
    if (!id || !confirm('Delete this variant?')) return;
    await productsApi.variants.delete(id, vid);
    setVariants((v) => v.filter((x) => x.id !== vid));
  };

  const saveGallery = async (next: string[]) => {
    setGallery(next);
    if (!isNew && id) {
      await productsApi.updateImages(
        id,
        next.map((url, idx) => ({ url, alt_text: form.title, sort_order: idx })),
      );
      setNotice('Gallery image order saved.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Product' : form.title || 'Edit Product'}
        description={isNew ? 'Add a new piece to the Deynold Danny catalogue.' : `Editing product · /products/${form.slug}`}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/catalog/products')}>
              Back
            </Button>
            <Button loading={saving} onClick={save}>
              {isNew ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {notice && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'details', label: 'Details & Pricing' },
          { id: 'variants', label: `Variants & Stock (${variants.length})` },
          { id: 'images', label: `Images (${gallery.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'details' && (
        <div className="max-w-3xl space-y-5">
          <Card className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Product Title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    title: e.target.value,
                    slug: isNew ? autoSlug(e.target.value) : f.slug,
                    sku_prefix: isNew && !f.sku_prefix ? autoSku(e.target.value) : f.sku_prefix,
                  }))
                }
                required
              />
            </div>
            <Input label="URL Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
            <Input label="SKU Prefix" value={form.sku_prefix} onChange={(e) => setForm((f) => ({ ...f, sku_prefix: e.target.value.toUpperCase() }))} placeholder="DD-SUIT" />
            <Input label="Price (INR ₹)" type="number" step="0.01" value={form.priceRupees} onChange={(e) => setForm((f) => ({ ...f, priceRupees: e.target.value }))} required />
            <Input label="Compare / MRP Price (₹, optional)" type="number" step="0.01" value={form.compareRupees} onChange={(e) => setForm((f) => ({ ...f, compareRupees: e.target.value }))} />
            <Select
              label="Category"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              options={[{ value: '', label: 'Select category…' }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
            />
            <Select
              label="Homepage Placement"
              value={form.section_group}
              onChange={(e) => setForm((f) => ({ ...f, section_group: e.target.value }))}
              options={[
                { value: 'mastery', label: 'Best Sellers (Mastery)' },
                { value: 'style_space', label: 'New Arrivals (Style Space)' },
                { value: 'news', label: 'Editorial / News' },
              ]}
            />
            <Input label="Badge (optional, e.g. NEW)" value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} />
            <Select
              label="Status"
              value={String(form.is_active)}
              onChange={(e) => setForm((f) => ({ ...f, is_active: Number(e.target.value) }))}
              options={[
                { value: '1', label: 'Active (Live on Storefront)' },
                { value: '0', label: 'Archived (Hidden)' },
              ]}
            />
            <div className="sm:col-span-2">
              <ImageUrlField label="Primary Card Image" value={form.default_img} onChange={(url) => setForm((f) => ({ ...f, default_img: url }))} />
            </div>
            <div className="sm:col-span-2">
              <ImageUrlField label="Hover / Studio Image" value={form.hover_img} onChange={(url) => setForm((f) => ({ ...f, hover_img: url }))} />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <Textarea label="Product Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} />
            <Input label="Material & Composition" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} placeholder="100% Virgin Wool" />
            <Textarea label="Care Instructions" value={form.care_guide} onChange={(e) => setForm((f) => ({ ...f, care_guide: e.target.value }))} rows={2} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="HSN Code (GST)" value={form.hsn_code} onChange={(e) => setForm((f) => ({ ...f, hsn_code: e.target.value }))} />
              <Input label="GST Rate (bps, e.g. 1200 = 12%)" type="number" value={String(form.gst_rate_bps)} onChange={(e) => setForm((f) => ({ ...f, gst_rate_bps: Number(e.target.value) }))} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'variants' && (
        <div className="max-w-4xl">
          <Card padding={false}>
            <div className="p-4 border-b border-ink-100 flex justify-between items-center">
              <p className="text-sm font-semibold text-ink-900">Product Variants (Sizes, Colours &amp; Stock)</p>
              <Button size="sm" onClick={() => setVariantModal(true)} disabled={isNew}>
                + Add Variant
              </Button>
            </div>
            {isNew && <p className="p-6 text-sm text-ink-500 text-center">Create the product first, then add size/colour variants.</p>}
            {!isNew && variants.length === 0 && <p className="p-6 text-sm text-ink-500 text-center">No variants yet. Add your first size/colour variant.</p>}
            {variants.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-50 border-b border-ink-200">
                    {['SKU', 'Color', 'Size', 'Price', 'Available Stock', 'Status', ''].map((h) => (
                      <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {variants.map((v) => (
                    <tr key={v.id} className="hover:bg-ink-50/50">
                      <td className="py-3 px-4 font-mono text-xs text-ink-700">{v.sku}</td>
                      <td className="py-3 px-4 text-ink-800">{v.color ?? '—'}</td>
                      <td className="py-3 px-4 text-ink-800">{v.size ?? '—'}</td>
                      <td className="py-3 px-4 font-medium text-ink-900">₹ {fmt(v.price_paise || Number(form.priceRupees) * 100)}</td>
                      <td className="py-3 px-4 text-ink-800">{v.stock - (v.reserved ?? 0)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={v.is_active ? 'success' : 'default'}>{v.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => deleteVariant(v.id)} className="text-red-500 hover:bg-red-50">
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Modal
            open={variantModal}
            onClose={() => setVariantModal(false)}
            title="Add Size / Colour Variant"
            footer={
              <>
                <Button variant="outline" onClick={() => setVariantModal(false)}>
                  Cancel
                </Button>
                <Button onClick={addVariant}>Add Variant</Button>
              </>
            }
          >
            <div className="space-y-3">
              <Input label="SKU" value={variantForm.sku} onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder={`${form.sku_prefix || 'DD'}-BLK-M`} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Colour Name" value={variantForm.color} onChange={(e) => setVariantForm((f) => ({ ...f, color: e.target.value }))} />
                <Input label="Size" value={variantForm.size} onChange={(e) => setVariantForm((f) => ({ ...f, size: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Variant Price (₹)" type="number" step="0.01" value={variantForm.price} onChange={(e) => setVariantForm((f) => ({ ...f, price: e.target.value }))} placeholder={form.priceRupees} />
                <Input label="Initial Stock" type="number" value={variantForm.stock} onChange={(e) => setVariantForm((f) => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'images' && (
        <div className="max-w-3xl">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">Product Gallery Images</p>
                <p className="text-xs text-ink-500">Pick from your Media Library or upload directly — zero URL typing required.</p>
              </div>
              <Button size="sm" onClick={() => setGalleryPickerOpen(true)} disabled={isNew}>
                + Add / Upload Image
              </Button>
            </div>
            {isNew && <p className="text-sm text-ink-500 mb-4">Create the product first, then add gallery images.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {gallery.map((url, i) => (
                <div key={i} className="relative group aspect-[3/4] rounded-xl overflow-hidden border border-ink-200 bg-ink-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-ink-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => saveGallery(gallery.filter((_, j) => j !== i))} className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {!isNew && (
                <button
                  onClick={() => setGalleryPickerOpen(true)}
                  className="aspect-[3/4] rounded-xl border-2 border-dashed border-ink-300 hover:border-gold-400 transition-colors flex flex-col items-center justify-center text-ink-400 hover:text-gold-600 gap-1"
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">Browse / Upload</span>
                </button>
              )}
            </div>
          </Card>

          <MediaPickerModal
            open={galleryPickerOpen}
            onClose={() => setGalleryPickerOpen(false)}
            title="Add Product Gallery Image"
            onSelect={(asset) => saveGallery([...gallery, asset.url])}
          />
        </div>
      )}
    </div>
  );
}
