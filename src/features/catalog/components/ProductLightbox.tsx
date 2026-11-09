import React, { useEffect, useState, useCallback } from 'react';

interface ProductLightboxProps {
  isOpen: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
  title: string;
}

export const ProductLightbox: React.FC<ProductLightboxProps> = ({
  isOpen,
  images,
  initialIndex,
  onClose,
  title
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, isOpen]);

  const handleNext = useCallback(() => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} image gallery fullscreen`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
    >
      {/* Top Bar with counter and close button */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 text-white z-20 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs uppercase tracking-widest font-mono text-neutral-300">
          {currentIndex + 1} / {images.length}
        </span>

        <button
          onClick={onClose}
          aria-label="Close fullscreen gallery"
          className="p-2 text-white hover:text-neutral-300 transition-colors focus:outline-none focus:ring-1 focus:ring-white rounded-full"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Prev / Next Buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-full transition-all focus:outline-none z-20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Next image"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-full transition-all focus:outline-none z-20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Main Image Container */}
      <div
        className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center p-4 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed((prev) => !prev);
        }}
      >
        <img
          src={images[currentIndex]}
          alt={`${title} - view ${currentIndex + 1}`}
          className={`max-h-[85vh] max-w-full object-contain transition-transform duration-300 select-none ${
            isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
          }`}
          draggable={false}
        />
      </div>
    </div>
  );
};

