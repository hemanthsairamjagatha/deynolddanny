import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import type { DbOrder } from '../../types/models.js';
import { requirePermission, auditAdminAction } from '../../middleware/adminAuth.js';
import { resolveStorePolicy } from '../../config/policy.js';
import { getOrderById } from '../../db/queries/orders.js';
import { finalizePaidOrder, appendOrderAuditLog } from '../../services/orderLifecycle.js';
import { formatPaiseToDisplay } from '../../services/money.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminPayments = new Hono<{ Bindings: Env }>();

async function readStoreSettings(db: D1Database): Promise<Record<string, unknown>> {
  try {
    const row = await db
      .prepare(`SELECT settings_json FROM store_settings WHERE id = 'default' LIMIT 1`)
      .first<{ settings_json: string }>();
    return row?.settings_json ? JSON.parse(row.settings_json) : {};
  } catch {
    return {};
  }
}

async function listAttemptsHandler(c: Context<{ Bindings: Env }>) {
  const gateway = c.req.query('gateway')?.trim();
  const status = c.req.query('status')?.trim();
  const orderId = c.req.query('order_id')?.trim();
  const q = c.req.query('q')?.trim().toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50)));

  let sql = `
    SELECT pa.*, o.order_number, o.shipping_name, o.status AS order_status, o.payment_status AS order_payment_status, u.email AS customer_email
    FROM payment_attempts pa
    LEFT JOIN orders o ON o.id = pa.order_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE 1=1
  `;
  const bindings: unknown[] = [];

  if (gateway) {
    bindings.push(gateway);
    sql += ` AND pa.gateway = ?${bindings.length}`;
  }
  if (status) {
    bindings.push(status);
    sql += ` AND pa.status = ?${bindings.length}`;
  }
  if (orderId) {
    bindings.push(orderId);
    sql += ` AND pa.order_id = ?${bindings.length}`;
  }
  if (q) {
    bindings.push(`%${q}%`);
    sql += ` AND (LOWER(COALESCE(o.order_number, '')) LIKE ?${bindings.length} OR LOWER(COALESCE(pa.gateway_order_id, '')) LIKE ?${bindings.length} OR LOWER(COALESCE(pa.gateway_payment_id, '')) LIKE ?${bindings.length} OR LOWER(COALESCE(u.email, '')) LIKE ?${bindings.length})`;
  }

  sql += ` ORDER BY pa.created_at DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      total: rows.results?.length ?? 0,
    },
  });
}

// ─── GET /api/admin/payments & /api/admin/payments/attempts ──────────────────
adminPayments.get('/', requirePermission('orders.read', 'logs.read'), listAttemptsHandler);
adminPayments.get('/attempts', requirePermission('orders.read', 'logs.read'), listAttemptsHandler);

// ─── GET /api/admin/payments/refunds ─────────────────────────────────────────
adminPayments.get('/refunds', requirePermission('orders.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT r.*, o.order_number, o.shipping_name, o.total_paise AS order_total_paise, u.email AS customer_email
       FROM refunds r
       LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY r.created_at DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();

  return c.json({ success: true, data: { items: rows.results ?? [] } });
});

// ─── GET /api/admin/payments/stats ───────────────────────────────────────────
adminPayments.get('/stats', requirePermission('orders.read', 'analytics.read'), async (c) => {
  const [attemptsRes, refundsRes, ordersRes, gatewayBreakdownRes, disputesRes, adjustmentsRes] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT
           COUNT(*) AS total_attempts,
           SUM(CASE WHEN status IN ('captured', 'successful') THEN 1 ELSE 0 END) AS successful_count,
           SUM(CASE WHEN status IN ('failed', 'expired') THEN 1 ELSE 0 END) AS failed_count,
           SUM(CASE WHEN status IN ('created', 'authorized') THEN 1 ELSE 0 END) AS pending_count,
           COALESCE(SUM(CASE WHEN status IN ('captured', 'successful') THEN amount_paise ELSE 0 END), 0) AS successful_volume_paise
         FROM payment_attempts`,
      )
      .first<Record<string, number>>(),
    c.env.DB
      .prepare(`SELECT COUNT(*) AS total_refunds, COALESCE(SUM(amount_paise), 0) AS refund_volume_paise FROM refunds`)
      .first<Record<string, number>>(),
    c.env.DB
      .prepare(
        `SELECT
           SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_orders_count,
           COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_paise ELSE 0 END), 0) AS paid_orders_volume_paise,
           SUM(CASE WHEN payment_status IN ('pending', 'authorized') AND status NOT IN ('cancelled', 'refunded') THEN 1 ELSE 0 END) AS unpaid_pending_count,
           COALESCE(SUM(CASE WHEN payment_status IN ('pending', 'authorized') AND status NOT IN ('cancelled', 'refunded') THEN total_paise ELSE 0 END), 0) AS unpaid_pending_volume_paise
         FROM orders`,
      )
      .first<Record<string, number>>(),
    c.env.DB
      .prepare(
        `SELECT gateway,
                COUNT(*) AS attempts,
                SUM(CASE WHEN status IN ('captured', 'successful') THEN 1 ELSE 0 END) AS captured,
                COALESCE(SUM(CASE WHEN status IN ('captured', 'successful') THEN amount_paise ELSE 0 END), 0) AS volume_paise
         FROM payment_attempts
         GROUP BY gateway`,
      )
      .all<Record<string, unknown>>(),
    c.env.DB
      .prepare(`SELECT COUNT(*) AS open_disputes FROM payment_disputes WHERE status NOT IN ('won', 'lost', 'closed', 'resolved')`)
      .first<{ open_disputes: number }>(),
    c.env.DB
      .prepare(`SELECT COUNT(*) AS total_adjustments FROM payment_adjustments`)
      .first<{ total_adjustments: number }>()
      .catch(() => ({ total_adjustments: 0 })),
  ]);

  return c.json({
    success: true,
    data: {
      totalAttempts: Number(attemptsRes?.total_attempts ?? 0),
      successfulCount: Number(attemptsRes?.successful_count ?? 0),
      failedCount: Number(attemptsRes?.failed_count ?? 0),
      pendingCount: Number(attemptsRes?.pending_count ?? 0),
      successfulVolumePaise: Number(attemptsRes?.successful_volume_paise ?? 0),
      paidOrdersCount: Number(ordersRes?.paid_orders_count ?? 0),
      paidOrdersVolumePaise: Number(ordersRes?.paid_orders_volume_paise ?? 0),
      unpaidPendingCount: Number(ordersRes?.unpaid_pending_count ?? 0),
      unpaidPendingVolumePaise: Number(ordersRes?.unpaid_pending_volume_paise ?? 0),
      totalRefunds: Number(refundsRes?.total_refunds ?? 0),
      refundVolumePaise: Number(refundsRes?.refund_volume_paise ?? 0),
      openDisputesCount: Number(disputesRes?.open_disputes ?? 0),
      totalAdjustments: Number(adjustmentsRes?.total_adjustments ?? 0),
      gatewayBreakdown: gatewayBreakdownRes.results ?? [],
    },
  });
});

