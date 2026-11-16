import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { DbOrder } from '../types/models.js';
import type { ApiOrder, ApiOrderTrackingDetails, TrackingMilestone } from '../types/api.js';
import { resolveStorePolicy } from '../config/policy.js';
import { authRequired } from '../middleware/auth.js';
import { checkD1RateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';
import { getUserOrders, getOrderById, getOrderItems } from '../db/queries/orders.js';
import { formatPaiseToDisplay } from '../services/money.js';
import { nowIso } from '../db/client.js';
import { generateId } from '../services/crypto.js';
import {
  getShiprocketToken,
  trackShiprocketShipment,
  cancelShiprocketOrder,
} from '../services/shiprocket.js';
import {
  appendOrderAuditLog,
  initiateOrderRefund,
  notifyOrderCancelled,
  releaseOrderHoldOnFailure,
} from '../services/orderLifecycle.js';

const orders = new Hono<{ Bindings: Env }>();

function isAuthorizedAdmin(role: string | undefined, email: string | undefined, env: Env): boolean {
  if (role !== 'admin' && role !== 'superadmin') return false;
  if (!email) return false;
  const allowlist =
    env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
  return allowlist.includes(email.toLowerCase());
}

async function buildOrderTrackingResponse(
  db: D1Database,
  env: Env,
  order: DbOrder,
): Promise<ApiOrderTrackingDetails> {
  const items = await getOrderItems(db, order.id);
  const orderStatus = order.status;
  const awb = order.shiprocket_awb || order.tracking_number;
  const courier = order.courier_partner || order.shiprocket_courier || 'DEYNOLD DANNY Express';

  let liveActivities: Array<{ date: string; status: string; activity: string; location: string }> = [];
  let estimatedDeliveryDate: string | null = null;
  let resolvedCourier = courier;

  if (awb && env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD) {
    try {
      const srToken = await getShiprocketToken(
        env.CATALOG_KV,
        env.SHIPROCKET_EMAIL,
        env.SHIPROCKET_PASSWORD,
      );
      const tracking = await trackShiprocketShipment(srToken, awb);
      resolvedCourier = tracking.courierName || resolvedCourier;
      estimatedDeliveryDate = tracking.estimatedDeliveryDate;
      liveActivities = tracking.activityHistory || [];
    } catch {
      // Non-fatal
    }
  }

  if (!estimatedDeliveryDate && order.created_at) {
    const createdDate = new Date(order.created_at);
    const estDate = new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000);
    estimatedDeliveryDate = estDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const isConfirmed = ['confirmed', 'confirmed_needs_allocation', 'processing', 'shipped', 'ndr_pending', 'delivered', 'return_requested', 'returned'].includes(orderStatus);
  const isProcessing = ['processing', 'shipped', 'ndr_pending', 'delivered', 'return_requested', 'returned'].includes(orderStatus);
  const isShipped = ['shipped', 'ndr_pending', 'delivered', 'return_requested', 'returned'].includes(orderStatus);
  const isDelivered = ['delivered', 'return_requested', 'returned'].includes(orderStatus);

  const timeline: TrackingMilestone[] = [
    {
      key: 'ORDER_PLACED',
      title: 'Order Confirmed & Commissioned',
      description: 'Your sartorial order and payment have been verified.',
      status: 'completed',
      timestamp: order.paid_at || order.created_at,
    },
    {
      key: 'ATELIER_INSPECTION',
      title: 'Artisanal Tailoring & Quality Inspection',
      description: 'Garments inspected for finishings, drape, and archival presentation.',
      status: isShipped ? 'completed' : isProcessing || isConfirmed ? 'current' : 'upcoming',
      timestamp: isConfirmed ? order.paid_at || order.created_at : null,
    },
    {
      key: 'DISPATCHED',
      title: 'Handed Over to Courier',
      description: `Dispatched via ${resolvedCourier}${awb ? ` (AWB: ${awb})` : ''}.`,
      status: isDelivered ? 'completed' : isShipped ? 'current' : 'upcoming',
      timestamp: order.shipped_at || null,
    },
    {
      key: 'IN_TRANSIT',
      title: orderStatus === 'ndr_pending' ? 'Delivery Re-attempt Scheduled' : 'In Transit to Destination Hub',
      description:
        orderStatus === 'ndr_pending'
          ? 'Courier recorded a non-delivery notice and will re-attempt shortly.'
          : 'Consignment secured in transit en route to your destination hub.',
      status: isDelivered ? 'completed' : isShipped ? 'current' : 'upcoming',
      timestamp: null,
    },
    {
      key: 'DELIVERED',
      title: 'Delivered & Completed',
      description: 'Garment delivered to your shipping address.',
      status: isDelivered ? 'completed' : 'upcoming',
      timestamp: order.delivered_at || null,
    },
  ];

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    createdAt: order.created_at,
    paidAt: order.paid_at ?? null,
    shippedAt: order.shipped_at ?? null,
    deliveredAt: order.delivered_at ?? null,
    estimatedDeliveryDate,
    shippingName: order.shipping_name,
    shippingCity: order.shipping_city,
    shippingState: order.shipping_state,
    shippingPincode: order.shipping_pincode,
    shippingCountry: order.shipping_country || 'India',
    courierPartner: resolvedCourier,
    trackingNumber: awb ?? null,
    shiprocketAwb: order.shiprocket_awb ?? null,
    totalPaise: order.total_paise,
    totalFormatted: formatPaiseToDisplay(order.total_paise),
    subtotalPaise: order.subtotal_paise,
    subtotalFormatted: formatPaiseToDisplay(order.subtotal_paise),
    discountPaise: order.discount_paise,
    discountFormatted: formatPaiseToDisplay(order.discount_paise),
    shippingFormatted: order.shipping_paise === 0 ? 'Complimentary Express' : formatPaiseToDisplay(order.shipping_paise),
    items: items.map((it) => ({
      title: it.title,
      size: it.size,
      color: it.color,
      image: it.image || '/logo.png',
      quantity: it.quantity,
      unitPriceFormatted: formatPaiseToDisplay(it.unitPricePaise),
    })),
    timeline,
    liveActivities,
  };
}

