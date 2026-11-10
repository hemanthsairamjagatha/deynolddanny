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
 * Fetch products list from Cloudflare backend with fallback to static catalog
 */
export async function fetchProducts(params: {
  category?: string;
  sort?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<ProductCardData[]> {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.sort) query.set('sort', params.sort);
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.cursor) query.set('cursor', params.cursor);

  const endpoint = `/api/products${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await apiFetch<CatalogListResponse>(endpoint);

  if (res.success && res.data?.items && res.data.items.length > 0) {
    return res.data.items;
  }

  // Graceful fallback to local products if offline or empty
  if (params.category) {
    return allProducts.filter(p => p.category?.toLowerCase() === params.category?.toLowerCase());
  }
  return allProducts;
}

/**
 * Fetch a single product by slug from Cloudflare backend with fallback
 */
export async function fetchProductBySlug(slug: string): Promise<ProductCardData | null> {
  const res = await apiFetch<ProductCardData>(`/api/products/${slug}`);

  if (res.success && res.data) {
    return res.data;
  }

  // Fallback to local product definition
  return getLocalProductBySlug(slug) || null;
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

