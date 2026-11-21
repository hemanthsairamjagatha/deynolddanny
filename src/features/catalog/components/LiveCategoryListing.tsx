import React, { useEffect, useState } from 'react';
import type { ProductCardData } from '../types/product.types';
import { fetchProducts } from '../api/catalog.api';
import { ProductCard } from './ProductCard';
import { apiFetch } from '../../../lib/api/client';

export interface CategoryListingInitialMeta {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  heroEditorialImg: string;
  heroEditorialTitle: string;
  heroEditorialSubtitle: string;
  duoEditorialLeftImg?: string;
  duoEditorialLeftTitle?: string;
  duoEditorialRightImg?: string;
  duoEditorialRightTitle?: string;
}

interface Props {
  initialCategory?: CategoryListingInitialMeta;
  initialProducts?: ProductCardData[];
  initialTabs?: Array<{ slug: string; title: string }>;
}

function resolveCategorySlug(initial?: CategoryListingInitialMeta): string {
  if (initial?.slug) return initial.slug;
  if (typeof window !== 'undefined') {
    const clean = window.location.pathname.replace(/^\/categories\//, '').replace(/\/+$/, '');
    if (clean && clean !== 'live') return decodeURIComponent(clean);
  }
  return '';
}

export const LiveCategoryListing: React.FC<Props> = ({
  initialCategory,
  initialProducts = [],
  initialTabs = [],
}) => {
  const [category, setCategory] = useState<CategoryListingInitialMeta | null>(initialCategory ?? null);
  const [products, setProducts] = useState<ProductCardData[]>(initialProducts);
  const [tabs, setTabs] = useState<Array<{ slug: string; title: string }>>(initialTabs);
  const [activeColor, setActiveColor] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(!initialCategory);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    const slug = resolveCategorySlug(initialCategory);
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let active = true;

    Promise.all([
      apiFetch<{
        items?: Array<{
          id: string;
          slug: string;
          title?: string;
          name?: string;
          eyebrow?: string;
          heroTitle?: string;
          hero_title?: string;
          subtitle?: string;
          description?: string;
          imageUrl?: string;
          image_url?: string;
        }>;
      }>('/api/categories', { skipAuthRefresh: true }).catch(() => null),
      fetchProducts({ category: slug }).catch(() => null),
      fetchProducts().catch(() => null),
    ])
      .then(([catsRes, catProds, allLiveProds]) => {
        if (!active) return;

        let matchedCat: any;

        if (catsRes?.success && catsRes.data?.items && catsRes.data.items.length > 0) {
          const allCats = catsRes.data.items;
          const sLow = slug.toLowerCase();
          const slugAliasMap: Record<string, string> = {
            overcoats: 'coats',
            outerwear: 'coats',
            'denim-sweatshirts': 'denim-jackets',
            felpe: 'knitwear',
            camicie: 'shirts',
            pantaloni: 'trousers',
            maglieria: 'knitwear',
            abiti: 'tailoring',
            scarpe: 'footwear',
            accessori: 'accessories',
            borse: 'accessories',
          };
          const altSlug = slugAliasMap[sLow];
          matchedCat =
            allCats.find((c: any) => (c.slug || '').toLowerCase() === sLow) ||
            (altSlug ? allCats.find((c: any) => (c.slug || '').toLowerCase() === altSlug) : undefined);

          // If no initial tabs or initial tabs are empty, build tabs cleanly using English categories
          if (!initialTabs || initialTabs.length === 0) {
            const cleanTabs = allCats
              .filter((c: any) => {
                const cSlug = (c.slug || '').toLowerCase();
                return (
                  (c.title || c.name) &&
                  !['abiti', 'camicie', 'capispalla', 'maglieria', 'pantaloni', 'scarpe', 'accessori', 'borse'].includes(cSlug)
                );
              })
              .slice(0, 8)
              .map((c: any) => ({ slug: c.slug, title: c.title || c.name }));
            if (cleanTabs.length > 0) setTabs(cleanTabs);
          }
        }

        if (matchedCat) {
          const catTitle = matchedCat.title || matchedCat.name || initialCategory?.title || '';
          const catHeroTitle = matchedCat.heroTitle || matchedCat.hero_title || catTitle || initialCategory?.heroEditorialTitle || '';
          const catSubtitle = matchedCat.eyebrow || matchedCat.subtitle || matchedCat.description || initialCategory?.subtitle || 'Collezione Atelier';
          const catDesc = matchedCat.subtitle || matchedCat.description || initialCategory?.description || '';
          const catImg = matchedCat.image_url || matchedCat.imageUrl || initialCategory?.heroEditorialImg || '/images/category-abiti.jpg';

          const nextMeta: CategoryListingInitialMeta = {
            slug: matchedCat.slug,
            title: catTitle,
            subtitle: catSubtitle,
            description: catDesc,
            heroEditorialImg: catImg,
            heroEditorialTitle: catHeroTitle,
            heroEditorialSubtitle: matchedCat.eyebrow || initialCategory?.heroEditorialSubtitle || 'Atelier',
            duoEditorialLeftImg: initialCategory?.duoEditorialLeftImg,
            duoEditorialLeftTitle: initialCategory?.duoEditorialLeftTitle,
            duoEditorialRightImg: initialCategory?.duoEditorialRightImg,
            duoEditorialRightTitle: initialCategory?.duoEditorialRightTitle,
          };
          setCategory(nextMeta);
          if (typeof document !== 'undefined' && catTitle) {
            document.title = `${catTitle} | DEYNOLD DANNY`;
          }
          setNotFound(false);
        } else if (!initialCategory) {
          setNotFound(true);
        }

        // Prefer authoritative live D1 products filtered by category slug
        if (catProds && catProds.length > 0) {
          setProducts(catProds);
        } else if (allLiveProds && allLiveProds.length > 0) {
          const sLow = slug.toLowerCase();
          const filtered = allLiveProds.filter(
            (p) =>
              p.category?.toLowerCase() === sLow ||
              p.categoryId?.toLowerCase() === matchedCat?.id?.toLowerCase() ||
              p.title.toLowerCase().includes(sLow.replace(/-/g, ' ')),
          );
          if (filtered.length > 0) {
            setProducts(filtered);
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialCategory?.slug]);

  const availableColors = React.useMemo(() => {
    const map = new Map<string, { name: string; hex: string }>();
    for (const p of products) {
      for (const c of p.colors ?? []) {
        if (!c?.name) continue;
        const key = c.name.toLowerCase();
        if (!map.has(key)) map.set(key, { name: c.name, hex: c.hex || '#111111' });
      }
    }
    return Array.from(map.values());
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    if (!activeColor || activeColor === 'all') return products;
    const cLow = activeColor.toLowerCase();
    const matched = products.filter((p) => (p.colors ?? []).some((c) => c.name.toLowerCase() === cLow));
    return matched.length > 0 ? matched : products;
  }, [products, activeColor]);

  if (loading) {
    return (
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 py-16 animate-pulse space-y-8">
        <div className="h-8 w-56 bg-neutral-200 mx-auto rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] bg-neutral-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 py-24 text-center">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-400 block mb-2">
          Atelier Directory
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif uppercase tracking-wider mb-3">
          Category Not Found
        </h1>
        <p className="text-xs text-neutral-600 max-w-md mx-auto mb-6">
          This category may have been archived or renamed. Explore all active categories below.
        </p>
        <a
          href="/categories"
          className="inline-block px-8 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest rounded-full hover:bg-black transition-colors"
        >
          Browse All Categories
        </a>
      </div>
    );
  }

  const mosaicProducts = filteredProducts.slice(0, 4);
  const secondRowProducts = filteredProducts.slice(4, 7);
  const remainingProducts = filteredProducts.slice(7);

  return (
    <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 pt-8 pb-24">
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-neutral-400 font-mono">
          <li>
            <a href="/" className="hover:text-black transition-colors underline underline-offset-4">
              Home
            </a>
          </li>
          <li className="select-none text-neutral-300">/</li>
          <li>
            <a href="/categories" className="hover:text-black transition-colors">
              Categories
            </a>
          </li>
          <li className="select-none text-neutral-300">/</li>
          <li className="text-neutral-900 font-medium" aria-current="page">
            {category.title}
          </li>
        </ol>
      </nav>

      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <h1 className="text-[36px] font-normal tracking-wider text-neutral-900 uppercase font-montserrat">
          {category.title}
        </h1>
        {category.description && (
          <p className="text-xs sm:text-sm text-neutral-600 font-light mt-2 max-w-lg mx-auto">
            {category.description}
          </p>
        )}
      </div>

      <div className="mastery-categories-bar flex items-center justify-center gap-6 sm:gap-8 overflow-x-auto hide-scrollbar pb-6 mb-6 border-b border-neutral-200/80">
        <a href="/categories" className="mastery-category-tab">
          ALL
        </a>
        {tabs.map((cat) => {
          const isActive = cat.slug.toLowerCase() === category.slug.toLowerCase();
          return (
            <a
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className={`mastery-category-tab ${isActive ? 'is-active' : ''}`}
            >
              {cat.title}
            </a>
          );
        })}
      </div>

      {availableColors.length > 1 && (
        <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mr-1">
            Colour:
          </span>
          <button
            type="button"
            onClick={() => setActiveColor('all')}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] border transition-colors ${activeColor === 'all'
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'
              }`}
          >
            All
          </button>
          {availableColors.map((col) => {
            const isSelected = activeColor.toLowerCase() === col.name.toLowerCase();
            return (
              <button
                key={col.name}
                type="button"
                onClick={() => setActiveColor(isSelected ? 'all' : col.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] border transition-colors ${isSelected
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-900'
                  }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-neutral-300"
                  style={{ backgroundColor: col.hex }}
                />
                <span>{col.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {products.length === 0 ? (
        <div className="border border-neutral-200 p-12 text-center my-8">
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-400 block mb-2">
            Seasonal Atelier Curation
          </span>
          <h2 className="text-xl font-serif text-neutral-900 mb-3">
            No garments currently listed in {category.title}
          </h2>
          <p className="text-xs text-neutral-600 max-w-md mx-auto mb-6">
            New seasonal pieces are currently in preparation. Explore our active tailoring and casual collections below.
          </p>
          <a
            href="/categories"
            className="inline-block px-8 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest rounded-full hover:bg-black transition-colors"
          >
            Browse All Collections
          </a>
        </div>
      ) : (
        <div className="catalog-editorial-grid">
          {mosaicProducts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch mb-10 lg:mb-12">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {mosaicProducts.map((product) => (
                  <div key={product.id} className="flex justify-center w-full">
                    <ProductCard product={product} preferredColorName={activeColor !== 'all' ? activeColor : undefined} />
                  </div>
                ))}
              </div>

              <div className="catalog-editorial-hero relative w-full h-full min-h-[460px] lg:min-h-0 bg-neutral-100 overflow-hidden group">
                <img
                  src={category.heroEditorialImg}
                  alt={category.heroEditorialTitle || category.title}
                  className="w-full h-full object-cover object-top transition-transform duration-1000 ease-out group-hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
                <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 right-6 sm:right-8 text-white">
                  <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.3em] text-white/80 block mb-2">
                    {category.heroEditorialSubtitle}
                  </span>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-serif uppercase tracking-wide text-white mb-2 font-normal">
                    {category.heroEditorialTitle || category.title}
                  </h3>
                  {category.description && (
                    <p className="text-xs text-white/70 max-w-sm line-clamp-2 font-light hidden sm:block">
                      {category.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {secondRowProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-10 lg:mb-12">
              {secondRowProducts.map((product) => (
                <div key={product.id} className="flex justify-center w-full">
                  <ProductCard product={product} preferredColorName={activeColor !== 'all' ? activeColor : undefined} />
                </div>
              ))}
            </div>
          )}

          {category.duoEditorialLeftImg && category.duoEditorialRightImg && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 my-10 lg:my-14">
              <div className="group relative aspect-[4/3] sm:aspect-[16/11] overflow-hidden bg-neutral-100">
                <img
                  src={category.duoEditorialLeftImg}
                  alt={category.duoEditorialLeftTitle || category.title}
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/80 block mb-1">
                    Sartorial Heritage
                  </span>
                  <h4 className="text-lg sm:text-xl font-serif uppercase tracking-wide text-white font-normal">
                    {category.duoEditorialLeftTitle}
                  </h4>
                </div>
              </div>

              <div className="group relative aspect-[4/3] sm:aspect-[16/11] overflow-hidden bg-neutral-100">
                <img
                  src={category.duoEditorialRightImg}
                  alt={category.duoEditorialRightTitle || category.title}
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/80 block mb-1">
                    Atelier Craft
                  </span>
                  <h4 className="text-lg sm:text-xl font-serif uppercase tracking-wide text-white font-normal">
                    {category.duoEditorialRightTitle}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {remainingProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-10 lg:mb-14">
              {remainingProducts.map((product) => (
                <div key={product.id} className="flex justify-center w-full">
                  <ProductCard product={product} preferredColorName={activeColor !== 'all' ? activeColor : undefined} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

