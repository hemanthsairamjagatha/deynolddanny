import type { APIRoute } from 'astro';
import { fetchProducts } from '../features/catalog/api/catalog.api';

const STATIC_PUBLIC_PATHS = [
  '/',
  '/about',
  '/categories',
  '/contact',
  '/legal/privacy-policy',
  '/legal/shipping-returns',
  '/legal/terms',
  '/legal/cookie-policy'
];

const CATEGORY_SLUGS = [
  'shirts',
  'trousers',
  'knitwear',
  'overcoats',
  'footwear',
  'accessories',
  'clothing',
  'denim-sweatshirts',
  'polo-t-shirts',
  'hoodies',
  'denim-shirts',
  'felpe',
  'scarpe',
  'accessori',
  'outerwear',
  'tailoring'
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteBase = site?.href || 'https://deynolddanny.com';
  const products = await fetchProducts();
  const seen = new Set<string>();
  const urls: Array<{ loc: string; changefreq: string; priority: string }> = [];

  const addUrl = (path: string, changefreq: string, priority: string) => {
    const absolute = new URL(path, siteBase).href;
    if (seen.has(absolute)) return;
    seen.add(absolute);
    urls.push({ loc: absolute, changefreq, priority });
  };

  for (const path of STATIC_PUBLIC_PATHS) {
    addUrl(path, path === '/' ? 'daily' : 'monthly', path === '/' ? '1.0' : '0.6');
  }

  for (const slug of CATEGORY_SLUGS) {
    addUrl(`/categories/${encodeURIComponent(slug)}`, 'weekly', '0.8');
  }

  for (const product of products) {
    if (product?.slug) {
      addUrl(`/products/${encodeURIComponent(product.slug)}`, 'weekly', '0.9');
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
    )
    .join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
