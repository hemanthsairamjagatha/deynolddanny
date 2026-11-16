import { atom, computed } from 'nanostores';
import type { WishlistItem } from '../types/wishlist.types';
import { addWishlistApi, fetchWishlistApi, removeWishlistApi } from '../api/wishlist.api';
import { hasSessionHint } from '../../../lib/api/client';

export type { WishlistItem };

const WISHLIST_STORAGE_KEY = 'dd_wishlist';

function loadInitialWishlist(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

function saveWishlist(items: WishlistItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota exceptions
  }
}

export const $wishlistItems = atom<WishlistItem[]>(loadInitialWishlist());
export const $wishlistCount = computed($wishlistItems, (items) => items.length);

export function isItemInWishlist(id: string): boolean {
  return $wishlistItems.get().some((item) => item.id === id);
}

export async function syncWishlistWithBackend(): Promise<void> {
  if (typeof window === 'undefined' || !hasSessionHint()) return;
  try {
    const res = await fetchWishlistApi();
    if (res.success && res.data?.items) {
      const serverItems: WishlistItem[] = res.data.items.map((w) => {
        const priceNum =
          w.priceNum ?? (w.price_paise ? Math.round(w.price_paise / 100) : 0);
        const priceStr =
          w.price ||
          `₹ ${priceNum.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        return {
          id: w.id,
          slug: w.slug,
          title: w.title,
          price: priceStr,
          priceNum,
          image: w.defaultImg || w.default_img || '/images/placeholder.jpg',
          link: `/products/${w.slug}`,
          sizes: ['46', '48', '50', '52'],
        };
      });

      const localOnly = $wishlistItems
        .get()
        .filter((localItem) => !serverItems.some((s) => s.id === localItem.id));

      // Best-effort sync of local anonymous favorites into user server wishlist
      for (const extra of localOnly) {
        addWishlistApi(extra.id).catch(() => {});
      }

      const merged = [...serverItems, ...localOnly];
      $wishlistItems.set(merged);
      saveWishlist(merged);
    }
  } catch {
    // Fail softly using local cache
  }
}

export function toggleWishlist(item: WishlistItem): void {
  const current = $wishlistItems.get();
  const exists = current.some((i) => i.id === item.id);
  let next: WishlistItem[];

  if (exists) {
    next = current.filter((i) => i.id !== item.id);
    if (hasSessionHint()) {
      removeWishlistApi(item.id).catch(() => {});
    }
  } else {
    next = [...current, { ...item, dateAdded: new Date().toISOString() }];
    if (hasSessionHint()) {
      addWishlistApi(item.id).catch(() => {});
    }
  }

  $wishlistItems.set(next);
  saveWishlist(next);
}

export function removeFromWishlist(id: string): void {
  const next = $wishlistItems.get().filter((i) => i.id !== id);
  $wishlistItems.set(next);
  saveWishlist(next);
  if (hasSessionHint()) {
    removeWishlistApi(id).catch(() => {});
  }
}

export function clearWishlist(): void {
  const existing = $wishlistItems.get();
  $wishlistItems.set([]);
  saveWishlist([]);
  if (hasSessionHint()) {
    for (const item of existing) {
      removeWishlistApi(item.id).catch(() => {});
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === WISHLIST_STORAGE_KEY) {
      $wishlistItems.set(loadInitialWishlist());
    }
  });
}
