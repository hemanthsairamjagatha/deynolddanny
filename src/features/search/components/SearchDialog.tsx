import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $isSearchOpen, closeSearch } from '../store/search.store';
import { searchCatalog } from '../../catalog/api/catalog.api';
import type { ProductCardData } from '../../catalog/types/product.types';

export const SearchDialog: React.FC = () => {
  const isOpen = useStore($isSearchOpen);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Debounced search against Cloudflare Worker backend
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchCatalog(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const popularSearches = ['Cashmere', 'Virgin Wool', 'Trousers', 'Overcoat', 'Silk', 'Oxford'];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white/98 backdrop-blur-md transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Search Catalog"
    >
      {/* Top Header Bar */}
      <div className="max-w-5xl w-full mx-auto px-6 py-6 sm:py-8 flex items-center justify-between border-b border-neutral-100">
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400">
          Search the Flagship
        </span>
        <button
          type="button"
          onClick={closeSearch}
          className="p-2 text-neutral-500 hover:text-neutral-900 transition-colors uppercase text-xs tracking-widest font-mono flex items-center gap-2"
          aria-label="Close search"
        >
          <span>Close</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main Search Input */}
      <div className="max-w-5xl w-full mx-auto px-6 pt-8 pb-4 flex-1 overflow-y-auto">
        <div className="relative border-b-2 border-neutral-900 pb-3 flex items-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-neutral-400 mr-4 shrink-0"
          >
            <circle cx="10.5" cy="10.5" r="7.5" />
            <line x1="21" y1="21" x2="16" y2="16" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by garment, fabric, or color..."
            className="w-full bg-transparent text-xl sm:text-2xl font-light tracking-wide text-neutral-900 placeholder:text-neutral-300 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs uppercase tracking-widest text-neutral-400 hover:text-neutral-900 font-mono ml-3"
            >
              Clear
            </button>
          )}
        </div>

        {/* Popular Tags when query is empty */}
        {!query.trim() && (
          <div className="pt-8">
            <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-400 mb-4">
              Trending Sartorial Searches
            </p>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="px-3.5 py-1.5 border border-neutral-200 text-xs tracking-wider uppercase text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 transition-colors rounded-none font-mono"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-16 text-center text-xs tracking-widest uppercase text-neutral-400 font-mono">
            Searching Cloudflare catalog...
          </div>
        )}

        {/* Results List */}
        {!isLoading && query.trim() && results.length > 0 && (
          <div className="pt-8 pb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-400 mb-6">
              Found {results.length} garment{results.length > 1 ? 's' : ''} matching "{query}"
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 sm:gap-8">
              {results.map((product) => {
                const link = product.link || `/products/${product.slug || product.id}`;
                return (
                  <a
                    key={product.id}
                    href={link}
                    onClick={closeSearch}
                    className="group flex flex-col text-neutral-900 text-left"
                  >
                    <div className="aspect-[3/4] w-full bg-neutral-100 overflow-hidden relative mb-3">
                      <img
                        src={product.defaultImg}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-neutral-400 mb-1">
                      {product.tag || 'Sartorial'}
                    </span>
                    <h4 className="text-xs font-medium tracking-wide uppercase line-clamp-1 mb-1">
                      {product.title}
                    </h4>
                    <p className="text-xs text-neutral-600 font-light font-mono">
                      {product.price}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && query.trim() && results.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-sm font-light text-neutral-500 mb-2 font-serif italic text-lg">
              No bespoke garments found matching "{query}".
            </p>
            <p className="text-xs text-neutral-400 font-mono">
              Try searching for a broader term such as "cashmere", "wool", or "trousers".
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchDialog;
