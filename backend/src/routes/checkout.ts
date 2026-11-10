import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiCheckoutResponse } from '../types/api.js';
import { authRequired } from '../middleware/auth.js';
import { getOrCreateCart, getCartWithItems, clearCart } from '../db/queries/cart.js';
import { createOrder, createOrderItems } from '../db/queries/orders.js';
import { holdStock } from '../services/stockEngine.js';
import { createCashfreeOrder } from '../services/cashfree.js';
import { paiseToRupeesFloat } from '../services/money.js';
import {
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_PAISE,
  TAX_RATE,
} from '../config/constants.js';

const checkout = new Hono<{ Bindings: Env }>();

// ─── Schema ─────────────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  shippingAddressId: z.string().optional(),
  // Manual address fields (used when shippingAddressId not provided)
  shippingName: z.string().min(2).max(100),
  shippingPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  shippingLine1: z.string().min(5).max(200),
  shippingLine2: z.string().max(200).optional(),
  shippingCity: z.string().min(2).max(100),
  shippingState: z.string().min(2).max(100),
  shippingPincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  shippingCountry: z.string().default('India'),
  couponCode: z.string().max(50).optional(),
  customerNotes: z.string().max(500).optional(),
  sessionId: z.string().optional(), // for guest cart merge (if already authed)
});

// ─── POST /api/checkout ──────────────────────────────────────────────────────

