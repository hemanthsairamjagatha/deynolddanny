import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import type { DbOrder } from '../../types/models.js';
import { resolveStorePolicy } from '../../config/policy.js';
import {
  getAllOrdersAdmin,
  getOrderById,
  getOrderItems,
  updateOrderStatus,
  updateOrderTracking,
} from '../../db/queries/orders.js';
import {
  getShiprocketToken,
  createShiprocketOrder,
  assignShiprocketAWB,
  generateShiprocketPickup,
  trackShiprocketShipment,
  checkShiprocketPincode,
  cancelShiprocketOrder,
} from '../../services/shiprocket.js';
import { fetchRazorpayOrder, fetchRazorpayOrderPayments } from '../../services/razorpay.js';
import { fetchCashfreeOrder } from '../../services/cashfree.js';
import {
  appendOrderAuditLog,
  finalizePaidOrder,
  initiateOrderRefund,
  notifyOrderCancelled,
  releaseOrderHoldOnFailure,
} from '../../services/orderLifecycle.js';
import { recordAndSendEmail, sendOrderDeliveredEmail, sendOrderShippedEmail } from '../../services/resend.js';
import { restockCommittedStock, recordInventoryMovements } from '../../services/stockEngine.js';
import { formatPaiseToDisplay, paiseToRupeesFloat } from '../../services/money.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminOrders = new Hono<{ Bindings: Env }>();

