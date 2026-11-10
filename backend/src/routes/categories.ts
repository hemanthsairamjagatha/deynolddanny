import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import type { DbCategory } from '../types/models.js';
import { getCatalogCache, setCatalogCache } from '../services/cache.js';
import { KV_CATALOG_TTL_SECONDS } from '../config/constants.js';

const categories = new Hono<{ Bindings: Env }>();

// ─── GET /api/categories ─────────────────────────────────────────────────────

categories.get('/', async (c) => {
  const cacheKey = 'catalog:categories:all';
  const cached = await getCatalogCache<DbCategory[]>(c.env.CATALOG_KV, cacheKey);
  if (cached) {
    return c.json({ success: true, data: { items: cached } }, 200, {
      'Cache-Control': 'public, s-maxage=300',
    });
  }

  const result = await c.env.DB
    .prepare(
      `SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC`,
    )
    .all<DbCategory>();

  const items = result.results ?? [];

  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, items, KV_CATALOG_TTL_SECONDS),
  );

  return c.json({ success: true, data: { items } }, 200, {
    'Cache-Control': 'public, s-maxage=300',
  });
});

// ─── GET /api/categories/:slug ───────────────────────────────────────────────

categories.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const cacheKey = `catalog:category:${slug}`;

  const cached = await getCatalogCache<DbCategory>(c.env.CATALOG_KV, cacheKey);
  if (cached) {
    return c.json({ success: true, data: cached }, 200, {
      'Cache-Control': 'public, s-maxage=300',
    });
  }

  const category = await c.env.DB
    .prepare(`SELECT * FROM categories WHERE slug = ?1 AND is_active = 1`)
    .bind(slug)
    .first<DbCategory>();

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found.', status: 404 } },
      404,
    );
  }

  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, category, KV_CATALOG_TTL_SECONDS),
  );

  return c.json({ success: true, data: category }, 200, {
    'Cache-Control': 'public, s-maxage=300',
  });
});

export default categories;

