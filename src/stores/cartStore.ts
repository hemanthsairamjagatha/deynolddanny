import { atom, computed } from 'nanostores';
import type { CartItem } from '../types/ecommerce';

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
  items.reduce((sum, item) => sum + item.qty, 0)
);

export const $subtotalNum = computed($cartItems, items =>
  items.reduce((sum, item) => sum + item.priceNum * item.qty, 0)
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
  try {
    sessionStorage.setItem('cartDrawerOpen', 'true');
  } catch (e) {}
}

export function closeCart() {
  $isCartOpen.set(false);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('cart-drawer-open');
  }
  try {
    sessionStorage.removeItem('cartDrawerOpen');
  } catch (e) {}
}

export function toggleCart() {
  if ($isCartOpen.get()) {
    closeCart();
  } else {
    openCart();
  }
}

export function addToCart(product: {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  img: string;
}) {
  const current = $cartItems.get();
  const existingIndex = current.findIndex(
    item => item.id === product.id && item.size === product.size
  );

  if (existingIndex > -1) {
    const updated = [...current];
    updated[existingIndex] = {
      ...updated[existingIndex],
      qty: updated[existingIndex].qty + 1
    };
    $cartItems.set(updated);
  } else {
    $cartItems.set([...current, { ...product, qty: 1 }]);
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
    updated[index] = { ...updated[index], qty };
    $cartItems.set(updated);
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
  $cartItems.set(current.filter((_, i) => i !== index));
}

// DevTools & Inspect Engine initializer
export function initInspectListeners() {
  if (typeof window === 'undefined') return;

  function checkDevToolsOpen() {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      if (!$isCartOpen.get()) {
        openCart();
      }
    }
  }

  window.addEventListener('resize', checkDevToolsOpen);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && $isCartOpen.get()) {
      closeCart();
      return;
    }

    const isInspectKey =
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'I' ||
          e.key === 'i' ||
          e.key === 'C' ||
          e.key === 'c' ||
          e.key === 'J' ||
          e.key === 'j'));

    if (isInspectKey) {
      openCart();
    }
  });

  window.addEventListener('contextmenu', () => {
    if (!$isCartOpen.get()) {
      openCart();
    }
  });

  // URL hash / params check
  const hasCartHash = window.location.hash === '#cart';
  const hasInspectParam =
    window.location.search.includes('inspect') ||
    window.location.search.includes('cart') ||
    window.location.search.includes('devtools');
  const wasOpen = (() => {
    try {
      return sessionStorage.getItem('cartDrawerOpen') === 'true';
    } catch (e) {
      return false;
    }
  })();

  if (hasCartHash || hasInspectParam || wasOpen) {
    setTimeout(openCart, 50);
  }
  setTimeout(checkDevToolsOpen, 150);
  setInterval(checkDevToolsOpen, 800);
}
