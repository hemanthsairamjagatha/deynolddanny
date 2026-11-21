import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import {
  getAllProductsAdmin,
  getProductById,
  upsertProduct,
  getProductVariants,
} from '../../db/queries/products.js';
import { invalidateCatalogCache } from '../../services/cache.js';
import { recordInventoryMovements } from '../../services/stockEngine.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache, safeJsonParse } from '../../services/storefrontCache.js';

const adminProducts = new Hono<{ Bindings: Env }>();

async function bumpCatalogCacheVersion(kv: KVNamespace, slug?: string) {
  try {
    await kv.put('catalog:version', `v_${Date.now()}`);
  } catch { }
  if (slug) {
    await invalidateCatalogCache(kv, `catalog:product:${slug}`, 'catalog:categories:all');
  }
}

// ─── GET /api/admin/products ─────────────────────────────────────────────────
adminProducts.get('/', requirePermission('catalog.read'), async (c) => {
  const q = c.req.query('q')?.trim().toLowerCase() ?? '';
  const categoryId = c.req.query('categoryId')?.trim();
  const sectionGroup = c.req.query('sectionGroup')?.trim();
  const color = c.req.query('color')?.trim().toLowerCase();
  const status = c.req.query('status')?.trim(); // 'active', 'archived', 'all'
  const sort = c.req.query('sort')?.trim() || 'featured';
  const rawPage = Number(c.req.query('page') ?? '1');
  const rawLimit = Number(c.req.query('limit') ?? '100');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(200, Math.floor(rawLimit)) : 100;
  const offset = (page - 1) * limit;

  let whereClause = ` WHERE 1=1`;
  const bindings: any[] = [];

  if (status === 'archived') {
    whereClause += ` AND p.is_active = 0`;
  } else if (status !== 'all') {
    whereClause += ` AND p.is_active = 1`;
  }

  if (categoryId) {
    bindings.push(categoryId);
    whereClause += ` AND p.category_id = ?${bindings.length}`;
  }

  if (sectionGroup) {
    bindings.push(sectionGroup);
    whereClause += ` AND p.section_group = ?${bindings.length}`;
  }

  if (color) {
    bindings.push(color);
    whereClause += ` AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND LOWER(pv.color_name) = ?${bindings.length})`;
  }

  if (q) {
    bindings.push(`%${q}%`);
    whereClause += ` AND (LOWER(p.title) LIKE ?${bindings.length} OR LOWER(p.slug) LIKE ?${bindings.length} OR LOWER(p.sku_prefix) LIKE ?${bindings.length})`;
  }

  const sortOrderMap: Record<string, string> = {
    featured: 'p.sort_order ASC, p.created_at DESC',
    newest: 'p.created_at DESC',
    price_asc: 'p.price_paise ASC',
    price_desc: 'p.price_paise DESC',
    title_asc: 'LOWER(p.title) ASC',
    stock_asc: 'total_stock ASC, p.title ASC',
  };
  const orderBy = sortOrderMap[sort] ?? sortOrderMap.featured;

  const dataSql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_count,
      (SELECT COALESCE(SUM(v.stock), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS total_stock,
      (SELECT MIN(COALESCE(v.price_paise, p.price_paise)) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS min_price_paise,
      (SELECT MAX(COALESCE(v.price_paise, p.price_paise)) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS max_price_paise
    FROM products p
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}
  `;

  const [countRes, rows, variantColorsRes] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM products p ${whereClause}`).bind(...bindings).first<{ cnt: number }>(),
    c.env.DB.prepare(dataSql).bind(...bindings, limit, offset).all<Record<string, unknown>>(),
    c.env.DB
      .prepare(
        `SELECT product_id, color_name, color_hex, MIN(COALESCE(price_paise, 0)) AS custom_price_paise
         FROM product_variants
         WHERE is_active = 1
         GROUP BY product_id, color_name, color_hex
         ORDER BY sort_order ASC`,
      )
      .all<{ product_id: string; color_name: string; color_hex: string; custom_price_paise: number }>(),
  ]);

  const colorsByProduct = new Map<string, Array<{ name: string; hex: string }>>();
  const globalColorMap = new Map<string, { name: string; hex: string }>();
  for (const vc of variantColorsRes.results ?? []) {
    if (!vc.color_name) continue;
    const list = colorsByProduct.get(vc.product_id) ?? [];
    if (!list.some((x) => x.name.toLowerCase() === vc.color_name.toLowerCase())) {
      list.push({ name: vc.color_name, hex: vc.color_hex || '#111111' });
      colorsByProduct.set(vc.product_id, list);
    }
    const key = vc.color_name.toLowerCase();
    if (!globalColorMap.has(key)) {
      globalColorMap.set(key, { name: vc.color_name, hex: vc.color_hex || '#111111' });
    }
  }

  const enrichedItems = (rows.results ?? []).map((p) => ({
    ...p,
    colors: colorsByProduct.get(String(p.id)) ?? [],
  }));
  const total = Number(countRes?.cnt ?? enrichedItems.length);

  return c.json({
    success: true,
    data: {
      items: enrichedItems,
      availableColors: Array.from(globalColorMap.values()),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

// ─── POST /api/admin/products/bulk ───────────────────────────────────────────
const bulkProductsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['activate', 'archive', 'set_section_group', 'set_category', 'set_featured']),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

adminProducts.post(
  '/bulk',
  requirePermission('catalog.write'),
  zValidator('json', bulkProductsSchema),
  async (c) => {
    const { ids, action, value } = c.req.valid('json');
    const now = nowIso();
    const placeholders = ids.map((_, i) => `?${i + 2}`).join(', ');

    if (action === 'activate') {
      await c.env.DB
        .prepare(`UPDATE products SET is_active = 1, updated_at = ?1 WHERE id IN (${placeholders})`)
        .bind(now, ...ids)
        .run();
    } else if (action === 'archive') {
      await c.env.DB
        .prepare(`UPDATE products SET is_active = 0, updated_at = ?1 WHERE id IN (${placeholders})`)
        .bind(now, ...ids)
        .run();
    } else if (action === 'set_section_group') {
      const group = String(value || '');
      if (!['mastery', 'style_space', 'news'].includes(group)) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid section_group.', status: 400 } }, 400);
      }
      const p2 = ids.map((_, i) => `?${i + 3}`).join(', ');
      await c.env.DB
        .prepare(`UPDATE products SET section_group = ?1, updated_at = ?2 WHERE id IN (${p2})`)
        .bind(group, now, ...ids)
        .run();
    } else if (action === 'set_category') {
      const catId = value ? String(value) : null;
      const p2 = ids.map((_, i) => `?${i + 3}`).join(', ');
      await c.env.DB
        .prepare(`UPDATE products SET category_id = ?1, updated_at = ?2 WHERE id IN (${p2})`)
        .bind(catId, now, ...ids)
        .run();
    } else if (action === 'set_featured') {
      const feat = value ? 1 : 0;
      const p2 = ids.map((_, i) => `?${i + 3}`).join(', ');
      await c.env.DB
        .prepare(`UPDATE products SET is_featured = ?1, updated_at = ?2 WHERE id IN (${p2})`)
        .bind(feat, now, ...ids)
        .run();
    }

    await bumpCatalogCacheVersion(c.env.CATALOG_KV);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'BULK_UPDATE_PRODUCTS', 'product', 'bulk', { action, value, count: ids.length });

    return c.json({ success: true, data: { updated: ids.length } });
  },
);

// ─── GET /api/admin/products/:id ─────────────────────────────────────────────
adminProducts.get('/:id', requirePermission('catalog.read'), async (c) => {
  const id = c.req.param('id');
  const product = await c.env.DB
    .prepare(`SELECT * FROM products WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<Record<string, unknown>>();

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  const [variantsRes, imagesRes, crossSellsRes] = await Promise.all([
    c.env.DB
      .prepare(`SELECT * FROM product_variants WHERE product_id = ?1 ORDER BY sort_order ASC, size ASC`)
      .bind(id)
      .all(),
    c.env.DB
      .prepare(`SELECT * FROM product_images WHERE product_id = ?1 ORDER BY sort_order ASC`)
      .bind(id)
      .all(),
    c.env.DB
      .prepare(
        `SELECT pcs.*, p.title as target_title, p.slug as target_slug, p.default_img as target_img, p.price_paise as target_price
         FROM product_cross_sells pcs
         INNER JOIN products p ON p.id = pcs.target_product_id
         WHERE pcs.product_id = ?1
         ORDER BY pcs.sort_order ASC`,
      )
      .bind(id)
      .all(),
  ]);

  return c.json({
    success: true,
    data: {
      ...product,
      size_and_fit: safeJsonParse(String(product.size_and_fit_json ?? '[]'), []),
      composition_care: safeJsonParse(String(product.composition_care_json ?? '[]'), []),
      shipping_returns: safeJsonParse(String(product.shipping_returns_json ?? '[]'), []),
      variants: variantsRes.results ?? [],
      images: imagesRes.results ?? [],
      crossSells: crossSellsRes.results ?? [],
    },
  });
});

// ─── POST /api/admin/products ────────────────────────────────────────────────
const createProductSchema = z.object({
  id: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  sku_prefix: z.string().min(2).max(40),
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  material: z.string().optional(),
  care_guide: z.string().optional(),
  gender: z.string().optional(),
  tag: z.string().optional(),
  price_paise: z.number().int().positive(),
  compare_paise: z.number().int().positive().nullable().optional(),
  badge: z.string().max(50).nullable().optional(),
  section_group: z.enum(['mastery', 'style_space', 'news']).default('mastery'),
  category_id: z.string().nullable().optional(),
  default_img: z.string().max(500).default(''),
  hover_img: z.string().max(500).default(''),
  hsn_code: z.string().max(20).nullable().optional(),
  gst_rate_bps: z.number().int().min(0).max(2800).nullable().optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).default(1),
  is_featured: z.union([z.literal(0), z.literal(1)]).default(0),
  sort_order: z.number().int().default(0),
  size_and_fit: z.array(z.string()).optional(),
  composition_care: z.array(z.string()).optional(),
  shipping_returns: z.array(z.string()).optional(),
});

adminProducts.post(
  '/',
  requirePermission('catalog.write'),
  zValidator('json', createProductSchema),
  async (c) => {
    const adminId = c.get('userId');
    const body = c.req.valid('json');
    if (body.compare_paise !== undefined && body.compare_paise !== null && body.compare_paise <= body.price_paise) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_DISCOUNT',
            message: 'Compare / MRP price must be strictly greater than the selling price.',
            status: 400,
          },
        },
        400,
      );
    }
    const id = body.id || `prod_${Date.now().toString(36)}_${generateId('').slice(0, 4)}`;

    const existing = await c.env.DB
      .prepare(`SELECT id FROM products WHERE slug = ?1 LIMIT 1`)
      .bind(body.slug)
      .first();

    if (existing) {
      return c.json(
        { success: false, error: { code: 'CONFLICT', message: `Product with slug '${body.slug}' already exists.`, status: 409 } },
        409,
      );
    }

    const now = nowIso();
    await c.env.DB
      .prepare(
        `INSERT INTO products (
           id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
           size_and_fit_json, composition_care_json, shipping_returns_json,
           price_paise, compare_paise, badge, section_group, category_id,
           default_img, hover_img, hsn_code, gst_rate_bps,
           is_active, is_featured, sort_order, created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
           ?10, ?11, ?12,
           ?13, ?14, ?15, ?16, ?17,
           ?18, ?19, ?20, ?21,
           ?22, ?23, ?24, ?25, ?25
         )`,
      )
      .bind(
        id,
        body.slug,
        body.sku_prefix,
        body.title,
        body.description ?? null,
        body.material ?? null,
        body.care_guide ?? null,
        body.gender ?? 'Unisex',
        body.tag ?? null,
        JSON.stringify(body.size_and_fit ?? []),
        JSON.stringify(body.composition_care ?? []),
        JSON.stringify(body.shipping_returns ?? []),
        body.price_paise,
        body.compare_paise ?? null,
        body.badge ?? null,
        body.section_group,
        body.category_id ?? null,
        body.default_img,
        body.hover_img,
        body.hsn_code ?? '6203',
        body.gst_rate_bps ?? 1200,
        body.is_active,
        body.is_featured,
        body.sort_order,
        now,
      )
      .run();

    await bumpCatalogCacheVersion(c.env.CATALOG_KV, body.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'CREATE_PRODUCT', 'product', id, { slug: body.slug });

    return c.json({ success: true, data: { id, slug: body.slug } }, 201);
  },
);

// ─── PATCH /api/admin/products/:id ───────────────────────────────────────────
const updateProductSchema = createProductSchema.partial();

adminProducts.patch(
  '/:id',
  requirePermission('catalog.write'),
  zValidator('json', updateProductSchema),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const existing = await c.env.DB
      .prepare(`SELECT * FROM products WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<{ slug: string; price_paise: number; compare_paise: number | null }>();

    if (!existing) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
        404,
      );
    }

    const effectivePrice = body.price_paise !== undefined ? body.price_paise : existing.price_paise;
    const effectiveCompare = body.compare_paise !== undefined ? body.compare_paise : existing.compare_paise;
    if (effectiveCompare !== null && effectiveCompare !== undefined && effectiveCompare <= effectivePrice) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_DISCOUNT',
            message: 'Compare / MRP price must be strictly greater than the selling price.',
            status: 400,
          },
        },
        400,
      );
    }

    const sets: string[] = ['updated_at = ?1'];
    const bindings: any[] = [nowIso()];
    const add = (col: string, val: any) => {
      sets.push(`${col} = ?${bindings.length + 1}`);
      bindings.push(val);
    };

    if (body.slug !== undefined) add('slug', body.slug);
    if (body.sku_prefix !== undefined) add('sku_prefix', body.sku_prefix);
    if (body.title !== undefined) add('title', body.title);
    if (body.description !== undefined) add('description', body.description);
    if (body.material !== undefined) add('material', body.material);
    if (body.care_guide !== undefined) add('care_guide', body.care_guide);
    if (body.gender !== undefined) add('gender', body.gender);
    if (body.tag !== undefined) add('tag', body.tag);
    if (body.price_paise !== undefined) add('price_paise', body.price_paise);
    if (body.compare_paise !== undefined) add('compare_paise', body.compare_paise);
    if (body.badge !== undefined) add('badge', body.badge);
    if (body.section_group !== undefined) add('section_group', body.section_group);
    if (body.category_id !== undefined) add('category_id', body.category_id);
    if (body.default_img !== undefined) add('default_img', body.default_img);
    if (body.hover_img !== undefined) add('hover_img', body.hover_img);
    if (body.hsn_code !== undefined) add('hsn_code', body.hsn_code);
    if (body.gst_rate_bps !== undefined) add('gst_rate_bps', body.gst_rate_bps);
    if (body.is_active !== undefined) add('is_active', body.is_active);
    if (body.is_featured !== undefined) add('is_featured', body.is_featured);
    if (body.sort_order !== undefined) add('sort_order', body.sort_order);
    if (body.size_and_fit !== undefined) add('size_and_fit_json', JSON.stringify(body.size_and_fit));
    if (body.composition_care !== undefined) add('composition_care_json', JSON.stringify(body.composition_care));
    if (body.shipping_returns !== undefined) add('shipping_returns_json', JSON.stringify(body.shipping_returns));

    bindings.push(id);
    await c.env.DB
      .prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?${bindings.length}`)
      .bind(...bindings)
      .run();

    await bumpCatalogCacheVersion(c.env.CATALOG_KV, body.slug ?? existing.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'UPDATE_PRODUCT', 'product', id, body);

    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── POST /api/admin/products/:id/duplicate ──────────────────────────────────
adminProducts.post('/:id/duplicate', requirePermission('catalog.write'), async (c) => {
  const id = c.req.param('id');
  const src = await c.env.DB
    .prepare(`SELECT * FROM products WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<Record<string, any>>();

  if (!src) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
  }

  const suffix = Date.now().toString(36).slice(-4);
  const newId = `prod_${suffix}_${generateId('').slice(0, 4)}`;
  const newSlug = `${src.slug}-copy-${suffix}`;
  const now = nowIso();

  await c.env.DB
    .prepare(
      `INSERT INTO products (
         id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
         size_and_fit_json, composition_care_json, shipping_returns_json,
         price_paise, compare_paise, badge, section_group, category_id,
         default_img, hover_img, hsn_code, gst_rate_bps,
         is_active, is_featured, sort_order, created_at, updated_at
       ) VALUES (
         ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
         ?10, ?11, ?12,
         ?13, ?14, ?15, ?16, ?17,
         ?18, ?19, ?20, ?21,
         0, 0, ?22, ?23, ?23
       )`,
    )
    .bind(
      newId,
      newSlug,
      `${src.sku_prefix}-C`,
      `${src.title} (Copy)`,
      src.description,
      src.material,
      src.care_guide,
      src.gender,
      src.tag,
      src.size_and_fit_json,
      src.composition_care_json,
      src.shipping_returns_json,
      src.price_paise,
      src.compare_paise,
      src.badge,
      src.section_group,
      src.category_id,
      src.default_img,
      src.hover_img,
      src.hsn_code,
      src.gst_rate_bps,
      (src.sort_order ?? 0) + 1,
      now,
    )
    .run();

  // Copy variants (including custom variant pricing) and gallery images
  const [srcVars, srcImgs] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM product_variants WHERE product_id = ?1`).bind(id).all<Record<string, any>>(),
    c.env.DB.prepare(`SELECT * FROM product_images WHERE product_id = ?1 ORDER BY sort_order ASC`).bind(id).all<Record<string, any>>(),
  ]);

  const copyStmts: D1PreparedStatement[] = [];
  for (const v of srcVars.results ?? []) {
    const newVarId = `${newId}-${v.size}-${generateId('').slice(0, 4)}`;
    copyStmts.push(
      c.env.DB
        .prepare(
          `INSERT INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, compare_paise, stock, reserved_stock, is_active, sort_order, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 1, ?10, ?11, ?11)`,
        )
        .bind(
          newVarId,
          newId,
          `${v.sku}-C${suffix.toUpperCase()}`,
          v.size,
          v.color_name,
          v.color_hex,
          v.price_paise ?? null,
          v.compare_paise ?? null,
          v.stock,
          v.sort_order,
          now,
        ),
    );
  }
  for (const img of srcImgs.results ?? []) {
    copyStmts.push(
      c.env.DB
        .prepare(
          `INSERT INTO product_images (id, product_id, image_url, alt_text, color_name, sort_order)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(generateId('pimg_'), newId, img.image_url, img.alt_text ?? '', img.color_name ?? '', img.sort_order ?? 0),
    );
  }
  if (copyStmts.length > 0) {
    await c.env.DB.batch(copyStmts);
  }

  await auditAdminAction(c, 'DUPLICATE_PRODUCT', 'product', newId, { from: id, slug: newSlug });
  return c.json({ success: true, data: { id: newId, slug: newSlug } }, 201);
});

