import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { generateId } from '../services/crypto.js';
import { PREFIX_NEWSLETTER } from '../config/constants.js';
import { nowIso } from '../db/client.js';

const newsletter = new Hono<{ Bindings: Env }>();

const subscribeSchema = z.object({
  email: z.string().email().toLowerCase(),
});

// ─── POST /api/newsletter/subscribe ─────────────────────────────────────────

newsletter.post('/subscribe', zValidator('json', subscribeSchema), async (c) => {
  const { email } = c.req.valid('json');
  const id = generateId(PREFIX_NEWSLETTER);
  const unsubToken = generateId('ut_');
  const now = nowIso();

  await c.env.DB
    .prepare(
      `INSERT INTO newsletter_subscribers (id, email, status, unsub_token, created_at)
       VALUES (?1, ?2, 'active', ?3, ?4)
       ON CONFLICT(email) DO UPDATE SET
         status = 'active',
         unsub_token = excluded.unsub_token`,
    )
    .bind(id, email, unsubToken, now)
    .run();

  return c.json({
    success: true,
    data: { subscribed: true, email },
  });
});

// ─── GET /api/newsletter/unsubscribe?token= ──────────────────────────────────

newsletter.get('/unsubscribe', async (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Token is required.', status: 400 } },
      400,
    );
  }

  const result = await c.env.DB
    .prepare(
      `UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE unsub_token = ?1`,
    )
    .bind(token)
    .run();

  if (!result.meta.changes) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invalid unsubscribe token.', status: 404 } },
      404,
    );
  }

  return c.json({ success: true, data: { unsubscribed: true } });
});

export default newsletter;

