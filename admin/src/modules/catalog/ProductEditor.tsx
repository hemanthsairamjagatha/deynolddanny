import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import type { Product, ProductVariant } from '../../lib/types';
import { PageHeader, Button, Input, Textarea, Select, Card, Badge, Tabs, Spinner, Modal } from '../../components/ui';

function fmt(paise: number) { return (paise / 100).toFixed(2); }

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [product, setProduct] = useState<Partial<Product>>({ status: 'draft', images: [] });
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantModal, setVariantModal] = useState(false);
  const [variantForm, setVariantForm] = useState({ sku: '', color: '', size: '', price: '', compare_price: '', stock: '0' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    catsApi.list().then(r => { if (r.success && r.data) setCategories(r.data); });
    if (!isNew && id) {
      productsApi.get(id).then(res => {
        if (res.success && res.data) {
          setProduct(res.data);
          setVariants(res.data.variants ?? []);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id, isNew]);

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const set = (k: keyof Product, v: unknown) => setProduct(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    if (isNew) {
      const res = await productsApi.create(product);
      setSaving(false);
      if (res.success && res.data) navigate(`/catalog/products/${res.data.id}`);
    } else if (id) {
      await productsApi.update(id, product);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const addVariant = async () => {
    if (!id) return;
    const data = {
      sku: variantForm.sku,
      color: variantForm.color || null,
      size: variantForm.size || null,
      price_paise: Math.round(parseFloat(variantForm.price || '0') * 100),
      compare_price_paise: variantForm.compare_price ? Math.round(parseFloat(variantForm.compare_price) * 100) : null,
      stock: parseInt(variantForm.stock || '0'),
    };
    await productsApi.variants.create(id, data);
    const res = await productsApi.get(id);
    if (res.success && res.data) setVariants(res.data.variants ?? []);
    setVariantModal(false);
    setVariantForm({ sku: '', color: '', size: '', price: '', compare_price: '', stock: '0' });
  };

  const deleteVariant = async (vid: string) => {
    if (!id || !confirm('Delete this variant?')) return;
    await productsApi.variants.delete(id, vid);
    setVariants(v => v.filter(x => x.id !== vid));
  };

  const addImage = () => {
    const url = prompt('Enter image URL:');
    if (url) set('images', [...(product.images ?? []), url]);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Product' : (product.name ?? 'Edit Product')}
        description={isNew ? 'Add a new product to the Deynold Danny catalogue.' : `Editing product · /${product.slug}`}
        actions={
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
            <Button variant="outline" onClick={() => navigate('/catalog/products')}>Cancel</Button>
            <Button loading={saving} onClick={save}>{isNew ? 'Create Product' : 'Save Changes'}</Button>
          </div>
        }
      />

      <Tabs
        tabs={[{ id: 'details', label: 'Details' }, { id: 'variants', label: `Variants (${variants.length})` }, { id: 'images', label: `Images (${product.images?.length ?? 0})` }]}
        active={tab} onChange={setTab}
      />

      {tab === 'details' && (
        <div className="max-w-2xl space-y-5">
          <Card className="p-6 space-y-4">
            <Input label="Product Name" value={product.name ?? ''} onChange={e => { set('name', e.target.value); if (isNew) set('slug', autoSlug(e.target.value)); }} tooltip="The public product name shown on listing and detail pages." required />
            <Input label="URL Slug" value={product.slug ?? ''} onChange={e => set('slug', e.target.value)} tooltip="URL path for the product detail page, e.g. /products/silk-trousers" />
            <Select
              label="Category"
              value={product.category_id ?? ''}
              onChange={e => set('category_id', e.target.value)}
              options={[{ value: '', label: 'No category' }, ...categories.map(c => ({ value: c.id as string, label: c.name as string }))]}
              tooltip="Assigns this product to a browse category."
            />
            <Select
              label="Status"
              value={product.status ?? 'draft'}
              onChange={e => set('status', e.target.value)}
              options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
              tooltip="Draft products are hidden from customers. Active products are live. Archived products are hidden and read-only."
            />
          </Card>
          <Card className="p-6 space-y-4">
            <Textarea label="Description" value={product.description ?? ''} onChange={e => set('description', e.target.value)} rows={5} tooltip="Rich product description shown on the product detail page. Supports markdown." />
            <Textarea label="Care Instructions" value={product.care_instructions ?? ''} onChange={e => set('care_instructions', e.target.value)} rows={3} tooltip="Washing and care guidance shown in the product accordion." />
            <Input label="Material" value={product.material ?? ''} onChange={e => set('material', e.target.value)} tooltip="Fabric composition, e.g. 100% Italian Wool." />
            <Input label="Country of Origin" value={product.country_of_origin ?? ''} onChange={e => set('country_of_origin', e.target.value)} tooltip="Country where this product is manufactured." />
          </Card>
        </div>
      )}

      {tab === 'variants' && (
        <div className="max-w-4xl">
          <Card padding={false}>
            <div className="p-4 border-b border-ink-100 flex justify-between items-center">
              <p className="text-sm font-semibold text-ink-900">Product Variants</p>
              <Button size="sm" onClick={() => setVariantModal(true)} disabled={isNew}>+ Add Variant</Button>
            </div>
            {isNew && <p className="p-6 text-sm text-ink-500 text-center">Save the product first, then add variants.</p>}
            {!isNew && variants.length === 0 && <p className="p-6 text-sm text-ink-500 text-center">No variants yet. Add your first variant.</p>}
            {variants.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-200">
                  {['SKU', 'Color', 'Size', 'Price', 'Stock', 'Active', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {variants.map(v => (
                    <tr key={v.id} className="hover:bg-ink-50/50">
                      <td className="py-3 px-4 font-mono text-xs text-ink-700">{v.sku}</td>
                      <td className="py-3 px-4 text-ink-800">{v.color ?? '—'}</td>
                      <td className="py-3 px-4 text-ink-800">{v.size ?? '—'}</td>
                      <td className="py-3 px-4 font-medium text-ink-900">₹{fmt(v.price_paise)}</td>
                      <td className="py-3 px-4 text-ink-800">{v.stock - v.reserved}</td>
                      <td className="py-3 px-4"><Badge variant={v.is_active ? 'success' : 'default'}>{v.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => deleteVariant(v.id)} className="text-red-500 hover:bg-red-50">Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Modal open={variantModal} onClose={() => setVariantModal(false)} title="Add Variant"
            footer={<><Button variant="outline" onClick={() => setVariantModal(false)}>Cancel</Button><Button onClick={addVariant}>Add</Button></>}>
            <Input label="SKU" value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))} tooltip="Stock Keeping Unit — unique identifier for this specific variant." required />
            <Input label="Colour" value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} tooltip="Colour name, e.g. Midnight Navy." />
            <Input label="Size" value={variantForm.size} onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))} tooltip="Size label, e.g. M, L, XL or 32W." />
            <Input label="Price (₹)" type="number" step="0.01" value={variantForm.price} onChange={e => setVariantForm(f => ({ ...f, price: e.target.value }))} tooltip="Selling price in Indian Rupees." required />
            <Input label="Compare Price (₹)" type="number" step="0.01" value={variantForm.compare_price} onChange={e => setVariantForm(f => ({ ...f, compare_price: e.target.value }))} tooltip="Original price shown struck-through to indicate a discount. Leave blank to hide." />
            <Input label="Initial Stock" type="number" value={variantForm.stock} onChange={e => setVariantForm(f => ({ ...f, stock: e.target.value }))} tooltip="Starting inventory quantity for this variant." />
          </Modal>
        </div>
      )}

      {tab === 'images' && (
        <div className="max-w-2xl">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold text-ink-900">Product Images</p>
              <Button size="sm" onClick={addImage} disabled={isNew}>+ Add Image URL</Button>
            </div>
            {isNew && <p className="text-sm text-ink-500 mb-4">Save the product first, then add images.</p>}
            <div className="grid grid-cols-3 gap-3">
              {(product.images ?? []).map((url, i) => (
                <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-ink-200 bg-ink-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-ink-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => set('images', (product.images ?? []).filter((_, j) => j !== i))}
                      className="p-2 bg-red-600 text-white rounded-lg text-xs"
                    >Remove</button>
                  </div>
                </div>
              ))}
              {!isNew && (
                <button onClick={addImage} className="aspect-square rounded-xl border-2 border-dashed border-ink-300 hover:border-gold-400 transition-colors flex items-center justify-center text-ink-400 hover:text-gold-600">
                  <span className="text-2xl">+</span>
                </button>
              )}
            </div>
            {!isNew && (product.images?.length ?? 0) > 0 && (
              <Button className="mt-4" size="sm" variant="outline" onClick={() => productsApi.updateImages(id!, product.images ?? [])}>Save Image Order</Button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
