import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';
import { recordInventoryMovements } from '../../services/stockEngine.js';
import { invalidateStorefrontCache, safeJsonParse } from '../../services/storefrontCache.js';

const adminReturns = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/returns ──────────────────────────────────────────────────
adminReturns.get('/', requirePermission('returns.manage', 'orders.read'), async (c) => {
  const rawStatus = c.req.query('status')?.trim();
  const statusAliasMap: Record<string, string> = {
    pending: 'requested',
    completed: 'closed',
  };
  const status = rawStatus ? (statusAliasMap[rawStatus] ?? rawStatus) : undefined;

  let sql = `
    SELECT rr.*, o.order_number, o.shipping_name, o.total_paise, u.email AS customer_email
    FROM return_requests rr
    INNER JOIN orders o ON o.id = rr.order_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE 1=1
  `;
  const bindings: unknown[] = [];
  if (status) {
    bindings.push(status);
    sql += ` AND rr.status = ?${bindings.length}`;
  }
  sql += ` ORDER BY rr.created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        ...r,
        order_display_id: r.order_number,
        items: safeJsonParse(String(r.items_json ?? '[]'), []),
      })),
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── PATCH /api/admin/returns/:id/review (and /:id alias) ───────────────────
const reviewSchema = z.object({
  status: z
    .enum(['requested', 'approved', 'rejected', 'pickup_scheduled', 'received', 'inspected', 'refunded', 'closed', 'completed'])
    .optional(),
  action: z.enum(['approve', 'reject', 'complete']).optional(),
  adminNotes: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  restock: z.boolean().default(false),
});

const handleReturnReview = async (c: any) => {
  const returnId = c.req.param('id');
  const adminId = c.get('userId');
  const body = c.req.valid('json') as z.infer<typeof reviewSchema>;
  const actionMap = { approve: 'approved', reject: 'rejected', complete: 'closed' } as const;
  let status = body.status ?? (body.action ? actionMap[body.action] : 'approved');
  if (status === 'completed') status = 'closed';
  const adminNotes = body.adminNotes ?? body.note;
  const restock = Boolean(body.restock);

  const ret = (await c.env.DB
    .prepare(`SELECT * FROM return_requests WHERE id = ?1 LIMIT 1`)
    .bind(returnId)
    .first()) as Record<string, any> | null;

  if (!ret) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return request not found.', status: 404 } }, 404);
  }

  const now = nowIso();
  await c.env.DB
    .prepare(
      `UPDATE return_requests
       SET status = ?1, admin_notes = COALESCE(?2, admin_notes), updated_at = ?3
       WHERE id = ?4`,
    )
    .bind(status, adminNotes ?? null, now, returnId)
    .run();

  if (status === 'closed' || status === 'refunded' || status === 'inspected') {
    await c.env.DB
      .prepare(`UPDATE orders SET status = 'returned', updated_at = ?1 WHERE id = ?2 AND status = 'return_requested'`)
      .bind(now, ret.order_id)
      .run();
  }

  if ((status === 'closed' || status === 'inspected' || status === 'refunded') && restock) {
    const requestedItems = safeJsonParse<Array<{ orderItemId?: string; variantId?: string; quantity?: number }>>(
      String(ret.items_json ?? '[]'),
      [],
    );
    const orderItemsRes = (await c.env.DB
      .prepare(`SELECT id, variant_id, quantity FROM order_items WHERE order_id = ?1`)
      .bind(ret.order_id)
      .all()) as { results?: Array<{ id: string; variant_id: string; quantity: number }> };
    const orderItems = orderItemsRes.results ?? [];

    const toRestock: Array<{ variantId: string; quantity: number }> = [];
    if (requestedItems.length > 0) {
      for (const reqItem of requestedItems) {
        const matched = orderItems.find(
          (oi) => (reqItem.orderItemId && oi.id === reqItem.orderItemId) || (reqItem.variantId && oi.variant_id === reqItem.variantId),
        );
        if (matched?.variant_id) {
          const qty = Math.min(matched.quantity, Math.max(1, Number(reqItem.quantity || matched.quantity)));
          toRestock.push({ variantId: matched.variant_id, quantity: qty });
        }
      }
    } else {
      for (const oi of orderItems) {
        if (oi.variant_id) toRestock.push({ variantId: oi.variant_id, quantity: oi.quantity });
      }
    }

    if (toRestock.length > 0) {
      await c.env.DB.batch(
        toRestock.map((r) =>
          c.env.DB
            .prepare(`UPDATE product_variants SET stock = stock + ?1, updated_at = ?2 WHERE id = ?3`)
            .bind(r.quantity, now, r.variantId),
        ),
      );

      await recordInventoryMovements(
        c.env.DB,
        toRestock.map((r) => ({
          variantId: r.variantId,
          orderId: String(ret.order_id),
          movementType: 'return_restock',
          qtyDelta: r.quantity,
          actorId: adminId,
          notes: `Restocked from return request ${returnId}`,
        })),
      );
      await invalidateStorefrontCache(c.env);
    }
  }

  await auditAdminAction(c, 'REVIEW_RETURN_REQUEST', 'return_request', returnId, { status, restock });

  return c.json({ success: true, data: { status, reviewedAt: now } });
};

adminReturns.patch('/:id/review', requirePermission('returns.manage'), zValidator('json', reviewSchema), handleReturnReview);
adminReturns.patch('/:id', requirePermission('returns.manage'), zValidator('json', reviewSchema), handleReturnReview);

export default adminReturns;