// ─── POST /api/admin/products/:id/restore ────────────────────────────────────
adminProducts.post('/:id/restore', requirePermission('catalog.write'), async (c) => {
  const id = c.req.param('id');
  const p = await c.env.DB.prepare(`SELECT id, slug FROM products WHERE id = ?1`).bind(id).first<{ slug: string }>();
  if (!p) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
  }

  await c.env.DB.prepare(`UPDATE products SET is_active = 1, updated_at = ?1 WHERE id = ?2`).bind(nowIso(), id).run();
  await bumpCatalogCacheVersion(c.env.CATALOG_KV, p.slug);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'RESTORE_PRODUCT', 'product', id);

  return c.json({ success: true, data: { restored: true } });
});

// ─── DELETE /api/admin/products/:id ──────────────────────────────────────────
adminProducts.delete('/:id', requirePermission('catalog.delete'), async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT id, slug FROM products WHERE id = ?1`).bind(id).first<{ id: string; slug: string }>();
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
  }

  await c.env.DB
    .prepare(`UPDATE products SET is_active = 0, updated_at = ?1 WHERE id = ?2`)
    .bind(nowIso(), id)
    .run();

  await bumpCatalogCacheVersion(c.env.CATALOG_KV, existing.slug);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'ARCHIVE_PRODUCT', 'product', id, { slug: existing.slug });

  return c.json({ success: true, data: { archived: true } });
});

// ─── POST /api/admin/products/:id/variants ───────────────────────────────────
const createVariantSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  sku: z.string().min(2).max(80),
  size: z.string().min(1).max(30),
  color_name: z.string().min(1).max(50).optional(),
  color: z.string().min(1).max(50).optional(),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#111111'),
  price_paise: z.number().int().positive().nullable().optional(),
  compare_paise: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).default(0),
  sort_order: z.number().int().default(0),
});

adminProducts.post(
  '/:id/variants',
  requirePermission('catalog.write'),
  zValidator('json', createVariantSchema),
  async (c) => {
    const productId = c.req.param('id');
    const body = c.req.valid('json');
    const colorName = (body.color_name || body.color || 'Default').trim();

    const product = await c.env.DB
      .prepare(`SELECT id, slug, price_paise FROM products WHERE id = ?1`)
      .bind(productId)
      .first<{ id: string; slug: string; price_paise: number }>();
    if (!product) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
    }

    const effectivePrice = body.price_paise ?? product.price_paise;
    if (body.compare_paise !== undefined && body.compare_paise !== null && body.compare_paise <= effectivePrice) {
      return c.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Variant Compare/MRP price must exceed selling price.', status: 400 } },
        400,
      );
    }

    const [dupCombo, dupSku] = await Promise.all([
      c.env.DB
        .prepare(
          `SELECT id FROM product_variants WHERE product_id = ?1 AND LOWER(size) = LOWER(?2) AND LOWER(color_name) = LOWER(?3) LIMIT 1`,
        )
        .bind(productId, body.size.trim(), colorName)
        .first<{ id: string }>(),
      c.env.DB
        .prepare(`SELECT id FROM product_variants WHERE LOWER(sku) = LOWER(?1) LIMIT 1`)
        .bind(body.sku.trim())
        .first<{ id: string }>(),
    ]);
    if (dupCombo) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_VARIANT',
            message: `Variant combination "${colorName} / ${body.size.trim()}" already exists on this product.`,
            status: 409,
          },
        },
        409,
      );
    }
    if (dupSku) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_SKU',
            message: `SKU "${body.sku.trim()}" is already assigned to another variant.`,
            status: 409,
          },
        },
        409,
      );
    }

    const variantId = body.id || `${productId}-${body.size.replace(/\s+/g, '')}-${generateId('').slice(0, 6)}`;
    const now = nowIso();

    await c.env.DB
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, compare_paise, stock, reserved_stock, is_active, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 1, ?10, ?11, ?11)`,
      )
      .bind(
        variantId,
        productId,
        body.sku,
        body.size,
        colorName,
        body.color_hex,
        body.price_paise ?? null,
        body.compare_paise ?? null,
        body.stock,
        body.sort_order,
        now,
      )
      .run();

    if (body.stock > 0) {
      await recordInventoryMovements(c.env.DB, [
        {
          variantId,
          movementType: 'admin_adjust',
          qtyDelta: body.stock,
          actorId: c.get('userId'),
          notes: `Initial stock for new variant ${body.sku}`,
        },
      ]);
    }

    await bumpCatalogCacheVersion(c.env.CATALOG_KV, product.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'CREATE_VARIANT', 'product_variant', variantId, { ...body, color_name: colorName });

    return c.json({ success: true, data: { variantId } }, 201);
  },
);

