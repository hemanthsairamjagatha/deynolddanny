import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import type { ProductCardData, ProductVariant } from '../types/product.types';
import { fetchProductBySlug } from '../api/catalog.api';
import { ProductCard } from './ProductCard';
import { ProductLightbox } from './ProductLightbox';
import { FitFinderDialog } from '../fit-finder/FitFinderDialog';
import { SizeGuideDialog } from '../size-guide/SizeGuideDialog';
import { addToCart, openCart } from '../../cart/store/cart.store';
import { WishlistButton } from '../../wishlist/components/WishlistButton';
import { apiFetch } from '../../../lib/api/client';
import { fetchStorefrontConfigApi } from '../../checkout/api/checkout.api';
import { ecommerceConfig } from '../../../config/ecommerce.config';
import { $fxSnapshot, $selectedCountry, formatInrDisplayString } from '../../../lib/currency/currency.store';

interface ProductDetailExperienceProps {
  product?: ProductCardData;
  liveSlug?: string;
}

interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  fitFeedback: 'runs_small' | 'true_to_size' | 'runs_large' | string;
  verifiedPurchase: boolean;
  isFeatured: boolean;
  adminReply: string | null;
  createdAt: string;
}

interface ReviewsPayload {
  summary: {
    count: number;
    averageRating: number;
    fitBreakdown: {
      runsSmall: number;
      trueToSize: number;
      runsLarge: number;
    };
  };
  items: ReviewItem[];
}

