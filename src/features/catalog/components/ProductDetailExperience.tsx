import React, { useState, useRef } from 'react';
import type { ProductCardData } from '../types/product.types';
import { ProductLightbox } from './ProductLightbox';
import { FitFinderDialog } from '../fit-finder/FitFinderDialog';
import { SizeGuideDialog } from '../size-guide/SizeGuideDialog';
import { addToCart, openCart } from '../../cart/store/cart.store';

interface ProductDetailExperienceProps {
  product: ProductCardData;
}

export const ProductDetailExperience: React.FC<ProductDetailExperienceProps> = ({ product }) => {
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [isFitFinderOpen, setIsFitFinderOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  // Compute active images based on color or product default images
  const colors = product.colors && product.colors.length > 0
    ? product.colors
    : [
        { name: 'Bordeaux', hex: '#6b2144' },
        { name: 'Dark Slate', hex: '#2b363d' },
        { name: 'Coral Red', hex: '#f43f4f' },
        { name: 'Espresso', hex: '#3a282b' }
      ];

  const currentColor = colors[selectedColorIndex] || colors[0];
  const galleryImages = (currentColor?.images && currentColor.images.length > 0)
    ? currentColor.images
    : (product.images && product.images.length > 0)
    ? product.images
    : [product.defaultImg, product.hoverImg].filter(Boolean);

  const isSoldOut = product.badge === 'SOLD OUT' || (product.sizes && product.sizes.length === 0);

  const handleOpenLightbox = (index: number) => {
    setLightboxInitialIndex(index);
    setIsLightboxOpen(true);
  };

  const handleScrollGallery = (direction: 'left' | 'right') => {
    if (!galleryScrollRef.current) return;
    const scrollAmount = 506;
    galleryScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const handleShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: product.title,
          url: window.location.href
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // User cancelled share
    }
  };

  const handleAddToBag = () => {
    if (!selectedSize && product.sizes && product.sizes.length > 0) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    setIsAdding(true);

    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      priceNum: product.priceNum,
      img: currentColor.swatchImg || currentColor.img || product.defaultImg,
      size: selectedSize || 'UNI'
    });

    setTimeout(() => {
      setIsAdding(false);
      openCart();
    }, 450);
  };

  return (
    <div className="relative w-full bg-white text-neutral-900">
      {/* ============================================================ */}
      {/* 1. Rinascimento Horizontal Gallery (505.66 x 674.21 per image) */}
      {/* ============================================================ */}
      <div className="relative w-full overflow-hidden bg-[#faf8f5]">
        {/* Top-Right Slideshow Controls matching reference */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
            className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-neutral-800 flex items-center justify-center shadow-md backdrop-blur-sm transition-all focus:outline-none"
          >
            {isPaused ? (
              <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </button>
        </div>

        {/* Gallery Navigation Arrows for Wide Desktops */}
        <button
          type="button"
          onClick={() => handleScrollGallery('left')}
          aria-label="Scroll gallery left"
          className="hidden xl:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-neutral-800 items-center justify-center shadow-md backdrop-blur-sm transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => handleScrollGallery('right')}
          aria-label="Scroll gallery right"
          className="hidden xl:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-neutral-800 items-center justify-center shadow-md backdrop-blur-sm transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Horizontal Image Track: 505.66 x 674.21 per image */}
        <div
          ref={galleryScrollRef}
          className="w-full flex flex-row overflow-x-auto scrollbar-none snap-x snap-mandatory min-h-[520px] lg:min-h-[675px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {galleryImages.map((img, idx) => (
            <div
              key={idx}
              onClick={() => handleOpenLightbox(idx)}
              className="flex-shrink-0 snap-start relative overflow-hidden bg-[#faf8f5] border-r border-neutral-100 last:border-r-0 cursor-zoom-in group"
              style={{
                width: '505.66px',
                maxWidth: '85vw',
                height: '674.21px'
              }}
            >
              <img
                src={img}
                alt={`${product.title} - view ${idx + 1}`}
                className="object-fit-contain w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                style={{ width: '505.66px', height: '674.21px' }}
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* 2. Floating Product Info Card matching exact 526 x 354.1 Box  */}
        {/* ============================================================ */}
        <div
          className="product-info-wrapper bg-body p-2 p-xl-4 w-full max-w-[526px] bg-white rounded-[8px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-neutral-200/70 z-20 mx-auto my-6 lg:mx-0 lg:my-0 lg:absolute lg:bottom-6 lg:right-8 transition-all"
          style={{
            width: '526px',
            maxWidth: 'calc(100vw - 32px)',
            padding: '20px',
            backgroundColor: '#FFFFFF'
          }}
        >
          {/* Row 1: Breadcrumbs & Status / Price Badge */}
          <div
            className="flex items-start justify-between gap-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium"
            style={{ width: '486px', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-1.5 flex-wrap leading-tight">
              <a href="/" className="hover:text-black transition-colors">HOME</a>
              <span>&gt;</span>
              <a href="/categories" className="hover:text-black transition-colors">
                {product.category ? product.category.toUpperCase() : 'CLOTHING'}
              </a>
              <span>&gt;</span>
              <span>DRESSES AND OUTFITS</span>
              <span>&gt;</span>
              <span>{product.subCategory ? product.subCategory.toUpperCase() : 'SHORT DRESSES'}</span>
              <span>&gt;</span>
              <span className="text-neutral-800 font-semibold truncate max-w-[180px]">
                {product.title.toUpperCase()}
              </span>
            </div>

            {/* Status / Sold Out Badge */}
            {isSoldOut ? (
              <span className="bg-[#e5e5e5] text-neutral-700 text-[10px] font-semibold px-2.5 py-0.5 uppercase tracking-wider rounded-[2px] flex-shrink-0">
                SOLD OUT
              </span>
            ) : (
              <span className="text-black font-semibold text-[13px] flex-shrink-0">
                {product.price}
              </span>
            )}
          </div>

          {/* Row 2: Product Title (364.39 x 46.4, 16px) & Boxed "MADE IN INDIA" Badge (101.15 x 22.24, 11px) */}
          <div
            className="flex items-start justify-between gap-4 mt-2.5"
            style={{ width: '486px', maxWidth: '100%' }}
          >
            <h1
              className="m-0 p-0 text-[16px] leading-[23.2px] text-black uppercase font-medium tracking-normal"
              style={{ width: '364.39px', maxWidth: 'calc(100% - 110px)' }}
            >
              <span style={{ display: 'inline-block', width: '100%' }}>
                {product.title}
              </span>
            </h1>

            {/* Boxed MADE IN INDIA Badge matching reference with thin border & exact 101.15 x 22.24 box */}
            <div
              className="p-1 uppercase text-black font-medium tracking-wider flex items-center justify-center whitespace-nowrap flex-shrink-0"
              style={{
                width: '101.15px',
                height: '22.24px',
                fontSize: '11px',
                padding: '4px',
                margin: '-3px 0px 0px -3px',
                border: '1px solid #000000',
                color: '#000000'
              }}
            >
              MADE IN INDIA
            </div>
          </div>

          {/* Row 3: SKU (381.16 x 10.5, 10px, mt-1 = 4px margin) */}
          <div
            className="product-sku mt-1 uppercase tracking-wider font-mono"
            style={{
              width: '381.16px',
              maxWidth: '100%',
              minHeight: '10.5px',
              fontSize: '10px',
              color: '#000000',
              margin: '4px 0px 0px'
            }}
          >
            SKU {product.sku || 'CFC0130327003B098'}
          </div>

          {/* Row 4: Color Label (110.59 x 19.2, 14px, leading 19.2px) */}
          <div className="mt-3.5" style={{ width: '486px', maxWidth: '100%' }}>
            <span
              className="text-black"
              style={{
                display: 'inline-block',
                minWidth: '110.59px',
                height: '19.2px',
                fontSize: '14px',
                lineHeight: '19.2px',
                color: '#000000'
              }}
            >
              Color <strong className="font-bold">{currentColor.name}</strong>
            </span>
          </div>

          {/* Row 5: Square Color Swatches (div.color-group.mt-2: 486 x 45.8, each swatch 40 x 40 with 17px right margin) */}
          <div
            className="color-group mt-2 flex items-center"
            role="radiogroup"
            aria-label="Available colors"
            style={{
              width: '486px',
              maxWidth: '100%',
              minHeight: '45.8px',
              fontSize: '14px',
              color: '#000000',
              margin: '10px 0px 0px'
            }}
          >
            {colors.map((c, idx) => {
              const isSelected = selectedColorIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select color ${c.name}`}
                  onClick={() => setSelectedColorIndex(idx)}
                  className={`variant-color d-inline-block rounded-[2px] transition-all focus:outline-none flex-shrink-0 ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-black border border-black'
                      : 'border border-neutral-300 hover:border-black'
                  }`}
                  style={{
                    width: '40px',
                    height: '40px',
                    marginRight: idx === colors.length - 1 ? '0px' : '17px',
                    backgroundColor: c.hex
                  }}
                />
              );
            })}
          </div>

          {/* Row 6: Interactive Size Selection & Add to Bag (When in stock) */}
          {!isSoldOut && product.sizes && product.sizes.length > 0 && (
            <div className="mt-4 space-y-2.5" style={{ width: '486px', maxWidth: '100%' }}>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
                <span className="font-medium text-neutral-700">Size: {selectedSize || 'Select'}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFitFinderOpen(true)}
                    className="text-neutral-500 hover:text-black underline transition-colors"
                  >
                    Find your size
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSizeGuideOpen(true)}
                    className="text-neutral-500 hover:text-black underline transition-colors"
                  >
                    Size guide
                  </button>
                </div>
              </div>

              {/* Size Pill Choices */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {product.sizes.map((s) => {
                  const isChosen = selectedSize === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSelectedSize(s);
                        setSizeError(false);
                      }}
                      className={`h-8 px-3 rounded-[3px] text-xs font-medium border transition-all ${
                        isChosen
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'border-neutral-300 text-neutral-800 hover:border-black'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {sizeError && (
                <p className="text-[11px] text-red-500">Please choose a size</p>
              )}

              {/* Add To Bag Primary CTA matching exact 45.6px height and #424242 background */}
              <div
                className="bg-white ProductDetailDescription__product-detail-description__cart-block mt-3"
                style={{
                  margin: '0px -16px',
                  padding: '16px',
                  width: 'calc(100% + 32px)',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <button
                  type="button"
                  onClick={handleAddToBag}
                  disabled={isAdding}
                  className="w-full rounded-full text-white transition-colors duration-200 flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-neutral-900 hover:bg-black"
                  style={{
                    padding: '13px 24px 9px 24px',
                    height: '45.6px',
                    backgroundColor: '#424242'
                  }}
                >
                  {isAdding ? (
                    <span className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-wider uppercase text-white leading-[22px]">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>ADDING...</span>
                    </span>
                  ) : (
                    <span className="Button__btn__content btn__content text-[14px] font-semibold tracking-wider uppercase text-white leading-[22px]">
                      ADD TO BAG
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Row 7: Divider (div.w100.border-bottom.mt-5.mb-5.bordermb-none: 486 x 0.8, margin: 24px 0px) */}
          <div
            className="w100 border-bottom mt-5 mb-5 bordermb-none border-b border-neutral-200"
            style={{
              width: '486px',
              maxWidth: '100%',
              height: '0.8px',
              margin: '24px 0px'
            }}
          />

          {/* Row 8: Share Section (div.product-info-wishlist.d-flex.flex-column: 486 x 56, padding: 16px 0px, 14px) */}
          <div
            className="product-info-wishlist d-flex flex-column flex items-center justify-between"
            style={{
              width: '486px',
              maxWidth: '100%',
              height: '56px',
              padding: '16px 0px',
              fontSize: '14px',
              color: '#000000'
            }}
          >
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2.5 text-[14px] text-black hover:opacity-80 transition-opacity focus:outline-none"
            >
              <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 15V3m0 0l-4 4m4-4l4 4" />
              </svg>
              <span>{copied ? 'Link copied to clipboard!' : 'Share this product'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. Luxury Editorial Description & Specifications Section     */}
      {/* ============================================================ */}
      <div className="max-w-[1200px] mx-auto px-6 py-14 border-t border-neutral-200/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Description */}
          <div className="space-y-3">
            <h2 className="text-[12px] uppercase tracking-widest font-bold text-neutral-900">
              Description & Craftsmanship
            </h2>
            <p className="text-[13px] leading-relaxed text-neutral-600">
              {product.description ||
                'Feminine sheath dress crafted in stretch cady with asymmetrical side draping that contours the silhouette with timeless grace. Round neckline, three-quarter sleeves, and invisible rear zip fastening. Made in India through sustainable artisanal processes.'}
            </p>
          </div>

          {/* Size & Fit */}
          <div className="space-y-3">
            <h2 className="text-[12px] uppercase tracking-widest font-bold text-neutral-900">
              Size & Fit
            </h2>
            <ul className="text-[13px] leading-relaxed text-neutral-600 space-y-1.5">
              {(product.sizeAndFit || [
                "Model is 177 cm / 5'9.5\" and is wearing size 40.",
                'Form-fitting sheath silhouette with asymmetrical pleated gathering.',
                'Knee length hemline with center-back walking vent.'
              ]).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-neutral-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Composition & Care */}
          <div className="space-y-3">
            <h2 className="text-[12px] uppercase tracking-widest font-bold text-neutral-900">
              Composition & Care
            </h2>
            <ul className="text-[13px] leading-relaxed text-neutral-600 space-y-1.5">
              {(product.compositionAndCare || [
                'Composition: 96% Polyester, 4% Elastane.',
                'Lining: 100% Stretch cupro.',
                'Care: Dry clean only. Iron at low temperature.',
                'Carefully crafted in India.'
              ]).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-neutral-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <ProductLightbox
        isOpen={isLightboxOpen}
        images={galleryImages}
        initialIndex={lightboxInitialIndex}
        onClose={() => setIsLightboxOpen(false)}
        title={product.title}
      />

      {/* Fit Finder Dialog */}
      <FitFinderDialog
        isOpen={isFitFinderOpen}
        onClose={() => setIsFitFinderOpen(false)}
        availableSizes={product.sizes}
        productTitle={product.title}
        onApplySize={(size) => {
          setSelectedSize(size);
        }}
      />

      {/* Size Guide Dialog */}
      <SizeGuideDialog
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        productTitle={product.title}
      />
    </div>
  );
};

