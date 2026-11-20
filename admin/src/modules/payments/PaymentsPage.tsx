import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageHeader,
  Card,
  KpiCard,
  Button,
  Badge,
  Tabs,
  Input,
  Select,
  Textarea,
  Modal,
  Spinner,
  SectionHeader,
  SearchBar,
  EmptyState,
  InfoTooltip,
  statusVariant,
} from '../../components/ui';
import {
  payments as paymentsApi,
  orders as ordersApi,
  settings as settingsApi,
} from '../../lib/api';

function fmt(paise: number) {
  return `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ModalMode = 'mark_paid' | 'adjust' | 'status_override' | 'refund' | null;

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('checkup');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [stats, setStats] = useState<Record<string, any>>({});
  const [health, setHealth] = useState<Record<string, any> | null>(null);
  const [livePing, setLivePing] = useState<Record<string, any> | null>(null);
  const [testingGateways, setTestingGateways] = useState(false);

  const [ordersList, setOrdersList] = useState<Record<string, any>[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [attempts, setAttempts] = useState<Record<string, any>[]>([]);
  const [attemptGatewayFilter, setAttemptGatewayFilter] = useState('');
  const [attemptStatusFilter, setAttemptStatusFilter] = useState('');
  const [refunds, setRefunds] = useState<Record<string, any>[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, any>[]>([]);
  const [webhooks, setWebhooks] = useState<Record<string, any>[]>([]);
  const [webhookGatewayFilter, setWebhookGatewayFilter] = useState('');

  // Gateway & Payment Rules form (persisted to store_settings)
  const [savingRules, setSavingRules] = useState(false);
  const [rules, setRules] = useState({
    primaryGateway: 'razorpay',
    enableRazorpay: true,
    enableCashfree: true,
    enableCod: false,
    codMaxOrderRupees: '25000',
    codFeeRupees: '0',
    upiMaxRupees: '100000',
    panVerificationThresholdRupees: '200000',
    freeShippingThresholdRupees: '5000',
    standardShippingRupees: '0',
    autoRefundDuplicateCapture: false,
  });

  // Order Manipulation Modal State
  const [modal, setModal] = useState<ModalMode>(null);
  const [activeOrder, setActiveOrder] = useState<Record<string, any> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [markPaidForm, setMarkPaidForm] = useState({
    paymentMethod: 'upi_manual',
    referenceNumber: '',
    reason: '',
  });
  const [adjustForm, setAdjustForm] = useState({
    adjustmentRupees: '0',
    shippingRupees: '',
    discountRupees: '',
    reason: '',
  });
  const [overrideForm, setOverrideForm] = useState({
    paymentStatus: 'pending',
    referenceNumber: '',
    reason: '',
  });
  const [refundForm, setRefundForm] = useState({
    amountRupees: '',
    reason: '',
    restockItems: false,
  });

  async function loadAll() {
    setLoading(true);
    try {
      const [statsRes, healthRes, ordersRes, attemptsRes, refundsRes, adjRes, whRes, setRes] = await Promise.all([
        paymentsApi.stats(),
        paymentsApi.health(),
        ordersApi.list({ limit: 40 }),
        paymentsApi.attempts({ limit: 60 }),
        paymentsApi.refunds(),
        paymentsApi.adjustments(),
        paymentsApi.webhooks(),
        settingsApi.get(),
      ]);

      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (healthRes.success && healthRes.data) setHealth(healthRes.data);
      if (ordersRes.success && ordersRes.data) {
        setOrdersList(((ordersRes.data as any).items ?? []) as Record<string, any>[]);
      }
      if (attemptsRes.success && attemptsRes.data) setAttempts(attemptsRes.data.items ?? []);
      if (refundsRes.success && refundsRes.data) setRefunds(refundsRes.data.items ?? []);
      if (adjRes.success && adjRes.data) setAdjustments(adjRes.data.items ?? []);
      if (whRes.success && whRes.data) setWebhooks(whRes.data.items ?? []);

      if (setRes.success && setRes.data) {
        const d = setRes.data as Record<string, any>;
        const toR = (k: string, fb: string) => (d[k] !== undefined && d[k] !== null ? String(Math.round(Number(d[k]) / 100)) : fb);
        setRules({
          primaryGateway: d.primaryGateway === 'cashfree' ? 'cashfree' : 'razorpay',
          enableRazorpay: d.enableRazorpay !== false,
          enableCashfree: d.enableCashfree !== false,
          enableCod: Boolean(d.enableCod ?? false),
          codMaxOrderRupees: toR('codMaxOrderPaise', '25000'),
          codFeeRupees: toR('codFeePaise', '0'),
          upiMaxRupees: toR('upiMaxPaise', '100000'),
          panVerificationThresholdRupees: toR('panVerificationThresholdPaise', '200000'),
          freeShippingThresholdRupees: toR('freeShippingThresholdPaise', '5000'),
          standardShippingRupees: toR('standardShippingPaise', '0'),
          autoRefundDuplicateCapture: Boolean(d.autoRefundDuplicateCapture ?? false),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function runGatewayCheckup() {
    setTestingGateways(true);
    setError('');
    setNotice('');
    try {
      const res = await paymentsApi.testGateway();
      if (res.success && res.data) {
        setLivePing(res.data);
        setNotice('Live payment gateway check-up completed.');
      } else {
        setError(res.error?.message ?? 'Gateway check-up failed.');
      }
    } finally {
      setTestingGateways(false);
    }
  }

  async function saveGatewayRules() {
    setSavingRules(true);
    setError('');
    setNotice('');
    try {
      const res = await settingsApi.update({
        primaryGateway: rules.primaryGateway,
        enableRazorpay: rules.enableRazorpay,
        enableCashfree: rules.enableCashfree,
        enableCod: rules.enableCod,
        codMaxOrderPaise: Math.round(Number(rules.codMaxOrderRupees || 0) * 100),
        codFeePaise: Math.round(Number(rules.codFeeRupees || 0) * 100),
        upiMaxPaise: Math.round(Number(rules.upiMaxRupees || 100000) * 100),
        panVerificationThresholdPaise: Math.round(Number(rules.panVerificationThresholdRupees || 200000) * 100),
        freeShippingThresholdPaise: Math.round(Number(rules.freeShippingThresholdRupees || 5000) * 100),
        standardShippingPaise: Math.round(Number(rules.standardShippingRupees || 0) * 100),
        autoRefundDuplicateCapture: rules.autoRefundDuplicateCapture,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save payment rules.');
        return;
      }
      setNotice('Payment gateway routing & checkout guardrails saved live!');
      await loadAll();
    } finally {
      setSavingRules(false);
    }
  }

  async function handleReconcile(orderId: string, orderNumber?: string) {
    setError('');
    setNotice('');
    const res = await ordersApi.reconcile(orderId);
    if (!res.success) {
      setError(res.error?.message ?? 'Reconciliation failed.');
      return;
    }
    const d = res.data as Record<string, any> | undefined;
    if (d?.reconciled) {
      setNotice(`Order #${orderNumber ?? orderId} verified & reconciled as PAID from gateway!`);
    } else {
      setNotice(`Order #${orderNumber ?? orderId}: Gateway status is "${d?.gatewayStatus ?? d?.reason ?? 'unpaid'}".`);
    }
    await loadAll();
  }

  async function handleMarkPaid() {
    if (!activeOrder) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await paymentsApi.markPaid(activeOrder.id, markPaidForm);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to mark order paid.');
        return;
      }
      setModal(null);
      setNotice(`Order #${activeOrder.orderNumber ?? activeOrder.order_number} marked PAID (${markPaidForm.paymentMethod}) and audited.`);
      await loadAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjustAmount() {
    if (!activeOrder) return;
    setSubmitting(true);
    setError('');
    try {
      const payload: { adjustmentPaise?: number; shippingPaise?: number; discountPaise?: number; reason: string } = {
        reason: adjustForm.reason,
      };
      if (adjustForm.adjustmentRupees.trim() !== '') {
        payload.adjustmentPaise = Math.round(parseFloat(adjustForm.adjustmentRupees) * 100);
      }
      if (adjustForm.shippingRupees.trim() !== '') {
        payload.shippingPaise = Math.max(0, Math.round(parseFloat(adjustForm.shippingRupees) * 100));
      }
      if (adjustForm.discountRupees.trim() !== '') {
        payload.discountPaise = Math.max(0, Math.round(parseFloat(adjustForm.discountRupees) * 100));
      }
      const res = await paymentsApi.adjustAmount(activeOrder.id, payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to adjust order amount.');
        return;
      }
      setModal(null);
      setNotice(`Order #${activeOrder.orderNumber ?? activeOrder.order_number} total updated to ${(res.data as any)?.newTotalFormatted ?? 'new amount'}.`);
      await loadAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusOverride() {
    if (!activeOrder) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await paymentsApi.statusOverride(activeOrder.id, overrideForm);
      if (!res.success) {
        setError(res.error?.message ?? 'Payment status override failed.');
        return;
      }
      setModal(null);
      setNotice(`Payment status updated to "${overrideForm.paymentStatus}" and logged in audit trail.`);
      await loadAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIssueRefund() {
    if (!activeOrder) return;
    setSubmitting(true);
    setError('');
    try {
      const paise = Math.round(parseFloat(refundForm.amountRupees || '0') * 100);
      if (paise <= 0) {
        setError('Enter a valid positive refund amount.');
        return;
      }
      const res = await ordersApi.refund(activeOrder.id, paise, refundForm.reason, refundForm.restockItems);
      if (!res.success) {
        setError(res.error?.message ?? 'Refund failed.');
        return;
      }
      setModal(null);
      setNotice(`Refund of ${fmt(paise)} initiated for Order #${activeOrder.orderNumber ?? activeOrder.order_number}.`);
      await loadAll();
    } finally {
      setSubmitting(false);
    }
  }

  const filteredOrders = ordersList.filter((o) => {
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase();
    return (
      String(o.orderNumber ?? '').toLowerCase().includes(q) ||
      String(o.shippingName ?? '').toLowerCase().includes(q) ||
      String(o.status ?? '').toLowerCase().includes(q) ||
      String(o.paymentStatus ?? '').toLowerCase().includes(q)
    );
  });

  const filteredAttempts = attempts.filter((a) => {
    if (attemptGatewayFilter && a.gateway !== attemptGatewayFilter) return false;
    if (attemptStatusFilter && a.status !== attemptStatusFilter) return false;
    return true;
  });

  const filteredWebhooks = webhooks.filter((w) => {
    if (webhookGatewayFilter && w.gateway !== webhookGatewayFilter) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  const healthScore = Number(health?.healthScore ?? 0);
  const checks = (health?.checks ?? []) as Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }>;
  const stuckOrders = (health?.stuckOrders ?? []) as Record<string, any>[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments Command Center & Check-Up"
        description="Live gateway diagnostics, checkout routing, audited manual captures, price adjustments, gateway reconciliation, refunds & webhook inspection."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadAll}>Refresh Data</Button>
            <Button loading={testingGateways} onClick={runGatewayCheckup}>Run Live Payment Check-Up</Button>
          </div>
        }
      />

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">Dismiss</button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard label="Paid Volume" value={fmt(stats.paidOrdersVolumePaise ?? 0)} sub={`${stats.paidOrdersCount ?? 0} paid orders`} />
        <KpiCard label="Unpaid Pending" value={fmt(stats.unpaidPendingVolumePaise ?? 0)} sub={`${stats.unpaidPendingCount ?? 0} awaiting action`} />
        <KpiCard label="Captured Attempts" value={String(stats.successfulCount ?? 0)} sub={`of ${stats.totalAttempts ?? 0} attempts`} />
        <KpiCard label="Failed Attempts" value={String(stats.failedCount ?? 0)} sub={`${stats.pendingCount ?? 0} in-flight`} />
        <KpiCard label="Refunded Volume" value={fmt(stats.refundVolumePaise ?? 0)} sub={`${stats.totalRefunds ?? 0} refunds`} />
        <KpiCard label="Check-Up Score" value={`${healthScore}%`} sub={`${stats.openDisputesCount ?? 0} open disputes`} />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'checkup', label: `Payment Check-Up (${healthScore}%)` },
          { id: 'manipulation', label: `Payment Controls & Orders (${ordersList.length})` },
          { id: 'attempts', label: `Attempts Ledger (${attempts.length})` },
          { id: 'refunds', label: `Refunds & Audit (${refunds.length + adjustments.length})` },
          { id: 'webhooks', label: `Webhooks (${webhooks.length})` },
        ]}
      />

      {/* TAB 1: PAYMENT CHECK-UP & GATEWAY ROUTING */}
      {tab === 'checkup' && (
        <div className="space-y-6">
          {/* Live Ping Result Banner */}
          {livePing && (
            <Card className="p-5 bg-ink-900 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Live Gateway Connectivity Ping</p>
                <span className="text-xs text-ink-300">{new Date(livePing.testedAt).toLocaleTimeString('en-IN')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries((livePing.results ?? {}) as Record<string, any>).map(([gw, r]) => (
                  <div key={gw} className="rounded-xl bg-white/10 p-3.5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-xs tracking-wider">{gw}</span>
                      <Badge variant={r.ok ? 'success' : 'danger'}>
                        {r.status} {r.latencyMs ? `· ${r.latencyMs}ms` : ''}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-200 mt-1.5">{r.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Diagnostic Checklist */}
            <Card>
              <SectionHeader
                title="Payment System Check-Up Checklist"
                description="Real-time verification of gateways, webhook secrets, stuck orders, disputes & failure rates."
              />
              <div className="divide-y divide-ink-100">
                {checks.map((ck) => (
                  <div key={ck.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{ck.label}</p>
                      <p className="text-xs text-ink-500 mt-0.5">{ck.detail}</p>
                    </div>
                    <Badge variant={ck.status === 'pass' ? 'success' : ck.status === 'warn' ? 'warning' : 'danger'}>
                      {ck.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Gateway Routing & Rules Manipulation */}
            <Card>
              <SectionHeader
                title="Live Gateway Routing & Checkout Payment Rules"
                description="Control active gateways, priority failover, COD rules & shipping fees directly from Admin."
              />
              <div className="space-y-4">
                <Select
                  label="Primary Checkout Gateway"
                  tooltip="Checkout tries this gateway first and automatically fails over to the secondary enabled gateway if unreachable."
                  value={rules.primaryGateway}
                  onChange={(e) => setRules((r) => ({ ...r, primaryGateway: e.target.value }))}
                  options={[
                    { value: 'razorpay', label: 'Razorpay Primary (Fallback → Cashfree)' },
                    { value: 'cashfree', label: 'Cashfree Primary (Fallback → Razorpay)' },
                  ]}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-ink-200 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-ink-900">Enable Razorpay</p>
                      <p className="text-[11px] text-ink-500">{health?.gateways?.razorpay?.configured ? `Key ${health.gateways.razorpay.keyIdPrefix}` : 'Secret not set'}</p>
                    </div>
                    <input type="checkbox" checked={rules.enableRazorpay} onChange={(e) => setRules((r) => ({ ...r, enableRazorpay: e.target.checked }))} className="w-4 h-4" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-ink-200 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-ink-900">Enable Cashfree</p>
                      <p className="text-[11px] text-ink-500">{health?.gateways?.cashfree?.configured ? `${health.gateways.cashfree.environment} · ${health.gateways.cashfree.appIdPrefix}` : 'Secret not set'}</p>
                    </div>
                    <input type="checkbox" checked={rules.enableCashfree} onChange={(e) => setRules((r) => ({ ...r, enableCashfree: e.target.checked }))} className="w-4 h-4" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-ink-200 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-ink-900">Enable Cash on Delivery</p>
                      <p className="text-[11px] text-ink-500">Allow COD up to ceiling</p>
                    </div>
                    <input type="checkbox" checked={rules.enableCod} onChange={(e) => setRules((r) => ({ ...r, enableCod: e.target.checked }))} className="w-4 h-4" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-ink-200 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-ink-900">Auto-Refund Duplicate</p>
                      <p className="text-[11px] text-ink-500">Refund double-captures</p>
                    </div>
                    <input type="checkbox" checked={rules.autoRefundDuplicateCapture} onChange={(e) => setRules((r) => ({ ...r, autoRefundDuplicateCapture: e.target.checked }))} className="w-4 h-4" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input label="COD Max Order Cap (₹)" type="number" value={rules.codMaxOrderRupees} onChange={(e) => setRules((r) => ({ ...r, codMaxOrderRupees: e.target.value }))} />
                  <Input label="COD Handling Fee (₹)" type="number" value={rules.codFeeRupees} onChange={(e) => setRules((r) => ({ ...r, codFeeRupees: e.target.value }))} />
                  <Input label="Free Shipping Threshold (₹)" type="number" value={rules.freeShippingThresholdRupees} onChange={(e) => setRules((r) => ({ ...r, freeShippingThresholdRupees: e.target.value }))} />
                  <Input label="Standard Shipping Fee (₹)" type="number" value={rules.standardShippingRupees} onChange={(e) => setRules((r) => ({ ...r, standardShippingRupees: e.target.value }))} />
                  <Input label="UPI Max Ceiling (₹)" type="number" value={rules.upiMaxRupees} onChange={(e) => setRules((r) => ({ ...r, upiMaxRupees: e.target.value }))} />
                  <Input label="PAN Threshold (₹)" type="number" value={rules.panVerificationThresholdRupees} onChange={(e) => setRules((r) => ({ ...r, panVerificationThresholdRupees: e.target.value }))} />
                </div>

                <div className="flex justify-end pt-2">
                  <Button loading={savingRules} onClick={saveGatewayRules}>Save Payment Controls Live</Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Orders Needing Payment Attention */}
          {stuckOrders.length > 0 && (
            <Card padding={false}>
              <div className="p-4 border-b border-ink-100">
                <p className="text-sm font-semibold text-ink-900">Orders Needing Payment Check-Up ({stuckOrders.length})</p>
                <p className="text-xs text-ink-500">Pending, awaiting-capture, disputed, or failed orders — reconcile with gateway or manually settle below.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['Order', 'Customer', 'Order Status', 'Payment', 'Total', 'Actions'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {stuckOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-ink-50/50">
                        <td className="py-3 px-4 font-mono font-semibold text-ink-900">#{o.order_number}</td>
                        <td className="py-3 px-4">
                          <p className="text-ink-900 font-medium">{o.shipping_name}</p>
                          <p className="text-xs text-ink-500">{o.customer_email ?? '—'}</p>
                        </td>
                        <td className="py-3 px-4"><Badge variant={statusVariant(o.status)}>{o.status}</Badge></td>
                        <td className="py-3 px-4"><Badge variant={statusVariant(o.payment_status)}>{o.payment_status}</Badge></td>
                        <td className="py-3 px-4 font-semibold">{fmt(o.total_paise)}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => handleReconcile(o.id, o.order_number)}>Reconcile</Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setActiveOrder({ ...o, orderNumber: o.order_number, totalPaise: o.total_paise });
                                setMarkPaidForm({ paymentMethod: 'upi_manual', referenceNumber: '', reason: '' });
                                setModal('mark_paid');
                              }}
                            >
                              Mark Paid
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${o.id}`)}>Open →</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT MANIPULATION & ORDER SETTLEMENT */}
      {tab === 'manipulation' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              Every payment manipulation (manual capture, price adjustment, status override, refund) is strictly server-validated and written to the immutable audit ledger.
            </p>
            <SearchBar value={orderSearch} onChange={setOrderSearch} placeholder="Filter orders by #number, name, status…" />
          </div>

          <Card padding={false}>
            {filteredOrders.length === 0 ? (
              <EmptyState title="No orders yet" description="Orders will appear here for payment reconciliation, manual settlement, adjustments, and refunds." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['Order', 'Customer', 'Order Status', 'Payment Status', 'Total', 'Refunded', 'Admin Payment Controls'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filteredOrders.map((o) => {
                      const isPaid = o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded';
                      const refundablePaise = Math.max(0, Number(o.totalPaise ?? 0) - Number(o.refundedPaise ?? 0));
                      return (
                        <tr key={o.id} className="hover:bg-ink-50/50">
                          <td className="py-3 px-4">
                            <button onClick={() => navigate(`/orders/${o.id}`)} className="font-mono font-semibold text-ink-900 hover:underline">
                              #{o.orderNumber}
                            </button>
                            <p className="text-[11px] text-ink-400">{new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                          </td>
                          <td className="py-3 px-4 text-ink-800">{o.shippingName} · {o.shippingCity}</td>
                          <td className="py-3 px-4"><Badge variant={statusVariant(o.status)}>{o.status}</Badge></td>
                          <td className="py-3 px-4"><Badge variant={statusVariant(o.paymentStatus)}>{o.paymentStatus}</Badge></td>
                          <td className="py-3 px-4 font-semibold text-ink-900">{fmt(o.totalPaise)}</td>
                          <td className="py-3 px-4 text-ink-600">{o.refundedPaise > 0 ? fmt(o.refundedPaise) : '—'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {!isPaid && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleReconcile(o.id, o.orderNumber)}>
                                    Reconcile
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setActiveOrder(o);
                                      setMarkPaidForm({ paymentMethod: 'upi_manual', referenceNumber: '', reason: '' });
                                      setModal('mark_paid');
                                    }}
                                  >
                                    Mark Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setActiveOrder(o);
                                      setAdjustForm({ adjustmentRupees: '0', shippingRupees: '', discountRupees: '', reason: '' });
                                      setModal('adjust');
                                    }}
                                  >
                                    Adjust Total
                                  </Button>
                                </>
                              )}
                              {isPaid && refundablePaise > 0 && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setActiveOrder(o);
                                    setRefundForm({ amountRupees: String(refundablePaise / 100), reason: '', restockItems: false });
                                    setModal('refund');
                                  }}
                                >
                                  Refund
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setActiveOrder(o);
                                  setOverrideForm({ paymentStatus: o.paymentStatus || 'pending', referenceNumber: '', reason: '' });
                                  setModal('status_override');
                                }}
                              >
                                Status
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: PAYMENT ATTEMPTS LEDGER */}
      {tab === 'attempts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={attemptGatewayFilter}
              onChange={(e) => setAttemptGatewayFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg"
            >
              <option value="">All Gateways</option>
              <option value="razorpay">Razorpay</option>
              <option value="cashfree">Cashfree</option>
              <option value="test">Test</option>
            </select>
            <select
              value={attemptStatusFilter}
              onChange={(e) => setAttemptStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg"
            >
              <option value="">All Statuses</option>
              <option value="captured">Captured</option>
              <option value="created">Created</option>
              <option value="authorized">Authorized</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <Card padding={false}>
            {filteredAttempts.length === 0 ? (
              <EmptyState title="No payment attempts recorded" description="Gateway checkout attempts will appear here with Razorpay/Cashfree IDs and failure diagnostics." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['Order', 'Gateway', 'Gateway Order / Payment ID', 'Amount', 'Status', 'Failure / Note', 'Time', ''].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filteredAttempts.map((a) => (
                      <tr key={a.id} className="hover:bg-ink-50/50">
                        <td className="py-3 px-4">
                          <button onClick={() => navigate(`/orders/${a.order_id}`)} className="font-mono font-semibold text-ink-900 hover:underline">
                            #{a.order_number ?? a.order_id}
                          </button>
                          <p className="text-xs text-ink-400">{a.customer_email ?? a.shipping_name ?? ''}</p>
                        </td>
                        <td className="py-3 px-4 uppercase text-xs font-semibold text-ink-700">{a.gateway}</td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-600">
                          <div>{a.gateway_order_id ?? '—'}</div>
                          {a.gateway_payment_id && <div className="text-emerald-700">{a.gateway_payment_id}</div>}
                        </td>
                        <td className="py-3 px-4 font-semibold">{fmt(a.amount_paise)}</td>
                        <td className="py-3 px-4"><Badge variant={statusVariant(a.status)}>{a.status}</Badge></td>
                        <td className="py-3 px-4 text-xs text-red-600 max-w-xs truncate">{a.failure_reason ?? '—'}</td>
                        <td className="py-3 px-4 text-xs text-ink-500">{new Date(a.created_at).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-4 text-right">
                          {a.status !== 'captured' && (
                            <Button size="sm" variant="outline" onClick={() => handleReconcile(a.order_id, a.order_number)}>
                              Reconcile
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: REFUNDS & ADMIN MANIPULATION AUDIT */}
      {tab === 'refunds' && (
        <div className="space-y-6">
          <Card padding={false}>
            <div className="p-4 border-b border-ink-100">
              <p className="text-sm font-semibold text-ink-900">Refunds Ledger ({refunds.length})</p>
            </div>
            {refunds.length === 0 ? (
              <p className="p-6 text-sm text-ink-500 text-center">No refunds issued yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['Order', 'Gateway', 'Refund ID', 'Amount', 'Status', 'Reason', 'Date'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {refunds.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 px-4 font-mono font-semibold">#{r.order_number ?? r.order_id}</td>
                        <td className="py-3 px-4 uppercase text-xs">{r.gateway}</td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-600">{r.gateway_refund_id ?? r.id}</td>
                        <td className="py-3 px-4 font-semibold text-red-700">{fmt(r.amount_paise)}</td>
                        <td className="py-3 px-4"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                        <td className="py-3 px-4 text-xs text-ink-700">{r.reason ?? '—'}</td>
                        <td className="py-3 px-4 text-xs text-ink-500">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card padding={false}>
            <div className="p-4 border-b border-ink-100">
              <p className="text-sm font-semibold text-ink-900">Immutable Admin Payment Manipulation Ledger ({adjustments.length})</p>
              <p className="text-xs text-ink-500">Every manual capture, total adjustment, and payment status override performed by staff.</p>
            </div>
            {adjustments.length === 0 ? (
              <p className="p-6 text-sm text-ink-500 text-center">No manual payment manipulations recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['Order', 'Action', 'Delta / New Total', 'Reference', 'Reason', 'Admin', 'Time'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {adjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td className="py-3 px-4 font-mono font-semibold">#{adj.order_number ?? adj.order_id ?? '—'}</td>
                        <td className="py-3 px-4"><Badge variant="gold">{adj.action_type}</Badge></td>
                        <td className="py-3 px-4 text-xs">
                          {adj.delta_paise !== 0 && (
                            <span className={adj.delta_paise < 0 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                              {adj.delta_paise > 0 ? '+' : ''}{fmt(adj.delta_paise)}{' '}
                            </span>
                          )}
                          {adj.new_total_paise != null && <span className="text-ink-600">→ {fmt(adj.new_total_paise)}</span>}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-600">{adj.reference_code ?? adj.payment_method ?? '—'}</td>
                        <td className="py-3 px-4 text-xs text-ink-800">{adj.reason}</td>
                        <td className="py-3 px-4 text-xs text-ink-500">{adj.actor_email ?? adj.actor_id}</td>
                        <td className="py-3 px-4 text-xs text-ink-500">{new Date(adj.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: WEBHOOK DIAGNOSTICS */}
      {tab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={webhookGatewayFilter}
              onChange={(e) => setWebhookGatewayFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg"
            >
              <option value="">All Providers</option>
              <option value="razorpay">Razorpay</option>
              <option value="cashfree">Cashfree</option>
              <option value="shiprocket">Shiprocket</option>
            </select>
          </div>
          <Card padding={false}>
            {filteredWebhooks.length === 0 ? (
              <EmptyState title="No webhook events yet" description="Incoming Razorpay, Cashfree, and Shiprocket webhooks will appear here for signature and error auditing." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['Gateway', 'Event Type', 'Event ID', 'Order ID', 'Status', 'Error', 'Received'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-ink-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filteredWebhooks.map((w) => (
                      <tr key={w.id}>
                        <td className="py-3 px-4 uppercase text-xs font-semibold">{w.gateway}</td>
                        <td className="py-3 px-4 font-mono text-xs">{w.event_type}</td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-500">{w.event_id}</td>
                        <td className="py-3 px-4 font-mono text-xs">{w.order_id ?? '—'}</td>
                        <td className="py-3 px-4"><Badge variant={w.status === 'processed' ? 'success' : w.status === 'failed' ? 'danger' : 'default'}>{w.status}</Badge></td>
                        <td className="py-3 px-4 text-xs text-red-600">{w.error_message ?? '—'}</td>
                        <td className="py-3 px-4 text-xs text-ink-500">{new Date(w.received_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL: MARK PAID (MANUAL SETTLEMENT) */}
      <Modal
        open={modal === 'mark_paid'}
        onClose={() => setModal(null)}
        title={`Manual Payment Capture — Order #${activeOrder?.orderNumber ?? activeOrder?.order_number ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={submitting} onClick={handleMarkPaid} disabled={!markPaidForm.referenceNumber.trim() || !markPaidForm.reason.trim()}>
              Confirm &amp; Mark Paid
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            This will transition the order to <strong>PAID / CONFIRMED</strong>, atomically deduct reserved stock, send the confirmation email, and write an immutable audit entry.
          </div>
          <Select
            label="Settlement Channel"
            value={markPaidForm.paymentMethod}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            options={[
              { value: 'upi_manual', label: 'Direct UPI Transfer (Verified UTR)' },
              { value: 'bank_transfer', label: 'NEFT / RTGS / IMPS Bank Wire' },
              { value: 'cod_collected', label: 'Cash on Delivery Collected' },
              { value: 'atelier_pos', label: 'In-Boutique / Atelier Card POS' },
              { value: 'razorpay_manual', label: 'Razorpay Payment Link / Dashboard Capture' },
              { value: 'cashfree_manual', label: 'Cashfree Payment Link / Dashboard Capture' },
            ]}
          />
          <Input
            label="UTR / Bank Reference / Payment ID"
            value={markPaidForm.referenceNumber}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, referenceNumber: e.target.value }))}
            placeholder="e.g. UTR429018273645 or pay_Q8x..."
            required
          />
          <Textarea
            label="Audit Reason (Mandatory)"
            value={markPaidForm.reason}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Verified bank credit of full amount on statement..."
            rows={2}
          />
        </div>
      </Modal>

      {/* MODAL: ADJUST ORDER AMOUNT */}
      <Modal
        open={modal === 'adjust'}
        onClose={() => setModal(null)}
        title={`Adjust Unpaid Order Total — #${activeOrder?.orderNumber ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={submitting} onClick={handleAdjustAmount} disabled={!adjustForm.reason.trim()}>
              Apply Audited Adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-600">
            Current Order Total: <strong>{fmt(activeOrder?.totalPaise ?? 0)}</strong>. Enter a negative adjustment for VIP courtesy discount (e.g. <code>-2500</code>) or positive for bespoke tailoring / express surcharge.
          </p>
          <Input
            label="Courtesy Discount (-) or Bespoke Fee (+) in ₹"
            type="number"
            step="1"
            value={adjustForm.adjustmentRupees}
            onChange={(e) => setAdjustForm((f) => ({ ...f, adjustmentRupees: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Override Shipping Fee (₹, optional)"
              type="number"
              min="0"
              placeholder="Leave blank to keep"
              value={adjustForm.shippingRupees}
              onChange={(e) => setAdjustForm((f) => ({ ...f, shippingRupees: e.target.value }))}
            />
            <Input
              label="Override Discount (₹, optional)"
              type="number"
              min="0"
              placeholder="Leave blank to keep"
              value={adjustForm.discountRupees}
              onChange={(e) => setAdjustForm((f) => ({ ...f, discountRupees: e.target.value }))}
            />
          </div>
          <Textarea
            label="Audit Reason (Mandatory)"
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="VIP client complimentary shipping waiver / bespoke hem tailoring..."
            rows={2}
          />
        </div>
      </Modal>

      {/* MODAL: OVERRIDE PAYMENT STATUS */}
      <Modal
        open={modal === 'status_override'}
        onClose={() => setModal(null)}
        title={`Override Payment Status — #${activeOrder?.orderNumber ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={submitting} onClick={handleStatusOverride} disabled={!overrideForm.reason.trim()}>
              Save Status Override
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Target Payment Status"
            value={overrideForm.paymentStatus}
            onChange={(e) => setOverrideForm((f) => ({ ...f, paymentStatus: e.target.value }))}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'authorized', label: 'Authorized (Uncaptured)' },
              { value: 'paid', label: 'Paid (Commits Stock)' },
              { value: 'failed', label: 'Failed' },
              { value: 'user_dropped', label: 'User Dropped' },
              { value: 'disputed', label: 'Disputed (Freezes Refunds)' },
              { value: 'partially_refunded', label: 'Partially Refunded' },
              { value: 'refunded', label: 'Refunded' },
            ]}
          />
          <Input
            label="Reference / Gateway ID (optional)"
            value={overrideForm.referenceNumber}
            onChange={(e) => setOverrideForm((f) => ({ ...f, referenceNumber: e.target.value }))}
          />
          <Textarea
            label="Audit Reason (Mandatory)"
            value={overrideForm.reason}
            onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Explain why payment status is being manually overridden..."
            rows={2}
          />
        </div>
      </Modal>

      {/* MODAL: ISSUE REFUND */}
      <Modal
        open={modal === 'refund'}
        onClose={() => setModal(null)}
        title={`Issue Refund — #${activeOrder?.orderNumber ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" loading={submitting} onClick={handleIssueRefund} disabled={!refundForm.amountRupees || !refundForm.reason.trim()}>
              Issue Refund
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Refund Amount (₹)"
            type="number"
            step="0.01"
            value={refundForm.amountRupees}
            onChange={(e) => setRefundForm((f) => ({ ...f, amountRupees: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-ink-800 cursor-pointer">
            <input
              type="checkbox"
              checked={refundForm.restockItems}
              onChange={(e) => setRefundForm((f) => ({ ...f, restockItems: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            Restock returned garment inventory immediately
            <InfoTooltip text="Adds the ordered quantities back to available stock and records a return_restock inventory movement." />
          </label>
          <Textarea
            label="Refund Reason (Mandatory)"
            value={refundForm.reason}
            onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Size exchange return, partial courtesy refund, etc."
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
