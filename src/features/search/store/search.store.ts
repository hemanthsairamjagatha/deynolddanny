import { atom } from 'nanostores';

export const $isSearchOpen = atom<boolean>(false);

export function openSearch() {
  $isSearchOpen.set(true);
  if (typeof document !== 'undefined') {
    document.body.classList.add('search-modal-open');
  }
}

export function closeSearch() {
  $isSearchOpen.set(false);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('search-modal-open');
  }
}

export function toggleSearch() {
  if ($isSearchOpen.get()) {
    closeSearch();
  } else {
    openSearch();
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { openSearchModal?: () => void }).openSearchModal = openSearch;
  window.addEventListener('open-search-modal', openSearch);
}
