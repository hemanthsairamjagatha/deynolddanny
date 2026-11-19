import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $detectedMarket,
  $fxSnapshot,
  $hasManualSelection,
  $selectedCountry,
  getActiveMarket,
  initCurrencyStore,
  selectMarket,
  type MarketOption,
} from '../../lib/currency/currency.store';

const REGION_ORDER: MarketOption['region'][] = [
  'Domestic',
  'Americas',
  'Europe',
  'Middle East',
  'Asia-Pacific',
];

export const CurrencySelector: React.FC = () => {
  const selectedCountry = useStore($selectedCountry);
  const detectedMarket = useStore($detectedMarket);
  const hasManual = useStore($hasManualSelection);
  const fx = useStore($fxSnapshot);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initCurrencyStore();
  }, []);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => searchRef.current?.focus(), 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const active = getActiveMarket(selectedCountry, fx);

  const filteredByRegion = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = fx.markets.filter((m) => {
      if (!q) return true;
      return (
        m.countryName.toLowerCase().includes(q) ||
        m.currency.toLowerCase().includes(q) ||
        m.countryCode.toLowerCase().includes(q) ||
        m.region.toLowerCase().includes(q)
      );
    });

    const grouped = new Map<MarketOption['region'], MarketOption[]>();
    for (const region of REGION_ORDER) {
      const items = list.filter((m) => m.region === region);
      if (items.length > 0) grouped.set(region, items);
    }
    return grouped;
  }, [fx.markets, query]);

  const updatedLabel = useMemo(() => {
    if (!fx.updatedAt) return 'Live reference rates';
    try {
      const d = new Date(fx.updatedAt);
      return `Rates synced ${d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`;
    } catch {
      return 'Live reference rates';
    }
  }, [fx.updatedAt]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="footer-currency-btn"
        aria-label={`Select shipping country and currency. Currently ${active.countryName} (${active.currency})`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="footer-currency-label">
          {active.countryCode} ({active.currency} {active.symbol.trim()})
        </span>
        <svg
          className="footer-chevron-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dd-currency-dialog-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          />

          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-white border border-neutral-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-neutral-200">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500 mb-1">
                  Global Flagship · Shipping &amp; Currency
                </p>
                <h2
                  id="dd-currency-dialog-title"
                  className="text-lg font-normal tracking-wide text-neutral-900 uppercase"
                >
                  Select Country &amp; Currency
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close country and currency selector"
                className="p-2 text-neutral-500 hover:text-black transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Search filter */}
            <div className="px-6 py-3.5 border-b border-neutral-100 bg-neutral-50/60">
              <div className="relative">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search country or currency (e.g. United States, GBP, UAE, EUR)..."
                  aria-label="Filter countries and currencies"
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Markets Grid */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {Array.from(filteredByRegion.entries()).map(([region, items]) => (
                <section key={region} aria-label={region}>
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                    {region === 'Domestic' ? 'Flagship Origin — India' : region}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {items.map((m) => {
                      const isSelected = m.countryCode === active.countryCode;
                      return (
                        <button
                          key={m.countryCode}
                          type="button"
                          onClick={() => {
                            selectMarket(m.countryCode);
                            setOpen(false);
                            triggerRef.current?.focus();
                          }}
                          className={`text-left px-4 py-3 border transition-all flex items-start justify-between gap-3 ${
                            isSelected
                              ? 'border-black bg-neutral-900 text-white'
                              : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-medium tracking-wide uppercase">
                                {m.countryName}
                              </p>
                              {m.countryCode === detectedMarket && (
                                <span
                                  className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[2px] font-mono ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                                  }`}
                                >
                                  Detected Location
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[10px] mt-1 leading-snug ${
                                isSelected ? 'text-neutral-300' : 'text-neutral-500'
                              }`}
                            >
                              {m.shippingNote}
                            </p>
                          </div>
                          <span
                            className={`text-[11px] font-mono shrink-0 ${
                              isSelected ? 'text-white font-semibold' : 'text-neutral-700'
                            }`}
                          >
                            {m.currency} ({m.symbol.trim()})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {filteredByRegion.size === 0 && (
                <p className="text-center text-xs text-neutral-500 py-8">
                  No shipping market matches &ldquo;{query}&rdquo;. For bespoke diplomatic or unlisted destinations, contact{' '}
                  <a href="/contact" className="underline text-neutral-900">
                    our Concierge
                  </a>
                  .
                </p>
              )}
            </div>

            {/* Legal FX Disclosure Footer */}
            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 text-[11px] text-neutral-600 leading-relaxed flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="max-w-xl">
                {fx.settlementDisclosure}
              </p>
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 shrink-0">
                {fx.mode === 'manual' ? 'Boutique Fixed FX' : updatedLabel}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CurrencySelector;
