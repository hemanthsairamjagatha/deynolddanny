import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';
import { recordInventoryMovements } from '../../services/stockEngine.js';

const adminReturns = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/returns ──────────────────────────────────────────────────
adminReturns.get('/', requirePermission('returns.manage', 'orders.read'), async (c) => {
  const status = c.req.query('status')?.trim(); // 'pending', 'approved', 'rejected', 'completed'
  let sql = `
    SELECT rr.*, o.order_number, o.shipping_name, o.shipping_email, oi.title as item_title, oi.size, oi.color, oi.unit_price_paise, oi.quantity
    FROM return_requests rr
    INNER JOIN orders o ON o.id = rr.order_id
    INNER JOIN order_items oi ON oi.id = rr.order_item_id
    WHERE 1=1
  `;
  const bindings: any[] = [];
  if (status) {
    bindings.push(status);
    sql += ` AND rr.status = ?${bindings.length}`;
  }
  sql += ` ORDER BY rr.created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── PATCH /api/admin/returns/:id/review ─────────────────────────────────────
const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed']),
  adminNotes: z.string().max(500).optional(),
  restock: z.boolean().default(false),
});

adminReturns.patch(
  '/:id/review',
  requirePermission('returns.manage'),
  zValidator('json', reviewSchema),
  async (c) => {
    const returnId = c.req.param('id');
    const adminId = c.get('userId');
    const { status, adminNotes, restock } = c.req.valid('json');

    const ret = await c.env.DB
      .prepare(`SELECT * FROM return_requests WHERE id = ?1 LIMIT 1`)
      .bind(returnId)
      .first<Record<string, any>>();

    if (!ret) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return request not found.', status: 404 } }, 404);
    }

    const now = nowIso();
    await c.env.DB
      .prepare(
        `UPDATE return_requests
         SET status = ?1, admin_notes = COALESCE(?2, admin_notes), reviewed_by = ?3, reviewed_at = ?4, updated_at = ?4
         WHERE id = ?5`,
      )
      .bind(status, adminNotes ?? null, adminId, now, returnId)
      .run();

    // If completed and restock requested, increment variant stock and record inventory movement
    if (status === 'completed' && restock) {
      const item = await c.env.DB
        .prepare(`SELECT variant_id, quantity FROM order_items WHERE id = ?1 LIMIT 1`)
        .bind(ret.order_item_id)
        .first<{ variant_id: string; quantity: number }>();

      if (item && item.variant_id) {
        await c.env.DB
          .prepare(`UPDATE product_variants SET stock = stock + ?1, updated_at = ?2 WHERE id = ?3`)
          .bind(ret.quantity || item.quantity, now, item.variant_id)
          .run();

        await recordInventoryMovements(c.env.DB, [
          {
            variantId: item.variant_id,
            movementType: 'return_restock',
            qtyDelta: ret.quantity || item.quantity,
            actorId: adminId,
            notes: `Restocked from return request ${returnId}`,
          },
        ]);
      }
    }

    await auditAdminAction(c, 'REVIEW_RETURN_REQUEST', 'return_request', returnId, { status, restock });

    return c.json({ success: true, data: { status, reviewedAt: now } });
  },
);

export default adminReturns;
