import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { DbAddress } from '../types/models.js';
import { authRequired } from '../middleware/auth.js';
import { getUserById, updateUser } from '../db/queries/users.js';
import { generateId } from '../services/crypto.js';
import { PREFIX_ADDRESS } from '../config/constants.js';
import { nowIso } from '../db/client.js';

const users = new Hono<{ Bindings: Env }>();

// ─── Schema ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
});

const addressSchema = z.object({
  addressType: z.enum(['Home', 'Office', 'Other']).default('Home'),
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

// ─── GET /api/users/me & /api/users/profile ─────────────────────────────────

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

// ─── PATCH /api/users/me ─────────────────────────────────────────────────────

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

// ─── GET /api/users/me/addresses ─────────────────────────────────────────────

users.get('/me/addresses', authRequired, async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB
    .prepare(
      `SELECT * FROM addresses WHERE user_id = ?1 ORDER BY is_default DESC, created_at DESC`,
    )
    .bind(userId)
    .all<DbAddress>();

  return c.json({ success: true, data: { items: result.results ?? [] } });
});

// ─── POST /api/users/me/addresses ────────────────────────────────────────────

users.post('/me/addresses', authRequired, zValidator('json', addressSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const id = generateId(PREFIX_ADDRESS);
  const now = nowIso();

  // If this is the default address, unset all others first
  if (body.isDefault) {
    await c.env.DB
      .prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?1`)
      .bind(userId)
      .run();
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

  const address = await c.env.DB
    .prepare(`SELECT * FROM addresses WHERE id = ?1`)
    .bind(id)
    .first<DbAddress>();

  return c.json({ success: true, data: address }, 201);
});

// ─── PATCH /api/users/me/addresses/:addressId ────────────────────────────────

users.patch('/me/addresses/:addressId', authRequired, zValidator('json', addressSchema.partial()), async (c) => {
  const userId = c.get('userId');
  const addressId = c.req.param('addressId');
  const body = c.req.valid('json');
  const now = nowIso();

  // Verify ownership
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
    await c.env.DB
      .prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?1`)
      .bind(userId)
      .run();
  }

  await c.env.DB
    .prepare(
      `UPDATE addresses
       SET address_type = COALESCE(?1, address_type),
           full_name    = COALESCE(?2, full_name),
           phone        = COALESCE(?3, phone),
           line1        = COALESCE(?4, line1),
           line2        = COALESCE(?5, line2),
           city         = COALESCE(?6, city),
           state        = COALESCE(?7, state),
           pincode      = COALESCE(?8, pincode),
           country      = COALESCE(?9, country),
           is_default   = COALESCE(?10, is_default),
           updated_at   = ?11
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

  const address = await c.env.DB
    .prepare(`SELECT * FROM addresses WHERE id = ?1`)
    .bind(addressId)
    .first<DbAddress>();

  return c.json({ success: true, data: address });
});

// ─── DELETE /api/users/me/addresses/:addressId ───────────────────────────────

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

