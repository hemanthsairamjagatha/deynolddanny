/**
 * DEYNOLD DANNY — Atomic Stock Engine
 *
 * Implements atomic stock holding, committing, and rolling back using single-statement
 * conditional SQLite operations to prevent race conditions across 10,000+ concurrent requests.
 *
 * Invariant: stock >= reserved_stock >= 0 at all times.
 */

/**
 * STEP 1 — ATOMIC HOLD
 * Reserves `qty` units on a variant during checkout.
 * Returns true if hold succeeded, false if out of stock or inactive.
 * The WHERE clause guarantees concurrency safety: (stock - reserved_stock) >= qty.
 */
export async function holdStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
  if (qty <= 0) return false;

  const result = await db
    .prepare(
      `UPDATE product_variants
       SET reserved_stock = reserved_stock + ?1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2
         AND is_active = 1
         AND (stock - reserved_stock) >= ?1`,
    )
    .bind(qty, variantId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * STEP 2 — ATOMIC COMMIT
 * Permanently deducts stock after verified payment.
 * Guarded by `stock >= ?1` and `MAX(0, ...)` to prevent negative stock
 * even under duplicate webhook execution.
 */
export async function commitStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
  if (qty <= 0) return true;

  const result = await db
    .prepare(
      `UPDATE product_variants
       SET stock = MAX(0, stock - ?1),
           reserved_stock = MAX(0, reserved_stock - ?1),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2
         AND stock >= ?1`,
    )
    .bind(qty, variantId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * STEP 3 — ATOMIC ROLLBACK
 * Releases a stock reservation on payment failure, user cancellation, or cron reaper.
 * Uses MAX(0, ...) to ensure double-rollbacks never create negative reserved_stock.
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
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2`,
    )
    .bind(qty, variantId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * Returns available unreserved stock for a variant.
 * Formula: MAX(0, stock - reserved_stock).
 */
export async function checkStock(db: D1Database, variantId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT MAX(0, stock - reserved_stock) AS available FROM product_variants WHERE id = ?1`,
    )
    .bind(variantId)
    .first<{ available: number }>();

  return row?.available ?? 0;
}
