import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ProductCardData } from '../types/product.types';
import { fetchProducts } from '../api/catalog.api';
import ProductCard from './ProductCard';

// Shared in-memory browser fetch so multiple carousels on the homepage trigger only 1 live /api/products request
let sharedLiveCatalogPromise: Promise<ProductCardData[]> | null = null;
function getLiveCatalogOnce(): Promise<ProductCardData[]> {
  if (!sharedLiveCatalogPromise) {
    sharedLiveCatalogPromise = fetchProducts({ limit: 48 }).catch(() => []);
  }
  return sharedLiveCatalogPromise;
}

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
  sectionGroup?: 'mastery' | 'style_space' | 'news';
  showModelView?: boolean;
}

interface CarouselCmsProps {
  title?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  sectionGroup?: string;
  limit?: number;
  showModelView?: boolean;
  defaultModelView?: boolean;
  showColorFilter?: boolean;
  productIds?: string[];
  categories?: CarouselCategory[];
  tabs?: Array<{ label?: string; value?: string; href?: string }>;
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
  sectionGroup,
  showModelView = true
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);
  const [activeColor, setActiveColor] = useState<string>('all');
  const [isModelView, setIsModelView] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [canScrollPrev, setCanScrollPrev] = useState<boolean>(false);
  const [canScrollNext, setCanScrollNext] = useState<boolean>(true);
  const [liveCatalog, setLiveCatalog] = useState<ProductCardData[] | null>(null);
  const [cmsProps, setCmsProps] = useState<CarouselCmsProps | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getLiveCatalogOnce().then((items) => {
      if (active && Array.isArray(items) && items.length > 0) {
        setLiveCatalog(items);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyMap = (map: Record<string, CarouselCmsProps> | undefined) => {
      if (!map || typeof map !== 'object') return;
      const cfg = map[id];
      if (cfg && typeof cfg === 'object') {
        setCmsProps(cfg);
        if (typeof cfg.defaultModelView === 'boolean') {
          setIsModelView(cfg.defaultModelView);
        }
      }
    };
    const existing = (window as unknown as { __ddCarouselsCms?: Record<string, CarouselCmsProps> }).__ddCarouselsCms;
    if (existing) applyMap(existing);
    const onUpdate = (e: Event) => {
      applyMap((e as CustomEvent<Record<string, CarouselCmsProps>>).detail);
    };
    window.addEventListener('dd:carousel-cms-update', onUpdate);
    return () => window.removeEventListener('dd:carousel-cms-update', onUpdate);
  }, [id]);

  const effectiveTitle = (typeof cmsProps?.title === 'string' && cmsProps.title.trim()) || title;
  const effectiveViewAllLink = (typeof cmsProps?.ctaUrl === 'string' && cmsProps.ctaUrl.trim()) || viewAllLink;
  const effectiveCtaLabel = typeof cmsProps?.ctaLabel === 'string' && cmsProps.ctaLabel.trim() ? cmsProps.ctaLabel.trim() : null;
  const effectiveShowModelView = typeof cmsProps?.showModelView === 'boolean' ? cmsProps.showModelView : showModelView;
  const effectiveShowColorFilter = typeof cmsProps?.showColorFilter === 'boolean' ? cmsProps.showColorFilter : true;
  const effectiveLimit = typeof cmsProps?.limit === 'number' && cmsProps.limit > 0 ? cmsProps.limit : 16;
  const effectiveSectionGroup =
    (typeof cmsProps?.sectionGroup === 'string' && cmsProps.sectionGroup.trim()
      ? cmsProps.sectionGroup.trim() === 'new-arrival'
        ? 'style_space'
        : cmsProps.sectionGroup.trim()
      : sectionGroup) || sectionGroup;

  const effectiveCategories = useMemo<CarouselCategory[] | undefined>(() => {
    if (Array.isArray(cmsProps?.categories) && cmsProps!.categories.length > 0) {
      return cmsProps!.categories.filter((c) => c && c.label && c.value);
    }
    if (Array.isArray(cmsProps?.tabs) && cmsProps!.tabs.length > 0) {
      const converted = cmsProps!.tabs
        .filter((t) => t && t.label)
        .map((t) => ({
          label: String(t.label).toUpperCase(),
          value: String(t.value || (t.href || '').replace(/^\/categories\//, '') || t.label).toLowerCase(),
        }));
      if (converted.length > 0) {
        return converted.some((c) => c.value === 'all')
          ? converted
          : [{ label: 'ALL', value: 'all' }, ...converted];
      }
    }
    return categories;
  }, [cmsProps, categories]);

  // Use live D1 catalog authoritatively so newly created, edited, and archived products reflect immediately
  const liveInitialProducts = useMemo(() => {
    if (!liveCatalog || liveCatalog.length === 0) return products;
    if (Array.isArray(cmsProps?.productIds) && cmsProps!.productIds.length > 0) {
      const byIdOrSlug = new Map<string, ProductCardData>();
      for (const p of liveCatalog) {
        byIdOrSlug.set(p.id, p);
        if (p.slug) byIdOrSlug.set(p.slug, p);
      }
      const picked = cmsProps!.productIds
        .map((pid) => byIdOrSlug.get(pid))
        .filter((p): p is ProductCardData => Boolean(p));
      if (picked.length > 0) return picked.slice(0, effectiveLimit);
    }
    if (effectiveSectionGroup) {
      const grouped = liveCatalog.filter((p) => p.sectionGroup === effectiveSectionGroup);
      if (grouped.length > 0) return grouped.slice(0, effectiveLimit);
    }
    const bySlug = new Map(liveCatalog.map((p) => [p.slug || p.id, p]));
    const updated = products
      .map((p) => bySlug.get(p.slug || p.id))
      .filter((p): p is ProductCardData => Boolean(p));
    return (updated.length > 0 ? updated : liveCatalog).slice(0, effectiveLimit);
  }, [products, liveCatalog, effectiveSectionGroup, cmsProps?.productIds, effectiveLimit]);

  // Compute category-filtered products
  const categoryFilteredProducts = useMemo(() => {
    if (!effectiveCategories || effectiveCategories.length === 0 || !activeCategory || activeCategory === 'all') {
      return liveInitialProducts;
    }

    const source =
      liveCatalog && liveCatalog.length > 0
        ? liveCatalog
        : allCatalogProducts && allCatalogProducts.length > 0
          ? allCatalogProducts
          : liveInitialProducts;

    const catLower = activeCategory.toLowerCase();

    const matches = source.filter((item) => {
      const itemCat = (item.category || '').toLowerCase();
      const itemSubCat = (item.subCategory || '').toLowerCase();
      const itemTitle = (item.title || '').toLowerCase();
      const itemTag = (item.tag || '').toLowerCase();

      if (catLower === 'tailoring' || catLower === 'suits') {
        return (
          itemCat.includes('tailor') ||
          itemCat.includes('abiti') ||
          itemCat.includes('suit') ||
          itemTitle.includes('suit') ||
          itemTitle.includes('blazer') ||
          itemTitle.includes('jacket') ||
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
      if (catLower === 'shirts' || catLower === 'denim-shirts') {
        return (
          itemCat.includes('shirt') ||
          itemCat.includes('camicie') ||
          itemTitle.includes('shirt')
        );
      }
      if (catLower === 'knitwear' || catLower === 'sweaters' || catLower === 'hoodies') {
        return (
          itemCat.includes('knit') ||
          itemCat.includes('maglieria') ||
          itemCat.includes('sweater') ||
          itemCat.includes('felpe') ||
          itemTitle.includes('sweater') ||
          itemTitle.includes('knit') ||
          itemTitle.includes('turtleneck')
        );
      }
      if (catLower === 'outerwear' || catLower === 'overcoats' || catLower === 'coats' || catLower === 'jackets') {
        return (
          itemCat.includes('outerwear') ||
          itemCat.includes('overcoat') ||
          itemCat.includes('coat') ||
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
          itemCat.includes('borse') ||
          itemCat.includes('timepiece') ||
          itemTitle.includes('scarf') ||
          itemTitle.includes('sunglasses') ||
          itemTitle.includes('weekender') ||
          itemTitle.includes('tote') ||
          itemTitle.includes('bag') ||
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

    return matches.length > 0 ? matches : liveInitialProducts;
  }, [activeCategory, effectiveCategories, liveInitialProducts, liveCatalog, allCatalogProducts]);

  // Distinct colour swatches available across the category-filtered products
  const availableColors = useMemo(() => {
    const map = new Map<string, { name: string; hex: string }>();
    for (const p of categoryFilteredProducts) {
      for (const c of p.colors ?? []) {
        if (!c?.name) continue;
        const key = c.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name: c.name, hex: c.hex || '#111111' });
        }
      }
    }
    return Array.from(map.values());
  }, [categoryFilteredProducts]);

  // Reset activeColor to 'all' if the chosen colour isn't in the newly selected category tab
  useEffect(() => {
    if (
      activeColor !== 'all' &&
      !availableColors.some((c) => c.name.toLowerCase() === activeColor.toLowerCase())
    ) {
      setActiveColor('all');
    }
  }, [activeColor, availableColors]);

  // Apply colour filter
  const displayedProducts = useMemo(() => {
    if (!activeColor || activeColor === 'all') return categoryFilteredProducts;
    const colorLow = activeColor.toLowerCase();
    const filtered = categoryFilteredProducts.filter((p) =>
      (p.colors ?? []).some((c) => c.name.toLowerCase() === colorLow),
    );
    return filtered.length > 0 ? filtered : categoryFilteredProducts;
  }, [categoryFilteredProducts, activeColor]);

  // Dynamic View All destination when category is selected
  const activeViewAllLink = useMemo(() => {
    if (activeCategory && activeCategory !== 'all') {
      const slug = activeCategory === 'outerwear' ? 'coats' : activeCategory;
      return `/categories/${slug}`;
    }
    return effectiveViewAllLink;
  }, [activeCategory, effectiveViewAllLink]);

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
              {effectiveTitle}
            </h2>
          </div>

          <a href={activeViewAllLink} className="mastery-view-all">
            {activeCategory && activeCategory !== 'all'
              ? `Shop ${activeCategory}`
              : effectiveCtaLabel || `Shop ${effectiveTitle}`}
          </a>
        </div>

        {/* Subhead Row: Category Filter Tabs & Model View Toggle */}
        {((effectiveCategories && effectiveCategories.length > 0) || effectiveShowModelView) && (
          <div className="mastery-subhead-row">
            {effectiveCategories && effectiveCategories.length > 0 && (
              <div
                className="mastery-categories-bar hide-scrollbar"
                role="tablist"
                aria-label={`${effectiveTitle} Categories`}
              >
                {effectiveCategories.map((cat) => {
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

            {effectiveShowModelView && (
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

        {/* Colour Swatch Filter Bar */}
        {effectiveShowColorFilter && availableColors.length > 1 && (
          <div
            className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2 mb-3"
            role="group"
            aria-label={`Filter ${effectiveTitle} by colour`}
          >
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mr-1 flex-shrink-0">
              Colour:
            </span>
            <button
              type="button"
              onClick={() => setActiveColor('all')}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] border transition-colors flex-shrink-0 ${
                activeColor === 'all'
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'
              }`}
            >
              All
            </button>
            {availableColors.map((col) => {
              const isSelected = activeColor.toLowerCase() === col.name.toLowerCase();
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => setActiveColor(isSelected ? 'all' : col.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] border transition-colors flex-shrink-0 ${
                    isSelected
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-900'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-neutral-300 flex-shrink-0"
                    style={{ backgroundColor: col.hex }}
                  />
                  <span>{col.name}</span>
                </button>
              );
            })}
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
              <ProductCard
                key={`${prod.id}-${activeCategory}-${activeColor}`}
                product={prod}
                isModelView={isModelView}
                preferredColorName={activeColor !== 'all' ? activeColor : undefined}
              />
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
