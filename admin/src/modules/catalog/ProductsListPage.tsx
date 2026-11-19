import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import type { Product } from '../../lib/types';
import { PageHeader, Button, Badge, statusVariant, Card, DataTable, SearchBar, Select } from '../../components/ui';
import type { Column } from '../../components/ui';

function fmt(paise: number) { return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function ProductsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const load = () => {
    setLoading(true);
    productsApi.list({ search: search || undefined, status: status || undefined, category: category || undefined }).then(res => {
      if (res.success && res.data) setItems(res.data.items ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, category]);
  useEffect(() => { catsApi.list().then(r => { if (r.success && r.data) setCategories(r.data); }); }, []);

  const archive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Archive this product?')) return;
    await productsApi.archive(id);
    load();
  };

  const duplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await productsApi.duplicate(id);
    load();
  };

  const categoryName = (id: string | null) => {
    if (!id) return '—';
    const cat = categories.find(c => c.id === id);
    return (cat?.name as string) ?? id.slice(0, 8);
  };

  const minVariantPrice = (p: Product) => {
    if (!p.variants?.length) return 0;
    return Math.min(...p.variants.map(v => v.price_paise));
  };

  const cols: Column<Product>[] = [
    {
      key: 'name', header: 'Product',
      render: p => (
        <div>
          <p className="font-medium text-ink-900">{p.name}</p>
          <p className="text-xs text-ink-400 font-mono">/{p.slug}</p>
        </div>
      )
    },
    { key: 'category_id', header: 'Category', render: p => <span className="text-sm text-ink-600">{categoryName(p.category_id)}</span> },
    { key: 'variants', header: 'Variants', render: p => <span className="text-sm text-ink-600">{p.variants?.length ?? 0}</span> },
    { key: 'price', header: 'Price', render: p => <span className="text-sm font-medium text-ink-900">{p.variants?.length ? fmt(minVariantPrice(p)) : '—'}</span> },
    { key: 'status', header: 'Status', render: p => <Badge variant={statusVariant(p.status)}>{p.status}</Badge> },
    {
      key: 'actions', header: '',
      render: p => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/catalog/products/${p.id}`); }}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={e => duplicate(p.id, e)}>Duplicate</Button>
          {p.status !== 'archived' && <Button size="sm" variant="ghost" onClick={e => archive(p.id, e)} className="text-red-500 hover:bg-red-50">Archive</Button>}
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage the Deynold Danny product catalogue."
        actions={<Button onClick={() => navigate('/catalog/products/new')}>+ New Product</Button>}
      />

      <div className="flex gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products…" className="flex-1 max-w-sm" />
        <button onClick={load} className="px-4 py-2 text-sm bg-white border border-ink-200 rounded-lg hover:bg-ink-50 transition-colors">Search</button>
        <Select
          options={[{ value: '', label: 'All Statuses' }, { value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
          value={status} onChange={e => setStatus(e.target.value)} label="" className="w-36"
        />
        <Select
          options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id as string, label: c.name as string }))]}
          value={category} onChange={e => setCategory(e.target.value)} label="" className="w-44"
        />
      </div>

      <Card padding={false}>
        <DataTable
          columns={cols}
          data={items}
          loading={loading}
          emptyTitle="No products found"
          emptyDescription="Create your first product or adjust your search filters."
        />
      </Card>
    </div>
  );
}
