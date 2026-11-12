/**
 * src/features/cart/api/cart.api.ts
 *
 * Cart API operations connecting the storefront to the Cloudflare Worker Cart & Stock Engine.
 */

import { apiFetch } from '../../../lib/api/client';

export interface BackendCartItem {
  cartItemId?: string;
  id?: string;
  variantId: string;
  productId: string;
  title: string;
  size: string;
  color?: string;
  img?: string;
  imageUrl?: string;
  qty?: number;
  quantity?: number;
  price?: string;
  unitPriceFormatted?: string;
  priceNum?: number;
  pricePaise?: number;
  unitPricePaise?: number;
  totalPricePaise?: number;
  availableStock?: number;
}

export interface BackendCartSummary {
  itemCount?: number;
  subtotalPaise: number;
  subtotalNum?: number;
  subtotalFormatted: string;
  qualifiesFreeShipping?: boolean;
  shippingPaise?: number;
  shippingFormatted?: string;
  taxPaise?: number;
  taxFormatted?: string;
  totalPaise?: number;
  totalFormatted?: string;
  currency?: string;
}

export interface BackendCartResponse {
  items: BackendCartItem[];
  subtotalPaise?: number;
  subtotalNum?: number;
  subtotalFormatted?: string;
  qualifiesFreeShipping?: boolean;
  summary?: BackendCartSummary;
}

/**
 * Fetch current user / session cart from backend
 */
export async function getCartApi() {
  return apiFetch<BackendCartResponse>('/api/cart');
}

/**
 * Add item to backend cart
 */
export async function addToCartApi(variantId: string, quantity: number = 1) {
  return apiFetch<BackendCartResponse>('/api/cart/items', {
    method: 'POST',
    body: JSON.stringify({ variantId, quantity }),
  });
}

/**
 * Update quantity of item in backend cart
 */
export async function updateCartItemApi(itemId: string, quantity: number) {
  return apiFetch<BackendCartResponse>(`/api/cart/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

/**
 * Remove item from backend cart
 */
export async function removeCartItemApi(itemId: string) {
  return apiFetch<BackendCartResponse>(`/api/cart/items/${itemId}`, {
    method: 'DELETE',
  });
}

