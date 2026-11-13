import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { authRequired } from '../middleware/auth.js';
import {
  getOrderById,
  getOrderByCfOrderId,
  updateOrderStatus,
  updateOrderPayment,
} from '../db/queries/orders.js';
import { commitStock, rollbackStock } from '../services/stockEngine.js';
import {
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
} from '../services/razorpay.js';
import { verifyCashfreeSignature, fetchCashfreeOrder } from '../services/cashfree.js';
import { sendOrderConfirmedEmail, type OrderEmailItem } from '../services/resend.js';
import { formatPaiseToDisplay } from '../services/money.js';
import { nowIso } from '../db/client.js';

const payments = new Hono<{ Bindings: Env }>();

/**
 * Helper to process successful order confirmation, commit stock, and dispatch email
 */
async function finalizePaidOrder(
  db: D1Database,
  resendApiKey: string,
  order: { id: string; user_id: string; order_number: string; total_paise: number },
  paymentId: string,
  paymentMethod: string | null,
  executionCtx: { waitUntil(promise: Promise<unknown>): void },
) {
  // Commit reserved stock permanently
  const orderItems = await db
    .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
    .bind(order.id)
    .all<{ variant_id: string; quantity: number }>();

  await Promise.all(
    (orderItems.results ?? []).map((item) =>
      commitStock(db, item.variant_id, item.quantity),
    ),
  );

  // Update order status to confirmed
  await Promise.all([
    updateOrderStatus(db, order.id, 'confirmed'),
    updateOrderPayment(db, order.id, {
      paymentStatus: 'paid',
      cfPaymentId: paymentId,
      paymentMethod: paymentMethod ?? undefined,
      paidAt: nowIso(),
    }),
  ]);

  // Dispatch confirmation email in background
  const orderItemsForEmail = await db
    .prepare(`SELECT * FROM order_items WHERE order_id = ?1`)
    .bind(order.id)
    .all<{
      title_snapshot: string;
      size_snapshot: string;
      color_snapshot: string;
      unit_price_paise: number;
      quantity: number;
    }>();

  const userRow = await db
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();

  if (userRow && resendApiKey) {
    const emailItems: OrderEmailItem[] = (orderItemsForEmail.results ?? []).map((r) => ({
      title: r.title_snapshot,
      size: r.size_snapshot,
      color: r.color_snapshot,
      quantity: r.quantity,
      unitPrice: formatPaiseToDisplay(r.unit_price_paise),
    }));

    executionCtx.waitUntil(
      sendOrderConfirmedEmail(
        resendApiKey,
        userRow.email,
        order.order_number,
        formatPaiseToDisplay(order.total_paise),
        emailItems,
      ),
    );
  }
}

// ─── POST /api/payments/verify ──────────────────────────────────────────────
// Instant Client Verification from Razorpay or Cashfree Checkout Modal
const verifyClientPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  cfOrderId: z.string().optional(),
});