async function logAdminOrderAction(
  db: D1Database,
  adminId: string,
  action: string,
  orderId: string,
  metadata: Record<string, unknown>,
  ip: string | null,
) {
  await db
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, ?3, 'order', ?4, ?5, ?6, ?7)`,
    )
    .bind(generateId('log_'), adminId, action, orderId, JSON.stringify(metadata), ip, nowIso())
    .run();
}

// ─── GET /api/admin/orders ───────────────────────────────────────────────────

adminOrders.get('/', async (c) => {
  const rawPage = Number(c.req.query('page') ?? '1');
  const rawLimit = Number(c.req.query('limit') ?? '20');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(50, Math.floor(rawLimit)) : 20;
  const status = c.req.query('status');

  const { orders, total } = await getAllOrdersAdmin(c.env.DB, page, limit, status);
  const items = orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    paymentStatus: o.payment_status,
    totalPaise: o.total_paise,
    refundedPaise: o.refunded_paise ?? 0,
    disputeFrozen: o.dispute_frozen ?? 0,
    totalFormatted: formatPaiseToDisplay(o.total_paise),
    shippingName: o.shipping_name,
    shippingCity: o.shipping_city,
    courierPartner: o.courier_partner,
    trackingNumber: o.tracking_number,
    shiprocketAwb: o.shiprocket_awb,
    createdAt: o.created_at,
    paidAt: o.paid_at ?? null,
  }));

  return c.json({
    success: true,
    data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ─── GET /api/admin/orders/:id ───────────────────────────────────────────────

adminOrders.get('/:id', async (c) => {
  const id = c.req.param('id');
  const order = await getOrderById(c.env.DB, id);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  const [items, user, attempts, refunds, disputes, auditLogs] = await Promise.all([
    getOrderItems(c.env.DB, id),
    c.env.DB.prepare(`SELECT email, full_name FROM users WHERE id = ?1`).bind(order.user_id).first<{ email: string; full_name: string | null }>(),
    c.env.DB.prepare(`SELECT * FROM payment_attempts WHERE order_id = ?1 ORDER BY attempt_number DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM refunds WHERE order_id = ?1 ORDER BY created_at DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM payment_disputes WHERE order_id = ?1 ORDER BY created_at DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM order_audit_logs WHERE order_id = ?1 ORDER BY created_at DESC LIMIT 30`).bind(id).all(),
  ]);

  return c.json({
    success: true,
    data: {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotalPaise: order.subtotal_paise,
      shippingPaise: order.shipping_paise,
      discountPaise: order.discount_paise,
      taxPaise: order.tax_paise,
      totalPaise: order.total_paise,
      refundedPaise: order.refunded_paise ?? 0,
      disputeFrozen: order.dispute_frozen ?? 0,
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
        country: order.shipping_country,
      },
      couponCode: order.coupon_code ?? null,
      courierPartner: order.courier_partner ?? null,
      trackingNumber: order.tracking_number ?? null,
      shiprocketOrderId: order.shiprocket_order_id ?? null,
      shiprocketShipmentId: order.shiprocket_shipment_id ?? null,
      shiprocketAwb: order.shiprocket_awb ?? null,
      shiprocketCourier: order.shiprocket_courier ?? null,
      createdAt: order.created_at,
      paidAt: order.paid_at ?? null,
      shippedAt: order.shipped_at ?? null,
      deliveredAt: order.delivered_at ?? null,
      customer: user ?? null,
      paymentAttempts: attempts.results ?? [],
      refunds: refunds.results ?? [],
      disputes: disputes.results ?? [],
      auditLogs: auditLogs.results ?? [],
    },
  });
});

// ─── POST /api/admin/orders/:id/ship ────────────────────────────────────────

const shipSchema = z.object({
  courierId: z.number().optional(),
  lengthCm: z.number().positive().optional().default(30),
  breadthCm: z.number().positive().optional().default(25),
  heightCm: z.number().positive().optional().default(5),
  weightKg: z.number().positive().optional().default(0.5),
});

adminOrders.post('/:id/ship', zValidator('json', shipSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const body = c.req.valid('json');
  const env = c.env;

  const order = await getOrderById(env.DB, id);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.status !== 'confirmed' && order.status !== 'processing') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_ORDER_STATE',
          message: `Cannot ship an order in '${order.status}' status.`,
          status: 400,
        },
      },
      400,
    );
  }

  if (order.payment_status !== 'paid') {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNPAID_ORDER',
          message: 'Cannot dispatch an order whose payment is not verified/paid.',
          status: 400,
        },
      },
      400,
    );
  }

  const rawItemsRes = await env.DB
    .prepare(`SELECT * FROM order_items WHERE order_id = ?1`)
    .bind(id)
    .all<Record<string, any>>();
  const rawItems = rawItemsRes.results ?? [];

  const user = await env.DB
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();

  if (!user) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'Order customer not found.', status: 404 } },
      404,
    );
  }

  let srToken: string;
  try {
    srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: { code: 'SHIPROCKET_AUTH_FAILED', message: err.message, status: 502 },
      },
      502,
    );
  }

  // Pass accurate net discounted selling prices and shipping charges to match total_paise
  const shiprocketItems = rawItems.map((it) => {
    const qty = Math.max(1, Number(it.quantity ?? 1));
    const lineGross = Number(it.total_paise ?? it.unit_price_paise * qty);
    const lineDiscount = Number(it.discount_paise ?? 0);
    const netUnitPaise = Math.max(100, Math.round((lineGross - lineDiscount) / qty));
    return {
      name: String(it.title_snapshot),
      sku: String(it.sku_snapshot || it.id),
      units: qty,
      selling_price: parseFloat(paiseToRupeesFloat(netUnitPaise)),
      discount: parseFloat(paiseToRupeesFloat(Math.round(lineDiscount / qty))),
      hsn: it.hsn_code ? String(it.hsn_code) : undefined,
    };
  });

  const netMerchandisePaise = Math.max(0, order.subtotal_paise - order.discount_paise);

  let shipmentId: number;
  let srOrderId: number;
  try {
    const srOrder = await createShiprocketOrder(srToken, {
      orderId: order.id,
      orderNumber: order.order_number,
      orderDate: new Date(order.created_at).toISOString().replace('T', ' ').substring(0, 16),
      channelId: env.SHIPROCKET_CHANNEL_ID,
      billingCustomerName: order.shipping_name,
      billingAddress: order.shipping_line1,
      billingAddress2: order.shipping_line2 || undefined,
      billingCity: order.shipping_city,
      billingPincode: order.shipping_pincode,
      billingState: order.shipping_state,
      billingCountry: order.shipping_country || 'India',
      billingEmail: user.email,
      billingPhone: order.shipping_phone,
      shippingCustomerName: order.shipping_name,
      shippingAddress: order.shipping_line1,
      shippingAddress2: order.shipping_line2 || undefined,
      shippingCity: order.shipping_city,
      shippingPincode: order.shipping_pincode,
      shippingState: order.shipping_state,
      shippingCountry: order.shipping_country || 'India',
      shippingEmail: user.email,
      shippingPhone: order.shipping_phone,
      orderItems: shiprocketItems,
      paymentMethod: 'Prepaid',
      subTotalRupees: parseFloat(paiseToRupeesFloat(netMerchandisePaise)),
      totalDiscountRupees: parseFloat(paiseToRupeesFloat(order.discount_paise)),
      shippingChargesRupees: parseFloat(paiseToRupeesFloat(order.shipping_paise)),
      lengthCm: body.lengthCm,
      breadthCm: body.breadthCm,
      heightCm: body.heightCm,
      weightKg: body.weightKg,
    });
    shipmentId = srOrder.shipmentId;
    srOrderId = srOrder.orderId;
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SHIPROCKET_ORDER_FAILED',
          message: `Failed to create shipment on Shiprocket: ${err.message}`,
          status: 502,
        },
      },
      502,
    );
  }

  let awbCode: string;
  let courierName: string;
  try {
    const awbRes = await assignShiprocketAWB(srToken, shipmentId, body.courierId);
    awbCode = awbRes.awbCode;
    courierName = awbRes.courierName;
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SHIPROCKET_AWB_FAILED',
          message: `Shipment ${shipmentId} created but AWB assignment failed: ${err.message}`,
          status: 502,
        },
      },
      502,
    );
  }

  let pickupScheduled = true;
  let pickupWarning: string | undefined;
  try {
    await generateShiprocketPickup(srToken, [shipmentId]);
  } catch (err: any) {
    pickupScheduled = false;
    pickupWarning = err.message;
  }

  const shippedAt = nowIso();
  await env.DB
    .prepare(
      `UPDATE orders SET
         status = 'shipped',
         courier_partner = ?1,
         tracking_number = ?2,
         shiprocket_order_id = ?3,
         shiprocket_shipment_id = ?4,
         shiprocket_awb = ?5,
         shiprocket_courier = ?6,
         shipped_at = ?7,
         updated_at = ?7
       WHERE id = ?8`,
    )
    .bind(
      courierName,
      awbCode,
      String(srOrderId),
      String(shipmentId),
      awbCode,
      courierName,
      shippedAt,
      order.id,
    )
    .run();

  await appendOrderAuditLog(
    env.DB,
    order.id,
    'ship',
    `Shipped via ${courierName} (AWB: ${awbCode}, pickupScheduled=${pickupScheduled}${pickupWarning ? `, warning=${pickupWarning}` : ''})`,
    adminId,
  );

  c.executionCtx.waitUntil(
    recordAndSendEmail(
      env.DB,
      `order_shipped:${order.order_number}:${awbCode}`,
      'order_shipped',
      user.email,
      { orderNumber: order.order_number, courierName, awbCode },
      () =>
        sendOrderShippedEmail(
          env.RESEND_API_KEY,
          user.email,
          order.order_number,
          courierName,
          awbCode,
          env.RESEND_FROM_EMAIL,
        ),
    ).catch((err) => console.error('Ship email fail:', err)),
  );

  await logAdminOrderAction(
    env.DB,
    adminId,
    'FULFILL_SHIPROCKET',
    id,
    { shipmentId, srOrderId, awbCode, courierName, pickupScheduled, pickupWarning },
    ip,
  );

  return c.json({
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      status: 'shipped',
      courierPartner: courierName,
      trackingNumber: awbCode,
      shiprocketOrderId: String(srOrderId),
      shiprocketShipmentId: String(shipmentId),
      shiprocketAwb: awbCode,
      pickupScheduled,
      pickupWarning,
      shippedAt,
    },
  });
});

// ─── GET /api/admin/orders/:id/tracking ──────────────────────────────────────

adminOrders.get('/:id/tracking', async (c) => {
  const id = c.req.param('id');
  const env = c.env;

  const order = await getOrderById(env.DB, id);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  const awb = order.shiprocket_awb || order.tracking_number;
  if (!awb) {
    return c.json(
      { success: false, error: { code: 'NO_TRACKING', message: 'No tracking or AWB code assigned.', status: 400 } },
      400,
    );
  }

  try {
    const srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
    const tracking = await trackShiprocketShipment(srToken, awb);

    if (tracking.currentStatus === 'DELIVERED' && order.status !== 'delivered') {
      const deliveredTime = tracking.deliveredAt || nowIso();
      await env.DB
        .prepare(`UPDATE orders SET status = 'delivered', delivered_at = ?1, updated_at = ?2 WHERE id = ?3`)
        .bind(deliveredTime, nowIso(), order.id)
        .run();
      await appendOrderAuditLog(env.DB, order.id, 'delivered', 'Synced DELIVERED from Shiprocket poll', 'admin_tracking_poll');

      const userRow = await env.DB.prepare(`SELECT email FROM users WHERE id = ?1`).bind(order.user_id).first<{ email: string }>();
      if (userRow?.email) {
        c.executionCtx.waitUntil(
          recordAndSendEmail(
            env.DB,
            `order_delivered:${order.order_number}`,
            'order_delivered',
            userRow.email,
            { orderNumber: order.order_number },
            () => sendOrderDeliveredEmail(env.RESEND_API_KEY, userRow.email, order.order_number, env.RESEND_FROM_EMAIL),
          ).catch(() => {}),
        );
      }
    }

    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        courierName: tracking.courierName,
        awbCode: tracking.awbCode,
        currentStatus: tracking.currentStatus,
        estimatedDeliveryDate: tracking.estimatedDeliveryDate,
        deliveredAt: tracking.deliveredAt,
        activityHistory: tracking.activityHistory,
      },
    });
  } catch (err: any) {
    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        courierName: order.courier_partner || 'Carrier',
        awbCode: awb,
        currentStatus: order.status.toUpperCase(),
        estimatedDeliveryDate: null,
        deliveredAt: order.delivered_at,
        activityHistory: [],
        note: `Real-time tracking unavailable: ${err.message}`,
      },
    });
  }
});

// ─── POST /api/admin/orders/pincode-check ────────────────────────────────────

const pincodeSchema = z.object({
  deliveryPincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});

adminOrders.post('/pincode-check', zValidator('json', pincodeSchema), async (c) => {
  const { deliveryPincode } = c.req.valid('json');
  const env = c.env;
  const policy = resolveStorePolicy(env);

  if (!policy.shiprocketPickupPincode || !env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICEABILITY_UNCONFIGURED',
          message: 'Warehouse origin pincode (SHIPROCKET_PICKUP_PINCODE) or Shiprocket credentials missing.',
          status: 503,
        },
      },
      503,
    );
  }

  try {
    const srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
    const result = await checkShiprocketPincode(srToken, policy.shiprocketPickupPincode, deliveryPincode);
    await env.DB
      .prepare(
        `INSERT OR REPLACE INTO pincode_cache (pincode, serviceable, courier_data, cached_at)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(
        deliveryPincode,
        result.serviceable ? 1 : 0,
        JSON.stringify({ courierName: result.courierName, estimatedDeliveryDays: result.estimatedDeliveryDays }),
        nowIso(),
      )
      .run();

    return c.json({
      success: true,
      data: {
        pincode: deliveryPincode,
        serviceable: result.serviceable,
        courierName: result.courierName,
        estimatedDeliveryDays: result.estimatedDeliveryDays,
      },
    });
  } catch (err: any) {
    if (policy.courierFailOpen) {
      return c.json({
        success: true,
        data: { pincode: deliveryPincode, serviceable: true, courierName: 'Standard Express', fallback: true },
      });
    }
    return c.json(
      {
        success: false,
        error: { code: 'COURIER_UNAVAILABLE', message: err.message, status: 502 },
      },
      502,
    );
  }
});

