import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Spinner, Tabs, SearchBar, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { orders as ordersApi } from '../../lib/api';

interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  refundedPaise: number;
  shippingName: string;
  shippingCity: string;
  courierPartner?: string | null;
  trackingNumber?: string | null;
  shiprocketAwb?: string | null;
  createdAt: string;
}

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function OrdersListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await ordersApi.list({ status: tab === 'all' ? undefined : tab, page, limit: 20 });
      const raw = (res.data ?? {}) as { items?: AdminOrderRow[]; total?: number; totalPages?: number };
      const rows = Array.isArray(raw.items) ? raw.items : [];
      setData(rows);
      setTotal(Number(raw.total ?? rows.length));
      setTotalPages(Math.max(1, Number(raw.totalPages ?? 1)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { load(); }, [tab, page]);

  const fmt = (paise: number) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filtered = search.trim()
    ? data.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.orderNumber.toLowerCase().includes(q) ||
          (r.shippingName ?? '').toLowerCase().includes(q) ||
          (r.shippingCity ?? '').toLowerCase().includes(q) ||
          (r.trackingNumber ?? r.shiprocketAwb ?? '').toLowerCase().includes(q)
        );
      })
    : data;

  const columns: Column<AdminOrderRow>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      render: (r) => <span className="font-mono font-semibold text-ink-900">#{r.orderNumber}</span>,
    },
    {
      key: 'customer',
      header: 'Recipient',
      render: (r) => (
        <div>
          <p className="text-ink-900 font-medium">{r.shippingName || '—'}</p>
          <p className="text-xs text-ink-400">{r.shippingCity || ''}</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (r) => (
        <span className="text-ink-500 text-xs">
          {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    { key: 'status', header: 'Fulfilment', render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: 'paymentStatus', header: 'Payment', render: (r) => <Badge variant={statusVariant(r.paymentStatus)}>{r.paymentStatus}</Badge> },
    {
      key: 'total',
      header: 'Total',
      render: (r) => (
        <div className="text-right">
          <p className="font-semibold text-ink-900">{fmt(r.totalPaise)}</p>
          {r.refundedPaise > 0 && <p className="text-[11px] text-red-600">Refunded {fmt(r.refundedPaise)}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${r.id}`)}>Manage →</Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${total} orders total`}
        actions={
          <Button variant="outline" onClick={() => navigate('/payments')}>
            Payments Command Center →
          </Button>
        }
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs active={tab} onChange={(t) => setTab(t)} tabs={STATUS_TABS} />
        <div className="ml-auto">
          <SearchBar value={search} onChange={setSearch} placeholder="Search order #, recipient, AWB…" />
        </div>
      </div>
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No orders found" description="Orders will appear here once customers begin placing them." />
        ) : (
          <>
            <DataTable columns={columns} data={filtered} onRowClick={(r) => navigate(`/orders/${r.id}`)} />
            <div className="flex justify-between items-center px-4 py-3 border-t border-ink-100">
              <span className="text-sm text-ink-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
                <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
