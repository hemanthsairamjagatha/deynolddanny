/**
 * DEYNOLD DANNY — Financial, Inventory & Order Lifecycle State Machine
 *
 * Centralizes paid-order finalization, late-capture safe allocation,
 * idempotent payment-failure stock rollback, duplicate-capture handling,
 * and refund accounting across client verify, webhooks, cron, and admin endpoints.
 */

import type { Env } from '../types/bindings.js';
import type { DbOrder } from '../types/models.js';
import { resolveStorePolicy } from '../config/policy.js';
import { nowIso, runBatch } from '../db/client.js';
import { generateId } from './crypto.js';
import { formatPaiseToDisplay, paiseToRupeesFloat } from './money.js';
import {
  commitHeldStock,
  commitUnreservedLateStock,
  recordInventoryMovements,
  restockCommittedStock,
  rollbackStock,
} from './stockEngine.js';
import {
  createRazorpayRefund,
} from './razorpay.js';
import { createCashfreeRefund } from './cashfree.js';
import {
  recordAndSendEmail,
  sendOrderCancelledEmail,
  sendOrderConfirmedEmail,
  sendRefundProcessedEmail,
  type OrderEmailItem,
} from './resend.js';

export async function appendOrderAuditLog(
  db: D1Database,
  orderId: string,
  action: string,
  detail: string,
  performedBy: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO order_audit_logs (id, order_id, action, detail, performed_by, created_at)
         VALUES (hex(randomblob(8)), ?1, ?2, ?3, ?4, ?5)`,
      )
      .bind(orderId, action, detail, performedBy, nowIso())
      .run();
  } catch {
    // Audit logging should never abort an already-committed state change
  }
}

/**
 * Transitions a pending/authorized/cancelled-by-timeout order to confirmed+paid
 * inside an atomic lock (`WHERE stock_committed = 0`) so stock is committed at most once.
 */
export async function finalizePaidOrder(
  env: Env,
  order: DbOrder,
  paymentId: string,
  paymentMethod: string | null,
  gatewayOrderId: string | null,
  executionCtx: { waitUntil(p: Promise<unknown>): void },
  source: string,
): Promise<{ status: DbOrder['status']; paymentStatus: 'paid'; allocated: boolean }> {
  const db = env.DB;
  const now = nowIso();

  // Atomic commit claim prevents double stock deduction across verify + webhook races
  const claim = await db
    .prepare(
      `UPDATE orders
       SET payment_status = 'paid',
           cf_payment_id = COALESCE(?1, cf_payment_id),
           payment_method = COALESCE(?2, payment_method),
           paid_at = COALESCE(paid_at, ?3),
           stock_committed = 1,
           updated_at = ?3
       WHERE id = ?4
         AND stock_committed = 0`,
    )
    .bind(paymentId, paymentMethod ?? 'razorpay', now, order.id)
    .run();

  if ((claim.meta.changes ?? 0) === 0) {
    // Check for true duplicate capture of a different paymentId on an already-paid order
    if (
      order.cf_payment_id &&
      paymentId &&
      order.cf_payment_id !== paymentId
    ) {
      await handleDuplicateCapture(env, order, paymentId, executionCtx, source);
    }
    const fresh = await db
      .prepare(`SELECT status FROM orders WHERE id = ?1`)
      .bind(order.id)
      .first<{ status: DbOrder['status'] }>();
    return {
      status: fresh?.status ?? order.status,
      paymentStatus: 'paid',
      allocated: true,
    };
  }

  const orderItemsRes = await db
    .prepare(
      `SELECT variant_id, title_snapshot, size_snapshot, color_snapshot, unit_price_paise, quantity
       FROM order_items WHERE order_id = ?1`,
    )
    .bind(order.id)
    .all<{
      variant_id: string;
      title_snapshot: string;
      size_snapshot: string;
      color_snapshot: string;
      unit_price_paise: number;
      quantity: number;
    }>();

  const items = orderItemsRes.results ?? [];
  let allocated = true;
  let nextStatus: DbOrder['status'] = 'confirmed';

  if (order.stock_released === 1) {
    // Late capture after cron reaper released reservation: safely try unreserved stock only
    const committedLate: Array<{ variant_id: string; quantity: number }> = [];
    for (const item of items) {
      const ok = await commitUnreservedLateStock(db, item.variant_id, item.quantity);
      if (ok) {
        committedLate.push(item);
      } else {
        allocated = false;
        break;
      }
    }

    if (!allocated) {
      // Compensate any partial late commits and route to manual allocation queue
      for (const item of committedLate) {
        await restockCommittedStock(db, item.variant_id, item.quantity);
      }
      nextStatus = 'confirmed_needs_allocation';
      await db
        .prepare(`UPDATE orders SET status = 'confirmed_needs_allocation', stock_committed = 0, updated_at = ?1 WHERE id = ?2`)
        .bind(now, order.id)
        .run();
      await appendOrderAuditLog(
        db,
        order.id,
        'late_capture_needs_allocation',
        `Payment ${paymentId} captured after hold expiry; insufficient unreserved stock. Escalated for manual allocation or refund.`,
        source,
      );
    } else if (committedLate.length > 0) {
      await recordInventoryMovements(
        db,
        committedLate.map((item) => ({
          variantId: item.variant_id,
          orderId: order.id,
          movementType: 'commit',
          qtyDelta: -item.quantity,
          actorId: source,
          notes: 'Late capture allocated from unreserved stock',
        })),
      );
    }
  } else {
    // Normal reservation active: deduct held stock without touching other buyers' holds
    const committedItems: Array<{ variant_id: string; quantity: number }> = [];
    for (const item of items) {
      const ok = await commitHeldStock(db, item.variant_id, item.quantity);
      if (ok) {
        committedItems.push(item);
      } else {
        allocated = false;
      }
    }

    if (!allocated) {
      nextStatus = 'confirmed_needs_allocation';
      await appendOrderAuditLog(
        db,
        order.id,
        'allocation_drift',
        `Held stock mismatch while finalizing payment ${paymentId}; flagged for ops review.`,
        source,
      );
    }

    if (committedItems.length > 0) {
      await recordInventoryMovements(
        db,
        committedItems.map((item) => ({
          variantId: item.variant_id,
          orderId: order.id,
          movementType: 'commit',
          qtyDelta: -item.quantity,
          actorId: source,
          notes: `Committed held stock on payment ${paymentId}`,
        })),
      );
    }
  }

  await runBatch(db, [
    db
      .prepare(`UPDATE orders SET status = ?1, updated_at = ?2 WHERE id = ?3`)
      .bind(nextStatus, now, order.id),
    db
      .prepare(
        `UPDATE payment_attempts
         SET status = 'captured', gateway_payment_id = COALESCE(?1, gateway_payment_id), updated_at = ?2
         WHERE order_id = ?3 AND (gateway_order_id = ?4 OR ?4 IS NULL)`,
      )
      .bind(paymentId, now, order.id, gatewayOrderId),
    db
      .prepare(
        `UPDATE coupon_redemptions SET status = 'applied' WHERE order_id = ?1 AND status = 'held'`,
      )
      .bind(order.id),
    // Clear user's persisted bag only AFTER payment is confirmed
    db
      .prepare(
        `DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?1)`,
      )
      .bind(order.user_id),
  ]);

  await appendOrderAuditLog(
    db,
    order.id,
    'payment_confirmed',
    `Payment ${paymentId} (${paymentMethod ?? 'gateway'}) verified -> status ${nextStatus}`,
    source,
  );

  // Dispatch confirmation email asynchronously (idempotent via email_outbox dedupe key)
  const userRow = await db
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();

  if (userRow?.email) {
    const emailItems: OrderEmailItem[] = items.map((r) => ({
      title: r.title_snapshot,
      size: r.size_snapshot,
      color: r.color_snapshot,
      quantity: r.quantity,
      unitPrice: formatPaiseToDisplay(r.unit_price_paise),
    }));
    const totalFormatted = formatPaiseToDisplay(order.total_paise);

    executionCtx.waitUntil(
      recordAndSendEmail(
        db,
        `order_confirmed:${order.order_number}`,
        'order_confirmed',
        userRow.email,
        { orderNumber: order.order_number, totalFormatted },
        () =>
          sendOrderConfirmedEmail(
            env.RESEND_API_KEY,
            userRow.email,
            order.order_number,
            totalFormatted,
            emailItems,
            env.RESEND_FROM_EMAIL,
          ),
      ).catch((err) => console.error('Order confirmation email failed:', err)),
    );
  }

  return { status: nextStatus, paymentStatus: 'paid', allocated };
}

/**
 * Releases reserved stock once for failed / user-dropped checkout attempts.
 */
export async function releaseOrderHoldOnFailure(
  db: D1Database,
  orderId: string,
  paymentStatus: 'failed' | 'user_dropped' | 'cancelled',
  gatewayPaymentId: string | null,
  reason: string,
  source: string,
): Promise<boolean> {
  const now = nowIso();
  const targetPayStatus = paymentStatus === 'cancelled' ? 'failed' : paymentStatus;

  const claim = await db
    .prepare(
      `UPDATE orders
       SET status = 'cancelled',
           payment_status = ?1,
           cf_payment_id = COALESCE(?2, cf_payment_id),
           cancellation_reason = ?3,
           cancelled_at = ?4,
           stock_released = 1,
           updated_at = ?4
       WHERE id = ?5
         AND payment_status NOT IN ('paid', 'partially_refunded', 'refunded')
         AND stock_released = 0`,
    )
    .bind(targetPayStatus, gatewayPaymentId, reason, now, orderId)
    .run();

  if ((claim.meta.changes ?? 0) === 0) {
    return false;
  }

  const itemsRes = await db
    .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
    .bind(orderId)
    .all<{ variant_id: string; quantity: number }>();

  const items = itemsRes.results ?? [];
  for (const item of items) {
    await rollbackStock(db, item.variant_id, item.quantity);
  }

  if (items.length > 0) {
    await recordInventoryMovements(
      db,
      items.map((item) => ({
        variantId: item.variant_id,
        orderId,
        movementType: 'release',
        qtyDelta: -item.quantity,
        actorId: source,
        notes: reason,
      })),
    );
  }

  await runBatch(db, [
    db
      .prepare(
        `UPDATE payment_attempts
         SET status = 'failed', failure_reason = ?1, updated_at = ?2
         WHERE order_id = ?3 AND status IN ('created', 'authorized')`,
      )
      .bind(reason, now, orderId),
    db
      .prepare(
        `UPDATE coupons
         SET used_count = MAX(0, used_count - 1)
         WHERE id IN (
           SELECT coupon_id FROM coupon_redemptions WHERE order_id = ?1 AND status = 'held'
         )`,
      )
      .bind(orderId),
    db
      .prepare(`UPDATE coupon_redemptions SET status = 'released' WHERE order_id = ?1 AND status = 'held'`)
      .bind(orderId),
  ]);

  await appendOrderAuditLog(db, orderId, 'cancel', reason, source);
  return true;
}

/**
 * Handles secondary captured payments for the same order under BD-13 rules.
 */
async function handleDuplicateCapture(
  env: Env,
  order: DbOrder,
  duplicatePaymentId: string,
  executionCtx: { waitUntil(p: Promise<unknown>): void },
  source: string,
): Promise<void> {
  const existingRefund = await env.DB
    .prepare(`SELECT id FROM refunds WHERE order_id = ?1 AND payment_id = ?2 LIMIT 1`)
    .bind(order.id, duplicatePaymentId)
    .first();
  if (existingRefund) return;

  const policy = resolveStorePolicy(env);

  if (
    policy.autoRefundDuplicateCapture &&
    duplicatePaymentId.startsWith('pay_') &&
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET
  ) {
    try {
      const rzpRefund = await createRazorpayRefund(
        duplicatePaymentId,
        order.total_paise,
        { reason: 'duplicate_capture_auto_refund', orderId: order.id },
        env.RAZORPAY_KEY_ID,
        env.RAZORPAY_KEY_SECRET,
      );
      await env.DB
        .prepare(
          `INSERT INTO refunds (id, order_id, payment_id, gateway, gateway_refund_id, amount_paise, reason, status, initiated_by, created_at, updated_at)
           VALUES (?1, ?2, ?3, 'razorpay', ?4, ?5, 'Duplicate payment capture auto-refund', 'pending', ?6, ?7, ?7)`,
        )
        .bind(
          generateId('rfnd_'),
          order.id,
          duplicatePaymentId,
          rzpRefund.id,
          order.total_paise,
          source,
          nowIso(),
        )
        .run();

      await appendOrderAuditLog(
        env.DB,
        order.id,
        'duplicate_capture_refunded',
        `Duplicate capture ${duplicatePaymentId} auto-refunded (${rzpRefund.id})`,
        source,
      );
      return;
    } catch (err) {
      console.error('Auto-refund duplicate capture failed:', err);
    }
  }

  // Safe default pending BD-13 approval: hold in manual finance review queue
  await appendOrderAuditLog(
    env.DB,
    order.id,
    'duplicate_capture_manual_review',
    `Secondary payment ${duplicatePaymentId} captured on already-paid order (primary: ${order.cf_payment_id}). Awaiting manual refund or BD-13 auto-refund enablement.`,
    source,
  );
  void executionCtx;
}

/**
 * Initiates and records a partial or full refund against a paid order, enforcing
 * total_paise >= refunded_paise + amountPaise and active-dispute freeze protections.
 */
export async function initiateOrderRefund(
  env: Env,
  order: DbOrder,
  amountPaise: number,
  reason: string,
  restockItems: boolean,
  actorId: string,
  executionCtx: { waitUntil(p: Promise<unknown>): void },
): Promise<{
  refundId: string;
  gatewayRefundId: string;
  amountPaise: number;
  newRefundedPaise: number;
  paymentStatus: 'partially_refunded' | 'refunded';
}> {
  if (order.dispute_frozen === 1 || order.payment_status === 'disputed') {
    throw new Error('DISPUTE_FROZEN: Cannot refund order while an active payment dispute or chargeback is open.');
  }
  if (!['paid', 'partially_refunded'].includes(order.payment_status)) {
    throw new Error('ORDER_NOT_PAID: Only paid or partially refunded orders can be refunded.');
  }

  const alreadyRefunded = order.refunded_paise ?? 0;
  const maxRefundable = order.total_paise - alreadyRefunded;
  if (amountPaise <= 0 || amountPaise > maxRefundable) {
    throw new Error(
      `INVALID_REFUND_AMOUNT: Requested ${amountPaise} paise exceeds remaining refundable balance of ${maxRefundable} paise.`,
    );
  }

  const refundId = generateId('rfnd_');
  let gatewayRefundId = refundId;
  let gateway: 'razorpay' | 'cashfree' | 'manual' = 'manual';
  const paymentId = order.cf_payment_id || '';

  if (paymentId.startsWith('pay_') && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const res = await createRazorpayRefund(
      paymentId,
      amountPaise,
      { orderId: order.id, orderNumber: order.order_number, reason },
      env.RAZORPAY_KEY_ID,
      env.RAZORPAY_KEY_SECRET,
    );
    gatewayRefundId = res.id;
    gateway = 'razorpay';
  } else if (
    order.cf_order_id &&
    env.CASHFREE_APP_ID &&
    env.CASHFREE_SECRET_KEY &&
    !order.cf_order_id.startsWith('test_')
  ) {
    const res = await createCashfreeRefund(
      order.order_number,
      refundId,
      paiseToRupeesFloat(amountPaise),
      reason,
      env.CASHFREE_APP_ID,
      env.CASHFREE_SECRET_KEY,
      env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg',
      env.CASHFREE_API_VERSION || '2023-08-01',
    );
    gatewayRefundId = res.cfRefundId;
    gateway = 'cashfree';
  }

  const newRefundedPaise = alreadyRefunded + amountPaise;
  const isFullRefund = newRefundedPaise >= order.total_paise;
  const nextPayStatus: 'partially_refunded' | 'refunded' = isFullRefund
    ? 'refunded'
    : 'partially_refunded';
  const now = nowIso();

  await runBatch(env.DB, [
    env.DB
      .prepare(
        `INSERT INTO refunds (id, order_id, payment_id, gateway, gateway_refund_id, amount_paise, reason, status, initiated_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
      )
      .bind(
        refundId,
        order.id,
        paymentId || null,
        gateway,
        gatewayRefundId,
        amountPaise,
        reason,
        gateway === 'manual' ? 'processed' : 'pending',
        actorId,
        now,
      ),
    env.DB
      .prepare(
        `UPDATE orders
         SET refunded_paise = ?1,
             payment_status = ?2,
             status = CASE WHEN ?3 = 1 THEN 'refunded' ELSE status END,
             updated_at = ?4
         WHERE id = ?5`,
      )
      .bind(newRefundedPaise, nextPayStatus, isFullRefund ? 1 : 0, now, order.id),
  ]);

  if (restockItems && isFullRefund && order.stock_committed === 1) {
    const itemsRes = await env.DB
      .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
      .bind(order.id)
      .all<{ variant_id: string; quantity: number }>();

    const items = itemsRes.results ?? [];
    for (const item of items) {
      await restockCommittedStock(env.DB, item.variant_id, item.quantity);
    }
    if (items.length > 0) {
      await recordInventoryMovements(
        env.DB,
        items.map((item) => ({
          variantId: item.variant_id,
          orderId: order.id,
          movementType: 'return_restock',
          qtyDelta: item.quantity,
          actorId,
          notes: `Restocked on refund ${refundId}`,
        })),
      );
    }
  }

  await appendOrderAuditLog(
    env.DB,
    order.id,
    'refund',
    `Refund ${gatewayRefundId} (${formatPaiseToDisplay(amountPaise)}): ${reason}`,
    actorId,
  );

  const userRow = await env.DB
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();

  if (userRow?.email) {
    const amountFormatted = formatPaiseToDisplay(amountPaise);
    executionCtx.waitUntil(
      recordAndSendEmail(
        env.DB,
        `refund:${refundId}`,
        'refund_processed',
        userRow.email,
        { orderNumber: order.order_number, amountFormatted },
        () =>
          sendRefundProcessedEmail(
            env.RESEND_API_KEY,
            userRow.email,
            order.order_number,
            amountFormatted,
            env.RESEND_FROM_EMAIL,
          ),
      ).catch((err) => console.error('Refund notification email failed:', err)),
    );
  }

  return {
    refundId,
    gatewayRefundId,
    amountPaise,
    newRefundedPaise,
    paymentStatus: nextPayStatus,
  };
}

export async function notifyOrderCancelled(
  env: Env,
  order: DbOrder,
  reason: string,
  executionCtx: { waitUntil(p: Promise<unknown>): void },
): Promise<void> {
  const userRow = await env.DB
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();
  if (!userRow?.email) return;

  executionCtx.waitUntil(
    recordAndSendEmail(
      env.DB,
      `order_cancelled:${order.order_number}`,
      'order_cancelled',
      userRow.email,
      { orderNumber: order.order_number, reason },
      () =>
        sendOrderCancelledEmail(
          env.RESEND_API_KEY,
          userRow.email,
          order.order_number,
          reason,
          env.RESEND_FROM_EMAIL,
        ),
    ).catch((err) => console.error('Order cancelled email failed:', err)),
  );
}
