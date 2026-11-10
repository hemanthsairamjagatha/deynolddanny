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
      className="w-full flex flex-col gap-[17px] ProductColorSelection__product-color-selection"
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
              className="relative focus:outline-none group"
            >
              {swatchImage ? (
                <picture
                  className={`ProductColorSelection__product-color-selection__image block overflow-hidden transition-colors ${
                    isSelected
                      ? 'border-b-[4px] border-neutral-900'
                      : 'border-b-[4px] border-transparent hover:border-neutral-300'
                  }`}
                  style={{ width: '40px', height: '59px' }}
                >
                  <img
                    src={swatchImage}
                    alt={color.name}
                    className="object-cover object-top block"
                    style={{ width: '40px', height: '55px' }}
                  />
                </picture>
              ) : (
                <div
                  className={`block overflow-hidden transition-colors ${
                    isSelected
                      ? 'border-b-[4px] border-neutral-900'
                      : 'border-b-[4px] border-transparent hover:border-neutral-300'
                  }`}
                  style={{ width: '40px', height: '59px' }}
                >
                  <div
                    className="border border-neutral-200"
                    style={{ width: '40px', height: '55px', backgroundColor: color.hex }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

