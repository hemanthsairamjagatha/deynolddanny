import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, statusVariant, Modal, Select, Input, Textarea, Spinner, InfoTooltip } from '../../components/ui';
import { orders as ordersApi } from '../../lib/api';
import type { Order } from '../../lib/types';

type ModalType = 'status' | 'cancel' | 'refund' | null;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', awb_code: '' });
  const [cancelForm, setCancelForm] = useState({ reason: '' });
  const [refundForm, setRefundForm] = useState({ amount_rupees: '', reason: '' });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await ordersApi.get(id);
      const raw = res.data as unknown as { order?: Order } | Order | undefined;
      setOrder((raw && 'order' in raw && raw.order ? raw.order : raw ?? null) as Order | null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  async function handleUpdateStatus() {
    if (!id) return;
    setSaving(true);
    try { await ordersApi.updateStatus(id, statusForm.status, statusForm.awb_code || undefined); setModal(null); load(); } finally { setSaving(false); }
  }
  async function handleCancel() {
    if (!id) return;
    setSaving(true);
    try { await ordersApi.cancel(id, cancelForm.reason); setModal(null); load(); } finally { setSaving(false); }
  }
  async function handleRefund() {
    if (!id) return;
    setSaving(true);
    try { await ordersApi.refund(id, Math.round(Number(refundForm.amount_rupees) * 100), refundForm.reason); setModal(null); load(); } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!order) return <div className="text-center py-24 text-ink-500">Order not found.</div>;

  const canCancel = !['cancelled', 'fulfilled'].includes(order.status);
  const canRefund = ['fulfilled', 'processing'].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/orders')} className="text-sm text-ink-500 hover:text-ink-900 mb-2 flex items-center gap-1">← All Orders</button>
          <PageHeader
            title={`Order #${order.display_id ?? order.id.slice(-6).toUpperCase()}`}
            description={`Placed ${new Date(order.created_at).toLocaleString('en-IN')}`}
          />
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Badge variant={statusVariant(order.status)} size="lg">{order.status}</Badge>
          <Button size="sm" onClick={() => { setStatusForm({ status: order.status, awb_code: order.awb_code ?? '' }); setModal('status'); }}>Update Status</Button>
          {canCancel && <Button size="sm" variant="danger" onClick={() => { setCancelForm({ reason: '' }); setModal('cancel'); }}>Cancel Order</Button>}
          {canRefund && <Button size="sm" variant="ghost" onClick={() => { setRefundForm({ amount_rupees: String((order.total_paise ?? 0) / 100), reason: '' }); setModal('refund'); }}>Issue Refund</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer */}
        <Card title="Customer">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-ink-500">Email</dt><dd className="text-ink-900 font-medium">{order.customer_email ?? '—'}</dd></div>
            <div><dt className="text-ink-500">User ID</dt><dd className="text-ink-600 font-mono text-xs">{order.user_id ?? '—'}</dd></div>
          </dl>
        </Card>

        {/* Delivery */}
        <Card title="Delivery Address">
          {order.delivery_address ? (
            <address className="not-italic text-sm text-ink-700 leading-relaxed">
              <strong>{order.delivery_address.name}</strong><br />
              {order.delivery_address.line1}<br />
              {order.delivery_address.line2 && <>{order.delivery_address.line2}<br /></>}
              {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.pincode}<br />
              {order.delivery_address.country}<br />
              {order.delivery_address.phone && <span className="text-ink-500">{order.delivery_address.phone}</span>}
            </address>
          ) : <span className="text-ink-400 text-sm">No address recorded.</span>}
          {order.awb_code && (
            <div className="mt-3 pt-3 border-t border-ink-100">
              <span className="text-ink-500 text-xs">AWB / Tracking</span>
              <code className="block font-mono text-sm text-ink-900 mt-0.5">{order.awb_code}</code>
            </div>
          )}
        </Card>

        {/* Summary */}
        <Card title="Order Summary">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd>{fmt(order.subtotal_paise ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Shipping</dt><dd>{fmt(order.shipping_paise ?? 0)}</dd></div>
            {(order.discount_paise ?? 0) > 0 && <div className="flex justify-between"><dt className="text-ink-500">Discount</dt><dd className="text-emerald-600">-{fmt(order.discount_paise ?? 0)}</dd></div>}
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-ink-100"><dt>Total</dt><dd>{fmt(order.total_paise ?? 0)}</dd></div>
          </dl>
          {order.coupon_code && <p className="text-xs text-ink-400 mt-2">Coupon: <code>{order.coupon_code}</code></p>}
        </Card>
      </div>

      {/* Line Items */}
      <Card title="Line Items">
        <div className="divide-y divide-ink-100">
          {(order.items ?? []).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-4 py-3">
              {item.image_url && <img src={item.image_url} alt={item.name} className="w-14 h-18 object-cover rounded" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 truncate">{item.name}</p>
                <p className="text-xs text-ink-500">{item.sku} · {item.color} · {item.size}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-ink-900">{fmt(item.unit_price_paise * item.quantity)}</p>
                <p className="text-ink-500">Qty {item.quantity} × {fmt(item.unit_price_paise)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Update Status Modal */}
      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Update Order Status">
        <div className="space-y-4">
          <div>
            <label className="label-sm flex items-center gap-1">New Status <InfoTooltip content="Set the order's fulfilment status. Customers receive email notifications on key transitions." /></label>
            <Select value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}>
              {['pending', 'processing', 'shipped', 'fulfilled', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          {statusForm.status === 'shipped' && (
            <div>
              <label className="label-sm flex items-center gap-1">AWB / Tracking Code <InfoTooltip content="Courier's airway bill number used for shipment tracking." /></label>
              <Input value={statusForm.awb_code} onChange={e => setStatusForm(f => ({ ...f, awb_code: e.target.value }))} placeholder="1234567890" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleUpdateStatus}>Update Status</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel Order">
        <div className="space-y-4">
          <p className="text-sm text-ink-500">This will cancel the order and release reserved stock. This action cannot be undone.</p>
          <div>
            <label className="label-sm flex items-center gap-1">Cancellation Reason <InfoTooltip content="Reason sent to the customer and recorded in the audit trail." /></label>
            <Textarea value={cancelForm.reason} onChange={e => setCancelForm({ reason: e.target.value })} placeholder="Out of stock, customer request, etc." rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Back</Button>
            <Button variant="danger" loading={saving} onClick={handleCancel}>Cancel Order</Button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal open={modal === 'refund'} onClose={() => setModal(null)} title="Issue Refund">
        <div className="space-y-4">
          <div>
            <label className="label-sm flex items-center gap-1">Refund Amount (₹) <InfoTooltip content="Enter the amount in Rupees. For a full refund enter the total order value." /></label>
            <Input type="number" value={refundForm.amount_rupees} onChange={e => setRefundForm(f => ({ ...f, amount_rupees: e.target.value }))} placeholder="0.00" />
          </div>
          <div>
            <label className="label-sm flex items-center gap-1">Reason <InfoTooltip content="Internal reason for the refund, recorded in the audit trail." /></label>
            <Textarea value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} placeholder="Defective item, wrong product, etc." rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleRefund} disabled={!refundForm.amount_rupees}>Issue Refund</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
