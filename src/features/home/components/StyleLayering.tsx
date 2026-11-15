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
    id: 'sartorial-cashmere',
    title: 'SARTORIAL CASHMERE',
    subtitle: 'Stand-Collar Double Cashmere & Tailored Pleats',
    ctaText: 'Shop Now',
    ctaLink: '/categories/overcoats',
    modelImage: '/images/news-1-model.jpg',
    products: [
      {
        id: 'cady-trousers',
        slug: 'cady-trousers',
        title: 'Cady Tailored Trousers',
        image: '/images/cady-trousers-product.jpg',
        originalPrice: '₹ 4,000',
        discount: '20%',
        price: '₹ 3,200',
        priceNum: 32000,
        link: '/products/cady-trousers'
      },
      {
        id: 'artisanal-cashmere-sweater',
        slug: 'artisanal-ribbed-cashmere-zip-sweater',
        title: 'Artisanal Cashmere Sweater',
        image: '/images/mastery-1-product.jpg',
        originalPrice: '₹ 3,000',
        discount: '18%',
        price: '₹ 2,450',
        priceNum: 24500,
        link: '/products/artisanal-ribbed-cashmere-zip-sweater'
      },
      {
        id: 'stand-collar-car-coat',
        slug: 'stand-collar-virgin-wool-tailored-car-coat',
        title: 'Stand-Collar Car Coat',
        image: '/images/news-1-product.jpg',
        originalPrice: '₹ 6,500',
        discount: '20%',
        price: '₹ 5,200',
        priceNum: 52000,
        link: '/products/stand-collar-virgin-wool-tailored-car-coat'
      }
    ]
  },
  {
    id: 'minimalist-tailoring',
    title: 'MINIMALIST TAILORING',
    subtitle: 'Virgin Wool Chalk Stripe & Poplin Atelier',
    ctaText: 'Shop Now',
    ctaLink: '/categories/tailoring',
    modelImage: '/images/news-3-model.jpg',
    products: [
      {
        id: 'tailored-virgin-wool-suit',
        slug: 'tailored-virgin-wool-suit',
        title: 'Chalk Stripe Wool Suit',
        image: '/images/news-3-product.jpg',
        originalPrice: '₹ 8,000',
        discount: '15%',
        price: '₹ 6,800',
        priceNum: 68000,
        link: '/products/tailored-virgin-wool-suit'
      },
      {
        id: 'artisanal-poplin-shirt',
        slug: 'sartorial-poplin-and-twill-dress-shirts-trio',
        title: 'Linen Poplin Shirt',
        image: '/images/mastery-3-product.jpg',
        originalPrice: '₹ 2,200',
        discount: '16%',
        price: '₹ 1,850',
        priceNum: 18500,
        link: '/products/sartorial-poplin-and-twill-dress-shirts-trio'
      },
      {
        id: 'hand-burnished-oxford',
        slug: 'hand-burnished-artisanal-calfskin-oxford-shoes',
        title: 'Burnished Oxford Shoe',
        image: '/images/mastery-4-product.jpg',
        originalPrice: '₹ 3,500',
        discount: '17%',
        price: '₹ 2,900',
        priceNum: 29000,
        link: '/products/hand-burnished-artisanal-calfskin-oxford-shoes'
      }
    ]
  },
  {
    id: 'urban-textures',
    title: 'URBAN TEXTURES',
    subtitle: 'Double Cloth Coat & Seamless Cashmere',
    ctaText: 'Shop Now',
    ctaLink: '/categories/knitwear',
    modelImage: '/images/style-3-model.jpg',
    products: [
      {
        id: 'merino-wool-turtleneck',
        slug: 'merino-wool-ribbed-turtleneck',
        title: 'Seamless Ribbed Turtleneck',
        image: '/images/style-3-product.jpg',
        originalPrice: '₹ 2,600',
        discount: '15%',
        price: '₹ 2,200',
        priceNum: 22000,
        link: '/products/merino-wool-ribbed-turtleneck'
      },
      {
        id: 'double-cloth-coat',
        slug: 'stand-collar-virgin-wool-tailored-car-coat',
        title: 'Double Cloth Stand Coat',
        image: '/images/style-2-product.jpg',
        originalPrice: '₹ 5,400',
        discount: '15%',
        price: '₹ 4,600',
        priceNum: 46000,
        link: '/products/stand-collar-virgin-wool-tailored-car-coat'
      },
      {
        id: 'hand-stitched-suede-loafer',
        slug: 'hand-stitched-suede-loafer',
        title: 'Artisanal Suede Loafer',
        image: '/images/style-4-product.jpg',
        originalPrice: '₹ 3,300',
        discount: '15%',
        price: '₹ 2,800',
        priceNum: 28000,
        link: '/products/hand-stitched-suede-loafer'
      }
    ]
  },
  {
    id: 'atelier-accents',
    title: 'ATELIER ACCENTS',
    subtitle: 'Wool-Cashmere Overcoat & Horological Accents',
    ctaText: 'Shop Now',
    ctaLink: '/categories/accessories',
    modelImage: '/images/news-2-model.jpg',
    products: [
      {
        id: 'wool-cashmere-overcoat',
        slug: 'tailored-virgin-wool-overcoat-with-cashmere-scarf',
        title: 'Wool-Cashmere Overcoat',
        image: '/images/news-2-product.jpg',
        originalPrice: '₹ 6,800',
        discount: '15%',
        price: '₹ 5,800',
        priceNum: 58000,
        link: '/products/tailored-virgin-wool-overcoat-with-cashmere-scarf'
      },
      {
        id: 'tuscan-leather-weekender',
        slug: 'handcrafted-tuscan-leather-travel-weekender',
        title: 'Tuscan Leather Weekender',
        image: '/images/style-5-product.jpg',
        originalPrice: '₹ 6,400',
        discount: '15%',
        price: '₹ 5,400',
        priceNum: 54000,
        link: '/products/handcrafted-tuscan-leather-travel-weekender'
      },
      {
        id: 'automatic-chronograph-timepiece',
        slug: 'automatic-chronograph-timepiece-with-alligator-strap',
        title: 'Chronograph Timepiece',
        image: '/images/news-5-product.jpg',
        originalPrice: '₹ 8,500',
        discount: '15%',
        price: '₹ 7,200',
        priceNum: 72000,
        link: '/products/automatic-chronograph-timepiece-with-alligator-strap'
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

      {/* Lookbook 3-Panel Center-Mode Slider */}
      <div className="relative w-full max-w-[1520px] mx-auto px-2 sm:px-6 lg:px-8 mt-4 overflow-hidden">
        <div className="relative flex items-center justify-center gap-3 sm:gap-6 min-h-[520px] sm:min-h-[600px] lg:min-h-[640px]">
          {/* Previous Look (Left Peek) */}
          <div
            onClick={handlePrev}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handlePrev()}
            aria-label={`View previous look: ${prevLook.title}`}
            className="hidden md:block relative w-[240px] lg:w-[320px] h-[480px] lg:h-[560px] rounded-sm overflow-hidden flex-shrink-0 cursor-pointer opacity-40 hover:opacity-65 transition-opacity duration-300 shadow-md select-none"
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
          <div className="relative w-full max-w-[620px] lg:max-w-[680px] h-[540px] sm:h-[600px] lg:h-[640px] rounded-sm overflow-hidden flex-shrink-0 shadow-2xl bg-neutral-900 select-none">
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
            <div className="absolute top-[20%] sm:top-[22%] left-0 right-0 text-center px-6 z-10">
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
            <div className="absolute bottom-4 sm:bottom-6 left-3 sm:left-6 right-3 sm:right-6 z-10">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                {currentLook.products.map((prod) => (
                  <a
                    key={prod.id}
                    href={prod.link}
                    className="group block text-left transition-transform duration-300 hover:-translate-y-1"
                  >
                    {/* Square White Product Image Container */}
                    <div className="relative aspect-square bg-white rounded-sm overflow-hidden mb-2 shadow-sm">
                      <img
                        src={prod.image}
                        alt={prod.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
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
                    <div className="px-0.5">
                      <p className="text-[11px] sm:text-[12px] font-medium text-white truncate tracking-tight font-montserrat mb-0.5">
                        {prod.title}
                      </p>
                      <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-montserrat leading-tight">
                        <span className="text-white/50 line-through">
                          {prod.originalPrice}
                        </span>
                        <span className="text-[#ff4d4f] font-semibold">
                          {prod.discount}
                        </span>
                        <span className="text-white font-bold">
                          {prod.price}
                        </span>
                      </div>
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
            className="hidden md:block relative w-[240px] lg:w-[320px] h-[480px] lg:h-[560px] rounded-sm overflow-hidden flex-shrink-0 cursor-pointer opacity-40 hover:opacity-65 transition-opacity duration-300 shadow-md select-none"
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
