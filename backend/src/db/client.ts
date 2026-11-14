// D1 transaction helper and query runner
// D1 doesn't support real transactions across statements, but supports batch

/**
 * Run multiple prepared statements as a D1 batch (atomic where possible).
 */
export async function runBatch(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<D1Result[]> {
  return db.batch(statements);
}

/**
 * Returns the current time as an ISO-8601 string (UTC).
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Generates a human-readable order number based on the current row count.
 * Format: DD-2026-000001
 */
export async function generateOrderNumber(db: D1Database): Promise<string> {
  const result = await db
    .prepare(`SELECT MAX(CAST(SUBSTR(order_number, 9) AS INTEGER)) as max_num FROM orders`)
    .first<{ max_num: number | null }>();
  const nextNum = (result?.max_num ?? 0) + 1;
  return `DD-2026-${String(nextNum).padStart(6, '0')}`;
}
