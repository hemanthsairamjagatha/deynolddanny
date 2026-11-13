import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import type { ApiOrder, ApiOrderTrackingDetails, TrackingMilestone } from '../types/api.js';
import { authRequired } from '../middleware/auth.js';
import {
  getUserOrders,
  getOrderById,
  getOrderItems,
} from '../db/queries/orders.js';
import { formatPaiseToDisplay } from '../services/money.js';
import { getShiprocketToken, trackShiprocketShipment } from '../services/shiprocket.js';

const orders = new Hono<{ Bindings: Env }>();

/**
 * Helper to build comprehensive tracking details including Shiprocket live updates
 */
async function buildOrderTrackingResponse(
  db: D1Database,
  env: Env,
  order: any,
): Promise<ApiOrderTrackingDetails> {
  const items = await getOrderItems(db, order.id);

  // Determine current timeline status
  const orderStatus = order.status; // pending, confirmed, processing, shipped, delivered, cancelled
  const awb = order.shiprocket_awb || order.tracking_number;
  const courier = order.courier_partner || order.shiprocket_courier || 'DEYNOLD DANNY Bespoke Express';

  let liveActivities: Array<{ date: string; status: string; activity: string; location: string }> = [];
  let estimatedDeliveryDate: string | null = null;
  let resolvedCourier = courier;

  // Try live Shiprocket tracking query if AWB & credentials exist
  if (awb && env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD) {
    try {
      const srToken = await getShiprocketToken(env.CATALOG_KV, env.SHIPROCKET_EMAIL, env.SHIPROCKET_PASSWORD);
      const tracking = await trackShiprocketShipment(srToken, awb);
      resolvedCourier = tracking.courierName || resolvedCourier;
      estimatedDeliveryDate = tracking.estimatedDeliveryDate;
      liveActivities = tracking.activityHistory || [];
    } catch {
      // Non-fatal: continue with stored DB milestones
    }
  }

  // Calculate default estimated delivery if not provided by carrier (approx 3-5 days from order)
  if (!estimatedDeliveryDate && order.created_at) {
    const createdDate = new Date(order.created_at);
    const estDate = new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000);
    estimatedDeliveryDate = estDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const isConfirmed = ['confirmed', 'processing', 'shipped', 'delivered'].includes(orderStatus);
  const isProcessing = ['processing', 'shipped', 'delivered'].includes(orderStatus);
  const isShipped = ['shipped', 'delivered'].includes(orderStatus);
  const isDelivered = orderStatus === 'delivered';

  const timeline: TrackingMilestone[] = [
    {
      key: 'ORDER_PLACED',
      title: 'Order Confirmed & Commissioned',
      description: 'Your sartorial order and payment have been verified. Commission registered at the atelier.',
      status: 'completed',
      timestamp: order.paid_at || order.created_at,
    },
    {
      key: 'ATELIER_INSPECTION',
      title: 'Artisanal Tailoring & Quality Inspection',
      description: 'Master tailors verify fabric drape, stitch tension, and finishings before luxury presentation.',
      status: isShipped ? 'completed' : isProcessing ? 'current' : isConfirmed ? 'current' : 'upcoming',
      timestamp: isConfirmed ? (order.paid_at || order.created_at) : null,
    },
    {
      key: 'DISPATCHED',
      title: 'Handed Over to Courier',
      description: `Dispatched in signature archival dust bag via ${resolvedCourier}${awb ? ` (AWB: ${awb})` : ''}.`,
      status: isDelivered ? 'completed' : isShipped ? 'current' : 'upcoming',
      timestamp: order.shipped_at || null,
    },
    {
      key: 'IN_TRANSIT',
      title: 'In Transit to Destination Hub',
      description: 'Consignment secured in temperature-regulated transit facility en route to your local hub.',
      status: isDelivered ? 'completed' : isShipped ? 'current' : 'upcoming',
      timestamp: null,
    },
    {
      key: 'DELIVERED',
      title: 'Delivered & Completed',
      description: 'Garment successfully presented at your shipping residence.',
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
    shippingFormatted: 'Complimentary Express',
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

// ─── GET /api/orders/track/:orderNumber (Public Tracking Endpoint) ───────────

orders.get('/track/:orderNumber', async (c) => {
  const orderNumber = c.req.param('orderNumber').trim();
  const emailQuery = c.req.query('email')?.trim().toLowerCase();
  const phoneQuery = c.req.query('phone')?.trim();

  // Search case-insensitively by order_number or by internal order id
  const order = await c.env.DB
    .prepare(
      `SELECT * FROM orders
       WHERE (order_number = ?1 COLLATE NOCASE OR id = ?1)
       LIMIT 1`,
    )
    .bind(orderNumber)
    .first<any>();

  if (!order) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Order reference "${orderNumber}" could not be located. Please verify your order number.`,
          status: 404,
        },
      },
      404,
    );
  }

  // Optional extra verification if email or phone query provided
  if (emailQuery) {
    const userRow = await c.env.DB
      .prepare(`SELECT email FROM users WHERE id = ?1`)
      .bind(order.user_id)
      .first<{ email: string }>();

    if (userRow && userRow.email.toLowerCase() !== emailQuery) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: 'The email provided does not match our records for this commission.',
            status: 403,
          },
        },
        403,
      );
    }
  }

  if (phoneQuery && order.shipping_phone && !order.shipping_phone.endsWith(phoneQuery.slice(-10))) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: 'The phone number provided does not match our records for this commission.',
          status: 403,
        },
      },
      403,
    );
  }

  const trackingDetails = await buildOrderTrackingResponse(c.env.DB, c.env, order);
  return c.json({ success: true, data: trackingDetails });
});

// ─── GET /api/orders/:orderId/tracking (Authenticated Tracking) ─────────────

orders.get('/:orderId/tracking', authRequired, async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const orderId = c.req.param('orderId');

  const order = await getOrderById(c.env.DB, orderId);

  if (!order) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.', status: 404 } },
      404,
    );
  }

  if (order.user_id !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
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

