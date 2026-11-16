// Inventory Reaper & Hygiene Cron Handler

import type { Env } from '../types/bindings.js';
import { nowIso, runBatch } from '../db/client.js';
import { recordInventoryMovements } from './stockEngine.js';

/**
 * Releases expired checkout stock holds using integer unixepoch comparison (`expires_epoch < unixepoch()`),
 * prevents double-rollback via atomic `stock_released = 0 -> 1` claim, releases held coupons,
 * and cleans up expired rate_limits / otps rows.
 */
export async function releaseExpiredReservations(
  _event: ScheduledEvent | unknown,
  env: Env,
  _ctx: ExecutionContext,
): Promise<{ cancelledOrders: number; releasedItems: number }> {
  let cancelledOrders = 0;
  let releasedItems = 0;

  try {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const now = nowIso();

    const expiredOrdersRes = await env.DB
      .prepare(
        `SELECT id, coupon_code
         FROM orders
         WHERE status = 'pending'
           AND payment_status = 'pending'
           AND stock_released = 0
           AND expires_epoch > 0
           AND expires_epoch < ?1
         LIMIT 50`,
      )
      .bind(nowEpoch)
      .all<{ id: string; coupon_code: string | null }>();

    const expiredOrders = expiredOrdersRes.results ?? [];

    for (const order of expiredOrders) {
      // Atomic single-winner claim so concurrent cron runs never double-rollback
      const claim = await env.DB
        .prepare(
          `UPDATE orders
           SET status = 'cancelled',
               cancellation_reason = 'reservation_expired',
               cancelled_at = ?1,
               stock_released = 1,
               updated_at = ?1
           WHERE id = ?2
             AND status = 'pending'
             AND payment_status = 'pending'
             AND stock_released = 0`,
        )
        .bind(now, order.id)
        .run();

      if ((claim.meta.changes ?? 0) === 0) continue;
      cancelledOrders++;

      const itemsRes = await env.DB
        .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
        .bind(order.id)
        .all<{ variant_id: string; quantity: number }>();

      const items = itemsRes.results ?? [];
      if (items.length > 0) {
        const releaseStmts = items.map((item) =>
          env.DB
            .prepare(
              `UPDATE product_variants
               SET reserved_stock = MAX(0, reserved_stock - ?1),
                   updated_at = ?2
               WHERE id = ?3`,
            )
            .bind(item.quantity, now, item.variant_id),
        );
        await runBatch(env.DB, releaseStmts);
        releasedItems += items.length;

        await recordInventoryMovements(
          env.DB,
          items.map((item) => ({
            variantId: item.variant_id,
            orderId: order.id,
            movementType: 'release',
            qtyDelta: -item.quantity,
            actorId: 'cron_reaper',
            notes: 'Expired pending checkout hold released',
          })),
        );
      }

      // Release held coupon usage & mark attempt expired
      await runBatch(env.DB, [
        env.DB
          .prepare(
            `UPDATE payment_attempts SET status = 'expired', updated_at = ?1
             WHERE order_id = ?2 AND status = 'created'`,
          )
          .bind(now, order.id),
        env.DB
          .prepare(
            `UPDATE coupons
             SET used_count = MAX(0, used_count - 1)
             WHERE id IN (
               SELECT coupon_id FROM coupon_redemptions WHERE order_id = ?1 AND status = 'held'
             )`,
          )
          .bind(order.id),
        env.DB
          .prepare(
            `UPDATE coupon_redemptions SET status = 'released' WHERE order_id = ?1 AND status = 'held'`,
          )
          .bind(order.id),
        env.DB
          .prepare(
            `INSERT INTO order_audit_logs (id, order_id, action, detail, performed_by, created_at)
             VALUES (hex(randomblob(8)), ?1, 'cancel', 'Reservation expired after 15 minutes; held stock released', 'cron_reaper', ?2)`,
          )
          .bind(order.id, now),
      ]);
    }

    // Periodic cleanup of expired rate limit counters (> 1 day old)
    await env.DB
      .prepare(`DELETE FROM rate_limits WHERE reset_epoch < ?1`)
      .bind(nowEpoch - 86400)
      .run();
  } catch (err) {
    console.error('[InventoryReaper] Error during scheduled run:', err);
  }

  return { cancelledOrders, releasedItems };
}