// ─── GET /api/admin/payments/health — Payment Check-Up Diagnostics ───────────
adminPayments.get('/health', requirePermission('orders.read', 'settings.read'), async (c) => {
  const env = c.env;
  const policy = resolveStorePolicy(env);
  const storeSettings = await readStoreSettings(env.DB);

  const rzpConfigured = Boolean(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    !env.RAZORPAY_KEY_ID.includes('placeholder') &&
    env.RAZORPAY_KEY_SECRET.length > 5,
  );
  const rzpMode = !rzpConfigured
    ? 'unconfigured'
    : env.RAZORPAY_KEY_ID.startsWith('rzp_live_')
      ? 'live'
      : 'test';

  const cfConfigured = Boolean(
    env.CASHFREE_APP_ID &&
    env.CASHFREE_SECRET_KEY &&
    !env.CASHFREE_APP_ID.includes('placeholder') &&
    env.CASHFREE_SECRET_KEY.length > 5,
  );
  const cfEnv = env.CASHFREE_API_URL?.includes('sandbox') ? 'sandbox' : 'production';

  const enableRazorpay = storeSettings.enableRazorpay !== false;
  const enableCashfree = storeSettings.enableCashfree !== false;
  const primaryGateway = storeSettings.primaryGateway === 'cashfree' ? 'cashfree' : 'razorpay';
  const enableCod = Boolean(storeSettings.enableCod ?? false);
  const codMaxOrderPaise = Number(storeSettings.codMaxOrderPaise ?? 2500000);
  const codFeePaise = Number(storeSettings.codFeePaise ?? 0);

  const [stuckOrdersRes, failedWebhooksRes, openDisputesRes, recentFailuresRes] = await Promise.all([
    env.DB
      .prepare(
        `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_paise, o.cf_order_id, o.payment_method, o.shipping_name, o.created_at, u.email AS customer_email
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.status IN ('pending', 'awaiting_capture', 'confirmed_needs_allocation')
            OR (o.payment_status IN ('authorized', 'disputed', 'failed') AND o.status NOT IN ('cancelled', 'refunded'))
         ORDER BY o.created_at DESC
         LIMIT 25`,
      )
      .all<Record<string, unknown>>(),
    env.DB
      .prepare(`SELECT COUNT(*) AS cnt FROM webhook_events WHERE status = 'failed' AND received_at >= datetime('now', '-24 hours')`)
      .first<{ cnt: number }>(),
    env.DB
      .prepare(`SELECT COUNT(*) AS cnt FROM payment_disputes WHERE status NOT IN ('won', 'lost', 'closed', 'resolved')`)
      .first<{ cnt: number }>(),
    env.DB
      .prepare(
        `SELECT
           COUNT(*) AS total_24h,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_24h
         FROM payment_attempts
         WHERE created_at >= datetime('now', '-24 hours')`,
      )
      .first<{ total_24h: number; failed_24h: number }>(),
  ]);

  const stuckOrders = stuckOrdersRes.results ?? [];
  const failedWebhooks24h = Number(failedWebhooksRes?.cnt ?? 0);
  const openDisputes = Number(openDisputesRes?.cnt ?? 0);
  const total24h = Number(recentFailuresRes?.total_24h ?? 0);
  const failed24h = Number(recentFailuresRes?.failed_24h ?? 0);
  const failureRatePct = total24h > 0 ? Math.round((failed24h / total24h) * 100) : 0;

  const activeReadyCount = (rzpConfigured && enableRazorpay ? 1 : 0) + (cfConfigured && enableCashfree ? 1 : 0);

  const checks: Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }> = [
    {
      id: 'active_gateway',
      label: 'Active Checkout Payment Gateway',
      status: activeReadyCount > 0 ? 'pass' : 'fail',
      detail:
        activeReadyCount > 0
          ? `Primary: ${primaryGateway.toUpperCase()} (${activeReadyCount} configured & enabled gateway${activeReadyCount > 1 ? 's' : ''}).`
          : 'No online payment gateway is both configured in Worker secrets and enabled in settings!',
    },
    {
      id: 'razorpay_status',
      label: 'Razorpay Gateway & Webhook Secret',
      status: rzpConfigured ? (env.RAZORPAY_WEBHOOK_SECRET ? 'pass' : 'warn') : 'warn',
      detail: rzpConfigured
        ? `Configured (${rzpMode.toUpperCase()} mode, key ${env.RAZORPAY_KEY_ID.slice(0, 12)}…). Webhook secret ${env.RAZORPAY_WEBHOOK_SECRET ? 'set' : 'NOT set'}.`
        : 'Not configured (set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in Cloudflare secrets to enable).',
    },
    {
      id: 'cashfree_status',
      label: 'Cashfree Gateway & Environment',
      status: cfConfigured ? (cfEnv === 'production' ? 'pass' : 'warn') : 'warn',
      detail: cfConfigured
        ? `Configured (${cfEnv.toUpperCase()} mode, App ID ${env.CASHFREE_APP_ID?.slice(0, 8)}…). Webhook signature uses Secret Key.`
        : 'Not configured (set CASHFREE_APP_ID & CASHFREE_SECRET_KEY in Cloudflare secrets).',
    },
    {
      id: 'stuck_orders',
      label: 'Pending / Needs-Attention Orders',
      status: stuckOrders.length === 0 ? 'pass' : 'warn',
      detail:
        stuckOrders.length === 0
          ? 'No stuck, awaiting-capture, or allocation-drift orders.'
          : `${stuckOrders.length} order(s) require reconciliation, manual capture, or cancellation review.`,
    },
    {
      id: 'webhooks_24h',
      label: 'Webhook Deliveries (24h)',
      status: failedWebhooks24h === 0 ? 'pass' : 'fail',
      detail:
        failedWebhooks24h === 0
          ? 'Zero failed payment/shipping webhooks in the last 24 hours.'
          : `${failedWebhooks24h} webhook event(s) failed processing in the last 24 hours. Inspect the Webhooks tab.`,
    },
    {
      id: 'disputes',
      label: 'Open Chargebacks / Disputes',
      status: openDisputes === 0 ? 'pass' : 'fail',
      detail:
        openDisputes === 0
          ? 'No open payment disputes or frozen orders.'
          : `${openDisputes} active dispute(s) require immediate evidence submission.`,
    },
    {
      id: 'failure_rate',
      label: '24h Payment Failure Rate',
      status: failureRatePct <= 15 ? 'pass' : failureRatePct <= 35 ? 'warn' : 'fail',
      detail:
        total24h === 0
          ? 'No payment attempts recorded in the last 24 hours.'
          : `${failed24h} failed out of ${total24h} attempts (${failureRatePct}%).`,
    },
  ];

  const passCount = checks.filter((ck) => ck.status === 'pass').length;
  const healthScore = Math.round((passCount / checks.length) * 100);

  return c.json({
    success: true,
    data: {
      healthScore,
      checkedAt: nowIso(),
      gateways: {
        razorpay: {
          configured: rzpConfigured,
          enabled: enableRazorpay,
          mode: rzpMode,
          keyIdPrefix: rzpConfigured ? `${env.RAZORPAY_KEY_ID.slice(0, 12)}…` : null,
          webhookSecretSet: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
        },
        cashfree: {
          configured: cfConfigured,
          enabled: enableCashfree,
          environment: cfEnv,
          appIdPrefix: cfConfigured ? `${env.CASHFREE_APP_ID?.slice(0, 8)}…` : null,
          webhookSecretSet: cfConfigured,
        },
        cod: {
          enabled: enableCod,
          maxOrderPaise: codMaxOrderPaise,
          handlingFeePaise: codFeePaise,
        },
      },
      routing: {
        primaryGateway,
        autoRefundDuplicateCapture: Boolean(storeSettings.autoRefundDuplicateCapture ?? policy.autoRefundDuplicateCapture),
        upiMaxPaise: Number(storeSettings.upiMaxPaise ?? policy.upiMaxPaise ?? 10000000),
        panVerificationThresholdPaise: Number(storeSettings.panVerificationThresholdPaise ?? policy.panVerificationThresholdPaise ?? 20000000),
        freeShippingThresholdPaise: Number(storeSettings.freeShippingThresholdPaise ?? policy.freeShippingThresholdPaise),
        standardShippingPaise: Number(storeSettings.standardShippingPaise ?? policy.standardShippingPaise),
      },
      checks,
      stuckOrders,
    },
  });
});

