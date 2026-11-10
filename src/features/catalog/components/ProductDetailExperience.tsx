import React, { useState } from 'react';
import type { ProductCardData } from '../types/product.types';
import { ProductGallery } from './ProductGallery';
import { ProductPurchasePanel } from './ProductPurchasePanel';
import { ProductLightbox } from './ProductLightbox';
import { FitFinderDialog } from '../fit-finder/FitFinderDialog';
import { SizeGuideDialog } from '../size-guide/SizeGuideDialog';

interface ProductDetailExperienceProps {
  product: ProductCardData;
}

export const ProductDetailExperience: React.FC<ProductDetailExperienceProps> = ({ product }) => {
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [isFitFinderOpen, setIsFitFinderOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

  // Compute active images based on color or product default images
  const activeColor = product.colors && product.colors[selectedColorIndex];
  const galleryImages = (activeColor?.images && activeColor.images.length > 0)
    ? activeColor.images
    : (product.images && product.images.length > 0)
    ? product.images
    : [product.defaultImg, product.hoverImg].filter(Boolean);

  const handleOpenLightbox = (index: number) => {
    setLightboxInitialIndex(index);
    setIsLightboxOpen(true);
  };

  return (
    <div className="w-full">
      {/* Split-screen PDP Grid matching reference 1123.86px gallery and 396.93px purchase panel */}
      <div className="w-full max-w-[1521px] mx-auto">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-0">
          {/* Left Column: Image Gallery (2-column on desktop with 0 gap, carousel on mobile) */}
          <div className="w-full lg:w-[calc(100%-396.93px)] xl:w-[1123.86px] lg:flex-shrink-0">
            <ProductGallery
              images={galleryImages}
              title={product.title}
              onOpenLightbox={handleOpenLightbox}
            />
          </div>

          {/* Right Column: Sticky Purchase Panel (396.93px wide) */}
          <div className="w-full lg:w-[396.93px] lg:flex-shrink-0 lg:sticky lg:top-20">
            <ProductPurchasePanel
              product={product}
              selectedColorIndex={selectedColorIndex}
              onSelectColor={setSelectedColorIndex}
              selectedSize={selectedSize}
              onSelectSize={setSelectedSize}
              onOpenFitFinder={() => setIsFitFinderOpen(true)}
              onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <ProductLightbox
        isOpen={isLightboxOpen}
        images={galleryImages}
        initialIndex={lightboxInitialIndex}
        onClose={() => setIsLightboxOpen(false)}
        title={product.title}
      />

      {/* Fit Finder Dialog */}
      <FitFinderDialog
        isOpen={isFitFinderOpen}
        onClose={() => setIsFitFinderOpen(false)}
        availableSizes={product.sizes}
        productTitle={product.title}
        onApplySize={(size) => {
          setSelectedSize(size);
        }}
      />

      {/* Size Guide Dialog */}
      <SizeGuideDialog
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        productTitle={product.title}
      />
    </div>
  );
};
