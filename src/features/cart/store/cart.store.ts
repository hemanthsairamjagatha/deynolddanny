import { atom, computed } from 'nanostores';
import type { CartItem } from '../types/cart.types';
import {
  getCartApi,
  addToCartApi,
  updateCartItemApi,
  removeCartItemApi,
  clearCartApi,
  type BackendCartResponse,
} from '../api/cart.api';
import { hasSessionHint } from '../../../lib/api/client';

export const CART_STORAGE_KEY = 'dd_cart';
export const COUPON_STORAGE_KEY = 'dd_applied_coupon';

export interface AppliedCoupon {
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  maxDiscountPaise?: number | null;
  discountPaise: number;
  discountNum: number;
  minOrderPaise?: number | null;
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage quota/private browsing exceptions
  }
}

function persistCart(items: CartItem[]): void {
  writeLocalJson(CART_STORAGE_KEY, items);
}

function formatInr(amountRupees: number): string {
  return amountRupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const $cartItems = atom<CartItem[]>(readLocalJson<CartItem[]>(CART_STORAGE_KEY, []));
export const $isCartOpen = atom<boolean>(false);
export const $appliedCoupon = atom<AppliedCoupon | null>(
  readLocalJson<AppliedCoupon | null>(COUPON_STORAGE_KEY, null),
);

export const $totalCount = computed($cartItems, (items) =>
  items.reduce((sum, item) => sum + item.qty, 0),
);

export const $subtotalNum = computed($cartItems, (items) =>
  items.reduce((sum, item) => {
    const num = item.priceNum || parseFloat(item.price.replace(/[^\d.]/g, '')) || 0;
    return sum + num * item.qty;
  }, 0),
);

export const $formattedSubtotal = computed($subtotalNum, (num) => formatInr(num));

export const $discountNum = computed([$subtotalNum, $appliedCoupon], (subtotal, coupon) => {
  if (!coupon || subtotal <= 0) return 0;
  const subtotalPaise = Math.round(subtotal * 100);
  if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) {
    return 0;
  }

  let computedDiscountPaise = 0;
  if (coupon.discountType === 'percentage') {
    computedDiscountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
    if (coupon.maxDiscountPaise && computedDiscountPaise > coupon.maxDiscountPaise) {
      computedDiscountPaise = coupon.maxDiscountPaise;
    }
  } else {
    computedDiscountPaise = coupon.discountValue;
  }

  computedDiscountPaise = Math.min(computedDiscountPaise, subtotalPaise);
  return Math.max(0, Math.round(computedDiscountPaise / 100));
});

export const $totalPayableNum = computed([$subtotalNum, $discountNum], (subtotal, discount) =>
  Math.max(0, subtotal - discount),
);

export const $formattedTotalPayable = computed($totalPayableNum, (num) => formatInr(num));

export function applyCoupon(coupon: AppliedCoupon): void {
  $appliedCoupon.set(coupon);
  writeLocalJson(COUPON_STORAGE_KEY, coupon);
}

export function removeCoupon(): void {
  $appliedCoupon.set(null);
  writeLocalJson(COUPON_STORAGE_KEY, null);
}

export function openCart(): void {
  $isCartOpen.set(true);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }
}

export function closeCart(): void {
  $isCartOpen.set(false);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}

export function toggleCart(): void {
  if ($isCartOpen.get()) {
    closeCart();
  } else {
    openCart();
  }
}

function mapBackendCartItems(data: BackendCartResponse): CartItem[] {
  return (data.items || []).map((b) => {
    const qty = b.quantity ?? b.qty ?? 1;
    const unitPaise = b.unitPricePaise ?? b.pricePaise ?? 0;
    const priceNum =
      unitPaise > 0
        ? Math.round(unitPaise / 100)
        : (b.priceNum ?? (parseFloat(String(b.price ?? '0').replace(/[^\d.]/g, '')) || 0));
    const formatted =
      b.unitPriceFormatted || b.price || `₹ ${formatInr(priceNum)}`;

    return {
      id: b.productId,
      variantId: b.variantId,
      backendItemId: b.cartItemId || b.id,
      title: b.title,
      price: formatted,
      priceNum,
      size: b.size,
      color: b.color || undefined,
      img: b.imageUrl || b.img || '/images/placeholder.jpg',
      qty,
    };
  });
}

