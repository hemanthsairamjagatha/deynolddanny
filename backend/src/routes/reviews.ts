import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { authOptional } from '../middleware/auth.js';
import { checkD1RateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';
import { generateId } from '../services/crypto.js';
import { nowIso } from '../db/client.js';
import { safeJsonParse } from '../services/storefrontCache.js';

const reviews = new Hono<{ Bindings: Env }>();

// ─── GET /api/reviews/product/:slug ──────────────────────────────────────────
reviews.get('/product/:slug', async (c) => {
  const slug = c.req.param('slug').trim();
  const product = await c.env.DB
    .prepare(`SELECT id FROM products WHERE slug = ?1 AND is_active = 1 LIMIT 1`)
    .bind(slug)
    .first<{ id: string }>();

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  const rows = await c.env.DB
    .prepare(
      `SELECT id, author_name, rating, title, body, fit_feedback, verified_purchase, is_featured, admin_reply, created_at
       FROM product_reviews
       WHERE product_id = ?1 AND status = 'approved'
       ORDER BY is_featured DESC, created_at DESC`,
    )
    .bind(product.id)
    .all<{
      id: string;
      author_name: string;
      rating: number;
      title: string;
      body: string;
      fit_feedback: string;
      verified_purchase: number;
      is_featured: number;
      admin_reply: string | null;
      created_at: string;
    }>();

  const items = (rows.results ?? []).map((r) => ({
    id: r.id,
    authorName: r.author_name,
    rating: r.rating,
    title: r.title,
    body: r.body,
    fitFeedback: r.fit_feedback,
    verifiedPurchase: r.verified_purchase === 1,
    isFeatured: r.is_featured === 1,
    adminReply: r.admin_reply,
    createdAt: r.created_at,
  }));

  const count = items.length;
  const avg = count > 0 ? Number((items.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1)) : 0;

  return c.json({
    success: true,
    data: {
      summary: {
        count,
        averageRating: avg,
        fitBreakdown: {
          runsSmall: items.filter((r) => r.fitFeedback === 'runs_small').length,
          trueToSize: items.filter((r) => r.fitFeedback === 'true_to_size').length,
          runsLarge: items.filter((r) => r.fitFeedback === 'runs_large').length,
        },
      },
      items,
    },
  });
});

const submitReviewSchema = z.object({
  authorName: z.string().min(2).max(80),
  authorEmail: z.string().email().toLowerCase(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(2).max(120),
  body: z.string().min(10).max(1500),
  fitFeedback: z.enum(['runs_small', 'true_to_size', 'runs_large']).default('true_to_size'),
});

// ─── POST /api/reviews/product/:slug ─────────────────────────────────────────
reviews.post(
  '/product/:slug',
  authOptional,
  zValidator('json', submitReviewSchema),
  async (c) => {
    const slug = c.req.param('slug').trim();
    const input = c.req.valid('json');
    const userId = c.get('userId') ?? null;
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';

    const limit = await checkD1RateLimit(c.env.DB, `review_post:${ip}`, 5, 3600);
    if (!limit.allowed) {
      return c.json(createRateLimitResponse('Review rate limit reached. Please try again later.'), 429);
    }

    const product = await c.env.DB
      .prepare(`SELECT id FROM products WHERE slug = ?1 AND is_active = 1 LIMIT 1`)
      .bind(slug)
      .first<{ id: string }>();

    if (!product) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
        404,
      );
    }

    const settingsRow = await c.env.DB
      .prepare(`SELECT settings_json FROM store_settings WHERE id = 'default' LIMIT 1`)
      .first<{ settings_json: string }>();
    const settings = safeJsonParse<Record<string, unknown>>(settingsRow?.settings_json, {});
    const allowWithoutPurchase = Boolean(settings.allowReviewsWithoutPurchase ?? true);
    const autoApprove = Boolean(settings.autoApproveReviews ?? false);

    // Check if authenticated user (or email) completed an order containing this product
    let verifiedPurchase = 0;
    const purchaseRow = await c.env.DB
      .prepare(
        `SELECT o.id FROM orders o
         INNER JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE (o.user_id = ?1 OR LOWER(u.email) = LOWER(?2))
           AND oi.product_id = ?3
           AND o.payment_status = 'paid'
         LIMIT 1`,
      )
      .bind(userId ?? '', input.authorEmail, product.id)
      .first<{ id: string }>();

    if (purchaseRow) verifiedPurchase = 1;

    if (!allowWithoutPurchase && verifiedPurchase === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PURCHASE_REQUIRED',
            message: 'Only verified purchasers of this piece may submit a review.',
            status: 403,
          },
        },
        403,
      );
    }

    const id = generateId('revw_');
    const now = nowIso();
    const status = autoApprove ? 'approved' : 'pending';

    await c.env.DB
      .prepare(
        `INSERT INTO product_reviews
         (id, product_id, user_id, author_name, author_email, rating, title, body, fit_feedback, verified_purchase, is_featured, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, ?12, ?12)`,
      )
      .bind(
        id,
        product.id,
        userId,
        input.authorName.trim(),
        input.authorEmail,
        input.rating,
        input.title.trim(),
        input.body.trim(),
        input.fitFeedback,
        verifiedPurchase,
        status,
        now,
      )
      .run();

    return c.json(
      {
        success: true,
        data: {
          id,
          status,
          verifiedPurchase: verifiedPurchase === 1,
          message: autoApprove
            ? 'Thank you. Your review has been published.'
            : 'Thank you. Your review has been received for atelier moderation.',
        },
      },
      201,
    );
  },
);

export default reviews;
