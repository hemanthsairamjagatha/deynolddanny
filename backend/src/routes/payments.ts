import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import { authRequired } from '../middleware/auth.js';
import {
  getOrderById,
  getOrderByCfOrderId,
  updateOrderStatus,
  updateOrderPayment,
} from '../db/queries/orders.js';
import { commitStock, rollbackStock } from '../services/stockEngine.js';
import { verifyCashfreeSignature, fetchCashfreeOrder } from '../services/cashfree.js';
import { sendOrderConfirmedEmail, type OrderEmailItem } from '../services/resend.js';
import { formatPaiseToDisplay } from '../services/money.js';
import { nowIso } from '../db/client.js';
import type { ApiOrderItem, EmailJob } from '../types/api.js';

const payments = new Hono<{ Bindings: Env }>();

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
// Cashfree sends PAYMENT_SUCCESS, PAYMENT_FAILED, USER_DROPPED

payments.post('/webhook', async (c) => {
  const env = c.env;

  // Read raw body for HMAC verification
  const rawBody = await c.req.text();

  const timestamp = c.req.header('x-webhook-timestamp') ?? '';
  const signature = c.req.header('x-webhook-signature') ?? '';

  // Always verify the signature — reject unsigned requests
  const signatureValid = await verifyCashfreeSignature(
    rawBody,
    timestamp,
    signature,
    env.CASHFREE_SECRET_KEY,
  );

  if (!signatureValid) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Invalid webhook signature.', status: 403 } },
      403,
    );
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload.', status: 400 } },
      400,
    );
  }

  const eventType = event.type as string;
  const data = event.data as Record<string, unknown> | undefined;
  const orderData = data?.order as Record<string, unknown> | undefined;
  const paymentData = data?.payment as Record<string, unknown> | undefined;

  const cfOrderId = (orderData?.cf_order_id ?? orderData?.order_id) as string | undefined;
  const cfPaymentId = paymentData?.cf_payment_id as string | undefined;
  const paymentMethod = (() => {
    const method = paymentData?.payment_method as Record<string, unknown> | undefined;
    if (!method) return null;
    return Object.keys(method)[0] ?? null;
  })();

  if (!cfOrderId) {
    // Not a known event we can process
    return c.json({ success: true, data: { received: true } });
  }

  // Look up our order by CF order ID
  const order = await getOrderByCfOrderId(env.DB, cfOrderId);
  if (!order) {
    // Unknown order — acknowledge so CF doesn't retry
    return c.json({ success: true, data: { received: true } });
  }

  // ── Idempotency guard: if order already has final status, do nothing ──
  if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
    return c.json({ success: true, data: { received: true, skipped: true } });
  }

  // ── Handle PAYMENT_SUCCESS ───────────────────────────────────────────────
  if (eventType === 'PAYMENT_SUCCESS') {
    // Commit stock for all order items (reduce actual stock)
    const orderItems = await env.DB
      .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
      .bind(order.id)
      .all<{ variant_id: string; quantity: number }>();

    await Promise.all(
      (orderItems.results ?? []).map((item) =>
        commitStock(env.DB, item.variant_id, item.quantity),
      ),
    );

    // Update order: confirmed + paid
    await Promise.all([
      updateOrderStatus(env.DB, order.id, 'confirmed'),
      updateOrderPayment(env.DB, order.id, {
        paymentStatus: 'paid',
        cfPaymentId: cfPaymentId ?? undefined,
        paymentMethod: paymentMethod ?? undefined,
        paidAt: nowIso(),
      }),
    ]);

    // Send order confirmation email (via waitUntil — non-blocking)
    const orderItemsForEmail = await env.DB
      .prepare(`SELECT * FROM order_items WHERE order_id = ?1`)
      .bind(order.id)
      .all<{
        id: string;
        title_snapshot: string;
        sku_snapshot: string;
        size_snapshot: string;
        color_snapshot: string;
        image_snapshot: string;
        unit_price_paise: number;
        quantity: number;
        total_paise: number;
      }>();

    const userRow = await env.DB
      .prepare(`SELECT email FROM users WHERE id = ?1`)
      .bind(order.user_id)
      .first<{ email: string }>();

    if (userRow) {
      const emailItems: OrderEmailItem[] = (orderItemsForEmail.results ?? []).map((r) => ({
        title: r.title_snapshot,
        size: r.size_snapshot,
        color: r.color_snapshot,
        quantity: r.quantity,
        unitPrice: formatPaiseToDisplay(r.unit_price_paise),
      }));

      c.executionCtx.waitUntil(
        sendOrderConfirmedEmail(
          env.RESEND_API_KEY,
          userRow.email,
          order.order_number,
          formatPaiseToDisplay(order.total_paise),
          emailItems,
        ),
      );
    }
  }

  // ── Handle PAYMENT_FAILED / USER_DROPPED ────────────────────────────────
  else if (eventType === 'PAYMENT_FAILED' || eventType === 'USER_DROPPED') {
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

  return c.json({ success: true, data: { received: true } });
});

// ─── GET /api/payments/verify/:orderId ──────────────────────────────────────
// Called by frontend after payment redirect to get final status

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

  // If the webhook already processed this, return current state immediately
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

  // Fallback: query Cashfree directly for real-time status
  if (order.cf_order_id && !order.cf_order_id.startsWith('cf_pending_')) {
    try {
      const cfStatus = await fetchCashfreeOrder(
        order.cf_order_id,
        env.CASHFREE_APP_ID,
        env.CASHFREE_SECRET_KEY,
        env.CASHFREE_API_URL,
        env.CASHFREE_API_VERSION,
      );

      return c.json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          paymentStatus: order.payment_status,
          cfStatus: cfStatus.status,
          status: order.status,
          totalPaise: order.total_paise,
          totalFormatted: formatPaiseToDisplay(order.total_paise),
        },
      });
    } catch {
      // Fall through to return DB state
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

