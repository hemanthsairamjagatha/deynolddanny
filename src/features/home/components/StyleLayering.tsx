import React, { useState } from 'react';
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
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const looks = STYLE_LAYERING_LOOKS;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + looks.length) % looks.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % looks.length);
  };

  const currentLook = looks[activeIndex];
  const prevLook = looks[(activeIndex - 1 + looks.length) % looks.length];
  const nextLook = looks[(activeIndex + 1) % looks.length];

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

      {/* Lookbook 3-Panel Center-Mode Slider - 1334x929 Swiper Container */}
      <div className="brand-swiper2 swiper inner-box brand-swiper2-0 swiper-initialized swiper-horizontal relative w-full max-w-[1334px] mx-auto px-2 sm:px-4 lg:px-0 mt-4 overflow-hidden">
        {/* Brand Navigation Tabs Row */}
        <div className="brand-nav-bar flex items-center justify-start lg:justify-center gap-6 sm:gap-8 overflow-x-auto hide-scrollbar px-4 py-2.5 mb-3 select-none">
          {looks.map((look, idx) => (
            <button
              key={look.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`text-[13px] sm:text-[14px] uppercase tracking-[0.14em] font-montserrat whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                activeIndex === idx
                  ? 'text-black font-semibold border-b-2 border-black pb-0.5'
                  : 'text-neutral-400 hover:text-black font-normal pb-0.5'
              }`}
            >
              {look.title}
            </button>
          ))}
        </div>

        {/* 3-Panel Center-Mode Slider */}
        <div className="relative flex items-center justify-center gap-3 sm:gap-[14px] min-h-[640px] sm:min-h-[760px] lg:min-h-[857px]">
          {/* Previous Look (Left Peek) */}
          <div
            onClick={handlePrev}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handlePrev()}
            aria-label={`View previous look: ${prevLook.title}`}
            className="hidden md:block relative w-[280px] lg:w-[323px] h-[680px] lg:h-[857px] rounded-sm overflow-hidden flex-shrink-0 cursor-pointer opacity-40 hover:opacity-65 transition-opacity duration-300 shadow-md select-none"
          >
            <img
              src={prevLook.modelImage}
              alt={prevLook.title}
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Active Center Lookbook Card */}
          <div className="img-box relative w-full sm:w-[660px] max-w-[660px] h-[640px] sm:h-[760px] lg:h-[857px] rounded-sm overflow-hidden flex-shrink-0 shadow-2xl bg-neutral-900 select-none">
            {/* Background Model Image */}
            <img
              src={currentLook.modelImage}
              alt={currentLook.title}
              className="w-full h-full object-cover object-top transition-transform duration-700 ease-out"
              loading="eager"
            />

            {/* Gradient Overlay for Crisp Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/25 pointer-events-none" />

            {/* Navigation Arrows positioned over Center Card Edges */}
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Look"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-black text-white flex items-center justify-center backdrop-blur-sm transition-all duration-200 shadow-lg cursor-pointer border border-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Look"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-black text-white flex items-center justify-center backdrop-blur-sm transition-all duration-200 shadow-lg cursor-pointer border border-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Center Brand / Collection Title & Shop Now CTA */}
            <div className="absolute top-[38%] sm:top-[42%] left-0 right-0 text-center px-6 z-10">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[0.16em] text-white uppercase font-montserrat drop-shadow-md mb-2">
                {currentLook.title}
              </h3>
              <a
                href={currentLook.ctaLink}
                className="inline-block text-[13px] sm:text-[14px] tracking-[0.12em] text-white/95 uppercase underline underline-offset-4 hover:text-white transition-opacity font-montserrat"
              >
                {currentLook.ctaText}
              </a>
            </div>

            {/* Bottom Row of 3 Shoppable Product Cards */}
            <div className="absolute bottom-5 sm:bottom-7 left-0 right-0 flex justify-center px-3 sm:px-6 z-10">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-[15px] max-w-[550px] w-full">
                {currentLook.products.map((prod) => (
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
                        loading="lazy"
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

          {/* Next Look (Right Peek) */}
          <div
            onClick={handleNext}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            aria-label={`View next look: ${nextLook.title}`}
            className="hidden md:block relative w-[280px] lg:w-[323px] h-[680px] lg:h-[857px] rounded-sm overflow-hidden flex-shrink-0 cursor-pointer opacity-40 hover:opacity-65 transition-opacity duration-300 shadow-md select-none"
          >
            <img
              src={nextLook.modelImage}
              alt={nextLook.title}
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default StyleLayering;
