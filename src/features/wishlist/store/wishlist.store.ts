import { atom, computed } from 'nanostores';
import type { WishlistItem } from '../types/wishlist.types';

const STORAGE_KEY = 'deynold_danny_wishlist';

function loadInitialWishlist(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const $wishlistItems = atom<WishlistItem[]>(loadInitialWishlist());

export const $wishlistCount = computed($wishlistItems, items => items.length);

export function isItemInWishlist(id: string): boolean {
  return $wishlistItems.get().some(item => item.id === id);
}

export function toggleWishlist(item: WishlistItem) {
  const current = $wishlistItems.get();
  const exists = current.some(i => i.id === item.id);
  const updated = exists ? current.filter(i => i.id !== item.id) : [...current, item];
  $wishlistItems.set(updated);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
}

