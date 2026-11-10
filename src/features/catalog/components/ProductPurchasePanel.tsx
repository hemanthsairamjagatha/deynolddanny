import React, { useState } from 'react';
import type { ProductCardData } from '../types/product.types';
import { ProductColorSelector } from './ProductColorSelector';
import { ProductSizingActions } from './ProductSizingActions';
import { ProductSizeSelector } from './ProductSizeSelector';
import { addToCart, openCart } from '../../cart/store/cart.store';
import { $wishlistItems, toggleWishlist } from '../../wishlist/store/wishlist.store';
import { useStore } from '@nanostores/react';

interface ProductPurchasePanelProps {
  product: ProductCardData;
  selectedColorIndex: number;
  onSelectColor: (index: number) => void;
  selectedSize: string | null;
  onSelectSize: (size: string) => void;
  onOpenFitFinder: () => void;
  onOpenSizeGuide: () => void;
}

export const ProductPurchasePanel: React.FC<ProductPurchasePanelProps> = ({
  product,
  selectedColorIndex,
  onSelectColor,
  selectedSize,
  onSelectSize,
  onOpenFitFinder,
  onOpenSizeGuide
}) => {
  const [sizeError, setSizeError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  // Wishlist store subscription
  const wishlist = useStore($wishlistItems);
  const isWishlisted = wishlist.some((item) => item.id === product.id);

  const colors = product.colors && product.colors.length > 0
    ? product.colors
    : [
        {
          name: 'Butter',
          hex: '#F9F5EC',
          swatchImg: product.defaultImg
        }
      ];

  const handleToggleWishlist = () => {
    toggleWishlist({
      id: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      priceNum: product.priceNum,
      image: product.defaultImg
    });
  };

  const handleSelectSize = (size: string) => {
    onSelectSize(size);
    setSizeError(false);
  };

  const handleAddToBag = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    setIsAdding(true);
    const activeColor = colors[selectedColorIndex];
    const imageToAdd = activeColor?.swatchImg || product.defaultImg;

    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      priceNum: product.priceNum,
      size: selectedSize,
      img: imageToAdd
    });

    setTimeout(() => {
      setIsAdding(false);
      openCart();
    }, 150);
  };

  const toggleAccordionSection = (section: string) => {
    setOpenAccordion((prev) => (prev === section ? null : section));
  };

  // Formatted price string
  const displayPrice = product.price.includes('€') || product.price.includes('₹')
    ? product.price
    : `€ ${product.priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="w-full max-w-[400px] text-neutral-900">
      {/* Upper purchase box matching ProductDetailDescription with exact 40px 20px 24px 24px padding */}
      <div
        className="w-full flex flex-col space-y-6 pt-[40px] pr-[20px] pb-[24px] pl-[24px]"
        style={{ padding: '40px 20px 24px 24px' }}
      >
        {/* Title & Wishlist Row */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-neutral-900 leading-tight">
            {product.title}
          </h1>

          <button
            type="button"
            onClick={handleToggleWishlist}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="p-1.5 text-neutral-800 hover:text-black transition-colors focus:outline-none flex-shrink-0"
          >
            {isWishlisted ? (
              <svg className="w-5 h-5 fill-rose-600 text-rose-600" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="1.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>
        </div>

        {/* Price with VAT inc. */}
        <div className="flex items-baseline gap-2 text-sm tracking-wide text-neutral-900 -mt-3">
          <span className="font-normal">{displayPrice}</span>
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
            VAT Inc.
          </span>
        </div>

        {/* Color Selection */}
        <ProductColorSelector
          colors={colors}
          selectedIndex={selectedColorIndex}
          onSelectColor={onSelectColor}
        />

        {/* Sizing Utilities */}
        <ProductSizingActions
          tag={product.tag}
          onOpenFitFinder={onOpenFitFinder}
          onOpenSizeGuide={onOpenSizeGuide}
        />

        {/* Sizing Dropdown / Pill selector */}
        <ProductSizeSelector
          sizes={product.sizes}
          selectedSize={selectedSize}
          onSelectSize={handleSelectSize}
          hasError={sizeError}
        />

        {/* Add To Bag Primary CTA */}
        <button
          type="button"
          onClick={handleAddToBag}
          disabled={isAdding}
          className="w-full h-12 rounded-full bg-[#2c2c2c] hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all duration-200 shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
        >
          {isAdding ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              ADDING...
            </span>
          ) : (
            'ADD TO BAG'
          )}
        </button>
      </div>

      {/* Lower section: Editorial Description, SKU & Accordions */}
      <div
        className="space-y-6 pt-0 pr-[20px] pb-[40px] pl-[24px]"
        style={{ padding: '0 20px 40px 24px' }}
      >
        {/* Editorial Description & SKU block */}
        <div className="text-xs leading-relaxed text-neutral-700 space-y-3">
          <p>
            {product.description ||
              'Wide leg trousers in cady with an elasticated waist for refined comfort. Filo diamante adds a luminous and discreet accent, enhancing the design with natural sophistication. Made in Italy through sustainable processes.'}
          </p>

          {product.sku && (
            <p className="font-mono text-[11px] text-neutral-500 uppercase tracking-wider">
              {product.sku}
            </p>
          )}
        </div>

        {/* Accordion Drawers matching reference screenshot */}
        <div className="border-t border-neutral-200/80 divide-y divide-neutral-200/80 pt-2">
          {/* Size & Fit */}
          <div>
            <button
              type="button"
              onClick={() => toggleAccordionSection('sizeAndFit')}
              aria-expanded={openAccordion === 'sizeAndFit'}
              className="w-full py-4 flex items-center justify-between text-left text-xs uppercase tracking-wider font-normal text-neutral-900 hover:text-black transition-colors"
            >
              <span>Size & fit</span>
              <span className="text-sm font-light text-neutral-500">
                {openAccordion === 'sizeAndFit' ? '−' : '+'}
              </span>
            </button>
            {openAccordion === 'sizeAndFit' && (
              <div className="pb-4 text-xs text-neutral-600 leading-relaxed space-y-1.5 animate-in fade-in duration-150">
                {product.sizeAndFit && product.sizeAndFit.length > 0 ? (
                  product.sizeAndFit.map((item, idx) => (
                    <p key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-400">•</span>
                      <span>{item}</span>
                    </p>
                  ))
                ) : (
                  <p>Standard tailored fit. Fits true to size.</p>
                )}
              </div>
            )}
          </div>

          {/* Composition & Care */}
          <div>
            <button
              type="button"
              onClick={() => toggleAccordionSection('compositionAndCare')}
              aria-expanded={openAccordion === 'compositionAndCare'}
              className="w-full py-4 flex items-center justify-between text-left text-xs uppercase tracking-wider font-normal text-neutral-900 hover:text-black transition-colors"
            >
              <span>Composition & care</span>
              <span className="text-sm font-light text-neutral-500">
                {openAccordion === 'compositionAndCare' ? '−' : '+'}
              </span>
            </button>
            {openAccordion === 'compositionAndCare' && (
              <div className="pb-4 text-xs text-neutral-600 leading-relaxed space-y-1.5 animate-in fade-in duration-150">
                {product.compositionAndCare && product.compositionAndCare.length > 0 ? (
                  product.compositionAndCare.map((item, idx) => (
                    <p key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-400">•</span>
                      <span>{item}</span>
                    </p>
                  ))
                ) : (
                  <p>Carefully crafted in Italy from premium natural fibers. Dry clean only.</p>
                )}
              </div>
            )}
          </div>

          {/* Delivery & Returns */}
          <div>
            <button
              type="button"
              onClick={() => toggleAccordionSection('shippingAndReturns')}
              aria-expanded={openAccordion === 'shippingAndReturns'}
              className="w-full py-4 flex items-center justify-between text-left text-xs uppercase tracking-wider font-normal text-neutral-900 hover:text-black transition-colors"
            >
              <span>Delivery & returns</span>
              <span className="text-sm font-light text-neutral-500">
                {openAccordion === 'shippingAndReturns' ? '−' : '+'}
              </span>
            </button>
            {openAccordion === 'shippingAndReturns' && (
              <div className="pb-4 text-xs text-neutral-600 leading-relaxed space-y-1.5 animate-in fade-in duration-150">
                {product.shippingAndReturns && product.shippingAndReturns.length > 0 ? (
                  product.shippingAndReturns.map((item, idx) => (
                    <p key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-400">•</span>
                      <span>{item}</span>
                    </p>
                  ))
                ) : (
                  <p>Complimentary express worldwide shipping. Complimentary 14-day returns.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