// ─── GET /api/orders/track/:orderNumber (PII-Locked Public Tracking) ────────

orders.get('/track/:orderNumber', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rl = await checkD1RateLimit(c.env.DB, `track_ip:${ip}`, 20, 60);
  if (!rl.allowed) {
    return c.json(createRateLimitResponse('Too many tracking lookups. Please wait a minute.'), 429);
  }

  const orderNumber = c.req.param('orderNumber').trim();
  const emailQuery = c.req.query('email')?.trim().toLowerCase();
  const phoneQuery = c.req.query('phone')?.replace(/\D/g, '');

  // Require full order reference (>= 8 chars) plus mandatory email or mobile verification
  if (orderNumber.length < 8 || (!emailQuery && (!phoneQuery || phoneQuery.length < 10))) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VERIFICATION_REQUIRED',
          message: 'Please provide both your full order reference and billing email or 10-digit phone number.',
          status: 400,
        },
      },
      400,
    );
  }

  const order = await c.env.DB
    .prepare(
      `SELECT o.*, u.email AS account_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.order_number = ?1 COLLATE NOCASE
       LIMIT 1`,
    )
    .bind(orderNumber)
    .first<DbOrder & { account_email: string | null }>();

  const emailMatches =
    Boolean(emailQuery && order?.account_email && order.account_email.toLowerCase() === emailQuery);
  const phoneMatches = Boolean(
    phoneQuery &&
      phoneQuery.length >= 10 &&
      order?.shipping_phone &&
      order.shipping_phone.replace(/\D/g, '').endsWith(phoneQuery.slice(-10)),
  );

  // Return identical 404 for both missing order and mismatched verification to prevent enumeration
  if (!order || (!emailMatches && !phoneMatches)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'No order matched that reference and verification contact details.',
          status: 404,
        },
      },
      404,
    );
  }

  const trackingDetails = await buildOrderTrackingResponse(c.env.DB, c.env, order);
  return c.json({ success: true, data: trackingDetails });
});

// ─── GET /api/orders/:orderId/tracking ──────────────────────────────────────

orders.get('/:orderId/tracking', authRequired, async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const userEmail = c.get('userEmail');
  const orderId = c.req.param('orderId');

  const order = await getOrderById(c.env.DB, orderId);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.user_id !== userId && !isAuthorizedAdmin(userRole, userEmail, c.env)) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.', status: 403 } },
      403,
    );
  }

  const trackingDetails = await buildOrderTrackingResponse(c.env.DB, c.env, order);
  return c.json({ success: true, data: trackingDetails });
});

// ─── GET /api/orders — paginated list ───────────────────────────────────────

