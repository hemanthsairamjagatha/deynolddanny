import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import {
  getInventoryMatrix,
  getLowStockVariants,
  adjustStock,
  bulkAdjustStock,
} from '../../db/queries/inventory.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { renderDbEmailTemplate, sendConfiguredEmail } from '../../services/resend.js';

const adminInventory = new Hono<{ Bindings: Env }>();

async function bumpCatalogVersion(kv: KVNamespace): Promise<void> {
  try {
    await kv.put('catalog:version', `v_${Date.now()}`);
  } catch {}
}

// ─── GET /api/admin/inventory ────────────────────────────────────────────────
adminInventory.get('/', requirePermission('inventory.read'), async (c) => {
  const matrix = await getInventoryMatrix(c.env.DB);
  return c.json({ success: true, data: { items: matrix, total: matrix.length } });
});

// ─── GET /api/admin/inventory/low-stock ──────────────────────────────────────
adminInventory.get('/low-stock', requirePermission('inventory.read'), async (c) => {
  const rawThreshold = Number(c.req.query('threshold') ?? '5');
  const threshold = Number.isFinite(rawThreshold) ? Math.max(0, Math.floor(rawThreshold)) : 5;
  const items = await getLowStockVariants(c.env.DB, threshold);
  return c.json({ success: true, data: { items, total: items.length, threshold } });
});

// ─── GET /api/admin/inventory/movements ───────────────────────────────────────
adminInventory.get('/movements', requirePermission('inventory.read'), async (c) => {
  const variantId = c.req.query('variantId')?.trim();
  const movementType = c.req.query('movementType')?.trim();
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50)));

  let sql = `
    SELECT im.*, pv.sku, pv.size, pv.color_name, p.title as product_title
    FROM inventory_movements im
    INNER JOIN product_variants pv ON pv.id = im.variant_id
    INNER JOIN products p ON p.id = pv.product_id
    WHERE 1=1
  `;
  const bindings: any[] = [];

  if (variantId) {
    bindings.push(variantId);
    sql += ` AND im.variant_id = ?${bindings.length}`;
  }
  if (movementType) {
    bindings.push(movementType);
    sql += ` AND im.movement_type = ?${bindings.length}`;
  }

  sql += ` ORDER BY im.created_at DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── GET /api/admin/inventory/restock-subscriptions ──────────────────────────
adminInventory.get('/restock-subscriptions', requirePermission('inventory.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT rs.variant_id, COUNT(*) as subscriber_count, pv.sku, pv.size, pv.color_name, pv.stock, p.title as product_title, p.slug as product_slug
       FROM restock_subscriptions rs
       INNER JOIN product_variants pv ON pv.id = rs.variant_id
       INNER JOIN products p ON p.id = pv.product_id
       WHERE rs.notified_at IS NULL
       GROUP BY rs.variant_id
       ORDER BY subscriber_count DESC`,
    )
    .all<Record<string, unknown>>();

  return c.json({ success: true, data: { items: rows.results ?? [] } });
});

