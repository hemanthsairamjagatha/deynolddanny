import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ProductCardData } from '../types/product.types';
import ProductCard from './ProductCard';

export interface CarouselCategory {
  label: string;
  value: string;
}

interface ProductCarouselProps {
  id: string;
  title: string;
  count?: number;
  viewAllLink?: string;
  products: ProductCardData[];
  allCatalogProducts?: ProductCardData[];
  categories?: CarouselCategory[];
  defaultCategory?: string;
  sectionClass?: string;
  showModelView?: boolean;
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({
  id,
  title,
  count: _count,
  viewAllLink = '#',
  products,
  allCatalogProducts,
  categories,
  defaultCategory = 'all',
  sectionClass = 'mastery-section',
  showModelView = true
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);
  const [isModelView, setIsModelView] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [canScrollPrev, setCanScrollPrev] = useState<boolean>(false);
  const [canScrollNext, setCanScrollNext] = useState<boolean>(true);
  const trackRef = useRef<HTMLDivElement>(null);

  // Compute filtered products based on active category
  const displayedProducts = useMemo(() => {
    if (!categories || categories.length === 0 || !activeCategory || activeCategory === 'all') {
      return products;
    }

    const source = (allCatalogProducts && allCatalogProducts.length > 0)
      ? allCatalogProducts
      : products;

    const catLower = activeCategory.toLowerCase();

    const matches = source.filter((item) => {
      const itemCat = (item.category || '').toLowerCase();
      const itemSubCat = (item.subCategory || '').toLowerCase();
      const itemTitle = (item.title || '').toLowerCase();
      const itemTag = (item.tag || '').toLowerCase();

      if (catLower === 'tailoring') {
        return (
          itemCat.includes('tailor') ||
          itemTitle.includes('suit') ||
          itemTitle.includes('blazer') ||
          itemTag.includes('tailor')
        );
      }
      if (catLower === 'trousers') {
        return (
          itemCat.includes('trouser') ||
          itemCat.includes('pantaloni') ||
          itemTitle.includes('trouser') ||
          itemTitle.includes('pant')
        );
      }
      if (catLower === 'shirts') {
        return (
          itemCat.includes('shirt') ||
          itemCat.includes('camicie') ||
          itemTitle.includes('shirt')
        );
      }
      if (catLower === 'knitwear') {
        return (
          itemCat.includes('knit') ||
          itemCat.includes('maglieria') ||
          itemTitle.includes('sweater') ||
          itemTitle.includes('knit') ||
          itemTitle.includes('turtleneck')
        );
      }
      if (catLower === 'outerwear' || catLower === 'overcoats') {
        return (
          itemCat.includes('outerwear') ||
          itemCat.includes('overcoat') ||
          itemCat.includes('capispalla') ||
          itemTitle.includes('coat') ||
          itemTitle.includes('jacket') ||
          itemTitle.includes('trench')
        );
      }
      if (catLower === 'footwear' || catLower === 'shoes') {
        return (
          itemCat.includes('footwear') ||
          itemCat.includes('shoe') ||
          itemCat.includes('scarpe') ||
          itemTitle.includes('oxford') ||
          itemTitle.includes('loafer') ||
          itemTitle.includes('boot') ||
          itemTitle.includes('flat')
        );
      }
      if (catLower === 'accessories') {
        return (
          itemCat.includes('accessori') ||
          itemCat.includes('timepiece') ||
          itemTitle.includes('scarf') ||
          itemTitle.includes('sunglasses') ||
          itemTitle.includes('weekender') ||
          itemTitle.includes('beanie') ||
          itemTitle.includes('chronograph')
        );
      }

      return (
        itemCat.includes(catLower) ||
        itemSubCat.includes(catLower) ||
        itemTitle.includes(catLower) ||
        itemTag.includes(catLower)
      );
    });

    return matches.length > 0 ? matches : products;
  }, [activeCategory, categories, products, allCatalogProducts]);

  // Dynamic View All destination when category is selected
  const activeViewAllLink = useMemo(() => {
    if (activeCategory && activeCategory !== 'all') {
      const slug = activeCategory === 'outerwear' ? 'overcoats' : activeCategory;
      return `/categories/${slug}`;
    }
    return viewAllLink;
  }, [activeCategory, viewAllLink]);

  const updateScrollState = () => {
    if (trackRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = trackRef.current;
      setCanScrollPrev(scrollLeft > 10);
      setCanScrollNext(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const handleCategorySelect = (categoryValue: string) => {
    if (categoryValue === activeCategory) return;
    setActiveCategory(categoryValue);
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const track = trackRef.current;
    if (track) {
      updateScrollState();
      // Delay check slightly for layout calculation after card changes
      const timer = setTimeout(updateScrollState, 50);
      track.addEventListener('scroll', updateScrollState, { passive: true });
      window.addEventListener('resize', updateScrollState);
      return () => {
        clearTimeout(timer);
        track.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [displayedProducts]);

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
    <section
      className={`${sectionClass} ${isHovered ? 'is-hovered' : ''}`}
      id={id}
      aria-label={`${title} Collection`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="container mastery-container">
        {/* Header Row */}
        <div className="mastery-header-row">
          <div className="mastery-title-wrap">
            <h2 className="mastery-heading">
              {title}
            </h2>
          </div>

          <a href={activeViewAllLink} className="mastery-view-all">
            Shop {activeCategory && activeCategory !== 'all' ? activeCategory : title}
          </a>
        </div>

        {/* Subhead Row: Category Filter Tabs (Referenced Design) & Model View Toggle */}
        {((categories && categories.length > 0) || showModelView) && (
          <div className="mastery-subhead-row">
            {categories && categories.length > 0 && (
              <div
                className="mastery-categories-bar hide-scrollbar"
                role="tablist"
                aria-label={`${title} Categories`}
              >
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleCategorySelect(cat.value)}
                      className={`mastery-category-tab ${isActive ? 'is-active' : ''}`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}

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
          </div>
        )}

        {/* Carousel Track */}
        <div className="mastery-carousel-wrap product-list">
          <button
            type="button"
            className={`product-list__arrow prev-next-button prev-next-button--prev ${isHovered && canScrollPrev ? 'is-visible' : ''}`}
            aria-label="Previous"
            onClick={handlePrev}
            disabled={!canScrollPrev}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <div
            className="mastery-carousel-track product-list__inner product-list__inner--scroller hide-scrollbar"
            id={`${id}-carousel-track`}
            ref={trackRef}
          >
            {displayedProducts.map(prod => (
              <ProductCard key={`${prod.id}-${activeCategory}`} product={prod} isModelView={isModelView} />
            ))}
          </div>

          <button
            type="button"
            className={`product-list__arrow prev-next-button prev-next-button--next ${isHovered && canScrollNext ? 'is-visible' : ''}`}
            aria-label="Next"
            onClick={handleNext}
            disabled={!canScrollNext}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProductCarousel;
