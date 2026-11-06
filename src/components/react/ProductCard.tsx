import React, { useState, useRef, useEffect } from 'react';
import type { ProductCardData } from '../../types/ecommerce';
import { addToCart, openCart } from '../../stores/cartStore';

interface ProductCardProps {
  product: ProductCardData;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isSizePickerOpen, setIsSizePickerOpen] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close size picker on outside click
  useEffect(() => {
    if (!isSizePickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsSizePickerOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
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
            className="mastery-product-img mastery-img-primary default-img"
            loading="lazy"
          />
          <img
            src={product.hoverImg}
            alt={`${product.title} - Alternate View`}
            className="mastery-product-img mastery-img-hover hover-img"
            loading="lazy"
          />
        </a>

        {/* Quick Form Container with 10px padding under and around the cart symbol */}
        <div className="product-item__quick-form">
          {/* Quick Sizes Strip (Revealed directly next to the bag button on click) */}
          <div
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

          {/* Quick Buy / Add to Cart Tote Bag Button */}
          <button
            type="button"
            className={`product-item__quick-buy-button ${isSizePickerOpen ? 'is-active' : ''}`}
            aria-label={`Quick buy ${product.title} - Select size`}
            aria-expanded={isSizePickerOpen}
            title={isSizePickerOpen ? 'Close sizes' : 'Select size'}
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
        </div>
      </div>

      <div className="mastery-info-box mastery-card-details">
        <h3 className="mastery-item-title">
          <a href={product.link || '#'}>{product.title}</a>
        </h3>

        <p className="mastery-item-price">
          <span className="currency-symbol price-currency">₹</span>
          <span className="price-val">
            {product.priceNum.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </p>
      </div>
    </div>
  );
};

export default ProductCard;
