import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { formatPaiseToDisplay } from '../services/money.js';
import { checkD1RateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';

import { nowIso } from '../db/client.js';

const coupons = new Hono<{ Bindings: Env }>();

const validateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  cartSubtotalPaise: z.number().int().min(1),
});

coupons.post('/validate', zValidator('json', validateCouponSchema), async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown';
  const rl = await checkD1RateLimit(c.env.DB, `coupon_validate:${ip}`, 20, 60);
  if (!rl.allowed) {
    return c.json(createRateLimitResponse('Too many promotional code checks. Please wait a minute.'), 429);
  }

  const { code, cartSubtotalPaise } = c.req.valid('json');

  const coupon = await c.env.DB
    .prepare(
      `SELECT id, code, discount_type, discount_value,
              min_order_paise, max_discount_paise,
              usage_limit, used_count, is_active, expires_at
       FROM coupons
       WHERE code = ?1 COLLATE NOCASE
         AND is_active = 1
         AND (expires_at IS NULL OR expires_at > ?2)
         AND (usage_limit IS NULL OR used_count < usage_limit)`,
    )
    .bind(code.trim(), nowIso())
    .first<{
      id: string;
      code: string;
      discount_type: 'percentage' | 'fixed_amount';
      discount_value: number;
      min_order_paise: number;
      max_discount_paise: number | null;
      usage_limit: number | null;
      used_count: number;
      is_active: number;
      expires_at: string | null;
    }>();

  if (!coupon) {
    return c.json({
      success: true,
      data: {
        valid: false,
        error: 'This coupon code is invalid or has expired.',
      },
    });
  }

  if (cartSubtotalPaise < coupon.min_order_paise) {
    return c.json({
      success: true,
      data: {
        valid: false,
        error: `Minimum order value of ${formatPaiseToDisplay(coupon.min_order_paise)} required for this coupon.`,
        minOrderPaise: coupon.min_order_paise,
        minOrderFormatted: formatPaiseToDisplay(coupon.min_order_paise),
      },
    });
  }

  // Calculate discount — read-only, no DB write
  let discountPaise = 0;
  if (coupon.discount_type === 'percentage') {
    const cappedPct = Math.min(100, Math.max(0, coupon.discount_value));
    discountPaise = Math.round(cartSubtotalPaise * (cappedPct / 100));
    if (coupon.max_discount_paise) {
      discountPaise = Math.min(discountPaise, coupon.max_discount_paise);
    }
  } else {
    discountPaise = Math.min(coupon.discount_value, cartSubtotalPaise);
  }

  return c.json({
    success: true,
    data: {
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountPaise,
      discountFormatted: formatPaiseToDisplay(discountPaise),
      maxDiscountPaise: coupon.max_discount_paise,
      usageLimit: coupon.usage_limit,
      usedCount: coupon.used_count,
      expiresAt: coupon.expires_at,
    },
  });
});

export default coupons;

