import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { DbAddress } from '../types/models.js';
import { authRequired } from '../middleware/auth.js';
import { getUserById, updateUser } from '../db/queries/users.js';
import { generateId } from '../services/crypto.js';
import { clearRefreshCookie } from '../services/jwt.js';
import { PREFIX_ADDRESS } from '../config/constants.js';
import { nowIso, runBatch } from '../db/client.js';

const users = new Hono<{ Bindings: Env }>();

const profileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{8,16}$/, 'Invalid phone number format')
    .optional(),
});

const addressBaseSchema = z.object({
  addressType: z.enum(['Home', 'Office', 'Other']).default('Home'),
  fullName: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().min(3).max(15),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

function validateIndianAddressFields(
  data: { country?: string; phone?: string; pincode?: string },
  ctx: z.RefinementCtx,
) {
  const country = (data.country ?? 'India').trim();
  const isIndia = country.toLowerCase() === 'india' || country.toUpperCase() === 'IN';
  if (!isIndia) return;

  if (data.phone !== undefined) {
    const digits = data.phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Invalid Indian mobile number (10 digits starting with 6–9)',
      });
    }
  }
  if (data.pincode !== undefined && !/^\d{6}$/.test(data.pincode.replace(/\D/g, ''))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pincode'],
      message: 'Indian pincode must be 6 digits',
    });
  }
}

const addressSchema = addressBaseSchema.superRefine(validateIndianAddressFields);
const partialAddressSchema = addressBaseSchema.partial().superRefine(validateIndianAddressFields);

const handleGetProfile = async (c: any) => {
  const userId = c.get('userId');
  const user = await getUserById(c.env.DB, userId);
  if (!user) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found.', status: 404 } },
      404,
    );
  }
  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.full_name ?? null,
      phone: user.phone ?? null,
      role: user.role,
    },
  });
};

users.get('/me', authRequired, handleGetProfile);
users.get('/profile', authRequired, handleGetProfile);

users.patch('/me', authRequired, zValidator('json', profileSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const updated = await updateUser(c.env.DB, userId, {
    fullName: body.fullName,
    phone: body.phone,
  });

  return c.json({
    success: true,
    data: {
      id: updated?.id,
      email: updated?.email,
      fullName: updated?.full_name ?? null,
      phone: updated?.phone ?? null,
    },
  });
});

// ─── DPDP: Client Data Export (GET /api/users/me/export) ───────────────────

users.get('/me/export', authRequired, async (c) => {
  const userId = c.get('userId');

  const [userRes, addrRes, ordersRes, wishRes] = await c.env.DB.batch([
    c.env.DB
      .prepare(`SELECT id, email, full_name, phone, created_at, last_login_at FROM users WHERE id = ?1`)
      .bind(userId),
    c.env.DB.prepare(`SELECT * FROM addresses WHERE user_id = ?1`).bind(userId),
    c.env.DB
      .prepare(`SELECT id, order_number, status, payment_status, total_paise, currency, created_at FROM orders WHERE user_id = ?1 ORDER BY created_at DESC`)
      .bind(userId),
    c.env.DB
      .prepare(`SELECT product_id, created_at FROM wishlists WHERE user_id = ?1`)
      .bind(userId),
  ]);

  return c.json({
    success: true,
    data: {
      exportedAt: nowIso(),
      profile: userRes.results?.[0] ?? null,
      addresses: addrRes.results ?? [],
      orders: ordersRes.results ?? [],
      wishlist: wishRes.results ?? [],
    },
  });
});

// ─── DPDP: Client Erasure & Anonymization (DELETE /api/users/me) ───────────

