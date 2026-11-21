import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { WishlistButton } from '../../wishlist/components/WishlistButton';
import { $fxSnapshot, $selectedCountry, formatInrDisplayString } from '../../../lib/currency/currency.store';

export interface LayeredProduct {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  image: string;
  price: string;
  priceNum: number;
  originalPrice?: string;
  discount?: string;
  link: string;
}

export interface LayeredLook {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  modelImage: string;
  focalX?: number;
  focalY?: number;
  products: LayeredProduct[];
}

export const STYLE_LAYERING_LOOKS: LayeredLook[] = [
  {
    id: 'atelier-deynold',
    title: 'ATELIER DEYNOLD',
    subtitle: 'Full-Canvas Virgin Wool Tailoring & Fine Knitwear',
    ctaText: 'Shop Look',
    ctaLink: '/categories/tailoring',
    modelImage: '/images/mastery-1-model.jpg',
    focalX: 50,
    focalY: 20,
    products: [
      {
        id: 'sl-atelier-1',
        slug: 'tailored-virgin-wool-suit',
        title: 'Tailored Virgin Wool Suit',
        subtitle: '100% Virgin Wool • Charcoal',
        image: '/images/mastery-1-product.jpg',
        price: '₹ 2,700.00',
        priceNum: 2700,
        link: '/products/tailored-virgin-wool-suit',
      },
      {
        id: 'sl-atelier-2',
        slug: 'sartorial-poplin-and-twill-dress-shirts-trio',
        title: 'Sartorial Poplin Dress Shirt',
        subtitle: 'Egyptian Cotton • Ivory',
        image: '/images/mastery-3-product.jpg',
        price: '₹ 1,980.00',
        priceNum: 1980,
        link: '/products/sartorial-poplin-and-twill-dress-shirts-trio',
      },
      {
        id: 'sl-atelier-3',
        slug: 'nappa-leather-chelsea-flat',
        title: 'Nappa Leather Chelsea Flat',
        subtitle: 'Full-Grain Calfskin • Espresso',
        image: '/images/style-1-product.jpg',
        price: '₹ 1,170.00',
        priceNum: 1170,
        link: '/products/nappa-leather-chelsea-flat',
      },
    ],
  },
  {
    id: 'quiet-cashmere',
    title: 'QUIET CASHMERE',
    subtitle: 'Double-Faced Overcoats & Inner-Fleece Knitwear',
    ctaText: 'Shop Look',
    ctaLink: '/categories/knitwear',
    modelImage: '/images/mastery-2-model.jpg',
    focalX: 50,
    focalY: 22,
    products: [
      {
        id: 'sl-cashmere-1',
        slug: 'tailored-virgin-wool-overcoat-with-cashmere-scarf',
        title: 'Virgin Wool Overcoat & Scarf',
        subtitle: 'Virgin Wool & Cashmere',
        image: '/images/mastery-2-product.jpg',
        price: '₹ 4,500.00',
        priceNum: 4500,
        link: '/products/tailored-virgin-wool-overcoat-with-cashmere-scarf',
      },
      {
        id: 'sl-cashmere-2',
        slug: 'merino-wool-ribbed-turtleneck',
        title: 'Merino Ribbed Turtleneck',
        subtitle: 'Superfine Merino • Stone',
        image: '/images/mastery-4-product.jpg',
        price: '₹ 1,440.00',
        priceNum: 1440,
        link: '/products/merino-wool-ribbed-turtleneck',
      },
      {
        id: 'sl-cashmere-3',
        slug: 'cashmere-blend-ribbed-beanie',
        title: 'Cashmere Ribbed Beanie',
        subtitle: 'Pure Inner Fleece • Navy',
        image: '/images/style-4-product.jpg',
        price: '₹ 540.00',
        priceNum: 540,
        link: '/products/cashmere-blend-ribbed-beanie',
      },
    ],
  },
  {
    id: 'architectural-coats',
    title: 'ARCHITECTURAL COATS',
    subtitle: 'Structured Car Coats & High-Rise Pleated Trousers',
    ctaText: 'Shop Look',
    ctaLink: '/categories/coats',
    modelImage: '/images/style-2-model.jpg',
    focalX: 50,
    focalY: 20,
    products: [
      {
        id: 'sl-coats-1',
        slug: 'stand-collar-virgin-wool-tailored-car-coat',
        title: 'Stand-Collar Tailored Car Coat',
        subtitle: 'Heavyweight Virgin Wool',
        image: '/images/style-2-product.jpg',
        price: '₹ 3,330.00',
        priceNum: 3330,
        link: '/products/stand-collar-virgin-wool-tailored-car-coat',
      },
      {
        id: 'sl-coats-2',
        slug: 'pleated-high-rise-wool-trousers',
        title: 'Pleated High-Rise Trousers',
        subtitle: 'Architectural Drape • Slate',
        image: '/images/news-3-product.jpg',
        price: '₹ 1,260.00',
        priceNum: 1260,
        link: '/products/pleated-high-rise-wool-trousers',
      },
      {
        id: 'sl-coats-3',
        slug: 'hand-stitched-suede-loafer',
        title: 'Hand-Stitched Suede Loafer',
        subtitle: 'Water-Repellent Suede',
        image: '/images/news-2-product.jpg',
        price: '₹ 1,440.00',
        priceNum: 1440,
        link: '/products/hand-stitched-suede-loafer',
      },
    ],
  },
  {
    id: 'sartorial-shirting',
    title: 'SARTORIAL SHIRTING',
    subtitle: 'Crisp Poplin, Tailored Vests & Fluid Trousers',
    ctaText: 'Shop Look',
    ctaLink: '/categories/shirts',
    modelImage: '/images/mastery-3-model.jpg',
    focalX: 50,
    focalY: 20,
    products: [
      {
        id: 'sl-shirt-1',
        slug: 'sartorial-poplin-and-twill-dress-shirts-trio',
        title: 'Poplin & Twill Dress Shirts',
        subtitle: 'Mother-of-Pearl Buttons',
        image: '/images/mastery-3-product.jpg',
        price: '₹ 1,980.00',
        priceNum: 1980,
        link: '/products/sartorial-poplin-and-twill-dress-shirts-trio',
      },
      {
        id: 'sl-shirt-2',
        slug: 'cady-crepe-tailored-vest',
        title: 'Cady Crêpe Tailored Vest',
        subtitle: 'Sculpted Waistcoat',
        image: '/images/style-3-product.jpg',
        price: '₹ 900.00',
        priceNum: 900,
        link: '/products/cady-crepe-tailored-vest',
      },
      {
        id: 'sl-shirt-3',
        slug: 'cady-trousers',
        title: 'CADY-TROUSERS',
        subtitle: 'Double-Pleated Silhouette',
        image: '/images/cady-trousers-product.jpg',
        price: '₹ 67,500.00',
        priceNum: 67500,
        link: '/products/cady-trousers',
      },
    ],
  },
  {
    id: 'evening-tailoring',
    title: 'EVENING TAILORING',
    subtitle: 'Peak-Lapel Dinner Jackets & Horological Accents',
    ctaText: 'Shop Look',
    ctaLink: '/categories/suits',
    modelImage: '/images/mastery-5-model.jpg',
    focalX: 50,
    focalY: 20,
    products: [
      {
        id: 'sl-eve-1',
        slug: 'full-canvas-peak-lapel-dinner-jacket',
        title: 'Peak Lapel Dinner Jacket',
        subtitle: 'Silk Grosgrain Facings',
        image: '/images/mastery-5-product.jpg',
        price: '₹ 3,600.00',
        priceNum: 3600,
        link: '/products/full-canvas-peak-lapel-dinner-jacket',
      },
      {
        id: 'sl-eve-2',
        slug: 'automatic-chronograph-timepiece-with-alligator-strap',
        title: 'Automatic Chronograph',
        subtitle: 'Swiss Calibre • Leather Strap',
        image: '/images/news-5-product.jpg',
        price: '₹ 7,200.00',
        priceNum: 7200,
        link: '/products/automatic-chronograph-timepiece-with-alligator-strap',
      },
      {
        id: 'sl-eve-3',
        slug: 'pleated-high-rise-wool-trousers',
        title: 'High-Rise Wool Trousers',
        subtitle: 'Formal Barathea Wool',
        image: '/images/news-3-product.jpg',
        price: '₹ 1,260.00',
        priceNum: 1260,
        link: '/products/pleated-high-rise-wool-trousers',
      },
    ],
  },
  {
    id: 'artisanal-leather',
    title: 'ARTISANAL LEATHER',
    subtitle: 'Hand-Burnished Footwear & Full-Grain Travel Goods',
    ctaText: 'Shop Look',
    ctaLink: '/categories/accessories',
    modelImage: '/images/style-1-model.jpg',
    focalX: 50,
    focalY: 25,
    products: [
      {
        id: 'sl-leather-1',
        slug: 'grain-leather-structured-tote',
        title: 'Grain Leather Structured Tote',
        subtitle: 'Vegetable-Tanned Calfskin',
        image: '/images/style-5-product.jpg',
        price: '₹ 2,250.00',
        priceNum: 2250,
        link: '/products/grain-leather-structured-tote',
      },
      {
        id: 'sl-leather-2',
        slug: 'lambskin-crossbody-mini-bag',
        title: 'Lambskin Crossbody Bag',
        subtitle: 'Supple Nappa • Palladium',
        image: '/images/news-4-product.jpg',
        price: '₹ 1,980.00',
        priceNum: 1980,
        link: '/products/lambskin-crossbody-mini-bag',
      },
      {
        id: 'sl-leather-3',
        slug: 'nappa-leather-chelsea-flat',
        title: 'Nappa Leather Chelsea Flat',
        subtitle: 'Blake-Stitched Sole',
        image: '/images/style-1-product.jpg',
        price: '₹ 1,170.00',
        priceNum: 1170,
        link: '/products/nappa-leather-chelsea-flat',
      },
    ],
  },
];

