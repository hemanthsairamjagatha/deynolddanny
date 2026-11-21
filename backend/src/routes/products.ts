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

const CANONICAL_CATEGORY_SLUG_MAP: Record<string, string> = {
  'cat-abiti': 'tailoring',
  'cat-suits': 'suits',
  'cat-tailoring': 'tailoring',
  'cat-camicie': 'shirts',
  'cat-shirts': 'shirts',
  'cat-maglieria': 'knitwear',
  'cat-knitwear': 'knitwear',
  'cat-sweaters': 'sweaters',
  'cat-pantaloni': 'trousers',
  'cat-trousers': 'trousers',
  'cat-capispalla': 'coats',
  'cat-coats': 'coats',
  'cat-jackets': 'jackets',
  'cat-scarpe': 'footwear',
  'cat-footwear': 'footwear',
  'cat-accessori': 'accessories',
  'cat-accessories': 'accessories',
  'cat-borse': 'accessories',
  'cat-clothing': 'clothing',
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  shirts: ['cat-shirts', 'cat-camicie', 'cat-denim-shirts'],
  camicie: ['cat-camicie', 'cat-shirts'],
  'denim-shirts': ['cat-denim-shirts', 'cat-shirts', 'cat-camicie'],
  trousers: ['cat-trousers', 'cat-pantaloni'],
  pantaloni: ['cat-pantaloni', 'cat-trousers'],
  knitwear: ['cat-knitwear', 'cat-maglieria', 'cat-sweaters', 'cat-felpe'],
  maglieria: ['cat-maglieria', 'cat-knitwear', 'cat-sweaters'],
  sweaters: ['cat-sweaters', 'cat-knitwear', 'cat-maglieria', 'cat-felpe'],
  felpe: ['cat-felpe', 'cat-knitwear', 'cat-maglieria', 'cat-sweaters'],
  suits: ['cat-suits', 'cat-tailoring', 'cat-abiti'],
  tailoring: ['cat-tailoring', 'cat-suits', 'cat-abiti'],
  abiti: ['cat-abiti', 'cat-suits', 'cat-tailoring'],
  clothing: ['cat-clothing', 'cat-abiti', 'cat-suits', 'cat-tailoring'],
  coats: ['cat-coats', 'cat-capispalla', 'cat-jackets', 'cat-leather-jackets'],
  overcoats: ['cat-coats', 'cat-capispalla', 'cat-jackets'],
  capispalla: ['cat-capispalla', 'cat-coats', 'cat-jackets'],
  outerwear: ['cat-coats', 'cat-capispalla', 'cat-jackets', 'cat-leather-jackets'],
  jackets: ['cat-jackets', 'cat-capispalla', 'cat-coats', 'cat-leather-jackets', 'cat-denim-jackets'],
  'leather-jackets': ['cat-leather-jackets', 'cat-jackets', 'cat-coats', 'cat-capispalla'],
  'denim-jackets': ['cat-denim-jackets', 'cat-jackets', 'cat-coats', 'cat-denim-sweatshirts', 'cat-shirts'],
  'denim-sweatshirts': ['cat-denim-jackets', 'cat-jackets', 'cat-knitwear', 'cat-shirts'],
  'polo-t-shirts': ['cat-polo-t-shirts', 'cat-shirts', 'cat-knitwear'],
  hoodies: ['cat-hoodies', 'cat-sweaters', 'cat-knitwear'],
  't-shirts': ['cat-t-shirts', 'cat-polo-t-shirts', 'cat-shirts', 'cat-knitwear'],
  footwear: ['cat-footwear', 'cat-scarpe'],
  scarpe: ['cat-scarpe', 'cat-footwear'],
  accessories: ['cat-accessories', 'cat-accessori', 'cat-borse'],
  accessori: ['cat-accessori', 'cat-accessories', 'cat-borse'],
  borse: ['cat-borse', 'cat-accessories', 'cat-accessori'],
};

