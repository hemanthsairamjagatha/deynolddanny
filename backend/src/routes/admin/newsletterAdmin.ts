import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { requirePermission, auditAdminAction } from '../../middleware/adminAuth.js';

const newsletterAdmin = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/newsletter ───────────────────────────────────────────────
newsletterAdmin.get('/', requirePermission('customers.read'), async (c) => {
  const status = c.req.query('status')?.trim();
  const q = c.req.query('q')?.trim().toLowerCase();

  let sql = `SELECT id, email, status, created_at FROM newsletter_subscribers WHERE 1=1`;
  const binds: unknown[] = [];

  if (status === 'active' || status === 'unsubscribed') {
    binds.push(status);
    sql += ` AND status = ?${binds.length}`;
  }
  if (q) {
    binds.push(`%${q}%`);
    sql += ` AND LOWER(email) LIKE ?${binds.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 500`;

  const [rows, counts] = await Promise.all([
    c.env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>(),
    c.env.DB
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) AS unsubscribed
         FROM newsletter_subscribers`,
      )
      .first<{ total: number; active: number; unsubscribed: number }>(),
  ]);

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      stats: {
        total: Number(counts?.total ?? 0),
        active: Number(counts?.active ?? 0),
        unsubscribed: Number(counts?.unsubscribed ?? 0),
      },
    },
  });
});

// ─── PATCH /api/admin/newsletter/:id ─────────────────────────────────────────
newsletterAdmin.patch(
  '/:id',
  requirePermission('customers.read'),
  zValidator('json', z.object({ status: z.enum(['active', 'unsubscribed']) })),
  async (c) => {
    const id = c.req.param('id');
    const { status } = c.req.valid('json');
    await c.env.DB
      .prepare(`UPDATE newsletter_subscribers SET status = ?1 WHERE id = ?2`)
      .bind(status, id)
      .run();
    await auditAdminAction(c, 'UPDATE_NEWSLETTER_SUBSCRIBER', 'newsletter_subscriber', id, { status });
    return c.json({ success: true, data: { id, status } });
  },
);

// ─── DELETE /api/admin/newsletter/:id ────────────────────────────────────────
newsletterAdmin.delete('/:id', requirePermission('customers.read'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM newsletter_subscribers WHERE id = ?1`).bind(id).run();
  await auditAdminAction(c, 'DELETE_NEWSLETTER_SUBSCRIBER', 'newsletter_subscriber', id);
  return c.json({ success: true, data: { deleted: true } });
});

export default newsletterAdmin;