// ─── POST /api/admin/products/:id/variants/matrix ────────────────────────────
// Bulk creates combinations of Sizes × Colors with optional per-size and per-color pricing & color images
const matrixSchema = z.object({
  sizes: z.array(z.string().min(1)).min(1),
  colors: z.array(z.object({ name: z.string().min(1), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })).min(1),
  initialStock: z.number().int().min(0).default(5),
  sizePrices: z.record(z.string(), z.number().int().positive().nullable()).optional(),
  sizeComparePrices: z.record(z.string(), z.number().int().positive().nullable()).optional(),
  colorPrices: z.record(z.string(), z.number().int().positive().nullable()).optional(),
  colorImages: z.record(z.string(), z.string()).optional(),
});

adminProducts.post(
  '/:id/variants/matrix',
  requirePermission('catalog.write'),
  zValidator('json', matrixSchema),
  async (c) => {
    const productId = c.req.param('id');
    const { sizes, colors, initialStock, sizePrices, sizeComparePrices, colorPrices, colorImages } = c.req.valid('json');

    const product = await c.env.DB
      .prepare(`SELECT id, slug, sku_prefix, title FROM products WHERE id = ?1`)
      .bind(productId)
      .first<{ id: string; slug: string; sku_prefix: string; title: string }>();

    if (!product) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
    }

    const existingVarsRes = await c.env.DB
      .prepare(`SELECT id, size, color_name FROM product_variants WHERE product_id = ?1`)
      .bind(productId)
      .all<{ id: string; size: string; color_name: string }>();
    const existingByCombo = new Map<string, string>();
    for (const ev of existingVarsRes.results ?? []) {
      existingByCombo.set(`${ev.color_name.trim().toLowerCase()}::${ev.size.trim().toLowerCase()}`, ev.id);
    }

    const now = nowIso();
    let order = 1;
    const stmts: D1PreparedStatement[] = [];
    const createdVariants: string[] = [];

    for (const color of colors) {
      const cleanColorName = color.name.trim();
      for (const size of sizes) {
        const cleanSize = size.trim();
        const comboKey = `${cleanColorName.toLowerCase()}::${cleanSize.toLowerCase()}`;
        const existingId = existingByCombo.get(comboKey);
        const pricePaise = sizePrices?.[cleanSize] ?? colorPrices?.[cleanColorName] ?? null;
        const comparePaise = sizeComparePrices?.[cleanSize] ?? null;

        if (existingId) {
          createdVariants.push(existingId);
          stmts.push(
            c.env.DB
              .prepare(
                `UPDATE product_variants
                 SET price_paise = COALESCE(?1, price_paise),
                     compare_paise = COALESCE(?2, compare_paise),
                     color_name = ?3,
                     color_hex = ?4,
                     is_active = 1,
                     updated_at = ?5
                 WHERE id = ?6 AND product_id = ?7`,
              )
              .bind(pricePaise, comparePaise, cleanColorName, color.hex, now, existingId, productId),
          );
        } else {
          const sku = `${product.sku_prefix}-${cleanColorName.slice(0, 3).toUpperCase()}-${cleanSize.replace(/\s+/g, '')}-${generateId('').slice(0, 3).toUpperCase()}`;
          const varId = `${productId}-${cleanColorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cleanSize.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          createdVariants.push(varId);
          stmts.push(
            c.env.DB
              .prepare(
                `INSERT INTO product_variants
                 (id, product_id, sku, size, color_name, color_hex, price_paise, compare_paise, stock, reserved_stock, is_active, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 1, ?10, ?11, ?11)
                 ON CONFLICT(id) DO UPDATE SET
                   price_paise = COALESCE(excluded.price_paise, product_variants.price_paise),
                   compare_paise = COALESCE(excluded.compare_paise, product_variants.compare_paise),
                   color_name = excluded.color_name,
                   color_hex = excluded.color_hex,
                   is_active = 1,
                   updated_at = excluded.updated_at`,
              )
              .bind(varId, productId, sku, cleanSize, cleanColorName, color.hex, pricePaise, comparePaise, initialStock, order++, now),
          );
        }
      }

      const colorImgUrl = colorImages?.[cleanColorName]?.trim();
      if (colorImgUrl) {
        const imgId = `img_${productId}_${cleanColorName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_0`;
        stmts.push(
          c.env.DB
            .prepare(
              `INSERT INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)
               ON CONFLICT(id) DO UPDATE SET
                 image_url = excluded.image_url,
                 color_name = excluded.color_name`,
            )
            .bind(imgId, productId, cleanColorName, colorImgUrl, `${product.title} — ${cleanColorName}`, order),
        );
      }
    }

    await c.env.DB.batch(stmts);
    await bumpCatalogCacheVersion(c.env.CATALOG_KV, product.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'GENERATE_VARIANT_MATRIX', 'product', productId, {
      count: createdVariants.length,
      hasSizePrices: Boolean(sizePrices),
      hasColorPrices: Boolean(colorPrices),
    });

    return c.json({ success: true, data: { count: createdVariants.length, variantIds: createdVariants } }, 201);
  },
);

// ─── PATCH /api/admin/products/:id/variants/bulk-price ───────────────────────
// Updates size-wise OR color-wise prices, hexes, and stock in bulk
const bulkVariantPriceSchema = z.object({
  updates: z
    .array(
      z.object({
        variantId: z.string().min(1).optional(),
        size: z.string().min(1).optional(),
        color_name: z.string().min(1).optional(),
        new_color_name: z.string().min(1).optional(),
        color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        price_paise: z.number().int().positive().nullable().optional(),
        compare_paise: z.number().int().positive().nullable().optional(),
        stock: z.number().int().min(0).optional(),
        is_active: z.union([z.literal(0), z.literal(1)]).optional(),
      }),
    )
    .min(1),
});

adminProducts.patch(
  '/:id/variants/bulk-price',
  requirePermission('catalog.write'),
  zValidator('json', bulkVariantPriceSchema),
  async (c) => {
    const productId = c.req.param('id');
    const adminId = c.get('userId');
    const { updates } = c.req.valid('json');
    const product = await c.env.DB
      .prepare(`SELECT id, slug, price_paise FROM products WHERE id = ?1`)
      .bind(productId)
      .first<{ id: string; slug: string; price_paise: number }>();
    if (!product) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
    }

    // Load current variants for stock delta logging & compare_paise validation
    const existingVarsRes = await c.env.DB
      .prepare(`SELECT id, size, color_name, price_paise, stock, reserved_stock FROM product_variants WHERE product_id = ?1`)
      .bind(productId)
      .all<{ id: string; size: string; color_name: string; price_paise: number | null; stock: number; reserved_stock: number }>();
    const varById = new Map((existingVarsRes.results ?? []).map((v) => [v.id, v]));

    const now = nowIso();
    const stmts: D1PreparedStatement[] = [];
    const stockMovements: Array<{ variantId: string; qtyDelta: number; notes: string }> = [];

    for (const u of updates) {
      if (u.variantId) {
        const cur = varById.get(u.variantId);
        const effPrice = u.price_paise !== undefined ? (u.price_paise ?? product.price_paise) : (cur?.price_paise ?? product.price_paise);
        if (u.compare_paise !== undefined && u.compare_paise !== null && u.compare_paise <= effPrice) {
          return c.json(
            { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Variant Compare/MRP price must exceed selling price.', status: 400 } },
            400,
          );
        }
        const sets: string[] = [];
        const binds: unknown[] = [];
        if (u.price_paise !== undefined) {
          binds.push(u.price_paise);
          sets.push(`price_paise = ?${binds.length}`);
        }
        if (u.compare_paise !== undefined) {
          binds.push(u.compare_paise);
          sets.push(`compare_paise = ?${binds.length}`);
        }
        if (u.color_name !== undefined) {
          binds.push(u.color_name.trim());
          sets.push(`color_name = ?${binds.length}`);
        }
        if (u.color_hex !== undefined) {
          binds.push(u.color_hex);
          sets.push(`color_hex = ?${binds.length}`);
        }
        if (u.stock !== undefined) {
          const clampedStock = cur ? Math.max(cur.reserved_stock, u.stock) : u.stock;
          if (cur && clampedStock !== cur.stock) {
            stockMovements.push({
              variantId: u.variantId,
              qtyDelta: clampedStock - cur.stock,
              notes: `Product Editor variant stock update (${cur.stock} -> ${clampedStock})`,
            });
          }
          binds.push(u.stock);
          sets.push(`stock = MAX(reserved_stock, ?${binds.length})`);
        }
        if (u.is_active !== undefined) {
          binds.push(u.is_active);
          sets.push(`is_active = ?${binds.length}`);
        }
        if (sets.length > 0) {
          binds.push(now, u.variantId, productId);
          stmts.push(
            c.env.DB
              .prepare(`UPDATE product_variants SET ${sets.join(', ')}, updated_at = ?${binds.length - 2} WHERE id = ?${binds.length - 1} AND product_id = ?${binds.length}`)
              .bind(...binds),
          );
        }
      } else if (u.size && !u.color_name) {
        const sets: string[] = [];
        const binds: unknown[] = [];
        if (u.price_paise !== undefined) {
          binds.push(u.price_paise);
          sets.push(`price_paise = ?${binds.length}`);
        }
        if (u.compare_paise !== undefined) {
          binds.push(u.compare_paise);
          sets.push(`compare_paise = ?${binds.length}`);
        }
        if (sets.length > 0) {
          binds.push(now, u.size, productId);
          stmts.push(
            c.env.DB
              .prepare(`UPDATE product_variants SET ${sets.join(', ')}, updated_at = ?${binds.length - 2} WHERE size = ?${binds.length - 1} AND product_id = ?${binds.length}`)
              .bind(...binds),
          );
        }
      } else if (u.color_name) {
        const sets: string[] = [];
        const binds: unknown[] = [];
        if (u.price_paise !== undefined) {
          binds.push(u.price_paise);
          sets.push(`price_paise = ?${binds.length}`);
        }
        if (u.compare_paise !== undefined) {
          binds.push(u.compare_paise);
          sets.push(`compare_paise = ?${binds.length}`);
        }
        if (u.color_hex !== undefined) {
          binds.push(u.color_hex);
          sets.push(`color_hex = ?${binds.length}`);
        }
        if (u.new_color_name !== undefined && u.new_color_name.trim()) {
          binds.push(u.new_color_name.trim());
          sets.push(`color_name = ?${binds.length}`);
        }
        if (sets.length > 0) {
          binds.push(now, u.color_name.trim().toLowerCase(), productId);
          stmts.push(
            c.env.DB
              .prepare(
                `UPDATE product_variants SET ${sets.join(', ')}, updated_at = ?${binds.length - 2} WHERE LOWER(color_name) = ?${binds.length - 1} AND product_id = ?${binds.length}`,
              )
              .bind(...binds),
          );
          if (u.new_color_name !== undefined && u.new_color_name.trim()) {
            stmts.push(
              c.env.DB
                .prepare(
                  `UPDATE product_images SET color_name = ?1 WHERE LOWER(color_name) = ?2 AND product_id = ?3`,
                )
                .bind(u.new_color_name.trim(), u.color_name.trim().toLowerCase(), productId),
            );
          }
        }
      }
    }

    if (stmts.length > 0) {
      await c.env.DB.batch(stmts);
    }
    if (stockMovements.length > 0) {
      await recordInventoryMovements(
        c.env.DB,
        stockMovements.map((m) => ({
          variantId: m.variantId,
          movementType: 'admin_adjust',
          qtyDelta: m.qtyDelta,
          actorId: adminId,
          notes: m.notes,
        })),
      );
    }

    await bumpCatalogCacheVersion(c.env.CATALOG_KV, product.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'BULK_UPDATE_VARIANT_PRICING', 'product', productId, { count: stmts.length });

    return c.json({ success: true, data: { updatedCount: stmts.length } });
  },
);

// ─── DELETE /api/admin/products/:id/colors/:colorName ────────────────────────
adminProducts.delete('/:id/colors/:colorName', requirePermission('catalog.delete'), async (c) => {
  const productId = c.req.param('id');
  const colorName = decodeURIComponent(c.req.param('colorName')).trim();
  if (!colorName) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Colour name required.', status: 400 } }, 400);
  }

  const varsRes = await c.env.DB
    .prepare(`SELECT id FROM product_variants WHERE product_id = ?1 AND LOWER(color_name) = LOWER(?2)`)
    .bind(productId, colorName)
    .all<{ id: string }>();
  const variantIds = (varsRes.results ?? []).map((v) => v.id);
  if (variantIds.length === 0) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Colour not found on product.', status: 404 } }, 404);
  }

  const placeholders = variantIds.map((_, i) => `?${i + 1}`).join(', ');
  const orderedRes = await c.env.DB
    .prepare(`SELECT DISTINCT variant_id FROM order_items WHERE variant_id IN (${placeholders})`)
    .bind(...variantIds)
    .all<{ variant_id: string }>();
  const orderedSet = new Set((orderedRes.results ?? []).map((r) => r.variant_id));

  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const vid of variantIds) {
    if (orderedSet.has(vid)) {
      stmts.push(
        c.env.DB.prepare(`UPDATE product_variants SET is_active = 0, updated_at = ?1 WHERE id = ?2`).bind(now, vid),
      );
    } else {
      stmts.push(c.env.DB.prepare(`DELETE FROM product_variants WHERE id = ?1 AND product_id = ?2`).bind(vid, productId));
    }
  }
  stmts.push(
    c.env.DB.prepare(`DELETE FROM product_images WHERE product_id = ?1 AND LOWER(color_name) = LOWER(?2)`).bind(productId, colorName),
  );

  await c.env.DB.batch(stmts);
  const prod = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
  await bumpCatalogCacheVersion(c.env.CATALOG_KV, prod?.slug);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'REMOVE_PRODUCT_COLOR', 'product', productId, {
    colorName,
    removedCount: variantIds.length - orderedSet.size,
    deactivatedCount: orderedSet.size,
  });

  return c.json({
    success: true,
    data: {
      colorName,
      deletedCount: variantIds.length - orderedSet.size,
      deactivatedCount: orderedSet.size,
    },
  });
});

// ─── DELETE /api/admin/products/:id/sizes/:size ──────────────────────────────
adminProducts.delete('/:id/sizes/:size', requirePermission('catalog.delete'), async (c) => {
  const productId = c.req.param('id');
  const size = decodeURIComponent(c.req.param('size')).trim();
  if (!size) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Size required.', status: 400 } }, 400);
  }

  const varsRes = await c.env.DB
    .prepare(`SELECT id FROM product_variants WHERE product_id = ?1 AND LOWER(size) = LOWER(?2)`)
    .bind(productId, size)
    .all<{ id: string }>();
  const variantIds = (varsRes.results ?? []).map((v) => v.id);
  if (variantIds.length === 0) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Size not found on product.', status: 404 } }, 404);
  }

  const placeholders = variantIds.map((_, i) => `?${i + 1}`).join(', ');
  const orderedRes = await c.env.DB
    .prepare(`SELECT DISTINCT variant_id FROM order_items WHERE variant_id IN (${placeholders})`)
    .bind(...variantIds)
    .all<{ variant_id: string }>();
  const orderedSet = new Set((orderedRes.results ?? []).map((r) => r.variant_id));

  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const vid of variantIds) {
    if (orderedSet.has(vid)) {
      stmts.push(
        c.env.DB.prepare(`UPDATE product_variants SET is_active = 0, updated_at = ?1 WHERE id = ?2`).bind(now, vid),
      );
    } else {
      stmts.push(c.env.DB.prepare(`DELETE FROM product_variants WHERE id = ?1 AND product_id = ?2`).bind(vid, productId));
    }
  }

  await c.env.DB.batch(stmts);
  const prod = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
  await bumpCatalogCacheVersion(c.env.CATALOG_KV, prod?.slug);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'REMOVE_PRODUCT_SIZE', 'product', productId, {
    size,
    removedCount: variantIds.length - orderedSet.size,
    deactivatedCount: orderedSet.size,
  });

  return c.json({
    success: true,
    data: {
      size,
      deletedCount: variantIds.length - orderedSet.size,
      deactivatedCount: orderedSet.size,
    },
  });
});

// ─── PATCH /api/admin/products/:id/variants/:variantId ───────────────────────
const updateVariantSchema = z.object({
  sku: z.string().min(2).max(80).optional(),
  size: z.string().min(1).max(30).optional(),
  price_paise: z.number().int().positive().nullable().optional(),
  compare_paise: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
  color_name: z.string().optional(),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order: z.number().int().optional(),
});

adminProducts.patch(
  '/:id/variants/:variantId',
  requirePermission('catalog.write'),
  zValidator('json', updateVariantSchema),
  async (c) => {
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const adminId = c.get('userId');
    const body = c.req.valid('json');

    if (!Object.keys(body).length) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No fields to update.', status: 400 } }, 400);
    }

    const currentVar = await c.env.DB
      .prepare(`SELECT stock, reserved_stock FROM product_variants WHERE id = ?1 AND product_id = ?2 LIMIT 1`)
      .bind(variantId, productId)
      .first<{ stock: number; reserved_stock: number }>();

    if (!currentVar) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Variant not found.', status: 404 } }, 404);
    }

    if (body.stock !== undefined && body.stock < currentVar.reserved_stock) {
      return c.json(
        {
          success: false,
          error: {
            code: 'STOCK_CONFLICT',
            message: `Cannot reduce stock to ${body.stock} below active reserved hold (${currentVar.reserved_stock}).`,
            status: 409,
          },
        },
        409,
      );
    }

    const fields: string[] = [];
    const bindings: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        fields.push(`${key} = ?${idx}`);
        bindings.push(value);
        idx++;
      }
    }

    fields.push(`updated_at = ?${idx}`);
    bindings.push(nowIso());
    idx++;

    bindings.push(variantId);
    await c.env.DB
      .prepare(`UPDATE product_variants SET ${fields.join(', ')} WHERE id = ?${idx} AND product_id = ?${idx + 1}`)
      .bind(...bindings, productId)
      .run();

    if (body.stock !== undefined && body.stock !== currentVar.stock) {
      await recordInventoryMovements(c.env.DB, [
        {
          variantId,
          movementType: 'admin_adjust',
          qtyDelta: body.stock - currentVar.stock,
          actorId: adminId,
          notes: `Admin variant patch ${currentVar.stock} -> ${body.stock}`,
        },
      ]);
    }

    const product = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
    await bumpCatalogCacheVersion(c.env.CATALOG_KV, product?.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'UPDATE_VARIANT', 'product_variant', variantId, body);

    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── DELETE /api/admin/products/:id/variants/:variantId ──────────────────────
adminProducts.delete('/:id/variants/:variantId', requirePermission('catalog.delete'), async (c) => {
  const productId = c.req.param('id');
  const variantId = c.req.param('variantId');

  const orderedRow = await c.env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM order_items WHERE variant_id = ?1`)
    .bind(variantId)
    .first<{ cnt: number }>();

  if (Number(orderedRow?.cnt ?? 0) > 0) {
    // Has historical orders: deactivate instead of hard delete to protect FK & ledger integrity
    await c.env.DB.prepare(`UPDATE product_variants SET is_active = 0, updated_at = ?1 WHERE id = ?2`).bind(nowIso(), variantId).run();
    const prod = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
    await bumpCatalogCacheVersion(c.env.CATALOG_KV, prod?.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'DEACTIVATE_VARIANT_WITH_ORDERS', 'product_variant', variantId);
    return c.json({ success: true, data: { deactivated: true, reason: 'Variant has historical orders.' } });
  }

  await c.env.DB.prepare(`DELETE FROM product_variants WHERE id = ?1 AND product_id = ?2`).bind(variantId, productId).run();
  const prod = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
  await bumpCatalogCacheVersion(c.env.CATALOG_KV, prod?.slug);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'DELETE_VARIANT', 'product_variant', variantId);
  return c.json({ success: true, data: { deleted: true } });
});

