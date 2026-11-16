/**
 * DEYNOLD DANNY — Atomic Stock Engine & Movement Ledger
 *
 * Invariant enforced both in SQLite CHECK/triggers and conditional WHERE clauses:
 *   stock >= reserved_stock >= 0
 */

import { generateId } from './crypto.js';
import { nowIso, runBatch } from '../db/client.js';

export interface StockLineItem {
  variantId: string;
  quantity: number;
}

/**
 * Builds conditional atomic hold statements for multiple line items.
 */
export function prepareHoldStatements(db: D1Database, items: StockLineItem[]): D1PreparedStatement[] {
  const now = nowIso();
  return items.map((item) =>
    db
      .prepare(
        `UPDATE product_variants
         SET reserved_stock = reserved_stock + ?1,
             updated_at = ?2
         WHERE id = ?3
           AND is_active = 1
           AND (stock - reserved_stock) >= ?1`,
      )
      .bind(item.quantity, now, item.variantId),
  );
}

/**
 * Atomically holds stock across all items. If any item lacks sufficient available stock,
 * immediately compensates any items held earlier in the batch so zero partial holds leak.
 */
export async function atomicHoldAllOrRollback(
  db: D1Database,
  items: StockLineItem[],
): Promise<{ success: boolean; failedIndex: number }> {
  if (items.length === 0) return { success: true, failedIndex: -1 };
  const results = await runBatch(db, prepareHoldStatements(db, items));
  const failedIndex = results.findIndex((r) => (r.meta.changes ?? 0) === 0);

  if (failedIndex === -1) {
    return { success: true, failedIndex: -1 };
  }

  // Compensate only items that actually incremented reserved_stock
  const compensate: D1PreparedStatement[] = [];
  const now = nowIso();
  for (let i = 0; i < items.length; i++) {
    if ((results[i]?.meta.changes ?? 0) > 0) {
      compensate.push(
        db
          .prepare(
            `UPDATE product_variants
             SET reserved_stock = MAX(0, reserved_stock - ?1),
                 updated_at = ?2
             WHERE id = ?3`,
          )
          .bind(items[i].quantity, now, items[i].variantId),
      );
    }
  }
  if (compensate.length > 0) {
    await runBatch(db, compensate);
  }

  return { success: false, failedIndex };
}

/**
 * Normal capture path: commits previously held stock (`stock -= qty`, `reserved_stock -= qty`).
 * Guarded by `stock >= qty AND reserved_stock >= qty` so other shoppers' reservations are untouched.
 */
export async function commitHeldStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
  if (qty <= 0) return true;
  const result = await db
    .prepare(
      `UPDATE product_variants
       SET stock = stock - ?1,
           reserved_stock = reserved_stock - ?1,
           updated_at = ?2
       WHERE id = ?3
         AND stock >= ?1
         AND reserved_stock >= ?1`,
    )
    .bind(qty, nowIso(), variantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Late-capture recovery path when cron reaper already released the original hold.
 * Allocates strictly from available unreserved stock (`stock - reserved_stock >= qty`).
 */
export async function commitUnreservedLateStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
  if (qty <= 0) return true;
  const result = await db
    .prepare(
      `UPDATE product_variants
       SET stock = stock - ?1,
           updated_at = ?2
       WHERE id = ?3
         AND is_active = 1
         AND (stock - reserved_stock) >= ?1`,
    )
    .bind(qty, nowIso(), variantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Releases reserved stock on payment failure, cancellation, or cron reaper.
 */
export async function rollbackStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
  if (qty <= 0) return true;
  const result = await db
    .prepare(
      `UPDATE product_variants
       SET reserved_stock = MAX(0, reserved_stock - ?1),
           updated_at = ?2
       WHERE id = ?3`,
    )
    .bind(qty, nowIso(), variantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Restores physical stock for returned/cancelled paid items cleanly.
 */
export async function restockCommittedStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
  if (qty <= 0) return true;
  const result = await db
    .prepare(
      `UPDATE product_variants
       SET stock = stock + ?1,
           updated_at = ?2
       WHERE id = ?3`,
    )
    .bind(qty, nowIso(), variantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function recordInventoryMovements(
  db: D1Database,
  movements: Array<{
    variantId: string;
    orderId?: string | null;
    movementType:
      | 'hold'
      | 'release'
      | 'commit'
      | 'return_restock'
      | 'admin_adjust'
      | 'reconciliation_drift';
    qtyDelta: number;
    actorId?: string | null;
    notes?: string | null;
  }>,
): Promise<void> {
  if (movements.length === 0) return;
  const now = nowIso();
  const statements = movements.map((m) =>
    db
      .prepare(
        `INSERT INTO inventory_movements (
           id, variant_id, order_id, movement_type, qty_delta,
           stock_after, reserved_after, actor_id, notes, created_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5,
           (SELECT stock FROM product_variants WHERE id = ?2),
           (SELECT reserved_stock FROM product_variants WHERE id = ?2),
           ?6, ?7, ?8
         )`,
      )
      .bind(
        generateId('inv_'),
        m.variantId,
        m.orderId ?? null,
        m.movementType,
        m.qtyDelta,
        m.actorId ?? null,
        m.notes ?? null,
        now,
      ),
  );
  await runBatch(db, statements);
}

export async function checkStock(db: D1Database, variantId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT MAX(0, stock - reserved_stock) AS available FROM product_variants WHERE id = ?1`,
    )
    .bind(variantId)
    .first<{ available: number }>();

  return row?.available ?? 0;
}
