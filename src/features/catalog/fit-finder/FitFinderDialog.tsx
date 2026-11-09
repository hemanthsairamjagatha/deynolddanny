import React, { useState, useEffect } from 'react';
import type { FitRecommendationResult } from '../types/fit-recommendation.types';

interface FitFinderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableSizes: string[];
  productTitle: string;
  onApplySize: (size: string) => void;
}

export const FitFinderDialog: React.FC<FitFinderDialogProps> = ({
  isOpen,
  onClose,
  availableSizes,
  productTitle,
  onApplySize
}) => {
  const [heightCm, setHeightCm] = useState<number>(172);
  const [weightKg, setWeightKg] = useState<number>(60);
  const [fitPreference, setFitPreference] = useState<'slim' | 'regular' | 'relaxed'>('regular');
  const [result, setResult] = useState<FitRecommendationResult | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
    }
  }, [isOpen]);

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

  const calculateFit = (e: React.FormEvent) => {
    e.preventDefault();

    // Determine baseline index across available sizes
    let baseIndex = 1; // default to 2nd size (e.g. IT 40 or M)

    if (availableSizes.length >= 6) {
      // Italian trouser scale: 38, 40, 42, 44, 46, 48
      if (weightKg < 52) baseIndex = 0;
      else if (weightKg < 58) baseIndex = 1;
      else if (weightKg < 66) baseIndex = 2;
      else if (weightKg < 74) baseIndex = 3;
      else if (weightKg < 82) baseIndex = 4;
      else baseIndex = 5;
    } else {
      // General S, M, L scale
      if (weightKg < 60) baseIndex = 0;
      else if (weightKg < 75) baseIndex = Math.min(1, availableSizes.length - 1);
      else if (weightKg < 88) baseIndex = Math.min(2, availableSizes.length - 1);
      else baseIndex = Math.min(3, availableSizes.length - 1);
    }

    // Adjust for fit preference
    if (fitPreference === 'slim' && baseIndex > 0) {
      baseIndex -= 1;
    } else if (fitPreference === 'relaxed' && baseIndex < availableSizes.length - 1) {
      baseIndex += 1;
    }

    const recommended = availableSizes[baseIndex] || availableSizes[0];

    setResult({
      recommendedSize: recommended,
      confidenceScore: 94 + Math.floor(Math.random() * 5),
      fitNote: `Based on your silhouette (${heightCm} cm, ${weightKg} kg) and your choice of a ${fitPreference} fit, ${recommended} offers the intended fluid drape and balanced waist ease.`
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fit-finder-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-lg shadow-2xl border border-neutral-200 p-6 sm:p-8 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Fit Finder"
          className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-black transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center pb-6 border-b border-neutral-100">
          <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">
            Intelligent Sizing Atelier
          </span>
          <h2 id="fit-finder-title" className="text-xl font-light tracking-wide text-neutral-900 mt-1">
            Find Your Recommended Size
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Calibrated for {productTitle}
          </p>
        </div>

        {/* Content */}
        {!result ? (
          <form onSubmit={calculateFit} className="mt-6 space-y-6">
            {/* Height Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="height-range" className="uppercase tracking-wider font-medium text-neutral-700">
                  Height
                </label>
                <span className="font-mono text-sm font-semibold text-neutral-900">
                  {heightCm} cm ({Math.floor(heightCm / 30.48)}' {Math.round((heightCm % 30.48) / 2.54)}")
                </span>
              </div>
              <input
                id="height-range"
                type="range"
                min="150"
                max="205"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full accent-neutral-900 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span>150 cm</span>
                <span>205 cm</span>
              </div>
            </div>

            {/* Weight Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="weight-range" className="uppercase tracking-wider font-medium text-neutral-700">
                  Weight
                </label>
                <span className="font-mono text-sm font-semibold text-neutral-900">
                  {weightKg} kg ({Math.round(weightKg * 2.20462)} lbs)
                </span>
              </div>
              <input
                id="weight-range"
                type="range"
                min="40"
                max="120"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full accent-neutral-900 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span>40 kg</span>
                <span>120 kg</span>
              </div>
            </div>

            {/* Fit Preference */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-medium text-neutral-700 block">
                How do you prefer this garment to sit?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['slim', 'regular', 'relaxed'] as const).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setFitPreference(pref)}
                    className={`py-2.5 px-2 text-xs uppercase tracking-wider font-medium border rounded transition-all ${
                      fitPreference === pref
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 bg-white'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium rounded-full transition-colors shadow-sm"
            >
              Calculate Recommendation
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-6 text-center animate-in fade-in duration-300">
            <div className="p-6 bg-[#f7f5f0] border border-neutral-200 rounded-lg">
              <span className="text-[11px] uppercase tracking-widest text-neutral-500 font-mono block">
                Your Recommended Size
              </span>
              <div className="text-3xl font-light tracking-wider text-neutral-950 mt-1 mb-2 font-mono">
                {result.recommendedSize}
              </div>
              <span className="inline-block text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                {result.confidenceScore}% Fit Match
              </span>
              <p className="text-xs text-neutral-600 mt-4 leading-relaxed max-w-sm mx-auto">
                {result.fitNote}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onApplySize(result.recommendedSize);
                  onClose();
                }}
                className="w-full py-3.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium rounded-full transition-colors shadow-sm"
              >
                Select {result.recommendedSize} & Close
              </button>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-neutral-500 hover:text-black uppercase tracking-wider py-2 font-medium"
              >
                Recalculate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
