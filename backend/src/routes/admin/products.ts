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
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminProducts = new Hono<{ Bindings: Env }>();

// ─── Admin log helper ────────────────────────────────────────────────────────

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

// ─── GET /api/admin/products ─────────────────────────────────────────────────

adminProducts.get('/', async (c) => {
  const products = await getAllProductsAdmin(c.env.DB);
  return c.json({ success: true, data: { items: products, total: products.length } });
});

// ─── GET /api/admin/products/:id ─────────────────────────────────────────────

adminProducts.get('/:id', async (c) => {
  const id = c.req.param('id');
  const product = await getProductById(c.env.DB, id);
  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }
  const variants = await getProductVariants(c.env.DB, id);
  return c.json({ success: true, data: { ...product, variants } });
});

// ─── PATCH /api/admin/products/:id — update product fields ──────────────────

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
});

adminProducts.patch('/:id', zValidator('json', updateProductSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const body = c.req.valid('json');

  const existing = await getProductById(c.env.DB, id);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  // Build SET clause dynamically from provided fields
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

  // Invalidate KV cache
  await invalidateCatalogCache(
    c.env.CATALOG_KV,
    `catalog:product:${existing.slug}`,
    'catalog:categories:all',
  );

  await logAdminAction(c.env.DB, adminId, 'UPDATE_PRODUCT', 'product', id, body, ip);

  const updated = await getProductById(c.env.DB, id);
  return c.json({ success: true, data: updated });
});

// ─── PATCH /api/admin/products/:id/variants/:variantId ───────────────────────

const updateVariantSchema = z.object({
  stock: z.number().int().min(0).optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
  color_name: z.string().optional(),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
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

  // Invalidate product detail cache
  const product = await getProductById(c.env.DB, productId);
  if (product) {
    await invalidateCatalogCache(c.env.CATALOG_KV, `catalog:product:${product.slug}`);
  }

  await logAdminAction(c.env.DB, adminId, 'UPDATE_VARIANT', 'product_variant', variantId, body, ip);

  return c.json({ success: true, data: { updated: true } });
});

export default adminProducts;

