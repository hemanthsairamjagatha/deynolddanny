import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import type { DbUser } from '../../types/models.js';

const adminCustomers = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/customers ─────────────────────────────────────────────────

adminCustomers.get('/', async (c) => {
  const page = Number(c.req.query('page') ?? '1');
  const limit = Math.min(Number(c.req.query('limit') ?? '20'), 50);
  const offset = (Math.max(page, 1) - 1) * limit;
  const search = c.req.query('search')?.trim();

  let where = `WHERE role = 'customer'`;
  const bindings: (string | number)[] = [];

  if (search) {
    where += ` AND (email LIKE ?1 OR full_name LIKE ?1)`;
    bindings.push(`%${search}%`);
  }

  const [countRes, dataRes] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM users ${where}`).bind(...bindings),
    c.env.DB
      .prepare(
        `SELECT id, email, full_name, phone, is_active, last_login_at, created_at
         FROM users ${where}
         ORDER BY created_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
      )
      .bind(...bindings, limit, offset),
  ]);

  const total = (countRes.results?.[0] as { cnt: number })?.cnt ?? 0;
  const items = dataRes.results ?? [];

  return c.json({
    success: true,
    data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ─── GET /api/admin/customers/:id ────────────────────────────────────────────

adminCustomers.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [user, orders] = await c.env.DB.batch([
    c.env.DB
      .prepare(`SELECT id, email, full_name, phone, role, is_active, last_login_at, created_at FROM users WHERE id = ?1`)
      .bind(id),
    c.env.DB
      .prepare(
        `SELECT id, order_number, status, payment_status, total_paise, created_at
         FROM orders WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 10`,
      )
      .bind(id),
  ]);

  if (!user.results?.length) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.', status: 404 } },
      404,
    );
  }

  return c.json({
    success: true,
    data: {
      customer: user.results[0],
      recentOrders: orders.results ?? [],
    },
  });
});

// ─── PATCH /api/admin/customers/:id/status — deactivate/activate ─────────────

adminCustomers.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  let body: { isActive?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON.', status: 400 } },
      400,
    );
  }

  if (body.isActive === undefined) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'isActive is required.', status: 400 } },
      400,
    );
  }

  await c.env.DB
    .prepare(`UPDATE users SET is_active = ?1, updated_at = ?2 WHERE id = ?3`)
    .bind(body.isActive ? 1 : 0, new Date().toISOString(), id)
    .run();

  return c.json({ success: true, data: { id, isActive: body.isActive } });
});

export default adminCustomers;

