import { useEffect, useState } from 'react';
import { PageHeader, Card, KpiCard, DataTable, Button, Spinner, EmptyState, SectionHeader, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { analytics as analyticsApi } from '../../lib/api';

interface DailyPoint { date: string; revenue_paise?: number; revenue?: number; orders?: number; }
interface TopProduct extends Record<string, unknown> { id?: string; name: string; units_sold?: number; quantity?: number; revenue_paise?: number; }
interface EventRow extends Record<string, unknown> { id: string; event_type: string; path?: string; created_at: string; metadata_json?: string; }

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(period: number) {
    setLoading(true);
    try {
      const [dRes, eRes] = await Promise.all([
        analyticsApi.dashboard(period),
        analyticsApi.events({ limit: 30 }),
      ]);
      setSummary(dRes.data ?? null);
      const rawEv = eRes.data as unknown;
      setEvents((Array.isArray(rawEv) ? rawEv : (rawEv as { events?: EventRow[] })?.events ?? []) as EventRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  const fmtInr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const totalRevenuePaise = Number((summary?.totalRevenuePaise ?? summary?.total_revenue_paise ?? (summary?.kpis as Record<string, unknown>)?.totalRevenuePaise ?? 0));
  const ordersCount = Number((summary?.ordersCount ?? summary?.orders_count ?? (summary?.kpis as Record<string, unknown>)?.ordersCount ?? 0));
  const avgOrderPaise = ordersCount > 0 ? Math.round(totalRevenuePaise / ordersCount) : Number(summary?.aovPaise ?? 0);
  const lowStockCount = Number((summary?.lowStockCount ?? summary?.low_stock_count ?? (summary?.kpis as Record<string, unknown>)?.lowStockCount ?? 0));
  const dailySeries = ((summary?.daily ?? summary?.revenueByDay ?? []) as DailyPoint[]);
  const topProducts = ((summary?.topProducts ?? summary?.top_products ?? []) as TopProduct[]);

  const maxDaily = Math.max(1, ...dailySeries.map(d => Number(d.revenue_paise ?? d.revenue ?? 0)));

  const topCols: Column<TopProduct>[] = [
    { key: 'name', header: 'Product', render: r => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'units', header: 'Units Sold', render: r => <span className="text-ink-700">{Number(r.units_sold ?? r.quantity ?? 0)}</span> },
    { key: 'revenue', header: 'Revenue', render: r => <span className="font-semibold text-ink-900">{fmtInr(Number(r.revenue_paise ?? 0))}</span> },
  ];

  const eventCols: Column<EventRow>[] = [
    { key: 'event_type', header: 'Event', render: r => <Badge variant="gold">{r.event_type}</Badge> },
    { key: 'path', header: 'Path', render: r => <code className="text-xs text-ink-600">{r.path ?? '—'}</code> },
    { key: 'created_at', header: 'Timestamp', render: r => <span className="text-xs text-ink-500">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commerce Analytics"
        description="Track revenue trajectory, average order value, bestselling silhouettes, and live storefront telemetry."
        actions={
          <div className="flex gap-1.5 bg-ink-100 p-1 rounded-xl">
            {[7, 30, 90].map(p => (
              <Button
                key={p}
                size="sm"
                variant={days === p ? 'primary' : 'ghost'}
                onClick={() => setDays(p)}
              >
                {p}D
              </Button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-24"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={`Revenue (${days}D)`} value={fmtInr(totalRevenuePaise)} sub="Gross captured & paid" />
            <KpiCard label={`Orders (${days}D)`} value={ordersCount} sub="Confirmed orders" />
            <KpiCard label="Average Order Value" value={fmtInr(avgOrderPaise)} sub="Per transaction" />
            <KpiCard label="Low Stock Alerts" value={lowStockCount} sub="Variants below threshold" />
          </div>

          <Card>
            <SectionHeader title="Daily Revenue Trajectory" description={`Revenue curve over the past ${days} days`} />
            {dailySeries.length === 0 ? (
              <EmptyState title="No revenue data for this window" description="Daily revenue bars will populate once orders are recorded." />
            ) : (
              <div className="overflow-x-auto pt-2">
                <svg className="w-full h-44" viewBox={`0 0 ${Math.max(400, dailySeries.length * 24)} 150`} preserveAspectRatio="none">
                  {dailySeries.map((pt, idx) => {
                    const val = Number(pt.revenue_paise ?? pt.revenue ?? 0);
                    const barH = Math.max(3, Math.round((val / maxDaily) * 115));
                    const x = idx * 24 + 6;
                    return (
                      <g key={pt.date ?? idx}>
                        <rect x={x} y={130 - barH} width={14} height={barH} rx={3} className="fill-gold-500 hover:fill-ink-900 transition-colors">
                          <title>{`${pt.date}: ${fmtInr(val)}`}</title>
                        </rect>
                      </g>
                    );
                  })}
                  <line x1="0" y1="132" x2={Math.max(400, dailySeries.length * 24)} y2="132" stroke="#E5E5E0" strokeWidth="1" />
                </svg>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card padding={false}>
              <div className="p-5 pb-2"><SectionHeader title="Top Performing Pieces" description="Highest grossing garments in period" /></div>
              <DataTable columns={topCols} data={topProducts} emptyTitle="No sales recorded yet" />
            </Card>
            <Card padding={false}>
              <div className="p-5 pb-2"><SectionHeader title="Recent Storefront Events" description="Latest consent-gated telemetry events" /></div>
              <DataTable columns={eventCols} data={events} emptyTitle="No telemetry events yet" />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
