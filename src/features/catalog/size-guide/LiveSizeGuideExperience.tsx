import React, { useState, useEffect } from 'react';

export interface LiveSizeGuide {
  id: string;
  slug: string;
  title: string;
  categorySlug?: string | null;
  tables?: Array<{ name?: string; headers?: string[]; rows?: string[][] }>;
  notes?: string[];
  fitRules?: Record<string, unknown>;
}

const DEFAULT_GUIDES: LiveSizeGuide[] = [
  {
    id: 'default-tailoring',
    slug: 'italian-tailoring',
    title: 'Italian Tailoring & Outerwear Size Matrix',
    categorySlug: 'suits',
    tables: [
      {
        name: 'Suits, Blazers & Overcoats Conversion',
        headers: ['IT', 'INTL', 'US', 'UK', 'FR', 'Chest (cm)', 'Waist (cm)', 'Shoulder (cm)'],
        rows: [
          ['IT 46', 'S', '36', '36', '46', '92 - 95', '78 - 82', '44'],
          ['IT 48', 'M', '38', '38', '48', '96 - 99', '83 - 87', '45.5'],
          ['IT 50', 'L', '40', '40', '50', '100 - 103', '88 - 92', '47'],
          ['IT 52', 'XL', '42', '42', '52', '104 - 107', '93 - 97', '48.5'],
          ['IT 54', 'XXL', '44', '44', '54', '108 - 112', '98 - 102', '50'],
        ],
      },
    ],
    notes: [
      'Dimensions represent garment measurements across chest, waist, and shoulder points.',
      'Suits feature natural canvas construction with 4cm excess seam allowance for tailor adjustment.',
    ],
  },
  {
    id: 'default-trousers',
    slug: 'trousers-and-cady',
    title: 'Trousers & Cady Silhouettes Size Guide',
    categorySlug: 'trousers',
    tables: [
      {
        name: 'Trousers & Chinos Conversion',
        headers: ['IT', 'INTL', 'US', 'UK', 'FR', 'Waist (cm)', 'Hip (cm)', 'Inseam (cm)'],
        rows: [
          ['IT 46', 'S', '30', '30', '40', '76 - 80', '94 - 97', '82'],
          ['IT 48', 'M', '32', '32', '42', '81 - 85', '98 - 101', '83'],
          ['IT 50', 'L', '34', '34', '44', '86 - 90', '102 - 105', '84'],
          ['IT 52', 'XL', '36', '36', '46', '91 - 95', '106 - 109', '84'],
          ['IT 54', 'XXL', '38', '38', '48', '96 - 100', '110 - 113', '85'],
        ],
      },
    ],
    notes: [
      'High-rise waistband sits at the natural waistline.',
      'Supplied unhemmed or blind-stitched with generous hem allowance for bespoke alteration.',
    ],
  },
];

export const LiveSizeGuideExperience: React.FC = () => {
  const [guides, setGuides] = useState<LiveSizeGuide[]>(DEFAULT_GUIDES);
  const [activeGuideId, setActiveGuideId] = useState<string>(DEFAULT_GUIDES[0].id);
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  useEffect(() => {
    fetch('/api/storefront/size-guides', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { success?: boolean; data?: { items?: LiveSizeGuide[] } } | null) => {
        const items = json?.data?.items ?? [];
        if (items.length > 0) {
          setGuides(items);
          setActiveGuideId(items[0].id || items[0].slug);
        }
      })
      .catch(() => {});
  }, []);

  const activeGuide = guides.find((g) => (g.id || g.slug) === activeGuideId) || guides[0];

  return (
    <div className="w-full">
      {/* Category Guide Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {guides.map((g) => {
            const key = g.id || g.slug;
            const isActive = key === activeGuideId;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveGuideId(key)}
                className={`text-xs px-4 py-2 rounded-full font-mono uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white font-medium shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
                }`}
              >
                {g.title}
              </button>
            );
          })}
        </div>

        {/* Unit Switcher */}
        <div className="inline-flex items-center p-1 bg-neutral-100 rounded-full text-xs font-mono">
          <button
            type="button"
            onClick={() => setUnit('cm')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
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
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              unit === 'in'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            INCH
          </button>
        </div>
      </div>

      {/* Active Guide Content */}
      {activeGuide && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 block mb-1">
              {activeGuide.categorySlug ? `Category: ${activeGuide.categorySlug.toUpperCase()}` : 'Atelier Matrix'}
            </span>
            <h2 className="text-2xl font-light text-neutral-950 tracking-tight">
              {activeGuide.title}
            </h2>
          </div>

          {/* Tables */}
          {Array.isArray(activeGuide.tables) && activeGuide.tables.length > 0 ? (
            <div className="space-y-8">
              {activeGuide.tables.map((tbl, tIdx) => (
                <div key={tIdx} className="border border-neutral-200 overflow-hidden bg-white shadow-xs">
                  {tbl.name && (
                    <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-700">
                        {tbl.name}
                      </h3>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      {Array.isArray(tbl.headers) && tbl.headers.length > 0 && (
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50/50 text-neutral-500 uppercase tracking-wider text-[11px] font-mono">
                            {tbl.headers.map((h, hi) => (
                              <th key={hi} className="py-3 px-4 font-medium whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody className="divide-y divide-neutral-100 font-mono text-neutral-800">
                        {(tbl.rows ?? []).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-neutral-50/70 transition-colors">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`py-3.5 px-4 whitespace-nowrap ${
                                  cIdx === 0 ? 'font-semibold text-neutral-950' : 'text-neutral-600'
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-neutral-500 border border-neutral-200 bg-neutral-50">
              No measurements configured for this category.
            </div>
          )}

          {/* Measurement Notes & Fit Rules */}
          {Array.isArray(activeGuide.notes) && activeGuide.notes.length > 0 && (
            <div className="p-6 bg-neutral-50 border border-neutral-200 space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-900 font-medium mb-2">
                Atelier Notes &amp; Fit Recommendations
              </h4>
              {activeGuide.notes.map((note, nIdx) => (
                <p key={nIdx} className="text-xs text-neutral-600 leading-relaxed">
                  &bull; {note}
                </p>
              ))}
            </div>
          )}

          {/* Measurement Guidelines Callout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-neutral-200 text-xs text-neutral-600">
            <div>
              <span className="font-semibold text-neutral-950 block mb-1">1. Chest / Bust</span>
              Measure under the armpits around the fullest part of the chest, keeping tape horizontal.
            </div>
            <div>
              <span className="font-semibold text-neutral-950 block mb-1">2. Natural Waist</span>
              Measure around your natural waistline, typically narrowest point above the hips.
            </div>
            <div>
              <span className="font-semibold text-neutral-950 block mb-1">3. Inseam / Length</span>
              Measure from the crotch point vertically down along the inner leg to the ankle bone.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
