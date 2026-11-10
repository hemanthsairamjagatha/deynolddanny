import type { D1Database } from '@cloudflare/workers-types';
import type { DbProductVariant } from '../../types/models.js';

// ─── Admin inventory matrix ─────────────────────────────────────────────────

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
         pv.id          AS variantId,
         pv.product_id  AS productId,
         p.title        AS productTitle,
         pv.sku,
         pv.size,
         pv.color_name  AS colorName,
         pv.stock,
         pv.reserved_stock AS reservedStock,
         (pv.stock - pv.reserved_stock) AS availableStock,
         pv.is_active   AS isActive
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       ORDER BY p.sort_order ASC, p.title ASC, pv.size ASC`,
    )
    .all<InventoryRow>();
  return result.results ?? [];
}

// ─── Single variant stock adjustment ───────────────────────────────────────

export async function adjustStock(
  db: D1Database,
  variantId: string,
  newStock: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE product_variants
       SET stock = ?1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2`,
    )
    .bind(newStock, variantId)
    .run();
}

// ─── Bulk stock adjustment ──────────────────────────────────────────────────

export interface StockAdjustment {
  variantId: string;
  newStock: number;
}

export async function bulkAdjustStock(
  db: D1Database,
  adjustments: StockAdjustment[],
): Promise<void> {
  if (!adjustments.length) return;
  const statements = adjustments.map((a) =>
    db
      .prepare(
        `UPDATE product_variants
         SET stock = ?1,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?2`,
      )
      .bind(a.newStock, a.variantId),
  );
  await db.batch(statements);
}

// ─── Low stock variants ─────────────────────────────────────────────────────

export async function getLowStockVariants(
  db: D1Database,
  threshold = 3,
): Promise<InventoryRow[]> {
  const result = await db
    .prepare(
      `SELECT
         pv.id          AS variantId,
         pv.product_id  AS productId,
         p.title        AS productTitle,
         pv.sku,
         pv.size,
         pv.color_name  AS colorName,
         pv.stock,
         pv.reserved_stock AS reservedStock,
         (pv.stock - pv.reserved_stock) AS availableStock,
         pv.is_active   AS isActive
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

// ─── Activate / deactivate variant ─────────────────────────────────────────

export async function setVariantActive(
  db: D1Database,
  variantId: string,
  isActive: boolean,
): Promise<void> {
  await db
    .prepare(
      `UPDATE product_variants
       SET is_active = ?1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2`,
    )
    .bind(isActive ? 1 : 0, variantId)
    .run();
}