orders.get('/', authRequired, async (c) => {
  const userId = c.get('userId');
  const rawPage = Number(c.req.query('page') ?? '1');
  const rawLimit = Number(c.req.query('limit') ?? '10');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(20, Math.floor(rawLimit)) : 10;

  const { orders: dbOrders, total } = await getUserOrders(c.env.DB, userId, page, limit);

  const items: Omit<ApiOrder, 'items'>[] = dbOrders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    paymentStatus: o.payment_status,
    subtotalPaise: o.subtotal_paise,
    shippingPaise: o.shipping_paise,
    discountPaise: o.discount_paise,
    taxPaise: o.tax_paise,
    totalPaise: o.total_paise,
    totalFormatted: formatPaiseToDisplay(o.total_paise),
    shippingAddress: {
      fullName: o.shipping_name,
      phone: o.shipping_phone,
      line1: o.shipping_line1,
      line2: o.shipping_line2 ?? null,
      city: o.shipping_city,
      state: o.shipping_state,
      pincode: o.shipping_pincode,
    },
    couponCode: o.coupon_code ?? null,
    courierPartner: o.courier_partner ?? null,
    trackingNumber: o.tracking_number ?? null,
    createdAt: o.created_at,
    paidAt: o.paid_at ?? null,
    shippedAt: o.shipped_at ?? null,
  }));

  return c.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── GET /api/orders/:orderId ───────────────────────────────────────────────

orders.get('/:orderId', authRequired, async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const userEmail = c.get('userEmail');
  const orderId = c.req.param('orderId');

  const order = await getOrderById(c.env.DB, orderId);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.user_id !== userId && !isAuthorizedAdmin(userRole, userEmail, c.env)) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.', status: 403 } },
      403,
    );
  }

  const items = await getOrderItems(c.env.DB, orderId);
  const response: ApiOrder = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotalPaise: order.subtotal_paise,
    shippingPaise: order.shipping_paise,
    discountPaise: order.discount_paise,
    taxPaise: order.tax_paise,
    totalPaise: order.total_paise,
    totalFormatted: formatPaiseToDisplay(order.total_paise),
    items,
    shippingAddress: {
      fullName: order.shipping_name,
      phone: order.shipping_phone,
      line1: order.shipping_line1,
      line2: order.shipping_line2 ?? null,
      city: order.shipping_city,
      state: order.shipping_state,
      pincode: order.shipping_pincode,
    },
    couponCode: order.coupon_code ?? null,
    courierPartner: order.courier_partner ?? null,
    trackingNumber: order.tracking_number ?? null,
    shiprocketOrderId: order.shiprocket_order_id ?? null,
    shiprocketAwb: order.shiprocket_awb ?? null,
    createdAt: order.created_at,
    paidAt: order.paid_at ?? null,
    shippedAt: order.shipped_at ?? null,
  };

  return c.json({ success: true, data: response });
});

// ─── POST /api/orders/:orderId/cancel — Customer self-cancellation ──────────

const cancelSchema = z.object({
  reason: z.string().min(3).max(300).default('Cancelled by customer before dispatch'),
});

orders.post('/:orderId/cancel', authRequired, zValidator('json', cancelSchema), async (c) => {
  const userId = c.get('userId');
  const orderId = c.req.param('orderId');
  const { reason } = c.req.valid('json');

  const order = await getOrderById(c.env.DB, orderId);
  if (!order || order.user_id !== userId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  const cancellableStatuses = new Set([
    'pending',
    'awaiting_capture',
    'confirmed',
    'confirmed_needs_allocation',
    'processing',
  ]);
  if (!cancellableStatuses.has(order.status)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CANNOT_CANCEL',
          message: `Orders in '${order.status}' status cannot be cancelled online. Please contact concierge or initiate a return after delivery.`,
          status: 400,
        },
      },
      400,
    );
  }

  // Cancel on Shiprocket if shipment was pre-created
  if (order.shiprocket_order_id && c.env.SHIPROCKET_EMAIL && c.env.SHIPROCKET_PASSWORD) {
    try {
      const srId = Number(order.shiprocket_order_id);
      if (Number.isInteger(srId) && srId > 0) {
        const srToken = await getShiprocketToken(
          c.env.CATALOG_KV,
          c.env.SHIPROCKET_EMAIL,
          c.env.SHIPROCKET_PASSWORD,
        );
        await cancelShiprocketOrder(srToken, [srId]);
      }
    } catch (err) {
      console.warn('Shiprocket cancel warning:', err);
    }
  }

  if (order.payment_status === 'paid') {
    if (order.dispute_frozen === 1) {
      return c.json(
        {
          success: false,
          error: { code: 'DISPUTE_FROZEN', message: 'Order has an active dispute and cannot be auto-refunded.', status: 409 },
        },
        409,
      );
    }
    const refundable = Math.max(0, order.total_paise - (order.refunded_paise ?? 0));
    if (refundable > 0) {
      await initiateOrderRefund(c.env, order, refundable, reason, true, userId, c.executionCtx);
    }
    await c.env.DB
      .prepare(
        `UPDATE orders SET status = 'cancelled', cancellation_reason = ?1, cancelled_at = ?2, updated_at = ?2 WHERE id = ?3`,
      )
      .bind(reason, nowIso(), order.id)
      .run();
  } else {
    await releaseOrderHoldOnFailure(c.env.DB, order.id, 'cancelled', null, reason, userId);
  }

  await appendOrderAuditLog(c.env.DB, order.id, 'customer_cancel', reason, userId);
  await notifyOrderCancelled(c.env, order, reason, c.executionCtx);

  return c.json({
    success: true,
    data: { orderId: order.id, status: 'cancelled' },
  });
});

