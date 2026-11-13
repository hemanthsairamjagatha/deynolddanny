/**
 * Inbound webhook handlers for third-party delivery services.
 *
 * Shiprocket sends POST requests here when shipment status changes.
 * We update our order status and notify the customer accordingly.
 *
 * Webhook URL to register in Shiprocket:
 *   https://api.deynolddanny.com/api/webhooks/shiprocket
 */

import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import { sendOrderDeliveredEmail } from '../services/resend.js';
import { nowIso } from '../db/client.js';

const webhooks = new Hono<{ Bindings: Env }>();

// ─── POST /api/webhooks/shiprocket ──────────────────────────────────────────

webhooks.post('/shiprocket', async (c) => {
  const env = c.env;

  let event: Record<string, unknown>;
  try {
    event = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON body.', status: 400 },
      },
      400,
    );
  }

  // Shiprocket payload shape varies by plan — handle multiple field names
  const awb = (
    (event.awb_code ?? event.awb ?? event.tracking_id) as string | undefined
  );
  const shiprocketOrderId = (
    (event.shipment_id ?? event.order_id ?? event.shiprocket_order_id) as string | number | undefined
  );
  const statusCode = (
    (event.current_status ?? event.status ?? event.shipment_status) as string | undefined
  );

  if (!awb && !shiprocketOrderId) {
    // Acknowledge without processing — unknown or test payload
    return c.json({ success: true, data: { received: true, ignored: true } });
  }

  // Look up our order by AWB first, then by shiprocket_order_id
  type OrderRow = {
    id: string;
    order_number: string;
    status: string;
    user_id: string;
    courier_partner: string | null;
    tracking_number: string | null;
  };

  let order: OrderRow | null = null;

  if (awb) {
    order = await env.DB
      .prepare(
        `SELECT id, order_number, status, user_id, courier_partner, tracking_number
         FROM orders WHERE shiprocket_awb = ?1 LIMIT 1`,
      )
      .bind(awb)
      .first<OrderRow>();
  }

  if (!order && shiprocketOrderId) {
    order = await env.DB
      .prepare(
        `SELECT id, order_number, status, user_id, courier_partner, tracking_number
         FROM orders WHERE shiprocket_order_id = ?1 LIMIT 1`,
      )
      .bind(String(shiprocketOrderId))
      .first<OrderRow>();
  }

  if (!order) {
    // Not our order — Shiprocket may send test events or events for old orders
    return c.json({ success: true, data: { received: true, not_found: true } });
  }

  const normalizedStatus = (statusCode ?? '').toUpperCase().trim();
  const now = nowIso();

  // ── DELIVERED ─────────────────────────────────────────────────────────────
  if (
    normalizedStatus.includes('DELIVERED') &&
    !normalizedStatus.includes('RTO DELIVERED')
  ) {
    if (order.status !== 'delivered') {
      await env.DB
        .prepare(
          `UPDATE orders
           SET status = 'delivered', delivered_at = ?1, updated_at = ?1
           WHERE id = ?2`,
        )
        .bind(now, order.id)
        .run();

      await _auditLog(env, order.id, 'status_change', 'Delivered — Shiprocket webhook', now);

      // Notify customer (non-blocking)
      const userRow = await env.DB
        .prepare(`SELECT email FROM users WHERE id = ?1`)
        .bind(order.user_id)
        .first<{ email: string }>();

      if (userRow && env.RESEND_API_KEY) {
        c.executionCtx.waitUntil(
          sendOrderDeliveredEmail(env.RESEND_API_KEY, userRow.email, order.order_number),
        );
      }
    }

    return c.json({ success: true, data: { received: true, action: 'delivered' } });
  }

  // ── RTO INITIATED (Return to Origin) ──────────────────────────────────────
  if (
    normalizedStatus === 'RTO INITIATED' ||
    normalizedStatus === 'RTO' ||
    normalizedStatus === 'RETURN INITIATED' ||
    normalizedStatus === 'RETURN_INITIATED' ||
    normalizedStatus.startsWith('RTO')
  ) {
    if (order.status !== 'returned' && order.status !== 'cancelled') {
      await env.DB
        .prepare(
          `UPDATE orders SET status = 'returned', updated_at = ?1 WHERE id = ?2`,
        )
        .bind(now, order.id)
        .run();

      await _auditLog(env, order.id, 'status_change', `RTO — ${statusCode} — Shiprocket webhook`, now);
    }

    return c.json({ success: true, data: { received: true, action: 'rto_initiated' } });
  }

  // ── NDR (Non-Delivery Report) ──────────────────────────────────────────────
  if (
    normalizedStatus.includes('NDR') ||
    normalizedStatus === 'UNDELIVERED' ||
    normalizedStatus === 'DELIVERY FAILED' ||
    normalizedStatus === 'DELIVERY_FAILED'
  ) {
    // Log NDR — do NOT cancel automatically; Shiprocket will re-attempt delivery
    await _auditLog(env, order.id, 'ndr', `NDR — ${statusCode ?? 'unknown'} — Shiprocket webhook`, now);

    // Transition to ndr_pending only if currently 'shipped'
    if (order.status === 'shipped') {
      await env.DB
        .prepare(
          `UPDATE orders SET status = 'ndr_pending', updated_at = ?1
           WHERE id = ?2 AND status = 'shipped'`,
        )
        .bind(now, order.id)
        .run();
    }

    return c.json({ success: true, data: { received: true, action: 'ndr_logged' } });
  }

  // ── PICKUP EVENTS ─────────────────────────────────────────────────────────
  if (
    normalizedStatus.includes('PICKUP SCHEDULED') ||
    normalizedStatus.includes('PICKUP GENERATED') ||
    normalizedStatus.includes('PICKED UP')
  ) {
    if (order.status === 'confirmed') {
      await env.DB
        .prepare(
          `UPDATE orders SET status = 'shipped', updated_at = ?1 WHERE id = ?2`,
        )
        .bind(now, order.id)
        .run();

      await _auditLog(env, order.id, 'status_change', `Pickup — ${statusCode} — Shiprocket webhook`, now);
    }

    return c.json({ success: true, data: { received: true, action: 'pickup_updated' } });
  }

  // ── Unknown event — ack without action ───────────────────────────────────
  return c.json({
    success: true,
    data: { received: true, status: normalizedStatus, ignored: true },
  });
});

// ─── Helper: write to order_audit_logs ───────────────────────────────────────

async function _auditLog(
  env: Env,
  orderId: string,
  action: string,
  detail: string,
  now: string,
): Promise<void> {
  try {
    await env.DB
      .prepare(
        `INSERT INTO order_audit_logs (id, order_id, action, detail, performed_by, created_at)
         VALUES (hex(randomblob(8)), ?1, ?2, ?3, 'shiprocket_webhook', ?4)`,
      )
      .bind(orderId, action, detail, now)
      .run();
  } catch {
    // Audit log failure must never crash the webhook response
  }
}

export default webhooks;

