import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { DbOrder } from '../types/models.js';
import { resolveStorePolicy } from '../config/policy.js';
import { authRequired } from '../middleware/auth.js';
import { getOrderById, getOrderByCfOrderId } from '../db/queries/orders.js';
import {
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
} from '../services/razorpay.js';
import { verifyCashfreeSignature, fetchCashfreeOrder } from '../services/cashfree.js';
import {
  appendOrderAuditLog,
  finalizePaidOrder,
  releaseOrderHoldOnFailure,
} from '../services/orderLifecycle.js';
import { generateId, sha256Hex } from '../services/crypto.js';
import { formatPaiseToDisplay } from '../services/money.js';
import { nowIso, runBatch } from '../db/client.js';

const payments = new Hono<{ Bindings: Env }>();

const verifyClientPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  cfOrderId: z.string().optional(),
});

async function recordWebhookEventOnce(
  db: D1Database,
  gateway: 'razorpay' | 'cashfree',
  eventId: string,
  eventType: string,
  rawBody: string,
  orderId?: string | null,
): Promise<boolean> {
  const hash = await sha256Hex(rawBody);
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO webhook_events (id, gateway, event_id, event_type, order_id, payload_hash, status, received_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'processing', ?7)`,
    )
    .bind(generateId('whk_'), gateway, eventId, eventType, orderId ?? null, hash, nowIso())
    .run();

  return (res.meta.changes ?? 0) > 0;
}

async function markWebhookProcessed(
  db: D1Database,
  gateway: 'razorpay' | 'cashfree',
  eventId: string,
  status: 'processed' | 'ignored' | 'failed',
  orderId?: string | null,
  errorMessage?: string,
) {
  await db
    .prepare(
      `UPDATE webhook_events
       SET status = ?1, order_id = COALESCE(?2, order_id), error_message = ?3, processed_at = ?4
       WHERE gateway = ?5 AND event_id = ?6`,
    )
    .bind(status, orderId ?? null, errorMessage ?? null, nowIso(), gateway, eventId)
    .run();
}

// ─── POST /api/payments/verify ──────────────────────────────────────────────

payments.post('/verify', authRequired, zValidator('json', verifyClientPaymentSchema), async (c) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, cfOrderId } =
    c.req.valid('json');
  const userId = c.get('userId');
  const env = c.env;
  const policy = resolveStorePolicy(env);

  const order = (await getOrderById(env.DB, orderId)) as DbOrder | null;
  if (!order || order.user_id !== userId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') {
    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
      },
    });
  }

  // 1. Razorpay strict verification flow
  if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
    // Reject mismatched/cross-order Razorpay IDs
    const matchingAttempt = await env.DB
      .prepare(
        `SELECT 1 FROM payment_attempts WHERE order_id = ?1 AND gateway = 'razorpay' AND gateway_order_id = ?2 LIMIT 1`,
      )
      .bind(order.id, razorpayOrderId)
      .first();

    if (order.cf_order_id !== razorpayOrderId && !matchingAttempt) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ORDER_ID_MISMATCH',
            message: 'Gateway order ID does not match this order.',
            status: 400,
          },
        },
        400,
      );
    }

    const isValidSig = await verifyRazorpayPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      env.RAZORPAY_KEY_SECRET,
    );

    if (!isValidSig) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Payment signature verification failed.',
            status: 400,
          },
        },
        400,
      );
    }

    // Must verify real status, amount, currency & binding directly with Razorpay
    let details;
    try {
      details = await fetchRazorpayPayment(
        razorpayPaymentId,
        env.RAZORPAY_KEY_ID,
        env.RAZORPAY_KEY_SECRET,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'GATEWAY_VERIFY_UNAVAILABLE',
            message: 'Unable to confirm payment status with payment gateway. If debited, webhook reconciliation will update your order shortly.',
            status: 502,
          },
        },
        502,
      );
    }

    if (
      details.orderId !== razorpayOrderId ||
      details.amount !== order.total_paise ||
      details.currency !== 'INR'
    ) {
      await appendOrderAuditLog(
        env.DB,
        order.id,
        'payment_mismatch_rejected',
        `Rejected payment ${razorpayPaymentId}: expected amount=${order.total_paise} INR order=${razorpayOrderId}, got amount=${details.amount} ${details.currency} order=${details.orderId}`,
        userId,
      );
      return c.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_MISMATCH',
            message: 'Payment amount, currency, or order reference did not match order total.',
            status: 400,
          },
        },
        400,
      );
    }

    if (details.status === 'authorized') {
      await runBatch(env.DB, [
        env.DB
          .prepare(
            `UPDATE orders SET status = 'awaiting_capture', payment_status = 'authorized', cf_payment_id = ?1, payment_method = ?2, updated_at = ?3 WHERE id = ?4 AND payment_status = 'pending'`,
          )
          .bind(details.id, details.method || 'razorpay', nowIso(), order.id),
        env.DB
          .prepare(
            `UPDATE payment_attempts SET status = 'authorized', gateway_payment_id = ?1, raw_status = 'authorized', updated_at = ?2 WHERE order_id = ?3 AND gateway_order_id = ?4`,
          )
          .bind(details.id, nowIso(), order.id, razorpayOrderId),
      ]);
      return c.json(
        {
          success: true,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'awaiting_capture',
            paymentStatus: 'authorized',
          },
        },
        202,
      );
    }

    if (details.status !== 'captured') {
      return c.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_NOT_CAPTURED',
            message: `Payment status is "${details.status}". Only captured payments confirm orders.`,
            status: 402,
          },
        },
        402,
      );
    }

    const finalized = await finalizePaidOrder(
      env,
      order,
      details.id,
      details.method || 'razorpay',
      razorpayOrderId,
      c.executionCtx,
      'client_verify',
    );

    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: finalized.paymentStatus,
        status: finalized.status,
      },
    });
  }

  // 2. Cashfree strict verification flow
  const targetCfOrderId = cfOrderId || order.cf_order_id;
  if (
    targetCfOrderId &&
    env.CASHFREE_APP_ID &&
    env.CASHFREE_SECRET_KEY &&
    order.cf_order_id === targetCfOrderId
  ) {
    let cfStatus;
    try {
      cfStatus = await fetchCashfreeOrder(
        targetCfOrderId,
        env.CASHFREE_APP_ID,
        env.CASHFREE_SECRET_KEY,
        env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg',
        env.CASHFREE_API_VERSION || '2023-08-01',
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'GATEWAY_VERIFY_UNAVAILABLE',
            message: 'Unable to reach Cashfree verification endpoint.',
            status: 502,
          },
        },
        502,
      );
    }

    if (
      cfStatus.status === 'PAID' &&
      (cfStatus.amountPaise === null || cfStatus.amountPaise === order.total_paise) &&
      (!cfStatus.currency || cfStatus.currency === 'INR')
    ) {
      const finalized = await finalizePaidOrder(
        env,
        order,
        cfStatus.paymentId || targetCfOrderId,
        cfStatus.paymentMethod || 'cashfree',
        targetCfOrderId,
        c.executionCtx,
        'client_verify_cashfree',
      );

      return c.json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          paymentStatus: finalized.paymentStatus,
          status: finalized.status,
        },
      });
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'PAYMENT_NOT_CONFIRMED',
          message: `Gateway payment status is ${cfStatus.status}. Please complete payment.`,
          status: 402,
        },
      },
      402,
    );
  }

  // 3. Explicit development test-mode opt-in ONLY
  if (policy.allowTestCheckoutFallback && order.cf_order_id?.startsWith('test_order_')) {
    const finalized = await finalizePaidOrder(
      env,
      order,
      order.cf_order_id,
      'test_dev_sandbox',
      order.cf_order_id,
      c.executionCtx,
      'dev_test_verify',
    );
    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: finalized.paymentStatus,
        status: finalized.status,
      },
    });
  }

  return c.json(
    {
      success: false,
      error: {
        code: 'PAYMENT_VERIFICATION_FAILED',
        message: 'Payment could not be verified. Missing valid gateway transaction proofs.',
        status: 400,
      },
    },
    400,
  );
});

// ─── POST /api/payments/webhook ──────────────────────────────────────────────

payments.post('/webhook', async (c) => {
  const env = c.env;
  const rawBody = await c.req.text();

  // 1. Razorpay Webhook
  const rzpSignature = c.req.header('x-razorpay-signature');
  if (rzpSignature) {
    const isRzpValid = await verifyRazorpayWebhookSignature(
      rawBody,
      rzpSignature,
      env.RAZORPAY_WEBHOOK_SECRET,
    );
    if (!isRzpValid) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid Razorpay webhook signature.', status: 403 } },
        403,
      );
    }

    let rzpEvent: any;
    try {
      rzpEvent = JSON.parse(rawBody);
    } catch {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON.', status: 400 } }, 400);
    }

    const eventName = String(rzpEvent.event || '');
    const eventId =
      c.req.header('x-razorpay-event-id') ||
      `${eventName}:${rzpEvent.payload?.payment?.entity?.id || rzpEvent.payload?.refund?.entity?.id || rzpEvent.payload?.dispute?.entity?.id || await sha256Hex(rawBody)}`;

    const paymentEntity = rzpEvent.payload?.payment?.entity;
    const refundEntity = rzpEvent.payload?.refund?.entity;
    const disputeEntity = rzpEvent.payload?.dispute?.entity;
    const rzpOrderId =
      paymentEntity?.order_id || rzpEvent.payload?.order?.entity?.id;
    const paymentId =
      paymentEntity?.id || refundEntity?.payment_id || disputeEntity?.payment_id;

    let order: DbOrder | null = null;
    if (rzpOrderId) {
      order = await getOrderByCfOrderId(env.DB, rzpOrderId);
    } else if (paymentId) {
      order = await env.DB
        .prepare(`SELECT * FROM orders WHERE cf_payment_id = ?1 LIMIT 1`)
        .bind(paymentId)
        .first<DbOrder>();
    }

    const isFresh = await recordWebhookEventOnce(
      env.DB,
      'razorpay',
      eventId,
      eventName,
      rawBody,
      order?.id ?? null,
    );
    if (!isFresh) {
      return c.json({ success: true, data: { received: true, deduplicated: true } });
    }

    try {
      if (!order) {
        await markWebhookProcessed(env.DB, 'razorpay', eventId, 'ignored', null, 'Order not found');
        return c.json({ success: true, data: { received: true, not_found: true } });
      }

      if (eventName === 'payment.authorized') {
        await runBatch(env.DB, [
          env.DB
            .prepare(
              `UPDATE orders SET status = CASE WHEN status = 'pending' THEN 'awaiting_capture' ELSE status END, payment_status = CASE WHEN payment_status = 'pending' THEN 'authorized' ELSE payment_status END, cf_payment_id = COALESCE(?1, cf_payment_id), updated_at = ?2 WHERE id = ?3`,
            )
            .bind(paymentId ?? null, nowIso(), order.id),
          env.DB
            .prepare(
              `UPDATE payment_attempts SET status = 'authorized', gateway_payment_id = COALESCE(?1, gateway_payment_id), updated_at = ?2 WHERE order_id = ?3 AND gateway_order_id = ?4`,
            )
            .bind(paymentId ?? null, nowIso(), order.id, rzpOrderId ?? ''),
        ]);
        await markWebhookProcessed(env.DB, 'razorpay', eventId, 'processed', order.id);
        return c.json({ success: true, data: { received: true, status: 'authorized' } });
      }

      if (eventName === 'payment.captured' || eventName === 'order.paid') {
        const amountPaise = Number(paymentEntity?.amount ?? rzpEvent.payload?.order?.entity?.amount ?? 0);
        const currency = String(paymentEntity?.currency || 'INR');
        if (amountPaise !== order.total_paise || currency !== 'INR') {
          await markWebhookProcessed(
            env.DB,
            'razorpay',
            eventId,
            'ignored',
            order.id,
            `Amount/currency mismatch: expected ${order.total_paise} INR, got ${amountPaise} ${currency}`,
          );
          await appendOrderAuditLog(
            env.DB,
            order.id,
            'webhook_amount_mismatch',
            `Rejected webhook ${eventName}: got ${amountPaise} ${currency}, expected ${order.total_paise} INR`,
            'razorpay_webhook',
          );
          return c.json({ success: true, data: { received: true, ignored: true } });
        }

        await finalizePaidOrder(
          env,
          order,
          paymentId ?? rzpOrderId,
          paymentEntity?.method ?? 'razorpay',
          rzpOrderId ?? null,
          c.executionCtx,
          'razorpay_webhook',
        );
        await markWebhookProcessed(env.DB, 'razorpay', eventId, 'processed', order.id);
        return c.json({ success: true, data: { received: true, processed: true } });
      }

      if (eventName === 'payment.failed') {
        await releaseOrderHoldOnFailure(
          env.DB,
          order.id,
          'failed',
          paymentId ?? null,
          paymentEntity?.error_description || 'Razorpay payment failed',
          'razorpay_webhook',
        );
        await markWebhookProcessed(env.DB, 'razorpay', eventId, 'processed', order.id);
        return c.json({ success: true, data: { received: true, failed: true } });
      }

      if (eventName === 'refund.created' || eventName === 'refund.processed' || eventName === 'refund.failed') {
        const gwRefundId = String(refundEntity?.id || '');
        const refundAmount = Number(refundEntity?.amount || 0);
        const nextRefundStatus = eventName === 'refund.failed' ? 'failed' : eventName === 'refund.processed' ? 'processed' : 'pending';

        if (gwRefundId) {
          const existing = await env.DB
            .prepare(`SELECT id FROM refunds WHERE gateway_refund_id = ?1 LIMIT 1`)
            .bind(gwRefundId)
            .first<{ id: string }>();
          if (existing) {
            await env.DB
              .prepare(`UPDATE refunds SET status = ?1, updated_at = ?2 WHERE id = ?3`)
              .bind(nextRefundStatus, nowIso(), existing.id)
              .run();
          } else if (refundAmount > 0 && nextRefundStatus !== 'failed') {
            await env.DB
              .prepare(
                `INSERT INTO refunds (id, order_id, payment_id, gateway, gateway_refund_id, amount_paise, reason, status, initiated_by, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'razorpay', ?4, ?5, 'Gateway refund webhook sync', ?6, 'razorpay_webhook', ?7, ?7)`,
              )
              .bind(
                generateId('rfnd_'),
                order.id,
                paymentId ?? null,
                gwRefundId,
                refundAmount,
                nextRefundStatus,
                nowIso(),
              )
              .run();
          }

          if (eventName === 'refund.processed') {
            const sumRow = await env.DB
              .prepare(`SELECT COALESCE(SUM(amount_paise), 0) AS total_ref FROM refunds WHERE order_id = ?1 AND status != 'failed'`)
              .bind(order.id)
              .first<{ total_ref: number }>();
            const totalRef = Math.min(order.total_paise, sumRow?.total_ref ?? 0);
            const full = totalRef >= order.total_paise;
            await env.DB
              .prepare(
                `UPDATE orders SET refunded_paise = ?1, payment_status = ?2, status = CASE WHEN ?3 = 1 THEN 'refunded' ELSE status END, updated_at = ?4 WHERE id = ?5`,
              )
              .bind(totalRef, full ? 'refunded' : 'partially_refunded', full ? 1 : 0, nowIso(), order.id)
              .run();
          }
          await appendOrderAuditLog(
            env.DB,
            order.id,
            'refund_webhook',
            `Razorpay ${eventName} (${gwRefundId})`,
            'razorpay_webhook',
          );
        }
        await markWebhookProcessed(env.DB, 'razorpay', eventId, 'processed', order.id);
        return c.json({ success: true, data: { received: true, refund: true } });
      }

      if (eventName.startsWith('payment.dispute.')) {
        const disputeId = String(disputeEntity?.id || '');
        const disputeStatus = String(disputeEntity?.status || eventName.replace('payment.dispute.', ''));
        const isClosed = eventName === 'payment.dispute.closed' || eventName === 'payment.dispute.won' || eventName === 'payment.dispute.lost';

        if (disputeId) {
          await runBatch(env.DB, [
            env.DB
              .prepare(
                `INSERT INTO payment_disputes (id, order_id, gateway, gateway_dispute_id, payment_id, amount_paise, reason_code, status, created_at, updated_at)
                 VALUES (?1, ?2, 'razorpay', ?3, ?4, ?5, ?6, ?7, ?8, ?8)
                 ON CONFLICT(gateway_dispute_id) DO UPDATE SET status = excluded.status, resolved_outcome = excluded.status, updated_at = excluded.updated_at`,
              )
              .bind(
                generateId('dsp_'),
                order.id,
                disputeId,
                paymentId ?? null,
                Number(disputeEntity?.amount ?? order.total_paise),
                disputeEntity?.reason_code ?? null,
                disputeStatus,
                nowIso(),
              ),
            env.DB
              .prepare(
                `UPDATE orders
                 SET dispute_frozen = ?1,
                     payment_status = CASE WHEN ?1 = 1 THEN 'disputed' ELSE CASE WHEN refunded_paise >= total_paise THEN 'refunded' WHEN refunded_paise > 0 THEN 'partially_refunded' ELSE 'paid' END END,
                     updated_at = ?2
                 WHERE id = ?3`,
              )
              .bind(isClosed ? 0 : 1, nowIso(), order.id),
          ]);
          await appendOrderAuditLog(
            env.DB,
            order.id,
            'payment_dispute',
            `Dispute ${disputeId}: ${eventName} (${disputeStatus})`,
            'razorpay_webhook',
          );
        }
        await markWebhookProcessed(env.DB, 'razorpay', eventId, 'processed', order.id);
        return c.json({ success: true, data: { received: true, dispute: true } });
      }

      await markWebhookProcessed(env.DB, 'razorpay', eventId, 'ignored', order.id);
      return c.json({ success: true, data: { received: true, event: eventName } });
    } catch (err) {
      await markWebhookProcessed(
        env.DB,
        'razorpay',
        eventId,
        'failed',
        order?.id ?? null,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  // 2. Cashfree Webhook (strict 300s timestamp replay window + signature check)
  const cfTimestamp = c.req.header('x-webhook-timestamp') ?? '';
  const cfSignature = c.req.header('x-webhook-signature') ?? '';

  if (cfSignature && env.CASHFREE_SECRET_KEY) {
    const signatureValid = await verifyCashfreeSignature(
      rawBody,
      cfTimestamp,
      cfSignature,
      env.CASHFREE_SECRET_KEY,
    );

    if (!signatureValid) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired Cashfree webhook signature.', status: 403 } },
        403,
      );
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON.', status: 400 } }, 400);
    }

    const eventType = String(event.type || '');
    const eventId = `${eventType}:${event.data?.payment?.cf_payment_id || event.data?.refund?.cf_refund_id || await sha256Hex(cfTimestamp + rawBody)}`;
    const cfOrderId = event.data?.order?.cf_order_id ?? event.data?.order?.order_id;
    const cfPaymentId = event.data?.payment?.cf_payment_id;
    const order = cfOrderId ? ((await getOrderByCfOrderId(env.DB, String(cfOrderId))) as DbOrder | null) : null;

    const isFresh = await recordWebhookEventOnce(env.DB, 'cashfree', eventId, eventType, rawBody, order?.id ?? null);
    if (!isFresh) {
      return c.json({ success: true, data: { received: true, deduplicated: true } });
    }

    if (!order) {
      await markWebhookProcessed(env.DB, 'cashfree', eventId, 'ignored', null, 'Order not found');
      return c.json({ success: true, data: { received: true } });
    }

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || eventType === 'PAYMENT_SUCCESS') {
      const amtNum = Number(event.data?.order?.order_amount ?? event.data?.payment?.payment_amount ?? 0);
      const amtPaise = Math.round(amtNum * 100);
      const cur = String(event.data?.order?.order_currency ?? event.data?.payment?.payment_currency ?? 'INR');
      if ((amtPaise > 0 && amtPaise !== order.total_paise) || cur !== 'INR') {
        await markWebhookProcessed(env.DB, 'cashfree', eventId, 'ignored', order.id, 'Amount/currency mismatch');
        return c.json({ success: true, data: { received: true, ignored: true } });
      }
      await finalizePaidOrder(
        env,
        order,
        cfPaymentId ? String(cfPaymentId) : String(cfOrderId),
        'cashfree',
        String(cfOrderId),
        c.executionCtx,
        'cashfree_webhook',
      );
      await markWebhookProcessed(env.DB, 'cashfree', eventId, 'processed', order.id);
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' || eventType === 'PAYMENT_FAILED' || eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' || eventType === 'USER_DROPPED') {
      await releaseOrderHoldOnFailure(
        env.DB,
        order.id,
        eventType.includes('DROPPED') ? 'user_dropped' : 'failed',
        cfPaymentId ? String(cfPaymentId) : null,
        `Cashfree ${eventType}`,
        'cashfree_webhook',
      );
      await markWebhookProcessed(env.DB, 'cashfree', eventId, 'processed', order.id);
    } else if (eventType === 'REFUND_STATUS_WEBHOOK') {
      const cfRefundId = String(event.data?.refund?.cf_refund_id || '');
      const refundStatus = String(event.data?.refund?.refund_status || '').toUpperCase();
      if (cfRefundId) {
        const mapped = refundStatus === 'SUCCESS' ? 'processed' : refundStatus === 'CANCELLED' ? 'failed' : 'pending';
        await env.DB
          .prepare(`UPDATE refunds SET status = ?1, updated_at = ?2 WHERE gateway_refund_id = ?3`)
          .bind(mapped, nowIso(), cfRefundId)
          .run();
      }
      await markWebhookProcessed(env.DB, 'cashfree', eventId, 'processed', order.id);
    } else {
      await markWebhookProcessed(env.DB, 'cashfree', eventId, 'ignored', order.id);
    }

    return c.json({ success: true, data: { received: true } });
  }

  return c.json(
    { success: false, error: { code: 'BAD_REQUEST', message: 'Unrecognized or unsigned webhook request.', status: 400 } },
    400,
  );
});

// ─── GET /api/payments/verify/:orderId ──────────────────────────────────────

payments.get('/verify/:orderId', authRequired, async (c) => {
  const orderId = c.req.param('orderId');
  const userId = c.get('userId');
  const env = c.env;

  const order = (await getOrderById(env.DB, orderId)) as DbOrder | null;
  if (!order || order.user_id !== userId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.payment_status === 'paid') {
    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: order.payment_status,
        status: order.status,
        totalPaise: order.total_paise,
        totalFormatted: formatPaiseToDisplay(order.total_paise),
      },
    });
  }

  // Poll Razorpay fallback for pending/authorized orders
  if (order.cf_order_id && order.cf_order_id.startsWith('order_') && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    try {
      const rzpOrder = await fetchRazorpayOrder(
        order.cf_order_id,
        env.RAZORPAY_KEY_ID,
        env.RAZORPAY_KEY_SECRET,
      );

      if (
        rzpOrder.status === 'paid' &&
        rzpOrder.amount === order.total_paise &&
        rzpOrder.currency === 'INR'
      ) {
        const orderPayments = await fetchRazorpayOrderPayments(
          order.cf_order_id,
          env.RAZORPAY_KEY_ID,
          env.RAZORPAY_KEY_SECRET,
        );
        const captured = orderPayments.find((p) => p.status === 'captured');

        const finalized = await finalizePaidOrder(
          env,
          order,
          captured?.id || order.cf_order_id,
          captured?.method || 'razorpay',
          order.cf_order_id,
          c.executionCtx,
          'poll_verify',
        );

        return c.json({
          success: true,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            paymentStatus: finalized.paymentStatus,
            status: finalized.status,
            totalPaise: order.total_paise,
            totalFormatted: formatPaiseToDisplay(order.total_paise),
          },
        });
      }
    } catch {
      // Gateway unavailable — return current DB state
    }
  }

  return c.json({
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
      status: order.status,
      totalPaise: order.total_paise,
      totalFormatted: formatPaiseToDisplay(order.total_paise),
    },
  });
});

export default payments;