interface DetailAccordionProps {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const DetailAccordion: React.FC<DetailAccordionProps> = ({ id, title, isOpen, onToggle, children }) => (
  <div className="border-b border-neutral-200">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={id}
      className="w-full py-3.5 flex items-center justify-between text-left text-[14px] font-semibold text-black focus:outline-none focus-visible:ring-1 focus-visible:ring-black"
    >
      <span>{title}</span>
      <svg
        className={`w-4 h-4 text-black transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <div id={id} hidden={!isOpen} className="pb-4 space-y-2 text-[12px] leading-[1.65] text-neutral-800">
      {children}
    </div>
  </div>
);

function resolveSlugFromLocation(explicitSlug?: string, product?: ProductCardData): string {
  if (explicitSlug) return explicitSlug;
  if (product?.slug) return product.slug;
  if (product?.id) return product.id;
  if (typeof window !== 'undefined') {
    const clean = window.location.pathname.replace(/^\/products\//, '').replace(/\/+$/, '');
    if (clean && clean !== 'live') return decodeURIComponent(clean);
  }
  return '';
}

export const ProductDetailExperience: React.FC<ProductDetailExperienceProps> = ({
  product: initialProduct,
  liveSlug,
}) => {
  const selectedCountry = useStore($selectedCountry);
  const fx = useStore($fxSnapshot);

  const [liveProduct, setLiveProduct] = useState<ProductCardData | null>(initialProduct ?? null);
  const [isLoadingProduct, setIsLoadingProduct] = useState<boolean>(!initialProduct);
  const [notFound, setNotFound] = useState<boolean>(false);

  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [isFitFinderOpen, setIsFitFinderOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isCompositionOpen, setIsCompositionOpen] = useState(false);

  const [liveVariants, setLiveVariants] = useState<ProductVariant[]>(initialProduct?.variants || []);
  const [livePrice, setLivePrice] = useState<string>(initialProduct?.price || '₹ 0.00');
  const [livePriceNum, setLivePriceNum] = useState<number>(initialProduct?.priceNum || 0);
  const [hasVariantPricing, setHasVariantPricing] = useState<boolean>(false);
  const [minVariantPrice, setMinVariantPrice] = useState<string | null>(null);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(
    ecommerceConfig.freeShippingThreshold,
  );
  const [returnWindowDays, setReturnWindowDays] = useState<number>(14);
  const [enableFitFinder, setEnableFitFinder] = useState<boolean>(true);
  const [enableReviewsOnPdp, setEnableReviewsOnPdp] = useState<boolean>(true);

  // Live brand & PDP config tokens from Commerce OS
  const [showOriginBadge, setShowOriginBadge] = useState<boolean>(true);
  const [originBadgeText, setOriginBadgeText] = useState<string>('MADE IN INDIA');
  const [conciergeHeading, setConciergeHeading] = useState<string>(
    'For more information, contact us at',
  );
  const [conciergeEmail, setConciergeEmail] = useState<string>('concierge@deynolddanny.com');
  const [conciergePhone, setConciergePhone] = useState<string>('+91 11 4820 9000');
  const [atelierHours, setAtelierHours] = useState<string>(
    'Our customer service is available Monday to Saturday, 10:00 – 19:00 IST',
  );
  const [showExclusiveBanner, setShowExclusiveBanner] = useState<boolean>(true);
  const [exclusiveBannerText, setExclusiveBannerText] = useState<string>('Online exclusive');
  const [showSizeGuide, setShowSizeGuide] = useState<boolean>(true);
  const [styleItWithHeading, setStyleItWithHeading] = useState<string>('Style It With');
  const [relatedHeading, setRelatedHeading] = useState<string>('More Suggestions');
  const [reviewsHeading, setReviewsHeading] = useState<string>('Reviews');
  const [shippingNoticeText, setShippingNoticeText] = useState<string>('');
  const [returnNoticeText, setReturnNoticeText] = useState<string>('');

  // Reviews state
  const [reviewsData, setReviewsData] = useState<ReviewsPayload | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    authorName: '',
    authorEmail: '',
    rating: 5,
    fitFeedback: 'true_to_size' as 'runs_small' | 'true_to_size' | 'runs_large',
    title: '',
    body: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const galleryScrollRef = useRef<HTMLDivElement>(null);

  // Hydrate Brand / PDP settings from published bundle & Draft Preview
  useEffect(() => {
    const applyPdp = (pdp: Record<string, any> | undefined) => {
      if (!pdp || typeof pdp !== 'object') return;
      if (typeof pdp.showOriginBadge === 'boolean') {
        setShowOriginBadge(pdp.showOriginBadge);
      }
      if (typeof pdp.originBadgeText === 'string' && pdp.originBadgeText.trim()) {
        setOriginBadgeText(pdp.originBadgeText.trim());
      }
      if (typeof pdp.showExclusiveBanner === 'boolean') {
        setShowExclusiveBanner(pdp.showExclusiveBanner);
      }
      if (typeof pdp.exclusiveBannerText === 'string' && pdp.exclusiveBannerText.trim()) {
        setExclusiveBannerText(pdp.exclusiveBannerText.trim());
      }
      if (typeof pdp.showFitFinder === 'boolean') {
        setEnableFitFinder(pdp.showFitFinder);
      }
      if (typeof pdp.showSizeGuide === 'boolean') {
        setShowSizeGuide(pdp.showSizeGuide);
      }
      if (typeof pdp.showReviews === 'boolean') {
        setEnableReviewsOnPdp(pdp.showReviews);
      }
      if (typeof pdp.styleItWithHeading === 'string' && pdp.styleItWithHeading.trim()) {
        setStyleItWithHeading(pdp.styleItWithHeading.trim());
      }
      if (typeof pdp.relatedHeading === 'string' && pdp.relatedHeading.trim()) {
        setRelatedHeading(pdp.relatedHeading.trim());
      }
      if (typeof pdp.reviewsHeading === 'string' && pdp.reviewsHeading.trim()) {
        setReviewsHeading(pdp.reviewsHeading.trim());
      }
      if (typeof pdp.conciergeHeading === 'string' && pdp.conciergeHeading.trim()) {
        setConciergeHeading(pdp.conciergeHeading.trim());
      }
      if (typeof pdp.shippingNoticeText === 'string') {
        setShippingNoticeText(pdp.shippingNoticeText.trim());
      }
      if (typeof pdp.returnNoticeText === 'string') {
        setReturnNoticeText(pdp.returnNoticeText.trim());
      }
    };

    const applyBundle = (bundle: Record<string, any> | undefined) => {
      if (!bundle || typeof bundle !== 'object') return;
      const brand = bundle.brand as Record<string, any> | undefined;
      if (brand) {
        if (typeof brand.originBadgeText === 'string' && brand.originBadgeText.trim()) {
          setOriginBadgeText(brand.originBadgeText.trim());
        }
        if (typeof brand.conciergeEmail === 'string' && brand.conciergeEmail.trim()) {
          setConciergeEmail(brand.conciergeEmail.trim());
        }
        if (typeof brand.conciergePhone === 'string' && brand.conciergePhone.trim()) {
          setConciergePhone(brand.conciergePhone.trim());
        }
        if (typeof brand.atelierHours === 'string' && brand.atelierHours.trim()) {
          setAtelierHours(brand.atelierHours.trim());
        }
      }
      const cfg = bundle.storeConfig as Record<string, any> | undefined;
      if (cfg) {
        if (typeof cfg.enableFitFinder === 'boolean') setEnableFitFinder(cfg.enableFitFinder);
        if (typeof cfg.enableReviewsOnPdp === 'boolean') setEnableReviewsOnPdp(cfg.enableReviewsOnPdp);
        if (typeof cfg.pdpShowExclusiveBanner === 'boolean') {
          setShowExclusiveBanner(cfg.pdpShowExclusiveBanner);
        }
        if (typeof cfg.pdpExclusiveBannerText === 'string' && cfg.pdpExclusiveBannerText.trim()) {
          setExclusiveBannerText(cfg.pdpExclusiveBannerText.trim());
        }
      }
      applyPdp(bundle.pdpConfig as Record<string, any> | undefined);
    };

    const existing = (window as unknown as { __ddPublishedBundle?: Record<string, any> }).__ddPublishedBundle;
    if (existing) applyBundle(existing);

    const existingPdp = (window as unknown as { __ddPdpCms?: Record<string, any> }).__ddPdpCms;
    if (existingPdp) applyPdp(existingPdp);

    const onReady = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, any>>).detail;
      applyBundle(detail);
    };
    const onPdpUpdate = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, any>>).detail;
      applyPdp(detail);
    };
    window.addEventListener('dd:storefront-bundle-ready', onReady);
    window.addEventListener('dd:pdp-cms-update', onPdpUpdate);
    return () => {
      window.removeEventListener('dd:storefront-bundle-ready', onReady);
      window.removeEventListener('dd:pdp-cms-update', onPdpUpdate);
    };
  }, []);

  // Hydrate FULL live product, availability, storefront config, and reviews from D1
  useEffect(() => {
    const slug = resolveSlugFromLocation(liveSlug, initialProduct);
    if (!slug) {
      setIsLoadingProduct(false);
      setNotFound(true);
      return;
    }

    let active = true;

    fetchProductBySlug(slug)
      .then((fresh) => {
        if (!active) return;
        if (fresh) {
          setLiveProduct((prev) => ({
            ...(prev ?? ({} as ProductCardData)),
            ...fresh,
            // Keep rich static editorial fallbacks if D1 record omitted them
            sizeAndFit:
              fresh.sizeAndFit && fresh.sizeAndFit.length > 0 ? fresh.sizeAndFit : prev?.sizeAndFit,
            compositionAndCare:
              fresh.compositionAndCare && fresh.compositionAndCare.length > 0
                ? fresh.compositionAndCare
                : prev?.compositionAndCare,
            styleItWith:
              fresh.styleItWith && fresh.styleItWith.length > 0 ? fresh.styleItWith : prev?.styleItWith,
            relatedProducts:
              fresh.relatedProducts && fresh.relatedProducts.length > 0
                ? fresh.relatedProducts
                : prev?.relatedProducts,
          }));
          setLivePrice(fresh.price);
          setLivePriceNum(fresh.priceNum);
          if (fresh.variants && fresh.variants.length > 0) {
            setLiveVariants(fresh.variants);
          }
          if (typeof document !== 'undefined' && fresh.title) {
            document.title = `${fresh.title} | DEYNOLD DANNY`;
          }
          setNotFound(false);
        } else if (!initialProduct) {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!active) return;
        if (!initialProduct) setNotFound(true);
      })
      .finally(() => {
        if (active) setIsLoadingProduct(false);
      });

    apiFetch<{
      price?: string;
      pricePaise?: number;
      minPricePaise?: number;
      hasVariantPricing?: boolean;
      variants?: Array<any>;
    }>(`/api/products/${encodeURIComponent(slug)}/availability`, { skipAuthRefresh: true })
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        if (res.data.price) setLivePrice(res.data.price);
        if (typeof res.data.pricePaise === 'number') setLivePriceNum(Math.round(res.data.pricePaise / 100));
        if (res.data.hasVariantPricing) {
          setHasVariantPricing(true);
          if (typeof res.data.minPricePaise === 'number') {
            setMinVariantPrice(
              `₹ ${(res.data.minPricePaise / 100).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
            );
          }
        }
        if (Array.isArray(res.data.variants) && res.data.variants.length > 0) {
          setLiveVariants(
            res.data.variants.map((v) => ({
              id: v.id,
              sku: v.sku || v.id,
              size: v.size,
              colorName: v.colorName || 'Default',
              colorHex: v.colorHex || '#111111',
              stock: v.availableStock ?? 0,
              reservedStock: 0,
              inStock: Boolean(v.inStock),
              pricePaise: typeof v.pricePaise === 'number' ? v.pricePaise : undefined,
              price: typeof v.price === 'string' ? v.price : undefined,
              priceNum: typeof v.priceNum === 'number' ? v.priceNum : undefined,
              comparePaise: typeof v.comparePaise === 'number' ? v.comparePaise : null,
              comparePrice: typeof v.comparePrice === 'string' ? v.comparePrice : null,
              hasCustomPrice: Boolean(v.hasCustomPrice),
            })),
          );
        }
      })
      .catch(() => { });

    fetchStorefrontConfigApi()
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        if (typeof res.data.freeShippingThresholdPaise === 'number') {
          setFreeShippingThreshold(Math.round(res.data.freeShippingThresholdPaise / 100));
        }
        if (typeof res.data.returnWindowDays === 'number') {
          setReturnWindowDays(res.data.returnWindowDays);
        }
        if (typeof res.data.enableFitFinder === 'boolean') {
          setEnableFitFinder(res.data.enableFitFinder);
        }
        if (typeof res.data.enableReviewsOnPdp === 'boolean') {
          setEnableReviewsOnPdp(res.data.enableReviewsOnPdp);
        }
      })
      .catch(() => { });

    apiFetch<ReviewsPayload>(`/api/reviews/product/${encodeURIComponent(slug)}`, { skipAuthRefresh: true })
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setReviewsData(res.data);
        }
      })
      .catch(() => { });

    return () => {
      active = false;
    };
  }, [initialProduct?.id, initialProduct?.slug, liveSlug]);

  useEffect(() => {
    if (isPaused || isLightboxOpen) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      const container = galleryScrollRef.current;
      if (!container) return;
      const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 20;
      container.scrollTo({
        left: atEnd ? 0 : container.scrollLeft + 506,
        behavior: 'smooth',
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isPaused, isLightboxOpen]);

  if (isLoadingProduct) {
    return (
      <div className="min-h-[70vh] max-w-[1440px] mx-auto px-6 py-16 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[520px] bg-neutral-100 rounded" />
          <div className="h-[520px] bg-neutral-100 rounded hidden lg:block" />
          <div className="space-y-4 pt-4">
            <div className="h-4 w-40 bg-neutral-200 rounded" />
            <div className="h-8 w-3/4 bg-neutral-200 rounded" />
            <div className="h-6 w-28 bg-neutral-200 rounded" />
            <div className="h-12 w-full bg-neutral-200 rounded-full mt-8" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !liveProduct) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-24 text-center bg-white text-black">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-400 mb-3">
          Atelier Archive
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif uppercase tracking-wider mb-3">
          Garment Not Found
        </h1>
        <p className="text-sm text-neutral-600 max-w-md mb-8">
          This piece may have been archived or moved to a seasonal collection.
        </p>
        <a
          href="/categories"
          className="px-8 py-3 bg-black text-white text-xs uppercase tracking-[0.2em] rounded-full hover:bg-neutral-800 transition-colors"
        >
          Explore Collections
        </a>
      </div>
    );
  }

  const product = liveProduct;

  const colors =
    product.colors && product.colors.length > 0
      ? product.colors
      : [{ name: 'Signature', hex: '#111111' }];

  const safeColorIdx = selectedColorIndex < colors.length ? selectedColorIndex : 0;
  const currentColor = colors[safeColorIdx] || colors[0];
  const galleryImages =
    currentColor?.images && currentColor.images.length > 0
      ? currentColor.images
      : product.images && product.images.length > 0
        ? product.images
        : [product.defaultImg, product.hoverImg].filter(Boolean);

  const effectiveSizes =
    product.sizes && product.sizes.length > 0
      ? product.sizes
      : Array.from(new Set(liveVariants.map((v) => v.size).filter(Boolean)));

  const activeColorVariants = liveVariants.filter(
    (v) => !currentColor?.name || v.colorName.toLowerCase() === currentColor.name.toLowerCase(),
  );

  const activeVariant: ProductVariant | undefined = selectedSize
    ? activeColorVariants.find((v) => v.size.toLowerCase() === selectedSize.toLowerCase()) ||
      liveVariants.find((v) => v.size.toLowerCase() === selectedSize.toLowerCase())
    : undefined;

  const colorLeadVariant: ProductVariant | undefined =
    activeColorVariants.length > 0
      ? [...activeColorVariants].sort(
          (a, b) => (a.pricePaise ?? a.priceNum ?? livePriceNum) - (b.pricePaise ?? b.priceNum ?? livePriceNum),
        )[0]
      : undefined;

  const colorHasMultipleSizePrices =
    activeColorVariants.length > 1 &&
    new Set(activeColorVariants.map((v) => v.pricePaise ?? v.priceNum ?? livePriceNum)).size > 1;

  const effectiveDisplayPrice =
    activeVariant?.price ||
    currentColor?.price ||
    colorLeadVariant?.price ||
    (hasVariantPricing && !selectedSize && minVariantPrice ? minVariantPrice : livePrice);
  const effectivePriceNum =
    activeVariant?.priceNum ??
    currentColor?.priceNum ??
    colorLeadVariant?.priceNum ??
    livePriceNum;
  const effectiveComparePrice =
    activeVariant?.comparePrice ??
    currentColor?.comparePrice ??
    colorLeadVariant?.comparePrice ??
    product.comparePrice ??
    null;
  const effectiveSku = activeVariant?.sku || colorLeadVariant?.sku || product.sku || product.id;

  const getSizeVariant = (sizeLabel: string) =>
    activeColorVariants.find((v) => v.size.toLowerCase() === sizeLabel.toLowerCase()) ||
    liveVariants.find((v) => v.size.toLowerCase() === sizeLabel.toLowerCase());

  const totalGallery = galleryImages.length;
  const primaryMosaicIdx = totalGallery >= 3 ? 2 : 0;
  const topRightMosaicIdx = totalGallery >= 2 ? 1 : 0;
  const bottomRightMosaicIdx = totalGallery >= 3 ? 0 : totalGallery >= 2 ? 1 : 0;

  const productDiscoveryTags = Array.from(
    new Set(
      [
        product.gender ? `${product.gender}'s Collection` : null,
        product.category,
        product.subCategory,
        product.tag,
        product.title,
      ].filter((value): value is string => Boolean(value && value.trim())),
    ),
  );

  const allVariantsOutOfStock =
    liveVariants.length > 0 && liveVariants.every((v) => v.inStock === false);
  const isSoldOut =
    product.badge === 'SOLD OUT' || (effectiveSizes.length === 0 && liveVariants.length === 0) || allVariantsOutOfStock;

  const handleOpenLightbox = (index: number) => {
    setLightboxInitialIndex(index);
    setIsLightboxOpen(true);
  };

  const handleScrollGallery = (direction: 'left' | 'right') => {
    if (!galleryScrollRef.current) return;
    const scrollAmount = 506;
    galleryScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: product.title,
          url: window.location.href,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // User cancelled share
    }
  };

  const handleAddToBag = () => {
    if (!selectedSize && effectiveSizes.length > 0) {
      setSizeError(true);
      return;
    }

    const activeSize = selectedSize || 'UNI';
    const matchedVariant =
      liveVariants.find(
        (v) =>
          v.size.toLowerCase() === activeSize.toLowerCase() &&
          (!currentColor?.name || v.colorName.toLowerCase() === currentColor.name.toLowerCase()),
      ) || liveVariants.find((v) => v.size.toLowerCase() === activeSize.toLowerCase());

    if (matchedVariant && matchedVariant.inStock === false) {
      setSizeError(true);
      return;
    }

    setSizeError(false);
    setIsAdding(true);

    addToCart({
      id: product.id,
      slug: product.slug,
      title: product.title,
      price: matchedVariant?.price || effectiveDisplayPrice,
      priceNum: matchedVariant?.priceNum ?? effectivePriceNum,
      color: currentColor?.name,
      variantId: matchedVariant?.id,
      img: currentColor?.swatchImg || currentColor?.img || galleryImages[0] || product.defaultImg,
      size: activeSize,
    });

    setTimeout(() => {
      setIsAdding(false);
      openCart();
    }, 450);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = product.slug || product.id;
    setSubmittingReview(true);
    setReviewMessage(null);
    const res = await apiFetch<{ status: string; message: string }>(
      `/api/reviews/product/${encodeURIComponent(slug)}`,
      {
        method: 'POST',
        skipAuthRefresh: true,
        body: JSON.stringify(reviewForm),
      },
    );
    setSubmittingReview(false);
    if (!res.success) {
      setReviewMessage({
        type: 'err',
        text: res.error?.message || 'Could not submit review. Please check all fields.',
      });
      return;
    }
    setReviewMessage({
      type: 'ok',
      text: res.data?.message || 'Thank you. Your review has been received.',
    });
    setReviewForm({
      authorName: '',
      authorEmail: '',
      rating: 5,
      fitFeedback: 'true_to_size',
      title: '',
      body: '',
    });
    setShowReviewForm(false);
    // Refresh approved reviews if auto-approved
    apiFetch<ReviewsPayload>(`/api/reviews/product/${encodeURIComponent(slug)}`, { skipAuthRefresh: true })
      .then((r) => {
        if (r.success && r.data) setReviewsData(r.data);
      })
      .catch(() => { });
  };

  return (
    <div className="relative w-full bg-white text-neutral-900">
      {/* ============================================================ */}
      {/* 1. Horizontal Gallery (505.66 x 674.21 per image)            */}
      {/* ============================================================ */}
      <div className="relative w-full overflow-hidden bg-[#faf8f5]">
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
            className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-neutral-800 flex items-center justify-center shadow-md backdrop-blur-sm transition-all focus:outline-none"
          >
            {isPaused ? (
              <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleScrollGallery('left')}
          aria-label="Scroll gallery left"
          className="hidden xl:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-neutral-800 items-center justify-center shadow-md backdrop-blur-sm transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => handleScrollGallery('right')}
          aria-label="Scroll gallery right"
          className="hidden xl:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-neutral-800 items-center justify-center shadow-md backdrop-blur-sm transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div
          ref={galleryScrollRef}
          className="w-full flex flex-row overflow-x-auto scrollbar-none snap-x snap-mandatory min-h-[520px] lg:min-h-[675px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {galleryImages.map((img, idx) => (
            <div
              key={`${img}-${idx}`}
              onClick={() => handleOpenLightbox(idx)}
              className="flex-shrink-0 snap-start relative overflow-hidden bg-[#faf8f5] border-r border-neutral-100 last:border-r-0 cursor-zoom-in group"
              style={{
                width: '505.66px',
                maxWidth: '85vw',
                height: '674.21px',
              }}
            >
              <img
                src={img}
                alt={`${product.title} - view ${idx + 1}`}
                className="object-fit-contain w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                style={{ width: '505.66px', height: '674.21px' }}
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* 2. Floating Product Info Card                                */}
        {/* ============================================================ */}
        <div
          className="product-info-wrapper bg-body p-2 p-xl-4 w-full max-w-[526px] bg-white rounded-[8px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-neutral-200/70 z-20 mx-auto my-6 lg:mx-0 lg:my-0 lg:absolute lg:bottom-6 lg:right-8 transition-all"
          style={{
            width: '526px',
            maxWidth: 'calc(100vw - 32px)',
            padding: '20px',
            backgroundColor: '#FFFFFF',
          }}
        >
          {/* Row 1: Breadcrumbs & Status / Price Badge */}
          <div
            className="flex items-start justify-between gap-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium"
            style={{ width: '486px', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-1.5 flex-wrap leading-tight">
              <a href="/" className="hover:text-black transition-colors">
                HOME
              </a>
              <span>&gt;</span>
              <a
                href={product.category ? `/categories/${encodeURIComponent(product.category)}` : '/categories'}
                className="hover:text-black transition-colors"
              >
                {product.category ? product.category.toUpperCase() : 'ATELIER'}
              </a>
              <span>&gt;</span>
              <span>{(product.tag || product.gender || 'COLLECTION').toUpperCase()}</span>
              <span>&gt;</span>
              <span className="text-neutral-800 font-semibold truncate max-w-[180px]">
                {product.title.toUpperCase()}
              </span>
            </div>

            {isSoldOut ? (
              <span className="bg-[#e5e5e5] text-neutral-700 text-[10px] font-semibold px-2.5 py-0.5 uppercase tracking-wider rounded-[2px] flex-shrink-0">
                SOLD OUT
              </span>
            ) : (
              <span className="flex items-baseline gap-1.5 flex-shrink-0">
                {colorHasMultipleSizePrices && !selectedSize && (
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">From</span>
                )}
                {effectiveComparePrice && (
                  <span className="text-[11px] line-through text-neutral-400">
                    {formatInrDisplayString(effectiveComparePrice, selectedCountry, fx)}
                  </span>
                )}
                <span className="text-black font-semibold text-[13px]">
                  {formatInrDisplayString(effectiveDisplayPrice, selectedCountry, fx)}
                </span>
              </span>
            )}
          </div>

          {/* Row 2: Product Title & Origin Badge */}
          <div
            className="flex items-start justify-between gap-4 mt-2.5"
            style={{ width: '486px', maxWidth: '100%' }}
          >
            <h1
              className="m-0 p-0 text-[16px] leading-[23.2px] text-black uppercase font-medium tracking-normal"
              style={{ width: '364.39px', maxWidth: showOriginBadge ? 'calc(100% - 110px)' : '100%' }}
            >
              <span style={{ display: 'inline-block', width: '100%' }}>{product.title}</span>
            </h1>

            {showOriginBadge && (
              <div
                data-brand-origin-badge
                className="p-1 uppercase text-black font-medium tracking-wider flex items-center justify-center whitespace-nowrap flex-shrink-0"
                style={{
                  minWidth: '101.15px',
                  height: '22.24px',
                  fontSize: '11px',
                  padding: '4px 6px',
                  margin: '-3px 0px 0px -3px',
                  border: '1px solid #000000',
                  color: '#000000',
                }}
              >
                {originBadgeText}
              </div>
            )}
          </div>

          {/* Row 3: SKU */}
          <div
            className="product-sku mt-1 uppercase tracking-wider font-mono"
            style={{
              width: '381.16px',
              maxWidth: '100%',
              minHeight: '10.5px',
              fontSize: '10px',
              color: '#000000',
              margin: '4px 0px 0px',
            }}
          >
            SKU {effectiveSku}
          </div>

          {/* Row 4: Color Label */}
          <div className="mt-3.5" style={{ width: '486px', maxWidth: '100%' }}>
            <span
              className="text-black"
              style={{
                display: 'inline-block',
                minWidth: '110.59px',
                height: '19.2px',
                fontSize: '14px',
                lineHeight: '19.2px',
                color: '#000000',
              }}
            >
              Color <strong className="font-bold">{currentColor.name}</strong>
            </span>
          </div>

          {/* Row 5: Color Swatches */}
          <div
            className="color-group mt-2 flex items-center flex-wrap gap-y-2"
            role="radiogroup"
            aria-label="Available colors"
            style={{
              width: '486px',
              maxWidth: '100%',
              minHeight: '45.8px',
              fontSize: '14px',
              color: '#000000',
              margin: '10px 0px 0px',
            }}
          >
            {colors.map((c, idx) => {
              const isSelected = safeColorIdx === idx;
              return (
                <button
                  key={`${c.name}-${idx}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select color ${c.name}`}
                  onClick={() => setSelectedColorIndex(idx)}
                  className="text-decoration-none color-badge-link inline-flex items-center p-0 border-0 bg-transparent text-[14px] text-black focus:outline-none focus-visible:ring-1 focus-visible:ring-black flex-shrink-0"
                  style={{
                    margin: idx === colors.length - 1 ? '0px' : '0px 17px 0px 0px',
                  }}
                >
                  <span
                    className={`variant-color d-inline-block block rounded-none transition-colors ${isSelected
                      ? 'border border-black shadow-[inset_0_-2px_0_#000000]'
                      : 'border border-neutral-300 hover:border-black'
                      }`}
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: c.hex,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Row 6: Size Selection & Add to Bag */}
          {!isSoldOut && effectiveSizes.length > 0 && (
            <div className="mt-4 space-y-2.5" style={{ width: '486px', maxWidth: '100%' }}>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
                <span className="font-medium text-neutral-700">Size: {selectedSize || 'Select'}</span>
                <div className="flex items-center gap-3">
                  {enableFitFinder && (
                    <button
                      type="button"
                      onClick={() => setIsFitFinderOpen(true)}
                      className="text-neutral-500 hover:text-black underline transition-colors"
                    >
                      Find your size
                    </button>
                  )}
                  {showSizeGuide && (
                    <button
                      type="button"
                      onClick={() => setIsSizeGuideOpen(true)}
                      className="text-neutral-500 hover:text-black underline transition-colors"
                    >
                      Size guide
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {effectiveSizes.map((s) => {
                  const isChosen = selectedSize === s;
                  const sizeVar = getSizeVariant(s);
                  const outOfStock = sizeVar ? sizeVar.inStock === false : false;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={outOfStock}
                      title={
                        outOfStock
                          ? `${s} — Sold out`
                          : sizeVar?.price
                            ? `${s} — ${formatInrDisplayString(sizeVar.price, selectedCountry, fx)}`
                            : s
                      }
                      onClick={() => {
                        setSelectedSize(s);
                        setSizeError(false);
                      }}
                      className={`min-h-[32px] px-3 py-1 rounded-[3px] text-xs font-medium border transition-all flex flex-col items-center justify-center leading-tight ${outOfStock
                        ? 'border-neutral-200 text-neutral-300 line-through cursor-not-allowed bg-neutral-50'
                        : isChosen
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'border-neutral-300 text-neutral-800 hover:border-black'
                        }`}
                    >
                      <span>{s}</span>
                      {hasVariantPricing && sizeVar?.price && !outOfStock && (
                        <span
                          className={`text-[9px] font-normal ${isChosen ? 'text-neutral-200' : 'text-neutral-500'}`}
                        >
                          {formatInrDisplayString(sizeVar.price, selectedCountry, fx)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {sizeError && <p className="text-[11px] text-red-500">Please choose an available size</p>}

              <div
                className="bg-white ProductDetailDescription__product-detail-description__cart-block mt-3"
                style={{
                  margin: '0px -16px',
                  padding: '16px',
                  width: 'calc(100% + 32px)',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <button
                  type="button"
                  onClick={handleAddToBag}
                  disabled={isAdding}
                  className="w-full rounded-full text-white transition-colors duration-200 flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-neutral-900 hover:bg-black"
                  style={{
                    padding: '13px 24px 9px 24px',
                    height: '45.6px',
                    backgroundColor: '#424242',
                  }}
                >
                  {isAdding ? (
                    <span className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-wider uppercase text-white leading-[22px]">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>ADDING...</span>
                    </span>
                  ) : (
                    <span className="Button__btn__content btn__content text-[14px] font-semibold tracking-wider uppercase text-white leading-[22px]">
                      ADD TO BAG
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Row 7: Divider */}
          <div
            className="w100 border-bottom mt-5 mb-5 bordermb-none border-b border-neutral-200"
            style={{
              width: '486px',
              maxWidth: '100%',
              height: '0.8px',
              margin: '24px 0px',
            }}
          />

          {/* Row 8: Share & Save */}
          <div
            className="product-info-wishlist d-flex flex items-center justify-between gap-4"
            style={{
              width: '486px',
              maxWidth: '100%',
              height: '56px',
              padding: '16px 0px',
              fontSize: '14px',
              color: '#000000',
            }}
          >
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2.5 text-[14px] text-black hover:opacity-80 transition-opacity focus:outline-none"
            >
              <svg
                className="w-4 h-4 text-black"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 15V3m0 0l-4 4m4-4l4 4"
                />
              </svg>
              <span>{copied ? 'Link copied to clipboard!' : 'Share this product'}</span>
            </button>

            <div className="inline-flex items-center gap-1.5">
              <span className="text-[12px] text-neutral-600">Save</span>
              <WishlistButton
                item={{
                  id: product.id,
                  slug: product.slug,
                  title: product.title,
                  price: effectiveDisplayPrice,
                  priceNum: effectivePriceNum,
                  image: currentColor?.img || galleryImages[0] || product.defaultImg,
                  link: product.link || `/products/${product.slug}`,
                  category: product.category,
                  sizes: effectiveSizes,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. Under-Gallery Editorial Mosaic & Details Accordion Section */}
      {/* ============================================================ */}
      <section
        aria-label="Product editorial lookbook and specifications"
        className="w-full m-0 px-4 pt-6 pb-14 lg:pt-8 lg:pb-20 bg-white text-black"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-[1380px]:grid-cols-[946.8px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          {/* Left Column: Shipping Notice + 2:1 Editorial Image Mosaic */}
          <div className="min-w-0 w-full">
            <div className="mb-5 space-y-1 text-[13px] leading-[1.6] text-black">
              {shippingNoticeText ? (
                <p className="font-semibold">{shippingNoticeText}</p>
              ) : (
                <p>
                  <strong className="font-semibold">Complimentary express shipping</strong> on orders above{' '}
                  {effectiveDisplayPrice.includes('€')
                    ? '€200'
                    : `₹${freeShippingThreshold.toLocaleString('en-IN')}`}
                  .
                </p>
              )}
              <p className="font-semibold">
                {returnNoticeText || `Complimentary ${returnWindowDays}-day return window`}
              </p>
            </div>

            {galleryImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-0 bg-[#f1f1f1]">
                {[
                  {
                    src: galleryImages[primaryMosaicIdx],
                    lightboxIndex: primaryMosaicIdx,
                    alt: `${product.title} - editorial view`,
                    label: `Zoom editorial image of ${product.title}`,
                    layoutClass: 'sm:row-span-2 aspect-[3/4] sm:h-full',
                    width: 631,
                    height: 842,
                  },
                  {
                    src: galleryImages[topRightMosaicIdx],
                    lightboxIndex: topRightMosaicIdx,
                    alt: `${product.title} - detail view`,
                    label: `Zoom detail view of ${product.title}`,
                    layoutClass: 'aspect-[3/4]',
                    width: 316,
                    height: 421,
                  },
                  {
                    src: galleryImages[bottomRightMosaicIdx],
                    lightboxIndex: bottomRightMosaicIdx,
                    alt: `${product.title} - studio view`,
                    label: `Zoom studio view of ${product.title}`,
                    layoutClass: 'aspect-[3/4]',
                    width: 316,
                    height: 421,
                  },
                ].map((tile, idx) => (
                  <button
                    key={`${tile.src}-${idx}`}
                    type="button"
                    onClick={() => handleOpenLightbox(tile.lightboxIndex)}
                    aria-label={tile.label}
                    className={`${tile.layoutClass} block leading-none w-full overflow-hidden bg-[#f1f1f1] p-0 border-0 cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-black`}
                  >
                    <img
                      src={tile.src}
                      alt={tile.alt}
                      width={tile.width}
                      height={tile.height}
                      className="gallery-image-zoom cursor-pointer block w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Description details & Composition Accordions */}
          <div className="min-w-0 w-full">
            <DetailAccordion
              id="pdp-description-details-panel"
              title="Description details"
              isOpen={isDescriptionOpen}
              onToggle={() => setIsDescriptionOpen((prev) => !prev)}
            >
              <p>
                {product.description ||
                  'Tailored garment designed for effortless elegance and refined movement. Made in India through sustainable artisanal processes.'}
              </p>
              {showOriginBadge && <p>- {originBadgeText}</p>}
              {product.sizeAndFit && product.sizeAndFit.length > 0 && (
                <div className="space-y-1">
                  {product.sizeAndFit.map((item, idx) => (
                    <p key={idx}>{idx === 0 ? `* ${item}` : item}</p>
                  ))}
                </div>
              )}
            </DetailAccordion>

            <DetailAccordion
              id="pdp-composition-panel"
              title="Composition"
              isOpen={isCompositionOpen}
              onToggle={() => setIsCompositionOpen((prev) => !prev)}
            >
              {product.compositionAndCare && product.compositionAndCare.length > 0 ? (
                product.compositionAndCare.map((line, idx) => <p key={idx}>{line}</p>)
              ) : (
                <p>
                  {[product.material, product.careGuide].filter(Boolean).join(' · ') ||
                    'Carefully crafted in India. Specialist dry clean recommended.'}
                </p>
              )}
            </DetailAccordion>

            {showExclusiveBanner && (
              <div
                className="my-5 py-3 px-4 text-center text-[13px] font-semibold text-black tracking-wide"
                style={{ backgroundColor: '#f3e5e5' }}
              >
                {exclusiveBannerText}
              </div>
            )}

            {productDiscoveryTags.length > 0 && (
              <div className="mt-5 text-[11px] leading-[1.7] text-neutral-700">
                <p className="text-[12px] font-semibold text-black mb-1">Find this product in:</p>
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  {productDiscoveryTags.map((label, idx) => (
                    <React.Fragment key={label}>
                      <a
                        href={idx === 0 ? '/' : `/search?q=${encodeURIComponent(label)}`}
                        className="hover:underline text-neutral-700 hover:text-black transition-colors"
                      >
                        {label}
                      </a>
                      {idx < productDiscoveryTags.length - 1 && (
                        <span className="text-neutral-500 mr-0.5" aria-hidden="true">
                          ,
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 space-y-1 text-[11px] leading-[1.6] text-neutral-600">
              <p>
                {conciergeHeading}{' '}
                <a
                  href="/contact"
                  className="underline text-black hover:opacity-75 transition-opacity"
                  data-brand-concierge-email
                >
                  {conciergeEmail}
                </a>
              </p>
              <p data-brand-atelier-hours>{atelierHours}</p>
              <p>
                Telephone assistance:{' '}
                <a
                  href={`tel:${conciergePhone.replace(/[^+\d]/g, '')}`}
                  className="hover:underline text-neutral-800"
                  data-brand-concierge-phone
                >
                  {conciergePhone}
                </a>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 pt-1">
                SKU {effectiveSku}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. Dynamic Style It With / Related (when rendered on /live)  */}
      {/* ============================================================ */}
      {!initialProduct && product.styleItWith && product.styleItWith.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 border-t border-neutral-100">
          <h2 id="style-it-with-title" className="text-xl uppercase tracking-[0.18em] font-normal text-center mb-8">
            {styleItWithHeading}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {product.styleItWith.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  id: item.id,
                  slug: item.link.replace(/^\/products\//, '').replace(/\/+$/, '') || item.id,
                  title: item.title,
                  price: item.price,
                  priceNum: item.priceNum,
                  defaultImg: item.image,
                  hoverImg: item.image,
                  link: item.link,
                  sizes: ['S', 'M', 'L', 'XL'],
                }}
              />
            ))}
          </div>
        </section>
      )}

      {!initialProduct && product.relatedProducts && product.relatedProducts.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 border-t border-neutral-100">
          <h2 id="related-products-title" className="text-xl uppercase tracking-[0.18em] font-normal text-center mb-8">
            {relatedHeading}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {product.relatedProducts.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  id: item.id,
                  slug: item.link.replace(/^\/products\//, '').replace(/\/+$/, '') || item.id,
                  title: item.title,
                  price: item.price,
                  priceNum: item.priceNum,
                  defaultImg: item.image,
                  hoverImg: item.image,
                  link: item.link,
                  sizes: ['S', 'M', 'L', 'XL'],
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 4. Live Client Reviews (Synced with Admin Reviews Moderation)*/}
      {/* ============================================================ */}
      {enableReviewsOnPdp && (
        <section
          aria-label="Client Reviews"
          className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-14 border-t border-neutral-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-500 mb-1">
                Client Perspectives
              </p>
              <h2 className="text-2xl font-serif uppercase tracking-wider text-black">
                {reviewsHeading}{' '}
                {reviewsData && reviewsData.summary.count > 0 && (
                  <span className="text-base font-sans font-normal text-neutral-500">
                    ({reviewsData.summary.averageRating.toFixed(1)} ★ · {reviewsData.summary.count})
                  </span>
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowReviewForm((prev) => !prev);
                setReviewMessage(null);
              }}
              className="px-6 py-2.5 border border-black text-xs uppercase tracking-[0.18em] text-black hover:bg-black hover:text-white transition-colors self-start sm:self-auto"
            >
              {showReviewForm ? 'Close Form' : 'Write a Review'}
            </button>
          </div>

          {reviewMessage && (
            <div
              className={`mb-6 px-4 py-3 text-xs border ${reviewMessage.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
                }`}
            >
              {reviewMessage.text}
            </div>
          )}

          {showReviewForm && (
            <form
              onSubmit={handleSubmitReview}
              className="mb-10 p-6 border border-neutral-200 bg-neutral-50/70 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-600 mb-1">
                    Your Name *
                  </label>
                  <input
                    required
                    minLength={2}
                    value={reviewForm.authorName}
                    onChange={(e) => setReviewForm((f) => ({ ...f, authorName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:outline-none focus:border-black"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-600 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={reviewForm.authorEmail}
                    onChange={(e) => setReviewForm((f) => ({ ...f, authorEmail: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:outline-none focus:border-black"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-600 mb-1">
                    Rating
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewForm((f) => ({ ...f, rating: star }))}
                        aria-label={`Rate ${star} stars`}
                        className={`text-xl leading-none ${star <= reviewForm.rating ? 'text-black' : 'text-neutral-300'
                          }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-600 mb-1">
                    Fit Assessment
                  </label>
                  <select
                    value={reviewForm.fitFeedback}
                    onChange={(e) =>
                      setReviewForm((f) => ({
                        ...f,
                        fitFeedback: e.target.value as 'runs_small' | 'true_to_size' | 'runs_large',
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:outline-none focus:border-black"
                  >
                    <option value="runs_small">Runs Small</option>
                    <option value="true_to_size">True to Size</option>
                    <option value="runs_large">Runs Large</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-600 mb-1">
                  Headline *
                </label>
                <input
                  required
                  minLength={2}
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:outline-none focus:border-black"
                  placeholder="Summarize your impression"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-600 mb-1">
                  Review *
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={reviewForm.body}
                  onChange={(e) => setReviewForm((f) => ({ ...f, body: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:outline-none focus:border-black"
                  placeholder="Share details on drape, craftsmanship, and fit..."
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="px-6 py-2.5 bg-black text-white text-xs uppercase tracking-[0.18em] hover:bg-neutral-800 disabled:opacity-50"
              >
                {submittingReview ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>
          )}

          {reviewsData && reviewsData.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviewsData.items.map((rev) => (
                <article key={rev.id} className="border border-neutral-200 p-5 space-y-2.5 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm tracking-widest text-black">
                      {'★'.repeat(rev.rating)}
                      <span className="text-neutral-300">{'★'.repeat(Math.max(0, 5 - rev.rating))}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-black">{rev.title}</h3>
                  <p className="text-xs leading-relaxed text-neutral-700">{rev.body}</p>
                  <div className="flex items-center flex-wrap gap-3 text-[11px] text-neutral-500 pt-1">
                    <span className="font-medium text-neutral-800">{rev.authorName}</span>
                    {rev.verifiedPurchase && (
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 uppercase tracking-wider text-[9px]">
                        Verified Purchase
                      </span>
                    )}
                    <span className="uppercase tracking-wider text-[10px]">
                      Fit: {rev.fitFeedback.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {rev.adminReply && (
                    <div className="mt-3 pl-3 border-l-2 border-black bg-neutral-50 p-3 text-xs text-neutral-700">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-black font-semibold mb-1">
                        Deynold Danny Atelier Response
                      </p>
                      <p>{rev.adminReply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              No client reviews published for this garment yet. Be the first to share your perspective.
            </p>
          )}
        </section>
      )}

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
        availableSizes={effectiveSizes}
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
        category={product.category}
        gender={product.gender || undefined}
        sizes={effectiveSizes}
      />
    </div>
  );
};
