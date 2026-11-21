import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api/client';

export interface LiveCategoryCard {
  id?: string;
  slug: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  image: string;
}

interface Props {
  initialFeatured: LiveCategoryCard[];
  initialAll: Array<{ slug: string; title: string }>;
}

export const LiveCategoriesDirectory: React.FC<Props> = ({ initialFeatured, initialAll }) => {
  const [categories, setCategories] = useState<LiveCategoryCard[]>(initialFeatured);
  const [taxonomy, setTaxonomy] = useState<Array<{ slug: string; title: string }>>(initialAll);

  useEffect(() => {
    let active = true;
    apiFetch<{
      items?: Array<{
        id: string;
        slug: string;
        title?: string;
        name?: string;
        eyebrow?: string;
        subtitle?: string;
        description?: string;
        imageUrl?: string;
        image_url?: string;
      }>;
    }>('/api/categories', { skipAuthRefresh: true })
      .then((res) => {
        if (!active || !res.success || !res.data?.items || res.data.items.length === 0) return;
        const liveCards: LiveCategoryCard[] = res.data.items
          .filter((c: any) => {
            const slug = (c.slug || '').toLowerCase();
            return !['abiti', 'camicie', 'capispalla', 'maglieria', 'pantaloni', 'scarpe', 'accessori', 'borse'].includes(slug);
          })
          .map((c: any) => ({
            id: c.id,
            slug: c.slug,
            title: c.title || c.name || '',
            eyebrow: c.eyebrow || c.tagline || 'SCOPRI ORA',
            subtitle: c.subtitle || c.description || '',
            image: c.image_url || c.imageUrl || '/images/category-abiti.jpg',
          }));
        if (liveCards.length > 0) {
          setCategories(liveCards);
          setTaxonomy(liveCards.map((c) => ({ slug: c.slug, title: c.title })));
        }
      })
      .catch(() => { });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-16">
        {categories.map((cat) => (
          <a
            key={cat.slug}
            href={`/categories/${cat.slug}`}
            className="group relative block aspect-[4/5] overflow-hidden bg-neutral-100 rounded-sm shadow-sm hover:shadow-md transition-all"
          >
            <img
              src={cat.image.startsWith('/') || cat.image.startsWith('http') ? cat.image : `/${cat.image}`}
              alt={cat.title}
              className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-white/80 block mb-1">
                {cat.eyebrow || 'SCOPRI ORA'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal uppercase tracking-wide mb-2 text-white">
                {cat.title}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-white/90 group-hover:underline">
                View Collection &rarr;
              </span>
            </div>
          </a>
        ))}
      </div>

      <div className="border-t border-neutral-200 pt-12">
        <h3 className="text-xs font-mono uppercase tracking-[0.25em] text-neutral-400 text-center mb-8">
          Complete Sartorial Taxonomy
        </h3>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {taxonomy.map((cat) => (
            <a
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="px-5 py-2.5 rounded-full border border-neutral-200 text-neutral-800 text-xs font-mono uppercase tracking-wider hover:border-black hover:bg-black hover:text-white transition-all"
            >
              {cat.title}
            </a>
          ))}
        </div>
      </div>
    </>
  );
};

