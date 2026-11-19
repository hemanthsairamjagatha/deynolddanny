import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Spinner, Badge, statusVariant } from '../../components/ui';
import { customers as customersApi } from '../../lib/api';
import type { Customer, Order } from '../../lib/types';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    customersApi.get(id).then(res => {
      const raw = res.data as unknown as { customer?: Customer; orders?: Order[]; addresses?: unknown[] } | Customer | undefined;
      setCustomer((raw && 'customer' in raw && raw.customer ? raw.customer : raw ?? null) as Customer | null);
      setOrderHistory((raw && 'orders' in raw && Array.isArray(raw.orders) ? raw.orders : []) as Order[]);
      setAddresses((raw && 'addresses' in raw && Array.isArray(raw.addresses) ? raw.addresses : []) as any[]);
    }).finally(() => setLoading(false));
  }, [id]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!customer) return <div className="text-center py-24 text-ink-500">Customer not found.</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/customers')} className="text-sm text-ink-500 hover:text-ink-900 flex items-center gap-1">← All Customers</button>
      <PageHeader title={customer.full_name ?? customer.email} description={`Customer since ${new Date(customer.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile */}
        <Card title="Profile">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-ink-500 text-xs uppercase tracking-wide mb-0.5">Full Name</dt><dd className="text-ink-900 font-medium">{customer.full_name ?? '—'}</dd></div>
            <div><dt className="text-ink-500 text-xs uppercase tracking-wide mb-0.5">Email</dt><dd className="text-ink-700">{customer.email}</dd></div>
            <div><dt className="text-ink-500 text-xs uppercase tracking-wide mb-0.5">Phone</dt><dd className="text-ink-700">{customer.phone ?? '—'}</dd></div>
            <div><dt className="text-ink-500 text-xs uppercase tracking-wide mb-0.5">Account ID</dt><dd className="font-mono text-xs text-ink-400">{customer.id}</dd></div>
            <div><dt className="text-ink-500 text-xs uppercase tracking-wide mb-0.5">Total Orders</dt><dd className="text-ink-900 font-semibold">{orderHistory.length}</dd></div>
            <div><dt className="text-ink-500 text-xs uppercase tracking-wide mb-0.5">Total Spend</dt><dd className="text-ink-900 font-semibold">{fmt(orderHistory.reduce((s, o) => s + (o.total_paise ?? 0), 0))}</dd></div>
          </dl>
        </Card>

        {/* Addresses */}
        <Card title="Address Book" className="md:col-span-2">
          {addresses.length === 0 ? (
            <p className="text-sm text-ink-400">No saved addresses.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((addr: any, i: number) => (
                <div key={i} className="border border-ink-100 rounded-lg p-3 text-sm">
                  {addr.is_default && <span className="text-xs text-gold-700 font-medium bg-gold-50 px-1.5 py-0.5 rounded mb-2 inline-block">Default</span>}
                  <address className="not-italic text-ink-700 leading-relaxed">
                    <strong>{addr.name}</strong><br />
                    {addr.line1}<br />
                    {addr.line2 && <>{addr.line2}<br /></>}
                    {addr.city}, {addr.state} {addr.pincode}<br />
                    {addr.phone}
                  </address>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Order History */}
      <Card title="Order History">
        {orderHistory.length === 0 ? (
          <p className="text-sm text-ink-400">No orders placed yet.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {orderHistory.map((order: Order) => (
              <div key={order.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-mono font-semibold text-ink-900">#{order.display_id ?? order.id.slice(-6).toUpperCase()}</span>
                  <span className="ml-3 text-sm text-ink-500">{new Date(order.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  <span className="font-semibold text-ink-900">{fmt(order.total_paise ?? 0)}</span>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${order.id}`)}>View</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
