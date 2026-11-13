import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiCheckoutResponse } from '../types/api.js';
import { authRequired } from '../middleware/auth.js';
import { getOrCreateCart, getCartWithItems, clearCart, mergeGuestCart } from '../db/queries/cart.js';
import { createOrder, createOrderItems } from '../db/queries/orders.js';
import { holdStock } from '../services/stockEngine.js';
import { createRazorpayOrder } from '../services/razorpay.js';
import { formatPaiseToDisplay } from '../services/money.js';
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

  // 1. Merge guest cart from session if present, then resolve user cart
  const sessionId = c.req.header('x-session-id') || body.sessionId;
  if (sessionId) {
    try {
      await mergeGuestCart(env.DB, sessionId, userId);
    } catch {
      // Cart merge non-fatal
    }
  }

  const cartRecord = await getOrCreateCart(env.DB, { userId });
  const cartData = await getCartWithItems(env.DB, cartRecord.id);

  if (!cartData || cartData.items.length === 0) {
    return c.json(
      { success: false, error: { code: 'EMPTY_CART', message: 'Your cart is empty. Please add garments before checking out.', status: 400 } },
      400,
    );
  }

  // 2. Server-side price recalculation — NEVER trust client prices
  let subtotalPaise = 0;
  for (const item of cartData.items) {
    subtotalPaise += item.pricePaise * item.qty;
  }

  // Luxury shipping is complimentary across all orders
  const shippingPaise = 0;

  // 3. Coupon validation (if provided) — Atomic update to prevent race conditions
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
      // Atomic increment with condition to guarantee concurrency safety
      const couponUsageResult = await env.DB
        .prepare(
          `UPDATE coupons
           SET used_count = used_count + 1
           WHERE id = ?1
             AND (usage_limit IS NULL OR used_count < usage_limit)`,
        )
        .bind(coupon.id)
        .run();

      if ((couponUsageResult.meta.changes ?? 0) > 0) {
        if (coupon.discount_type === 'percentage') {
          discountPaise = Math.round(subtotalPaise * (coupon.discount_value / 100));
          if (coupon.max_discount_paise) {
            discountPaise = Math.min(discountPaise, coupon.max_discount_paise);
          }
        } else {
          discountPaise = Math.min(coupon.discount_value, subtotalPaise);
        }
        resolvedCouponCode = coupon.code;
      }
    }
  }

  // Retail luxury pricing: GST is inclusive in MRP, express shipping is complimentary
  const totalPayablePaise = Math.max(0, subtotalPaise - discountPaise);
  const taxPaise = Math.round(totalPayablePaise * (TAX_RATE / (1 + TAX_RATE)));
  const totalPaise = totalPayablePaise;

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

  // 5. Create Razorpay order (use internal order ID as receipt reference)
  // Create pending DB order first (we need the order ID for the Razorpay receipt)
  const order = await createOrder(env.DB, {
    userId,
    subtotalPaise,
    shippingPaise,
    discountPaise,
    taxPaise,
    totalPaise,
    cfOrderId: `rzp_pending_${Date.now()}`, // placeholder until we get real Razorpay order ID
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

  // Check if Razorpay keys are configured
  const isRazorpayConfigured = Boolean(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    !env.RAZORPAY_KEY_ID.includes('placeholder') &&
    env.RAZORPAY_KEY_SECRET.length > 5
  );

  let razorpayOrderId: string | undefined;
  let razorpayAmount: number | undefined;

  if (isRazorpayConfigured) {
    try {
      const rzpResult = await createRazorpayOrder(
        {
          orderId: order.id,
          orderNumber: order.order_number,
          amountPaise: totalPaise,
          customerName: body.shippingName,
          customerEmail: userEmail || '',
          customerPhone: body.shippingPhone,
        },
        env.RAZORPAY_KEY_ID,
        env.RAZORPAY_KEY_SECRET,
      );
      razorpayOrderId = rzpResult.razorpayOrderId;
      razorpayAmount = rzpResult.amount;

      await env.DB
        .prepare(`UPDATE orders SET cf_order_id = ?1, updated_at = ?2 WHERE id = ?3`)
        .bind(razorpayOrderId, new Date().toISOString(), order.id)
        .run();
    } catch (err) {
      // Rollback all stock holds on Razorpay failure
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
  } else {
    // Sandbox / Test mode: direct confirmation
    await env.DB
      .prepare(`UPDATE orders SET cf_order_id = ?1, status = 'confirmed', payment_status = 'test_confirmed', updated_at = ?2 WHERE id = ?3`)
      .bind(`test_order_${Date.now()}`, new Date().toISOString(), order.id)
      .run();
  }

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

  // Return response for frontend checkout modal / confirmation
  const response: ApiCheckoutResponse = {
    orderId: order.id,
    orderNumber: order.order_number,
    totalPaise,
    totalFormatted: formatPaiseToDisplay(totalPaise),
    razorpayOrderId: isRazorpayConfigured ? razorpayOrderId : undefined,
    razorpayKeyId: isRazorpayConfigured ? env.RAZORPAY_KEY_ID : undefined,
    amount: isRazorpayConfigured ? razorpayAmount : totalPaise,
  };

  return c.json({ success: true, data: response }, 201);
});

export default checkout;
