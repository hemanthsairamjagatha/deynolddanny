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
    <div className="w-full">
      {/* Primary Pill Button matching reference screenshot */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full rounded-full border text-neutral-900 relative flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-900 Button__btn ProductDetailDescription__product-detail-description__size-selection-button ${
          hasError && !selectedSize
            ? 'border-red-500 text-red-600'
            : selectedSize
            ? 'border-neutral-900'
            : 'border-neutral-800 hover:border-black'
        }`}
        style={{
          width: '352.93px',
          maxWidth: '100%',
          height: '45.6px',
          padding: '13px 20px 9px',
          backgroundColor: '#FFFFFF'
        }}
      >
        <span className="Button__btn__content btn__content text-[14px] leading-[22px] font-semibold tracking-wider uppercase flex items-center justify-center w-full">
          {selectedSize ? `SIZE: ${selectedSize}` : 'SELECT SIZE'}
        </span>
      </button>

      {/* Error Message if Add To Bag was clicked without choosing size */}
      {hasError && !selectedSize && (
        <p className="text-[11px] text-red-500 text-center tracking-wide font-medium mt-1.5">
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

