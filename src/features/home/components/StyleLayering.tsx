import React, { useState, useEffect, useRef } from 'react';
import { WishlistButton } from '../../wishlist/components/WishlistButton';

export interface LayeredProduct {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: string;
  priceNum: number;
  originalPrice: string;
  discount: string;
  link: string;
}

export interface LayeredLook {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  modelImage: string;
  products: LayeredProduct[];
}

export const STYLE_LAYERING_LOOKS: LayeredLook[] = [
  {
    id: 'avandress',
    title: 'AVANDRESS',
    subtitle: 'Classic Two-Tuck Wide Slacks & Layered Pigment Essentials',
    ctaText: 'Shop Now',
    ctaLink: '/categories/trousers',
    modelImage: '/images/news-1-model.jpg',
    products: [
      {
        id: 'classic-two-tuck-wide-slacks',
        slug: 'cady-trousers',
        title: 'Classic Two-Tuck Wide...',
        image: '/images/cady-trousers-product.jpg',
        originalPrice: '$84',
        discount: '15%',
        price: '$71',
        priceNum: 71,
        link: '/products/cady-trousers'
      },
      {
        id: 'r-pigment-hoodie-2',
        slug: 'artisanal-ribbed-cashmere-zip-sweater',
        title: 'R Pigment Hoodie _ 2...',
        image: '/images/mastery-1-product.jpg',
        originalPrice: '$119',
        discount: '38%',
        price: '$74',
        priceNum: 74,
        link: '/products/artisanal-ribbed-cashmere-zip-sweater'
      },
      {
        id: 'aachen-windbreaker-jacket',
        slug: 'stand-collar-virgin-wool-tailored-car-coat',
        title: 'Aachen Windbreaker Jump...',
        image: '/images/news-1-product.jpg',
        originalPrice: '$135',
        discount: '10%',
        price: '$122',
        priceNum: 122,
        link: '/products/stand-collar-virgin-wool-tailored-car-coat'
      }
    ]
  },
  {
    id: 'ambler',
    title: 'AMBLER',
    subtitle: 'Oversized Streetwear & Graphic Embroidered Knitwear',
    ctaText: 'Shop Now',
    ctaLink: '/categories/hoodies',
    modelImage: '/images/mastery-men-2.jpg',
    products: [
      {
        id: 'ambler-embroidery-hoodie',
        slug: 'merino-wool-ribbed-turtleneck',
        title: 'Embroidered Heavy Hoodie',
        image: '/images/mastery-2-product.jpg',
        originalPrice: '$128',
        discount: '25%',
        price: '$96',
        priceNum: 96,
        link: '/products/merino-wool-ribbed-turtleneck'
      },
      {
        id: 'ambler-sweatpants',
        slug: 'cady-trousers',
        title: 'Relaxed Pigment Joggers',
        image: '/images/cady-trousers-swatch.jpg',
        originalPrice: '$92',
        discount: '20%',
        price: '$74',
        priceNum: 74,
        link: '/products/cady-trousers'
      },
      {
        id: 'ambler-beanie',
        slug: 'cashmere-blend-ribbed-beanie',
        title: 'Ribbed Knit Skull Beanie',
        image: '/images/news-2-product.jpg',
        originalPrice: '$45',
        discount: '15%',
        price: '$38',
        priceNum: 38,
        link: '/products/cashmere-blend-ribbed-beanie'
      }
    ]
  },
  {
    id: 'minimal-project',
    title: 'MINIMAL PROJECT',
    subtitle: 'Technical Outerwear & Utility Pocket Silhouettes',
    ctaText: 'Shop Now',
    ctaLink: '/categories/outerwear',
    modelImage: '/images/mastery-men-1.jpg',
    products: [
      {
        id: 'minimal-hooded-parka',
        slug: 'minimalist-cotton-twill-tailored-trench-coat',
        title: 'Technical Utility Parka',
        image: '/images/news-3-product.jpg',
        originalPrice: '$180',
        discount: '20%',
        price: '$144',
        priceNum: 144,
        link: '/products/minimalist-cotton-twill-tailored-trench-coat'
      },
      {
        id: 'minimal-cargo-pants',
        slug: 'pleated-high-rise-wool-trousers',
        title: 'Multi-Pocket Cargo Pants',
        image: '/images/mastery-3-product.jpg',
        originalPrice: '$98',
        discount: '18%',
        price: '$80',
        priceNum: 80,
        link: '/products/pleated-high-rise-wool-trousers'
      },
      {
        id: 'minimal-chelsea-boot',
        slug: 'handcrafted-burnished-calfskin-ankle-boots',
        title: 'Commuter Ankle Boot',
        image: '/images/mastery-4-product.jpg',
        originalPrice: '$165',
        discount: '15%',
        price: '$140',
        priceNum: 140,
        link: '/products/handcrafted-burnished-calfskin-ankle-boots'
      }
    ]
  },
  {
    id: 'basemoment',
    title: 'BASEMOMENT',
    subtitle: 'Relaxed Daily Cotton & Structural Basics',
    ctaText: 'Shop Now',
    ctaLink: '/categories/clothing',
    modelImage: '/images/mastery-men-3.jpg',
    products: [
      {
        id: 'base-heavy-crewneck',
        slug: 'ribbed-cashmere-crewneck-knit-sweater',
        title: 'Heavy Cotton Crewneck',
        image: '/images/style-3-product.jpg',
        originalPrice: '$78',
        discount: '20%',
        price: '$62',
        priceNum: 62,
        link: '/products/ribbed-cashmere-crewneck-knit-sweater'
      },
      {
        id: 'base-wide-denim',
        slug: 'cady-trousers',
        title: 'Vintage Washed Wide Denim',
        image: '/images/style-2-product.jpg',
        originalPrice: '$105',
        discount: '15%',
        price: '$89',
        priceNum: 89,
        link: '/products/cady-trousers'
      },
      {
        id: 'base-leather-loafer',
        slug: 'hand-stitched-suede-loafer',
        title: 'Everyday Leather Loafer',
        image: '/images/style-4-product.jpg',
        originalPrice: '$145',
        discount: '12%',
        price: '$128',
        priceNum: 128,
        link: '/products/hand-stitched-suede-loafer'
      }
    ]
  },
  {
    id: 'theweather',
    title: 'THEWEATHER#&SOMETHING',
    subtitle: 'All-Weather Tech Shells & Windproof Layering',
    ctaText: 'Shop Now',
    ctaLink: '/categories/overcoats',
    modelImage: '/images/news-2-model.jpg',
    products: [
      {
        id: 'weather-shell-jacket',
        slug: 'stand-collar-virgin-wool-tailored-car-coat',
        title: 'Stormproof Modular Shell',
        image: '/images/news-2-product.jpg',
        originalPrice: '$195',
        discount: '22%',
        price: '$152',
        priceNum: 152,
        link: '/products/stand-collar-virgin-wool-tailored-car-coat'
      },
      {
        id: 'weather-tech-pants',
        slug: 'pleated-high-rise-wool-trousers',
        title: 'Waterproof Stretch Slacks',
        image: '/images/news-4-product.jpg',
        originalPrice: '$110',
        discount: '15%',
        price: '$93',
        priceNum: 93,
        link: '/products/pleated-high-rise-wool-trousers'
      },
      {
        id: 'weather-crossbody-bag',
        slug: 'handcrafted-tuscan-leather-travel-weekender',
        title: 'Weatherproof Tactical Sling',
        image: '/images/style-5-product.jpg',
        originalPrice: '$68',
        discount: '10%',
        price: '$61',
        priceNum: 61,
        link: '/products/handcrafted-tuscan-leather-travel-weekender'
      }
    ]
  },
  {
    id: 'search410',
    title: 'SEARCH410',
    subtitle: 'Subtle Distressed Details & Modern Street Cuts',
    ctaText: 'Shop Now',
    ctaLink: '/categories/denim-sweatshirts',
    modelImage: '/images/news-4-model.jpg',
    products: [
      {
        id: 'search-distressed-sweatshirt',
        slug: 'artisanal-ribbed-cashmere-zip-sweater',
        title: 'Faded Arch Sweatshirt',
        image: '/images/mastery-5-product.jpg',
        originalPrice: '$94',
        discount: '30%',
        price: '$65',
        priceNum: 65,
        link: '/products/artisanal-ribbed-cashmere-zip-sweater'
      },
      {
        id: 'search-skater-chinos',
        slug: 'cady-trousers',
        title: 'Baggy Skater Chinos',
        image: '/images/cady-trousers-detail.jpg',
        originalPrice: '$86',
        discount: '15%',
        price: '$73',
        priceNum: 73,
        link: '/products/cady-trousers'
      },
      {
        id: 'search-canvas-cap',
        slug: 'cashmere-blend-ribbed-beanie',
        title: 'Embroidered Cotton Cap',
        image: '/images/news-5-product.jpg',
        originalPrice: '$42',
        discount: '10%',
        price: '$38',
        priceNum: 38,
        link: '/products/cashmere-blend-ribbed-beanie'
      }
    ]
  },
  {
    id: 'maintain',
    title: 'MAINTAIN',
    subtitle: 'Contemporary Clean Lines & Minimal Palette',
    ctaText: 'Shop Now',
    ctaLink: '/categories/shirts',
    modelImage: '/images/style-1-model.jpg',
    products: [
      {
        id: 'maintain-oxford-shirt',
        slug: 'sartorial-poplin-and-twill-dress-shirts-trio',
        title: 'Boxy Poplin Overshirt',
        image: '/images/mastery-3-product.jpg',
        originalPrice: '$88',
        discount: '18%',
        price: '$72',
        priceNum: 72,
        link: '/products/sartorial-poplin-and-twill-dress-shirts-trio'
      },
      {
        id: 'maintain-tailored-shorts',
        slug: 'cady-trousers',
        title: 'Tailored Pleated Bermudas',
        image: '/images/cady-trousers-waist.jpg',
        originalPrice: '$75',
        discount: '15%',
        price: '$63',
        priceNum: 63,
        link: '/products/cady-trousers'
      },
      {
        id: 'maintain-leather-mule',
        slug: 'nappa-leather-chelsea-flat',
        title: 'Minimalist Nappa Flat',
        image: '/images/news-4-product.jpg',
        originalPrice: '$135',
        discount: '12%',
        price: '$118',
        priceNum: 118,
        link: '/products/nappa-leather-chelsea-flat'
      }
    ]
  },
  {
    id: 'mathematik',
    title: 'MATHEMATIK',
    subtitle: 'Functional Bags & Ergonomic Commuter Accents',
    ctaText: 'Shop Now',
    ctaLink: '/categories/accessories',
    modelImage: '/images/style-5-model.jpg',
    products: [
      {
        id: 'math-backpack',
        slug: 'handcrafted-tuscan-leather-travel-weekender',
        title: 'Ergonomic Commuter Pack',
        image: '/images/style-5-product.jpg',
        originalPrice: '$140',
        discount: '20%',
        price: '$112',
        priceNum: 112,
        link: '/products/handcrafted-tuscan-leather-travel-weekender'
      },
      {
        id: 'math-messenger',
        slug: 'handcrafted-tuscan-leather-travel-weekender',
        title: 'Waterproof Messenger Bag',
        image: '/images/style-1-product.jpg',
        originalPrice: '$115',
        discount: '15%',
        price: '$97',
        priceNum: 97,
        link: '/products/handcrafted-tuscan-leather-travel-weekender'
      },
      {
        id: 'math-wallet',
        slug: 'round-polarized-sunglasses-on-carrara-marble',
        title: 'Modular Zip Coin Card Case',
        image: '/images/news-5-product.jpg',
        originalPrice: '$55',
        discount: '10%',
        price: '$49',
        priceNum: 49,
        link: '/products/round-polarized-sunglasses-on-carrara-marble'
      }
    ]
  }
];

