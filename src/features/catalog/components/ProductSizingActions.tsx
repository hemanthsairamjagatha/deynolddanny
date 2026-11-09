import React from 'react';

interface ProductSizingActionsProps {
  tag?: string;
  onOpenFitFinder: () => void;
  onOpenSizeGuide: () => void;
}

export const ProductSizingActions: React.FC<ProductSizingActionsProps> = ({
  tag,
  onOpenFitFinder,
  onOpenSizeGuide
}) => {
  return (
    <div className="flex items-center justify-between gap-4 pt-1 pb-2">
      {/* Optional Collection Tag (e.g. JOGGING, NEW IN, CASHMERE) */}
      <div>
        {tag ? (
          <span className="inline-block text-[11px] uppercase tracking-widest font-mono px-2 py-0.5 bg-[#f6f4ee] border border-neutral-200/80 text-neutral-700">
            {tag}
          </span>
        ) : <span />}
      </div>

      {/* Sizing Utilities */}
      <div className="flex items-center gap-5 text-[11px] uppercase tracking-wider font-medium text-neutral-800">
        {/* Find Your Size with Tape Measure Icon */}
        <button
          type="button"
          onClick={onOpenFitFinder}
          className="group inline-flex items-center gap-1.5 hover:text-black transition-colors focus:outline-none"
        >
          {/* Tape Measure SVG */}
          <svg
            className="w-4 h-4 text-neutral-700 group-hover:text-black transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.4"
              d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" d="M9 7h3m-3 4h5m-5 4h3" />
          </svg>
          <span className="border-b border-neutral-800 group-hover:border-black pb-[1px]">
            FIND YOUR SIZE
          </span>
        </button>

        {/* Size Guide Link */}
        <button
          type="button"
          onClick={onOpenSizeGuide}
          className="group hover:text-black transition-colors focus:outline-none"
        >
          <span className="border-b border-neutral-800 group-hover:border-black pb-[1px]">
            SIZE GUIDE
          </span>
        </button>
      </div>
    </div>
  );
};

