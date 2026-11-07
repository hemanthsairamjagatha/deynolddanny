import React, { useState, useRef, useEffect } from 'react';
import type { ProductCardData } from '../../types/ecommerce';
import { addToCart, openCart } from '../../stores/cartStore';

interface ProductCardProps {
  product: ProductCardData;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isSizePickerOpen, setIsSizePickerOpen] = useState<boolean>(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);

  const colors = product.colors && product.colors.length > 0
    ? product.colors
    : [
        { name: 'Slate Blue', hex: '#4e6d82' },
        { name: 'Cognac', hex: '#93532b' }
      ];

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
    setSelectedSize(size);
    setIsSizePickerOpen(false);

    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      priceNum: product.priceNum,
      size: size,
      img: product.defaultImg
    });
    openCart();
  };

  return (
    <div
      ref={cardRef}
      className={`mastery-product-card ${isSizePickerOpen ? 'is-size-picker-open' : ''}`}
      data-product-id={product.id}
      data-selected-size={selectedSize || ''}
    >
      <div className="mastery-image-box mastery-card-media">
        {product.badge && (
          <span className="mastery-badge">{product.badge}</span>
        )}
        <a href={product.link || '#'} className="mastery-image-link mastery-img-link" tabIndex={-1}>
          <img
            src={product.defaultImg}
            alt={product.title}
            className="mastery-product-img mastery-img-primary default-img product-item__primary-image"
            loading="lazy"
          />
          <img
            src={product.hoverImg}
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
            {product.sizes.map(size => (
              <button
                key={size}
                type="button"
                className={`quick-size-btn ${selectedSize === size ? 'is-selected' : ''}`}
                data-size={size}
                aria-label={`Select Size ${size}`}
                onClick={e => handleSizeSelect(e, size)}
              >
                {size}
              </button>
            ))}
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

      <div className="mastery-info-box mastery-card-details product-item-meta">
        <h3 className="mastery-item-title">
          <a href={product.link || '#'} className="product-item-meta__title">{product.title}</a>
        </h3>

        <p className="mastery-item-price product-item-meta__price-list-container price-list">
          <span className="price product-item-meta__price">
            <span className="currency-symbol price-currency">₹</span>
            <span className="price-val">
              {product.priceNum.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
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
                checked={selectedColorIndex === idx}
                onChange={() => setSelectedColorIndex(idx)}
              />
              <label
                className={`color-swatch__item ${selectedColorIndex === idx ? 'is-selected' : ''}`}
                htmlFor={`swatch-${product.id}-${idx}`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                onClick={(e) => {
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
