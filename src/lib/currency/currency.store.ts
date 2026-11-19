// src/lib/currency/currency.store.ts
// Multi-country live FX currency preference store for DEYNOLD DANNY.
// Authoritative settlement currency on backend remains INR (₹);
// live reference rates auto-refresh every 6h via /api/storefront/exchange-rates.

import { atom } from 'nanostores';

export interface MarketOption {
  countryCode: string;
  countryName: string;
  currency: string;
  symbol: string;
  locale: string;
  decimals: number;
  region: 'Domestic' | 'Americas' | 'Europe' | 'Middle East' | 'Asia-Pacific';
  shippingNote: string;
  enabled?: boolean;
  rateFromInr: number;
}

export interface FxSnapshot {
  base: 'INR';
  mode: 'auto' | 'manual';
  spreadPercent: number;
  source: string;
  updatedAt: string;
  settlementDisclosure: string;
  rates: Record<string, number>;
  markets: MarketOption[];
}

export const DEFAULT_MARKETS: MarketOption[] = [
  { countryCode: 'IN', countryName: 'India',                currency: 'INR', symbol: '₹',    locale: 'en-IN', decimals: 2, region: 'Domestic',     shippingNote: 'Complimentary express shipping above threshold · GST inclusive', rateFromInr: 1 },
  { countryCode: 'US', countryName: 'United States',        currency: 'USD', symbol: '$',    locale: 'en-US', decimals: 2, region: 'Americas',     shippingNote: 'DHL Express insured international air (4–7 business days)',      rateFromInr: 0.0118 },
  { countryCode: 'GB', countryName: 'United Kingdom',       currency: 'GBP', symbol: '£',    locale: 'en-GB', decimals: 2, region: 'Europe',       shippingNote: 'DHL Express insured international air (4–6 business days)',      rateFromInr: 0.0093 },
  { countryCode: 'EU', countryName: 'European Union',       currency: 'EUR', symbol: '€',    locale: 'de-DE', decimals: 2, region: 'Europe',       shippingNote: 'DHL Express insured international air (4–7 business days)',      rateFromInr: 0.0110 },
  { countryCode: 'AE', countryName: 'United Arab Emirates', currency: 'AED', symbol: 'AED ', locale: 'en-AE', decimals: 2, region: 'Middle East',  shippingNote: 'Priority Express Gulf courier (3–5 business days)',              rateFromInr: 0.0434 },
  { countryCode: 'SG', countryName: 'Singapore',            currency: 'SGD', symbol: 'S$',   locale: 'en-SG', decimals: 2, region: 'Asia-Pacific', shippingNote: 'Express APAC air courier (3–5 business days)',                   rateFromInr: 0.0158 },
  { countryCode: 'AU', countryName: 'Australia',            currency: 'AUD', symbol: 'A$',   locale: 'en-AU', decimals: 2, region: 'Asia-Pacific', shippingNote: 'DHL Express insured international air (5–7 business days)',      rateFromInr: 0.0182 },
  { countryCode: 'CA', countryName: 'Canada',               currency: 'CAD', symbol: 'C$',   locale: 'en-CA', decimals: 2, region: 'Americas',     shippingNote: 'DHL Express insured international air (5–8 business days)',      rateFromInr: 0.0165 },
  { countryCode: 'CH', countryName: 'Switzerland',          currency: 'CHF', symbol: 'CHF ', locale: 'de-CH', decimals: 2, region: 'Europe',       shippingNote: 'DHL Express insured international air (4–6 business days)',      rateFromInr: 0.0104 },
  { countryCode: 'JP', countryName: 'Japan',                currency: 'JPY', symbol: '¥',    locale: 'ja-JP', decimals: 0, region: 'Asia-Pacific', shippingNote: 'DHL Express insured international air (4–6 business days)',      rateFromInr: 1.81 },
  { countryCode: 'SA', countryName: 'Saudi Arabia',         currency: 'SAR', symbol: 'SAR ', locale: 'en-SA', decimals: 2, region: 'Middle East',  shippingNote: 'Priority Express Gulf courier (3–6 business days)',              rateFromInr: 0.0443 },
  { countryCode: 'QA', countryName: 'Qatar',                currency: 'QAR', symbol: 'QAR ', locale: 'en-QA', decimals: 2, region: 'Middle East',  shippingNote: 'Priority Express Gulf courier (3–6 business days)',              rateFromInr: 0.0430 },
];

const DEFAULT_SNAPSHOT: FxSnapshot = {
  base: 'INR',
  mode: 'auto',
  spreadPercent: 0,
  source: 'baseline-fallback',
  updatedAt: '',
  settlementDisclosure:
    'Display prices outside India are indicative conversions from Indian Rupees (INR) using live reference exchange rates. Authoritative order settlement occurs in INR (₹) at checkout.',
  rates: Object.fromEntries(DEFAULT_MARKETS.map((m) => [m.currency, m.rateFromInr])),
  markets: DEFAULT_MARKETS,
};

const STORAGE_KEY = 'dd_region_currency';