// ─── PATCH /api/admin/orders/:id/status ──────────────────────────────────────

const statusSchema = z.object({
  status: z.enum([
    'pending',
    'awaiting_capture',
    'confirmed',
    'confirmed_needs_allocation',
    'processing',
    'shipped',
    'ndr_pending',
    'delivered',
    'return_requested',
    'returned',
    'cancelled',
    'refunded',
  ]),
  reason: z.string().max(300).optional(),
});

adminOrders.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const { status, reason } = c.req.valid('json');

  const order = await getOrderById(c.env.DB, id);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (status === 'cancelled' && order.payment_status === 'pending') {
    await releaseOrderHoldOnFailure(
      c.env.DB,
      order.id,
      'cancelled',
      null,
      reason || 'Admin cancelled pending order',
      adminId,
    );
  } else {
    await updateOrderStatus(c.env.DB, id, status);
    await appendOrderAuditLog(
      c.env.DB,
      id,
      'status_change',
      `Status changed from ${order.status} to ${status}${reason ? ` (${reason})` : ''}`,
      adminId,
    );
  }

  await logAdminOrderAction(
    c.env.DB,
    adminId,
    'UPDATE_ORDER_STATUS',
    id,
    { from: order.status, to: status, reason },
    ip,
  );

  return c.json({ success: true, data: { orderId: id, status } });
});

