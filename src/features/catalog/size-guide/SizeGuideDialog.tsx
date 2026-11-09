import React, { useState, useEffect } from 'react';
import type { MeasurementUnit } from '../types/size-guide.types';

interface SizeGuideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
}

export const SizeGuideDialog: React.FC<SizeGuideDialogProps> = ({
  isOpen,
  onClose,
  productTitle
}) => {
  const [unit, setUnit] = useState<MeasurementUnit>('cm');

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

  // Measurement charts with CM and INCH values
  const conversionData = [
    { it: 'IT 38', intl: 'XS', us: '2', uk: '6', fr: '34', waistCm: '62 - 65', waistIn: '24.4 - 25.6', hipCm: '88 - 91', hipIn: '34.6 - 35.8', inseamCm: '84', inseamIn: '33.1' },
    { it: 'IT 40', intl: 'S', us: '4', uk: '8', fr: '36', waistCm: '66 - 69', waistIn: '26.0 - 27.2', hipCm: '92 - 95', hipIn: '36.2 - 37.4', inseamCm: '84', inseamIn: '33.1' },
    { it: 'IT 42', intl: 'M', us: '6', uk: '10', fr: '38', waistCm: '70 - 73', waistIn: '27.6 - 28.7', hipCm: '96 - 99', hipIn: '37.8 - 39.0', inseamCm: '85', inseamIn: '33.5' },
    { it: 'IT 44', intl: 'L', us: '8', uk: '12', fr: '40', waistCm: '74 - 78', waistIn: '29.1 - 30.7', hipCm: '100 - 104', hipIn: '39.4 - 40.9', inseamCm: '85', inseamIn: '33.5' },
    { it: 'IT 46', intl: 'XL', us: '10', uk: '14', fr: '42', waistCm: '79 - 83', waistIn: '31.1 - 32.7', hipCm: '105 - 109', hipIn: '41.3 - 42.9', inseamCm: '86', inseamIn: '33.9' },
    { it: 'IT 48', intl: 'XXL', us: '12', uk: '16', fr: '44', waistCm: '84 - 88', waistIn: '33.1 - 34.6', hipCm: '110 - 114', hipIn: '43.3 - 44.9', inseamCm: '86', inseamIn: '33.9' }
  ];

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

        {/* Conversion & Measurement Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-[11px] font-mono">
                <th className="py-3 px-2 font-medium">IT</th>
                <th className="py-3 px-2 font-medium">INTL</th>
                <th className="py-3 px-2 font-medium">US</th>
                <th className="py-3 px-2 font-medium">UK</th>
                <th className="py-3 px-2 font-medium">FR</th>
                <th className="py-3 px-2 font-medium">Waist ({unit})</th>
                <th className="py-3 px-2 font-medium">Hip ({unit})</th>
                <th className="py-3 px-2 font-medium">Inseam ({unit})</th>
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
                  <td className="py-3 px-2">{unit === 'cm' ? row.waistCm : row.waistIn}</td>
                  <td className="py-3 px-2">{unit === 'cm' ? row.hipCm : row.hipIn}</td>
                  <td className="py-3 px-2">{unit === 'cm' ? row.inseamCm : row.inseamIn}</td>
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
      </div>
    </div>
  );
};

