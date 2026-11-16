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

const adminProducts = new Hono<{ Bindings: Env }>();

async function logAdminAction(
  db: D1Database,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
  ip?: string | null,
) {
  await db
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      generateId('log_'),
      adminId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
      ip ?? null,
      nowIso(),
    )
    .run();
}

async function bumpCatalogCacheVersion(kv: KVNamespace, slug?: string) {
  try {
    await kv.put('catalog:version', `v_${Date.now()}`);
  } catch {}
  if (slug) {
    await invalidateCatalogCache(kv, `catalog:product:${slug}`, 'catalog:categories:all');
  }
}

adminProducts.get('/', async (c) => {
  const products = await getAllProductsAdmin(c.env.DB);
  return c.json({ success: true, data: { items: products, total: products.length } });
});

adminProducts.get('/:id', async (c) => {
  const id = c.req.param('id');
  const product = await c.env.DB
    .prepare(`SELECT * FROM products WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<any>();
  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }
  const variants = await c.env.DB
    .prepare(`SELECT * FROM product_variants WHERE product_id = ?1 ORDER BY sort_order ASC, size ASC`)
    .bind(id)
    .all();
  return c.json({ success: true, data: { ...product, variants: variants.results ?? [] } });
});

// ─── POST /api/admin/products — create new product ───────────────────────────

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
  default_img: z.string().min(1),
  hover_img: z.string().min(1),
  hsn_code: z.string().max(20).nullable().optional(),
  gst_rate_bps: z.number().int().min(0).max(2800).nullable().optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).default(1),
  is_featured: z.union([z.literal(0), z.literal(1)]).default(0),
  sort_order: z.number().int().default(0),
});

adminProducts.post('/', zValidator('json', createProductSchema), async (c) => {
  const body = c.req.valid('json');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;

  const existing = await c.env.DB
    .prepare(`SELECT id FROM products WHERE slug = ?1 OR sku_prefix = ?2 LIMIT 1`)
    .bind(body.slug, body.sku_prefix)
    .first();
  if (existing) {
    return c.json(
      { success: false, error: { code: 'CONFLICT', message: 'Product slug or sku_prefix already exists.', status: 409 } },
      409,
    );
  }

  const productId = body.id || generateId('prd_');
  await upsertProduct(c.env.DB, { ...body, id: productId });

  if (body.hsn_code !== undefined || body.gst_rate_bps !== undefined) {
    await c.env.DB
      .prepare(`UPDATE products SET hsn_code = ?1, gst_rate_bps = ?2 WHERE id = ?3`)
      .bind(body.hsn_code ?? null, body.gst_rate_bps ?? null, productId)
      .run();
  }

  await bumpCatalogCacheVersion(c.env.CATALOG_KV, body.slug);
  await logAdminAction(c.env.DB, adminId, 'CREATE_PRODUCT', 'product', productId, body, ip);

  const created = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1`).bind(productId).first();
  return c.json({ success: true, data: created }, 201);
});

// ─── PATCH /api/admin/products/:id ───────────────────────────────────────────

const updateProductSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  material: z.string().optional(),
  badge: z.string().max(50).nullable().optional(),
  price_paise: z.number().int().positive().optional(),
  compare_paise: z.number().int().positive().nullable().optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
  is_featured: z.union([z.literal(0), z.literal(1)]).optional(),
  sort_order: z.number().int().optional(),
  category_id: z.string().nullable().optional(),
  hsn_code: z.string().max(20).nullable().optional(),
  gst_rate_bps: z.number().int().min(0).max(2800).nullable().optional(),
});

adminProducts.patch('/:id', zValidator('json', updateProductSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 LIMIT 1`).bind(id).first<any>();
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  const fields: string[] = [];
  const bindings: (string | number | null)[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      fields.push(`${key} = ?${idx}`);
      bindings.push(value as string | number | null);
      idx++;
    }
  }

  if (fields.length === 0) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No fields to update.', status: 400 } }, 400);
  }

  fields.push(`updated_at = ?${idx}`);
  bindings.push(nowIso());
  idx++;
  bindings.push(id);

  await c.env.DB
    .prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?${idx}`)
    .bind(...bindings)
    .run();

  await bumpCatalogCacheVersion(c.env.CATALOG_KV, existing.slug);
  await logAdminAction(c.env.DB, adminId, 'UPDATE_PRODUCT', 'product', id, body, ip);

  const updated = await getProductById(c.env.DB, id);
  return c.json({ success: true, data: updated });
});

// ─── DELETE /api/admin/products/:id (Soft archive preserving order history) ─

adminProducts.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;

  const existing = await c.env.DB.prepare(`SELECT id, slug FROM products WHERE id = ?1`).bind(id).first<{ id: string; slug: string }>();
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
  }

  await c.env.DB
    .prepare(`UPDATE products SET is_active = 0, updated_at = ?1 WHERE id = ?2`)
    .bind(nowIso(), id)
    .run();

  await bumpCatalogCacheVersion(c.env.CATALOG_KV, existing.slug);
  await logAdminAction(c.env.DB, adminId, 'ARCHIVE_PRODUCT', 'product', id, { slug: existing.slug }, ip);

  return c.json({ success: true, data: { archived: true } });
});

// ─── POST /api/admin/products/:id/variants — add variant ─────────────────────

const createVariantSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  sku: z.string().min(2).max(80),
  size: z.string().min(1).max(30),
  color_name: z.string().min(1).max(50).default('Default'),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#111111'),
  stock: z.number().int().min(0).default(0),
  sort_order: z.number().int().default(0),
});

adminProducts.post('/:id/variants', zValidator('json', createVariantSchema), async (c) => {
  const productId = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const body = c.req.valid('json');

  const product = await c.env.DB.prepare(`SELECT id, slug FROM products WHERE id = ?1`).bind(productId).first<{ id: string; slug: string }>();
  if (!product) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } }, 404);
  }

  const variantId = body.id || `${productId}-${body.size.replace(/\s+/g, '')}-${generateId('').slice(0, 6)}`;
  const now = nowIso();

  await c.env.DB
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock, is_active, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 1, ?8, ?9, ?9)`,
    )
    .bind(
      variantId,
      productId,
      body.sku,
      body.size,
      body.color_name,
      body.color_hex,
      body.stock,
      body.sort_order,
      now,
    )
    .run();

  await bumpCatalogCacheVersion(c.env.CATALOG_KV, product.slug);
  await logAdminAction(c.env.DB, adminId, 'CREATE_VARIANT', 'product_variant', variantId, body, ip);

  return c.json({ success: true, data: { variantId } }, 201);
});

// ─── PATCH /api/admin/products/:id/variants/:variantId ───────────────────────

const updateVariantSchema = z.object({
  stock: z.number().int().min(0).optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
  color_name: z.string().optional(),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order: z.number().int().optional(),
});

adminProducts.patch('/:id/variants/:variantId', zValidator('json', updateVariantSchema), async (c) => {
  const productId = c.req.param('id');
  const variantId = c.req.param('variantId');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
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
  const bindings: (string | number | null)[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      fields.push(`${key} = ?${idx}`);
      bindings.push(value as string | number | null);
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
  await logAdminAction(c.env.DB, adminId, 'UPDATE_VARIANT', 'product_variant', variantId, body, ip);

  return c.json({ success: true, data: { updated: true } });
});

export default adminProducts;
