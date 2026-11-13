import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import type { DbOrder } from '../../types/models.js';
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
} from '../../services/shiprocket.js';
import { sendOrderShippedEmail } from '../../services/resend.js';
import { formatPaiseToDisplay, paiseToRupeesFloat } from '../../services/money.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminOrders = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/orders ───────────────────────────────────────────────────

adminOrders.get('/', async (c) => {
  const page = Number(c.req.query('page') ?? '1');
  const limit = Math.min(Number(c.req.query('limit') ?? '20'), 50);
  const status = c.req.query('status');

  const { orders, total } = await getAllOrdersAdmin(c.env.DB, page, limit, status);

  const items = orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    paymentStatus: o.payment_status,
    totalPaise: o.total_paise,
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

  const items = await getOrderItems(c.env.DB, id);

  // Enrich with customer email
  const user = await c.env.DB
    .prepare(`SELECT email, full_name FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string; full_name: string | null }>();

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
      shiprocketAwb: order.shiprocket_awb ?? null,
      shiprocketCourier: order.shiprocket_courier ?? null,
      createdAt: order.created_at,
      paidAt: order.paid_at ?? null,
      shippedAt: order.shipped_at ?? null,
      deliveredAt: order.delivered_at ?? null,
      customer: user ?? null,
    },
  });
});

// ─── POST /api/admin/orders/:id/ship ────────────────────────────────────────
// Automated Shiprocket fulfillment: creates order on Shiprocket, assigns AWB, schedules pickup
const shipSchema = z.object({
  courierId: z.number().optional(), // optional specific courier preference
  lengthCm: z.number().optional().default(30),
  breadthCm: z.number().optional().default(25),
  heightCm: z.number().optional().default(5),
  weightKg: z.number().optional().default(0.5),
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

  // Guard: order must be confirmed/paid
  if (order.status !== 'confirmed' && order.status !== 'processing') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_ORDER_STATE',
          message: `Cannot ship an order in '${order.status}' status. Order must be confirmed or processing.`,
          status: 400,
        },
      },
      400,
    );
  }

  const items = await getOrderItems(env.DB, id);
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

  // 1. Authenticate with Shiprocket (cached in KV)
  let srToken: string;
  try {
    srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SHIPROCKET_AUTH_FAILED',
          message: `Shiprocket authentication failed: ${err.message}`,
          status: 502,
        },
      },
      502,
    );
  }

  // 2. Prepare line items
  const shiprocketItems = items.map((it) => ({
    name: it.title,
    sku: it.sku || it.id,
    units: it.quantity,
    selling_price: parseFloat(paiseToRupeesFloat(it.unitPricePaise)),
  }));

  // 3. Create Adhoc Order on Shiprocket
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
      subTotalRupees: parseFloat(paiseToRupeesFloat(order.total_paise)),
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

  // 4. Assign AWB
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
          message: `Shipment created (${shipmentId}) but AWB assignment failed: ${err.message}`,
          status: 502,
        },
      },
      502,
    );
  }

  // 5. Schedule Courier Pickup in background (non-blocking)
  c.executionCtx.waitUntil(
    generateShiprocketPickup(srToken, [shipmentId]).catch((err) => {
      console.warn('[Shiprocket Pickup Warning]', err.message);
    }),
  );

  // 6. Persist shipment & tracking details in D1
  const shippedAt = nowIso();
  await env.DB
    .prepare(
      `UPDATE orders SET
         status = 'shipped',
         courier_partner = ?1,
         tracking_number = ?2,
         shiprocket_order_id = ?3,
         shiprocket_awb = ?4,
         shiprocket_courier = ?5,
         shipped_at = ?6,
         updated_at = ?6
       WHERE id = ?7`,
    )
    .bind(
      courierName,
      awbCode,
      String(srOrderId),
      awbCode,
      courierName,
      shippedAt,
      order.id,
    )
    .run();

  // 7. Send Dispatched Email to Customer
  if (env.RESEND_API_KEY) {
    c.executionCtx.waitUntil(
      sendOrderShippedEmail(
        env.RESEND_API_KEY,
        user.email,
        order.order_number,
        courierName,
        awbCode,
      ),
    );
  }

  // 8. Admin Audit Log
  await env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'FULFILL_SHIPROCKET', 'order', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      generateId('log_'),
      adminId,
      id,
      JSON.stringify({ shipmentId, srOrderId, awbCode, courierName }),
      ip,
      nowIso(),
    )
    .run();

  return c.json({
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      status: 'shipped',
      courierPartner: courierName,
      trackingNumber: awbCode,
      shiprocketOrderId: String(srOrderId),
      shiprocketAwb: awbCode,
      shippedAt,
    },
  });
});

// ─── GET /api/admin/orders/:id/tracking ──────────────────────────────────────
// Live tracking lookup from Shiprocket API
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
      {
        success: false,
        error: { code: 'NO_TRACKING', message: 'No tracking or AWB code assigned to this order.', status: 400 },
      },
      400,
    );
  }

  try {
    const srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
    const tracking = await trackShiprocketShipment(srToken, awb);

    // If delivered, update order status
    if (tracking.currentStatus === 'DELIVERED' && order.status !== 'delivered') {
      await updateOrderStatus(env.DB, order.id, 'delivered');
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
// Pincode serviceability check with D1 caching
const pincodeSchema = z.object({
  deliveryPincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});

adminOrders.post('/pincode-check', zValidator('json', pincodeSchema), async (c) => {
  const { deliveryPincode } = c.req.valid('json');
  const env = c.env;
  const originPincode = env.SHIPROCKET_PICKUP_PINCODE || '400001';

  // Check D1 cache first
  const cached = await env.DB
    .prepare(`SELECT * FROM pincode_cache WHERE pincode = ?1`)
    .bind(deliveryPincode)
    .first<{ pincode: string; serviceable: number; courier_data: string | null; cached_at: string }>();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 3600);
    if (ageHours < 24) {
      let courierData: any = {};
      try {
        courierData = cached.courier_data ? JSON.parse(cached.courier_data) : {};
      } catch {}

      return c.json({
        success: true,
        data: {
          pincode: deliveryPincode,
          serviceable: cached.serviceable === 1,
          courierName: courierData.courierName,
          estimatedDeliveryDays: courierData.estimatedDeliveryDays,
          cached: true,
        },
      });
    }
  }

  // Query Shiprocket API
  try {
    const srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
    const result = await checkShiprocketPincode(srToken, originPincode, deliveryPincode);

    // Save to cache
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
        cached: false,
      },
    });
  } catch (err: any) {
    return c.json({
      success: true,
      data: {
        pincode: deliveryPincode,
        serviceable: true, // Graceful fallback
        courierName: 'Standard Express',
        estimatedDeliveryDays: 4,
        fallback: true,
      },
    });
  }
});

// ─── PATCH /api/admin/orders/:id/status ──────────────────────────────────────

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
});

adminOrders.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const { status } = c.req.valid('json');

  const order = await getOrderById(c.env.DB, id);
  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  await updateOrderStatus(c.env.DB, id, status);

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'UPDATE_ORDER_STATUS', 'order', ?3, ?4, ?5, ?6)`,
    )
    .bind(generateId('log_'), adminId, id, JSON.stringify({ from: order.status, to: status }), ip, nowIso())
    .run();

  return c.json({ success: true, data: { orderId: id, status } });
});

// ─── PATCH /api/admin/orders/:id/tracking ────────────────────────────────────
// Manual tracking override
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

  // Send shipment notification email
  const user = await c.env.DB
    .prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(order.user_id)
    .first<{ email: string }>();

  if (user && c.env.RESEND_API_KEY) {
    c.executionCtx.waitUntil(
      sendOrderShippedEmail(
        c.env.RESEND_API_KEY,
        user.email,
        order.order_number,
        courierPartner,
        trackingNumber,
      ),
    );
  }

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'SHIP_ORDER_MANUAL', 'order', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      generateId('log_'),
      adminId,
      id,
      JSON.stringify({ courierPartner, trackingNumber }),
      ip,
      nowIso(),
    )
    .run();

  return c.json({ success: true, data: { orderId: id, courierPartner, trackingNumber } });
});

export default adminOrders;
