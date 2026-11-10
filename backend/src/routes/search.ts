import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import { searchProducts } from '../db/queries/products.js';
import { formatPaiseToDisplay, paiseToRupees } from '../services/money.js';

const search = new Hono<{ Bindings: Env }>();

// ─── GET /api/search?q=&limit= ───────────────────────────────────────────────

search.get('/', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const limit = Math.min(Number(c.req.query('limit') ?? '12'), 24);

  if (q.length < 2) {
    return c.json({ success: true, data: { items: [], query: q } });
  }

  const rows = await searchProducts(c.env.DB, q, limit);

  const items = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    badge: p.badge ?? null,
    defaultImg: p.default_img,
    link: `/products/${p.slug}`,
    price: formatPaiseToDisplay(p.price_paise),
    priceNum: paiseToRupees(p.price_paise),
    pricePaise: p.price_paise,
    sectionGroup: p.section_group,
  }));

  return c.json({ success: true, data: { items, query: q } });
});

export default search;

