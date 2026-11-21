import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api/client';

interface CmsSection {
  id: string;
  sectionKey: string;
  sectionType: string;
  title: string;
  sortOrder: number;
  props: Record<string, any>;
}

interface CmsPagePayload {
  id: string;
  slug: string;
  title: string;
  seo?: { title?: string; description?: string };
  sections: CmsSection[];
}

export const LiveCmsPageExperience: React.FC = () => {
  const [page, setPage] = useState<CmsPagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const previewToken = params?.get('dd_preview') || '';
    const slug =
      typeof window !== 'undefined'
        ? decodeURIComponent(window.location.pathname.replace(/^\/pages\//, '').replace(/\/+$/, ''))
        : '';

    const endpoint = previewToken
      ? `/api/storefront/preview?token=${encodeURIComponent(previewToken)}`
      : slug && slug !== 'live'
        ? `/api/storefront/pages/${encodeURIComponent(slug)}`
        : '';

    if (!endpoint) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    apiFetch<any>(endpoint, { skipAuthRefresh: true })
      .then((res) => {
        if (!active) return;
        if (!res.success || !res.data) {
          setNotFound(true);
          return;
        }
        const normalized: CmsPagePayload = res.data.page
          ? {
              id: res.data.page.id,
              slug: res.data.page.slug,
              title: res.data.page.title,
              seo: res.data.page.seo,
              sections: res.data.sections || [],
            }
          : res.data;

        setPage(normalized);
        if (typeof document !== 'undefined') {
          document.title = normalized.seo?.title || `${normalized.title} | DEYNOLD DANNY`;
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 animate-pulse space-y-6">
        <div className="h-10 w-2/3 bg-neutral-200 rounded" />
        <div className="h-4 w-full bg-neutral-100 rounded" />
        <div className="h-4 w-5/6 bg-neutral-100 rounded" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="max-w-xl mx-auto px-6 py-28 text-center">
        <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-400 mb-2">
          House of Deynold Danny
        </p>
        <h1 className="text-2xl font-serif uppercase tracking-wider mb-3">Page Not Found</h1>
        <p className="text-xs text-neutral-600 mb-6">
          This editorial page is unpublished or does not exist.
        </p>
        <a
          href="/"
          className="inline-block px-8 py-3 bg-black text-white text-xs uppercase tracking-widest rounded-full"
        >
          Return Home
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white text-black">
      {page.sections.length === 0 ? (
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl font-serif uppercase tracking-wider">{page.title}</h1>
        </div>
      ) : (
        page.sections.map((sec) => {
          const p = sec.props || {};

          if (sec.sectionType === 'hero_banner') {
            const bgImg = p.desktopImage || p.imageUrl || '/hero-banner.jpg';
            return (
              <section
                key={sec.id}
                className="relative w-full min-h-[62vh] flex items-end bg-neutral-950 text-white overflow-hidden"
              >
                {p.videoUrl ? (
                  <video
                    src={p.videoUrl}
                    poster={bgImg}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <img src={bgImg} alt={p.headline || page.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <div className="relative z-10 max-w-[1440px] mx-auto w-full px-6 sm:px-10 py-14">
                  {p.eyebrow && (
                    <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/80 mb-2">
                      {p.eyebrow}
                    </p>
                  )}
                  <h1 className="text-3xl sm:text-5xl font-serif uppercase tracking-wider max-w-2xl mb-4">
                    {p.headline || page.title}
                  </h1>
                  {p.subheadline && (
                    <p className="text-sm sm:text-base text-white/85 max-w-xl mb-6 font-light">
                      {p.subheadline}
                    </p>
                  )}
                  {p.ctaLabel && p.ctaUrl && (
                    <a
                      href={p.ctaUrl}
                      className="inline-block px-7 py-3 bg-white text-black text-xs uppercase tracking-[0.2em] font-medium hover:bg-neutral-200 transition-colors"
                    >
                      {p.ctaLabel}
                    </a>
                  )}
                </div>
              </section>
            );
          }

          if (sec.sectionType === 'legal_document' || sec.sectionType === 'rich_text') {
            const blocks = Array.isArray(p.blocks) ? p.blocks : [];
            return (
              <article key={sec.id} className="max-w-4xl mx-auto px-6 py-16">
                {p.eyebrow && (
                  <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-neutral-500 mb-3">
                    {p.eyebrow}
                  </p>
                )}
                <h1 className="text-3xl sm:text-4xl font-serif uppercase tracking-wider mb-4">
                  {p.headline || sec.title || page.title}
                </h1>
                {p.intro && (
                  <p className="text-sm sm:text-base text-neutral-600 leading-relaxed mb-10">{p.intro}</p>
                )}
                <div className="space-y-8">
                  {blocks.map((b: any, i: number) => (
                    <section key={i} className="space-y-3">
                      {b.heading && (
                        <h2 className="text-lg font-semibold uppercase tracking-wide text-black">
                          {b.heading}
                        </h2>
                      )}
                      {b.body && (
                        <p className="text-sm leading-7 text-neutral-700 whitespace-pre-line">{b.body}</p>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            );
          }

          if (sec.sectionType === 'editorial_duo' || sec.sectionType === 'category_grid') {
            const items = Array.isArray(p.items) ? p.items : [];
            return (
              <section key={sec.id} className="max-w-[1440px] mx-auto px-6 py-14">
                {sec.title && (
                  <h2 className="text-2xl font-serif uppercase tracking-wider text-center mb-10">
                    {sec.title}
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((item: any, idx: number) => (
                    <a
                      key={idx}
                      href={item.href || '/categories'}
                      className="group relative block aspect-[4/5] overflow-hidden bg-neutral-100"
                    >
                      <img
                        src={item.desktopImage || item.image || '/images/category-abiti.jpg'}
                        alt={item.title || ''}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                      <div className="absolute bottom-6 left-6 right-6 text-white">
                        {item.eyebrow && (
                          <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-80 mb-1">
                            {item.eyebrow}
                          </p>
                        )}
                        <h3 className="text-xl font-serif uppercase tracking-wide">{item.title}</h3>
                        {item.description && (
                          <p className="text-xs text-white/80 mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          }

          if (sec.sectionType === 'announcement') {
            return (
              <div
                key={sec.id}
                className="w-full py-4 px-6 text-center text-xs uppercase tracking-[0.2em]"
                style={{
                  backgroundColor: p.bgColor || '#111111',
                  color: p.textColor || '#ffffff',
                }}
              >
                {p.linkUrl ? (
                  <a href={p.linkUrl} className="hover:underline">
                    {p.text || sec.title}
                  </a>
                ) : (
                  <span>{p.text || sec.title}</span>
                )}
              </div>
            );
          }

          return null;
        })
      )}
    </div>
  );
};

