import { useEffect, useState } from 'react';
import { PageHeader, Card, KpiCard, Button, Badge, Spinner, SectionHeader } from '../../components/ui';
import { system as systemApi } from '../../lib/api';

export default function SystemHealthPage() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await systemApi.health();
      if (res.success && res.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFlushCache() {
    setRunningAction('cache');
    setError('');
    setNotice('');
    try {
      const res = await systemApi.flushCache();
      if (!res.success) { setError(res.error?.message ?? 'Cache flush failed'); return; }
      setNotice('All Cloudflare Edge KV storefront & catalog caches purged!');
      await load();
    } finally {
      setRunningAction('');
    }
  }

  async function handleReapHolds() {
    setRunningAction('reap');
    setError('');
    setNotice('');
    try {
      const res = await systemApi.reapHolds();
      if (!res.success) { setError(res.error?.message ?? 'Hold cleanup failed'); return; }
      setNotice(`Released ${res.data?.releasedItems ?? 0} held item(s) across ${res.data?.cancelledOrders ?? 0} expired checkout order(s).`);
      await load();
    } finally {
      setRunningAction('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  const services = (data?.services ?? {}) as Record<string, { ok: boolean; detail: string }>;
  const metrics = (data?.metrics ?? {}) as Record<string, number>;
  const configIssues = (data?.configIssues ?? []) as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health & Edge Operations"
        description="Live status of Cloudflare D1, Edge KV, R2 Media, Resend Email, Payment Gateways, Shiprocket & maintenance triggers."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" loading={runningAction === 'reap'} onClick={handleReapHolds}>
              Release Expired Stock Holds
            </Button>
            <Button variant="outline" loading={runningAction === 'cache'} onClick={handleFlushCache}>
              Flush All Edge Caches
            </Button>
            <Button onClick={load}>Re-check Now</Button>
          </div>
        }
      />

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {configIssues.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">
          <p className="font-semibold text-sm mb-1">Runtime Configuration Warnings ({configIssues.length})</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            {configIssues.map((issue, idx) => <li key={idx}>{issue}</li>)}
          </ul>
        </div>
      )}

      {/* Database & Operations Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Products" value={String(metrics.activeProducts ?? 0)} sub={`${metrics.activeVariants ?? 0} active size variants`} />
        <KpiCard label="Total Orders" value={String(metrics.totalOrders ?? 0)} sub={`${metrics.expiredPendingHolds ?? 0} expired holds`} />
        <KpiCard label="Customers & Audience" value={String(metrics.customers ?? 0)} sub={`${metrics.newsletterSubscribers ?? 0} newsletter opt-ins`} />
        <KpiCard label="Failed Queues / Hooks" value={String((metrics.failedEmails ?? 0) + (metrics.failedWebhooks ?? 0))} sub={`${metrics.failedEmails ?? 0} emails · ${metrics.failedWebhooks ?? 0} webhooks`} />
      </div>

      {/* Infrastructure Services Grid */}
      <Card>
        <SectionHeader
          title="Infrastructure & Integrations Status"
          description={`Environment: ${data?.environment ?? 'production'} · Catalog cache version: ${data?.catalogVersion ?? 'v1'}`}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(services).map(([key, svc]) => (
            <div key={key} className="p-4 rounded-xl border border-ink-200 flex items-start justify-between gap-3 bg-ink-50/30">
              <div>
                <p className="text-sm font-semibold text-ink-900 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-xs text-ink-500 mt-0.5">{svc.detail}</p>
              </div>
              <Badge variant={svc.ok ? 'success' : 'warning'}>{svc.ok ? 'HEALTHY' : 'ATTENTION'}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
