import { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Input, SectionHeader, Spinner, InfoTooltip } from '../../components/ui';
import { settings as settingsApi } from '../../lib/api';

interface StoreConfigForm {
  freeShippingThresholdRupees: string;
  standardShippingRupees: string;
  shiprocketPickupPincode: string;
  taxInclusive: boolean;
  gstPercent: string;
  upiMaxRupees: string;
  panVerificationThresholdRupees: string;
  cartReservationMinutes: string;
  maxCartItems: string;
  enableFitFinder: boolean;
  enableReviewsOnPdp: boolean;
  requireVerifiedPurchase: boolean;
  autoApproveReviews: boolean;
}

const defaults: StoreConfigForm = {
  freeShippingThresholdRupees: '5000',
  standardShippingRupees: '0',
  shiprocketPickupPincode: '',
  taxInclusive: true,
  gstPercent: '12',
  upiMaxRupees: '100000',
  panVerificationThresholdRupees: '200000',
  cartReservationMinutes: '15',
  maxCartItems: '20',
  enableFitFinder: true,
  enableReviewsOnPdp: true,
  requireVerifiedPurchase: true,
  autoApproveReviews: false,
};

export default function SettingsPage() {
  const [form, setForm] = useState<StoreConfigForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await settingsApi.get();
      const d = (res.data ?? {}) as Record<string, unknown>;
      const toRupees = (k: string, fallback: string) =>
        d[k] !== undefined && d[k] !== null ? String(Math.round(Number(d[k]) / 100)) : fallback;
      setForm({
        freeShippingThresholdRupees: toRupees('freeShippingThresholdPaise', defaults.freeShippingThresholdRupees),
        standardShippingRupees: toRupees('standardShippingPaise', defaults.standardShippingRupees),
        shiprocketPickupPincode: String(d.shiprocketPickupPincode ?? ''),
        taxInclusive: d.taxInclusive !== undefined ? Boolean(d.taxInclusive) : defaults.taxInclusive,
        gstPercent: d.gstPercent !== undefined ? String(d.gstPercent) : defaults.gstPercent,
        upiMaxRupees: toRupees('upiMaxPaise', defaults.upiMaxRupees),
        panVerificationThresholdRupees: toRupees('panVerificationThresholdPaise', defaults.panVerificationThresholdRupees),
        cartReservationMinutes: d.cartReservationMinutes !== undefined ? String(d.cartReservationMinutes) : defaults.cartReservationMinutes,
        maxCartItems: d.maxCartItems !== undefined ? String(d.maxCartItems) : defaults.maxCartItems,
        enableFitFinder: d.enableFitFinder !== undefined ? Boolean(d.enableFitFinder) : defaults.enableFitFinder,
        enableReviewsOnPdp: d.enableReviewsOnPdp !== undefined ? Boolean(d.enableReviewsOnPdp) : defaults.enableReviewsOnPdp,
        requireVerifiedPurchase: d.requireVerifiedPurchase !== undefined ? Boolean(d.requireVerifiedPurchase) : defaults.requireVerifiedPurchase,
        autoApproveReviews: d.autoApproveReviews !== undefined ? Boolean(d.autoApproveReviews) : defaults.autoApproveReviews,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await settingsApi.update({
        freeShippingThresholdPaise: Math.round(Number(form.freeShippingThresholdRupees || 0) * 100),
        standardShippingPaise: Math.round(Number(form.standardShippingRupees || 0) * 100),
        shiprocketPickupPincode: form.shiprocketPickupPincode.trim(),
        taxInclusive: form.taxInclusive,
        gstPercent: Number(form.gstPercent || 12),
        upiMaxPaise: Math.round(Number(form.upiMaxRupees || 100000) * 100),
        panVerificationThresholdPaise: Math.round(Number(form.panVerificationThresholdRupees || 200000) * 100),
        cartReservationMinutes: Number(form.cartReservationMinutes || 15),
        maxCartItems: Number(form.maxCartItems || 20),
        enableFitFinder: form.enableFitFinder,
        enableReviewsOnPdp: form.enableReviewsOnPdp,
        requireVerifiedPurchase: form.requireVerifiedPurchase,
        autoApproveReviews: form.autoApproveReviews,
      });
      setMessage('Storefront operational settings saved and propagated.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleFlushCache() {
    setFlushing(true);
    setMessage('');
    try {
      await settingsApi.flushCache();
      setMessage('Edge KV storefront cache purged successfully.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cache flush failed');
    } finally {
      setFlushing(false);
    }
  }

  const Toggle = ({ label, tooltip, checked, onChange }: { label: string; tooltip: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2.5 border-b border-ink-100 last:border-0 cursor-pointer">
      <span className="flex items-center gap-1.5 text-sm text-ink-800">
        {label} <InfoTooltip text={tooltip} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded text-gold-600 focus:ring-gold-400"
      />
    </label>
  );

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Configuration"
        description="Configure shipping policies, Indian GST compliance, payment guardrails, inventory reservations, and storefront feature switches."
        actions={
          <>
            <Button variant="outline" loading={flushing} onClick={handleFlushCache}>Purge Edge Cache</Button>
            <Button loading={saving} onClick={handleSave}>Save All Settings</Button>
          </>
        }
      />

      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader title="Shipping & Fulfilment" description="Courier thresholds and Shiprocket dispatch origin" />
          <div className="space-y-4">
            <Input
              label="Free Shipping Threshold (₹)"
              tooltip="Orders at or above this value qualify automatically for complimentary courier delivery."
              type="number"
              value={form.freeShippingThresholdRupees}
              onChange={e => setForm(f => ({ ...f, freeShippingThresholdRupees: e.target.value }))}
            />
            <Input
              label="Standard Shipping Fee (₹)"
              tooltip="Flat shipping charge applied when order subtotal is below the free shipping threshold."
              type="number"
              value={form.standardShippingRupees}
              onChange={e => setForm(f => ({ ...f, standardShippingRupees: e.target.value }))}
            />
            <Input
              label="Shiprocket Pickup PIN Code"
              tooltip="6-digit Indian origin PIN code used for live serviceability and ETA calculations."
              value={form.shiprocketPickupPincode}
              onChange={e => setForm(f => ({ ...f, shiprocketPickupPincode: e.target.value }))}
              placeholder="400001"
            />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Taxation & Compliance" description="GST display and statutory invoice rules" />
          <div className="space-y-4">
            <Input
              label="Default GST Rate (%)"
              tooltip="Standard GST percentage applied across apparel SKUs (e.g. 12% or 18%)."
              type="number"
              value={form.gstPercent}
              onChange={e => setForm(f => ({ ...f, gstPercent: e.target.value }))}
            />
            <Toggle
              label="Tax-Inclusive Pricing"
              tooltip="When enabled, all displayed storefront MRP prices already include applicable GST."
              checked={form.taxInclusive}
              onChange={v => setForm(f => ({ ...f, taxInclusive: v }))}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Payments & Checkout Guardrails" description="RBI UPI caps, PAN verification, and stock locks" />
          <div className="space-y-4">
            <Input
              label="UPI Maximum Order Ceiling (₹)"
              tooltip="Maximum order value permitted via UPI checkout (RBI standard ceiling: ₹1,00,000)."
              type="number"
              value={form.upiMaxRupees}
              onChange={e => setForm(f => ({ ...f, upiMaxRupees: e.target.value }))}
            />
            <Input
              label="PAN Verification Threshold (₹)"
              tooltip="Orders above this statutory threshold prompt customer PAN capture for GST invoicing."
              type="number"
              value={form.panVerificationThresholdRupees}
              onChange={e => setForm(f => ({ ...f, panVerificationThresholdRupees: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cart Lock Duration (min)"
                tooltip="Minutes inventory stays reserved during an active checkout session before cron release."
                type="number"
                value={form.cartReservationMinutes}
                onChange={e => setForm(f => ({ ...f, cartReservationMinutes: e.target.value }))}
              />
              <Input
                label="Max Bag Line Items"
                tooltip="Maximum distinct SKU variants allowed in a single shopping bag."
                type="number"
                value={form.maxCartItems}
                onChange={e => setForm(f => ({ ...f, maxCartItems: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Storefront Feature Switches" description="Control interactive modules across product pages" />
          <div className="divide-y divide-ink-100">
            <Toggle
              label="Enable Fit Finder Assistant"
              tooltip="Displays the tailored size recommendation assistant on Product Detail Pages."
              checked={form.enableFitFinder}
              onChange={v => setForm(f => ({ ...f, enableFitFinder: v }))}
            />
            <Toggle
              label="Show Customer Reviews on PDP"
              tooltip="Renders approved customer ratings and atelier replies on Product Detail Pages."
              checked={form.enableReviewsOnPdp}
              onChange={v => setForm(f => ({ ...f, enableReviewsOnPdp: v }))}
            />
            <Toggle
              label="Require Verified Purchase for Reviews"
              tooltip="Restricts review submission strictly to customers with a fulfilled order containing that SKU."
              checked={form.requireVerifiedPurchase}
              onChange={v => setForm(f => ({ ...f, requireVerifiedPurchase: v }))}
            />
            <Toggle
              label="Auto-Approve Incoming Reviews"
              tooltip="Publishes new reviews immediately without waiting in the manual moderation queue."
              checked={form.autoApproveReviews}
              onChange={v => setForm(f => ({ ...f, autoApproveReviews: v }))}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
