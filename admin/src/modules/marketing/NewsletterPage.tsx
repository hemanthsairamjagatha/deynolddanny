import { useEffect, useState } from 'react';
import { PageHeader, Card, KpiCard, Button, Badge, SearchBar, Tabs, Spinner, EmptyState } from '../../components/ui';
import { newsletter as newsletterApi } from '../../lib/api';

interface SubscriberRow {
  id: string;
  email: string;
  status: 'active' | 'unsubscribed';
  created_at: string;
}

export default function NewsletterPage() {
  const [items, setItems] = useState<SubscriberRow[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, unsubscribed: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await newsletterApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: search || undefined,
      });
      if (res.success && res.data) {
        setItems((res.data.items ?? []) as unknown as SubscriberRow[]);
        if (res.data.stats) setStats(res.data.stats);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, search]);

  async function toggleStatus(row: SubscriberRow) {
    const next = row.status === 'active' ? 'unsubscribed' : 'active';
    await newsletterApi.updateStatus(row.id, next);
    setNotice(`${row.email} marked as ${next}.`);
    await load();
  }

  async function remove(row: SubscriberRow) {
    if (!confirm(`Permanently remove ${row.email} from newsletter list?`)) return;
    await newsletterApi.delete(row.id);
    setNotice(`Removed ${row.email}.`);
    await load();
  }

  function exportCsv() {
    const header = 'email,status,subscribed_at\n';
    const body = items.map((r) => `"${r.email.replace(/"/g, '""')}",${r.status},${r.created_at}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deynold-danny-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Newsletter & Atelier Audience"
        description="Manage editorial newsletter opt-ins, unsubscribe compliance, and export subscriber lists."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
            Export CSV ({items.length})
          </Button>
        }
      />

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Subscribers" value={String(stats.total)} />
        <KpiCard label="Active Opt-Ins" value={String(stats.active)} />
        <KpiCard label="Unsubscribed" value={String(stats.unsubscribed)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs
          active={statusFilter}
          onChange={setStatusFilter}
          tabs={[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'active', label: `Active (${stats.active})` },
            { id: 'unsubscribed', label: `Unsubscribed (${stats.unsubscribed})` },
          ]}
        />
        <div className="ml-auto">
          <SearchBar value={search} onChange={setSearch} placeholder="Search subscriber email…" />
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState title="No subscribers found" description="Footer newsletter sign-ups appear here automatically." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 border-b border-ink-200">
                {['Email Address', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50/50">
                  <td className="py-3 px-4 font-medium text-ink-900">{r.email}</td>
                  <td className="py-3 px-4">
                    <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-ink-500">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(r)}>
                        {r.status === 'active' ? 'Unsubscribe' : 'Re-activate'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
