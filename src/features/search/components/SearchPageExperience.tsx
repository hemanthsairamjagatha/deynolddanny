import React, { useEffect, useState } from 'react';
import { searchCatalog } from '../../catalog/api/catalog.api';
import { allProducts } from '../../catalog/data/products';
import type { ProductCardData } from '../../catalog/types/product.types';
import { ProductCard } from '../../catalog/components/ProductCard';

const SUGGESTED_QUERIES = ['Cashmere', 'Cady Trousers', 'Blazer', 'Silk', 'Suede', 'Evening'];

export const SearchPageExperience: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = async (rawQuery: string, syncUrl = true) => {
    const clean = rawQuery.trim();
    if (syncUrl && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (clean) {
        url.searchParams.set('q', clean);
      } else {
        url.searchParams.delete('q');
      }
      window.history.replaceState({}, '', url.toString());
    }

    if (!clean) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const items = await searchCatalog(clean);
      setResults(items);
    } catch {
      const q = clean.toLowerCase();
      setResults(
        allProducts.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q)),
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initial = new URLSearchParams(window.location.search).get('q') || '';
    if (initial.trim()) {
      setQuery(initial);
      runSearch(initial, false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, true);
  };

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <label htmlFor="storefront-search-input" className="sr-only">
          Search collection
        </label>
        <div className="flex items-center border-b border-neutral-900 pb-3 gap-3">
          <input
            id="storefront-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tailoring, fabrics, silhouettes..."
            className="w-full bg-transparent text-lg sm:text-xl font-light text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium rounded-full transition-colors shrink-0"
          >
            Search
          </button>
        </div>
      </form>

      {!hasSearched && (
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] font-mono text-neutral-500">
            Trending Sartorial Queries
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_QUERIES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  runSearch(term, true);
                }}
                className="px-4 py-2 border border-neutral-300 text-xs uppercase tracking-wider font-mono text-neutral-800 hover:border-black hover:bg-neutral-50 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="py-16 text-center text-xs uppercase tracking-[0.2em] font-mono text-neutral-500">
          Searching collection...
        </div>
      )}

      {!isLoading && hasSearched && results.length === 0 && (
        <div className="max-w-xl mx-auto border border-neutral-200 p-10 text-center space-y-4">
          <h2 className="text-lg font-serif text-neutral-900">
            No garments found matching &ldquo;{query}&rdquo;
          </h2>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Try refining with broader terms such as &ldquo;cashmere&rdquo;, &ldquo;wool&rdquo;, or explore our curated collections.
          </p>
          <a
            href="/categories"
            className="inline-block px-7 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest rounded-full hover:bg-black transition-colors"
          >
            Explore Categories
          </a>
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-6">
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-neutral-500">
            {results.length} garment{results.length === 1 ? '' : 's'} matching &ldquo;{query}&rdquo;
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7">
            {results.map((product) => (
              <div key={product.id} className="w-full">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPageExperience;
