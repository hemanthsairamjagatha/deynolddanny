// Inventory Reaper — Cloudflare Cron Handler
//
// Triggered every 5 minutes via wrangler.toml crons trigger.
//
// Finds all orders that:
//   - Are still in 'pending' payment status
//   - Were created more than 15 minutes ago
//   - Have not been paid
//
// For each expired order: rolls back all reserved stock, then marks
// the order as 'cancelled'. This frees inventory for other customers.

import type { Env } from '../types/bindings.js';
import { getPendingExpiredOrderItems, bulkCancelExpiredOrders } from '../db/queries/orders.js';
import { rollbackStock } from './stockEngine.js';

export async function releaseExpiredReservations(
  event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  try {
    // 1. Fetch all (order_id, variant_id, quantity) for expired pending orders
    const expiredItems = await getPendingExpiredOrderItems(env.DB);

    if (expiredItems.length === 0) return;

    // 2. Roll back stock reservations for each item
    await Promise.all(
      expiredItems.map((item) => rollbackStock(env.DB, item.variant_id, item.quantity)),
    );

    // 3. Bulk-cancel all expired orders in a single query
    await bulkCancelExpiredOrders(env.DB);

    console.log(
      `[InventoryReaper] Cancelled ${expiredItems.length} expired reservation(s) at ${new Date().toISOString()}`,
    );
  } catch (err) {
    console.error('[InventoryReaper] Error during scheduled run:', err);
    // Do not rethrow — the cron must not crash the Worker
  }
}
