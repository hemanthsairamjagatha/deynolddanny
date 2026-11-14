import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiCheckoutResponse } from '../types/api.js';
import { authRequired } from '../middleware/auth.js';
import { getOrCreateCart, getCartWithItems, addCartItem, clearCart, mergeGuestCart } from '../db/queries/cart.js';
import { createOrder, createOrderItems } from '../db/queries/orders.js';
import { holdStock } from '../services/stockEngine.js';
import { createRazorpayOrder } from '../services/razorpay.js';
import { createCashfreeOrder } from '../services/cashfree.js';
import { formatPaiseToDisplay, paiseToRupeesFloat } from '../services/money.js';
import {
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_PAISE,
  TAX_RATE,
} from '../config/constants.js';

const checkout = new Hono<{ Bindings: Env }>();

// ─── Schema ─────────────────────────────────────────────────────────────────

const checkoutItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

const checkoutSchema = z.object({
  shippingAddressId: z.string().optional(),
  // Manual address fields (used when shippingAddressId not provided)
  shippingName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  shippingPhone: z
    .string()
    .transform((val) => {
      let digits = val.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      return digits;
    })
    .refine((val) => /^[6-9]\d{9}$/.test(val), {
      message: 'Invalid Indian mobile number. Please provide a 10-digit mobile number.',
    }),
  shippingLine1: z.string().min(3, 'Address line must be at least 3 characters').max(200),
  shippingLine2: z.string().max(200).optional(),
  shippingCity: z.string().min(2, 'City is required').max(100),
  shippingState: z.string().min(2, 'State is required').max(100),
  shippingPincode: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => /^\d{6}$/.test(val), {
      message: 'Pincode must be 6 digits',
    }),
  shippingCountry: z.string().default('India'),
  couponCode: z.string().max(50).optional(),
  customerNotes: z.string().max(500).optional(),
  sessionId: z.string().optional(), // for guest cart merge (if already authed)
  items: z.array(checkoutItemSchema).optional(),
});

// ─── POST /api/checkout ──────────────────────────────────────────────────────

