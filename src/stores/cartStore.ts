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

// Drawer keyboard & URL hash initializer
export function initInspectListeners() {
  if (typeof window === 'undefined') return;

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
