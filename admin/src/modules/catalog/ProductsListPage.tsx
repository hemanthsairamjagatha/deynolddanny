import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Badge, Card, DataTable, SearchBar, Select } from '../../components/ui';
import type { Column } from '../../components/ui';

interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  sku_prefix: string;
  category_id: string | null;
  price_paise: number;
  default_img: string;
  is_active: number;
  variant_count: number;
  total_stock: number;
}

interface CatOption {
  id: string;
  title: string;
}

function fmt(paise: number) {
  return '₹ ' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function ProductsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminProductRow[]>([]);
  const [categories, setCategories] = useState<CatOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');

  const load = () => {
    setLoading(true);
    productsApi
      .list({ q: search || undefined, status: status || undefined, categoryId: category || undefined })
      .then((res) => {
        if (res.success && res.data) {
          const raw = (res.data.items ?? []) as Record<string, unknown>[];
          setItems(
            raw.map((p) => ({
              id: String(p.id ?? ''),
              slug: String(p.slug ?? ''),
              title: String(p.title ?? p.name ?? ''),
              sku_prefix: String(p.sku_prefix ?? ''),
              category_id: p.category_id ? String(p.category_id) : null,
              price_paise: Number(p.price_paise ?? 0),
              default_img: String(p.default_img ?? ''),
              is_active: Number(p.is_active ?? 1),
              variant_count: Number(p.variant_count ?? 0),
              total_stock: Number(p.total_stock ?? 0),
            })),
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [status, category]);

  useEffect(() => {
    catsApi.list().then((r) => {
      if (r.success && r.data) {
        const raw = r.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setCategories(arr.map((c) => ({ id: String(c.id ?? ''), title: String(c.title ?? c.name ?? '') })));
      }
    });
  }, []);

  const archive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Archive this product? It will be hidden from the storefront.')) return;
    await productsApi.archive(id);
    load();
  };

  const restore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await productsApi.restore(id);
    load();
  };

  const duplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await productsApi.duplicate(id);
    load();
  };

  const categoryName = (id: string | null) => {
    if (!id) return '—';
    return categories.find((c) => c.id === id)?.title ?? id;
  };

  const cols: Column<AdminProductRow>[] = [
    {
      key: 'title',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.default_img && <img src={p.default_img} alt="" className="w-10 h-12 rounded-lg object-cover border border-ink-200 bg-ink-50 flex-shrink-0" />}
          <div>
            <p className="font-medium text-ink-900">{p.title}</p>
            <p className="text-xs text-ink-400 font-mono">
              /{p.slug} {p.sku_prefix ? `· ${p.sku_prefix}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category_id', header: 'Category', render: (p) => <span className="text-sm text-ink-600">{categoryName(p.category_id)}</span> },
    { key: 'price_paise', header: 'Price', render: (p) => <span className="text-sm font-medium text-ink-900">{fmt(p.price_paise)}</span> },
    {
      key: 'total_stock',
      header: 'Stock / Variants',
      render: (p) => (
        <span className="text-xs text-ink-600">
          {p.total_stock} units · {p.variant_count} variants
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (p) => <Badge variant={p.is_active === 1 ? 'success' : 'default'}>{p.is_active === 1 ? 'Active' : 'Archived'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/catalog/products/${p.id}`);
            }}
          >
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => duplicate(p.id, e)}>
            Duplicate
          </Button>
          {p.is_active === 1 ? (
            <Button size="sm" variant="ghost" onClick={(e) => archive(p.id, e)} className="text-red-500 hover:bg-red-50">
              Archive
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={(e) => restore(p.id, e)} className="text-emerald-600 hover:bg-emerald-50">
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
        title="Products"
        description="Manage the Deynold Danny product catalogue, prices, variants, and imagery."
        actions={<Button onClick={() => navigate('/catalog/products/new')}>+ New Product</Button>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products by title, slug, or SKU…" className="flex-1 min-w-[220px] max-w-sm" />
        <button onClick={load} className="px-4 py-2 text-sm bg-white border border-ink-200 rounded-lg hover:bg-ink-50 transition-colors">
          Search
        </button>
        <Select
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All Products' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          label=""
          className="w-36"
        />
        <Select
          options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          label=""
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <DataTable
          columns={cols}
          data={items}
          loading={loading}
          onRowClick={(p) => navigate(`/catalog/products/${p.id}`)}
          emptyTitle="No products found"
          emptyDescription="Create your first product or adjust your search filters."
        />
      </Card>
    </div>
  );
}
