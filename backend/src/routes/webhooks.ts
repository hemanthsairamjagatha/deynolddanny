/**
 * Inbound webhook handlers for Shiprocket courier lifecycle updates.
 * Authenticated via constant-time shared token (`x-api-key` matching `SHIPROCKET_WEBHOOK_TOKEN`)
 * and deduplicated via `webhook_events`.
 */

import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import { sendOrderDeliveredEmail } from '../services/resend.js';
import { nowIso, runBatch } from '../db/client.js';
import { generateId, sha256Hex, timingSafeEqualStrings } from '../services/crypto.js';
import { appendOrderAuditLog } from '../services/orderLifecycle.js';

const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post('/shiprocket', async (c) => {
  const env = c.env;
  const receivedToken = c.req.header('x-api-key') || c.req.header('x-shiprocket-signature') || '';
  const configuredToken = env.SHIPROCKET_WEBHOOK_TOKEN || '';

  // Fail closed when token is unset in non-development OR mismatched in any env
  if (!configuredToken) {
    if (env.ENVIRONMENT !== 'development') {
      return c.json(
        { success: false, error: { code: 'WEBHOOK_UNCONFIGURED', message: 'Shiprocket webhook secret not configured.', status: 503 } },
        503,
      );
    }
  } else if (!receivedToken || !timingSafeEqualStrings(receivedToken, configuredToken)) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Invalid Shiprocket webhook authentication token.', status: 403 } },
      403,
    );
  }

  const rawBody = await c.req.text();
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body.', status: 400 } },
      400,
    );
  }

  const awb = (event.awb_code ?? event.awb ?? event.tracking_id) as string | undefined;
  const shiprocketOrderId = (
    event.shipment_id ?? event.order_id ?? event.shiprocket_order_id
  ) as string | number | undefined;
  const statusCode = (
    event.current_status ?? event.status ?? event.shipment_status
  ) as string | undefined;

  if (!awb && !shiprocketOrderId) {
    return c.json({ success: true, data: { received: true, ignored: true } });
  }

  const eventId = `sr:${awb || shiprocketOrderId}:${statusCode || ''}:${await sha256Hex(rawBody)}`;
  const dedupeRes = await env.DB
    .prepare(
      `INSERT OR IGNORE INTO webhook_events (id, gateway, event_id, event_type, payload_hash, status, received_at)
       VALUES (?1, 'shiprocket', ?2, ?3, ?4, 'processing', ?5)`,
    )
    .bind(
      generateId('whk_'),
      eventId,
      String(statusCode || 'UNKNOWN'),
      await sha256Hex(rawBody),
      nowIso(),
    )
    .run();

  if ((dedupeRes.meta.changes ?? 0) === 0) {
    return c.json({ success: true, data: { received: true, deduplicated: true } });
  }

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
         FROM orders WHERE shiprocket_awb = ?1 OR tracking_number = ?1 LIMIT 1`,
      )
      .bind(awb)
      .first<OrderRow>();
  }
  if (!order && shiprocketOrderId) {
    order = await env.DB
      .prepare(
        `SELECT id, order_number, status, user_id, courier_partner, tracking_number
         FROM orders WHERE shiprocket_order_id = ?1 OR shiprocket_shipment_id = ?1 LIMIT 1`,
      )
      .bind(String(shiprocketOrderId))
      .first<OrderRow>();
  }

  const now = nowIso();
  if (!order) {
    await env.DB
      .prepare(`UPDATE webhook_events SET status = 'ignored', processed_at = ?1 WHERE gateway = 'shiprocket' AND event_id = ?2`)
      .bind(now, eventId)
      .run();
    return c.json({ success: true, data: { received: true, not_found: true } });
  }

  const normalizedStatus = (statusCode ?? '').toUpperCase().trim();
  let actionTaken = 'ignored';

  if (normalizedStatus.includes('DELIVERED') && !normalizedStatus.includes('RTO')) {
    if (order.status !== 'delivered') {
      await runBatch(env.DB, [
        env.DB
          .prepare(
            `UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, ?1), updated_at = ?1 WHERE id = ?2`,
          )
          .bind(now, order.id),
      ]);
      await appendOrderAuditLog(env.DB, order.id, 'delivered', `Shiprocket AWB ${awb ?? ''}`, 'shiprocket_webhook');
      actionTaken = 'delivered';

      const userRow = await env.DB
        .prepare(`SELECT email FROM users WHERE id = ?1`)
        .bind(order.user_id)
        .first<{ email: string }>();

      if (userRow?.email) {
        c.executionCtx.waitUntil(
          sendOrderDeliveredEmail(
            env.RESEND_API_KEY,
            userRow.email,
            order.order_number,
            env.RESEND_FROM_EMAIL,
          ).catch((e) => console.error('[Shiprocket Webhook] delivery email fail:', e)),
        );
      }
    }
  } else if (
    normalizedStatus.includes('RTO') ||
    normalizedStatus === 'RETURN INITIATED' ||
    normalizedStatus === 'RETURN_INITIATED'
  ) {
    if (!['returned', 'cancelled', 'refunded'].includes(order.status)) {
      await env.DB
        .prepare(`UPDATE orders SET status = 'returned', updated_at = ?1 WHERE id = ?2`)
        .bind(now, order.id)
        .run();
      await appendOrderAuditLog(env.DB, order.id, 'status_change', `RTO — ${statusCode}`, 'shiprocket_webhook');
      actionTaken = 'rto_initiated';
    }
  } else if (
    normalizedStatus.includes('NDR') ||
    normalizedStatus === 'UNDELIVERED' ||
    normalizedStatus.includes('DELIVERY FAILED')
  ) {
    await appendOrderAuditLog(env.DB, order.id, 'ndr', `NDR — ${statusCode ?? 'unknown'}`, 'shiprocket_webhook');
    if (order.status === 'shipped') {
      await env.DB
        .prepare(`UPDATE orders SET status = 'ndr_pending', updated_at = ?1 WHERE id = ?2 AND status = 'shipped'`)
        .bind(now, order.id)
        .run();
    }
    actionTaken = 'ndr_logged';
  } else if (
    normalizedStatus.includes('PICKUP') ||
    normalizedStatus.includes('IN TRANSIT') ||
    normalizedStatus.includes('IN_TRANSIT') ||
    normalizedStatus.includes('OUT FOR DELIVERY') ||
    normalizedStatus.includes('SHIPPED')
  ) {
    if (['confirmed', 'processing', 'ndr_pending'].includes(order.status)) {
      await env.DB
        .prepare(`UPDATE orders SET status = 'shipped', shipped_at = COALESCE(shipped_at, ?1), updated_at = ?1 WHERE id = ?2`)
        .bind(now, order.id)
        .run();
      await appendOrderAuditLog(env.DB, order.id, 'status_change', `Courier update — ${statusCode}`, 'shiprocket_webhook');
      actionTaken = 'in_transit';
    }
  }

  await env.DB
    .prepare(`UPDATE webhook_events SET status = 'processed', order_id = ?1, processed_at = ?2 WHERE gateway = 'shiprocket' AND event_id = ?3`)
    .bind(order.id, nowIso(), eventId)
    .run();

  return c.json({ success: true, data: { received: true, action: actionTaken } });
});

export default webhooks;