// ─── PUT /api/admin/products/:id/images ──────────────────────────────────────
const imageArraySchema = z.object({
  images: z.array(
    z
      .object({
        id: z.string().optional(),
        image_url: z.string().min(1).optional(),
        url: z.string().min(1).optional(),
        alt_text: z.string().max(200).optional(),
        color_name: z.string().nullable().optional(),
        sort_order: z.number().int().default(0),
      })
      .refine((x) => Boolean(x.image_url || x.url), {
        message: 'Each image requires image_url or url.',
      }),
  ),
});

adminProducts.put(
  '/:id/images',
  requirePermission('catalog.write'),
  zValidator('json', imageArraySchema),
  async (c) => {
    const productId = c.req.param('id');
    const { images } = c.req.valid('json');

    const stmts: D1PreparedStatement[] = [
      c.env.DB.prepare(`DELETE FROM product_images WHERE product_id = ?1`).bind(productId),
    ];

    images.forEach((img, idx) => {
      const imgId = img.id || generateId('pimg_');
      const imgUrl = (img.image_url || img.url || '').trim();
      stmts.push(
        c.env.DB
          .prepare(
            `INSERT INTO product_images (id, product_id, image_url, alt_text, color_name, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(imgId, productId, imgUrl, img.alt_text ?? '', img.color_name ?? '', img.sort_order ?? idx + 1),
      );
    });

    await c.env.DB.batch(stmts);
    const product = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
    await bumpCatalogCacheVersion(c.env.CATALOG_KV, product?.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'UPDATE_PRODUCT_IMAGES', 'product', productId, { count: images.length });

    return c.json({ success: true, data: { count: images.length } });
  },
);

// ─── PUT /api/admin/products/:id/cross-sells ─────────────────────────────────
const crossSellsSchema = z.object({
  items: z.array(
    z.object({
      target_product_id: z.string().min(1),
      relation_type: z.enum(['style_it_with', 'related']),
      sort_order: z.number().int().default(0),
    }),
  ),
});

adminProducts.put(
  '/:id/cross-sells',
  requirePermission('catalog.write'),
  zValidator('json', crossSellsSchema),
  async (c) => {
    const productId = c.req.param('id');
    const { items } = c.req.valid('json');

    const stmts: D1PreparedStatement[] = [
      c.env.DB.prepare(`DELETE FROM product_cross_sells WHERE product_id = ?1`).bind(productId),
    ];

    items.forEach((item, idx) => {
      stmts.push(
        c.env.DB
          .prepare(
            `INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order)
             VALUES (?1, ?2, ?3, ?4)`,
          )
          .bind(productId, item.target_product_id, item.relation_type, item.sort_order ?? idx + 1),
      );
    });

    await c.env.DB.batch(stmts);
    const product = await c.env.DB.prepare(`SELECT slug FROM products WHERE id = ?1`).bind(productId).first<{ slug: string }>();
    await bumpCatalogCacheVersion(c.env.CATALOG_KV, product?.slug);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'UPDATE_PRODUCT_CROSS_SELLS', 'product', productId, { count: items.length });

    return c.json({ success: true, data: { count: items.length } });
  },
);

export default adminProducts;
