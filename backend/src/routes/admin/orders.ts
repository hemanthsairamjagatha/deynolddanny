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
import { sendOrderShippedEmail } from '../../services/resend.js';
import { formatPaiseToDisplay } from '../../services/money.js';
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
      createdAt: order.created_at,
      paidAt: order.paid_at ?? null,
      shippedAt: order.shipped_at ?? null,
      deliveredAt: order.delivered_at ?? null,
      customer: user ?? null,
    },
  });
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

  if (user) {
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
       VALUES (?1, ?2, 'SHIP_ORDER', 'order', ?3, ?4, ?5, ?6)`,
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