// ─── PATCH /api/admin/orders/:id/tracking ────────────────────────────────────

const trackingSchema = z.object({
  courierPartner: z.string().min(1).max(100),
  trackingNumber: z.string().min(1).max(100),
});

adminOrders.patch('/:id/tracking', zValidator('json', trackingSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const { courierPartner, trackingNumber } = c.req.valid('json');

  const order = await getOrderById(c.env.DB, id);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  const shippedAt = nowIso();
  await updateOrderTracking(c.env.DB, id, { courierPartner, trackingNumber, shippedAt });

  const user = await c.env.DB
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();

  if (user?.email) {
    c.executionCtx.waitUntil(
      recordAndSendEmail(
        c.env.DB,
        `order_shipped:${order.order_number}:${trackingNumber}`,
        'order_shipped',
        user.email,
        { orderNumber: order.order_number, courierPartner, trackingNumber },
        () =>
          sendOrderShippedEmail(
            c.env.RESEND_API_KEY,
            user.email,
            order.order_number,
            courierPartner,
            trackingNumber,
            c.env.RESEND_FROM_EMAIL,
          ),
      ).catch(() => {}),
    );
  }

  await logAdminOrderAction(
    c.env.DB,
    adminId,
    'SHIP_ORDER_MANUAL',
    id,
    { courierPartner, trackingNumber },
    ip,
  );

  return c.json({ success: true, data: { orderId: id, courierPartner, trackingNumber } });
});

