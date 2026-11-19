import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { requirePermission } from '../../middleware/adminAuth.js';

const adminPayments = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/payments ─────────────────────────────────────────────────
adminPayments.get('/', requirePermission('orders.read', 'logs.read'), async (c) => {
  const gateway = c.req.query('gateway')?.trim();
  const status = c.req.query('status')?.trim();
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50)));

  let sql = `
    SELECT pa.*, o.order_number, o.shipping_name, o.shipping_email
    FROM payment_attempts pa
    LEFT JOIN orders o ON o.id = pa.order_id
    WHERE 1=1
  `;
  const bindings: any[] = [];

  if (gateway) {
    bindings.push(gateway);
    sql += ` AND pa.gateway = ?${bindings.length}`;
  }
  if (status) {
    bindings.push(status);
    sql += ` AND pa.status = ?${bindings.length}`;
  }

  sql += ` ORDER BY pa.created_at DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── GET /api/admin/payments/refunds ─────────────────────────────────────────
adminPayments.get('/refunds', requirePermission('orders.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT r.*, o.order_number, o.shipping_name, o.shipping_email
       FROM refunds r
       LEFT JOIN orders o ON o.id = r.order_id
       ORDER BY r.created_at DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();

  return c.json({ success: true, data: { items: rows.results ?? [] } });
});

// ─── GET /api/admin/payments/stats ───────────────────────────────────────────
adminPayments.get('/stats', requirePermission('orders.read', 'analytics.read'), async (c) => {
  const [attemptsRes, refundsRes] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT
           COUNT(*) as total_attempts,
           SUM(CASE WHEN status = 'successful' THEN 1 ELSE 0 END) as successful_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
           SUM(CASE WHEN status = 'successful' THEN amount_paise ELSE 0 END) as successful_volume_paise
         FROM payment_attempts`,
      )
      .first<{
        total_attempts: number;
        successful_count: number;
        failed_count: number;
        successful_volume_paise: number;
      }>(),
    c.env.DB
      .prepare(`SELECT COUNT(*) as total_refunds, COALESCE(SUM(amount_paise), 0) as refund_volume_paise FROM refunds`)
      .first<{ total_refunds: number; refund_volume_paise: number }>(),
  ]);

  return c.json({
    success: true,
    data: {
      totalAttempts: attemptsRes?.total_attempts ?? 0,
      successfulCount: attemptsRes?.successful_count ?? 0,
      failedCount: attemptsRes?.failed_count ?? 0,
      successfulVolumePaise: attemptsRes?.successful_volume_paise ?? 0,
      totalRefunds: refundsRes?.total_refunds ?? 0,
      refundVolumePaise: refundsRes?.refund_volume_paise ?? 0,
    },
  });
});

export default adminPayments;
