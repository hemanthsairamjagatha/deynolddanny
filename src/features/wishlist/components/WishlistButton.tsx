import React from 'react';
import { useStore } from '@nanostores/react';
import { $wishlistItems, toggleWishlist } from '../store/wishlist.store';
import type { WishlistItem } from '../types/wishlist.types';

interface WishlistButtonProps {
  item: WishlistItem;
  className?: string;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({ item, className = '' }) => {
  const wishlist = useStore($wishlistItems);
  const isWishlisted = wishlist.some((i) => i.id === item.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(item);
      }}
      aria-label={isWishlisted ? `Remove ${item.title} from wishlist` : `Save ${item.title} to wishlist`}
      className={`p-2 transition-colors focus:outline-none ${className}`}
    >
      {isWishlisted ? (
        <svg className="w-5 h-5 fill-rose-600 text-rose-600" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="1.4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )}
    </button>
  );
};

export default WishlistButton;