payments.post('/verify', authRequired, zValidator('json', verifyClientPaymentSchema), async (c) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, cfOrderId } = c.req.valid('json');
  const userId = c.get('userId');
  const env = c.env;

  const order = await getOrderById(env.DB, orderId);
  if (!order || order.user_id !== userId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  // If already marked as paid (e.g. by fast webhook), return immediate success
  if (order.payment_status === 'paid') {
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

  // 1. Razorpay verification flow
  if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
    const isValid = await verifyRazorpayPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      env.RAZORPAY_KEY_SECRET,
    );

    if (!isValid) {
      return c.json(
        { success: false, error: { code: 'INVALID_SIGNATURE', message: 'Payment signature verification failed.', status: 400 } },
        400,
      );
    }

    // Atomic idempotency lock
    const lock = await env.DB
      .prepare(`UPDATE orders SET payment_status = 'paid', updated_at = ?1 WHERE id = ?2 AND payment_status != 'paid'`)
      .bind(nowIso(), order.id)
      .run();

    if ((lock.meta.changes ?? 0) > 0) {
      // Determine payment method if possible
      let paymentMethod: string | null = 'razorpay';
      try {
        const details = await fetchRazorpayPayment(razorpayPaymentId, env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
        paymentMethod = details.method || 'razorpay';
      } catch {
        // Non-critical: continue with default method
      }

      await finalizePaidOrder(
        env.DB,
        env.RESEND_API_KEY,
        order,
        razorpayPaymentId,
        paymentMethod,
        c.executionCtx,
      );
    }

    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: 'paid',
        status: 'confirmed',
      },
    });
  }

  // 2. Cashfree verification flow
  const targetCfOrderId = cfOrderId || order.cf_order_id;
  if (targetCfOrderId && env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY) {
    try {
      const cfStatus = await fetchCashfreeOrder(
        targetCfOrderId,
        env.CASHFREE_APP_ID,
        env.CASHFREE_SECRET_KEY,
        env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg',
        env.CASHFREE_API_VERSION || '2023-08-01',
      );

      if (cfStatus.status === 'PAID') {
        const lock = await env.DB
          .prepare(`UPDATE orders SET payment_status = 'paid', updated_at = ?1 WHERE id = ?2 AND payment_status != 'paid'`)
          .bind(nowIso(), order.id)
          .run();

        if ((lock.meta.changes ?? 0) > 0) {
          await finalizePaidOrder(
            env.DB,
            env.RESEND_API_KEY,
            order,
            cfStatus.paymentId || targetCfOrderId,
            cfStatus.paymentMethod || 'cashfree',
            c.executionCtx,
          );
        }

        return c.json({
          success: true,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            paymentStatus: 'paid',
            status: 'confirmed',
          },
        });
      } else {
        return c.json(
          {
            success: false,
            error: {
              code: 'PAYMENT_PENDING',
              message: `Payment status is ${cfStatus.status}. Please complete payment.`,
              status: 400,
            },
          },
          400,
        );
      }
    } catch (cfErr: any) {
      console.warn('Cashfree fetch status error:', cfErr.message);
    }
  }

  // Fallback for concierge / test orders
  return c.json({
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
      status: order.status,
    },
  });
});

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
// Supports both Razorpay (primary) and Cashfree (fallback) webhooks
payments.post('/webhook', async (c) => {
  const env = c.env;
  const rawBody = await c.req.text();

  // 1. Detect Razorpay Webhook
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

    const eventName = rzpEvent.event as string;
    const paymentEntity = rzpEvent.payload?.payment?.entity;
    const rzpOrderId = paymentEntity?.order_id || rzpEvent.payload?.order?.entity?.id;
    const paymentId = paymentEntity?.id;
    const paymentMethod = paymentEntity?.method ?? 'razorpay';

    if (!rzpOrderId) {
      return c.json({ success: true, data: { received: true, ignored: true } });
    }

    // Lookup order by stored Razorpay order ID (cf_order_id column)
    const order = await getOrderByCfOrderId(env.DB, rzpOrderId);
    if (!order) {
      return c.json({ success: true, data: { received: true, not_found: true } });
    }

    // ── PAYMENT SUCCESS ────────────────────────────────────────────────────────
    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      // Atomic idempotency lock: guarantees stock is deducted exactly once
      const lock = await env.DB
        .prepare(`UPDATE orders SET payment_status = 'paid', updated_at = ?1 WHERE id = ?2 AND payment_status != 'paid'`)
        .bind(nowIso(), order.id)
        .run();

      if ((lock.meta.changes ?? 0) > 0) {
        await finalizePaidOrder(
          env.DB,
          env.RESEND_API_KEY,
          order,
          paymentId ?? rzpOrderId,
          paymentMethod,
          c.executionCtx,
        );
      }
      return c.json({ success: true, data: { received: true, processed: true } });
    }

    // ── PAYMENT FAILED ────────────────────────────────────────────────────────
    if (eventName === 'payment.failed') {
      if (order.payment_status !== 'paid') {
        const orderItems = await env.DB
          .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
          .bind(order.id)
          .all<{ variant_id: string; quantity: number }>();

        await Promise.all(
          (orderItems.results ?? []).map((item) =>
            rollbackStock(env.DB, item.variant_id, item.quantity),
          ),
        );

        await Promise.all([
          updateOrderStatus(env.DB, order.id, 'cancelled'),
          updateOrderPayment(env.DB, order.id, {
            paymentStatus: 'failed',
            cfPaymentId: paymentId ?? undefined,
          }),
        ]);
      }
      return c.json({ success: true, data: { received: true, failed: true } });
    }

    return c.json({ success: true, data: { received: true, event: eventName } });
  }

  // 2. Fallback: Cashfree Webhook Check
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid webhook signature.', status: 403 } },
        403,
      );
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON.', status: 400 } }, 400);
    }

    const eventType = event.type as string;
    const cfOrderId = event.data?.order?.cf_order_id ?? event.data?.order?.order_id;
    const cfPaymentId = event.data?.payment?.cf_payment_id;

    if (!cfOrderId) return c.json({ success: true, data: { received: true } });

    const order = await getOrderByCfOrderId(env.DB, cfOrderId);
    if (!order) return c.json({ success: true, data: { received: true } });

    if (eventType === 'PAYMENT_SUCCESS') {
      const lock = await env.DB
        .prepare(`UPDATE orders SET payment_status = 'paid', updated_at = ?1 WHERE id = ?2 AND payment_status != 'paid'`)
        .bind(nowIso(), order.id)
        .run();

      if ((lock.meta.changes ?? 0) > 0) {
        await finalizePaidOrder(
          env.DB,
          env.RESEND_API_KEY,
          order,
          cfPaymentId ?? cfOrderId,
          'cashfree',
          c.executionCtx,
        );
      }
    } else if (eventType === 'PAYMENT_FAILED' || eventType === 'USER_DROPPED') {
      if (order.payment_status !== 'paid') {
        const orderItems = await env.DB
          .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
          .bind(order.id)
          .all<{ variant_id: string; quantity: number }>();

        await Promise.all(
          (orderItems.results ?? []).map((item) =>
            rollbackStock(env.DB, item.variant_id, item.quantity),
          ),
        );

        await Promise.all([
          updateOrderStatus(env.DB, order.id, 'cancelled'),
          updateOrderPayment(env.DB, order.id, {
            paymentStatus: eventType === 'USER_DROPPED' ? 'user_dropped' : 'failed',
            cfPaymentId: cfPaymentId ?? undefined,
          }),
        ]);
      }
    }

    return c.json({ success: true, data: { received: true } });
  }

  // Neither signature header present
  return c.json(
    { success: false, error: { code: 'BAD_REQUEST', message: 'Unrecognized webhook request.', status: 400 } },
    400,
  );
});

