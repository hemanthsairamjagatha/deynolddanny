/**
 * src/features/wishlist/api/wishlist.api.ts
 * Server-persisted wishlist API for authenticated patrons.
 */

import { apiFetch } from '../../../lib/api/client';

export interface BackendWishlistItem {
  wishlistId?: string;
  id: string;
  slug: string;
  title: string;
  badge?: string | null;
  defaultImg?: string;
  default_img?: string;
  hoverImg?: string;
  hover_img?: string;
  price?: string;
  priceNum?: number;
  price_paise?: number;
}

export async function fetchWishlistApi() {
  return apiFetch<{ items: BackendWishlistItem[] }>('/api/wishlist');
}

export async function addWishlistApi(productId: string) {
  return apiFetch<{ added: boolean; productId: string }>('/api/wishlist', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

export async function removeWishlistApi(productId: string) {
  return apiFetch<{ removed: boolean; productId: string }>(
    `/api/wishlist/${encodeURIComponent(productId)}`,
    {
      method: 'DELETE',
    },
  );
}
