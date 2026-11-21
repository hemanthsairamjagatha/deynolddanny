import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { requirePermission } from '../../middleware/adminAuth.js';

const adminLogs = new Hono<{ Bindings: Env }>();

/**
 * GET /api/admin/logs — Unified operational audit trail
 * Supports ?type=admin|orders|webhooks|inventory
 */
adminLogs.get('/', requirePermission('logs.read'), async (c) => {
  const type = c.req.query('type') || 'admin';
  const rawLimit = Number(c.req.query('limit') ?? '50');
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(100, Math.floor(rawLimit)) : 50;

  if (type === 'orders') {
    const res = await c.env.DB
      .prepare(`SELECT * FROM order_audit_logs ORDER BY created_at DESC LIMIT ?1`)
      .bind(limit)
      .all();
    return c.json({ success: true, data: { type, items: res.results ?? [] } });
  }

  if (type === 'webhooks') {
    const res = await c.env.DB
      .prepare(`SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT ?1`)
      .bind(limit)
      .all();
    return c.json({ success: true, data: { type, items: res.results ?? [] } });
  }

  if (type === 'inventory') {
    const res = await c.env.DB
      .prepare(`SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT ?1`)
      .bind(limit)
      .all();
    return c.json({ success: true, data: { type, items: res.results ?? [] } });
  }

  const res = await c.env.DB
    .prepare(`SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ?1`)
    .bind(limit)
    .all();
  return c.json({ success: true, data: { type: 'admin', items: res.results ?? [] } });
});

export default adminLogs;