// ─── GET /api/payments/verify/:orderId ──────────────────────────────────────
// Query order verification status
payments.get('/verify/:orderId', authRequired, async (c) => {
  const orderId = c.req.param('orderId');
  const userId = c.get('userId');
  const env = c.env;

  const order = await getOrderById(env.DB, orderId);

  if (!order || order.user_id !== userId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  // If already paid, return immediately
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

  // Fallback check against Razorpay API directly
  if (order.cf_order_id && order.cf_order_id.startsWith('order_')) {
    try {
      const rzpStatus = await fetchRazorpayOrder(
        order.cf_order_id,
        env.RAZORPAY_KEY_ID,
        env.RAZORPAY_KEY_SECRET,
      );

      if (rzpStatus.status === 'paid') {
        const lock = await env.DB
          .prepare(`UPDATE orders SET payment_status = 'paid', updated_at = ?1 WHERE id = ?2 AND payment_status != 'paid'`)
          .bind(nowIso(), order.id)
          .run();

        if ((lock.meta.changes ?? 0) > 0) {
          await finalizePaidOrder(
            env.DB,
            env.RESEND_API_KEY,
            order,
            order.cf_order_id,
            'razorpay',
            c.executionCtx,
          );
        }

        return c.json({
          success: true,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            paymentStatus: 'paid',
            status: 'confirmed',
            totalPaise: order.total_paise,
            totalFormatted: formatPaiseToDisplay(order.total_paise),
          },
        });
      }
    } catch {
      // Continue to default DB response
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
