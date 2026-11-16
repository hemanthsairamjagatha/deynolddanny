import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type {
  ApiProductCard,
  ApiProductDetail,
  ApiVariant,
  ApiGalleryGroup,
  ApiCrossSellItem,
} from '../types/api.js';
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
import {
  KV_CATALOG_TTL_SECONDS,
  KV_PRODUCT_TTL_SECONDS,
  DEFAULT_PAGE_SIZE,
} from '../config/constants.js';

const products = new Hono<{ Bindings: Env }>();

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

async function getCatalogCacheVersion(kv: KVNamespace): Promise<string> {
  try {
    return (await kv.get('catalog:version', 'text')) || 'v1';
  } catch {
    return 'v1';
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
  const ver = await getCatalogCacheVersion(c.env.CATALOG_KV);
  const cacheKey = `catalog:${ver}:list:${JSON.stringify(query)}`;

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

  const variantBatch =
    result.products.length > 0
      ? await c.env.DB.batch(
          result.products.map((p) =>
            c.env.DB
              .prepare(
                `SELECT * FROM product_variants WHERE product_id = ?1 AND is_active = 1 ORDER BY sort_order ASC, size ASC`,
              )
              .bind(p.id),
          ),
        )
      : [];

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

  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, responseData, KV_CATALOG_TTL_SECONDS),
  );

  return c.json({ success: true, data: responseData }, 200, {
    'Cache-Control': 'public, s-maxage=300',
  });
});

// ─── GET /api/products/search?q= (must stay BEFORE /:slug route) ─────────────

products.get('/search', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 2) {
    return c.json({ success: true, data: { items: [] } });
  }

  const rows = await searchProducts(c.env.DB, q, 12);
  const items = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    badge: p.badge ?? null,
    defaultImg: p.default_img,
    hoverImg: p.hover_img,
    link: `/products/${p.slug}`,
    price: formatPaiseToDisplay(p.price_paise),
    priceNum: paiseToRupees(p.price_paise),
    pricePaise: p.price_paise,
  }));

  return c.json({ success: true, data: { items } });
});

// ─── GET /api/products/:slug/availability (Uncached real-time stock feed) ──────

products.get('/:slug/availability', async (c) => {
  const slug = c.req.param('slug');
  const product = await getProductBySlug(c.env.DB, slug);
  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  const variants = await getProductVariants(c.env.DB, product.id);
  return c.json(
    {
      success: true,
      data: {
        productId: product.id,
        slug: product.slug,
        pricePaise: product.price_paise,
        price: formatPaiseToDisplay(product.price_paise),
        variants: variants.map((v) => {
          const available = Math.max(0, v.stock - v.reserved_stock);
          return {
            id: v.id,
            size: v.size,
            colorName: v.color_name,
            colorHex: v.color_hex,
            inStock: available > 0,
            availableStock: available,
          };
        }),
      },
    },
    200,
    { 'Cache-Control': 'no-store' },
  );
});

// ─── POST /api/products/:slug/restock-notify ─────────────────────────────────

const restockSchema = z.object({
  email: z.string().email().toLowerCase(),
  variantId: z.string().optional(),
});

products.post('/:slug/restock-notify', zValidator('json', restockSchema), async (c) => {
  const slug = c.req.param('slug');
  const { email, variantId } = c.req.valid('json');
  const product = await getProductBySlug(c.env.DB, slug);
  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  await c.env.DB
    .prepare(
      `INSERT OR IGNORE INTO restock_subscriptions (id, product_id, variant_id, email, status, created_at)
       VALUES (hex(randomblob(8)), ?1, ?2, ?3, 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    )
    .bind(product.id, variantId ?? null, email)
    .run();

  return c.json({
    success: true,
    data: { subscribed: true, message: 'You will be notified when this size returns to stock.' },
  });
});

// ─── GET /api/products/:slug ─────────────────────────────────────────────────

products.get('/:slug', authOptional, async (c) => {
  const slug = c.req.param('slug');
  const ver = await getCatalogCacheVersion(c.env.CATALOG_KV);
  const cacheKey = `catalog:${ver}:product:${slug}`;

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

  const [variants, images, crossSells] = await Promise.all([
    getProductVariants(c.env.DB, product.id),
    getProductImages(c.env.DB, product.id),
    getProductCrossSells(c.env.DB, product.id),
  ]);

  const apiVariants: ApiVariant[] = variants.map((v) => {
    const available = Math.max(0, v.stock - v.reserved_stock);
    return {
      id: v.id,
      size: v.size,
      colorName: v.color_name,
      colorHex: v.color_hex,
      inStock: available > 0,
      availableStock: available,
    };
  });

  const galleryMap = new Map<string, string[]>();
  for (const img of images) {
    if (!galleryMap.has(img.color_name)) galleryMap.set(img.color_name, []);
    galleryMap.get(img.color_name)!.push(img.image_url);
  }
  const gallery: ApiGalleryGroup[] = Array.from(galleryMap.entries()).map(([colorName, imgs]) => ({
    colorName,
    images: imgs,
  }));

  const mapCrossSell = (cs: (typeof crossSells)[number]): ApiCrossSellItem => ({
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

  c.executionCtx.waitUntil(
    setCatalogCache(c.env.CATALOG_KV, cacheKey, detail, KV_PRODUCT_TTL_SECONDS),
  );

  return c.json({ success: true, data: detail }, 200, {
    'Cache-Control': 'public, s-maxage=60',
  });
});

export default products;