checkout.post('/', authRequired, zValidator('json', checkoutSchema), async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const body = c.req.valid('json');
  const env = c.env;

  // 1. Resolve user cart
  const cartRecord = await getOrCreateCart(env.DB, { userId });
  const cartData = await getCartWithItems(env.DB, cartRecord.id);

  if (!cartData || cartData.items.length === 0) {
    return c.json(
      { success: false, error: { code: 'EMPTY_CART', message: 'Your cart is empty.', status: 400 } },
      400,
    );
  }

  // 2. Server-side price recalculation — NEVER trust client prices
  let subtotalPaise = 0;
  for (const item of cartData.items) {
    subtotalPaise += item.pricePaise * item.qty;
  }

  const shippingPaise = subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : STANDARD_SHIPPING_PAISE;

  // 3. Coupon validation (if provided)
  let discountPaise = 0;
  let resolvedCouponCode: string | undefined;

  if (body.couponCode) {
    const coupon = await env.DB
      .prepare(
        `SELECT * FROM coupons
         WHERE code = ?1 COLLATE NOCASE
           AND is_active = 1
           AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           AND (usage_limit IS NULL OR used_count < usage_limit)`,
      )
      .bind(body.couponCode)
      .first<{
        id: string;
        code: string;
        discount_type: 'percentage' | 'fixed_amount';
        discount_value: number;
        min_order_paise: number;
        max_discount_paise: number | null;
      }>();

    if (coupon && subtotalPaise >= coupon.min_order_paise) {
      if (coupon.discount_type === 'percentage') {
        discountPaise = Math.round(subtotalPaise * (coupon.discount_value / 100));
        if (coupon.max_discount_paise) {
          discountPaise = Math.min(discountPaise, coupon.max_discount_paise);
        }
      } else {
        discountPaise = Math.min(coupon.discount_value, subtotalPaise);
      }
      resolvedCouponCode = coupon.code;

      // Increment coupon usage
      await env.DB
        .prepare(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?1`)
        .bind(coupon.id)
        .run();
    }
  }

  const taxableAmount = subtotalPaise - discountPaise + shippingPaise;
  const taxPaise = Math.round(taxableAmount * TAX_RATE);
  const totalPaise = taxableAmount + taxPaise;

  // 4. Atomic stock hold — all items must succeed or we reject
  const holdResults: Array<{ variantId: string; qty: number; held: boolean }> = [];

  for (const item of cartData.items) {
    const held = await holdStock(env.DB, item.variantId, item.qty);
    holdResults.push({ variantId: item.variantId, qty: item.qty, held });
    if (!held) {
      // Rollback all previously held items
      const toRollback = holdResults.filter((r) => r.held);
      await Promise.all(
        toRollback.map((r) =>
          env.DB
            .prepare(
              `UPDATE product_variants
               SET reserved_stock = MAX(0, reserved_stock - ?1),
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
               WHERE id = ?2`,
            )
            .bind(r.qty, r.variantId)
            .run(),
        ),
      );
      return c.json(
        {
          success: false,
          error: {
            code: 'OUT_OF_STOCK',
            message: `"${item.title}" (${item.size}) is no longer available in the requested quantity.`,
            status: 409,
          },
        },
        409,
      );
    }
  }

  // 5. Create Cashfree order (use internal order ID as CF reference)
  const user = await env.DB
    .prepare(`SELECT full_name, phone FROM users WHERE id = ?1`)
    .bind(userId)
    .first<{ full_name: string | null; phone: string | null }>();

  // Create pending DB order first (we need the order ID)
  const order = await createOrder(env.DB, {
    userId,
    subtotalPaise,
    shippingPaise,
    discountPaise,
    taxPaise,
    totalPaise,
    cfOrderId: `cf_pending_${Date.now()}`, // placeholder until we get real CF ID
    shippingName: body.shippingName,
    shippingPhone: body.shippingPhone,
    shippingLine1: body.shippingLine1,
    shippingLine2: body.shippingLine2,
    shippingCity: body.shippingCity,
    shippingState: body.shippingState,
    shippingPincode: body.shippingPincode,
    shippingCountry: body.shippingCountry,
    couponCode: resolvedCouponCode,
    customerNotes: body.customerNotes,
  });

  // Create Cashfree order
  let cfOrderId: string;
  let paymentSessionId: string;
  try {
    const cfResult = await createCashfreeOrder(
      {
        orderId: order.id,
        orderAmount: parseFloat(paiseToRupeesFloat(totalPaise)),
        customerPhone: body.shippingPhone,
        customerEmail: userEmail,
        customerName: body.shippingName,
        returnUrl: `${env.FRONTEND_URL}/checkout/confirmation/${order.id}`,
        notifyUrl: `${env.BACKEND_URL}/api/payments/webhook`,
      },
      env.CASHFREE_APP_ID,
      env.CASHFREE_SECRET_KEY,
      env.CASHFREE_API_URL,
      env.CASHFREE_API_VERSION,
    );
    cfOrderId = cfResult.cfOrderId;
    paymentSessionId = cfResult.paymentSessionId;
  } catch (err) {
    // Rollback all stock holds on CF failure
    await Promise.all(
      cartData.items.map((item) =>
        env.DB
          .prepare(
            `UPDATE product_variants
             SET reserved_stock = MAX(0, reserved_stock - ?1),
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?2`,
          )
          .bind(item.qty, item.variantId)
          .run(),
      ),
    );
    throw err;
  }

  // Update order with real CF order ID
  await env.DB
    .prepare(`UPDATE orders SET cf_order_id = ?1, updated_at = ?2 WHERE id = ?3`)
    .bind(cfOrderId, new Date().toISOString(), order.id)
    .run();

  // 6. Create order items (snapshot of product data at time of purchase)
  await createOrderItems(
    env.DB,
    cartData.items.map((item) => ({
      orderId: order.id,
      variantId: item.variantId,
      productId: item.productId,
      titleSnapshot: item.title,
      skuSnapshot: item.variantId, // variant ID serves as SKU reference
      sizeSnapshot: item.size,
      colorSnapshot: item.color,
      imageSnapshot: item.img,
      unitPricePaise: item.pricePaise,
      quantity: item.qty,
    })),
  );

  // 7. Clear the user's cart
  await clearCart(env.DB, cartRecord.id);

  const response: ApiCheckoutResponse = {
    orderId: order.id,
    orderNumber: order.order_number,
    totalPaise,
    cfOrderId,
    paymentSessionId,
  };

  return c.json({ success: true, data: response }, 201);
});

export default checkout;

