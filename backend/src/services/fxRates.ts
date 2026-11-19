// =============================================================================
// DEYNOLD DANNY — Multi-Country Live Foreign Exchange Service
// Authoritative settlement currency: INR (₹)
// Automatically fetches & caches live INR exchange rates in Cloudflare KV
// (6-hour TTL) with admin spread/override controls and zero-crash fallbacks.
// =============================================================================

import type { Env } from '../types/bindings.js';

export interface MarketCurrency {
  countryCode: string;
  countryName: string;
  currency: string;
  symbol: string;
  locale: string;
  decimals: number;
  region: 'Domestic' | 'Americas' | 'Europe' | 'Middle East' | 'Asia-Pacific';
  shippingNote: string;
  enabled: boolean;
  rateFromInr: number;
}

export interface FxAdminConfig {
  fxMode?: 'auto' | 'manual';
  fxSpreadPercent?: number;
  enabledMarkets?: string[];
  manualRates?: Record<string, number>;
}

export interface FxSnapshot {
  base: 'INR';
  mode: 'auto' | 'manual';
  spreadPercent: number;
  source: 'live-open-er' | 'live-frankfurter' | 'kv-cache' | 'manual' | 'baseline-fallback';
  updatedAt: string;
  settlementDisclosure: string;
  rates: Record<string, number>;
  markets: MarketCurrency[];
  detectedCountry?: string | null;
  detectedMarket?: string;
}

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/**
 * Resolves an incoming Cloudflare edge ISO 3166-1 alpha-2 country code (cf-ipcountry)
 * to the most appropriate supported luxury market.
 */
export function resolveMarketFromCountryCode(rawCountry: string | null | undefined): string {
  if (!rawCountry) return 'IN';
  const code = rawCountry.trim().toUpperCase();
  if (GLOBAL_MARKETS.some((m) => m.countryCode === code)) {
    return code;
  }
  if (EU_COUNTRY_CODES.has(code)) {
    return 'EU';
  }
  // Universal international luxury reserve benchmark
  return 'US';
}

interface MarketSeed {
  countryCode: string;
  countryName: string;
  currency: string;
  symbol: string;
  locale: string;
  decimals: number;
  region: MarketCurrency['region'];
  shippingNote: string;
  fallbackRateFromInr: number;
}

export const GLOBAL_MARKETS: MarketSeed[] = [
  { countryCode: 'IN', countryName: 'India',                currency: 'INR', symbol: '₹',    locale: 'en-IN', decimals: 2, region: 'Domestic',     shippingNote: 'Complimentary express shipping above threshold · GST inclusive', fallbackRateFromInr: 1 },
  { countryCode: 'US', countryName: 'United States',        currency: 'USD', symbol: '$',    locale: 'en-US', decimals: 2, region: 'Americas',     shippingNote: 'DHL Express insured international air (4–7 business days)',      fallbackRateFromInr: 0.0118 },
  { countryCode: 'GB', countryName: 'United Kingdom',       currency: 'GBP', symbol: '£',    locale: 'en-GB', decimals: 2, region: 'Europe',       shippingNote: 'DHL Express insured international air (4–6 business days)',      fallbackRateFromInr: 0.0093 },
  { countryCode: 'EU', countryName: 'European Union',       currency: 'EUR', symbol: '€',    locale: 'de-DE', decimals: 2, region: 'Europe',       shippingNote: 'DHL Express insured international air (4–7 business days)',      fallbackRateFromInr: 0.0110 },
  { countryCode: 'AE', countryName: 'United Arab Emirates', currency: 'AED', symbol: 'AED ', locale: 'en-AE', decimals: 2, region: 'Middle East',  shippingNote: 'Priority Express Gulf courier (3–5 business days)',              fallbackRateFromInr: 0.0434 },
  { countryCode: 'SG', countryName: 'Singapore',            currency: 'SGD', symbol: 'S$',   locale: 'en-SG', decimals: 2, region: 'Asia-Pacific', shippingNote: 'Express APAC air courier (3–5 business days)',                   fallbackRateFromInr: 0.0158 },
  { countryCode: 'AU', countryName: 'Australia',            currency: 'AUD', symbol: 'A$',   locale: 'en-AU', decimals: 2, region: 'Asia-Pacific', shippingNote: 'DHL Express insured international air (5–7 business days)',      fallbackRateFromInr: 0.0182 },
  { countryCode: 'CA', countryName: 'Canada',               currency: 'CAD', symbol: 'C$',   locale: 'en-CA', decimals: 2, region: 'Americas',     shippingNote: 'DHL Express insured international air (5–8 business days)',      fallbackRateFromInr: 0.0165 },
  { countryCode: 'CH', countryName: 'Switzerland',          currency: 'CHF', symbol: 'CHF ', locale: 'de-CH', decimals: 2, region: 'Europe',       shippingNote: 'DHL Express insured international air (4–6 business days)',      fallbackRateFromInr: 0.0104 },
  { countryCode: 'JP', countryName: 'Japan',                currency: 'JPY', symbol: '¥',    locale: 'ja-JP', decimals: 0, region: 'Asia-Pacific', shippingNote: 'DHL Express insured international air (4–6 business days)',      fallbackRateFromInr: 1.81 },
  { countryCode: 'SA', countryName: 'Saudi Arabia',         currency: 'SAR', symbol: 'SAR ', locale: 'en-SA', decimals: 2, region: 'Middle East',  shippingNote: 'Priority Express Gulf courier (3–6 business days)',              fallbackRateFromInr: 0.0443 },
  { countryCode: 'QA', countryName: 'Qatar',                currency: 'QAR', symbol: 'QAR ', locale: 'en-QA', decimals: 2, region: 'Middle East',  shippingNote: 'Priority Express Gulf courier (3–6 business days)',              fallbackRateFromInr: 0.0430 },
];