function mapProductCard(
  p: DbProduct,
  variants: DbProductVariant[],
  categorySlug?: string,
  galleryUrls?: string[],
  productImages?: Array<{ color_name?: string | null; image_url: string }>,
): ApiProductCard {
  const uniqueSizes = [...new Set(variants.map((v) => v.size))];
  const colorMap = new Map<string, string>();
  const variantPrices: number[] = [];

  const apiVariants: ApiVariant[] = variants.map((v) => {
    const available = Math.max(0, v.stock - v.reserved_stock);
    const effectivePaise = v.price_paise ?? p.price_paise;
    const effectiveComparePaise = v.compare_paise ?? p.compare_paise ?? null;
    colorMap.set(v.color_name, v.color_hex);
    variantPrices.push(effectivePaise);
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

  const minPricePaise = variantPrices.length > 0 ? Math.min(...variantPrices) : p.price_paise;
  const maxPricePaise = variantPrices.length > 0 ? Math.max(...variantPrices) : p.price_paise;
  const hasVariantPricing = variantPrices.length > 0 && minPricePaise !== maxPricePaise;
  const displayPricePaise = hasVariantPricing ? minPricePaise : (variantPrices[0] ?? p.price_paise);

  const imgUrlsFromRows = (productImages ?? []).map((x) => x.image_url).filter(Boolean);
  const flatImages = Array.from(
    new Set(
      [
        ...(galleryUrls && galleryUrls.length > 0 ? galleryUrls : []),
        ...imgUrlsFromRows,
        p.default_img,
        p.hover_img,
      ].filter((u): u is string => Boolean(u && u.trim())),
    ),
  );

  const colors = Array.from(colorMap.entries()).map(([name, hex], idx) => {
    const colorVars = apiVariants.filter((v) => v.colorName.toLowerCase() === name.toLowerCase());
    const cPrices = colorVars.map((v) => v.pricePaise);
    const cMinPaise = cPrices.length > 0 ? Math.min(...cPrices) : displayPricePaise;
    const cComparePaise =
      colorVars.find((v) => v.comparePaise != null)?.comparePaise ?? p.compare_paise ?? null;
    const cHasCustomPrice = colorVars.some((v) => v.hasCustomPrice) || cMinPaise !== p.price_paise;

    const colorSpecificImgs = (productImages ?? [])
      .filter((img) => (img.color_name ?? '').trim().toLowerCase() === name.toLowerCase())
      .map((img) => img.image_url)
      .filter(Boolean);

    const fallbackPrimary =
      idx === 0 ? p.default_img : flatImages[idx % Math.max(1, flatImages.length)] || p.hover_img || p.default_img;
    const fallbackHover =
      idx === 0 ? p.hover_img || p.default_img : flatImages[(idx + 1) % Math.max(1, flatImages.length)] || p.default_img;

    const primaryImg = colorSpecificImgs[0] || fallbackPrimary;
    const hoverImg = colorSpecificImgs[1] || (colorSpecificImgs[0] ? p.hover_img || colorSpecificImgs[0] : fallbackHover);

    return {
      name,
      hex,
      img: primaryImg,
      hoverImg,
      swatchImg: primaryImg,
      images: colorSpecificImgs.length > 0 ? colorSpecificImgs : [primaryImg, hoverImg].filter(Boolean),
      pricePaise: cMinPaise,
      price: formatPaiseToDisplay(cMinPaise),
      priceNum: paiseToRupees(cMinPaise),
      comparePaise: cComparePaise,
      comparePrice: cComparePaise ? formatPaiseToDisplay(cComparePaise) : null,
      hasCustomPrice: cHasCustomPrice,
    };
  });

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
    colors,
    variants: apiVariants,
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

  let resolvedCategoryIds: string[] | undefined;
  if (query.categoryId) {
    resolvedCategoryIds = [query.categoryId];
  } else if (query.category) {
    const qCat = query.category.toLowerCase().trim();
    const aliasGroup = CATEGORY_ALIASES[qCat];
    if (aliasGroup && aliasGroup.length > 0) {
      resolvedCategoryIds = aliasGroup;
    } else {
      const singleId = catIdBySlug.get(qCat) ?? query.category;
      resolvedCategoryIds = [singleId];
    }
  }

  const result = await getProducts(c.env.DB, {
    section: query.section,
    categoryId: resolvedCategoryIds,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
    featured: query.featured,
  });

  const [variantBatch, imageBatch] =
    result.products.length > 0
      ? await Promise.all([
          c.env.DB.batch(
            result.products.map((p) =>
              c.env.DB
                .prepare(
                  `SELECT * FROM product_variants WHERE product_id = ?1 AND is_active = 1 ORDER BY sort_order ASC, size ASC`,
                )
                .bind(p.id),
            ),
          ),
          c.env.DB.batch(
            result.products.map((p) =>
              c.env.DB
                .prepare(
                  `SELECT color_name, image_url FROM product_images WHERE product_id = ?1 ORDER BY sort_order ASC`,
                )
                .bind(p.id),
            ),
          ),
        ])
      : [[], []];

  const productCards: ApiProductCard[] = result.products.map((p, i) => {
    const variants = (variantBatch[i]?.results ?? []) as DbProductVariant[];
    const prodImages = (imageBatch[i]?.results ?? []) as Array<{ color_name?: string | null; image_url: string }>;
    const catSlug = p.category_id
      ? (CANONICAL_CATEGORY_SLUG_MAP[p.category_id] ?? catSlugById.get(p.category_id))
      : undefined;
    return mapProductCard(p, variants, catSlug, undefined, prodImages);
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
  const card = mapProductCard(product, variants, catRow?.slug, combinedImages, images);

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
