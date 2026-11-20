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

function mapProductCard(
  p: DbProduct,
  variants: DbProductVariant[],
  categorySlug?: string,
  galleryUrls?: string[],
): ApiProductCard {
  const uniqueSizes = [...new Set(variants.map((v) => v.size))];
  const colorMap = new Map<string, string>();
  const variantPrices: number[] = [];
  for (const v of variants) {
    colorMap.set(v.color_name, v.color_hex);
    variantPrices.push(v.price_paise ?? p.price_paise);
  }

  const minPricePaise = variantPrices.length > 0 ? Math.min(...variantPrices) : p.price_paise;
  const maxPricePaise = variantPrices.length > 0 ? Math.max(...variantPrices) : p.price_paise;
  const hasVariantPricing = variantPrices.length > 0 && minPricePaise !== maxPricePaise;
  const displayPricePaise = hasVariantPricing ? minPricePaise : (variantPrices[0] ?? p.price_paise);

  const flatImages =
    galleryUrls && galleryUrls.length > 0
      ? galleryUrls
      : [p.default_img, p.hover_img].filter((u): u is string => Boolean(u && u.trim()));

  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku_prefix,
    title: p.title,
    badge: p.badge ?? null,
    sectionGroup: p.section_group,
    categoryId: p.category_id ?? null,
    category: categorySlug ?? undefined,
    gender: p.gender ?? null,
    tag: p.tag ?? null,
    defaultImg: p.default_img,
    hoverImg: p.hover_img,
    images: flatImages,
    sizes: uniqueSizes,
    colors: Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex })),
    link: `/products/${p.slug}`,
    price: formatPaiseToDisplay(displayPricePaise),
    priceNum: paiseToRupees(displayPricePaise),
    pricePaise: displayPricePaise,
    comparePaise: p.compare_paise ?? null,
    comparePrice: p.compare_paise ? formatPaiseToDisplay(p.compare_paise) : null,
    minPricePaise,
    maxPricePaise,
    hasVariantPricing,
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
  category: z.string().optional(),
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
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
  }

  // Load categories map for slug resolution & enrichment
  const catRows = await c.env.DB
    .prepare(`SELECT id, slug FROM categories`)
    .all<{ id: string; slug: string }>();
  const catSlugById = new Map<string, string>();
  const catIdBySlug = new Map<string, string>();
  for (const r of catRows.results ?? []) {
    catSlugById.set(r.id, r.slug);
    catIdBySlug.set(r.slug.toLowerCase(), r.id);
  }

  let resolvedCategoryId = query.categoryId;
  if (!resolvedCategoryId && query.category) {
    resolvedCategoryId = catIdBySlug.get(query.category.toLowerCase()) ?? query.category;
  }

  const result = await getProducts(c.env.DB, {
    section: query.section,
    categoryId: resolvedCategoryId,
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
    const catSlug = p.category_id ? catSlugById.get(p.category_id) : undefined;
    return mapProductCard(p, variants, catSlug);
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
    'Cache-Control': 'public, max-age=0, must-revalidate',
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
  const mappedVariants = variants.map((v) => {
    const available = Math.max(0, v.stock - v.reserved_stock);
    const effectivePaise = v.price_paise ?? product.price_paise;
    const effectiveComparePaise = v.compare_paise ?? product.compare_paise ?? null;
    return {
      id: v.id,
      sku: v.sku,
      size: v.size,
      colorName: v.color_name,
      colorHex: v.color_hex,
      inStock: available > 0,
      availableStock: available,
      pricePaise: effectivePaise,
      price: formatPaiseToDisplay(effectivePaise),
      priceNum: paiseToRupees(effectivePaise),
      comparePaise: effectiveComparePaise,
      comparePrice: effectiveComparePaise ? formatPaiseToDisplay(effectiveComparePaise) : null,
      hasCustomPrice: v.price_paise !== null && v.price_paise !== undefined,
    };
  });
  const prices = mappedVariants.map((v) => v.pricePaise);
  const minPricePaise = prices.length > 0 ? Math.min(...prices) : product.price_paise;
  const maxPricePaise = prices.length > 0 ? Math.max(...prices) : product.price_paise;

  return c.json(
    {
      success: true,
      data: {
        productId: product.id,
        slug: product.slug,
        pricePaise: product.price_paise,
        price: formatPaiseToDisplay(product.price_paise),
        minPricePaise,
        maxPricePaise,
        hasVariantPricing: prices.length > 0 && minPricePaise !== maxPricePaise,
        variants: mappedVariants,
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
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
  }

  const product = await getProductBySlug(c.env.DB, slug);
  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  const [variants, images, crossSells, catRow] = await Promise.all([
    getProductVariants(c.env.DB, product.id),
    getProductImages(c.env.DB, product.id),
    getProductCrossSells(c.env.DB, product.id),
    product.category_id
      ? c.env.DB.prepare(`SELECT slug FROM categories WHERE id = ?1 LIMIT 1`).bind(product.category_id).first<{ slug: string }>()
      : Promise.resolve(null),
  ]);

  const apiVariants: ApiVariant[] = variants.map((v) => {
    const available = Math.max(0, v.stock - v.reserved_stock);
    const effectivePaise = v.price_paise ?? product.price_paise;
    const effectiveComparePaise = v.compare_paise ?? product.compare_paise ?? null;
    return {
      id: v.id,
      sku: v.sku,
      size: v.size,
      colorName: v.color_name,
      colorHex: v.color_hex,
      inStock: available > 0,
      availableStock: available,
      pricePaise: effectivePaise,
      price: formatPaiseToDisplay(effectivePaise),
      priceNum: paiseToRupees(effectivePaise),
      comparePaise: effectiveComparePaise,
      comparePrice: effectiveComparePaise ? formatPaiseToDisplay(effectiveComparePaise) : null,
      hasCustomPrice: v.price_paise !== null && v.price_paise !== undefined,
    };
  });

  const galleryMap = new Map<string, string[]>();
  const flatGalleryUrls: string[] = [];
  for (const img of images) {
    const groupName = img.color_name || 'Default';
    if (!galleryMap.has(groupName)) galleryMap.set(groupName, []);
    galleryMap.get(groupName)!.push(img.image_url);
    flatGalleryUrls.push(img.image_url);
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

  const combinedImages = Array.from(
    new Set([
      ...(product.default_img ? [product.default_img] : []),
      ...(product.hover_img ? [product.hover_img] : []),
      ...flatGalleryUrls,
    ]),
  );
  const card = mapProductCard(product, variants, catRow?.slug, combinedImages);

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
    'Cache-Control': 'public, max-age=0, must-revalidate',
  });
});

export default products;
