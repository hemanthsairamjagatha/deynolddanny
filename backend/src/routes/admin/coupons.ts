import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import type { DbCoupon } from '../../types/models.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminCoupons = new Hono<{ Bindings: Env }>();

// ─── Schema ─────────────────────────────────────────────────────────────────

const couponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, 'Coupon code must be alphanumeric with - or _'),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().positive(),
  minOrderPaise: z.number().int().min(0).default(0),
  maxDiscountPaise: z.number().int().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

// ─── GET /api/admin/coupons ───────────────────────────────────────────────────

adminCoupons.get('/', async (c) => {
  const result = await c.env.DB
    .prepare(`SELECT * FROM coupons ORDER BY created_at DESC`)
    .all<DbCoupon>();
  return c.json({ success: true, data: { items: result.results ?? [] } });
});

// ─── POST /api/admin/coupons — create coupon ─────────────────────────────────

adminCoupons.post('/', zValidator('json', couponSchema), async (c) => {
  const body = c.req.valid('json');
  const id = generateId('cpn_');
  const now = nowIso();

  // Check code uniqueness
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

  const coupon = await c.env.DB
    .prepare(`SELECT * FROM coupons WHERE id = ?1`)
    .bind(id)
    .first<DbCoupon>();

  return c.json({ success: true, data: coupon }, 201);
});

// ─── PATCH /api/admin/coupons/:id ────────────────────────────────────────────

adminCoupons.patch('/:id', zValidator('json', couponSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const existing = await c.env.DB
    .prepare(`SELECT id FROM coupons WHERE id = ?1`)
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found.', status: 404 } },
      404,
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

  const updated = await c.env.DB
    .prepare(`SELECT * FROM coupons WHERE id = ?1`)
    .bind(id)
    .first<DbCoupon>();

  return c.json({ success: true, data: updated });
});

// ─── DELETE /api/admin/coupons/:id ───────────────────────────────────────────

adminCoupons.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM coupons WHERE id = ?1`).bind(id).run();
  return c.json({ success: true, data: { deleted: true } });
});

export default adminCoupons;

