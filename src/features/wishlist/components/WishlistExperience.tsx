import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $wishlistItems,
  $wishlistCount,
  removeFromWishlist,
  clearWishlist
} from '../store/wishlist.store';
import { addToCart, openCart } from '../../cart/store/cart.store';

export const WishlistExperience: React.FC = () => {
  const items = useStore($wishlistItems);
  const count = useStore($wishlistCount);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [sizePickerOpenId, setSizePickerOpenId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Sync with localStorage on client mount in case items exist
    try {
      const raw = localStorage.getItem('deynold_danny_wishlist');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length !== $wishlistItems.get().length) {
          $wishlistItems.set(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAddToCart = (item: (typeof items)[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const chosenSize = selectedSizes[item.id] || (item.sizes && item.sizes[0]) || 'Standard';

    addToCart({
      id: item.id,
      title: item.title,
      price: item.price,
      priceNum: item.priceNum,
      size: chosenSize,
      img: item.image
    });

    openCart();
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromWishlist(id);
  };

  const displayCount = isMounted ? count : 0;
  const displayItems = isMounted ? items : [];

  return (
    <div className="w-full min-h-[70vh] bg-white text-neutral-900">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        {/* Top Breadcrumb matching reference screenshot exactly */}
        <nav aria-label="Breadcrumb" className="mb-8 sm:mb-12">
          <ol className="flex items-center gap-2 text-xs text-neutral-800">
            <li>
              <a
                href="/"
                className="underline underline-offset-4 decoration-neutral-400 hover:text-black transition-colors"
              >
                Home
              </a>
            </li>
            <li className="text-neutral-400 select-none">/</li>
            <li className="font-medium text-neutral-900" aria-current="page">
              My Wishlist
            </li>
          </ol>
        </nav>

        {/* Center Header Section matching reference screenshot */}
        <div className="text-center pb-8 max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-neutral-900 mb-2">
            My Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 tracking-wide font-normal">
            You have {displayCount} {displayCount === 1 ? 'item' : 'items'} on your Wishlist
          </p>
        </div>

        {/* Horizontal Divider Line matching reference screenshot */}
        <div className="w-full border-b border-neutral-200/90 mb-10" />

        {/* Content Section: Empty vs Populated */}
        {displayCount === 0 ? (
          /* Empty State matching reference screenshot */
          <div className="text-center py-12 sm:py-16 space-y-8 animate-in fade-in duration-300">
            <p className="text-xs sm:text-sm text-neutral-700 tracking-wide font-normal max-w-md mx-auto">
              Add products to your Wishlist to see them here.
            </p>

            <div>
              <a
                href="/#mastery"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
              >
                Discover Collection
              </a>
            </div>
          </div>
        ) : (
          /* Populated State with Luxury Product Grid */
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Top Bar with Clear Action */}
            <div className="flex items-center justify-between text-xs font-mono text-neutral-500 uppercase tracking-wider pb-2">
              <span>Saved Pieces ({displayCount})</span>
              <button
                type="button"
                onClick={() => clearWishlist()}
                className="hover:text-black underline underline-offset-4 transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {displayItems.map((item) => {
                const itemHref = item.link || (item.slug ? `/products/${item.slug}` : `/products/${item.id}`);
                const isSizePickerOpen = sizePickerOpenId === item.id;
                const availableSizes = item.sizes || ['46', '48', '50', '52'];

                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col bg-white border border-neutral-100 hover:border-neutral-200 transition-all duration-300 rounded-sm"
                  >
                    {/* Media Container */}
                    <div className="relative bg-[#f5f3ee] aspect-[3/4.4] overflow-hidden">
                      <a href={itemHref} className="block w-full h-full">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </a>

                      {/* Remove from Wishlist Button */}
                      <button
                        type="button"
                        onClick={(e) => handleRemove(item.id, e)}
                        aria-label={`Remove ${item.title} from wishlist`}
                        className="absolute top-2.5 right-2.5 p-2 bg-white/90 hover:bg-white text-rose-600 rounded-full shadow-sm backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 z-10"
                        title="Remove from wishlist"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>

                      {/* Quick Size Selector Overlay */}
                      {isSizePickerOpen && (
                        <div
                          className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-md p-3 border-t border-neutral-200 animate-in slide-in-from-bottom duration-200 z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-2">
                            Select Size:
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {availableSizes.map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSizes({ ...selectedSizes, [item.id]: size });
                                  setSizePickerOpenId(null);
                                }}
                                className={`py-1.5 text-xs font-mono rounded-sm border transition-colors ${
                                  selectedSizes[item.id] === size
                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                    : 'bg-[#faf8f5] text-neutral-800 border-neutral-200 hover:border-black'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 flex flex-col flex-grow justify-between space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-xs uppercase tracking-wide text-neutral-900 font-normal line-clamp-1">
                          <a href={itemHref} className="hover:underline">
                            {item.title}
                          </a>
                        </h3>
                        <p className="text-xs font-mono text-neutral-700">
                          {item.price}
                        </p>
                        {selectedSizes[item.id] && (
                          <span className="inline-block text-[10px] font-mono text-neutral-500 uppercase">
                            Selected size: {selectedSizes[item.id]}
                          </span>
                        )}
                      </div>

                      {/* Add to Bag Button */}
                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(item, e)}
                        className="w-full py-2.5 rounded-full bg-neutral-900 hover:bg-black text-white text-[11px] uppercase tracking-widest font-medium transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      >
                        ADD TO BAG
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

