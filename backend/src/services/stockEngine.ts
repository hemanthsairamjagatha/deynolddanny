/**
 * Atomic stock engine — all three operations use single-query D1 statements
 * to prevent race conditions across concurrent checkout requests.
 *
 * NEVER decrement stock without first holding; NEVER commit without prior hold.
 */

/**
 * STEP 1 — ATOMIC HOLD
 * Reserves `qty` units on a variant. Returns true if successful, false if out of stock.
 * The WHERE clause guarantees atomicity: (stock - reserved_stock) >= qty.
 */
export async function holdStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<boolean> {
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
 * Permanently deducts stock after successful payment.
 * Called once per verified payment — idempotency is enforced at the order level.
 */
export async function commitStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE product_variants
       SET stock = stock - ?1,
           reserved_stock = reserved_stock - ?1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2`,
    )
    .bind(qty, variantId)
    .run();
}

/**
 * STEP 3 — ATOMIC ROLLBACK
 * Releases a reservation on payment failure, cart abandonment, or cron reaping.
 * Uses MAX(0, ...) to prevent negative reserved_stock from double rollbacks.
 */
export async function rollbackStock(
  db: D1Database,
  variantId: string,
  qty: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE product_variants
       SET reserved_stock = MAX(0, reserved_stock - ?1),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2`,
    )
    .bind(qty, variantId)
    .run();
}

/**
 * Returns available stock for a variant (stock - reserved_stock).
 * Never expose raw `stock` to clients.
 */
export async function checkStock(db: D1Database, variantId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT stock - reserved_stock AS available FROM product_variants WHERE id = ?`,
    )
    .bind(variantId)
    .first<{ available: number }>();
  return row?.available ?? 0;
}

