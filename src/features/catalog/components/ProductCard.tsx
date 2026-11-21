import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import type { ProductCardData } from '../types/product.types';
import { addToCart, openCart } from '../../cart/store/cart.store';
import { WishlistButton } from '../../wishlist/components/WishlistButton';
import { $fxSnapshot, $selectedCountry, formatInrAmount, getActiveMarket } from '../../../lib/currency/currency.store';

interface ProductCardProps {
  product: ProductCardData;
  isModelView?: boolean;
  preferredColorName?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isModelView = true,
  preferredColorName,
}) => {
  const selectedCountry = useStore($selectedCountry);
  const fx = useStore($fxSnapshot);
  const activeMarket = getActiveMarket(selectedCountry, fx);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isSizePickerOpen, setIsSizePickerOpen] = useState<boolean>(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);

  const colors = product.colors && product.colors.length > 0
    ? product.colors
    : [
        { name: 'Charcoal', hex: '#36454F' },
        { name: 'Camel', hex: '#C19A6B' }
      ];

  useEffect(() => {
    if (!preferredColorName || preferredColorName === 'all') return;
    const matchIdx = colors.findIndex(
      (c) => c.name.toLowerCase() === preferredColorName.toLowerCase(),
    );
    if (matchIdx >= 0) {
      setSelectedColorIndex(matchIdx);
    }
  }, [preferredColorName, product.id]);

  const safeColorIdx = selectedColorIndex < colors.length ? selectedColorIndex : 0;
  const activeColor = colors[safeColorIdx] || colors[0];
  const productHref = product.link || (product.slug ? `/products/${product.slug}` : `/products/${product.id}`);

  // Variants matching active colour
  const colorVariants = (product.variants || []).filter(
    (v) => !activeColor?.name || v.colorName?.toLowerCase() === activeColor.name.toLowerCase(),
  );

  const findSizeVariant = (sizeLabel: string) =>
    colorVariants.find((v) => v.size.toLowerCase() === sizeLabel.toLowerCase()) ||
    product.variants?.find((v) => v.size.toLowerCase() === sizeLabel.toLowerCase());

  const activeSizeVariant = selectedSize ? findSizeVariant(selectedSize) : undefined;

  // Dynamic Price shift: Selected Size+Colour variant -> Selected Colour price -> Base product price
  const colorMinPriceNum =
    activeColor?.priceNum ??
    (colorVariants.length > 0
      ? Math.min(
          ...colorVariants.map((v) =>
            typeof v.priceNum === 'number'
              ? v.priceNum
              : typeof v.pricePaise === 'number'
                ? v.pricePaise / 100
                : product.priceNum,
          ),
        )
      : product.priceNum);

  const effectivePriceNum =
    activeSizeVariant?.priceNum ??
    (typeof activeSizeVariant?.pricePaise === 'number' ? activeSizeVariant.pricePaise / 100 : undefined) ??
    colorMinPriceNum ??
    product.priceNum;

  const effectivePriceDisplay =
    activeSizeVariant?.price ||
    activeColor?.price ||
    `₹ ${effectivePriceNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Dynamic Image shift for the selected colour swatch
  const colorPrimaryImg =
    activeColor?.img ||
    activeColor?.images?.[0] ||
    (safeColorIdx > 0 && product.images && product.images[safeColorIdx % product.images.length]) ||
    product.defaultImg;
  const colorSecondaryImg =
    activeColor?.hoverImg ||
    activeColor?.images?.[1] ||
    (safeColorIdx > 0 ? product.defaultImg : product.hoverImg) ||
    colorPrimaryImg;

  const displayedPrimaryImg = isModelView ? colorPrimaryImg : colorSecondaryImg;
  const displayedHoverImg = isModelView ? colorSecondaryImg : colorPrimaryImg;

  // Close size picker on outside click (clicking anywhere outside the sizes strip)
  useEffect(() => {
    if (!isSizePickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (sizesRef.current && !sizesRef.current.contains(e.target as Node)) {
        setIsSizePickerOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isSizePickerOpen]);

  const handleToggleSizePicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSizePickerOpen(prev => !prev);
  };

  const handleSizeSelect = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    const matchedVariant = findSizeVariant(size);
    if (matchedVariant && matchedVariant.inStock === false) return;

    setSelectedSize(size);
    setIsSizePickerOpen(false);

    const chosenPriceNum =
      matchedVariant?.priceNum ??
      (typeof matchedVariant?.pricePaise === 'number' ? matchedVariant.pricePaise / 100 : undefined) ??
      effectivePriceNum;
    const chosenPriceStr =
      matchedVariant?.price ||
      `₹ ${chosenPriceNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    addToCart({
      id: product.id,
      slug: product.slug,
      title: product.title,
      price: chosenPriceStr,
      priceNum: chosenPriceNum,
      size: size,
      color: activeColor?.name,
      variantId: matchedVariant?.id,
      img: colorPrimaryImg
    });
    openCart();
  };

  return (
    <div
      ref={cardRef}
      className={`mastery-product-card ${isSizePickerOpen ? 'is-size-picker-open' : ''}`}
      data-product-id={product.id}
      data-selected-size={selectedSize || ''}
      data-selected-color={activeColor?.name || ''}
    >
      <div className="mastery-image-box mastery-card-media">
        {product.badge && (
          <span className="mastery-badge">{product.badge}</span>
        )}

        {/* Wishlist Heart Button in Top-Right Corner */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <WishlistButton
            item={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              price: effectivePriceDisplay,
              priceNum: effectivePriceNum,
              image: colorPrimaryImg,
              link: productHref
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-neutral-600 hover:text-black shadow-xs transition-all p-1.5"
          />
        </div>

        <a href={productHref} className="mastery-image-link mastery-img-link" tabIndex={-1}>
          <img
            src={displayedPrimaryImg}
            alt={`${product.title}${activeColor?.name ? ` - ${activeColor.name}` : ''}`}
            className="mastery-product-img mastery-img-primary default-img product-item__primary-image"
            loading="lazy"
          />
          <img
            src={displayedHoverImg}
            alt={`${product.title} - Alternate View`}
            className="mastery-product-img mastery-img-hover hover-img product-item__secondary-image"
            loading="lazy"
          />
        </a>

        {/* Quick Form Container: Cart symbol has 10px padding; when sizes open, cart is invisible & sizes spread horizontally across entire image */}
        <div className={`product-item__quick-form ${isSizePickerOpen ? 'is-expanded' : ''}`}>
          {/* Quick Sizes Strip spreads across entire image horizontally */}
          <div
            ref={sizesRef}
            className={`product-item__quick-sizes ${isSizePickerOpen ? 'is-open' : ''}`}
            role="group"
            aria-label="Available Sizes"
          >
            {(product.sizes || []).map(size => {
              const sizeVar = findSizeVariant(size);
              const outOfStock = sizeVar ? sizeVar.inStock === false : false;
              const sizePriceNum =
                sizeVar?.priceNum ??
                (typeof sizeVar?.pricePaise === 'number' ? sizeVar.pricePaise / 100 : undefined);
              const hasDiffSizePrice =
                typeof sizePriceNum === 'number' && Math.abs(sizePriceNum - colorMinPriceNum) > 0.01;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={outOfStock}
                  title={
                    outOfStock
                      ? `${size} — Sold Out`
                      : sizePriceNum
                        ? `${size} — ${formatInrAmount(sizePriceNum, selectedCountry, fx)}`
                        : size
                  }
                  className={`quick-size-btn ${selectedSize === size ? 'is-selected' : ''} ${outOfStock ? 'opacity-40 line-through cursor-not-allowed' : ''}`}
                  data-size={size}
                  aria-label={`Select Size ${size}`}
                  onClick={e => handleSizeSelect(e, size)}
                >
                  <span>{size}</span>
                  {hasDiffSizePrice && !outOfStock && (
                    <span className="block text-[9px] leading-none opacity-80 mt-0.5">
                      {formatInrAmount(sizePriceNum!, selectedCountry, fx)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Buy / Add to Cart Tote Bag Button (Invisible when size picker is open) */}
          {!isSizePickerOpen && (
            <button
              type="button"
              className="product-item__quick-buy-button"
              aria-label={`Quick buy ${product.title} - Select size`}
              aria-expanded={isSizePickerOpen}
              title="Select size"
              onClick={handleToggleSizePicker}
            >
              <span className="loader-button__text">
                <span className="visually-hidden">Quick view</span>
                <svg
                  focusable="false"
                  width="24"
                  height="24"
                  className="icon icon--quick-buy-tote-bag"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M14 20H4L5 9H19L19.4545 14" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M20 16V24M16 20H24" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M15 6V6C15 4.34315 13.6569 3 12 3V3C10.3431 3 9 4.34315 9 6V6" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mastery-info-box mastery-card-details product-item-meta font-montserrat">
        <h3 className="mastery-item-title font-montserrat">
          <a href={productHref} className="product-item-meta__title font-montserrat">{product.title}</a>
        </h3>

        <p className="mastery-item-price product-item-meta__price-list-container price-list font-montserrat">
          <span className="price product-item-meta__price font-montserrat">
            {activeMarket.currency === 'INR' ? (
              <>
                <span className="currency-symbol price-currency font-montserrat">₹</span>
                <span className="price-val font-montserrat">
                  {effectivePriceNum.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </>
            ) : (
              <span className="price-val font-montserrat">
                {formatInrAmount(effectivePriceNum, selectedCountry, fx)}
              </span>
            )}
          </span>
        </p>

        {/* Color Swatch List Under Price */}
        <div className="product-item-meta__swatch-list color-swatch-list color-swatch-list--mini">
          {colors.map((color, idx) => (
            <div key={idx} className="color-swatch-list__item">
              <input
                type="radio"
                className="color-swatch__radio visually-hidden"
                name={`swatch-${product.id}`}
                id={`swatch-${product.id}-${idx}`}
                checked={safeColorIdx === idx}
                onChange={() => setSelectedColorIndex(idx)}
              />
              <label
                className={`color-swatch__item ${safeColorIdx === idx ? 'is-selected' : ''}`}
                htmlFor={`swatch-${product.id}-${idx}`}
                style={{ backgroundColor: color.hex }}
                title={
                  color.priceNum && color.priceNum !== product.priceNum
                    ? `${color.name} — ${formatInrAmount(color.priceNum, selectedCountry, fx)}`
                    : color.name
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedColorIndex(idx);
                }}
              >
                <span className="visually-hidden">{color.name}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

