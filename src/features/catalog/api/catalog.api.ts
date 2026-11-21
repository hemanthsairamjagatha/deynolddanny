/**
 * src/features/catalog/api/catalog.api.ts
 *
 * Catalog API operations connecting the storefront to the Cloudflare Worker D1 & KV store.
 */

import { apiFetch } from '../../../lib/api/client';
import type { ProductCardData, CategoryCardData } from '../types/product.types';
import { allProducts, getProductBySlug as getLocalProductBySlug } from '../data/products';
import { mainCategories as localCategories } from '../../home/data/home-content';

export interface CatalogListResponse {
  items: ProductCardData[];
  nextCursor?: string | null;
  total?: number;
}

/**
 * Normalizes backend product data into full frontend ProductCardData structure
 */
export function normalizeProduct(
  p: ProductCardData & {
    gallery?: Array<{ colorName: string; images: string[] }>;
    compositionCare?: string[];
    shippingReturns?: string[];
    crossSells?: { styleItWith?: ProductCardData['styleItWith']; related?: ProductCardData['relatedProducts'] };
  },
): ProductCardData {
  if (!p) return p;

  const galleryImages = (p.gallery ?? []).flatMap((g) => g.images ?? []).filter(Boolean);
  const topImages = Array.from(
    new Set(
      [
        ...(p.images ?? []),
        ...galleryImages,
        p.defaultImg,
        p.hoverImg,
      ].filter((u): u is string => Boolean(u && u.trim())),
    ),
  );

  const colors = (p.colors || []).map((c, idx) => {
    const matchingGallery = p.gallery?.find((g) => g.colorName.toLowerCase() === c.name.toLowerCase());
    const colorVars = (p.variants || []).filter((v) => v.colorName?.toLowerCase() === c.name.toLowerCase());
    const varPrices = colorVars
      .map((v) => v.priceNum ?? (typeof v.pricePaise === 'number' ? v.pricePaise / 100 : undefined))
      .filter((n): n is number => typeof n === 'number' && n > 0);
    const minColorPriceNum = c.priceNum ?? (varPrices.length > 0 ? Math.min(...varPrices) : p.priceNum);
    const resolvedImages =
      matchingGallery?.images?.length
        ? matchingGallery.images
        : c.images?.length
          ? c.images
          : idx === 0
            ? topImages
            : [c.img, c.hoverImg, topImages[idx % Math.max(1, topImages.length)], p.hoverImg, p.defaultImg].filter(
                (u): u is string => Boolean(u && u.trim()),
              );
    const primaryImg = c.img || resolvedImages[0] || p.defaultImg;
    const secondaryImg = c.hoverImg || resolvedImages[1] || (idx === 0 ? p.hoverImg : p.defaultImg) || primaryImg;
    return {
      ...c,
      img: primaryImg,
      hoverImg: secondaryImg,
      images: resolvedImages,
      swatchImg: c.swatchImg || primaryImg,
      priceNum: minColorPriceNum,
      price:
        c.price ||
        (minColorPriceNum
          ? `₹ ${minColorPriceNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : p.price),
    };
  });

  return {
    ...p,
    images: topImages,
    compositionAndCare: p.compositionAndCare?.length ? p.compositionAndCare : p.compositionCare,
    shippingAndReturns: p.shippingAndReturns?.length ? p.shippingAndReturns : p.shippingReturns,
    styleItWith: p.styleItWith?.length ? p.styleItWith : p.crossSells?.styleItWith,
    relatedProducts: p.relatedProducts?.length ? p.relatedProducts : p.crossSells?.related,
    colors: colors.length > 0 ? colors : [{ name: 'Default', hex: '#111111', images: topImages, swatchImg: p.defaultImg }],
  };
}

/**
 * Fetch products list from Cloudflare backend with fallback to static catalog only when offline
 */
export async function fetchProducts(params: {
  category?: string;
  section?: string;
  sort?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<ProductCardData[]> {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.section) query.set('section', params.section);
  if (params.sort) query.set('sort', params.sort);
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.cursor) query.set('cursor', params.cursor);

  const endpoint = `/api/products${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await apiFetch<CatalogListResponse>(endpoint, { skipAuthRefresh: true });

  // When backend responds authoritatively in the browser, honor live D1 catalog (including archives & newly created items)
  if (res.success && Array.isArray(res.data?.items)) {
    return res.data.items.map(normalizeProduct);
  }

  // Graceful fallback to static seed catalog during offline build or network failure
  if (params.category) {
    return allProducts.filter((p) => p.category?.toLowerCase() === params.category?.toLowerCase());
  }
  return allProducts;
}

/**
 * Fetch a single product by slug from Cloudflare backend with fallback
 */
export async function fetchProductBySlug(slug: string): Promise<ProductCardData | null> {
  const res = await apiFetch<ProductCardData>(`/api/products/${encodeURIComponent(slug)}`, { skipAuthRefresh: true });

  if (res.success && res.data) {
    return normalizeProduct(res.data);
  }

  // Fallback to local product definition only if backend is unreachable (status 0/5xx)
  if (res.error?.status === 404) {
    return null;
  }
  const local = getLocalProductBySlug(slug);
  return local ? normalizeProduct(local) : null;
}

/**
 * Full-text search using SQLite FTS5 via the Cloudflare Worker
 */
export async function searchCatalog(query: string): Promise<ProductCardData[]> {
  if (!query || query.trim().length === 0) return [];

  const res = await apiFetch<{ items: ProductCardData[]; total: number }>(
    `/api/search?q=${encodeURIComponent(query.trim())}`
  );

  if (res.success && res.data?.items) {
    return res.data.items;
  }

  // Fallback to local substring search
  const q = query.toLowerCase();
  return allProducts.filter(
    p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
  );
}

/**
 * Fetch categories from Cloudflare backend
 */
export async function fetchCategories(): Promise<CategoryCardData[]> {
  const res = await apiFetch<{ items: CategoryCardData[] }>('/api/categories');

  if (res.success && res.data?.items && res.data.items.length > 0) {
    return res.data.items;
  }

  return localCategories;
}

