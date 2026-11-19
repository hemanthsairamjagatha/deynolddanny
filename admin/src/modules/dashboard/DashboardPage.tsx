import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard as dashApi } from '../../lib/api';
import { PageHeader, KpiCard, Card, Skeleton, Badge, statusVariant } from '../../components/ui';

function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function BarChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const H = 100;
  return (
    <div className="flex items-end gap-0.5 h-28 w-full overflow-hidden">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${fmt(d.revenue)}`}>
          <div
            className="w-full bg-gold-400 rounded-t-sm group-hover:bg-gold-500 transition-colors"
            style={{ height: `${Math.max(2, (d.revenue / max) * H)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    dashApi.get(days).then(res => {
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [days]);

  const overview = (data?.overview ?? {}) as Record<string, number>;
  const revenue = (data?.revenue ?? []) as Array<{ date: string; revenue: number }>;
  const topProducts = (data?.topProducts ?? []) as Array<Record<string, unknown>>;
  const recentOrders = (data?.recentOrders ?? []) as Array<Record<string, unknown>>;
  const lowStock = (data?.lowStock ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Business overview and key performance metrics."
        actions={
          <div className="flex gap-1 p-1 bg-ink-100 rounded-lg">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${days === d ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Total Revenue" value={fmt(overview.totalRevenuePaise ?? 0)} sub={`Last ${days} days`} />
          <KpiCard label="Orders" value={(overview.totalOrders ?? 0).toString()} sub={`Last ${days} days`} />
          <KpiCard label="Avg Order Value" value={fmt(overview.totalOrders ? Math.round((overview.totalRevenuePaise ?? 0) / (overview.totalOrders as number)) : 0)} />
          <KpiCard label="Active Products" value={(overview.activeProducts ?? 0).toString()} sub={`${lowStock.length} low stock`} trend={lowStock.length > 0 ? { value: `${lowStock.length} need attention`, positive: false } : undefined} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Revenue</h2>
              <p className="text-xs text-ink-500">Daily revenue over {days} days</p>
            </div>
            <span className="text-xs font-medium text-gold-600">{fmt(overview.totalRevenuePaise ?? 0)}</span>
          </div>
          {loading ? <Skeleton className="h-28" /> : <BarChart data={revenue} />}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'View Pending Orders', path: '/orders', color: 'text-blue-600' },
              { label: 'Review Inventory', path: '/inventory', color: 'text-amber-600' },
              { label: 'Moderate Reviews', path: '/reviews', color: 'text-purple-600' },
              { label: 'Edit Homepage', path: '/studio', color: 'text-gold-600' },
              { label: 'Brand Settings', path: '/brand', color: 'text-ink-600' },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-ink-50 transition-colors group text-left"
              >
                <span className={`text-sm font-medium ${a.color}`}>{a.label}</span>
                <svg className="w-4 h-4 text-ink-400 group-hover:text-ink-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-ink-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Recent Orders</h2>
            <button onClick={() => navigate('/orders')} className="text-xs text-gold-600 hover:text-gold-800 font-medium">View all →</button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : recentOrders.length === 0 ? (
            <p className="p-6 text-sm text-ink-400 text-center">No orders yet</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {recentOrders.slice(0, 5).map((o, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-ink-50 cursor-pointer transition-colors" onClick={() => navigate(`/orders/${o.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{(o.display_id as string) ?? (o.id as string)?.slice(0, 8)}</p>
                    <p className="text-xs text-ink-400">{o.customer_email as string ?? 'Guest'}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusVariant(o.status as string)}>{o.status as string}</Badge>
                    <p className="text-xs text-ink-500 mt-1">{fmt((o.total_paise as number) ?? 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Low Stock */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-ink-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Low Stock Alerts</h2>
            <button onClick={() => navigate('/inventory')} className="text-xs text-gold-600 hover:text-gold-800 font-medium">View all →</button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : lowStock.length === 0 ? (
            <p className="p-6 text-sm text-ink-400 text-center">All inventory levels are healthy ✓</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {lowStock.map((v, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{v.product_name as string ?? 'Unknown'}</p>
                    <p className="text-xs text-ink-400">{v.sku as string} · {v.color as string} · {v.size as string}</p>
                  </div>
                  <Badge variant={(v.stock as number) === 0 ? 'danger' : 'warning'}>
                    {v.stock as number} left
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Products */}
        {topProducts.length > 0 && (
          <Card className="p-0 overflow-hidden lg:col-span-2">
            <div className="p-5 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-900">Top Products</h2>
              <p className="text-xs text-ink-500 mt-0.5">By revenue in last {days} days</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 border-b border-ink-100">
                {['#', 'Product', 'Units Sold', 'Revenue'].map(h => (
                  <th key={h} className="text-left py-2.5 px-5 text-xs font-semibold text-ink-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {topProducts.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-ink-50/50 transition-colors">
                    <td className="py-3 px-5 text-xs font-bold text-ink-400">#{i + 1}</td>
                    <td className="py-3 px-5 font-medium text-ink-900">{p.name as string}</td>
                    <td className="py-3 px-5 text-ink-600">{p.units_sold as number}</td>
                    <td className="py-3 px-5 text-ink-900 font-medium">{fmt((p.revenue_paise as number) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
