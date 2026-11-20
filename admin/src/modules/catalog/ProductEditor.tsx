import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Input, Textarea, Select, Card, Badge, Tabs, Spinner, Modal, InfoTooltip } from '../../components/ui';
import { ImageUrlField, MediaPickerModal } from '../../components/MediaPickerModal';

interface CatOption {
  id: string;
  title: string;
}

interface VariantRow {
  id: string;
  sku: string;
  color_name?: string | null;
  color?: string | null;
  color_hex?: string | null;
  size: string;
  price_paise?: number | null;
  compare_paise?: number | null;
  stock: number;
  reserved_stock?: number;
  reserved?: number;
  is_active: number;
}

interface VariantEditDraft {
  priceRupees: string;
  compareRupees: string;
  stock: string;
  is_active: 0 | 1;
  dirty?: boolean;
}

function fmt(paise: number) {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savingVariants, setSavingVariants] = useState(false);
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
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantEditDraft>>({});
  const [bulkSizePrices, setBulkSizePrices] = useState<Record<string, string>>({});

  // Single Variant Modal
  const [variantModal, setVariantModal] = useState(false);
  const [variantForm, setVariantForm] = useState({
    sku: '',
    color_name: 'Black',
    color_hex: '#111111',
    size: 'M',
    priceRupees: '',
    compareRupees: '',
    stock: '5',
  });

  // Bulk Matrix Generator Modal
  const [matrixModal, setMatrixModal] = useState(false);
  const [matrixSizesInput, setMatrixSizesInput] = useState('S, M, L, XL, XXL');
  const [matrixColors, setMatrixColors] = useState<Array<{ name: string; hex: string }>>([
    { name: 'Black', hex: '#111111' },
  ]);
  const [matrixStock, setMatrixStock] = useState('5');
  const [matrixSizePrices, setMatrixSizePrices] = useState<Record<string, string>>({});

  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const hydrateVariants = (rows: VariantRow[]) => {
    setVariants(rows);
    const nextDrafts: Record<string, VariantEditDraft> = {};
    for (const v of rows) {
      nextDrafts[v.id] = {
        priceRupees: v.price_paise != null ? String(v.price_paise / 100) : '',
        compareRupees: v.compare_paise != null ? String(v.compare_paise / 100) : '',
        stock: String(v.stock ?? 0),
        is_active: v.is_active ? 1 : 0,
        dirty: false,
      };
    }
    setVariantDrafts(nextDrafts);
  };

  const reloadProduct = async (productId: string) => {
    const res = await productsApi.get(productId);
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
      hydrateVariants((p.variants ?? []) as VariantRow[]);
      const imgs = (p.images ?? []) as Array<string | { url?: string; image_url?: string }>;
      setGallery(imgs.map((x) => (typeof x === 'string' ? x : String(x.url ?? x.image_url ?? ''))).filter(Boolean));
    }
  };

  useEffect(() => {
    catsApi.list().then((r) => {
      if (r.success && r.data) {
        const raw = r.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setCategories(arr.map((c) => ({ id: String(c.id ?? ''), title: String(c.title ?? c.name ?? '') })));
      }
    });

    if (!isNew && id) {
      reloadProduct(id).finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const distinctSizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size))), [variants]);
  const parsedMatrixSizes = useMemo(
    () =>
      Array.from(
        new Set(
          matrixSizesInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    [matrixSizesInput],
  );
  const dirtyCount = useMemo(
    () => Object.values(variantDrafts).filter((d) => d.dirty).length,
    [variantDrafts],
  );

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
      setError('Product Title, URL Slug, and a positive Base Price (₹) are required.');
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

  const updateDraft = (vid: string, patch: Partial<VariantEditDraft>) => {
    setVariantDrafts((prev) => ({
      ...prev,
      [vid]: { ...(prev[vid] ?? { priceRupees: '', compareRupees: '', stock: '0', is_active: 1 }), ...patch, dirty: true },
    }));
  };

  const saveAllVariantEdits = async () => {
    if (!id) return;
    setError('');
    setNotice('');
    const updates = Object.entries(variantDrafts)
      .filter(([, d]) => d.dirty)
      .map(([variantId, d]) => ({
        variantId,
        price_paise: d.priceRupees.trim() === '' ? null : Math.round(parseFloat(d.priceRupees) * 100),
        compare_paise: d.compareRupees.trim() === '' ? null : Math.round(parseFloat(d.compareRupees) * 100),
        stock: Math.max(0, parseInt(d.stock || '0', 10)),
        is_active: d.is_active,
      }));

    if (updates.length === 0) return;
    const invalid = updates.find(
      (u) =>
        (u.price_paise !== null && (!Number.isFinite(u.price_paise) || u.price_paise <= 0)) ||
        (u.compare_paise !== null && (!Number.isFinite(u.compare_paise) || u.compare_paise <= 0)),
    );
    if (invalid) {
      setError('Variant prices must be blank (inherit base price) or a positive rupee amount.');
      return;
    }

    setSavingVariants(true);
    try {
      const res = await productsApi.variants.bulkPrice(id, updates);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save variant pricing.');
        return;
      }
      await reloadProduct(id);
      setNotice(`Saved ${updates.length} variant pricing/stock update(s) live to storefront & checkout!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const applyQuickSizePrice = async (size: string) => {
    if (!id) return;
    setError('');
    setNotice('');
    const raw = (bulkSizePrices[size] ?? '').trim();
    const pricePaise = raw === '' ? null : Math.round(parseFloat(raw) * 100);
    if (pricePaise !== null && (!Number.isFinite(pricePaise) || pricePaise <= 0)) {
      setError(`Enter a valid positive rupee price for size ${size} (or leave empty to reset to base price).`);
      return;
    }
    setSavingVariants(true);
    try {
      const res = await productsApi.variants.bulkPrice(id, [{ size, price_paise: pricePaise }]);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to apply size-wise price.');
        return;
      }
      await reloadProduct(id);
      setNotice(
        pricePaise === null
          ? `Reset all "${size}" variants to inherit base price (₹ ${form.priceRupees}).`
          : `Set all "${size}" variants to ₹ ${fmt(pricePaise)} live!`,
      );
    } finally {
      setSavingVariants(false);
    }
  };

  const addVariant = async () => {
    if (!id || !variantForm.sku.trim()) {
      setError('SKU is required for the new variant.');
      return;
    }
    setError('');
    const pricePaise =
      variantForm.priceRupees.trim() !== '' ? Math.round(parseFloat(variantForm.priceRupees) * 100) : null;
    const comparePaise =
      variantForm.compareRupees.trim() !== '' ? Math.round(parseFloat(variantForm.compareRupees) * 100) : null;

    const res = await productsApi.variants.create(id, {
      sku: variantForm.sku.trim(),
      color_name: variantForm.color_name.trim() || 'Black',
      color_hex: variantForm.color_hex || '#111111',
      size: variantForm.size.trim() || 'M',
      price_paise: pricePaise,
      compare_paise: comparePaise,
      stock: Math.max(0, parseInt(variantForm.stock || '0', 10)),
    });
    if (!res.success) {
      setError(res.error?.message ?? 'Failed to add variant.');
      return;
    }
    await reloadProduct(id);
    setVariantModal(false);
    setVariantForm({ sku: '', color_name: 'Black', color_hex: '#111111', size: 'M', priceRupees: '', compareRupees: '', stock: '5' });
    setNotice('Variant added with size-wise pricing.');
  };

  const generateMatrix = async () => {
    if (!id || parsedMatrixSizes.length === 0 || matrixColors.length === 0) {
      setError('Provide at least one size and one color.');
      return;
    }
    setError('');
    setSavingVariants(true);
    try {
      const sizePrices: Record<string, number | null> = {};
      for (const sz of parsedMatrixSizes) {
        const raw = (matrixSizePrices[sz] ?? '').trim();
        if (raw !== '') {
          const paise = Math.round(parseFloat(raw) * 100);
          if (Number.isFinite(paise) && paise > 0) sizePrices[sz] = paise;
        }
      }
      const res = await productsApi.variants.matrix(id, {
        sizes: parsedMatrixSizes,
        colors: matrixColors.filter((c) => c.name.trim()),
        initialStock: Math.max(0, parseInt(matrixStock || '5', 10)),
        sizePrices: Object.keys(sizePrices).length > 0 ? sizePrices : undefined,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Matrix generation failed.');
        return;
      }
      await reloadProduct(id);
      setMatrixModal(false);
      setNotice(`Generated / updated ${res.data?.count ?? 0} size × color variants!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const deleteVariant = async (vid: string) => {
    if (!id || !confirm('Delete (or deactivate if ordered) this variant?')) return;
    await productsApi.variants.delete(id, vid);
    await reloadProduct(id);
    setNotice('Variant removed / deactivated.');
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

  const basePricePaise = Math.round(parseFloat(form.priceRupees || '0') * 100);

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
          { id: 'details', label: 'Details & Base Pricing' },
          { id: 'variants', label: `Size-Wise Pricing & Stock (${variants.length})` },
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
            <Input
              label="Base Price (INR ₹)"
              tooltip="Default price used for all sizes unless a size has its own custom price in the Size-Wise Pricing tab."
              type="number"
              step="0.01"
              value={form.priceRupees}
              onChange={(e) => setForm((f) => ({ ...f, priceRupees: e.target.value }))}
              required
            />
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
        <div className="space-y-5">
          {/* Quick Size-Wise Pricing Bar */}
          {!isNew && distinctSizes.length > 0 && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900 flex items-center gap-1.5">
                    Quick Size-Wise Pricing Bar
                    <InfoTooltip text="Set a price for an entire size (e.g. XL or IT 54) across all colors in one click. Leave empty and click Apply to reset that size back to the base product price." />
                  </p>
                  <p className="text-xs text-ink-500">
                    Base product price: <strong>₹ {fmt(basePricePaise)}</strong> · Changes propagate immediately to PDP, Cart &amp; Checkout.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {distinctSizes.map((sz) => {
                  const firstMatch = variants.find((v) => v.size === sz);
                  const currentLabel = firstMatch?.price_paise != null ? `₹ ${fmt(firstMatch.price_paise)}` : 'Inherits base';
                  return (
                    <div key={sz} className="border border-ink-200 rounded-xl p-3 bg-ink-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-ink-900">Size {sz}</span>
                        <span className="text-[11px] text-ink-500">{currentLabel}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          step="1"
                          placeholder={form.priceRupees || 'Base ₹'}
                          value={bulkSizePrices[sz] ?? (firstMatch?.price_paise != null ? String(firstMatch.price_paise / 100) : '')}
                          onChange={(e) => setBulkSizePrices((prev) => ({ ...prev, [sz]: e.target.value }))}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                        />
                        <Button size="sm" variant="secondary" loading={savingVariants} onClick={() => applyQuickSizePrice(sz)}>
                          Set
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Full Editable Variants Table */}
          <Card padding={false}>
            <div className="p-4 border-b border-ink-100 flex flex-wrap justify-between items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Variant Matrix (Per-Size Price, MRP &amp; Stock)</p>
                <p className="text-xs text-ink-500">Leave Custom Price blank to inherit Base Price (₹ {fmt(basePricePaise)}). Click Save All Edits when done.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {dirtyCount > 0 && (
                  <Button size="sm" loading={savingVariants} onClick={saveAllVariantEdits}>
                    Save {dirtyCount} Edited Row{dirtyCount > 1 ? 's' : ''}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setMatrixModal(true)} disabled={isNew}>
                  ⚡ Size × Color Matrix
                </Button>
                <Button size="sm" onClick={() => setVariantModal(true)} disabled={isNew}>
                  + Add Single Variant
                </Button>
              </div>
            </div>
            {isNew && <p className="p-6 text-sm text-ink-500 text-center">Create the product first, then configure size-wise pricing &amp; stock.</p>}
            {!isNew && variants.length === 0 && (
              <p className="p-6 text-sm text-ink-500 text-center">
                No variants yet. Use <strong>Size × Color Matrix</strong> to generate all sizes with custom pricing in seconds.
              </p>
            )}
            {variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['SKU', 'Colour', 'Size', 'Custom Price (₹)', 'MRP / Compare (₹)', 'Stock', 'Reserved', 'Active', ''].map((h) => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {variants.map((v) => {
                      const d = variantDrafts[v.id] ?? {
                        priceRupees: v.price_paise != null ? String(v.price_paise / 100) : '',
                        compareRupees: v.compare_paise != null ? String(v.compare_paise / 100) : '',
                        stock: String(v.stock),
                        is_active: v.is_active ? 1 : 0,
                      };
                      const colorName = v.color_name ?? v.color ?? 'Default';
                      const reserved = v.reserved_stock ?? v.reserved ?? 0;
                      const isCustom = d.priceRupees.trim() !== '';
                      return (
                        <tr key={v.id} className={d.dirty ? 'bg-amber-50/40' : 'hover:bg-ink-50/50'}>
                          <td className="py-2.5 px-3 font-mono text-xs text-ink-700">{v.sku}</td>
                          <td className="py-2.5 px-3 text-ink-800">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-ink-300 flex-shrink-0"
                                style={{ backgroundColor: v.color_hex || '#111111' }}
                              />
                              {colorName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-ink-900">{v.size}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                placeholder={`Base (${form.priceRupees || '0'})`}
                                value={d.priceRupees}
                                onChange={(e) => updateDraft(v.id, { priceRupees: e.target.value })}
                                className="w-28 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                              />
                              <Badge variant={isCustom ? 'gold' : 'default'}>{isCustom ? 'Custom' : 'Base'}</Badge>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder={form.compareRupees || '—'}
                              value={d.compareRupees}
                              onChange={(e) => updateDraft(v.id, { compareRupees: e.target.value })}
                              className="w-24 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={reserved}
                              value={d.stock}
                              onChange={(e) => updateDraft(v.id, { stock: e.target.value })}
                              className="w-20 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-500">{reserved}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={d.is_active === 1}
                              onChange={(e) => updateDraft(v.id, { is_active: e.target.checked ? 1 : 0 })}
                              className="w-4 h-4 rounded text-ink-900"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => deleteVariant(v.id)} className="text-red-500 hover:bg-red-50">
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Add Single Variant Modal */}
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
              <div className="grid grid-cols-3 gap-3">
                <Input label="Colour Name" value={variantForm.color_name} onChange={(e) => setVariantForm((f) => ({ ...f, color_name: e.target.value }))} />
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1.5">Swatch Hex</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variantForm.color_hex}
                      onChange={(e) => setVariantForm((f) => ({ ...f, color_hex: e.target.value }))}
                      className="w-9 h-9 rounded border border-ink-200 cursor-pointer"
                    />
                    <input
                      value={variantForm.color_hex}
                      onChange={(e) => setVariantForm((f) => ({ ...f, color_hex: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-ink-200 rounded-lg"
                    />
                  </div>
                </div>
                <Input label="Size" value={variantForm.size} onChange={(e) => setVariantForm((f) => ({ ...f, size: e.target.value }))} placeholder="M / IT 48" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Custom Price (₹)"
                  type="number"
                  step="0.01"
                  value={variantForm.priceRupees}
                  onChange={(e) => setVariantForm((f) => ({ ...f, priceRupees: e.target.value }))}
                  placeholder={`Base: ${form.priceRupees}`}
                />
                <Input
                  label="Compare / MRP (₹)"
                  type="number"
                  step="0.01"
                  value={variantForm.compareRupees}
                  onChange={(e) => setVariantForm((f) => ({ ...f, compareRupees: e.target.value }))}
                  placeholder="Optional"
                />
                <Input label="Initial Stock" type="number" value={variantForm.stock} onChange={(e) => setVariantForm((f) => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>
          </Modal>

          {/* Bulk Size × Color Matrix Generator Modal */}
          <Modal
            open={matrixModal}
            onClose={() => setMatrixModal(false)}
            title="Generate Size × Colour Matrix with Size-Wise Pricing"
            wide
            footer={
              <>
                <Button variant="outline" onClick={() => setMatrixModal(false)}>Cancel</Button>
                <Button loading={savingVariants} onClick={generateMatrix}>
                  Generate {parsedMatrixSizes.length * matrixColors.length} Variant(s)
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-700">Sizes (comma-separated)</label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setMatrixSizesInput('XS, S, M, L, XL, XXL')} className="text-[11px] px-2 py-0.5 rounded bg-ink-100 hover:bg-ink-200 text-ink-700">XS–XXL</button>
                    <button type="button" onClick={() => setMatrixSizesInput('46, 48, 50, 52, 54, 56')} className="text-[11px] px-2 py-0.5 rounded bg-ink-100 hover:bg-ink-200 text-ink-700">IT 46–56</button>
                    <button type="button" onClick={() => setMatrixSizesInput('28, 30, 32, 34, 36, 38')} className="text-[11px] px-2 py-0.5 rounded bg-ink-100 hover:bg-ink-200 text-ink-700">Waist 28–38</button>
                  </div>
                </div>
                <Input value={matrixSizesInput} onChange={(e) => setMatrixSizesInput(e.target.value)} placeholder="S, M, L, XL, XXL" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-700">Colours</label>
                  <button
                    type="button"
                    onClick={() => setMatrixColors((c) => [...c, { name: 'Ivory', hex: '#F4F1EA' }])}
                    className="text-xs font-medium text-gold-700 hover:underline"
                  >
                    + Add Colour
                  </button>
                </div>
                <div className="space-y-2">
                  {matrixColors.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={col.hex}
                        onChange={(e) => setMatrixColors((cs) => cs.map((x, i) => (i === idx ? { ...x, hex: e.target.value } : x)))}
                        className="w-9 h-9 rounded border border-ink-200 cursor-pointer"
                      />
                      <input
                        value={col.name}
                        onChange={(e) => setMatrixColors((cs) => cs.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                        placeholder="Colour name"
                        className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-lg"
                      />
                      {matrixColors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMatrixColors((cs) => cs.filter((_, i) => i !== idx))}
                          className="text-xs text-red-500 px-2 py-1 hover:bg-red-50 rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Input label="Initial Stock per Variant" type="number" min="0" value={matrixStock} onChange={(e) => setMatrixStock(e.target.value)} />

              {parsedMatrixSizes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-2">
                    Optional Per-Size Price Overrides (₹) — leave blank to inherit Base Price (₹ {form.priceRupees || '0'})
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {parsedMatrixSizes.map((sz) => (
                      <div key={sz} className="flex items-center gap-2 bg-ink-50 px-3 py-2 rounded-lg border border-ink-200">
                        <span className="text-xs font-semibold text-ink-800 w-10">{sz}</span>
                        <input
                          type="number"
                          step="1"
                          placeholder={`₹${form.priceRupees || 'Base'}`}
                          value={matrixSizePrices[sz] ?? ''}
                          onChange={(e) => setMatrixSizePrices((prev) => ({ ...prev, [sz]: e.target.value }))}
                          className="w-full px-2 py-1 text-xs bg-white border border-ink-200 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
