import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';

const adminDisputes = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/disputes ─────────────────────────────────────────────────
adminDisputes.get('/', requirePermission('disputes.manage', 'orders.read'), async (c) => {
  const rawStatus = c.req.query('status')?.trim();
  const status = rawStatus === 'resolved' ? 'closed' : rawStatus;

  let sql = `
    SELECT pd.*, o.order_number, o.shipping_name, o.total_paise, u.email AS customer_email
    FROM payment_disputes pd
    INNER JOIN orders o ON o.id = pd.order_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE 1=1
  `;
  const bindings: unknown[] = [];
  if (status) {
    bindings.push(status);
    sql += ` AND pd.status = ?${bindings.length}`;
  }
  sql += ` ORDER BY pd.created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        ...r,
        order_display_id: r.order_number,
        reason: r.reason_code ?? r.resolved_outcome ?? 'Chargeback / Dispute',
        type: `${String(r.gateway ?? 'gateway').toUpperCase()} Dispute`,
      })),
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── PATCH /api/admin/disputes/:id ───────────────────────────────────────────
const resolveDisputeSchema = z.object({
  status: z.enum(['under_review', 'won', 'lost', 'closed', 'resolved']).optional(),
  evidenceNotes: z.string().max(1000).optional(),
  resolution: z.string().max(1000).optional(),
  refundPaise: z.number().int().min(0).optional(),
});

adminDisputes.patch(
  '/:id',
  requirePermission('disputes.manage'),
  zValidator('json', resolveDisputeSchema),
  async (c) => {
    const disputeId = c.req.param('id');
    const body = c.req.valid('json');
    const rawStatus = body.status ?? 'closed';
    const status = rawStatus === 'resolved' ? 'closed' : rawStatus;
    const outcomeNote = body.evidenceNotes ?? body.resolution ?? null;
    const now = nowIso();

    const disp = await c.env.DB
      .prepare(`SELECT * FROM payment_disputes WHERE id = ?1 LIMIT 1`)
      .bind(disputeId)
      .first<{ id: string; order_id: string }>();

    if (!disp) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Dispute record not found.', status: 404 } }, 404);
    }

    const isClosed = status === 'won' || status === 'lost' || status === 'closed';
    const stmts: D1PreparedStatement[] = [
      c.env.DB
        .prepare(
          `UPDATE payment_disputes
           SET status = ?1,
               resolved_outcome = COALESCE(?2, resolved_outcome),
               updated_at = ?3
           WHERE id = ?4`,
        )
        .bind(status, outcomeNote, now, disputeId),
    ];

    if (isClosed) {
      stmts.push(
        c.env.DB
          .prepare(
            `UPDATE orders
             SET dispute_frozen = 0,
                 payment_status = CASE WHEN refunded_paise >= total_paise THEN 'refunded' WHEN refunded_paise > 0 THEN 'partially_refunded' ELSE 'paid' END,
                 updated_at = ?1
             WHERE id = ?2 AND dispute_frozen = 1`,
          )
          .bind(now, disp.order_id),
      );
    }

    await c.env.DB.batch(stmts);
    await auditAdminAction(c, 'UPDATE_PAYMENT_DISPUTE', 'payment_dispute', disputeId, {
      status,
      outcomeNote,
    });

    return c.json({ success: true, data: { status, updatedAt: now } });
  },
);

export default adminDisputes;
