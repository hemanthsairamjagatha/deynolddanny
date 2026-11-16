import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import {
  getInventoryMatrix,
  adjustStock,
  bulkAdjustStock,
  getLowStockVariants,
} from '../../db/queries/inventory.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminInventory = new Hono<{ Bindings: Env }>();

async function bumpCatalogVersion(kv: KVNamespace): Promise<void> {
  try {
    await kv.put('catalog:version', `v_${Date.now()}`);
  } catch {
    // Non-fatal
  }
}

adminInventory.get('/', async (c) => {
  const matrix = await getInventoryMatrix(c.env.DB);
  return c.json({ success: true, data: { items: matrix, total: matrix.length } });
});

adminInventory.get('/low-stock', async (c) => {
  const rawThreshold = Number(c.req.query('threshold') ?? '3');
  const threshold = Number.isFinite(rawThreshold) ? Math.max(0, Math.floor(rawThreshold)) : 3;
  const items = await getLowStockVariants(c.env.DB, threshold);
  return c.json({ success: true, data: { items, total: items.length } });
});

const adjustSchema = z.object({
  stock: z.number().int().min(0, 'Stock cannot be negative'),
});

adminInventory.patch('/:variantId', zValidator('json', adjustSchema), async (c) => {
  const variantId = c.req.param('variantId');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
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

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'ADJUST_STOCK', 'product_variant', ?3, ?4, ?5, ?6)`,
    )
    .bind(generateId('log_'), adminId, variantId, JSON.stringify({ newStock: stock }), ip, nowIso())
    .run();

  return c.json({ success: true, data: { variantId, stock } });
});

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

adminInventory.post('/bulk-adjust', zValidator('json', bulkAdjustSchema), async (c) => {
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const { adjustments } = c.req.valid('json');

  const outcome = await bulkAdjustStock(c.env.DB, adjustments, adminId);
  await bumpCatalogVersion(c.env.CATALOG_KV);

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'BULK_ADJUST_STOCK', 'product_variant', 'bulk', ?3, ?4, ?5)`,
    )
    .bind(generateId('log_'), adminId, JSON.stringify(outcome), ip, nowIso())
    .run();

  return c.json({ success: true, data: outcome });
});

export default adminInventory;
