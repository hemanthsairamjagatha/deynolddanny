import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiCheckoutResponse } from '../types/api.js';
import { resolveStorePolicy } from '../config/policy.js';
import { STOCK_RESERVATION_MINUTES } from '../config/constants.js';
import { authRequired } from '../middleware/auth.js';
import {
  getOrCreateCart,
  getCartWithItems,
  addCartItem,
  mergeGuestCart,
} from '../db/queries/cart.js';
import {
  createOrderWithItems,
  getOrderById,
  type CreateOrderItemInput,
} from '../db/queries/orders.js';
import { nowIso, runBatch } from '../db/client.js';
import { generateId } from '../services/crypto.js';
import { atomicHoldAllOrRollback, recordInventoryMovements } from '../services/stockEngine.js';
import { releaseOrderHoldOnFailure, appendOrderAuditLog } from '../services/orderLifecycle.js';
import { createRazorpayOrder } from '../services/razorpay.js';
import { createCashfreeOrder } from '../services/cashfree.js';
import { formatPaiseToDisplay, paiseToRupeesFloat } from '../services/money.js';

const checkout = new Hono<{ Bindings: Env }>();

const checkoutItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

const checkoutSchema = z.object({
  shippingAddressId: z.string().optional(),
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
  sessionId: z.string().optional(),
  clientExpectedTotalPaise: z.number().int().nonnegative().optional(),
  items: z.array(checkoutItemSchema).optional(),
});