// ─── POST /api/admin/orders/:id/refund ───────────────────────────────────────

const refundSchema = z.object({
  amountPaise: z.number().int().positive(),
  reason: z.string().min(3).max(300),
  restockItems: z.boolean().optional().default(false),
});

adminOrders.post('/:id/refund', zValidator('json', refundSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const { amountPaise, reason, restockItems } = c.req.valid('json');

  const order = (await getOrderById(c.env.DB, id)) as DbOrder | null;
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  try {
    const result = await initiateOrderRefund(
      c.env,
      order,
      amountPaise,
      reason,
      restockItems,
      adminId,
      c.executionCtx,
    );

    await logAdminOrderAction(
      c.env.DB,
      adminId,
      'INITIATE_REFUND',
      id,
      { ...result, reason, restockItems },
      ip,
    );

    return c.json({ success: true, data: result });
  } catch (err: any) {
    const msg = err?.message || 'Refund failed';
    const status = msg.startsWith('DISPUTE_FROZEN') || msg.startsWith('INVALID_REFUND_AMOUNT') ? 400 : 502;
    return c.json(
      { success: false, error: { code: 'REFUND_REJECTED', message: msg, status } },
      status,
    );
  }
});

// ─── POST /api/admin/orders/:id/reconcile — Manual gateway reconciliation ────

adminOrders.post('/:id/reconcile', async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const env = c.env;

  const order = (await getOrderById(env.DB, id)) as DbOrder | null;
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.payment_status === 'paid') {
    return c.json({ success: true, data: { reconciled: false, reason: 'Already paid', status: order.status } });
  }

  if (order.cf_order_id && order.cf_order_id.startsWith('order_') && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const rzpOrder = await fetchRazorpayOrder(order.cf_order_id, env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
    if (rzpOrder.status === 'paid' && rzpOrder.amount === order.total_paise && rzpOrder.currency === 'INR') {
      const payments = await fetchRazorpayOrderPayments(order.cf_order_id, env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
      const captured = payments.find((p) => p.status === 'captured');
      const res = await finalizePaidOrder(
        env,
        order,
        captured?.id || order.cf_order_id,
        captured?.method || 'razorpay',
        order.cf_order_id,
        c.executionCtx,
        `admin_reconcile:${adminId}`,
      );
      await logAdminOrderAction(env.DB, adminId, 'RECONCILE_ORDER', id, res, ip);
      return c.json({ success: true, data: { reconciled: true, ...res } });
    }
    return c.json({ success: true, data: { reconciled: false, gatewayStatus: rzpOrder.status } });
  }

  if (order.cf_order_id && env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY) {
    const cf = await fetchCashfreeOrder(
      order.cf_order_id,
      env.CASHFREE_APP_ID,
      env.CASHFREE_SECRET_KEY,
      env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg',
      env.CASHFREE_API_VERSION || '2023-08-01',
    );
    if (cf.status === 'PAID' && (cf.amountPaise === null || cf.amountPaise === order.total_paise)) {
      const res = await finalizePaidOrder(
        env,
        order,
        cf.paymentId || order.cf_order_id,
        cf.paymentMethod || 'cashfree',
        order.cf_order_id,
        c.executionCtx,
        `admin_reconcile:${adminId}`,
      );
      await logAdminOrderAction(env.DB, adminId, 'RECONCILE_ORDER', id, res, ip);
      return c.json({ success: true, data: { reconciled: true, ...res } });
    }
    return c.json({ success: true, data: { reconciled: false, gatewayStatus: cf.status } });
  }

  return c.json({ success: true, data: { reconciled: false, reason: 'No active gateway session found' } });
});