export const StyleLayering: React.FC = () => {
  const looks = STYLE_LAYERING_LOOKS;
  const LOOKS_COUNT = looks.length;
  // Triple the looks array for infinite looping: [0..7, 8..15 (middle original), 16..23]
  const TRIPLED_LOOKS = React.useMemo(() => [...looks, ...looks, ...looks], [looks]);

  // Start at index LOOKS_COUNT (index 8, the first item of the middle set)
  const [slideIndex, setSlideIndex] = useState<number>(LOOKS_COUNT);
  const [withTransition, setWithTransition] = useState<boolean>(true);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

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
        behavior: 'smooth'
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
              STYLE LAYERING
            </h2>
          </div>
          <a href="/categories" className="mastery-view-all">
            Shop All Looks
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
              className={`text-[13px] sm:text-[14px] uppercase tracking-[0.14em] font-montserrat whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                activeBrandIndex === idx
                  ? 'text-black font-semibold border-b-2 border-black pb-0.5'
                  : 'text-neutral-400 hover:text-black font-normal pb-0.5'
              }`}
            >
              {look.title}
            </button>
          ))}
        </div>

        {/* Continuous Animated Swiper Track - 660x881 each slide, gap 14px */}
        <div
          className="relative w-full overflow-hidden min-h-[640px] sm:min-h-[881px]"
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
                : 'none'
            }}
          >
            {TRIPLED_LOOKS.map((look, idx) => {
              const isActive = idx === slideIndex;
              const uniqueKey = `${look.id}-${idx}`;
              return (
                <div
                  key={uniqueKey}
                  onClick={() => handleSlideClick(idx)}
                  className={`swiper-slide relative w-[90vw] sm:w-[660px] max-w-[660px] h-[640px] sm:h-[881px] flex-shrink-0 flex flex-col items-center select-none transition-opacity duration-500 ${
                    isActive ? 'swiper-slide-active cursor-default' : 'cursor-pointer opacity-50 hover:opacity-75'
                  }`}
                >
                  <div className="img-box relative w-full sm:w-[660px] max-w-[660px] h-[640px] sm:h-[857px] rounded-sm overflow-hidden shadow-2xl bg-neutral-900">
                    {/* Background Model Image */}
                    <img
                      src={look.modelImage}
                      alt={look.title}
                      className="w-full h-full object-cover object-top transition-transform duration-700 ease-out"
                      loading={Math.abs(idx - slideIndex) <= 1 ? "eager" : "lazy"}
                    />

                    {/* Gradient Overlay for Crisp Text Contrast */}
                    <div className={`absolute inset-0 transition-opacity duration-500 ${
                      isActive
                        ? 'bg-gradient-to-t from-black/90 via-black/35 to-black/25 pointer-events-none'
                        : 'bg-black/40 hover:bg-black/20 pointer-events-none'
                    }`} />

                    {/* Interactive Content (Visible on active slide) */}
                    <div className={`transition-opacity duration-500 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                      {/* Center Brand / Collection Title & Shop Now CTA */}
                      <div className="absolute top-[38%] sm:top-[42%] left-0 right-0 text-center px-6 z-10">
                        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[0.16em] text-white uppercase font-montserrat drop-shadow-md mb-2">
                          {look.title}
                        </h3>
                        <a
                          href={look.ctaLink}
                          className="inline-block text-[13px] sm:text-[14px] tracking-[0.12em] text-white/95 uppercase underline underline-offset-4 hover:text-white transition-opacity font-montserrat"
                        >
                          {look.ctaText}
                        </a>
                      </div>

                      {/* Bottom Row of 3 Shoppable Product Cards */}
                      <div className="absolute bottom-5 sm:bottom-7 left-0 right-0 flex justify-center px-3 sm:px-6 z-10">
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-[15px] max-w-[550px] w-full">
                          {look.products.map((prod) => (
                            <a
                              key={prod.id}
                              href={prod.link}
                              className="group block text-left transition-transform duration-300 hover:-translate-y-1"
                            >
                              {/* White Product Image Container - 173x230.78 */}
                              <div className="style-layering-prod-img-box relative w-full sm:w-[173px] h-auto sm:h-[230.78px] aspect-[173/230.78] bg-white rounded-sm overflow-hidden mb-2 shadow-sm">
                                <img
                                  src={prod.image}
                                  alt={prod.title}
                                  className="w-full h-full sm:w-[173px] sm:h-[230.78px] object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                  loading={isActive ? "eager" : "lazy"}
                                />
                                {/* Wishlist Button inside Image */}
                                <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 z-10">
                                  <WishlistButton
                                    item={{
                                      id: prod.id,
                                      title: prod.title,
                                      price: prod.price,
                                      priceNum: prod.priceNum,
                                      image: prod.image,
                                      link: prod.link
                                    }}
                                    className="p-1 rounded-full bg-white/80 hover:bg-white text-neutral-600 hover:text-black shadow-sm"
                                  />
                                </div>
                              </div>

                              {/* Title & Pricing directly below Image */}
                              <div className="px-0.5 pt-0.5">
                                <p className="text-[11px] sm:text-[12px] font-medium text-white truncate tracking-tight font-montserrat mb-0.5">
                                  {prod.title}
                                </p>
                                <p className="text-[10px] sm:text-[11px] text-white/50 line-through font-montserrat leading-none mb-1">
                                  {prod.originalPrice}
                                </p>
                                <p className="text-[11px] sm:text-[12px] font-montserrat leading-none flex items-center gap-1.5">
                                  <span className="text-[#ff4d4f] font-bold">
                                    {prod.discount}
                                  </span>
                                  <span className="text-white font-semibold">
                                    {prod.price}
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

          {/* Navigation Arrows positioned over Side Peek Panels */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Look"
            className="absolute left-2 sm:left-4 lg:left-[calc(50%-330px-52px)] top-1/2 -translate-y-1/2 z-30 text-white/90 hover:text-white hover:scale-110 flex items-center justify-center transition-all duration-200 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <svg width="26" height="42" viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 32 6 20 18 8" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Next Look"
            className="absolute right-2 sm:right-4 lg:right-[calc(50%-330px-52px)] top-1/2 -translate-y-1/2 z-30 text-white/90 hover:text-white hover:scale-110 flex items-center justify-center transition-all duration-200 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <svg width="26" height="42" viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 32 18 20 6 8" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default StyleLayering;
