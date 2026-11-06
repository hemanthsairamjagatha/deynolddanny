import React, { useState } from 'react';
import type { ProductCardData } from '../../types/ecommerce';
import { addToCart } from '../../stores/cartStore';

interface ProductCardProps {
  product: ProductCardData;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const handleSizeClick = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSize(size);

    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      priceNum: product.priceNum,
      size: size,
      img: product.defaultImg
    });
  };

  return (
    <div
      className="mastery-product-card"
      data-product-id={product.id}
      data-selected-size={selectedSize || ''}
    >
      <div className="mastery-card-media">
        {product.badge && (
          <span className="mastery-badge">{product.badge}</span>
        )}
        <a href={product.link || '#'} className="mastery-img-link" tabIndex={-1}>
          <img
            src={product.defaultImg}
            alt={product.title}
            className="mastery-product-img default-img"
            loading="lazy"
          />
          <img
            src={product.hoverImg}
            alt={`${product.title} - Alternate View`}
            className="mastery-product-img hover-img"
            loading="lazy"
          />
        </a>

        {/* Quick Size Selector Pills */}
        <div className="mastery-size-selector">
          {product.sizes.map(size => (
            <button
              key={size}
              type="button"
              className={`mastery-size-btn ${selectedSize === size ? 'is-selected' : ''}`}
              data-size={size}
              aria-label={`Select Size ${size}`}
              onClick={e => handleSizeClick(e, size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="mastery-card-details">
        <h3 className="mastery-item-title">
          <a href={product.link || '#'}>{product.title}</a>
        </h3>
        <p className="mastery-item-price">
          <span className="price-currency">₹</span>
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