// ─── POST /api/admin/payments/test-gateway — Live Gateway Connectivity Check ──
adminPayments.post('/test-gateway', requirePermission('settings.write', 'orders.read'), async (c) => {
  const env = c.env;
  const results: Record<string, { ok: boolean; status: string; latencyMs: number; detail: string }> = {};

  // Test Razorpay API reachability & auth (GET /v1/orders?count=1 — read-only, zero charges)
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && !env.RAZORPAY_KEY_ID.includes('placeholder')) {
    const start = Date.now();
    try {
      const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
      const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Date.now() - start;
      results.razorpay = res.ok
        ? { ok: true, status: 'CONNECTED', latencyMs, detail: `Authenticated successfully (${res.status} OK).` }
        : { ok: false, status: `HTTP_${res.status}`, latencyMs, detail: `Razorpay rejected credentials (HTTP ${res.status}).` };
    } catch (err: any) {
      results.razorpay = { ok: false, status: 'NETWORK_ERROR', latencyMs: Date.now() - start, detail: err?.message || 'Timeout contacting Razorpay' };
    }
  } else {
    results.razorpay = { ok: false, status: 'UNCONFIGURED', latencyMs: 0, detail: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set.' };
  }

  // Test Cashfree API reachability & auth (GET /orders/dd_health_probe_0 — 404 means auth passed, 401/403 means bad keys)
  if (env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY && !env.CASHFREE_APP_ID.includes('placeholder')) {
    const start = Date.now();
    const baseUrl = env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg';
    try {
      const res = await fetch(`${baseUrl}/orders/dd_health_probe_0`, {
        headers: {
          'x-client-id': env.CASHFREE_APP_ID,
          'x-client-secret': env.CASHFREE_SECRET_KEY,
          'x-api-version': env.CASHFREE_API_VERSION || '2023-08-01',
        },
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Date.now() - start;
      // 200 or 404 proves credentials authenticated with Cashfree PG API
      const authPassed = res.status === 200 || res.status === 404;
      results.cashfree = authPassed
        ? { ok: true, status: 'CONNECTED', latencyMs, detail: `Authenticated with ${baseUrl.includes('sandbox') ? 'Sandbox' : 'Production'} PG API.` }
        : { ok: false, status: `HTTP_${res.status}`, latencyMs, detail: `Cashfree returned HTTP ${res.status} — verify App ID / Secret Key & Sandbox vs Production URL.` };
    } catch (err: any) {
      results.cashfree = { ok: false, status: 'NETWORK_ERROR', latencyMs: Date.now() - start, detail: err?.message || 'Timeout contacting Cashfree' };
    }
  } else {
    results.cashfree = { ok: false, status: 'UNCONFIGURED', latencyMs: 0, detail: 'CASHFREE_APP_ID / CASHFREE_SECRET_KEY not set.' };
  }

  await auditAdminAction(c, 'RUN_PAYMENT_CHECKUP', 'payment', 'gateways', results);
  return c.json({ success: true, data: { testedAt: nowIso(), results } });
});

// ─── POST /api/admin/payments/orders/:orderId/mark-paid ──────────────────────
// Audited manual payment capture / settlement (offline UPI, Bank Wire, Atelier POS, COD collected)
const markPaidSchema = z.object({
  paymentMethod: z.enum([
    'upi_manual',
    'bank_transfer',
    'cod_collected',
    'atelier_pos',
    'razorpay_manual',
    'cashfree_manual',
  ]),
  referenceNumber: z.string().trim().min(3, 'Payment reference / UTR is required').max(120),
  reason: z.string().trim().min(3, 'Audit reason is required').max(400),
});

adminPayments.post(
  '/orders/:orderId/mark-paid',
  requirePermission('orders.refund', 'orders.fulfill'),
  zValidator('json', markPaidSchema),
  async (c) => {
    const orderId = c.req.param('orderId');
    const adminId = c.get('userId');
    const adminEmail = c.get('userEmail') ?? null;
    const body = c.req.valid('json');

    const order = (await getOrderById(c.env.DB, orderId)) as DbOrder | null;
    if (!order) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } }, 404);
    }

    if (order.payment_status === 'paid') {
      return c.json({ success: false, error: { code: 'ALREADY_PAID', message: 'Order is already marked paid.', status: 409 } }, 409);
    }

    const result = await finalizePaidOrder(
      c.env,
      order,
      body.referenceNumber,
      body.paymentMethod,
      order.cf_order_id,
      c.executionCtx,
      `admin_manual_paid:${adminId}`,
    );

    const now = nowIso();
    await c.env.DB
      .prepare(
        `INSERT INTO payment_adjustments
         (id, order_id, action_type, delta_paise, previous_total_paise, new_total_paise, payment_method, reference_code, reason, metadata_json, actor_id, actor_email, created_at)
         VALUES (?1, ?2, 'manual_mark_paid', 0, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      )
      .bind(
        generateId('padj_'),
        order.id,
        order.total_paise,
        body.paymentMethod,
        body.referenceNumber,
        body.reason,
        JSON.stringify({ allocated: result.allocated, nextStatus: result.status }),
        adminId,
        adminEmail,
        now,
      )
      .run();

    await appendOrderAuditLog(
      c.env.DB,
      order.id,
      'admin_manual_mark_paid',
      `Manually marked PAID via ${body.paymentMethod} (Ref: ${body.referenceNumber}). Reason: ${body.reason}`,
      adminId,
    );

    await auditAdminAction(c, 'ADMIN_MANUAL_MARK_PAID', 'order', order.id, {
      orderNumber: order.order_number,
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber,
      reason: body.reason,
      ...result,
    });

    return c.json({ success: true, data: { orderId: order.id, ...result } });
  },
);

// ─── POST /api/admin/payments/orders/:orderId/adjust-amount ──────────────────
// Audited price manipulation for pending/unpaid orders (VIP discount, bespoke fee, shipping waiver)
const adjustAmountSchema = z.object({
  adjustmentPaise: z.number().int().optional(), // negative = courtesy discount, positive = surcharge/bespoke tailoring
  shippingPaise: z.number().int().min(0).optional(),
  discountPaise: z.number().int().min(0).optional(),
  reason: z.string().trim().min(3, 'Audit reason is required').max(400),
});

adminPayments.post(
  '/orders/:orderId/adjust-amount',
  requirePermission('orders.refund'),
  zValidator('json', adjustAmountSchema),
  async (c) => {
    const orderId = c.req.param('orderId');
    const adminId = c.get('userId');
    const adminEmail = c.get('userEmail') ?? null;
    const body = c.req.valid('json');

    const order = (await getOrderById(c.env.DB, orderId)) as DbOrder | null;
    if (!order) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } }, 404);
    }

    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return c.json(
        {
          success: false,
          error: {
            code: 'ORDER_ALREADY_SETTLED',
            message: 'Cannot edit the total of an already paid/refunded order. Use Issue Refund instead.',
            status: 409,
          },
        },
        409,
      );
    }

    const policy = resolveStorePolicy(c.env);
    const nextShipping = body.shippingPaise !== undefined ? body.shippingPaise : order.shipping_paise;
    const nextDiscount = body.discountPaise !== undefined ? body.discountPaise : order.discount_paise;
    const nextAdjustment =
      body.adjustmentPaise !== undefined
        ? body.adjustmentPaise
        : Number(order.admin_adjustment_paise ?? 0);

    const basePostDiscount = Math.max(0, order.subtotal_paise - nextDiscount);
    const rawTotal = policy.taxInclusive
      ? basePostDiscount + nextShipping + nextAdjustment
      : basePostDiscount + order.tax_paise + nextShipping + nextAdjustment;
    const nextTotalPaise = Math.max(100, rawTotal); // minimum ₹1.00 for gateway compliance
    const deltaPaise = nextTotalPaise - order.total_paise;
    const now = nowIso();

    await c.env.DB
      .prepare(
        `UPDATE orders
         SET shipping_paise = ?1,
             discount_paise = ?2,
             admin_adjustment_paise = ?3,
             admin_adjustment_reason = ?4,
             total_paise = ?5,
             updated_at = ?6
         WHERE id = ?7`,
      )
      .bind(nextShipping, nextDiscount, nextAdjustment, body.reason, nextTotalPaise, now, order.id)
      .run();

    await c.env.DB
      .prepare(
        `INSERT INTO payment_adjustments
         (id, order_id, action_type, delta_paise, previous_total_paise, new_total_paise, reason, metadata_json, actor_id, actor_email, created_at)
         VALUES (?1, ?2, 'amount_adjustment', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      )
      .bind(
        generateId('padj_'),
        order.id,
        deltaPaise,
        order.total_paise,
        nextTotalPaise,
        body.reason,
        JSON.stringify({ nextShipping, nextDiscount, nextAdjustment }),
        adminId,
        adminEmail,
        now,
      )
      .run();

    await appendOrderAuditLog(
      c.env.DB,
      order.id,
      'admin_amount_adjusted',
      `Total adjusted from ${formatPaiseToDisplay(order.total_paise)} to ${formatPaiseToDisplay(nextTotalPaise)}. Reason: ${body.reason}`,
      adminId,
    );

    await auditAdminAction(c, 'ADMIN_ADJUST_ORDER_AMOUNT', 'order', order.id, {
      previousTotalPaise: order.total_paise,
      newTotalPaise: nextTotalPaise,
      deltaPaise,
      reason: body.reason,
    });

    return c.json({
      success: true,
      data: {
        orderId: order.id,
        previousTotalPaise: order.total_paise,
        newTotalPaise: nextTotalPaise,
        newTotalFormatted: formatPaiseToDisplay(nextTotalPaise),
        deltaPaise,
      },
    });
  },
);