function applyBackendResponse(data: BackendCartResponse | undefined): void {
  if (!data || !Array.isArray(data.items)) return;
  const mapped = mapBackendCartItems(data);
  if (mapped.length > 0 || $cartItems.get().length === 0 || hasSessionHint()) {
    $cartItems.set(mapped);
    persistCart(mapped);
  }
}

let isSyncing = false;
export async function syncCartWithBackend(): Promise<void> {
  if (typeof window === 'undefined' || isSyncing) return;
  isSyncing = true;
  try {
    const res = await getCartApi();
    if (res.success && res.data && Array.isArray(res.data.items)) {
      if (res.data.items.length > 0) {
        const mapped = mapBackendCartItems(res.data);
        $cartItems.set(mapped);
        persistCart(mapped);
      } else if (hasSessionHint()) {
        // Authoritative backend cart for signed-in users takes precedence over stale client storage
        $cartItems.set([]);
        persistCart([]);
      }
    }
  } catch {
    // Offline fallback uses local cart cache gracefully
  } finally {
    isSyncing = false;
  }
}

function matchesLine(item: CartItem, target: { id: string; size: string; variantId?: string; color?: string }): boolean {
  if (item.variantId && target.variantId) {
    return item.variantId === target.variantId;
  }
  const itemColor = (item.color || '').trim().toLowerCase();
  const targetColor = (target.color || '').trim().toLowerCase();
  return item.id === target.id && item.size === target.size && itemColor === targetColor;
}

export function addToCart(product: {
  id: string;
  slug?: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  color?: string;
  img: string;
  variantId?: string;
  qty?: number;
}): void {
  const addQty = Math.max(1, product.qty ?? 1);
  const current = $cartItems.get();
  const existingIndex = current.findIndex((item) => matchesLine(item, product));

  const next = [...current];
  if (existingIndex > -1) {
    next[existingIndex] = {
      ...next[existingIndex],
      qty: next[existingIndex].qty + addQty,
      variantId: next[existingIndex].variantId || product.variantId,
      color: next[existingIndex].color || product.color,
    };
  } else {
    next.push({
      id: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      priceNum: product.priceNum,
      size: product.size,
      color: product.color,
      img: product.img,
      qty: addQty,
      variantId: product.variantId,
    });
  }

  $cartItems.set(next);
  persistCart(next);

  const variantId = product.variantId || `${product.id}_${product.size}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (variantId) {
    addToCartApi(variantId, addQty)
      .then((res) => {
        if (res.success && res.data?.items) {
          const synced = mapBackendCartItems(res.data);
          $cartItems.set(synced);
          persistCart(synced);
        }
      })
      .catch(() => {});
  }
}

export function updateQuantity(index: number, qty: number): void {
  const current = [...$cartItems.get()];
  const target = current[index];
  if (!target) return;

  if (qty <= 0) {
    removeFromCart(index);
    return;
  }

  current[index] = { ...target, qty };
  $cartItems.set(current);
  persistCart(current);

  if (target.backendItemId) {
    updateCartItemApi(target.backendItemId, qty)
      .then((res) => applyBackendResponse(res.data))
      .catch(() => {});
  }
}

export function incrementQuantity(index: number): void {
  const item = $cartItems.get()[index];
  if (item) {
    updateQuantity(index, item.qty + 1);
  }
}

export function decrementQuantity(index: number): void {
  const item = $cartItems.get()[index];
  if (item) {
    updateQuantity(index, item.qty - 1);
  }
}

export function removeFromCart(index: number): void {
  const current = [...$cartItems.get()];
  const target = current[index];
  if (!target) return;

  current.splice(index, 1);
  $cartItems.set(current);
  persistCart(current);
  if (current.length === 0) {
    removeCoupon();
  }

  if (target.backendItemId) {
    removeCartItemApi(target.backendItemId)
      .then((res) => applyBackendResponse(res.data))
      .catch(() => {});
  }
}

export function clearCart(): void {
  $cartItems.set([]);
  persistCart([]);
  removeCoupon();
  clearCartApi().catch(() => {});
}

let listenersBound = false;
export function initInspectListeners(): void {
  if (typeof window === 'undefined') return;
  syncCartWithBackend();

  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      syncCartWithBackend();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === CART_STORAGE_KEY) {
      $cartItems.set(readLocalJson<CartItem[]>(CART_STORAGE_KEY, []));
    } else if (event.key === COUPON_STORAGE_KEY) {
      $appliedCoupon.set(readLocalJson<AppliedCoupon | null>(COUPON_STORAGE_KEY, null));
    }
  });
}
