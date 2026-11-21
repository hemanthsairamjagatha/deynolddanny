import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, Modal, Input, Select, Spinner, InfoTooltip, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { coupons as couponsApi } from '../../lib/api';
import type { Coupon } from '../../lib/types';

interface CouponForm {
  code: string;
  discount_type: 'flat' | 'percent';
  discount_value: string;
  min_order_rupees: string;
  max_discount_rupees: string;
  max_uses: string;
  expires_at: string;
  is_active: boolean;
}

const emptyForm: CouponForm = {
  code: '',
  discount_type: 'percent',
  discount_value: '10',
  min_order_rupees: '',
  max_discount_rupees: '',
  max_uses: '',
  expires_at: '',
  is_active: true,
};

export default function CouponsPage() {
  const [list, setList] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await couponsApi.list();
      const raw = res.data as unknown;
      const arr = (Array.isArray(raw) ? raw : ((raw as { items?: Record<string, unknown>[]; coupons?: Record<string, unknown>[] })?.items ?? (raw as { coupons?: Record<string, unknown>[] })?.coupons ?? [])) as Record<string, unknown>[];
      setList(
        arr.map((c) => {
          const rawType = String(c.discount_type ?? c.discountType ?? 'percentage');
          const normType: 'flat' | 'percent' = rawType === 'fixed_amount' || rawType === 'flat' ? 'flat' : 'percent';
          return {
            id: String(c.id ?? ''),
            code: String(c.code ?? ''),
            discount_type: normType,
            discount_value: Number(c.discount_value ?? c.discountValue ?? 0),
            min_order_paise: c.min_order_paise != null ? Number(c.min_order_paise) : null,
            max_discount_paise: c.max_discount_paise != null ? Number(c.max_discount_paise) : null,
            max_uses: c.usage_limit != null ? Number(c.usage_limit) : (c.max_uses != null ? Number(c.max_uses) : null),
            used_count: Number(c.used_count ?? 0),
            expires_at: c.expires_at ? String(c.expires_at) : null,
            is_active: Number(c.is_active ?? 1),
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_type === 'flat' ? String((c.discount_value ?? 0) / 100) : String(c.discount_value ?? 0),
      min_order_rupees: c.min_order_paise ? String(c.min_order_paise / 100) : '',
      max_discount_rupees: c.max_discount_paise ? String(c.max_discount_paise / 100) : '',
      max_uses: c.max_uses ? String(c.max_uses) : '',
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '',
      is_active: Boolean(c.is_active),
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setError('');
    const code = form.code.trim().toUpperCase();
    if (code.length < 3) { setError('Coupon code must be at least 3 characters.'); return; }
    const valNum = Number(form.discount_value);
    if (isNaN(valNum) || valNum <= 0) { setError('Discount value must be greater than 0.'); return; }
    if (form.discount_type === 'percent' && valNum > 100) { setError('Percentage cannot exceed 100%.'); return; }

    setSaving(true);
    try {
      const payload = {
        code,
        discountType: form.discount_type === 'flat' ? 'fixed_amount' : 'percentage',
        discountValue: form.discount_type === 'flat' ? Math.round(valNum * 100) : Math.round(valNum),
        minOrderPaise: form.min_order_rupees ? Math.round(Number(form.min_order_rupees) * 100) : 0,
        maxDiscountPaise: form.discount_type === 'percent' && form.max_discount_rupees ? Math.round(Number(form.max_discount_rupees) * 100) : null,
        usageLimit: form.max_uses ? Number(form.max_uses) : null,
        expiresAt: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        isActive: Boolean(form.is_active),
      };
      const res = editing ? await couponsApi.update(editing.id, payload) : await couponsApi.create(payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save coupon.');
        return;
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(c: Coupon) {
    await couponsApi.update(c.id, { isActive: !c.is_active });
    load();
  }

  async function handleDelete(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return;
    await couponsApi.delete(c.id);
    load();
  }

  const fmtInr = (paise: number | null) =>
    paise ? `₹${(paise / 100).toLocaleString('en-IN')}` : '—';

  const columns: Column<Coupon & Record<string, unknown>>[] = [
    { key: 'code', header: 'Code', render: r => <code className="font-mono font-semibold text-ink-900 bg-ink-100 px-2 py-0.5 rounded">{r.code}</code> },
    {
      key: 'discount', header: 'Benefit', render: r => (
        <span className="font-medium text-ink-900">
          {r.discount_type === 'percent'
            ? `${r.discount_value}% off${r.max_discount_paise ? ` (up to ${fmtInr(r.max_discount_paise)})` : ''}`
            : `${fmtInr(r.discount_value)} off`}
        </span>
      ),
    },
    { key: 'min_order', header: 'Min Order', render: r => <span className="text-ink-600">{fmtInr(r.min_order_paise)}</span> },
    { key: 'uses', header: 'Redemptions', render: r => <span className="text-ink-600">{r.used_count ?? 0} / {r.max_uses ?? '∞'}</span> },
    {
      key: 'expires_at', header: 'Expires', render: r => (
        <span className="text-ink-500 text-xs">{r.expires_at ? new Date(r.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}</span>
      ),
    },
    { key: 'status', header: 'Status', render: r => <Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => handleToggle(r)}>{r.is_active ? 'Pause' : 'Activate'}</Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(r)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions & Coupons"
        description="Create server-validated discount codes with minimum order rules, redemption caps, and scheduled expiry."
        actions={<Button onClick={openCreate}>+ New Coupon</Button>}
      />

      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No coupons configured"
            description="Launch a private client discount or seasonal promotion code."
            action={<Button onClick={openCreate}>Create Coupon</Button>}
          />
        ) : (
          <DataTable columns={columns} data={list as (Coupon & Record<string, unknown>)[]} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Coupon — ${editing.code}` : 'Create Promotional Coupon'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editing ? 'Save Changes' : 'Create Coupon'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Coupon Code"
            tooltip="Unique code customers enter at checkout. Automatically normalised to UPPERCASE."
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="ATELIER15"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Discount Type"
              tooltip="Flat = fixed INR amount off; Percent = percentage of eligible order subtotal."
              value={form.discount_type}
              onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'flat' | 'percent' }))}
              options={[
                { value: 'percent', label: 'Percentage (%)' },
                { value: 'flat', label: 'Flat Amount (₹)' },
              ]}
            />
            <Input
              label={form.discount_type === 'flat' ? 'Amount Off (₹)' : 'Percentage Off (%)'}
              tooltip="For flat discounts enter whole Rupees; for percent enter 1 to 100."
              type="number"
              value={form.discount_value}
              onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
            />
          </div>
          {form.discount_type === 'percent' && (
            <Input
              label="Maximum Discount Cap (₹, optional)"
              tooltip="Caps the maximum Rupee discount granted by this percentage code."
              type="number"
              value={form.max_discount_rupees}
              onChange={e => setForm(f => ({ ...f, max_discount_rupees: e.target.value }))}
              placeholder="e.g. 2500 (leave blank for no cap)"
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Minimum Order (₹)"
              tooltip="Minimum bag total in Rupees required before this coupon can be applied."
              type="number"
              value={form.min_order_rupees}
              onChange={e => setForm(f => ({ ...f, min_order_rupees: e.target.value }))}
              placeholder="e.g. 5000"
            />
            <Input
              label="Max Redemptions"
              tooltip="Total global uses allowed. Leave blank for unlimited redemptions."
              type="number"
              value={form.max_uses}
              onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
              placeholder="Unlimited"
            />
          </div>
          <Input
            label="Expiry Date & Time"
            tooltip="Coupon automatically expires after this timestamp. Leave blank for no expiry."
            type="datetime-local"
            value={form.expires_at}
            onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-ink-800 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded text-gold-600 focus:ring-gold-400"
            />
            Active immediately
            <InfoTooltip text="Inactive coupons are rejected at checkout while preserving usage records." />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