// ─── PATCH /api/admin/orders/:id/returns/:returnId ──────────────────────────

const returnReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pickup_scheduled', 'received', 'inspected', 'refunded', 'closed']),
  adminNotes: z.string().max(400).optional(),
  restockItems: z.boolean().optional().default(false),
});

adminOrders.patch('/:id/returns/:returnId', zValidator('json', returnReviewSchema), async (c) => {
  const orderId = c.req.param('id');
  const returnId = c.req.param('returnId');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const body = c.req.valid('json');

  const ret = await c.env.DB
    .prepare(`SELECT * FROM return_requests WHERE id = ?1 AND order_id = ?2 LIMIT 1`)
    .bind(returnId, orderId)
    .first<Record<string, unknown>>();
  if (!ret) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return request not found.', status: 404 } }, 404);
  }

  await c.env.DB
    .prepare(`UPDATE return_requests SET status = ?1, admin_notes = COALESCE(?2, admin_notes), updated_at = ?3 WHERE id = ?4`)
    .bind(body.status, body.adminNotes ?? null, nowIso(), returnId)
    .run();

  if (body.restockItems && (body.status === 'inspected' || body.status === 'refunded')) {
    const items = await c.env.DB
      .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`)
      .bind(orderId)
      .all<{ variant_id: string; quantity: number }>();
    for (const item of items.results ?? []) {
      await restockCommittedStock(c.env.DB, item.variant_id, item.quantity);
    }
    if ((items.results ?? []).length > 0) {
      await recordInventoryMovements(
        c.env.DB,
        (items.results ?? []).map((item) => ({
          variantId: item.variant_id,
          orderId,
          movementType: 'return_restock',
          qtyDelta: item.quantity,
          actorId: adminId,
          notes: `Return ${returnId} inspected & restocked`,
        })),
      );
    }
  }

  await logAdminOrderAction(c.env.DB, adminId, 'REVIEW_RETURN', orderId, { returnId, ...body }, ip);
  return c.json({ success: true, data: { returnId, status: body.status } });
});

// ─── POST /api/admin/orders/:id/cancel ───────────────────────────────────────

adminOrders.post('/:id/cancel', zValidator('json', z.object({ reason: z.string().min(3).max(300) })), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const { reason } = c.req.valid('json');

  const order = await getOrderById(c.env.DB, id);
  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } }, 404);
  }

  if (order.shiprocket_order_id && c.env.SHIPROCKET_EMAIL && c.env.SHIPROCKET_PASSWORD) {
    try {
      const srId = Number(order.shiprocket_order_id);
      if (Number.isInteger(srId) && srId > 0) {
        const srToken = await getShiprocketToken(c.env.CATALOG_KV, c.env.SHIPROCKET_EMAIL, c.env.SHIPROCKET_PASSWORD);
        await cancelShiprocketOrder(srToken, [srId]);
      }
    } catch {}
  }

  if (order.payment_status === 'paid') {
    const refundable = Math.max(0, order.total_paise - (order.refunded_paise ?? 0));
    if (refundable > 0) {
      await initiateOrderRefund(c.env, order, refundable, reason, true, adminId, c.executionCtx);
    }
    await c.env.DB
      .prepare(`UPDATE orders SET status = 'cancelled', cancellation_reason = ?1, cancelled_at = ?2, updated_at = ?2 WHERE id = ?3`)
      .bind(reason, nowIso(), order.id)
      .run();
  } else {
    await releaseOrderHoldOnFailure(c.env.DB, order.id, 'cancelled', null, reason, adminId);
  }

  await notifyOrderCancelled(c.env, order, reason, c.executionCtx);
  await logAdminOrderAction(c.env.DB, adminId, 'ADMIN_CANCEL_ORDER', id, { reason }, ip);
  return c.json({ success: true, data: { orderId: id, status: 'cancelled' } });
});

export default adminOrders;