// ─── POST /api/admin/inventory/restock-subscriptions/notify ──────────────────
adminInventory.post(
  '/restock-subscriptions/notify',
  requirePermission('inventory.adjust'),
  zValidator('json', z.object({ variantId: z.string().min(1) })),
  async (c) => {
    const { variantId } = c.req.valid('json');

    const variant = await c.env.DB
      .prepare(
        `SELECT pv.id, pv.sku, pv.size, pv.color_name, pv.stock, p.title as product_title, p.slug as product_slug
         FROM product_variants pv
         INNER JOIN products p ON p.id = pv.product_id
         WHERE pv.id = ?1 LIMIT 1`,
      )
      .bind(variantId)
      .first<Record<string, any>>();

    if (!variant || Number(variant.stock) <= 0) {
      return c.json(
        { success: false, error: { code: 'STOCK_ZERO', message: 'Cannot dispatch restock notifications when stock is 0.', status: 400 } },
        400,
      );
    }

    const subs = await c.env.DB
      .prepare(`SELECT id, email FROM restock_subscriptions WHERE variant_id = ?1 AND notified_at IS NULL`)
      .bind(variantId)
      .all<{ id: string; email: string }>();

    const subscribers = subs.results ?? [];
    if (subscribers.length === 0) {
      return c.json({ success: true, data: { notifiedCount: 0, message: 'No pending subscribers for this variant.' } });
    }

    const now = nowIso();
    const productUrl = `${c.env.FRONTEND_URL || 'https://deynolddanny.com'}/products/${variant.product_slug}`;
    const variantLabel = `${variant.color_name} / ${variant.size}`;

    if (c.env.RESEND_API_KEY) {
      c.executionCtx.waitUntil(
        (async () => {
          const rendered = await renderDbEmailTemplate(c.env.DB, 'restock_alert', {
            brandName: 'DEYNOLD DANNY',
            productTitle: variant.product_title,
            variantLabel,
            productUrl,
          });

          for (const s of subscribers) {
            try {
              if (rendered) {
                await sendConfiguredEmail(
                  c.env.RESEND_API_KEY,
                  s.email,
                  rendered.subject,
                  rendered.html,
                  c.env.RESEND_FROM_EMAIL,
                );
              }
            } catch (err) {
              console.error('Failed restock alert email send:', err);
            }
          }
        })(),
      );
    }

    const ids = subscribers.map((s) => s.id);
    for (const id of ids) {
      await c.env.DB.prepare(`UPDATE restock_subscriptions SET notified_at = ?1 WHERE id = ?2`).bind(now, id).run();
    }

    await auditAdminAction(c, 'NOTIFY_RESTOCK_SUBSCRIBERS', 'product_variant', variantId, { count: subscribers.length });

    return c.json({ success: true, data: { notifiedCount: subscribers.length } });
  },
);

// ─── PATCH /api/admin/inventory/:variantId ───────────────────────────────────
const adjustSchema = z.object({
  stock: z.number().int().min(0, 'Stock cannot be negative'),
});

adminInventory.patch(
  '/:variantId',
  requirePermission('inventory.adjust'),
  zValidator('json', adjustSchema),
  async (c) => {
    const variantId = c.req.param('variantId');
    const adminId = c.get('userId');
    const { stock } = c.req.valid('json');

    const result = await adjustStock(c.env.DB, variantId, stock, adminId);
    if (!result.updated) {
      if (result.reservedStock !== undefined) {
        return c.json(
          {
            success: false,
            error: {
              code: 'STOCK_CONFLICT',
              message: `Cannot adjust stock to ${stock} below currently reserved holds (${result.reservedStock}).`,
              status: 409,
            },
          },
          409,
        );
      }
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Variant not found.', status: 404 } },
        404,
      );
    }

    await bumpCatalogVersion(c.env.CATALOG_KV);
    await auditAdminAction(c, 'ADJUST_STOCK', 'product_variant', variantId, { stock });

    return c.json({ success: true, data: { variantId, stock } });
  },
);

// ─── POST /api/admin/inventory/bulk-adjust ───────────────────────────────────
const bulkAdjustSchema = z.object({
  adjustments: z
    .array(
      z.object({
        variantId: z.string().min(1),
        newStock: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(100),
});

adminInventory.post(
  '/bulk-adjust',
  requirePermission('inventory.adjust'),
  zValidator('json', bulkAdjustSchema),
  async (c) => {
    const adminId = c.get('userId');
    const { adjustments } = c.req.valid('json');

    const outcome = await bulkAdjustStock(c.env.DB, adjustments, adminId);
    await bumpCatalogVersion(c.env.CATALOG_KV);
    await auditAdminAction(c, 'BULK_ADJUST_STOCK', 'product_variant', 'bulk', outcome);

    return c.json({ success: true, data: outcome });
  },
);

export default adminInventory;