export const $selectedCountry = atom<string>('IN');
export const $fxSnapshot = atom<FxSnapshot>(DEFAULT_SNAPSHOT);

let fxInitialized = false;

export function getActiveMarket(countryCode?: string, snapshot?: FxSnapshot): MarketOption {
  const snap = snapshot ?? $fxSnapshot.get();
  const code = (countryCode ?? $selectedCountry.get()).toUpperCase();
  return (
    snap.markets.find((m) => m.countryCode === code) ??
    snap.markets.find((m) => m.countryCode === 'IN') ??
    DEFAULT_MARKETS[0]
  );
}

/** Parse a display string like "₹ 16,200.00" or "₹16,200" into numeric INR rupees. */
export function parseInrString(value: string | number | undefined | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/** Format an INR rupee amount in the currently selected market currency. */
export function formatInrAmount(
  amountInr: number,
  countryCode?: string,
  snapshot?: FxSnapshot,
): string {
  const safeInr = Number.isFinite(amountInr) ? amountInr : 0;
  const market = getActiveMarket(countryCode, snapshot);
  const snap = snapshot ?? $fxSnapshot.get();

  if (market.currency === 'INR') {
    return `₹ ${safeInr.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const rate = snap.rates[market.currency] ?? market.rateFromInr ?? 1;
  const converted = safeInr * rate;
  const formatted = converted.toLocaleString(market.locale || 'en-US', {
    minimumFractionDigits: market.decimals,
    maximumFractionDigits: market.decimals,
  });

  const needsSpace = market.symbol.endsWith(' ');
  return needsSpace ? `${market.symbol}${formatted}` : `${market.symbol}${formatted}`;
}

export function formatPaiseAmount(
  paise: number,
  countryCode?: string,
  snapshot?: FxSnapshot,
): string {
  return formatInrAmount((Number.isFinite(paise) ? paise : 0) / 100, countryCode, snapshot);
}

export function formatInrDisplayString(
  rawPrice: string | number,
  countryCode?: string,
  snapshot?: FxSnapshot,
): string {
  const num = parseInrString(rawPrice);
  if (num === null) return String(rawPrice ?? '');
  return formatInrAmount(num, countryCode, snapshot);
}

/** Persist country preference and re-sync any static DOM price elements. */
export function selectMarket(countryCode: string): void {
  const snap = $fxSnapshot.get();
  const valid = snap.markets.some((m) => m.countryCode === countryCode) ? countryCode : 'IN';
  $selectedCountry.set(valid);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, valid);
    } catch {
      // Ignore storage quota / private-mode restrictions
    }
    syncStaticDomPrices();
  }
}

/**
 * Automatically updates static Astro-rendered price elements (e.g. StyleItWith,
 * RelatedProducts, or any element bearing `data-price-inr`) whenever the user
 * switches country OR fresh live exchange rates arrive from Cloudflare KV.
 */
export function syncStaticDomPrices(): void {
  if (typeof document === 'undefined') return;
  const code = $selectedCountry.get();
  const snap = $fxSnapshot.get();

  // 1. Elements explicitly tagged with data-price-inr
  document.querySelectorAll<HTMLElement>('[data-price-inr]').forEach((el) => {
    const inr = parseInrString(el.dataset.priceInr);
    if (inr !== null) {
      el.textContent = formatInrAmount(inr, code, snap);
    }
  });

  // 2. Any product/lookbook price node whose original INR value hasn't been captured yet
  document.querySelectorAll<HTMLElement>('.product-price, .dd-live-price').forEach((el) => {
    if (!el.dataset.priceInr) {
      const parsed = parseInrString(el.textContent);
      if (parsed !== null && (el.textContent?.includes('₹') || el.dataset.priceInr)) {
        el.dataset.priceInr = String(parsed);
      }
    }
    const inr = parseInrString(el.dataset.priceInr);
    if (inr !== null) {
      el.textContent = formatInrAmount(inr, code, snap);
    }
  });
}

/** Initialize saved country preference and fetch live daily FX rates once per page load. */
export async function initCurrencyStore(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && /^[A-Z]{2}$/.test(saved)) {
      $selectedCountry.set(saved);
    }
  } catch {
    // Ignore storage read failure
  }

  syncStaticDomPrices();

  if (fxInitialized) return;
  fxInitialized = true;

  try {
    const res = await fetch('/api/storefront/exchange-rates', { credentials: 'omit' });
    if (!res.ok) return;
    const json = (await res.json()) as { success?: boolean; data?: FxSnapshot };
    if (json.success && json.data && Array.isArray(json.data.markets) && json.data.markets.length > 0) {
      $fxSnapshot.set(json.data);
      // If previously selected market was disabled by Admin, revert gracefully to India
      const current = $selectedCountry.get();
      if (!json.data.markets.some((m) => m.countryCode === current)) {
        $selectedCountry.set('IN');
      }
      syncStaticDomPrices();
    }
  } catch {
    // Silent fallback to baseline rates
  }
}
