import React from 'react';

interface ProductSizingActionsProps {
  tag?: string;
  onOpenFitFinder: () => void;
  onOpenSizeGuide: () => void;
}

export const ProductSizingActions: React.FC<ProductSizingActionsProps> = ({
  tag: _tag,
  onOpenFitFinder,
  onOpenSizeGuide
}) => {
  return (
    <div className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider font-medium text-neutral-800 pt-1 pb-1">
      {/* Find Your Size with Tape Measure Icon */}
      <button
        type="button"
        onClick={onOpenFitFinder}
        className="group inline-flex items-center gap-1.5 hover:text-black transition-colors focus:outline-none"
      >
        {/* Coiled Tape Measure SVG matching reference */}
        <svg
          className="w-4 h-4 text-neutral-800 group-hover:text-black transition-colors flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        >
          <ellipse cx="9" cy="13" rx="6" ry="4.5" />
          <ellipse cx="9" cy="13" rx="3.5" ry="2.5" />
          <path d="M9 17.5h10a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-4" strokeLinecap="round" />
          <path d="M12 14.5v3M15 14.5v3M18 14.5v2" strokeLinecap="round" />
        </svg>
        <span className="border-b border-neutral-900 group-hover:border-black pb-[1px]">
          FIND YOUR SIZE
        </span>
      </button>

      {/* Size Guide Link */}
      <button
        type="button"
        onClick={onOpenSizeGuide}
        className="group hover:text-black transition-colors focus:outline-none"
      >
        <span className="border-b border-neutral-900 group-hover:border-black pb-[1px]">
          SIZE GUIDE
        </span>
      </button>
    </div>
  );
};

