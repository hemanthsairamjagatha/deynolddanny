import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Spinner, Tabs, SearchBar, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { orders as ordersApi } from '../../lib/api';
import type { Order } from '../../lib/types';

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'fulfilled', label: 'Fulfilled' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function OrdersListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await ordersApi.list({ status: tab === 'all' ? undefined : tab, page, search: search || undefined });
      const raw = res.data as unknown as { orders?: Order[]; total?: number } | Order[];
      setData(Array.isArray(raw) ? raw : (raw?.orders ?? []));
      setTotal(Array.isArray(raw) ? raw.length : Number(raw?.total ?? 0));
    } finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); }, [tab, search]);
  useEffect(() => { load(); }, [tab, search, page]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const columns: Column<Order>[] = [
    {
      key: 'display_id', header: 'Order', render: r => (
        <span className="font-mono font-semibold text-ink-900">#{r.display_id ?? r.id.slice(-6).toUpperCase()}</span>
      )
    },
    { key: 'customer', header: 'Customer', render: r => <span className="text-ink-700">{r.customer_email ?? r.user_id ?? '—'}</span> },
    { key: 'created_at', header: 'Date', render: r => <span className="text-ink-500 text-sm">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span> },
    { key: 'status', header: 'Status', render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: 'total', header: 'Total', render: r => <span className="font-semibold text-ink-900">{fmt(r.total_paise ?? 0)}</span> },
    {
      key: 'actions', header: '', render: r => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${r.id}`)}>View →</Button>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description={`${total} orders total`} />
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs active={tab} onChange={t => setTab(t)} tabs={STATUS_TABS} />
        <div className="ml-auto"><SearchBar value={search} onChange={setSearch} placeholder="Search by order ID or email…" /></div>
      </div>
      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : data.length === 0 ? <EmptyState title="No orders found" description="Orders will appear here once customers begin placing them." /> : (
          <>
            <DataTable columns={columns} data={data} onRowClick={r => navigate(`/orders/${r.id}`)} />
            <div className="flex justify-between items-center px-4 py-3 border-t border-ink-100">
              <span className="text-sm text-ink-500">Page {page}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                <Button size="sm" variant="ghost" disabled={data.length < 25} onClick={() => setPage(p => p + 1)}>Next →</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
