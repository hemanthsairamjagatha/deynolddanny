import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';

const adminDisputes = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/disputes ─────────────────────────────────────────────────
adminDisputes.get('/', requirePermission('disputes.manage', 'orders.read'), async (c) => {
  const status = c.req.query('status')?.trim();
  let sql = `
    SELECT pd.*, o.order_number, o.shipping_name, o.shipping_email, o.total_paise
    FROM payment_disputes pd
    INNER JOIN orders o ON o.id = pd.order_id
    WHERE 1=1
  `;
  const bindings: any[] = [];
  if (status) {
    bindings.push(status);
    sql += ` AND pd.status = ?${bindings.length}`;
  }
  sql += ` ORDER BY pd.created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── PATCH /api/admin/disputes/:id ───────────────────────────────────────────
const resolveDisputeSchema = z.object({
  status: z.enum(['under_review', 'won', 'lost', 'closed']),
  evidenceNotes: z.string().max(1000).optional(),
});

adminDisputes.patch(
  '/:id',
  requirePermission('disputes.manage'),
  zValidator('json', resolveDisputeSchema),
  async (c) => {
    const disputeId = c.req.param('id');
    const { status, evidenceNotes } = c.req.valid('json');
    const now = nowIso();

    const disp = await c.env.DB
      .prepare(`SELECT * FROM payment_disputes WHERE id = ?1 LIMIT 1`)
      .bind(disputeId)
      .first<Record<string, any>>();

    if (!disp) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Dispute record not found.', status: 404 } }, 404);
    }

    await c.env.DB
      .prepare(
        `UPDATE payment_disputes
         SET status = ?1,
             evidence_notes = COALESCE(?2, evidence_notes),
             resolved_at = CASE WHEN ?1 IN ('won', 'lost', 'closed') THEN ?3 ELSE resolved_at END,
             updated_at = ?3
         WHERE id = ?4`,
      )
      .bind(status, evidenceNotes ?? null, now, disputeId)
      .run();

    await auditAdminAction(c, 'UPDATE_PAYMENT_DISPUTE', 'payment_dispute', disputeId, { status });

    return c.json({ success: true, data: { status, updatedAt: now } });
  },
);

export default adminDisputes;
