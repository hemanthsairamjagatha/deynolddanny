import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';

const adminReviews = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/reviews ──────────────────────────────────────────────────
adminReviews.get('/', requirePermission('reviews.moderate'), async (c) => {
  const status = c.req.query('status')?.trim();
  const productId = c.req.query('productId')?.trim();

  let sql = `
    SELECT pr.*, p.title as product_title, p.slug as product_slug, p.default_img as product_img
    FROM product_reviews pr
    INNER JOIN products p ON p.id = pr.product_id
    WHERE 1=1
  `;
  const bindings: any[] = [];
  if (status) {
    bindings.push(status);
    sql += ` AND pr.status = ?${bindings.length}`;
  }
  if (productId) {
    bindings.push(productId);
    sql += ` AND pr.product_id = ?${bindings.length}`;
  }
  sql += ` ORDER BY pr.created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        ...r,
        product_name: r.product_title,
        reviewer_name: r.author_name,
        customer_email: r.author_email,
      })),
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── PATCH /api/admin/reviews/:id ────────────────────────────────────────────
const moderateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  isFeatured: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  adminReply: z.string().max(800).nullable().optional(),
  admin_reply: z.string().max(800).nullable().optional(),
});

adminReviews.patch(
  '/:id',
  requirePermission('reviews.moderate'),
  zValidator('json', moderateSchema),
  async (c) => {
    const reviewId = c.req.param('id');
    const adminId = c.get('userId');
    const body = c.req.valid('json');

    const sets: string[] = ['updated_at = ?1'];
    const vals: any[] = [nowIso()];
    const add = (col: string, val: any) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.status !== undefined) {
      add('status', body.status);
      add('moderated_by', adminId);
    }
    const feat = body.isFeatured !== undefined ? body.isFeatured : body.is_featured;
    if (feat !== undefined) add('is_featured', feat ? 1 : 0);
    const reply = body.adminReply !== undefined ? body.adminReply : body.admin_reply;
    if (reply !== undefined) add('admin_reply', reply);

    vals.push(reviewId);
    await c.env.DB
      .prepare(`UPDATE product_reviews SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await auditAdminAction(c, 'MODERATE_REVIEW', 'product_review', reviewId, body);

    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── DELETE /api/admin/reviews/:id ───────────────────────────────────────────
adminReviews.delete('/:id', requirePermission('reviews.moderate'), async (c) => {
  const reviewId = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM product_reviews WHERE id = ?1`).bind(reviewId).run();
  await auditAdminAction(c, 'DELETE_REVIEW', 'product_review', reviewId);
  return c.json({ success: true, data: { deleted: true } });
});

export default adminReviews;
