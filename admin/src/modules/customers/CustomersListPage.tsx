import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Button, Spinner, SearchBar, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { customers as customersApi } from '../../lib/api';
import type { Customer } from '../../lib/types';

export default function CustomersListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const res = await customersApi.list({ search: search || undefined, page });
      const raw = res.data as unknown as { items?: Customer[]; customers?: Customer[]; total?: number } | Customer[];
      setData(Array.isArray(raw) ? raw : (raw?.items ?? raw?.customers ?? []));
      setTotal(Array.isArray(raw) ? raw.length : Number(raw?.total ?? 0));
    } finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { load(); }, [search, page]);

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: 'Name', render: r => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-700 font-semibold text-sm">
            {((r.full_name ?? r.email)?.[0] ?? '?').toUpperCase()}
          </div>
          <span className="font-medium text-ink-900">{r.full_name ?? '—'}</span>
        </div>
      )
    },
    { key: 'email', header: 'Email', render: r => <a href={`mailto:${r.email}`} className="text-ink-700 hover:text-gold-600">{r.email}</a> },
    { key: 'phone', header: 'Phone', render: r => <span className="text-ink-500">{r.phone ?? '—'}</span> },
    { key: 'orders_count', header: 'Orders', render: r => <span className="font-medium text-ink-900">{r.orders_count ?? 0}</span> },
    { key: 'created_at', header: 'Joined', render: r => <span className="text-ink-500 text-sm">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span> },
    { key: 'actions', header: '', render: r => <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${r.id}`)}>View →</Button> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${total} registered customers`} />
      <div className="flex justify-end">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
      </div>
      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : data.length === 0 ? (
          <EmptyState title="No customers found" description="Customers appear here when they create an account." />
        ) : (
          <>
            <DataTable columns={columns} data={data} onRowClick={r => navigate(`/customers/${r.id}`)} />
            <div className="flex justify-between items-center px-4 py-3 border-t border-ink-100">
              <span className="text-sm text-ink-500">{total} total · Page {page}</span>
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
