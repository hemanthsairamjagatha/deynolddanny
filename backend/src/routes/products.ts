import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiProductCard, ApiProductDetail, ApiVariant, ApiGalleryGroup, ApiCrossSellItem } from '../types/api.js';
import type { DbProduct, DbProductVariant } from '../types/models.js';
import { authOptional } from '../middleware/auth.js';
import {
  getProducts,
  getProductBySlug,
  getProductVariants,
  getProductImages,
  getProductCrossSells,
  searchProducts,
} from '../db/queries/products.js';
import { getCatalogCache, setCatalogCache } from '../services/cache.js';
import { formatPaiseToDisplay, paiseToRupees } from '../services/money.js';
import { KV_CATALOG_TTL_SECONDS, KV_PRODUCT_TTL_SECONDS, DEFAULT_PAGE_SIZE } from '../config/constants.js';

const products = new Hono<{ Bindings: Env }>();

// ─── Mapper helpers ─────────────────────────────────────────────────────────

function mapProductCard(p: DbProduct, variants: DbProductVariant[]): ApiProductCard {
  const uniqueSizes = [...new Set(variants.map((v) => v.size))];
  const colorMap = new Map<string, string>();
  for (const v of variants) {
    colorMap.set(v.color_name, v.color_hex);
  }

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    badge: p.badge ?? null,
    defaultImg: p.default_img,
    hoverImg: p.hover_img,
    sizes: uniqueSizes,
    colors: Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex })),
    link: `/products/${p.slug}`,
    price: formatPaiseToDisplay(p.price_paise),
    priceNum: paiseToRupees(p.price_paise),
    pricePaise: p.price_paise,
  };
}

function safeParseJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── GET /api/products ───────────────────────────────────────────────────────

const listQuerySchema = z.object({
  section: z.string().optional(),
  categoryId: z.string().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'featured']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(DEFAULT_PAGE_SIZE),
  featured: z.coerce.boolean().optional(),
});

products.get('/', zValidator('query', listQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const cacheKey = `catalog:list:${JSON.stringify(query)}`;

  // Check KV cache first
  const cached = await getCatalogCache<unknown>(c.env.CATALOG_KV, cacheKey);
  if (cached) {
    return c.json({ success: true, data: cached }, 200, {
      'Cache-Control': 'public, s-maxage=300',
    });
  }

  const result = await getProducts(c.env.DB, {
    section: query.section,
    categoryId: query.categoryId,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
    featured: query.featured,
  });

  // Fetch variants for all products in a single batch
  const variantBatch = await c.env.DB.batch(
    result.products.map((p) =>
      c.env.DB
        .prepare(`SELECT * FROM product_variants WHERE product_id = ?1 AND is_active = 1 ORDER BY size ASC`)
        .bind(p.id),
    ),
  );

  const productCards: ApiProductCard[] = result.products.map((p, i) => {
    const variants = (variantBatch[i]?.results ?? []) as DbProductVariant[];
    return mapProductCard(p, variants);
  });

  const responseData = {
    items: productCards,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };

  // Write to KV cache (non-blocking)
  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, responseData, KV_CATALOG_TTL_SECONDS),
  );

  return c.json({ success: true, data: responseData }, 200, {
    'Cache-Control': 'public, s-maxage=300',
  });
});

// ─── GET /api/products/:slug ─────────────────────────────────────────────────

products.get('/:slug', authOptional, async (c) => {
  const slug = c.req.param('slug');
  const cacheKey = `catalog:product:${slug}`;

  // Check KV cache
  const cached = await getCatalogCache<ApiProductDetail>(c.env.CATALOG_KV, cacheKey);
  if (cached) {
    return c.json({ success: true, data: cached }, 200, {
      'Cache-Control': 'public, s-maxage=60',
    });
  }

  const product = await getProductBySlug(c.env.DB, slug);
  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  // Fetch variants, images, cross-sells in parallel
  const [variants, images, crossSells] = await Promise.all([
    getProductVariants(c.env.DB, product.id),
    getProductImages(c.env.DB, product.id),
    getProductCrossSells(c.env.DB, product.id),
  ]);

  // Map variants — never expose raw stock
  const apiVariants: ApiVariant[] = variants.map((v) => ({
    id: v.id,
    size: v.size,
    colorName: v.color_name,
    colorHex: v.color_hex,
    inStock: v.stock - v.reserved_stock > 0,
    availableStock: v.stock - v.reserved_stock,
  }));

  // Group gallery by color_name
  const galleryMap = new Map<string, string[]>();
  for (const img of images) {
    if (!galleryMap.has(img.color_name)) galleryMap.set(img.color_name, []);
    galleryMap.get(img.color_name)!.push(img.image_url);
  }
  const gallery: ApiGalleryGroup[] = Array.from(galleryMap.entries()).map(([colorName, imgs]) => ({
    colorName,
    images: imgs,
  }));

  // Cross-sells
  const mapCrossSell = (cs: typeof crossSells[number]): ApiCrossSellItem => ({
    id: cs.id,
    title: cs.title,
    price: formatPaiseToDisplay(cs.price_paise),
    priceNum: paiseToRupees(cs.price_paise),
    image: cs.default_img,
    link: `/products/${cs.slug}`,
    badge: cs.badge ?? undefined,
  });

  const styleItWith = crossSells
    .filter((cs) => cs.relation_type === 'style_it_with')
    .map(mapCrossSell);
  const related = crossSells
    .filter((cs) => cs.relation_type === 'related')
    .map(mapCrossSell);

  const card = mapProductCard(product, variants);

  const detail: ApiProductDetail = {
    ...card,
    description: product.description ?? null,
    material: product.material ?? null,
    careGuide: product.care_guide ?? null,
    gender: product.gender ?? null,
    tag: product.tag ?? null,
    sizeAndFit: safeParseJson(product.size_and_fit_json),
    compositionCare: safeParseJson(product.composition_care_json),
    shippingReturns: safeParseJson(product.shipping_returns_json),
    variants: apiVariants,
    gallery,
    crossSells: { styleItWith, related },
  };

  // Cache product detail (60s)
  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, detail, KV_PRODUCT_TTL_SECONDS),
  );

  return c.json({ success: true, data: detail }, 200, {
    'Cache-Control': 'public, s-maxage=60',
  });
});

// ─── GET /api/products/search?q= ────────────────────────────────────────────

products.get('/search', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 2) {
    return c.json({ success: true, data: { items: [] } });
  }

  const rows = await searchProducts(c.env.DB, q, 10);

  // Minimal card for search results (no variants needed)
  const items = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    badge: p.badge ?? null,
    defaultImg: p.default_img,
    link: `/products/${p.slug}`,
    price: formatPaiseToDisplay(p.price_paise),
    priceNum: paiseToRupees(p.price_paise),
    pricePaise: p.price_paise,
  }));

  return c.json({ success: true, data: { items } });
});

export default products;