checkout.post(
  '/',
  authRequired,
  zValidator('json', checkoutSchema, (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const message = firstIssue?.message || 'Invalid checkout information provided.';
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message,
            status: 400,
            details: result.error.issues,
          },
        },
        400,
      );
    }
  }),
  async (c) => {
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
    let cartData = await getCartWithItems(env.DB, cartRecord.id);

    // If D1 cart is empty but client passed wardrobe items, populate D1 cart automatically
    if ((!cartData || cartData.items.length === 0) && body.items && body.items.length > 0) {
      for (const item of body.items) {
        try {
          let resolvedVariantId = item.variantId;
          const directMatch = await env.DB
            .prepare(`SELECT id FROM product_variants WHERE id = ?1 AND is_active = 1`)
            .bind(resolvedVariantId)
            .first<{ id: string }>();

          if (!directMatch) {
            const parts = item.variantId.split('-');
            const potentialProductId = parts.slice(0, 2).join('-');
            const fallback = await env.DB
              .prepare(
                `SELECT pv.id FROM product_variants pv
                 JOIN products p ON p.id = pv.product_id
                 WHERE pv.is_active = 1
                   AND (pv.id LIKE ?1 OR p.id = ?2 OR p.slug LIKE ?3)
                 ORDER BY pv.sort_order ASC LIMIT 1`,
              )
              .bind(`%${item.variantId}%`, potentialProductId, `%${parts[0]}%`)
              .first<{ id: string }>();
            if (fallback) {
              resolvedVariantId = fallback.id;
            }
          }

          if (resolvedVariantId) {
            await addCartItem(env.DB, cartRecord.id, resolvedVariantId, item.quantity);
          }
        } catch (err) {
          console.warn('Failed to sync item to cart during checkout:', item.variantId, err);
        }
      }
      cartData = await getCartWithItems(env.DB, cartRecord.id);
    }

    if (!cartData || cartData.items.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'EMPTY_CART',
            message: 'Your wardrobe selection is empty. Please add garments before checking out.',
            status: 400,
          },
        },
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

  // Check gateway configuration:
  // 1. Razorpay (Primary if keys configured)
  const isRazorpayConfigured = Boolean(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    !env.RAZORPAY_KEY_ID.includes('placeholder') &&
    env.RAZORPAY_KEY_SECRET.length > 5
  );

  // 2. Cashfree (Active if keys configured)
  const isCashfreeConfigured = Boolean(
    env.CASHFREE_APP_ID &&
    env.CASHFREE_SECRET_KEY &&
    !env.CASHFREE_APP_ID.includes('placeholder') &&
    env.CASHFREE_SECRET_KEY.length > 5
  );

  let razorpayOrderId: string | undefined;
  let razorpayAmount: number | undefined;
  let cashfreeOrderId: string | undefined;
  let paymentSessionId: string | undefined;
  let activeGateway: 'razorpay' | 'cashfree' | 'test' = 'test';
  const now = new Date().toISOString();

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
      activeGateway = 'razorpay';

      await env.DB
        .prepare(`UPDATE orders SET cf_order_id = ?1, updated_at = ?2 WHERE id = ?3`)
        .bind(razorpayOrderId, now, order.id)
        .run();
    } catch (rzpErr) {
      console.warn('Razorpay order creation error, falling back:', rzpErr);
    }
  }

  // If Razorpay not configured or threw error, try Cashfree
  if (activeGateway === 'test' && isCashfreeConfigured) {
    try {
      const cfResult = await createCashfreeOrder(
        {
          orderId: order.order_number,
          orderAmount: parseFloat(paiseToRupeesFloat(totalPaise)),
          customerPhone: body.shippingPhone,
          customerEmail: userEmail || 'concierge@deynolddanny.com',
          customerName: body.shippingName,
          returnUrl: `${env.FRONTEND_URL}/checkout/confirmation/${order.id}`,
          notifyUrl: `${env.BACKEND_URL}/api/payments/webhook`,
        },
        env.CASHFREE_APP_ID!,
        env.CASHFREE_SECRET_KEY!,
        env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg',
        env.CASHFREE_API_VERSION || '2023-08-01',
      );
      cashfreeOrderId = cfResult.cfOrderId;
      paymentSessionId = cfResult.paymentSessionId;
      activeGateway = 'cashfree';

      await env.DB
        .prepare(`UPDATE orders SET cf_order_id = ?1, updated_at = ?2 WHERE id = ?3`)
        .bind(cashfreeOrderId, now, order.id)
        .run();
    } catch (cfErr) {
      console.warn('Cashfree order creation error, falling back to concierge confirmation:', cfErr);
    }
  }

  // If neither online gateway initialized (sandbox / fallback / test):
  if (activeGateway === 'test') {
    await env.DB
      .prepare(`UPDATE orders SET cf_order_id = ?1, status = 'confirmed', payment_status = 'paid', paid_at = ?2, updated_at = ?3 WHERE id = ?4`)
      .bind(`test_order_${Date.now()}`, now, now, order.id)
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
      colorSnapshot: item.color || 'Default',
      imageSnapshot: item.img || '/logo.png',
      unitPricePaise: Math.max(1, item.pricePaise),
      quantity: Math.max(1, item.qty),
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
    gateway: activeGateway,
    razorpayOrderId: activeGateway === 'razorpay' ? razorpayOrderId : undefined,
    razorpayKeyId: activeGateway === 'razorpay' ? env.RAZORPAY_KEY_ID : undefined,
    amount: activeGateway === 'razorpay' && razorpayAmount ? razorpayAmount : totalPaise,
    cfOrderId: activeGateway === 'cashfree' ? cashfreeOrderId : undefined,
    paymentSessionId: activeGateway === 'cashfree' ? paymentSessionId : undefined,
    cashfreeEnvironment: env.CASHFREE_API_URL?.includes('sandbox') ? 'sandbox' : 'production',
  };

  return c.json({ success: true, data: response }, 201);
});

export default checkout;
