import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import type { DbCategory } from '../types/models.js';
import { getCatalogCache, setCatalogCache } from '../services/cache.js';
import { KV_CATALOG_TTL_SECONDS } from '../config/constants.js';

const categories = new Hono<{ Bindings: Env }>();

async function getCatVersion(kv: KVNamespace): Promise<string> {
  try {
    return (await kv.get('catalog:version', 'text')) || 'v1';
  } catch {
    return 'v1';
  }
}

export interface ApiCategoryItem {
  id: string;
  slug: string;
  title: string;
  name: string;
  heroTitle: string;
  hero_title: string;
  eyebrow: string;
  subtitle: string;
  description: string;
  tagline: string;
  imageUrl: string;
  image_url: string;
  mobileImage: string;
  mobile_image: string;
  focalX: number;
  focalY: number;
  sortOrder: number;
  isActive: boolean;
}

function normalizeCategory(r: any): ApiCategoryItem {
  const title = String(r.title ?? r.name ?? '');
  const img = String(r.image_url ?? r.imageUrl ?? '/images/category-abiti.jpg');
  const mob = String(r.mobile_image ?? r.mobileImage ?? img);
  const sub = String(r.subtitle ?? r.description ?? '');
  const hero = String(r.hero_title ?? r.heroTitle ?? title);
  return {
    id: String(r.id ?? ''),
    slug: String(r.slug ?? ''),
    title,
    name: title,
    heroTitle: hero,
    hero_title: hero,
    eyebrow: String(r.eyebrow ?? r.tagline ?? 'SCOPRI ORA'),
    subtitle: sub,
    description: sub,
    tagline: String(r.tagline ?? 'SCOPRI ORA'),
    imageUrl: img,
    image_url: img,
    mobileImage: mob,
    mobile_image: mob,
    focalX: Number(r.focal_x ?? r.focalX ?? 50),
    focalY: Number(r.focal_y ?? r.focalY ?? 35),
    sortOrder: Number(r.sort_order ?? r.sortOrder ?? 0),
    isActive: Number(r.is_active ?? (r.isActive ? 1 : 0)) === 1,
  };
}

const CATEGORY_SLUG_ALIASES: Record<string, string> = {
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

// ─── GET /api/categories ─────────────────────────────────────────────────────

categories.get('/', async (c) => {
  const ver = await getCatVersion(c.env.CATALOG_KV);
  const cacheKey = `catalog:${ver}:categories:all:v2`;
  const cached = await getCatalogCache<ApiCategoryItem[]>(c.env.CATALOG_KV, cacheKey);
  if (cached) {
    return c.json({ success: true, data: { items: cached } }, 200, {
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
  }

  const result = await c.env.DB
    .prepare(
      `SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC`,
    )
    .all<DbCategory>();

  const items = (result.results ?? []).map(normalizeCategory);

  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, items, KV_CATALOG_TTL_SECONDS),
  );

  return c.json({ success: true, data: { items } }, 200, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
  });
});

// ─── GET /api/categories/:slug ───────────────────────────────────────────────

categories.get('/:slug', async (c) => {
  const rawSlug = c.req.param('slug');
  const slug = (rawSlug || '').toLowerCase().trim();
  const canonicalSlug = CATEGORY_SLUG_ALIASES[slug] || slug;

  const ver = await getCatVersion(c.env.CATALOG_KV);
  const cacheKey = `catalog:${ver}:category:${slug}:v2`;

  const cached = await getCatalogCache<ApiCategoryItem>(c.env.CATALOG_KV, cacheKey);
  if (cached) {
    return c.json({ success: true, data: cached }, 200, {
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
  }

  let category = await c.env.DB
    .prepare(`SELECT * FROM categories WHERE (slug = ?1 OR slug = ?2) AND is_active = 1 ORDER BY sort_order ASC LIMIT 1`)
    .bind(slug, canonicalSlug)
    .first<DbCategory>();

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found.', status: 404 } },
      404,
    );
  }

  const mapped = normalizeCategory(category);

  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, mapped, KV_CATALOG_TTL_SECONDS),
  );

  return c.json({ success: true, data: mapped }, 200, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
  });
});

export default categories;

