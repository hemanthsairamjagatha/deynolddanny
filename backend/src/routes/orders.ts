import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import type { ApiOrder } from '../types/api.js';
import { authRequired } from '../middleware/auth.js';
import {
  getUserOrders,
  getOrderById,
  getOrderItems,
} from '../db/queries/orders.js';
import { formatPaiseToDisplay } from '../services/money.js';

const orders = new Hono<{ Bindings: Env }>();

// ─── GET /api/orders — paginated list ───────────────────────────────────────

orders.get('/', authRequired, async (c) => {
  const userId = c.get('userId');
  const page = Number(c.req.query('page') ?? '1');
  const limit = Math.min(Number(c.req.query('limit') ?? '10'), 20);

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

// ─── GET /api/orders/:orderId ─────────────────────────────────────────────

orders.get('/:orderId', authRequired, async (c) => {
  const userId = c.get('userId');
  const orderId = c.req.param('orderId');

  const order = await getOrderById(c.env.DB, orderId);

  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  // Customers can only view their own orders; admins can view all
  const userRole = c.get('userRole');
  if (order.user_id !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
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
    createdAt: order.created_at,
    paidAt: order.paid_at ?? null,
    shippedAt: order.shipped_at ?? null,
  };

  return c.json({ success: true, data: response });
});

export default orders;