users.delete('/me', authRequired, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const now = nowIso();
  const anonymizedEmail = `erased_${userId}@anonymized.invalid`;

  // Block erasure if active in-flight orders exist to preserve courier/payment completion
  const activeOrders = await c.env.DB
    .prepare(
      `SELECT COUNT(*) AS cnt FROM orders
       WHERE user_id = ?1 AND status IN ('pending', 'awaiting_capture', 'confirmed', 'processing', 'shipped', 'ndr_pending')`,
    )
    .bind(userId)
    .first<{ cnt: number }>();

  if ((activeOrders?.cnt ?? 0) > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ACTIVE_ORDERS_PRESENT',
          message: 'Account deletion is unavailable while active shipments or pending orders are in progress.',
          status: 409,
        },
      },
      409,
    );
  }

  // Anonymize PII while preserving immutable financial order totals/invoices for statutory compliance
  await runBatch(c.env.DB, [
    c.env.DB
      .prepare(
        `UPDATE users
         SET email = ?1, full_name = NULL, phone = NULL, is_active = 0,
             token_version = token_version + 1, deleted_at = ?2, updated_at = ?2
         WHERE id = ?3`,
      )
      .bind(anonymizedEmail, now, userId),
    c.env.DB.prepare(`DELETE FROM addresses WHERE user_id = ?1`).bind(userId),
    c.env.DB.prepare(`DELETE FROM wishlists WHERE user_id = ?1`).bind(userId),
    c.env.DB.prepare(`DELETE FROM refresh_tokens WHERE user_id = ?1`).bind(userId),
    c.env.DB.prepare(`DELETE FROM carts WHERE user_id = ?1`).bind(userId),
    c.env.DB.prepare(`DELETE FROM otps WHERE email = ?1 COLLATE NOCASE`).bind(userEmail),
    c.env.DB.prepare(`DELETE FROM restock_subscriptions WHERE email = ?1 COLLATE NOCASE`).bind(userEmail),
    c.env.DB
      .prepare(`UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE email = ?1 COLLATE NOCASE`)
      .bind(userEmail),
    c.env.DB
      .prepare(
        `UPDATE orders
         SET shipping_name = 'Erased Client', shipping_phone = '0000000000', shipping_line1 = '[ERASED]', shipping_line2 = NULL
         WHERE user_id = ?1`,
      )
      .bind(userId),
  ]);

  clearRefreshCookie(c as any);

  return c.json({
    success: true,
    data: {
      deleted: true,
      message: 'Your personal profile, saved addresses, and active sessions have been erased.',
    },
  });
});

// ─── Address Book ────────────────────────────────────────────────────────────

users.get('/me/addresses', authRequired, async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB
    .prepare(`SELECT * FROM addresses WHERE user_id = ?1 ORDER BY is_default DESC, created_at DESC`)
    .bind(userId)
    .all<DbAddress>();
  return c.json({ success: true, data: { items: result.results ?? [] } });
});

users.post('/me/addresses', authRequired, zValidator('json', addressSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const id = generateId(PREFIX_ADDRESS);
  const now = nowIso();

  if (body.isDefault) {
    await c.env.DB.prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?1`).bind(userId).run();
  }

  await c.env.DB
    .prepare(
      `INSERT INTO addresses (
         id, user_id, address_type, full_name, phone, line1, line2,
         city, state, pincode, country, is_default, created_at, updated_at
       ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)`,
    )
    .bind(
      id, userId, body.addressType, body.fullName, body.phone,
      body.line1, body.line2 ?? null, body.city, body.state,
      body.pincode, body.country, body.isDefault ? 1 : 0, now,
    )
    .run();

  const address = await c.env.DB.prepare(`SELECT * FROM addresses WHERE id = ?1`).bind(id).first<DbAddress>();
  return c.json({ success: true, data: address }, 201);
});

users.patch('/me/addresses/:addressId', authRequired, zValidator('json', partialAddressSchema), async (c) => {
  const userId = c.get('userId');
  const addressId = c.req.param('addressId');
  const body = c.req.valid('json');
  const now = nowIso();

  const existing = await c.env.DB
    .prepare(`SELECT id FROM addresses WHERE id = ?1 AND user_id = ?2`)
    .bind(addressId, userId)
    .first<{ id: string }>();

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Address not found.', status: 404 } },
      404,
    );
  }

  if (body.isDefault) {
    await c.env.DB.prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?1`).bind(userId).run();
  }

  await c.env.DB
    .prepare(
      `UPDATE addresses
       SET address_type = COALESCE(?1, address_type),
           full_name = COALESCE(?2, full_name),
           phone = COALESCE(?3, phone),
           line1 = COALESCE(?4, line1),
           line2 = COALESCE(?5, line2),
           city = COALESCE(?6, city),
           state = COALESCE(?7, state),
           pincode = COALESCE(?8, pincode),
           country = COALESCE(?9, country),
           is_default = COALESCE(?10, is_default),
           updated_at = ?11
       WHERE id = ?12 AND user_id = ?13`,
    )
    .bind(
      body.addressType ?? null, body.fullName ?? null, body.phone ?? null,
      body.line1 ?? null, body.line2 ?? null, body.city ?? null,
      body.state ?? null, body.pincode ?? null, body.country ?? null,
      body.isDefault !== undefined ? (body.isDefault ? 1 : 0) : null,
      now, addressId, userId,
    )
    .run();

  const address = await c.env.DB.prepare(`SELECT * FROM addresses WHERE id = ?1`).bind(addressId).first<DbAddress>();
  return c.json({ success: true, data: address });
});

users.delete('/me/addresses/:addressId', authRequired, async (c) => {
  const userId = c.get('userId');
  const addressId = c.req.param('addressId');
  const result = await c.env.DB
    .prepare(`DELETE FROM addresses WHERE id = ?1 AND user_id = ?2`)
    .bind(addressId, userId)
    .run();

  if (!result.meta.changes) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Address not found.', status: 404 } },
      404,
    );
  }
  return c.json({ success: true, data: { deleted: true } });
});

export default users;
