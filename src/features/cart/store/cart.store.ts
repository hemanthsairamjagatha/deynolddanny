import { atom, computed } from 'nanostores';
import type { CartItem } from '../types/cart.types';
import { getCartApi, addToCartApi, updateCartItemApi, removeCartItemApi } from '../api/cart.api';

// Initial state matching the existing project
const initialCart: CartItem[] = [
  {
    id: 'item-1',
    title: 'Ribbed cashmere crewneck knit sweater',
    price: '₹ 48,000.00',
    priceNum: 48000,
    size: '50',
    img: '/images/category-maglieria.jpg',
    qty: 1
  }
];

export const $cartItems = atom<CartItem[]>(initialCart);
export const $isCartOpen = atom<boolean>(false);

export const $totalCount = computed($cartItems, items =>
  items.reduce((sum, item) => sum + (Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0), 0)
);

export const $subtotalNum = computed($cartItems, items =>
  items.reduce(
    (sum, item) =>
      sum +
      (Number.isFinite(Number(item.priceNum)) ? Number(item.priceNum) : 0) *
        (Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0),
    0
  )
);

export const $formattedSubtotal = computed($subtotalNum, num => {
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `₹ ${formatted} INR`;
});

export function openCart() {
  $isCartOpen.set(true);
  if (typeof document !== 'undefined') {
    document.body.classList.add('cart-drawer-open');
  }
}

export function closeCart() {
  $isCartOpen.set(false);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('cart-drawer-open');
  }
  if (typeof window !== 'undefined' && window.location.hash === '#cart') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export function toggleCart() {
  if ($isCartOpen.get()) {
    closeCart();
  } else {
    openCart();
  }
}

/**
 * Synchronize local cart state with the Cloudflare Worker backend
 */
export async function syncCartWithBackend() {
  if (typeof window === 'undefined') return;
  try {
    const res = await getCartApi();
    if (res.success && res.data?.items && res.data.items.length > 0) {
      const mapped: CartItem[] = res.data.items.map(item => {
        const rawQty = Number(item.qty ?? item.quantity ?? 1);
        const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
        const rawPricePaise = Number(item.pricePaise ?? item.unitPricePaise ?? 0);
        const rawPriceNum = Number.isFinite(item.priceNum)
          ? Number(item.priceNum)
          : Number.isFinite(rawPricePaise)
            ? rawPricePaise / 100
            : 0;
        const priceNum = Number.isFinite(rawPriceNum) ? rawPriceNum : 0;

        return {
          id: item.productId,
          backendItemId: item.cartItemId ?? item.id,
          variantId: item.variantId,
          title: item.title,
          price:
            item.price ??
            item.unitPriceFormatted ??
            `₹ ${priceNum.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          priceNum,
          size: item.size,
          img: item.img ?? item.imageUrl ?? '',
          qty,
        };
      });
      $cartItems.set(mapped);
    }
  } catch {
    // Graceful fallback to local cart if network is unavailable
  }
}

export function addToCart(product: {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  img: string;
  variantId?: string;
}) {
  const current = $cartItems.get();
  const existingIndex = current.findIndex(
    item => item.id === product.id && item.size === product.size
  );

  if (existingIndex > -1) {
    const updated = [...current];
    const newQty = updated[existingIndex].qty + 1;
    updated[existingIndex] = {
      ...updated[existingIndex],
      qty: newQty
    };
    $cartItems.set(updated);

    // Background sync with Cloudflare backend
    const backendItemId = updated[existingIndex].backendItemId;
    if (backendItemId) {
      updateCartItemApi(backendItemId, newQty).catch(() => {});
    }
  } else {
    $cartItems.set([...current, { ...product, qty: 1 }]);

    // Background sync with Cloudflare backend
    const variantId = product.variantId || `${product.id}-${product.size.replace(/\s+/g, '')}`;
    addToCartApi(variantId, 1).then(res => {
      if (res.success && res.data?.items) {
        const backendItem = res.data.items.find(
          i => i.variantId === variantId || i.productId === product.id
        );
        if (backendItem) {
          const fresh = $cartItems.get().map(it =>
            it.id === product.id && it.size === product.size
              ? { ...it, backendItemId: backendItem.cartItemId ?? backendItem.id }
              : it
          );
          $cartItems.set(fresh);
        }
      }
    }).catch(() => {});
  }
}

export function updateQuantity(index: number, qty: number) {
  const current = $cartItems.get();
  if (qty <= 0) {
    removeFromCart(index);
    return;
  }
  const updated = [...current];
  if (updated[index]) {
    const backendItemId = updated[index].backendItemId;
    updated[index] = { ...updated[index], qty };
    $cartItems.set(updated);

    // Background sync
    if (backendItemId) {
      updateCartItemApi(backendItemId, qty).catch(() => {});
    }
  }
}

export function incrementQuantity(index: number) {
  const current = $cartItems.get();
  if (current[index]) {
    updateQuantity(index, current[index].qty + 1);
  }
}

export function decrementQuantity(index: number) {
  const current = $cartItems.get();
  if (current[index]) {
    updateQuantity(index, current[index].qty - 1);
  }
}

export function removeFromCart(index: number) {
  const current = $cartItems.get();
  const target = current[index];
  $cartItems.set(current.filter((_, i) => i !== index));

  // Background sync
  if (target?.backendItemId) {
    removeCartItemApi(target.backendItemId).catch(() => {});
  }
}

// Drawer keyboard & URL hash initializer
export function initInspectListeners() {
  if (typeof window === 'undefined') return;

  // Sync cart from Cloudflare backend on page boot
  syncCartWithBackend().catch(() => {});

  // Listen for Escape key to close cart
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && $isCartOpen.get()) {
      closeCart();
    }
  });

  // URL hash / params check on initial load only
  const hasCartHash = window.location.hash === '#cart';
  const hasCartParam = window.location.search.includes('cart=1');

  if (hasCartHash || hasCartParam) {
    setTimeout(openCart, 50);
  }
}

