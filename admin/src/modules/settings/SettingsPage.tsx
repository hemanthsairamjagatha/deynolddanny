import { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Input, Select, SectionHeader, Spinner, InfoTooltip, Badge } from '../../components/ui';
import { settings as settingsApi } from '../../lib/api';

interface MarketRow {
  countryCode: string;
  countryName: string;
  currency: string;
  symbol: string;
  region: string;
  enabled: boolean;
  rateFromInr: number;
}

interface FxData {
  mode: 'auto' | 'manual';
  spreadPercent: number;
  source: string;
  updatedAt: string;
  markets: MarketRow[];
}

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
  enableTestCheckout: boolean;
  fxMode: 'auto' | 'manual';
  fxSpreadPercent: string;
  enabledMarkets: string[];
}

const ALL_MARKET_CODES = ['IN', 'US', 'GB', 'EU', 'AE', 'SG', 'AU', 'CA', 'CH', 'JP', 'SA', 'QA'];

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
  enableTestCheckout: true,
  fxMode: 'auto',
  fxSpreadPercent: '0',
  enabledMarkets: ALL_MARKET_CODES,
};

export default function SettingsPage() {
  const [form, setForm] = useState<StoreConfigForm>(defaults);
  const [fxData, setFxData] = useState<FxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [res, fxRes] = await Promise.all([settingsApi.get(), settingsApi.getFx()]);
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
        enableTestCheckout: d.enableTestCheckout !== undefined ? Boolean(d.enableTestCheckout) : defaults.enableTestCheckout,
        fxMode: d.fxMode === 'manual' ? 'manual' : 'auto',
        fxSpreadPercent: d.fxSpreadPercent !== undefined ? String(d.fxSpreadPercent) : '0',
        enabledMarkets: Array.isArray(d.enabledMarkets)
          ? Array.from(new Set(['IN', ...(d.enabledMarkets as string[])]))
          : ALL_MARKET_CODES,
      });
      if (fxRes.success && fxRes.data) {
        setFxData(fxRes.data as unknown as FxData);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleMarket(code: string) {
    if (code === 'IN') return; // Base INR market always enabled
    setForm(f => ({
      ...f,
      enabledMarkets: f.enabledMarkets.includes(code)
        ? f.enabledMarkets.filter(c => c !== code)
        : [...f.enabledMarkets, code],
    }));
  }

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
        enableTestCheckout: form.enableTestCheckout,
        fxMode: form.fxMode,
        fxSpreadPercent: Math.max(0, Math.min(15, Number(form.fxSpreadPercent || 0))),
        enabledMarkets: Array.from(new Set(['IN', ...form.enabledMarkets])),
      });
      const fxRes = await settingsApi.getFx();
      if (fxRes.success && fxRes.data) setFxData(fxRes.data as unknown as FxData);
      setMessage('Storefront operational & multi-currency settings saved and propagated.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshFx() {
    setRefreshingFx(true);
    setMessage('');
    setError('');
    try {
      const res = await settingsApi.refreshFx();
      if (res.success && res.data) {
        setFxData(res.data as unknown as FxData);
        setMessage('Live foreign-exchange rates refreshed from global market feed into Cloudflare Edge KV.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'FX refresh failed');
    } finally {
      setRefreshingFx(false);
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
        description="Configure global target countries & live FX auto-conversion, shipping policies, Indian GST compliance, payment guardrails, and storefront switches."
        actions={
          <>
            <Button variant="outline" loading={flushing} onClick={handleFlushCache}>Purge Edge Cache</Button>
            <Button loading={saving} onClick={handleSave}>Save All Settings</Button>
          </>
        }
      />

      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Global Markets & Live Multi-Currency FX Engine */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <SectionHeader
            title="Global Markets & Live Foreign-Exchange Engine"
            description="Controls the storefront footer Country/Currency selector and automatic 6-hour live INR exchange-rate updates."
          />
          <Button size="sm" variant="secondary" loading={refreshingFx} onClick={handleRefreshFx}>
            Refresh Live FX Now
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Select
            label="Exchange Rate Mode"
            tooltip="Auto syncs live daily INR exchange rates into Cloudflare KV every 6 hours so product display prices track market FX automatically."
            value={form.fxMode}
            onChange={e => setForm(f => ({ ...f, fxMode: e.target.value as 'auto' | 'manual' }))}
            options={[
              { value: 'auto', label: 'Automatic — Live Daily Market Rates (Recommended)' },
              { value: 'manual', label: 'Manual — Fixed Boutique Baseline Rates' },
            ]}
          />
          <Input
            label="International FX Buffer / Spread (%)"
            tooltip="Optional 0%–15% conversion buffer applied to non-INR display currencies to cover international card FX variance."
            type="number"
            step="0.25"
            min="0"
            max="15"
            value={form.fxSpreadPercent}
            onChange={e => setForm(f => ({ ...f, fxSpreadPercent: e.target.value }))}
          />
        </div>

        {fxData && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <span>
                Active Source: <Badge variant="gold">{fxData.source}</Badge>
              </span>
              <span>
                Last Synced: {fxData.updatedAt ? new Date(fxData.updatedAt).toLocaleString('en-IN') : 'Baseline'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {fxData.markets.map(m => {
                const checked = form.enabledMarkets.includes(m.countryCode);
                const sampleConverted = (10000 * m.rateFromInr).toLocaleString('en-US', {
                  maximumFractionDigits: m.currency === 'JPY' ? 0 : 2,
                });
                return (
                  <label
                    key={m.countryCode}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition ${
                      checked ? 'border-ink-900 bg-ink-50/70' : 'border-ink-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={m.countryCode === 'IN'}
                        onChange={() => toggleMarket(m.countryCode)}
                        className="rounded text-gold-600 focus:ring-gold-400"
                      />
                      <div className="truncate">
                        <p className="font-semibold text-ink-900 truncate">{m.countryName}</p>
                        <p className="text-[11px] text-ink-500">{m.countryCode} · {m.currency} ({m.symbol.trim()})</p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-ink-700 shrink-0 ml-2">
                      ₹10k → {m.symbol}{sampleConverted}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </Card>

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
            <Toggle
              label="Sandbox Test Checkout Mode (Testing Only)"
              tooltip="Allows end-to-end order placement & tracking tests without live Razorpay/Cashfree keys in the development/testing environment. Automatically blocked in staging & production."
              checked={form.enableTestCheckout}
              onChange={v => setForm(f => ({ ...f, enableTestCheckout: v }))}
            />
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
