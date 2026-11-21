import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import type { DbCoupon } from '../../types/models.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';
import { requirePermission } from '../../middleware/adminAuth.js';

const adminCoupons = new Hono<{ Bindings: Env }>();

const couponBaseSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, 'Coupon code must be alphanumeric with - or _'),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().int().positive(),
  minOrderPaise: z.number().int().min(0).default(0),
  maxDiscountPaise: z.number().int().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

const createCouponSchema = couponBaseSchema.refine(
  (data) => !(data.discountType === 'percentage' && data.discountValue > 100),
  { message: 'Percentage discount cannot exceed 100%', path: ['discountValue'] },
);

async function logCouponAction(
  db: D1Database,
  adminId: string,
  action: string,
  couponId: string,
  meta: Record<string, unknown>,
  ip: string | null,
) {
  await db
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, ?3, 'coupon', ?4, ?5, ?6, ?7)`,
    )
    .bind(generateId('log_'), adminId, action, couponId, JSON.stringify(meta), ip, nowIso())
    .run();
}

adminCoupons.get('/', requirePermission('coupons.read'), async (c) => {
  const result = await c.env.DB
    .prepare(`SELECT * FROM coupons ORDER BY created_at DESC`)
    .all<DbCoupon>();
  const items = result.results ?? [];
  return c.json({ success: true, data: { items, coupons: items } });
});

adminCoupons.get('/:id', requirePermission('coupons.read'), async (c) => {
  const id = c.req.param('id');
  const coupon = await c.env.DB.prepare(`SELECT * FROM coupons WHERE id = ?1 LIMIT 1`).bind(id).first<DbCoupon>();
  if (!coupon) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found.', status: 404 } }, 404);
  }
  return c.json({ success: true, data: coupon });
});

adminCoupons.post('/', requirePermission('coupons.write'), zValidator('json', createCouponSchema), async (c) => {
  const body = c.req.valid('json');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const id = generateId('cpn_');
  const now = nowIso();

  const existing = await c.env.DB
    .prepare(`SELECT id FROM coupons WHERE code = ?1 COLLATE NOCASE`)
    .bind(body.code)
    .first<{ id: string }>();

  if (existing) {
    return c.json(
      { success: false, error: { code: 'CONFLICT', message: 'Coupon code already exists.', status: 409 } },
      409,
    );
  }

  await c.env.DB
    .prepare(
      `INSERT INTO coupons (
         id, code, discount_type, discount_value, min_order_paise,
         max_discount_paise, usage_limit, used_count, is_active, expires_at, created_at
       ) VALUES (?1,?2,?3,?4,?5,?6,?7,0,?8,?9,?10)`,
    )
    .bind(
      id,
      body.code,
      body.discountType,
      body.discountValue,
      body.minOrderPaise,
      body.maxDiscountPaise ?? null,
      body.usageLimit ?? null,
      body.isActive ? 1 : 0,
      body.expiresAt ?? null,
      now,
    )
    .run();

  await logCouponAction(c.env.DB, adminId, 'CREATE_COUPON', id, body, ip);

  const coupon = await c.env.DB.prepare(`SELECT * FROM coupons WHERE id = ?1`).bind(id).first<DbCoupon>();
  return c.json({ success: true, data: coupon }, 201);
});

adminCoupons.patch('/:id', requirePermission('coupons.write'), zValidator('json', couponBaseSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  const body = c.req.valid('json');

  const existing = await c.env.DB
    .prepare(`SELECT id, discount_type FROM coupons WHERE id = ?1`)
    .bind(id)
    .first<{ id: string; discount_type: string }>();

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found.', status: 404 } },
      404,
    );
  }

  const effectiveType = body.discountType ?? existing.discount_type;
  if (effectiveType === 'percentage' && body.discountValue !== undefined && body.discountValue > 100) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Percentage discount cannot exceed 100%', status: 400 },
      },
      400,
    );
  }

  const fieldMap: Record<string, string> = {
    discountType: 'discount_type',
    discountValue: 'discount_value',
    minOrderPaise: 'min_order_paise',
    maxDiscountPaise: 'max_discount_paise',
    usageLimit: 'usage_limit',
    expiresAt: 'expires_at',
    isActive: 'is_active',
    code: 'code',
  };

  const fields: string[] = [];
  const bindings: (string | number | null)[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && fieldMap[key]) {
      let dbValue: string | number | null = value as string | number | null;
      if (key === 'isActive') dbValue = value ? 1 : 0;
      fields.push(`${fieldMap[key]} = ?${idx}`);
      bindings.push(dbValue);
      idx++;
    }
  }

  if (!fields.length) {
    return c.json({ success: true, data: { updated: false } });
  }

  bindings.push(id);
  await c.env.DB
    .prepare(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?${idx}`)
    .bind(...bindings)
    .run();

  await logCouponAction(c.env.DB, adminId, 'UPDATE_COUPON', id, body, ip);

  const updated = await c.env.DB.prepare(`SELECT * FROM coupons WHERE id = ?1`).bind(id).first<DbCoupon>();
  return c.json({ success: true, data: updated });
});

adminCoupons.delete('/:id', requirePermission('coupons.write'), async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;

  const redemptionRow = await c.env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = ?1`)
    .bind(id)
    .first<{ cnt: number }>();

  if (Number(redemptionRow?.cnt ?? 0) > 0) {
    await c.env.DB.prepare(`UPDATE coupons SET is_active = 0 WHERE id = ?1`).bind(id).run();
    await logCouponAction(c.env.DB, adminId, 'DEACTIVATE_COUPON_WITH_REDEMPTIONS', id, {}, ip);
    return c.json({ success: true, data: { deactivated: true, reason: 'Coupon has historical redemptions and was deactivated instead of hard-deleted.' } });
  }

  await c.env.DB.prepare(`DELETE FROM coupons WHERE id = ?1`).bind(id).run();
  await logCouponAction(c.env.DB, adminId, 'DELETE_COUPON', id, {}, ip);

  return c.json({ success: true, data: { deleted: true } });
});

export default adminCoupons;
