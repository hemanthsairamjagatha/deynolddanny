import React, { useState, useEffect } from 'react';
import type { MeasurementUnit } from '../types/size-guide.types';

interface SizeGuideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  category?: string;
  gender?: string;
  sizes?: string[];
}

interface LiveSizeGuide {
  id: string;
  slug: string;
  title: string;
  categorySlug?: string | null;
  tables?: Array<{ name?: string; headers?: string[]; rows?: string[][] }>;
  notes?: string[];
}

export const SizeGuideDialog: React.FC<SizeGuideDialogProps> = ({
  isOpen,
  onClose,
  productTitle,
  category = '',
  gender = 'Men',
  sizes = [],
}) => {
  const [unit, setUnit] = useState<MeasurementUnit>('cm');
  const [liveGuide, setLiveGuide] = useState<LiveSizeGuide | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/storefront/size-guides', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: { items?: LiveSizeGuide[] } } | null) => {
        const items = json?.data?.items ?? [];
        if (items.length === 0) return;
        const catLower = category.toLowerCase();
        const matched =
          items.find((g) => g.categorySlug && catLower && g.categorySlug.toLowerCase() === catLower) ||
          items.find((g) => !g.categorySlug) ||
          items[0];
        if (matched && Array.isArray(matched.tables) && matched.tables.length > 0) {
          setLiveGuide(matched);
        }
      })
      .catch(() => {});
  }, [isOpen, category]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMensTailoring =
    gender !== 'Women' ||
    sizes.some((s) => ['48', '50', '52', '54', '56', 'M', 'L', 'XL'].includes(s.toUpperCase()));
  const isTrousers = /trouser|pant|denim|jean|short/i.test(`${category} ${productTitle}`);

  // Measurement charts dynamically aligned to garment archetype
  const conversionData = isMensTailoring
    ? isTrousers
      ? [
          { it: 'IT 46', intl: 'S', us: '30', uk: '30', fr: '40', col1Cm: '76 - 80', col1In: '29.9 - 31.5', col2Cm: '94 - 97', col2In: '37.0 - 38.2', col3Cm: '82', col3In: '32.3' },
          { it: 'IT 48', intl: 'M', us: '32', uk: '32', fr: '42', col1Cm: '81 - 85', col1In: '31.9 - 33.5', col2Cm: '98 - 101', col2In: '38.6 - 39.8', col3Cm: '83', col3In: '32.7' },
          { it: 'IT 50', intl: 'L', us: '34', uk: '34', fr: '44', col1Cm: '86 - 90', col1In: '33.9 - 35.4', col2Cm: '102 - 105', col2In: '40.2 - 41.3', col3Cm: '84', col3In: '33.1' },
          { it: 'IT 52', intl: 'XL', us: '36', uk: '36', fr: '46', col1Cm: '91 - 95', col1In: '35.8 - 37.4', col2Cm: '106 - 109', col2In: '41.7 - 42.9', col3Cm: '84', col3In: '33.1' },
          { it: 'IT 54', intl: 'XXL', us: '38', uk: '38', fr: '48', col1Cm: '96 - 100', col1In: '37.8 - 39.4', col2Cm: '110 - 113', col2In: '43.3 - 44.5', col3Cm: '85', col3In: '33.5' },
        ]
      : [
          { it: 'IT 46', intl: 'S', us: '36', uk: '36', fr: '46', col1Cm: '92 - 95', col1In: '36.2 - 37.4', col2Cm: '78 - 82', col2In: '30.7 - 32.3', col3Cm: '44', col3In: '17.3' },
          { it: 'IT 48', intl: 'M', us: '38', uk: '38', fr: '48', col1Cm: '96 - 99', col1In: '37.8 - 39.0', col2Cm: '83 - 87', col2In: '32.7 - 34.3', col3Cm: '45.5', col3In: '17.9' },
          { it: 'IT 50', intl: 'L', us: '40', uk: '40', fr: '50', col1Cm: '100 - 103', col1In: '39.4 - 40.6', col2Cm: '88 - 92', col2In: '34.6 - 36.2', col3Cm: '47', col3In: '18.5' },
          { it: 'IT 52', intl: 'XL', us: '42', uk: '42', fr: '52', col1Cm: '104 - 107', col1In: '40.9 - 42.1', col2Cm: '93 - 97', col2In: '36.6 - 38.2', col3Cm: '48.5', col3In: '19.1' },
          { it: 'IT 54', intl: 'XXL', us: '44', uk: '44', fr: '54', col1Cm: '108 - 112', col1In: '42.5 - 44.1', col2Cm: '98 - 102', col2In: '38.6 - 40.2', col3Cm: '50', col3In: '19.7' },
        ]
    : [
        { it: 'IT 38', intl: 'XS', us: '2', uk: '6', fr: '34', col1Cm: '62 - 65', col1In: '24.4 - 25.6', col2Cm: '88 - 91', col2In: '34.6 - 35.8', col3Cm: '84', col3In: '33.1' },
        { it: 'IT 40', intl: 'S', us: '4', uk: '8', fr: '36', col1Cm: '66 - 69', col1In: '26.0 - 27.2', col2Cm: '92 - 95', col2In: '36.2 - 37.4', col3Cm: '84', col3In: '33.1' },
        { it: 'IT 42', intl: 'M', us: '6', uk: '10', fr: '38', col1Cm: '70 - 73', col1In: '27.6 - 28.7', col2Cm: '96 - 99', col2In: '37.8 - 39.0', col3Cm: '85', col3In: '33.5' },
        { it: 'IT 44', intl: 'L', us: '8', uk: '12', fr: '40', col1Cm: '74 - 78', col1In: '29.1 - 30.7', col2Cm: '100 - 104', col2In: '39.4 - 40.9', col3Cm: '85', col3In: '33.5' },
        { it: 'IT 46', intl: 'XL', us: '10', uk: '14', fr: '42', col1Cm: '79 - 83', col1In: '31.1 - 32.7', col2Cm: '105 - 109', col2In: '41.3 - 42.9', col3Cm: '86', col3In: '33.9' },
      ];

  const col1Header = isMensTailoring && !isTrousers ? 'Chest' : 'Waist';
  const col2Header = isMensTailoring && !isTrousers ? 'Waist' : 'Hip';
  const col3Header = isMensTailoring && !isTrousers ? 'Shoulder' : 'Inseam';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-2xl shadow-2xl border border-neutral-200 p-6 sm:p-8 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Size Guide"
          className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-black transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-100 gap-4">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">
              Sartorial Specifications
            </span>
            <h2 id="size-guide-title" className="text-xl font-light tracking-wide text-neutral-900 mt-1">
              Size & Measurements Guide
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Reference dimensions for {productTitle}
            </p>
          </div>

          {/* Unit Toggle */}
          <div className="inline-flex items-center p-1 bg-neutral-100 rounded-full text-xs font-mono">
            <button
              type="button"
              onClick={() => setUnit('cm')}
              className={`px-3 py-1 rounded-full transition-colors ${
                unit === 'cm'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              CM
            </button>
            <button
              type="button"
              onClick={() => setUnit('in')}
              className={`px-3 py-1 rounded-full transition-colors ${
                unit === 'in'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              INCH
            </button>
          </div>
        </div>

        {/* Conversion & Measurement Table (Live Admin Size Guide when configured, else Atelier Default) */}
        {liveGuide && liveGuide.tables && liveGuide.tables.length > 0 ? (
          <div className="mt-6 space-y-6">
            {liveGuide.tables.map((tbl, tIdx) => (
              <div key={tIdx} className="overflow-x-auto">
                {tbl.name && (
                  <p className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-2">
                    {tbl.name}
                  </p>
                )}
                <table className="w-full text-left text-xs border-collapse">
                  {Array.isArray(tbl.headers) && tbl.headers.length > 0 && (
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-[11px] font-mono">
                        {tbl.headers.map((h, hi) => (
                          <th key={hi} className="py-3 px-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-neutral-100 font-mono text-neutral-800">
                    {(tbl.rows ?? []).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-neutral-50/70 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className={`py-3 px-2 ${cIdx === 0 ? 'font-semibold text-neutral-950' : 'text-neutral-600'}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {Array.isArray(liveGuide.notes) && liveGuide.notes.length > 0 && (
              <div className="pt-4 border-t border-neutral-100 space-y-1.5 text-xs text-neutral-600">
                {liveGuide.notes.map((n, ni) => (
                  <p key={ni}>&bull; {n}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
        <>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-[11px] font-mono">
                <th className="py-3 px-2 font-medium">IT</th>
                <th className="py-3 px-2 font-medium">INTL</th>
                <th className="py-3 px-2 font-medium">US</th>
                <th className="py-3 px-2 font-medium">UK</th>
                <th className="py-3 px-2 font-medium">FR</th>
                <th className="py-3 px-2 font-medium">{col1Header} ({unit})</th>
                <th className="py-3 px-2 font-medium">{col2Header} ({unit})</th>
                <th className="py-3 px-2 font-medium">{col3Header} ({unit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-mono text-neutral-800">
              {conversionData.map((row, idx) => (
                <tr key={idx} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-3 px-2 font-semibold text-neutral-950">{row.it}</td>
                  <td className="py-3 px-2 text-neutral-600">{row.intl}</td>
                  <td className="py-3 px-2 text-neutral-600">{row.us}</td>
                  <td className="py-3 px-2 text-neutral-600">{row.uk}</td>
                  <td className="py-3 px-2 text-neutral-600">{row.fr}</td>
                  <td className="py-3 px-2">{unit === 'cm' ? row.col1Cm : row.col1In}</td>
                  <td className="py-3 px-2">{unit === 'cm' ? row.col2Cm : row.col2In}</td>
                  <td className="py-3 px-2">{unit === 'cm' ? row.col3Cm : row.col3In}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* How to Measure Note */}
        <div className="mt-8 pt-6 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-neutral-600">
          <div>
            <span className="font-semibold text-neutral-900 block mb-1">1. Waist</span>
            Measure around the narrowest part of your natural waistline, keeping the tape comfortably loose.
          </div>
          <div>
            <span className="font-semibold text-neutral-900 block mb-1">2. Hips</span>
            Measure around the fullest part of your hips and bottom, keeping tape parallel to the floor.
          </div>
          <div>
            <span className="font-semibold text-neutral-900 block mb-1">3. Inseam</span>
            Measure from the highest point of the inner leg along the seam down to the hemline.
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