// ─── POST /api/admin/payments/orders/:orderId/status-override ────────────────
const statusOverrideSchema = z.object({
  paymentStatus: z.enum([
    'pending',
    'authorized',
    'paid',
    'partially_refunded',
    'refunded',
    'failed',
    'user_dropped',
    'disputed',
  ]),
  referenceNumber: z.string().max(120).optional(),
  reason: z.string().trim().min(3, 'Audit reason is required').max(400),
});

adminPayments.post(
  '/orders/:orderId/status-override',
  requirePermission('orders.refund'),
  zValidator('json', statusOverrideSchema),
  async (c) => {
    const orderId = c.req.param('orderId');
    const adminId = c.get('userId');
    const adminEmail = c.get('userEmail') ?? null;
    const body = c.req.valid('json');

    const order = (await getOrderById(c.env.DB, orderId)) as DbOrder | null;
    if (!order) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } }, 404);
    }

    const now = nowIso();
    if (body.paymentStatus === 'paid' && order.payment_status !== 'paid') {
      await finalizePaidOrder(
        c.env,
        order,
        body.referenceNumber || `ADMIN_OVR_${Date.now()}`,
        'admin_override',
        order.cf_order_id,
        c.executionCtx,
        `admin_status_override:${adminId}`,
      );
    } else {
      await c.env.DB
        .prepare(
          `UPDATE orders
           SET payment_status = ?1,
               dispute_frozen = CASE WHEN ?1 = 'disputed' THEN 1 ELSE dispute_frozen END,
               updated_at = ?2
           WHERE id = ?3`,
        )
        .bind(body.paymentStatus, now, order.id)
        .run();
    }

    await c.env.DB
      .prepare(
        `INSERT INTO payment_adjustments
         (id, order_id, action_type, delta_paise, previous_total_paise, new_total_paise, reference_code, reason, metadata_json, actor_id, actor_email, created_at)
         VALUES (?1, ?2, 'payment_status_override', 0, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        generateId('padj_'),
        order.id,
        order.total_paise,
        body.referenceNumber ?? null,
        body.reason,
        JSON.stringify({ from: order.payment_status, to: body.paymentStatus }),
        adminId,
        adminEmail,
        now,
      )
      .run();

    await appendOrderAuditLog(
      c.env.DB,
      order.id,
      'admin_payment_status_override',
      `Payment status overridden ${order.payment_status} -> ${body.paymentStatus}. Reason: ${body.reason}`,
      adminId,
    );

    await auditAdminAction(c, 'ADMIN_PAYMENT_STATUS_OVERRIDE', 'order', order.id, {
      from: order.payment_status,
      to: body.paymentStatus,
      reason: body.reason,
    });

    return c.json({ success: true, data: { orderId: order.id, paymentStatus: body.paymentStatus } });
  },
);

// ─── GET /api/admin/payments/adjustments ─────────────────────────────────────
adminPayments.get('/adjustments', requirePermission('orders.read', 'logs.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT pa.*, o.order_number, o.shipping_name
       FROM payment_adjustments pa
       LEFT JOIN orders o ON o.id = pa.order_id
       ORDER BY pa.created_at DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>()
    .catch(() => ({ results: [] }));

  return c.json({ success: true, data: { items: rows.results ?? [] } });
});

// ─── GET /api/admin/payments/webhooks ────────────────────────────────────────
adminPayments.get('/webhooks', requirePermission('orders.read', 'logs.read'), async (c) => {
  const gateway = c.req.query('gateway')?.trim();
  const status = c.req.query('status')?.trim();
  let sql = `SELECT * FROM webhook_events WHERE 1=1`;
  const binds: unknown[] = [];
  if (gateway) {
    binds.push(gateway);
    sql += ` AND gateway = ?${binds.length}`;
  }
  if (status) {
    binds.push(status);
    sql += ` AND status = ?${binds.length}`;
  }
  sql += ` ORDER BY received_at DESC LIMIT 100`;

  const rows = await c.env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return c.json({ success: true, data: { items: rows.results ?? [] } });
});

export default adminPayments;
