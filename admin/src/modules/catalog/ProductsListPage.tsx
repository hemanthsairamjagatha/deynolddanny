import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import { PageHeader, Button, Badge, Card, DataTable, SearchBar, Select } from '../../components/ui';
import type { Column } from '../../components/ui';

interface ProductColorChip {
  name: string;
  hex: string;
}

interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  sku_prefix: string;
  category_id: string | null;
  section_group: string;
  price_paise: number;
  min_price_paise: number;
  max_price_paise: number;
  default_img: string;
  is_active: number;
  is_featured: number;
  variant_count: number;
  total_stock: number;
  colors: ProductColorChip[];
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
  const [availableColors, setAvailableColors] = useState<ProductColorChip[]>([]);
  const [categories, setCategories] = useState<CatOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');
  const [sectionGroup, setSectionGroup] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSection, setBulkSection] = useState('mastery');
  const [bulkCategory, setBulkCategory] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [savingInlinePrice, setSavingInlinePrice] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = (targetPage = page) => {
    setLoading(true);
    setError('');
    productsApi
      .list({
        q: search || undefined,
        status: status || undefined,
        categoryId: category || undefined,
        sectionGroup: sectionGroup || undefined,
        color: colorFilter || undefined,
        sort,
        page: targetPage,
        limit: 25,
      })
      .then((res) => {
        if (res.success && res.data) {
          const raw = (res.data.items ?? []) as Record<string, unknown>[];
          if (Array.isArray(res.data.availableColors)) {
            setAvailableColors(res.data.availableColors);
          }
          setTotal(Number(res.data.total ?? raw.length));
          setTotalPages(Math.max(1, Number(res.data.totalPages ?? 1)));
          setItems(
            raw.map((p) => {
              const basePaise = Number(p.price_paise ?? 0);
              return {
                id: String(p.id ?? ''),
                slug: String(p.slug ?? ''),
                title: String(p.title ?? p.name ?? ''),
                sku_prefix: String(p.sku_prefix ?? ''),
                category_id: p.category_id ? String(p.category_id) : null,
                section_group: String(p.section_group ?? 'mastery'),
                price_paise: basePaise,
                min_price_paise: Number(p.min_price_paise ?? basePaise),
                max_price_paise: Number(p.max_price_paise ?? basePaise),
                default_img: String(p.default_img ?? ''),
                is_active: Number(p.is_active ?? 1),
                is_featured: Number(p.is_featured ?? 0),
                variant_count: Number(p.variant_count ?? 0),
                total_stock: Number(p.total_stock ?? 0),
                colors: Array.isArray(p.colors) ? (p.colors as ProductColorChip[]) : [],
              };
            }),
          );
          setSelectedIds([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [status, category, sectionGroup, colorFilter, sort]);

  useEffect(() => {
    catsApi.list().then((r) => {
      if (r.success && r.data) {
        const raw = r.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setCategories(arr.map((c) => ({ id: String(c.id ?? ''), title: String(c.title ?? c.name ?? '') })));
      }
    });
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allOnPageSelected = items.length > 0 && items.every((i) => selectedIds.includes(i.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const runBulkAction = async (
    action: 'activate' | 'archive' | 'set_section_group' | 'set_category' | 'set_featured',
    value?: string | number | boolean | null,
    label?: string,
  ) => {
    if (selectedIds.length === 0) return;
    if (action === 'archive' && !confirm(`Archive ${selectedIds.length} selected product(s)?`)) return;
    setBulkBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await productsApi.bulk(selectedIds, action, value);
      if (!res.success) {
        setError(res.error?.message ?? 'Bulk operation failed.');
        return;
      }
      setNotice(`${label ?? 'Updated'} ${res.data?.updated ?? selectedIds.length} product(s) live.`);
      load(page);
    } finally {
      setBulkBusy(false);
    }
  };

  const archive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Archive this product? It will be hidden from the storefront.')) return;
    await productsApi.archive(id);
    load(page);
  };

  const restore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await productsApi.restore(id);
    load(page);
  };

  const duplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await productsApi.duplicate(id);
    if (res.success) {
      setNotice('Duplicated product including variants & gallery images.');
      load(page);
    }
  };

  const startInlinePrice = (p: AdminProductRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPriceId(p.id);
    setEditingPriceValue(String(p.price_paise / 100));
  };

  const saveInlinePrice = async (p: AdminProductRow, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const num = parseFloat(editingPriceValue);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid positive base price in ₹.');
      return;
    }
    setSavingInlinePrice(true);
    setError('');
    try {
      const res = await productsApi.update(p.id, { price_paise: Math.round(num * 100) });
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to update price.');
        return;
      }
      setEditingPriceId(null);
      setNotice(`Updated base price for "${p.title}" to ₹ ${num.toLocaleString('en-IN')} live.`);
      load(page);
    } finally {
      setSavingInlinePrice(false);
    }
  };

  const categoryName = (id: string | null) => {
    if (!id) return '—';
    return categories.find((c) => c.id === id)?.title ?? id;
  };

  const changeSectionGroup = async (id: string, nextGroup: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const res = await productsApi.update(id, { section_group: nextGroup });
    if (res.success) {
      const label =
        nextGroup === 'mastery'
          ? 'Our Best Sellers'
          : nextGroup === 'style_space'
            ? 'New Arrivals'
            : 'Editorial / News';
      setNotice(`Moved product to "${label}" live!`);
      load(page);
    }
  };

  const cols: Column<AdminProductRow>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-10',
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Select ${p.title}`}
            checked={selectedIds.includes(p.id)}
            onChange={() => toggleSelect(p.id)}
            className="w-4 h-4 rounded border-ink-300 text-ink-900 cursor-pointer"
          />
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.default_img && <img src={p.default_img} alt="" className="w-10 h-12 rounded-lg object-cover border border-ink-200 bg-ink-50 flex-shrink-0" />}
          <div>
            <p className="font-medium text-ink-900 flex items-center gap-1.5">
              <span>{p.title}</span>
              {p.is_featured === 1 && <Badge variant="gold">Featured</Badge>}
            </p>
            <p className="text-xs text-ink-400 font-mono">
              /{p.slug} {p.sku_prefix ? `· ${p.sku_prefix}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'section_group',
      header: 'Homepage Section',
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={p.section_group || 'mastery'}
            onChange={(e) => changeSectionGroup(p.id, e.target.value, e)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-ink-200 bg-white font-medium text-ink-800 hover:border-ink-400 focus:outline-none focus:ring-1 focus:ring-gold-400"
          >
            <option value="mastery">Our Best Sellers</option>
            <option value="style_space">New Arrivals</option>
            <option value="news">Editorial / News</option>
          </select>
        </div>
      ),
    },
    { key: 'category_id', header: 'Category', render: (p) => <span className="text-sm text-ink-600">{categoryName(p.category_id)}</span> },
    {
      key: 'colors',
      header: 'Colours',
      render: (p) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.colors.length === 0 ? (
            <span className="text-xs text-ink-400">—</span>
          ) : (
            p.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                title={`Filter by ${c.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setColorFilter((prev) => (prev.toLowerCase() === c.name.toLowerCase() ? '' : c.name));
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-ink-200 bg-ink-50/60 hover:border-ink-500 text-[11px] text-ink-700"
              >
                <span className="w-2.5 h-2.5 rounded-full border border-ink-300" style={{ backgroundColor: c.hex }} />
                <span>{c.name}</span>
              </button>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'price_paise',
      header: 'Price (Colour / Size)',
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          {editingPriceId === p.id ? (
            <form onSubmit={(e) => saveInlinePrice(p, e)} className="flex items-center gap-1">
              <input
                type="number"
                step="1"
                min="1"
                value={editingPriceValue}
                onChange={(e) => setEditingPriceValue(e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-ink-300 rounded bg-white"
                autoFocus
              />
              <Button size="sm" variant="primary" loading={savingInlinePrice} type="submit">
                Save
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditingPriceId(null)}>
                ✕
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <div>
                <span className="text-sm font-medium text-ink-900">
                  {p.min_price_paise !== p.max_price_paise
                    ? `${fmt(p.min_price_paise)} – ${fmt(p.max_price_paise)}`
                    : fmt(p.min_price_paise || p.price_paise)}
                </span>
                {p.min_price_paise !== p.max_price_paise && (
                  <span className="block text-[10px] text-gold-700 font-medium">Multi-price</span>
                )}
              </div>
              <button
                type="button"
                title="Quick-edit base price"
                onClick={(e) => startInlinePrice(p, e)}
                className="opacity-60 group-hover:opacity-100 text-[11px] px-1.5 py-0.5 rounded border border-ink-200 hover:border-ink-500 text-ink-600"
              >
                ✎
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'total_stock',
      header: 'Stock / Variants',
      render: (p) => (
        <span className={`text-xs ${p.total_stock === 0 ? 'text-red-600 font-semibold' : p.total_stock <= 5 ? 'text-amber-700 font-medium' : 'text-ink-600'}`}>
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
        description="Manage the Deynold Danny product catalogue, Our Best Sellers & New Arrivals placement, colour shift swatches, colour-wise & size-wise pricing, and imagery."
        actions={<Button onClick={() => navigate('/catalog/products/new')}>+ New Product</Button>}
      />

      {notice && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2.5 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products by title, slug, or SKU…" className="flex-1 min-w-[220px] max-w-sm" />
        <button onClick={() => { setPage(1); load(1); }} className="px-4 py-2 text-sm bg-white border border-ink-200 rounded-lg hover:bg-ink-50 transition-colors">
          Search
        </button>
        <Select
          options={[
            { value: 'featured', label: 'Sort: Featured' },
            { value: 'newest', label: 'Sort: Newest' },
            { value: 'price_asc', label: 'Sort: Price Low → High' },
            { value: 'price_desc', label: 'Sort: Price High → Low' },
            { value: 'title_asc', label: 'Sort: Title A → Z' },
            { value: 'stock_asc', label: 'Sort: Lowest Stock First' },
          ]}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          label=""
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Homepage Sections' },
            { value: 'mastery', label: 'Our Best Sellers (Mastery)' },
            { value: 'style_space', label: 'New Arrivals (Style Space)' },
            { value: 'news', label: 'Editorial / News' },
          ]}
          value={sectionGroup}
          onChange={(e) => setSectionGroup(e.target.value)}
          label=""
          className="w-52"
        />
        <Select
          options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          label=""
          className="w-44"
        />
        <Select
          options={[
            { value: '', label: 'All Colours' },
            ...availableColors.map((c) => ({ value: c.name, label: c.name })),
          ]}
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value)}
          label=""
          className="w-40"
        />
        <Select
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All Statuses' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          label=""
          className="w-36"
        />
      </div>

      {/* Interactive Colour Filter Swatch Pills */}
      {availableColors.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mr-1">
            Colour Filter:
          </span>
          <button
            type="button"
            onClick={() => setColorFilter('')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              !colorFilter
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-ink-600 border-ink-200 hover:border-ink-500'
            }`}
          >
            All Colours
          </button>
          {availableColors.map((c) => {
            const active = colorFilter.toLowerCase() === c.name.toLowerCase();
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setColorFilter(active ? '' : c.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-500'
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-ink-300" style={{ backgroundColor: c.hex }} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk Operations Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-3 py-2 bg-white border border-ink-200 rounded-xl">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-ink-300 text-ink-900"
            />
            Select page ({items.length})
          </label>
          <span className="text-xs text-ink-400">· Showing {items.length} of {total} products</span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold">{selectedIds.length} selected</Badge>
            <Button size="sm" variant="outline" loading={bulkBusy} onClick={() => runBulkAction('activate', undefined, 'Activated')}>
              Activate
            </Button>
            <Button size="sm" variant="outline" loading={bulkBusy} onClick={() => runBulkAction('archive', undefined, 'Archived')} className="text-red-600 border-red-200 hover:bg-red-50">
              Archive
            </Button>
            <Button size="sm" variant="outline" loading={bulkBusy} onClick={() => runBulkAction('set_featured', true, 'Marked Featured')}>
              Mark Featured
            </Button>
            <div className="flex items-center gap-1">
              <select
                value={bulkSection}
                onChange={(e) => setBulkSection(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-ink-200 bg-white"
              >
                <option value="mastery">Our Best Sellers</option>
                <option value="style_space">New Arrivals</option>
                <option value="news">Editorial / News</option>
              </select>
              <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => runBulkAction('set_section_group', bulkSection, 'Moved section for')}>
                Move Section
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-ink-200 bg-white"
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => runBulkAction('set_category', bulkCategory || null, 'Assigned category for')}>
                Assign Category
              </Button>
            </div>
          </div>
        )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-ink-500">
          <span>
            Page {page} of {totalPages} ({total} total products)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => {
                const next = Math.max(1, page - 1);
                setPage(next);
                load(next);
              }}
            >
              ← Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                load(next);
              }}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
