import React, { useState, useRef } from 'react';
import type { ProductCardData } from '../../types/ecommerce';
import ProductCard from './ProductCard';

interface ProductCarouselProps {
  id: string;
  title: string;
  count?: number;
  viewAllLink?: string;
  products: ProductCardData[];
  sectionClass?: string;
  showModelView?: boolean;
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({
  id,
  title,
  count,
  viewAllLink = '#',
  products,
  sectionClass = 'mastery-section',
  showModelView = true
}) => {
  const [isModelView, setIsModelView] = useState<boolean>(true);
  const trackRef = useRef<HTMLDivElement>(null);

  const getScrollStep = () => {
    if (!trackRef.current) return 280;
    const card = trackRef.current.querySelector('.mastery-product-card') as HTMLElement;
    if (!card) return 280;
    return card.offsetWidth + 16;
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
    }
  };

  return (
    <section className={sectionClass} id={id} aria-label={`${title} Collection`}>
      <div className="container mastery-container">
        {/* Header Row */}
        <div className="mastery-header-row">
          <div className="mastery-title-wrap">
            <button
              type="button"
              className="mastery-arrow-btn mastery-arrow-prev"
              id={`${id}-nav-prev`}
              aria-label="Previous Slide"
              onClick={handlePrev}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 2L4 7L9 12" />
              </svg>
            </button>
            <h2 className="mastery-heading">
              {title}
            </h2>
          </div>

          <a href={viewAllLink} className="mastery-view-all" onClick={handleNext}>
            VIEW ALL
            <svg
              width="11"
              height="11"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 2L10 7L5 12" />
            </svg>
          </a>
        </div>

        {/* Model View Row directly below Section Heading */}
        {showModelView && (
          <div className="model-view-row">
            <label className="MuiFormControlLabel-root MuiFormControlLabel-labelPlacementEnd e12z7ls0 css-1jaw3da model-view-form-control">
              <span className={`MuiSwitch-root MuiSwitch-sizeMedium css-1ewr2m8 ${isModelView ? 'Mui-checked' : ''}`}>
                <span className={`MuiButtonBase-root MuiSwitch-switchBase MuiSwitch-colorPrimary ${isModelView ? 'Mui-checked' : ''} css-by15t2`}>
                  <input
                    type="checkbox"
                    className="MuiSwitch-input css-1m9pwf3 visually-hidden"
                    checked={isModelView}
                    onChange={(e) => setIsModelView(e.target.checked)}
                    aria-label="Toggle Model View"
                  />
                  <span className="MuiSwitch-thumb css-1tuil5z" />
                </span>
                <span className="MuiSwitch-track css-9og5xt" />
              </span>
              <span className="MuiTypography-root MuiTypography-body1 MuiFormControlLabel-label css-uitf9v">
                MODEL VIEW
              </span>
            </label>
          </div>
        )}

        {/* Carousel Track */}
        <div className="mastery-carousel-wrap product-list">
          <div
            className="mastery-carousel-track product-list__inner product-list__inner--scroller hide-scrollbar"
            id={`${id}-carousel-track`}
            ref={trackRef}
          >
            {products.map(prod => (
              <ProductCard key={prod.id} product={prod} isModelView={isModelView} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductCarousel;
