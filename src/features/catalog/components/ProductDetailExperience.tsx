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
      {/* Split-screen PDP Grid */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12 lg:pt-6 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-start">
          {/* Left Column: Image Gallery (2-column on desktop, carousel on mobile) */}
          <div className="w-full lg:col-span-7 xl:col-span-8">
            <ProductGallery
              images={galleryImages}
              title={product.title}
              onOpenLightbox={handleOpenLightbox}
            />
          </div>

          {/* Right Column: Sticky Purchase Panel */}
          <div className="w-full lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 pt-2">
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
