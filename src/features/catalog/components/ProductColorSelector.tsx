import React from 'react';
import type { ProductColor } from '../types/product.types';

interface ProductColorSelectorProps {
  colors: ProductColor[];
  selectedIndex: number;
  onSelectColor: (index: number) => void;
}

export const ProductColorSelector: React.FC<ProductColorSelectorProps> = ({
  colors,
  selectedIndex,
  onSelectColor
}) => {
  if (!colors || colors.length === 0) return null;

  const currentColor = colors[selectedIndex] || colors[0];

  return (
    <div
      className="w-full flex flex-col gap-3 ProductColorSelection__product-color-selection"
      style={{ padding: '16px 0px' }}
    >
      {/* Color Name Label */}
      <div className="text-[13px] leading-5 tracking-wide text-neutral-800">
        <span>Color: </span>
        <span className="font-semibold text-neutral-950">{currentColor.name}</span>
      </div>

      {/* Swatch List */}
      <div className="flex items-center gap-3" role="radiogroup" aria-label="Product color choices">
        {colors.map((color, idx) => {
          const isSelected = selectedIndex === idx;
          const swatchImage = color.swatchImg || color.img;

          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select color ${color.name}`}
              onClick={() => onSelectColor(idx)}
              className={`relative group focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all ${
                isSelected ? 'ring-1 ring-neutral-900' : 'ring-1 ring-transparent hover:ring-neutral-300'
              }`}
            >
              {swatchImage ? (
                <div className="w-12 h-16 bg-[#f5f3ee] overflow-hidden flex items-center justify-center border border-neutral-200">
                  <img
                    src={swatchImage}
                    alt={color.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              ) : (
                <div
                  className="w-10 h-10 rounded-full border border-neutral-300 shadow-inner flex items-center justify-center"
                  style={{ backgroundColor: color.hex }}
                />
              )}

              {/* Bottom selection indicator matching screenshot */}
              {isSelected && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-neutral-900" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

