import React, { useState } from 'react';

interface ProductSizeSelectorProps {
  sizes: string[];
  selectedSize: string | null;
  onSelectSize: (size: string) => void;
  hasError?: boolean;
}

export const ProductSizeSelector: React.FC<ProductSizeSelectorProps> = ({
  sizes,
  selectedSize,
  onSelectSize,
  hasError = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sizes || sizes.length === 0) return null;

  const handleSizeClick = (size: string) => {
    onSelectSize(size);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Primary Pill Button matching reference screenshot */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full h-12 px-6 rounded-full border text-xs uppercase tracking-widest font-medium relative flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white ${
          hasError && !selectedSize
            ? 'border-red-500 text-red-600'
            : selectedSize
            ? 'border-neutral-900 text-neutral-900'
            : 'border-neutral-800 text-neutral-800 hover:border-black'
        }`}
      >
        <span>
          {selectedSize ? `SIZE: ${selectedSize}` : 'SELECT SIZE'}
        </span>
      </button>

      {/* Error Message if Add To Bag was clicked without choosing size */}
      {hasError && !selectedSize && (
        <p className="text-[11px] text-red-500 text-center tracking-wide font-medium">
          Please select a size to proceed
        </p>
      )}

      {/* Expandable Size Grid */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available Sizes"
          className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 animate-in fade-in duration-200"
        >
          {sizes.map((size) => {
            const isSelected = selectedSize === size;
            return (
              <button
                key={size}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSizeClick(size)}
                className={`h-11 rounded-full text-xs font-mono uppercase tracking-wider transition-all border ${
                  isSelected
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-[#faf8f5] text-neutral-800 border-neutral-200 hover:border-neutral-900 hover:bg-white'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