checkout.post(
  '/',
  authRequired,
  zValidator('json', checkoutSchema, (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: firstIssue?.message || 'Invalid checkout information provided.',
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
    const policy = resolveStorePolicy(env);
    const idempotencyKey = c.req.header('Idempotency-Key')?.trim() || null;

    // 0. Idempotency check: return existing pending order & active attempt if key matches
    if (idempotencyKey) {
      const existingOrder = await env.DB
        .prepare(`SELECT * FROM orders WHERE idempotency_key = ?1 AND user_id = ?2 LIMIT 1`)
        .bind(idempotencyKey, userId)
        .first<any>();

      if (existingOrder) {
        const latestAttempt = await env.DB
          .prepare(
            `SELECT * FROM payment_attempts WHERE order_id = ?1 ORDER BY attempt_number DESC LIMIT 1`,
          )
          .bind(existingOrder.id)
          .first<any>();

        const response: ApiCheckoutResponse = {
          orderId: existingOrder.id,
          orderNumber: existingOrder.order_number,
          totalPaise: existingOrder.total_paise,
          totalFormatted: formatPaiseToDisplay(existingOrder.total_paise),
          gateway: latestAttempt?.gateway ?? 'razorpay',
          razorpayOrderId:
            latestAttempt?.gateway === 'razorpay' ? latestAttempt.gateway_order_id : undefined,
          razorpayKeyId: latestAttempt?.gateway === 'razorpay' ? env.RAZORPAY_KEY_ID : undefined,
          amount: existingOrder.total_paise,
          cfOrderId:
            latestAttempt?.gateway === 'cashfree' ? latestAttempt.gateway_order_id : undefined,
          cashfreeEnvironment: env.CASHFREE_API_URL?.includes('sandbox') ? 'sandbox' : 'production',
        };
        return c.json({ success: true, data: response }, 200);
      }
    }

    // 1. Merge guest cart if x-session-id belongs to an anonymous guest cart
    const sessionId = c.req.header('x-session-id') || body.sessionId;
    if (sessionId && /^sess_[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
      try {
        await mergeGuestCart(env.DB, sessionId, userId);
      } catch {
        // Non-fatal
      }
    }

    const cartRecord = await getOrCreateCart(env.DB, { userId });
    let cartData = await getCartWithItems(env.DB, cartRecord.id);

    // Sync exact client variant IDs into D1 cart if client submitted items cleanly
    if ((!cartData || cartData.items.length === 0) && body.items && body.items.length > 0) {
      for (const item of body.items) {
        const directMatch = await env.DB
          .prepare(`SELECT id FROM product_variants WHERE id = ?1 AND is_active = 1`)
          .bind(item.variantId)
          .first<{ id: string }>();

        if (!directMatch) {
          return c.json(
            {
              success: false,
              error: {
                code: 'INVALID_VARIANT',
                message: `Selected garment variant "${item.variantId}" is unavailable or discontinued.`,
                status: 400,
              },
            },
            400,
          );
        }
        await addCartItem(env.DB, cartRecord.id, directMatch.id, item.quantity);
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

    // 2. Fetch authoritative variant/product catalog rows directly from DB (never trust client price)
    const variantMetaMap = new Map<
      string,
      { sku: string; hsnCode: string | null; gstRateBps: number }
    >();
    for (const item of cartData.items) {
      const row = await env.DB
        .prepare(
          `SELECT pv.sku, p.hsn_code, p.gst_rate_bps
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.id = ?1`,
        )
        .bind(item.variantId)
        .first<{ sku: string; hsn_code: string | null; gst_rate_bps: number | null }>();

      variantMetaMap.set(item.variantId, {
        sku: row?.sku || item.variantId,
        hsnCode: row?.hsn_code ?? null,
        gstRateBps: row?.gst_rate_bps ?? policy.defaultGstRateBps,
      });
    }

    const subtotalPaise = cartData.items.reduce(
      (sum, item) => sum + item.pricePaise * item.qty,
      0,
    );

    const shippingPaise =
      subtotalPaise >= policy.freeShippingThresholdPaise ? 0 : policy.standardShippingPaise;

    // 3. Validate coupon eligibility & per-user limit WITHOUT mutating counts before stock hold
    let discountPaise = 0;
    let resolvedCoupon: { id: string; code: string } | null = null;

    if (body.couponCode) {
      const coupon = await env.DB
        .prepare(
          `SELECT * FROM coupons
           WHERE code = ?1 COLLATE NOCASE
             AND is_active = 1
             AND (expires_at IS NULL OR expires_at > ?2)
             AND (usage_limit IS NULL OR used_count < usage_limit)`,
        )
        .bind(body.couponCode.trim(), nowIso())
        .first<{
          id: string;
          code: string;
          discount_type: 'percentage' | 'fixed_amount';
          discount_value: number;
          min_order_paise: number;
          max_discount_paise: number | null;
        }>();

      if (!coupon || subtotalPaise < coupon.min_order_paise) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_COUPON',
              message: !coupon
                ? 'Promotional code is invalid or expired.'
                : `Minimum order value of ${formatPaiseToDisplay(coupon.min_order_paise)} required for this coupon.`,
              status: 400,
            },
          },
          400,
        );
      }

      if (policy.singleUseCouponsPerUser) {
        const priorUse = await env.DB
          .prepare(
            `SELECT 1 FROM coupon_redemptions
             WHERE coupon_id = ?1 AND user_id = ?2 AND status IN ('held', 'applied')
             LIMIT 1`,
          )
          .bind(coupon.id, userId)
          .first();

        if (priorUse) {
          return c.json(
            {
              success: false,
              error: {
                code: 'COUPON_ALREADY_USED',
                message: 'This promotional code has already been used on your account.',
                status: 400,
              },
            },
            400,
          );
        }
      }

      if (coupon.discount_type === 'percentage') {
        const cappedPct = Math.min(100, Math.max(0, coupon.discount_value));
        discountPaise = Math.round(subtotalPaise * (cappedPct / 100));
        if (coupon.max_discount_paise) {
          discountPaise = Math.min(discountPaise, coupon.max_discount_paise);
        }
      } else {
        discountPaise = Math.min(coupon.discount_value, subtotalPaise);
      }
      resolvedCoupon = { id: coupon.id, code: coupon.code };
    }

    // 4. Pro-rata line-item allocation for discounts & configurable tax computation
    const postDiscountTotalPaise = Math.max(0, subtotalPaise - discountPaise);
    let distributedDiscount = 0;
    let totalTaxPaise = 0;

    const lineItemInputs: Array<Omit<CreateOrderItemInput, 'orderId'>> = cartData.items.map(
      (item, idx) => {
        const grossLine = item.pricePaise * item.qty;
        const lineDiscount =
          idx === cartData.items.length - 1
            ? Math.max(0, discountPaise - distributedDiscount)
            : subtotalPaise > 0
              ? Math.round((grossLine / subtotalPaise) * discountPaise)
              : 0;
        distributedDiscount += lineDiscount;

        const netLine = Math.max(0, grossLine - lineDiscount);
        const meta = variantMetaMap.get(item.variantId)!;
        const rate = meta.gstRateBps / 10_000;
        const lineTax = policy.taxInclusive
          ? Math.round(netLine * (rate / (1 + rate)))
          : Math.round(netLine * rate);
        const lineTaxable = policy.taxInclusive ? netLine - lineTax : netLine;
        totalTaxPaise += lineTax;

        return {
          variantId: item.variantId,
          productId: item.productId,
          titleSnapshot: item.title,
          skuSnapshot: meta.sku,
          sizeSnapshot: item.size,
          colorSnapshot: item.color || 'Default',
          imageSnapshot: item.img || '/logo.png',
          unitPricePaise: Math.max(1, item.pricePaise),
          quantity: Math.max(1, item.qty),
          discountPaise: lineDiscount,
          taxablePaise: lineTaxable,
          taxPaise: lineTax,
          hsnCode: meta.hsnCode,
          gstRateBps: meta.gstRateBps,
        };
      },
    );

    const totalPaise = policy.taxInclusive
      ? postDiscountTotalPaise + shippingPaise
      : postDiscountTotalPaise + totalTaxPaise + shippingPaise;

    if (
      body.clientExpectedTotalPaise !== undefined &&
      body.clientExpectedTotalPaise !== totalPaise
    ) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PRICE_CHANGED',
            message: 'Bag total changed based on latest catalog or discount rules. Please review your summary before paying.',
            status: 409,
          },
        },
        409,
      );
    }

    // 5. Verify gateway availability BEFORE mutating inventory if in production/staging
    const isRazorpayConfigured = Boolean(
      env.RAZORPAY_KEY_ID &&
      env.RAZORPAY_KEY_SECRET &&
      !env.RAZORPAY_KEY_ID.includes('placeholder') &&
      env.RAZORPAY_KEY_SECRET.length > 5,
    );
    const isCashfreeConfigured = Boolean(
      env.CASHFREE_APP_ID &&
      env.CASHFREE_SECRET_KEY &&
      !env.CASHFREE_APP_ID.includes('placeholder') &&
      env.CASHFREE_SECRET_KEY.length > 5,
    );

    if (!isRazorpayConfigured && !isCashfreeConfigured && !policy.allowTestCheckoutFallback) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_GATEWAY_UNAVAILABLE',
            message: 'Secure payment processing is temporarily unavailable. Please try again shortly or contact client concierge.',
            status: 503,
          },
        },
        503,
      );
    }

    // 6. Atomic all-or-nothing stock hold across ALL cart items
    const stockHoldResult = await atomicHoldAllOrRollback(
      env.DB,
      cartData.items.map((it) => ({ variantId: it.variantId, quantity: it.qty })),
    );

    if (!stockHoldResult.success) {
      const failedItem = cartData.items[stockHoldResult.failedIndex] ?? cartData.items[0];
      return c.json(
        {
          success: false,
          error: {
            code: 'OUT_OF_STOCK',
            message: `"${failedItem.title}" (${failedItem.size}) is no longer available in the requested quantity.`,
            status: 409,
          },
        },
        409,
      );
    }

    // 7. Create order & order_items BEFORE calling external gateway (eliminates F-MISS-002 missing items)
    let order;
    try {
      order = await createOrderWithItems(
        env.DB,
        {
          userId,
          subtotalPaise,
          shippingPaise,
          discountPaise,
          taxPaise: totalTaxPaise,
          totalPaise,
          idempotencyKey,
          shippingName: body.shippingName,
          shippingPhone: body.shippingPhone,
          shippingLine1: body.shippingLine1,
          shippingLine2: body.shippingLine2,
          shippingCity: body.shippingCity,
          shippingState: body.shippingState,
          shippingPincode: body.shippingPincode,
          shippingCountry: body.shippingCountry,
          couponCode: resolvedCoupon?.code,
          customerNotes: body.customerNotes,
        },
        lineItemInputs,
      );
    } catch (err) {
      // Compensate held stock on DB write error
      await atomicHoldAllOrRollback(env.DB, []);
      for (const item of cartData.items) {
        await env.DB
          .prepare(`UPDATE product_variants SET reserved_stock = MAX(0, reserved_stock - ?1) WHERE id = ?2`)
          .bind(item.qty, item.variantId)
          .run();
      }
      throw err;
    }

    await recordInventoryMovements(
      env.DB,
      cartData.items.map((it) => ({
        variantId: it.variantId,
        orderId: order.id,
        movementType: 'hold',
        qtyDelta: it.qty,
        actorId: userId,
        notes: `Checkout hold (${STOCK_RESERVATION_MINUTES}m) for ${order.order_number}`,
      })),
    );

    // 8. Atomically commit coupon hold (rolling back order+stock if coupon exhausted concurrently)
    if (resolvedCoupon) {
      const couponInc = await env.DB
        .prepare(
          `UPDATE coupons
           SET used_count = used_count + 1
           WHERE id = ?1 AND (usage_limit IS NULL OR used_count < usage_limit)`,
        )
        .bind(resolvedCoupon.id)
        .run();

      if ((couponInc.meta.changes ?? 0) === 0) {
        await releaseOrderHoldOnFailure(
          env.DB,
          order.id,
          'cancelled',
          null,
          'Coupon usage limit exhausted during checkout',
          userId,
        );
        return c.json(
          {
            success: false,
            error: {
              code: 'COUPON_EXHAUSTED',
              message: 'This promotional code has reached its redemption limit.',
              status: 409,
            },
          },
          409,
        );
      }

      await env.DB
        .prepare(
          `INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id, discount_paise, status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'held', ?6)`,
        )
        .bind(generateId('crd_'), resolvedCoupon.id, userId, order.id, discountPaise, nowIso())
        .run();
    }

    // 9. Call external payment gateway (8s timeout) & record payment_attempt
    let razorpayOrderId: string | undefined;
    let cashfreeOrderId: string | undefined;
    let paymentSessionId: string | undefined;
    let activeGateway: 'razorpay' | 'cashfree' | 'test' = 'razorpay';
    const now = nowIso();

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
        activeGateway = 'razorpay';
      } catch (err) {
        console.error('Razorpay order creation failed:', err);
        razorpayOrderId = undefined;
      }
    }

    if (!razorpayOrderId && isCashfreeConfigured) {
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
      } catch (err) {
        console.error('Cashfree order creation failed:', err);
        cashfreeOrderId = undefined;
      }
    }

    const gatewayOrderId = razorpayOrderId || cashfreeOrderId;
    if (!gatewayOrderId) {
      if (policy.allowTestCheckoutFallback) {
        activeGateway = 'test';
        const testGwId = `test_order_${order.id}`;
        await runBatch(env.DB, [
          env.DB
            .prepare(`UPDATE orders SET cf_order_id = ?1, updated_at = ?2 WHERE id = ?3`)
            .bind(testGwId, now, order.id),
          env.DB
            .prepare(
              `INSERT INTO payment_attempts (id, order_id, attempt_number, gateway, gateway_order_id, amount_paise, currency, status, created_at, updated_at)
               VALUES (?1, ?2, 1, 'test', ?3, ?4, 'INR', 'created', ?5, ?5)`,
            )
            .bind(generateId('att_'), order.id, testGwId, totalPaise, now),
        ]);
      } else {
        await releaseOrderHoldOnFailure(
          env.DB,
          order.id,
          'failed',
          null,
          'Payment gateway order initialization failed or timed out',
          'checkout',
        );
        return c.json(
          {
            success: false,
            error: {
              code: 'PAYMENT_GATEWAY_ERROR',
              message: 'Unable to initialize payment gateway session. No amount was charged and stock was released.',
              status: 502,
            },
          },
          502,
        );
      }
    } else {
      await runBatch(env.DB, [
        env.DB
          .prepare(`UPDATE orders SET cf_order_id = ?1, updated_at = ?2 WHERE id = ?3`)
          .bind(gatewayOrderId, now, order.id),
        env.DB
          .prepare(
            `INSERT INTO payment_attempts (id, order_id, attempt_number, gateway, gateway_order_id, amount_paise, currency, status, created_at, updated_at)
             VALUES (?1, ?2, 1, ?3, ?4, ?5, 'INR', 'created', ?6, ?6)`,
          )
          .bind(generateId('att_'), order.id, activeGateway, gatewayOrderId, totalPaise, now),
      ]);
      await appendOrderAuditLog(
        env.DB,
        order.id,
        'checkout_initialized',
        `Created ${activeGateway} session ${gatewayOrderId} for ${formatPaiseToDisplay(totalPaise)}`,
        userId,
      );
    }

    const freshOrder = (await getOrderById(env.DB, order.id)) ?? order;
    const response: ApiCheckoutResponse = {
      orderId: freshOrder.id,
      orderNumber: freshOrder.order_number,
      totalPaise: freshOrder.total_paise,
      totalFormatted: formatPaiseToDisplay(freshOrder.total_paise),
      gateway: activeGateway,
      razorpayOrderId: activeGateway === 'razorpay' ? razorpayOrderId : undefined,
      razorpayKeyId: activeGateway === 'razorpay' ? env.RAZORPAY_KEY_ID : undefined,
      amount: freshOrder.total_paise,
      currency: 'INR',
      cfOrderId: activeGateway === 'cashfree' ? cashfreeOrderId : undefined,
      paymentSessionId: activeGateway === 'cashfree' ? paymentSessionId : undefined,
      cashfreeEnvironment: env.CASHFREE_API_URL?.includes('sandbox') ? 'sandbox' : 'production',
    };

    return c.json({ success: true, data: response }, 201);
  },
);

export default checkout;
