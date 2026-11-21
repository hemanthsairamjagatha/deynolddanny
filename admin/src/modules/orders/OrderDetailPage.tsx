import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, statusVariant, Modal, Select, Input, Textarea, Spinner, InfoTooltip } from '../../components/ui';
import { orders as ordersApi, payments as paymentsApi } from '../../lib/api';

type ModalType = 'status' | 'tracking' | 'cancel' | 'refund' | 'mark_paid' | 'adjust' | null;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [statusForm, setStatusForm] = useState({ status: '', reason: '' });
  const [trackingForm, setTrackingForm] = useState({ courierPartner: '', trackingNumber: '' });
  const [cancelForm, setCancelForm] = useState({ reason: '' });
  const [refundForm, setRefundForm] = useState({ amount_rupees: '', reason: '', restockItems: false });
  const [markPaidForm, setMarkPaidForm] = useState({ paymentMethod: 'upi_manual', referenceNumber: '', reason: '' });
  const [adjustForm, setAdjustForm] = useState({ adjustmentRupees: '0', shippingRupees: '', discountRupees: '', reason: '' });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await ordersApi.get(id);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setOrder(null);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]);

  const fmt = (paise: number) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  async function handleUpdateStatus() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.updateStatus(id, statusForm.status, statusForm.reason || undefined);
      if (!res.success) { setError(res.error?.message ?? 'Status update failed.'); return; }
      setModal(null);
      setNotice(`Order status updated to "${statusForm.status}".`);
      await load();
    } finally { setSaving(false); }
  }

  async function handleUpdateTracking() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.updateTracking(id, trackingForm.courierPartner, trackingForm.trackingNumber);
      if (!res.success) { setError(res.error?.message ?? 'Tracking update failed.'); return; }
      setModal(null);
      setNotice('Courier tracking updated & shipping notification sent to customer.');
      await load();
    } finally { setSaving(false); }
  }

  async function handleBookShiprocket() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.ship(id);
      if (!res.success) { setError(res.error?.message ?? 'Shiprocket booking failed.'); return; }
      setNotice(`Shiprocket shipment booked! AWB: ${(res.data as any)?.awbCode ?? 'Assigned'}`);
      await load();
    } finally { setSaving(false); }
  }

  async function handleReconcile() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.reconcile(id);
      if (!res.success) { setError(res.error?.message ?? 'Gateway reconciliation failed.'); return; }
      const d = res.data as Record<string, any> | undefined;
      setNotice(d?.reconciled ? 'Payment verified & captured from gateway!' : `Gateway status: ${d?.gatewayStatus ?? d?.reason ?? 'Not paid'}`);
      await load();
    } finally { setSaving(false); }
  }

  async function handleMarkPaid() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await paymentsApi.markPaid(id, markPaidForm);
      if (!res.success) { setError(res.error?.message ?? 'Manual capture failed.'); return; }
      setModal(null);
      setNotice('Order marked PAID and stock committed atomically.');
      await load();
    } finally { setSaving(false); }
  }

  async function handleAdjustAmount() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const payload: { adjustmentPaise?: number; shippingPaise?: number; discountPaise?: number; reason: string } = { reason: adjustForm.reason };
      if (adjustForm.adjustmentRupees.trim() !== '') payload.adjustmentPaise = Math.round(parseFloat(adjustForm.adjustmentRupees) * 100);
      if (adjustForm.shippingRupees.trim() !== '') payload.shippingPaise = Math.max(0, Math.round(parseFloat(adjustForm.shippingRupees) * 100));
      if (adjustForm.discountRupees.trim() !== '') payload.discountPaise = Math.max(0, Math.round(parseFloat(adjustForm.discountRupees) * 100));
      const res = await paymentsApi.adjustAmount(id, payload);
      if (!res.success) { setError(res.error?.message ?? 'Adjustment failed.'); return; }
      setModal(null);
      setNotice(`Order total adjusted to ${(res.data as any)?.newTotalFormatted ?? 'new amount'}.`);
      await load();
    } finally { setSaving(false); }
  }

  async function handleCancel() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.cancel(id, cancelForm.reason);
      if (!res.success) { setError(res.error?.message ?? 'Cancellation failed.'); return; }
      setModal(null);
      setNotice('Order cancelled and stock/refund processed.');
      await load();
    } finally { setSaving(false); }
  }

  async function handleRefund() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const paise = Math.round(Number(refundForm.amount_rupees) * 100);
      const res = await ordersApi.refund(id, paise, refundForm.reason, refundForm.restockItems);
      if (!res.success) { setError(res.error?.message ?? 'Refund failed.'); return; }
      setModal(null);
      setNotice(`Refund of ${fmt(paise)} initiated.`);
      await load();
    } finally { setSaving(false); }
  }

  async function handleQuickStep(nextStatus: 'processing' | 'delivered') {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.updateStatus(
        id,
        nextStatus,
        nextStatus === 'processing' ? 'Moved to atelier inspection & tailoring' : 'Delivered to customer destination',
      );
      if (!res.success) {
        setError(res.error?.message ?? 'Status update failed.');
        return;
      }
      setNotice(`Order status updated to "${nextStatus}". Customer tracking timeline updated immediately.`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!order) return <div className="text-center py-24 text-ink-500">Order not found.</div>;

  const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded';
  const refundablePaise = Math.max(0, Number(order.totalPaise ?? 0) - Number(order.refundedPaise ?? 0));
  const canCancel = !['cancelled', 'delivered', 'refunded'].includes(order.status);
  const canShip = isPaid && ['confirmed', 'processing'].includes(order.status);
  const customerContact = order.customer?.email || order.shippingAddress?.phone || '';
  const trackingPreviewUrl = `/orders/track?order=${encodeURIComponent(order.orderNumber)}${customerContact ? `&contact=${encodeURIComponent(customerContact)}` : ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <button onClick={() => navigate('/orders')} className="text-sm text-ink-500 hover:text-ink-900 mb-2 flex items-center gap-1">
            ← All Orders
          </button>
          <PageHeader
            title={`Order #${order.orderNumber}`}
            description={`Placed ${new Date(order.createdAt).toLocaleString('en-IN')}`}
          />
        </div>
        <div className="flex gap-2 flex-wrap lg:justify-end items-center">
          <Badge variant={statusVariant(order.status)} size="md">{order.status}</Badge>
          <Badge variant={statusVariant(order.paymentStatus)} size="md">Payment: {order.paymentStatus}</Badge>
          {!isPaid && (
            <>
              <Button size="sm" variant="outline" loading={saving} onClick={handleReconcile}>Reconcile Payment</Button>
              <Button size="sm" onClick={() => { setMarkPaidForm({ paymentMethod: 'upi_manual', referenceNumber: '', reason: '' }); setModal('mark_paid'); }}>Mark Paid</Button>
              <Button size="sm" variant="secondary" onClick={() => { setAdjustForm({ adjustmentRupees: String((order.adminAdjustmentPaise ?? 0) / 100), shippingRupees: '', discountRupees: '', reason: '' }); setModal('adjust'); }}>Adjust Total</Button>
            </>
          )}
          {canShip && <Button size="sm" loading={saving} onClick={handleBookShiprocket}>Book Shiprocket</Button>}
          <Button size="sm" variant="outline" onClick={() => { setTrackingForm({ courierPartner: order.courierPartner ?? '', trackingNumber: order.trackingNumber ?? order.shiprocketAwb ?? '' }); setModal('tracking'); }}>Courier / AWB</Button>
          <Button size="sm" variant="outline" onClick={() => { setStatusForm({ status: order.status, reason: '' }); setModal('status'); }}>Update Status</Button>
          {isPaid && refundablePaise > 0 && (
            <Button size="sm" variant="danger" onClick={() => { setRefundForm({ amount_rupees: String(refundablePaise / 100), reason: '', restockItems: false }); setModal('refund'); }}>
              Issue Refund
            </Button>
          )}
          {canCancel && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setCancelForm({ reason: '' }); setModal('cancel'); }}>Cancel</Button>}
        </div>
      </div>

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Quick Fulfilment & Live Tracking Controls Bar */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-700 font-semibold">
              Order Fulfilment &amp; Live Tracking Controls
            </p>
            <p className="text-xs text-ink-600 mt-0.5">
              Advance this order through verified fulfilment stages or record a real courier AWB — updates reflect immediately on the customer tracking page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isPaid && (
              <Button
                size="sm"
                onClick={() => {
                  setMarkPaidForm({
                    paymentMethod: 'upi_manual',
                    referenceNumber: '',
                    reason: '',
                  });
                  setModal('mark_paid');
                }}
              >
                1. Verify &amp; Record Payment
              </Button>
            )}
            {isPaid && order.status === 'confirmed' && (
              <Button size="sm" variant="secondary" loading={saving} onClick={() => handleQuickStep('processing')}>
                2. Start Atelier Processing
              </Button>
            )}
            {canShip && (
              <Button
                size="sm"
                onClick={() => {
                  setTrackingForm({
                    courierPartner: order.courierPartner ?? '',
                    trackingNumber: order.trackingNumber ?? order.shiprocketAwb ?? '',
                  });
                  setModal('tracking');
                }}
              >
                3. Enter Courier &amp; AWB
              </Button>
            )}
            {order.status === 'shipped' && (
              <Button size="sm" loading={saving} onClick={() => handleQuickStep('delivered')}>
                4. Mark Delivered
              </Button>
            )}
            <a
              href={trackingPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-ink-900 bg-ink-100 hover:bg-ink-900 hover:text-white rounded-lg transition-colors"
            >
              Open Customer Tracking Page ↗
            </a>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer & Payment Metadata */}
        <Card>
          <h3 className="text-sm font-semibold text-ink-900 mb-3">Customer &amp; Payment</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-ink-500 text-xs">Name</dt><dd className="text-ink-900 font-medium">{order.customer?.full_name || order.shippingAddress?.fullName || '—'}</dd></div>
            <div><dt className="text-ink-500 text-xs">Email</dt><dd className="text-ink-900">{order.customer?.email ?? '—'}</dd></div>
            <div><dt className="text-ink-500 text-xs">Payment Method</dt><dd className="text-ink-800 uppercase text-xs font-mono">{order.paymentMethod ?? 'Pending'}</dd></div>
            {order.cfOrderId && <div><dt className="text-ink-500 text-xs">Gateway Order ID</dt><dd className="font-mono text-xs text-ink-700">{order.cfOrderId}</dd></div>}
            {order.cfPaymentId && <div><dt className="text-ink-500 text-xs">Payment / UTR Ref</dt><dd className="font-mono text-xs text-emerald-700">{order.cfPaymentId}</dd></div>}
          </dl>
        </Card>

        {/* Delivery */}
        <Card>
          <h3 className="text-sm font-semibold text-ink-900 mb-3">Delivery &amp; Logistics</h3>
          {order.shippingAddress ? (
            <address className="not-italic text-sm text-ink-700 leading-relaxed">
              <strong>{order.shippingAddress.fullName}</strong><br />
              {order.shippingAddress.line1}<br />
              {order.shippingAddress.line2 && <>{order.shippingAddress.line2}<br /></>}
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}<br />
              {order.shippingAddress.country}<br />
              <span className="text-ink-500">{order.shippingAddress.phone}</span>
            </address>
          ) : <span className="text-ink-400 text-sm">No address recorded.</span>}
          {(order.trackingNumber || order.shiprocketAwb) && (
            <div className="mt-3 pt-3 border-t border-ink-100">
              <span className="text-ink-500 text-xs">{order.courierPartner || order.shiprocketCourier || 'Courier'} AWB</span>
              <code className="block font-mono text-sm text-ink-900 mt-0.5">{order.trackingNumber || order.shiprocketAwb}</code>
            </div>
          )}
        </Card>

        {/* Financial Breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-ink-900 mb-3">Financial Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd>{fmt(order.subtotalPaise ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Shipping</dt><dd>{fmt(order.shippingPaise ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">GST (Included)</dt><dd>{fmt(order.taxPaise ?? 0)}</dd></div>
            {(order.discountPaise ?? 0) > 0 && (
              <div className="flex justify-between"><dt className="text-ink-500">Discount</dt><dd className="text-emerald-600">-{fmt(order.discountPaise)}</dd></div>
            )}
            {(order.adminAdjustmentPaise ?? 0) !== 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Admin Adjustment</dt>
                <dd className={order.adminAdjustmentPaise < 0 ? 'text-emerald-600' : 'text-amber-700'}>
                  {order.adminAdjustmentPaise > 0 ? '+' : ''}{fmt(order.adminAdjustmentPaise)}
                </dd>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-ink-100"><dt>Total</dt><dd>{fmt(order.totalPaise ?? 0)}</dd></div>
            {(order.refundedPaise ?? 0) > 0 && (
              <div className="flex justify-between text-red-600 text-xs pt-1"><dt>Total Refunded</dt><dd>-{fmt(order.refundedPaise)}</dd></div>
            )}
          </dl>
          {order.couponCode && <p className="text-xs text-ink-400 mt-2">Coupon: <code>{order.couponCode}</code></p>}
          {order.adminAdjustmentReason && <p className="text-xs text-amber-700 mt-1">Adjustment note: {order.adminAdjustmentReason}</p>}
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <h3 className="text-sm font-semibold text-ink-900 mb-3">Line Items</h3>
        <div className="divide-y divide-ink-100">
          {(order.items ?? []).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-4 py-3">
              {(item.image_snapshot || item.image) && (
                <img src={item.image_snapshot || item.image} alt={item.title_snapshot || item.title} className="w-12 h-16 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 truncate">{item.title_snapshot ?? item.title}</p>
                <p className="text-xs text-ink-500">
                  {item.sku_snapshot ?? item.sku} · {item.color_snapshot ?? item.color} · Size {item.size_snapshot ?? item.size}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-ink-900">{fmt((item.unit_price_paise ?? item.unitPricePaise ?? 0) * item.quantity)}</p>
                <p className="text-xs text-ink-500">Qty {item.quantity} × {fmt(item.unit_price_paise ?? item.unitPricePaise ?? 0)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment Attempts & Audit Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-ink-900 mb-3">Payment Attempts ({(order.paymentAttempts ?? []).length})</h3>
          {(order.paymentAttempts ?? []).length === 0 ? (
            <p className="text-xs text-ink-500">No gateway attempts recorded.</p>
          ) : (
            <div className="space-y-2">
              {(order.paymentAttempts ?? []).map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl bg-ink-50 border border-ink-100 text-xs flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold uppercase text-ink-800">{a.gateway} · Attempt #{a.attempt_number}</p>
                    <p className="font-mono text-ink-500">{a.gateway_order_id ?? '—'}</p>
                    {a.gateway_payment_id && <p className="font-mono text-emerald-700">{a.gateway_payment_id}</p>}
                    {a.failure_reason && <p className="text-red-600 mt-0.5">{a.failure_reason}</p>}
                  </div>
                  <div className="text-right">
                    <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                    <p className="font-semibold text-ink-900 mt-1">{fmt(a.amount_paise)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-ink-900 mb-3">Order Audit Timeline ({(order.auditLogs ?? []).length})</h3>
          {(order.auditLogs ?? []).length === 0 ? (
            <p className="text-xs text-ink-500">No audit entries yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(order.auditLogs ?? []).map((l: any) => (
                <div key={l.id} className="p-2.5 rounded-lg border border-ink-100 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-ink-900">{l.action}</span>
                    <span className="text-ink-400">{new Date(l.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-ink-600 mt-0.5">{l.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Update Status Modal */}
      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Update Order Status">
        <div className="space-y-4">
          <Select
            label="New Fulfilment Status"
            value={statusForm.status}
            onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}
            options={[
              'pending',
              'awaiting_capture',
              'confirmed',
              'confirmed_needs_allocation',
              'processing',
              'shipped',
              'ndr_pending',
              'delivered',
              'return_requested',
              'returned',
              'cancelled',
              'refunded',
            ].map((s) => ({ value: s, label: s }))}
          />
          <Textarea label="Audit Reason (optional)" value={statusForm.reason} onChange={(e) => setStatusForm((f) => ({ ...f, reason: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleUpdateStatus}>Update Status</Button>
          </div>
        </div>
      </Modal>

      {/* Courier / Tracking Modal */}
      <Modal open={modal === 'tracking'} onClose={() => setModal(null)} title="Update Courier & AWB Tracking">
        <div className="space-y-4">
          <Input label="Courier Partner" value={trackingForm.courierPartner} onChange={(e) => setTrackingForm((f) => ({ ...f, courierPartner: e.target.value }))} placeholder="BlueDart / Delhivery / DHL Express" />
          <Input label="Tracking / AWB Number" value={trackingForm.trackingNumber} onChange={(e) => setTrackingForm((f) => ({ ...f, trackingNumber: e.target.value }))} placeholder="AWB1234567890" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleUpdateTracking} disabled={!trackingForm.courierPartner.trim() || !trackingForm.trackingNumber.trim()}>Save &amp; Notify Customer</Button>
          </div>
        </div>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal open={modal === 'mark_paid'} onClose={() => setModal(null)} title="Manual Payment Verification">
        <div className="space-y-4">
          <Select
            label="Payment Channel"
            value={markPaidForm.paymentMethod}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            options={[
              { value: 'upi_manual', label: 'Direct UPI (UTR Verified)' },
              { value: 'bank_transfer', label: 'Bank Wire (NEFT/RTGS/IMPS)' },
              { value: 'cod_collected', label: 'Cash on Delivery Collected' },
              { value: 'atelier_pos', label: 'In-Boutique / Atelier POS' },
              { value: 'razorpay_manual', label: 'Razorpay Manual Link' },
              { value: 'cashfree_manual', label: 'Cashfree Manual Link' },
            ]}
          />
          <Input label="UTR / Payment Reference" value={markPaidForm.referenceNumber} onChange={(e) => setMarkPaidForm((f) => ({ ...f, referenceNumber: e.target.value }))} required />
          <Textarea label="Audit Reason" value={markPaidForm.reason} onChange={(e) => setMarkPaidForm((f) => ({ ...f, reason: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleMarkPaid} disabled={!markPaidForm.referenceNumber.trim() || !markPaidForm.reason.trim()}>Mark Paid</Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Total Modal */}
      <Modal open={modal === 'adjust'} onClose={() => setModal(null)} title="Adjust Unpaid Order Total">
        <div className="space-y-4">
          <Input label="VIP Discount (-) or Surcharge (+) in ₹" type="number" value={adjustForm.adjustmentRupees} onChange={(e) => setAdjustForm((f) => ({ ...f, adjustmentRupees: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Shipping Override (₹)" type="number" placeholder="Optional" value={adjustForm.shippingRupees} onChange={(e) => setAdjustForm((f) => ({ ...f, shippingRupees: e.target.value }))} />
            <Input label="Discount Override (₹)" type="number" placeholder="Optional" value={adjustForm.discountRupees} onChange={(e) => setAdjustForm((f) => ({ ...f, discountRupees: e.target.value }))} />
          </div>
          <Textarea label="Audit Reason (Mandatory)" value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleAdjustAmount} disabled={!adjustForm.reason.trim()}>Apply Adjustment</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel Order">
        <div className="space-y-4">
          <p className="text-sm text-ink-500">This cancels the order, cancels Shiprocket if booked, releases stock, and refunds if already paid.</p>
          <Textarea label="Cancellation Reason" value={cancelForm.reason} onChange={(e) => setCancelForm({ reason: e.target.value })} placeholder="Customer requested cancellation..." rows={3} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Back</Button>
            <Button variant="danger" loading={saving} onClick={handleCancel} disabled={cancelForm.reason.trim().length < 3}>Cancel Order</Button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal open={modal === 'refund'} onClose={() => setModal(null)} title="Issue Partial / Full Refund">
        <div className="space-y-4">
          <Input label={`Refund Amount (₹, max ${(refundablePaise / 100).toFixed(2)})`} type="number" step="0.01" value={refundForm.amount_rupees} onChange={(e) => setRefundForm((f) => ({ ...f, amount_rupees: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-ink-800 cursor-pointer">
            <input type="checkbox" checked={refundForm.restockItems} onChange={(e) => setRefundForm((f) => ({ ...f, restockItems: e.target.checked }))} className="w-4 h-4 rounded" />
            Restock items back to inventory
            <InfoTooltip text="Restores item stock quantities immediately upon refund." />
          </label>
          <Textarea label="Reason (Mandatory)" value={refundForm.reason} onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Defective item, return approved, etc." rows={3} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" loading={saving} onClick={handleRefund} disabled={!refundForm.amount_rupees || refundForm.reason.trim().length < 3}>Issue Refund</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
