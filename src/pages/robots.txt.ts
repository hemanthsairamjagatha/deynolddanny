import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const siteBase = site?.href || 'https://deynolddanny.com';
  const sitemapUrl = new URL('/sitemap.xml', siteBase).href;

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /account',
    'Disallow: /account/',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /checkout/',
    'Disallow: /wishlist',
    'Disallow: /search',
    'Disallow: /orders/',
    'Disallow: /track',
    'Disallow: /login',
    'Disallow: /signup',
    '',
    `Sitemap: ${sitemapUrl}`
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
