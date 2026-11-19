import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache } from '../../services/storefrontCache.js';

const settings = new Hono<{ Bindings: Env }>();

// GET / — returns store_settings singleton
settings.get('/', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT settings_json FROM store_settings WHERE id = 'default'`,
  ).first<{ settings_json: string }>();
  const data = row ? JSON.parse(row.settings_json) : {};
  return c.json({ success: true, data });
});

// PATCH / — update store_settings
settings.patch('/', requirePermission('settings.write'), async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const actor = c.get('userEmail') ?? c.get('userId') ?? 'admin';
  const row = await c.env.DB.prepare(
    `SELECT settings_json FROM store_settings WHERE id = 'default'`,
  ).first<{ settings_json: string }>();
  const existing = row ? JSON.parse(row.settings_json) : {};
  const merged = { ...existing, ...body };
  await c.env.DB.prepare(
    `INSERT INTO store_settings (id, settings_json, updated_by, updated_at)
     VALUES ('default', ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_by = excluded.updated_by, updated_at = datetime('now')`,
  )
    .bind(JSON.stringify(merged), actor)
    .run();
  await invalidateStorefrontCache(c.env);
  return c.json({ success: true, data: merged });
});

// POST /cache/flush
settings.post('/cache/flush', requirePermission('settings.write'), async (c) => {
  await invalidateStorefrontCache(c.env);
  return c.json({ success: true, data: { flushed: true } });
});

export default settings;