interface StyleLayeringCmsPayload {
  title?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  tabs?: Array<{
    key?: string;
    label?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    backdropImage?: string;
    focalX?: number;
    focalY?: number;
    pieces?: Array<{
      title?: string;
      subtitle?: string;
      image?: string;
      href?: string;
      price?: string;
      originalPrice?: string;
      discount?: string;
    }>;
  }>;
}

export const StyleLayering: React.FC = () => {
  const selectedCountry = useStore($selectedCountry);
  const fx = useStore($fxSnapshot);
  const [cmsConfig, setCmsConfig] = useState<StyleLayeringCmsPayload | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      __ddStyleLayeringCms?: StyleLayeringCmsPayload;
      __ddPublishedBundle?: { homepageSections?: Array<{ sectionType?: string; section_type?: string; props?: StyleLayeringCmsPayload; config_json?: StyleLayeringCmsPayload }> };
    };

    if (win.__ddStyleLayeringCms) {
      setCmsConfig(win.__ddStyleLayeringCms);
    } else if (win.__ddPublishedBundle?.homepageSections) {
      const sec = win.__ddPublishedBundle.homepageSections.find(
        (s) => (s.sectionType ?? s.section_type) === 'style_layering',
      );
      if (sec) setCmsConfig(sec.props ?? sec.config_json ?? null);
    }

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<StyleLayeringCmsPayload>).detail;
      if (detail && typeof detail === 'object') setCmsConfig(detail);
    };
    const onBundle = (e: Event) => {
      const bundle = (e as CustomEvent<{ homepageSections?: Array<{ sectionType?: string; section_type?: string; props?: StyleLayeringCmsPayload; config_json?: StyleLayeringCmsPayload }> }>).detail;
      const sec = bundle?.homepageSections?.find((s) => (s.sectionType ?? s.section_type) === 'style_layering');
      if (sec) setCmsConfig(sec.props ?? sec.config_json ?? null);
    };
    window.addEventListener('dd:style-layering-cms-update', onUpdate);
    window.addEventListener('dd:storefront-bundle-ready', onBundle);
    return () => {
      window.removeEventListener('dd:style-layering-cms-update', onUpdate);
      window.removeEventListener('dd:storefront-bundle-ready', onBundle);
    };
  }, []);

  const looks: LayeredLook[] = React.useMemo(() => {
    if (cmsConfig?.tabs && Array.isArray(cmsConfig.tabs) && cmsConfig.tabs.length > 0) {
      const mapped = cmsConfig.tabs
        .filter((t) => t && (t.label || t.backdropImage))
        .map((t, idx) => {
          const fallback = STYLE_LAYERING_LOOKS[idx % STYLE_LAYERING_LOOKS.length];
          const pieces: LayeredProduct[] =
            Array.isArray(t.pieces) && t.pieces.length > 0
              ? t.pieces.map((p, pi) => {
                  const fbPiece = fallback.products[pi % fallback.products.length];
                  const priceStr = (p.price || '').trim() || fbPiece.price;
                  const origStr = (p.originalPrice || '').trim();
                  const discStr = (p.discount || '').trim();
                  return {
                    id: `${t.key || idx}-p-${pi}`,
                    slug: (p.href || '').replace(/^\/products\//, '') || fbPiece.slug,
                    title: (p.title || '').trim() || fbPiece.title,
                    subtitle: (p.subtitle || '').trim() || fbPiece.subtitle,
                    image: (p.image || '').trim() || fbPiece.image,
                    originalPrice: origStr && origStr !== priceStr ? origStr : undefined,
                    discount: discStr || undefined,
                    price: priceStr,
                    priceNum: parseFloat(priceStr.replace(/[^0-9.]/g, '')) || fbPiece.priceNum,
                    link: (p.href || '').trim() || fbPiece.link,
                  };
                })
              : fallback.products;
          return {
            id: t.key || `cms-look-${idx}`,
            title: (t.label || '').trim() || fallback.title,
            subtitle: (t.subtitle || '').trim() || fallback.subtitle,
            ctaText: (t.ctaLabel || cmsConfig.ctaLabel || '').trim() || fallback.ctaText,
            ctaLink: (t.ctaUrl || cmsConfig.ctaUrl || '').trim() || fallback.ctaLink,
            modelImage: (t.backdropImage || '').trim() || fallback.modelImage,
            focalX: typeof t.focalX === 'number' ? t.focalX : fallback.focalX ?? 50,
            focalY: typeof t.focalY === 'number' ? t.focalY : fallback.focalY ?? 25,
            products: pieces,
          };
        });
      if (mapped.length > 0) return mapped;
    }
    return STYLE_LAYERING_LOOKS;
  }, [cmsConfig]);

  const sectionTitle = cmsConfig?.title?.trim() || 'STYLE LAYERING';
  const sectionCtaLabel = cmsConfig?.ctaLabel?.trim() || 'Shop All Looks';
  const sectionCtaUrl = cmsConfig?.ctaUrl?.trim() || '/categories';

  const LOOKS_COUNT = looks.length;
  // Triple the looks array for infinite looping: [0..N-1, N..2N-1 (middle original), 2N..3N-1]
  const TRIPLED_LOOKS = React.useMemo(() => [...looks, ...looks, ...looks], [looks]);

  const [withTransition, setWithTransition] = useState<boolean>(true);
  const [slideIndex, setSlideIndex] = useState<number>(LOOKS_COUNT);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  useEffect(() => {
    setWithTransition(false);
    setSlideIndex(LOOKS_COUNT);
  }, [LOOKS_COUNT]);

  const brandNavRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeBrandIndex = ((slideIndex % LOOKS_COUNT) + LOOKS_COUNT) % LOOKS_COUNT;

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Smoothly scroll the brand navigation tab into view
  useEffect(() => {
    const container = brandNavRef.current;
    const tab = tabRefs.current[activeBrandIndex];
    if (container && tab) {
      const tabLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;
      const containerWidth = container.offsetWidth;
      container.scrollTo({
        left: tabLeft - containerWidth / 2 + tabWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [activeBrandIndex]);

  // Re-enable CSS transition on the next animation frame after infinite loop jump
  useEffect(() => {
    if (!withTransition) {
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWithTransition(true);
        });
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [withTransition]);

  const handleTabClick = (targetIdx: number) => {
    const currentMod = ((slideIndex % LOOKS_COUNT) + LOOKS_COUNT) % LOOKS_COUNT;
    let diff = targetIdx - currentMod;
    if (diff > LOOKS_COUNT / 2) diff -= LOOKS_COUNT;
    if (diff < -LOOKS_COUNT / 2) diff += LOOKS_COUNT;
    setWithTransition(true);
    setSlideIndex((prev) => prev + diff);
  };

  const handlePrev = () => {
    setWithTransition(true);
    setSlideIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    setWithTransition(true);
    setSlideIndex((prev) => prev + 1);
  };

  const handleSlideClick = (idx: number) => {
    if (idx !== slideIndex) {
      setWithTransition(true);
      setSlideIndex(idx);
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;

    if (slideIndex < LOOKS_COUNT || slideIndex >= LOOKS_COUNT * 2) {
      const normalizedMod = ((slideIndex % LOOKS_COUNT) + LOOKS_COUNT) % LOOKS_COUNT;
      const normalizedIndex = LOOKS_COUNT + normalizedMod;
      setWithTransition(false);
      setSlideIndex(normalizedIndex);
    }
  };

  // Touch swipe handling
  const touchStartX = useRef<number>(0);
  const touchDeltaX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchDeltaX.current < -50) {
      handleNext();
    } else if (touchDeltaX.current > 50) {
      handlePrev();
    }
  };

  return (
    <section
      className="style-layering-section"
      id="style-layering"
      aria-label="Style Layering Collection"
    >
      <div className="container mastery-container">
        {/* Section Header */}
        <div className="mastery-header-row">
          <div className="mastery-title-wrap">
            <h2 className="mastery-heading">
              {sectionTitle}
            </h2>
          </div>
          <a href={sectionCtaUrl} className="mastery-view-all">
            {sectionCtaLabel}
          </a>
        </div>
      </div>

      {/* Lookbook 3-Panel Center-Mode Slider - Full-Bleed Edge-to-Edge */}
      <div className="brand-swiper2 swiper inner-box brand-swiper2-0 swiper-initialized swiper-horizontal relative w-full overflow-hidden mt-4">
        {/* Brand Navigation Tabs Row */}
        <div
          ref={brandNavRef}
          className="brand-nav-bar flex items-center justify-start lg:justify-center gap-6 sm:gap-8 overflow-x-auto hide-scrollbar px-4 py-2.5 mb-3 select-none max-w-[1334px] mx-auto scroll-smooth"
        >
          {looks.map((look, idx) => (
            <button
              key={look.id}
              ref={(el) => (tabRefs.current[idx] = el)}
              type="button"
              onClick={() => handleTabClick(idx)}
              className={`text-[13px] sm:text-[14px] uppercase tracking-[0.06em] font-montserrat whitespace-nowrap transition-colors duration-200 cursor-pointer pb-1 ${
                activeBrandIndex === idx
                  ? 'text-black font-bold border-b border-black'
                  : 'text-[#8e8e93] hover:text-black font-medium'
              }`}
            >
              {look.title}
            </button>
          ))}
        </div>

        {/* Continuous Animated Swiper Track - 660x881 each slide, gap 14px */}
        <div
          className="relative w-full overflow-hidden min-h-[550px] sm:min-h-[881px]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="swiper-wrapper flex items-center gap-[14px] will-change-transform"
            onTransitionEnd={handleTransitionEnd}
            style={{
              transform: isDesktop
                ? `translateX(calc(50% - 330px - ${slideIndex * 674}px))`
                : `translateX(calc(50% - 45vw - ${slideIndex * 92}vw))`,
              transition: withTransition
                ? 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'none',
            }}
          >
            {TRIPLED_LOOKS.map((look, idx) => {
              const isActive = idx === slideIndex;
              const uniqueKey = `${look.id}-${idx}`;
              return (
                <div
                  key={uniqueKey}
                  onClick={() => handleSlideClick(idx)}
                  className={`swiper-slide relative w-[90vw] sm:w-[660px] max-w-[660px] h-auto sm:h-[881px] flex-shrink-0 flex flex-col items-center select-none transition-opacity duration-500 ${
                    isActive ? 'swiper-slide-active cursor-default' : 'cursor-pointer opacity-50 hover:opacity-75'
                  }`}
                >
                  {/* 1. MOBILE ONLY: Top Model Photo + Bottom 3-Product Row (Matches User Reference Image) */}
                  <div className="block sm:hidden w-full bg-white rounded-sm overflow-hidden shadow-md border border-neutral-200/60">
                    {/* Top Model Photo */}
                    <div className="relative w-full h-[380px] xs:h-[410px] overflow-hidden bg-neutral-900">
                      <img
                        src={look.modelImage}
                        alt={look.title}
                        style={{ objectPosition: `${look.focalX ?? 50}% ${look.focalY ?? 25}%` }}
                        className="w-full h-full object-cover"
                        loading={Math.abs(idx - slideIndex) <= 1 ? 'eager' : 'lazy'}
                      />
                      {/* Subtle bottom gradient for clear white text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                      {/* Brand / Look Title Overlay at bottom of photo (matches "LETTER FROM MOON" in reference image) */}
                      <div className="absolute bottom-3.5 left-0 right-0 text-center px-4 z-10 pointer-events-none">
                        <h3 className="text-[17px] xs:text-[19px] font-semibold tracking-[0.14em] text-white uppercase font-montserrat drop-shadow-md leading-tight">
                          {look.title}
                        </h3>
                        {look.subtitle && (
                          <p className="mt-1 text-[10px] text-white/80 tracking-[0.1em] uppercase font-montserrat drop-shadow line-clamp-1">
                            {look.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom 3-Product Row (Clean white background with dark text) */}
                    <div className="w-full bg-white p-2.5">
                      <div className="grid grid-cols-3 gap-2 w-full">
                        {look.products.slice(0, 3).map((prod) => (
                          <a
                            key={prod.id}
                            href={prod.link}
                            className="style-layering-mobile-prod-card block text-left group"
                          >
                            {/* Product Thumbnail */}
                            <div className="relative w-full aspect-[3/4] bg-[#f8f8f8] rounded-[2px] overflow-hidden mb-1.5 shadow-sm">
                              <img
                                src={prod.image}
                                alt={prod.title}
                                className="w-full h-full object-cover object-center"
                                loading={isActive ? 'eager' : 'lazy'}
                              />
                              {/* Wishlist Button inside Image */}
                              <div className="absolute top-1 right-1 z-10">
                                <WishlistButton
                                  item={{
                                    id: prod.slug || prod.id,
                                    slug: prod.slug,
                                    title: prod.title,
                                    price: prod.price,
                                    priceNum: prod.priceNum,
                                    image: prod.image,
                                    link: prod.link,
                                  }}
                                  className="style-layering-wishlist-btn p-1 bg-transparent hover:bg-transparent text-neutral-400 hover:text-black shadow-none"
                                />
                              </div>
                            </div>

                            {/* Product Title (Dark text, 2 lines max) */}
                            <p className="text-[10.5px] xs:text-[11px] leading-[1.25] text-[#222222] font-normal line-clamp-2 font-montserrat mb-1">
                              {prod.title}
                            </p>

                            {/* Product Price (Dark bold text) */}
                            <div className="font-montserrat">
                              {prod.originalPrice && (
                                <p className="text-[9.5px] text-neutral-400 line-through leading-none mb-0.5">
                                  {formatInrDisplayString(prod.originalPrice, selectedCountry, fx)}
                                </p>
                              )}
                              <p className="text-[11.5px] xs:text-[12px] font-bold text-black leading-tight flex items-center gap-1">
                                {prod.discount && (
                                  <span className="text-[#ff4d4f] font-bold text-[10.5px]">
                                    {prod.discount}
                                  </span>
                                )}
                                <span>{formatInrDisplayString(prod.price, selectedCountry, fx)}</span>
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2. DESKTOP ONLY: Preserved Luxury 660x857 Slide (Only on sm and above) */}
                  <div className="img-box hidden sm:block relative w-[660px] max-w-[660px] h-[857px] rounded-sm overflow-hidden shadow-2xl bg-neutral-900">
                    {/* Background Model Image */}
                    <img
                      src={look.modelImage}
                      alt={look.title}
                      style={{ objectPosition: `${look.focalX ?? 50}% ${look.focalY ?? 25}%` }}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out"
                      loading={Math.abs(idx - slideIndex) <= 1 ? 'eager' : 'lazy'}
                    />

                    {/* Gradient Overlay for Crisp Text Contrast */}
                    <div
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        isActive
                          ? 'bg-gradient-to-t from-black/90 via-black/35 to-black/25 pointer-events-none'
                          : 'bg-black/40 hover:bg-black/20 pointer-events-none'
                      }`}
                    />

                    {/* Interactive Content (Visible on active slide) */}
                    <div className={`transition-opacity duration-500 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                      {/* Center Brand / Collection Title */}
                      <div className="absolute top-[36%] sm:top-[40%] left-0 right-0 text-center px-6 z-10 pointer-events-none">
                        <h3 className="brand-look-title text-[26px] sm:text-[38px] font-semibold tracking-[0.16em] text-white uppercase font-montserrat drop-shadow-md leading-tight">
                          {look.title}
                        </h3>
                        {look.subtitle && (
                          <p className="mt-2 text-[11px] sm:text-xs text-white/80 tracking-[0.12em] uppercase font-montserrat drop-shadow">
                            {look.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Bottom Row of Shoppable Product Cards */}
                      <div className="absolute bottom-5 sm:bottom-7 left-0 right-0 flex justify-center px-3 sm:px-6 z-10">
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-[15px] max-w-[550px] w-full">
                          {look.products.slice(0, 3).map((prod) => (
                            <a
                              key={prod.id}
                              href={prod.link}
                              className="style-layering-prod-card block text-left"
                            >
                              {/* White Product Image Container - 173x230.78 */}
                              <div className="style-layering-prod-img-box relative w-full sm:w-[173px] h-auto sm:h-[230.78px] aspect-[173/230.78] bg-white rounded-sm overflow-hidden mb-2 shadow-sm">
                                <img
                                  src={prod.image}
                                  alt={prod.title}
                                  className="w-full h-full sm:w-[173px] sm:h-[230.78px] object-cover object-center"
                                  loading={isActive ? 'eager' : 'lazy'}
                                />
                                {/* Wishlist Button inside Image */}
                                <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 z-10">
                                  <WishlistButton
                                    item={{
                                      id: prod.slug || prod.id,
                                      slug: prod.slug,
                                      title: prod.title,
                                      price: prod.price,
                                      priceNum: prod.priceNum,
                                      image: prod.image,
                                      link: prod.link,
                                    }}
                                    className="style-layering-wishlist-btn p-1 bg-transparent hover:bg-transparent text-neutral-400 hover:text-black shadow-none"
                                  />
                                </div>
                              </div>

                              {/* Title & Pricing directly below Image */}
                              <div className="px-0.5 pt-0.5">
                                <p className="text-[11px] sm:text-[12px] font-medium text-white truncate tracking-tight font-montserrat mb-0.5">
                                  {prod.title}
                                </p>
                                {prod.originalPrice && (
                                  <p className="text-[10px] sm:text-[11px] text-white/50 line-through font-montserrat leading-none mb-1">
                                    {formatInrDisplayString(prod.originalPrice, selectedCountry, fx)}
                                  </p>
                                )}
                                <p className="text-[11px] sm:text-[12px] font-montserrat leading-none flex items-center gap-1.5">
                                  {prod.discount && (
                                    <span className="text-[#ff4d4f] font-bold">
                                      {prod.discount}
                                    </span>
                                  )}
                                  <span className="text-white font-semibold">
                                    {formatInrDisplayString(prod.price, selectedCountry, fx)}
                                  </span>
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Arrows on Left and Right Side - Transparent & Enlarged */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Look"
            className="style-layering-nav-btn absolute left-2 sm:left-4 xl:left-[calc(50%-667px+12px)] top-[190px] sm:top-1/2 -translate-y-1/2 z-30 w-[48px] h-[64px] bg-transparent hover:bg-transparent text-white/90 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer select-none p-0 border-0 outline-none shadow-none"
            style={{ background: 'transparent' }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[36px] h-[36px] sm:w-[48px] sm:h-[48px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
            >
              <polyline points="15 19 8 12 15 5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Next Look"
            className="style-layering-nav-btn absolute right-2 sm:right-4 xl:right-[calc(50%-667px+12px)] top-[190px] sm:top-1/2 -translate-y-1/2 z-30 w-[48px] h-[64px] bg-transparent hover:bg-transparent text-white/90 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer select-none p-0 border-0 outline-none shadow-none"
            style={{ background: 'transparent' }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[36px] h-[36px] sm:w-[48px] sm:h-[48px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
            >
              <polyline points="9 19 16 12 9 5" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default StyleLayering;
