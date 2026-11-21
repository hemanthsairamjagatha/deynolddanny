import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api/client';
import type { ProductCardData } from '../types/product.types';
import { ProductCard } from './ProductCard';

interface CollectionSummary {
  id: string;
  slug: string;
  title: string;
  eyebrow?: string;
  description?: string;
  heroImage?: string;
  mobileImage?: string;
}

interface CollectionDetail extends CollectionSummary {
  products: Array<{
    id: string;
    slug: string;
    title: string;
    badge?: string | null;
    defaultImg: string;
    hoverImg: string;
    link: string;
    price: string;
    priceNum: number;
  }>;
}

interface Props {
  mode: 'index' | 'detail';
}

export const LiveCollectionExperience: React.FC<Props> = ({ mode }) => {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    if (mode === 'index') {
      apiFetch<{ items?: CollectionSummary[] }>('/api/storefront/collections', { skipAuthRefresh: true })
        .then((res) => {
          if (!active) return;
          if (res.success && res.data?.items) setCollections(res.data.items);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      const slug =
        typeof window !== 'undefined'
          ? decodeURIComponent(window.location.pathname.replace(/^\/collections\//, '').replace(/\/+$/, ''))
          : '';
      if (!slug || slug === 'live') {
        setNotFound(true);
        setLoading(false);
        return;
      }
      apiFetch<CollectionDetail>(`/api/storefront/collections/${encodeURIComponent(slug)}`, {
        skipAuthRefresh: true,
      })
        .then((res) => {
          if (!active) return;
          if (res.success && res.data) {
            setDetail(res.data);
            if (typeof document !== 'undefined') {
              document.title = `${res.data.title} | DEYNOLD DANNY`;
            }
          } else {
            setNotFound(true);
          }
        })
        .catch(() => {
          if (active) setNotFound(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [mode]);

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-20 animate-pulse space-y-6">
        <div className="h-8 w-64 bg-neutral-200 mx-auto rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="aspect-[4/5] bg-neutral-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'index') {
    return (
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 pt-8 pb-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-[11px] uppercase tracking-[0.3em] font-mono text-neutral-500 block mb-2">
            Seasonal Capsules
          </span>
          <h1 className="text-[36px] font-normal tracking-wider text-neutral-900 uppercase font-montserrat mb-4">
            Collections
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
            Curated capsules celebrating architectural tailoring, artisanal textiles, and timeless Indian craftsmanship.
          </p>
        </div>

        {collections.length === 0 ? (
          <div className="border border-neutral-200 p-12 text-center">
            <p className="text-sm text-neutral-600 mb-6">Explore our complete category directory while new capsules prepare.</p>
            <a
              href="/categories"
              className="inline-block px-8 py-3 bg-black text-white text-xs uppercase tracking-widest rounded-full"
            >
              Browse Categories
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map((c) => (
              <a
                key={c.id}
                href={`/collections/${c.slug}`}
                className="group relative block aspect-[4/5] overflow-hidden bg-neutral-100"
              >
                <img
                  src={c.heroImage || '/images/category-abiti.jpg'}
                  alt={c.title}
                  className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  {c.eyebrow && (
                    <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/80 block mb-1">
                      {c.eyebrow}
                    </span>
                  )}
                  <h2 className="text-2xl font-serif uppercase tracking-wide mb-2">{c.title}</h2>
                  <span className="text-[11px] font-mono uppercase tracking-widest group-hover:underline">
                    Explore Capsule &rarr;
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-400 mb-2">
          Atelier Capsule
        </p>
        <h1 className="text-2xl font-serif uppercase tracking-wider mb-3">Collection Not Found</h1>
        <p className="text-xs text-neutral-600 mb-6">This curated collection is no longer active.</p>
        <a
          href="/collections"
          className="inline-block px-8 py-3 bg-black text-white text-xs uppercase tracking-widest rounded-full"
        >
          View All Collections
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white text-black">
      {detail.heroImage && (
        <section className="relative w-full h-[52vh] min-h-[360px] overflow-hidden bg-neutral-900 text-white">
          <img
            src={detail.heroImage}
            alt={detail.title}
            className="w-full h-full object-cover object-center opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div className="absolute bottom-10 left-0 right-0 max-w-[1440px] mx-auto px-6 sm:px-10">
            {detail.eyebrow && (
              <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/80 mb-2">
                {detail.eyebrow}
              </p>
            )}
            <h1 className="text-3xl sm:text-5xl font-serif uppercase tracking-wider mb-3">{detail.title}</h1>
            {detail.description && (
              <p className="text-sm text-white/85 max-w-xl font-light">{detail.description}</p>
            )}
          </div>
        </section>
      )}

      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 py-16">
        {!detail.heroImage && (
          <div className="text-center max-w-2xl mx-auto mb-12">
            {detail.eyebrow && (
              <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-neutral-500 mb-2">
                {detail.eyebrow}
              </p>
            )}
            <h1 className="text-3xl sm:text-4xl font-serif uppercase tracking-wider mb-3">{detail.title}</h1>
            {detail.description && <p className="text-sm text-neutral-600">{detail.description}</p>}
          </div>
        )}

        {detail.products.length === 0 ? (
          <div className="border border-neutral-200 p-12 text-center">
            <p className="text-sm text-neutral-600">Pieces for this capsule are currently being curated.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {detail.products.map((p) => {
              const cardData: ProductCardData = {
                id: p.id,
                slug: p.slug,
                title: p.title,
                price: p.price,
                priceNum: p.priceNum,
                badge: p.badge ?? null,
                defaultImg: p.defaultImg,
                hoverImg: p.hoverImg || p.defaultImg,
                link: p.link,
                sizes: ['S', 'M', 'L', 'XL'],
              };
              return <ProductCard key={p.id} product={cardData} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

