import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { authOptional } from '../middleware/auth.js';
import { checkD1RateLimit } from '../middleware/rateLimit.js';
import { generateId } from '../services/crypto.js';
import { nowIso } from '../db/client.js';

const analyticsPublic = new Hono<{ Bindings: Env }>();

const eventSchema = z.object({
  eventName: z.enum([
    'page_view',
    'product_view',
    'add_to_cart',
    'begin_checkout',
    'search',
    'newsletter_subscribe',
    'wishlist_toggle',
  ]),
  path: z.string().max(300).optional(),
  entityId: z.string().max(120).optional(),
  valuePaise: z.number().int().min(0).max(500_000_000).optional(),
  meta: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

analyticsPublic.post(
  '/events',
  authOptional,
  zValidator('json', eventSchema),
  async (c) => {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const limit = await checkD1RateLimit(c.env.DB, `ana_ev:${ip}`, 60, 60);
    if (!limit.allowed) {
      return c.json({ success: true, data: { recorded: false } });
    }

    const body = c.req.valid('json');
    const sessionId = c.req.header('x-session-id')?.slice(0, 90) ?? null;
    const userId = c.get('userId') ?? null;

    await c.env.DB
      .prepare(
        `INSERT INTO analytics_events (id, event_name, session_id, user_id, path, entity_id, value_paise, meta_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        generateId('ev_'),
        body.eventName,
        sessionId,
        userId,
        body.path ?? null,
        body.entityId ?? null,
        body.valuePaise ?? null,
        JSON.stringify(body.meta ?? {}),
        nowIso(),
      )
      .run();

    return c.json({ success: true, data: { recorded: true } }, 201);
  },
);

export default analyticsPublic;
