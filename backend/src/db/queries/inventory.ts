import type { D1Database } from '@cloudflare/workers-types';
import { nowIso, runChunkedOperations } from '../client.js';
import { recordInventoryMovements } from '../../services/stockEngine.js';

export interface InventoryRow {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  size: string;
  colorName: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  isActive: boolean;
}

export async function getInventoryMatrix(db: D1Database): Promise<InventoryRow[]> {
  const result = await db
    .prepare(
      `SELECT
         pv.id AS variantId,
         pv.product_id AS productId,
         p.title AS productTitle,
         pv.sku,
         pv.size,
         pv.color_name AS colorName,
         pv.stock,
         pv.reserved_stock AS reservedStock,
         MAX(0, pv.stock - pv.reserved_stock) AS availableStock,
         pv.is_active AS isActive
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       ORDER BY p.sort_order ASC, p.title ASC, pv.sort_order ASC, pv.size ASC`,
    )
    .all<InventoryRow>();
  return result.results ?? [];
}

/**
 * Adjusts physical stock guarded against reserved holds (`newStock >= reserved_stock`).
 * Returns false if active reservations prevent lowering stock below reserved count.
 */
export async function adjustStock(
  db: D1Database,
  variantId: string,
  newStock: number,
  actorId?: string,
  reason?: string,
): Promise<{ updated: boolean; reservedStock?: number }> {
  const current = await db
    .prepare(`SELECT stock, reserved_stock FROM product_variants WHERE id = ?1`)
    .bind(variantId)
    .first<{ stock: number; reserved_stock: number }>();

  if (!current) {
    return { updated: false };
  }
  if (newStock < current.reserved_stock) {
    return { updated: false, reservedStock: current.reserved_stock };
  }

  const res = await db
    .prepare(
      `UPDATE product_variants
       SET stock = ?1,
           updated_at = ?2
       WHERE id = ?3 AND reserved_stock <= ?1`,
    )
    .bind(newStock, nowIso(), variantId)
    .run();

  if ((res.meta.changes ?? 0) === 0) {
    return { updated: false, reservedStock: current.reserved_stock };
  }

  await recordInventoryMovements(db, [
    {
      variantId,
      movementType: 'admin_adjust',
      qtyDelta: newStock - current.stock,
      actorId: actorId ?? 'admin',
      notes: reason?.trim()
        ? `${reason.trim()} (${current.stock} -> ${newStock})`
        : `Adjusted stock from ${current.stock} to ${newStock}`,
    },
  ]);

  return { updated: true };
}

export interface StockAdjustment {
  variantId: string;
  newStock: number;
}

export async function bulkAdjustStock(
  db: D1Database,
  adjustments: StockAdjustment[],
  actorId?: string,
): Promise<{ updated: number; rejected: Array<{ variantId: string; reason: string }> }> {
  if (!adjustments.length) return { updated: 0, rejected: [] };
  const now = nowIso();
  const rejected: Array<{ variantId: string; reason: string }> = [];
  const validAdjustments: Array<{ variantId: string; newStock: number; prevStock: number }> = [];

  for (const adj of adjustments) {
    const row = await db
      .prepare(`SELECT stock, reserved_stock FROM product_variants WHERE id = ?1`)
      .bind(adj.variantId)
      .first<{ stock: number; reserved_stock: number }>();
    if (!row) {
      rejected.push({ variantId: adj.variantId, reason: 'Variant not found' });
      continue;
    }
    if (adj.newStock < row.reserved_stock) {
      rejected.push({
        variantId: adj.variantId,
        reason: `Cannot set stock (${adj.newStock}) below active reserved stock (${row.reserved_stock})`,
      });
      continue;
    }
    validAdjustments.push({ ...adj, prevStock: row.stock });
  }

  if (validAdjustments.length > 0) {
    await runChunkedOperations(db, validAdjustments, (a) =>
      db
        .prepare(
          `UPDATE product_variants
           SET stock = ?1, updated_at = ?2
           WHERE id = ?3 AND reserved_stock <= ?1`,
        )
        .bind(a.newStock, now, a.variantId),
    );

    await recordInventoryMovements(
      db,
      validAdjustments.map((a) => ({
        variantId: a.variantId,
        movementType: 'admin_adjust',
        qtyDelta: a.newStock - a.prevStock,
        actorId: actorId ?? 'admin',
        notes: `Bulk adjusted stock from ${a.prevStock} to ${a.newStock}`,
      })),
    );
  }

  return { updated: validAdjustments.length, rejected };
}

export async function getLowStockVariants(
  db: D1Database,
  threshold = 3,
): Promise<InventoryRow[]> {
  const result = await db
    .prepare(
      `SELECT
         pv.id AS variantId,
         pv.product_id AS productId,
         p.title AS productTitle,
         pv.sku,
         pv.size,
         pv.color_name AS colorName,
         pv.stock,
         pv.reserved_stock AS reservedStock,
         MAX(0, pv.stock - pv.reserved_stock) AS availableStock,
         pv.is_active AS isActive
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE (pv.stock - pv.reserved_stock) <= ?1
         AND pv.is_active = 1
       ORDER BY availableStock ASC`,
    )
    .bind(threshold)
    .all<InventoryRow>();
  return result.results ?? [];
}

export async function setVariantActive(
  db: D1Database,
  variantId: string,
  isActive: boolean,
): Promise<void> {
  await db
    .prepare(
      `UPDATE product_variants
       SET is_active = ?1,
           updated_at = ?2
       WHERE id = ?3`,
    )
    .bind(isActive ? 1 : 0, nowIso(), variantId)
    .run();
}
