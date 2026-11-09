import React, { useState } from 'react';

interface ProductGalleryProps {
  images: string[];
  title: string;
  onOpenLightbox: (index: number) => void;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images,
  title,
  onOpenLightbox
}) => {
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-[3/4] bg-[#f5f3ee] flex items-center justify-center text-neutral-400">
        No image available
      </div>
    );
  }

  const handleMobileScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    if (width > 0) {
      const index = Math.round(scrollLeft / width);
      setActiveMobileIndex(index);
    }
  };

  return (
    <div className="w-full">
      {/* Mobile Swipeable Carousel (< md) */}
      <div className="block md:hidden relative w-full">
        <div
          onScroll={handleMobileScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-full snap-center bg-[#f5f3ee] relative aspect-[3/4.4] cursor-pointer"
              onClick={() => onOpenLightbox(idx)}
            >
              <img
                src={img}
                alt={`${title} - view ${idx + 1}`}
                className="w-full h-full object-cover object-center"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* Floating Mobile Counter Badge */}
        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[11px] font-mono tracking-wider">
            {activeMobileIndex + 1} / {images.length}
          </div>
        )}

        {/* Mobile Pagination Dots */}
        {images.length > 1 && (
          <div className="flex justify-center items-center gap-1.5 py-3">
            {images.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeMobileIndex === idx
                    ? 'w-6 bg-neutral-900'
                    : 'w-1.5 bg-neutral-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop 2-Column Luxury Grid (>= md) */}
      <div className="hidden md:grid md:grid-cols-2 gap-3 lg:gap-4 w-full">
        {images.map((img, idx) => {
          // If total images is odd and this is the last image, let it span 1 column or 2 columns based on editorial balance
          const isFullWidthDetail = images.length % 2 === 1 && idx === images.length - 1;
          return (
            <div
              key={idx}
              onClick={() => onOpenLightbox(idx)}
              className={`group relative bg-[#f5f3ee] overflow-hidden cursor-zoom-in transition-all duration-300 aspect-[3/4.4] ${
                isFullWidthDetail ? 'md:col-span-1' : ''
              }`}
            >
              <img
                src={img}
                alt={`${title} - view ${idx + 1}`}
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                loading={idx < 2 ? 'eager' : 'lazy'}
              />

              {/* Subtle hover zoom prompt */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm text-neutral-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