// ─── POST /api/orders/:orderId/returns — Customer return request ───────────

const returnSchema = z.object({
  reason: z.string().min(5).max(500),
  resolution: z.enum(['refund', 'exchange']).default('refund'),
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1) })).optional(),
});

orders.post('/:orderId/returns', authRequired, zValidator('json', returnSchema), async (c) => {
  const userId = c.get('userId');
  const orderId = c.req.param('orderId');
  const body = c.req.valid('json');
  const policy = resolveStorePolicy(c.env);

  const order = await getOrderById(c.env.DB, orderId);
  if (!order || order.user_id !== userId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.status !== 'delivered') {
    return c.json(
      {
        success: false,
        error: { code: 'RETURN_NOT_ELIGIBLE', message: 'Returns can only be initiated for delivered orders.', status: 400 },
      },
      400,
    );
  }

  if (order.delivered_at && policy.returnWindowDays > 0) {
    const deliveredMs = new Date(order.delivered_at).getTime();
    const ageDays = (Date.now() - deliveredMs) / (1000 * 86400);
    if (ageDays > policy.returnWindowDays) {
      return c.json(
        {
          success: false,
          error: {
            code: 'RETURN_WINDOW_EXPIRED',
            message: `Return requests must be submitted within ${policy.returnWindowDays} days of delivery.`,
            status: 400,
          },
        },
        400,
      );
    }
  }

  const returnId = generateId('ret_');
  const now = nowIso();
  const orderItems = await getOrderItems(c.env.DB, order.id);
  const selectedItems =
    body.items && body.items.length > 0
      ? body.items
      : orderItems.map((i) => ({ orderItemId: i.id, quantity: i.quantity }));

  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO return_requests (id, order_id, user_id, status, reason, items_json, resolution, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'requested', ?4, ?5, ?6, ?7, ?7)`,
      )
      .bind(returnId, order.id, userId, body.reason, JSON.stringify(selectedItems), body.resolution, now),
    c.env.DB
      .prepare(`UPDATE orders SET status = 'return_requested', updated_at = ?1 WHERE id = ?2`)
      .bind(now, order.id),
  ]);

  await appendOrderAuditLog(
    c.env.DB,
    order.id,
    'return_requested',
    `Return ${returnId} requested: ${body.reason}`,
    userId,
  );

  return c.json(
    {
      success: true,
      data: { returnId, orderId: order.id, status: 'return_requested' },
    },
    201,
  );
});

// ─── GET /api/orders/:orderId/invoice — Tax-breakdown invoice payload ───────

orders.get('/:orderId/invoice', authRequired, async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const userEmail = c.get('userEmail');
  const orderId = c.req.param('orderId');

  const order = await getOrderById(c.env.DB, orderId);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }
  if (order.user_id !== userId && !isAuthorizedAdmin(userRole, userEmail, c.env)) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.', status: 403 } },
      403,
    );
  }

  const itemRows = await c.env.DB
    .prepare(`SELECT * FROM order_items WHERE order_id = ?1`)
    .bind(order.id)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      invoiceNumber: `INV-${order.order_number}`,
      orderNumber: order.order_number,
      issuedAt: order.paid_at || order.created_at,
      currency: order.currency || 'INR',
      subtotalPaise: order.subtotal_paise,
      discountPaise: order.discount_paise,
      shippingPaise: order.shipping_paise,
      taxPaise: order.tax_paise,
      totalPaise: order.total_paise,
      refundedPaise: order.refunded_paise ?? 0,
      shippingTo: {
        name: order.shipping_name,
        line1: order.shipping_line1,
        line2: order.shipping_line2,
        city: order.shipping_city,
        state: order.shipping_state,
        pincode: order.shipping_pincode,
        country: order.shipping_country,
      },
      items: (itemRows.results ?? []).map((it) => ({
        title: it.title_snapshot,
        sku: it.sku_snapshot,
        hsnCode: it.hsn_code ?? null,
        gstRateBps: it.gst_rate_bps ?? 0,
        quantity: it.quantity,
        unitPricePaise: it.unit_price_paise,
        discountPaise: it.discount_paise ?? 0,
        taxablePaise: it.taxable_paise ?? it.total_paise,
        taxPaise: it.tax_paise ?? 0,
        totalPaise: it.total_paise,
      })),
    },
  });
});

export default orders;