const FX_KV_KEY = 'fx:inr:live:v1';
const FX_KV_TTL_SECONDS = 6 * 60 * 60; // Auto-refresh every 6 hours (4x daily)

interface CachedLiveFx {
  rates: Record<string, number>;
  source: 'live-open-er' | 'live-frankfurter';
  updatedAt: string;
}

async function fetchUpstreamRates(): Promise<CachedLiveFx | null> {
  // Primary: open.er-api.com (no key, covers AED, SAR, QAR, USD, GBP, EUR, SGD, AUD, CAD, CHF, JPY)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch('https://open.er-api.com/v6/latest/INR', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (json.rates && typeof json.rates.USD === 'number' && json.rates.USD > 0) {
        return {
          rates: { ...json.rates, INR: 1 },
          source: 'live-open-er',
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fall through to ECB / Frankfurter
  }

  // Secondary: Frankfurter (European Central Bank official reference rates)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch('https://api.frankfurter.app/latest?from=INR', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> };
      if (json.rates && typeof json.rates.USD === 'number' && json.rates.USD > 0) {
        return {
          rates: { ...json.rates, INR: 1 },
          source: 'live-frankfurter',
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fall back to baseline rates
  }

  return null;
}

async function loadFxAdminConfig(env: Env): Promise<FxAdminConfig> {
  try {
    const row = await env.DB.prepare(
      `SELECT settings_json FROM store_settings WHERE id = 'default' LIMIT 1`,
    ).first<{ settings_json: string }>();
    if (!row?.settings_json) return {};
    const parsed = JSON.parse(row.settings_json) as Record<string, unknown>;
    return {
      fxMode: parsed.fxMode === 'manual' ? 'manual' : 'auto',
      fxSpreadPercent:
        typeof parsed.fxSpreadPercent === 'number' && Number.isFinite(parsed.fxSpreadPercent)
          ? Math.max(0, Math.min(15, parsed.fxSpreadPercent))
          : 0,
      enabledMarkets: Array.isArray(parsed.enabledMarkets)
        ? parsed.enabledMarkets.filter((m): m is string => typeof m === 'string')
        : undefined,
      manualRates:
        parsed.manualRates && typeof parsed.manualRates === 'object'
          ? (parsed.manualRates as Record<string, number>)
          : undefined,
    };
  } catch {
    return {};
  }
}

export async function getLiveFxSnapshot(env: Env, forceRefresh = false): Promise<FxSnapshot> {
  const cfg = await loadFxAdminConfig(env);
  const mode = cfg.fxMode ?? 'auto';
  const spreadPercent = cfg.fxSpreadPercent ?? 0;
  const spreadMultiplier = 1 + spreadPercent / 100;
  const enabledSet = cfg.enabledMarkets?.length
    ? new Set(['IN', ...cfg.enabledMarkets.map((c) => c.toUpperCase())])
    : null;

  let rawRates: Record<string, number> = {};
  let source: FxSnapshot['source'] = 'baseline-fallback';
  let updatedAt = new Date().toISOString();

  if (mode === 'manual') {
    source = 'manual';
  } else {
    let cached: CachedLiveFx | null = null;
    if (!forceRefresh && env.CATALOG_KV) {
      try {
        const kvVal = await env.CATALOG_KV.get(FX_KV_KEY, 'json');
        if (kvVal && typeof kvVal === 'object' && 'rates' in kvVal) {
          cached = kvVal as CachedLiveFx;
          rawRates = cached.rates;
          source = 'kv-cache';
          updatedAt = cached.updatedAt;
        }
      } catch {
        // Ignore KV read issue
      }
    }

    if (!cached) {
      const live = await fetchUpstreamRates();
      if (live) {
        rawRates = live.rates;
        source = live.source;
        updatedAt = live.updatedAt;
        if (env.CATALOG_KV) {
          try {
            await env.CATALOG_KV.put(FX_KV_KEY, JSON.stringify(live), {
              expirationTtl: FX_KV_TTL_SECONDS,
            });
          } catch {
            // Non-blocking cache write
          }
        }
      }
    }
  }

  const finalRates: Record<string, number> = { INR: 1 };
  const markets: MarketCurrency[] = GLOBAL_MARKETS.map((seed) => {
    const manualOverride = cfg.manualRates?.[seed.currency];
    let effectiveRate: number;
    if (seed.currency === 'INR') {
      effectiveRate = 1;
    } else if (typeof manualOverride === 'number' && Number.isFinite(manualOverride) && manualOverride > 0) {
      effectiveRate = manualOverride;
    } else {
      const baseRate = rawRates[seed.currency] ?? seed.fallbackRateFromInr;
      effectiveRate = Number((baseRate * spreadMultiplier).toPrecision(6));
    }
    finalRates[seed.currency] = effectiveRate;
    const enabled = enabledSet ? enabledSet.has(seed.countryCode) : true;
    return {
      countryCode: seed.countryCode,
      countryName: seed.countryName,
      currency: seed.currency,
      symbol: seed.symbol,
      locale: seed.locale,
      decimals: seed.decimals,
      region: seed.region,
      shippingNote: seed.shippingNote,
      enabled,
      rateFromInr: effectiveRate,
    };
  });

  return {
    base: 'INR',
    mode,
    spreadPercent,
    source,
    updatedAt,
    settlementDisclosure:
      'Display prices outside India are indicative conversions from Indian Rupees (INR) using live reference exchange rates. Authoritative order settlement occurs in INR (₹) via PCI-DSS Level 1 payment gateways; your card issuer applies its prevailing settlement rate.',
    rates: finalRates,
    markets,
  };
}
