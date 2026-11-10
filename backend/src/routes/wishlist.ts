import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import type { DbProduct, DbWishlist } from '../types/models.js';
import { authRequired } from '../middleware/auth.js';
import { generateId } from '../services/crypto.js';
import { formatPaiseToDisplay, paiseToRupees } from '../services/money.js';
import { PREFIX_WISHLIST } from '../config/constants.js';
import { nowIso } from '../db/client.js';

const wishlist = new Hono<{ Bindings: Env }>();

// ─── GET /api/wishlist ───────────────────────────────────────────────────────

wishlist.get('/', authRequired, async (c) => {
  const userId = c.get('userId');

  const result = await c.env.DB
    .prepare(
      `SELECT
         w.id AS wishlist_id,
         p.id, p.slug, p.title, p.badge, p.default_img, p.hover_img,
         p.price_paise, p.compare_paise, p.section_group
       FROM wishlists w
       INNER JOIN products p ON p.id = w.product_id AND p.is_active = 1
       WHERE w.user_id = ?1
       ORDER BY w.created_at DESC`,
    )
    .bind(userId)
    .all<{
      wishlist_id: string;
      id: string;
      slug: string;
      title: string;
      badge: string | null;
      default_img: string;
      hover_img: string;
      price_paise: number;
      compare_paise: number | null;
      section_group: string;
    }>();

  const items = (result.results ?? []).map((r) => ({
    wishlistId: r.wishlist_id,
    id: r.id,
    slug: r.slug,
    title: r.title,
    badge: r.badge,
    defaultImg: r.default_img,
    hoverImg: r.hover_img,
    link: `/products/${r.slug}`,
    price: formatPaiseToDisplay(r.price_paise),
    priceNum: paiseToRupees(r.price_paise),
    pricePaise: r.price_paise,
  }));

  return c.json({ success: true, data: { items } });
});

// ─── POST /api/wishlist — add product ───────────────────────────────────────

wishlist.post('/', authRequired, async (c) => {
  const userId = c.get('userId');
  let body: { productId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON.', status: 400 } },
      400,
    );
  }

  const { productId } = body;
  if (!productId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'productId is required.', status: 400 } },
      400,
    );
  }

  // Check product exists
  const product = await c.env.DB
    .prepare(`SELECT id FROM products WHERE id = ?1 AND is_active = 1`)
    .bind(productId)
    .first<{ id: string }>();

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found.', status: 404 } },
      404,
    );
  }

  // Upsert (ignore if already in wishlist)
  const id = generateId(PREFIX_WISHLIST);
  await c.env.DB
    .prepare(
      `INSERT OR IGNORE INTO wishlists (id, user_id, product_id, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(id, userId, productId, nowIso())
    .run();

  return c.json({ success: true, data: { added: true, productId } }, 201);
});

// ─── DELETE /api/wishlist/:productId ─────────────────────────────────────────

wishlist.delete('/:productId', authRequired, async (c) => {
  const userId = c.get('userId');
  const productId = c.req.param('productId');

  await c.env.DB
    .prepare(`DELETE FROM wishlists WHERE user_id = ?1 AND product_id = ?2`)
    .bind(userId, productId)
    .run();

  return c.json({ success: true, data: { removed: true, productId } });
});

// ─── GET /api/wishlist/check/:productId ──────────────────────────────────────

wishlist.get('/check/:productId', authRequired, async (c) => {
  const userId = c.get('userId');
  const productId = c.req.param('productId');

  const row = await c.env.DB
    .prepare(`SELECT id FROM wishlists WHERE user_id = ?1 AND product_id = ?2 LIMIT 1`)
    .bind(userId, productId)
    .first<{ id: string }>();

  return c.json({ success: true, data: { inWishlist: !!row } });
});

export default wishlist;

