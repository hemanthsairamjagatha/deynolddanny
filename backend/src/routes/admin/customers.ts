import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { generateId } from '../../services/crypto.js';
import { nowIso, runBatch } from '../../db/client.js';

const adminCustomers = new Hono<{ Bindings: Env }>();

adminCustomers.get('/', async (c) => {
  const rawPage = Number(c.req.query('page') ?? '1');
  const rawLimit = Number(c.req.query('limit') ?? '20');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(50, Math.floor(rawLimit)) : 20;
  const offset = (page - 1) * limit;
  const search = c.req.query('search')?.trim();

  let where = `WHERE role = 'customer' AND deleted_at IS NULL`;
  const bindings: (string | number)[] = [];

  if (search) {
    where += ` AND (email LIKE ?1 OR full_name LIKE ?1)`;
    bindings.push(`%${search}%`);
  }

  const [countRes, dataRes] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM users ${where}`).bind(...bindings),
    c.env.DB
      .prepare(
        `SELECT id, email, full_name, phone, is_active, last_login_at, created_at,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = users.id) AS orders_count
         FROM users ${where}
         ORDER BY created_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
      )
      .bind(...bindings, limit, offset),
  ]);

  const total = (countRes.results?.[0] as { cnt: number })?.cnt ?? 0;
  const items = dataRes.results ?? [];

  return c.json({
    success: true,
    data: { items, customers: items, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

adminCustomers.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [user, orders, addresses] = await c.env.DB.batch([
    c.env.DB
      .prepare(`SELECT id, email, full_name, phone, role, is_active, last_login_at, created_at FROM users WHERE id = ?1`)
      .bind(id),
    c.env.DB
      .prepare(
        `SELECT id, order_number, order_number AS display_id, status, payment_status, total_paise, created_at
         FROM orders WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(id),
    c.env.DB
      .prepare(
        `SELECT id, full_name AS name, phone, line1, line2, city, state, pincode, is_default
         FROM addresses WHERE user_id = ?1 ORDER BY is_default DESC, created_at DESC`,
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
      orders: orders.results ?? [],
      addresses: addresses.results ?? [],
    },
  });
});

adminCustomers.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');
  const ip = c.req.header('CF-Connecting-IP') ?? null;

  let body: { isActive?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON.', status: 400 } },
      400,
    );
  }

  if (typeof body.isActive !== 'boolean') {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'isActive boolean is required.', status: 400 } },
      400,
    );
  }

  const now = nowIso();
  const updateRes = await c.env.DB
    .prepare(
      `UPDATE users
       SET is_active = ?1,
           token_version = token_version + 1,
           updated_at = ?2
       WHERE id = ?3 AND role = 'customer'`,
    )
    .bind(body.isActive ? 1 : 0, now, id)
    .run();

  if ((updateRes.meta.changes ?? 0) === 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND_OR_FORBIDDEN',
          message: 'Customer not found or cannot alter privileged staff status via this endpoint.',
          status: 404,
        },
      },
      404,
    );
  }

  if (!body.isActive) {
    await runBatch(c.env.DB, [
      c.env.DB.prepare(`DELETE FROM refresh_tokens WHERE user_id = ?1`).bind(id),
    ]);
  }

  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, 'CUSTOMER_STATUS', 'user', ?3, ?4, ?5, ?6)`,
    )
    .bind(generateId('log_'), adminId, id, JSON.stringify({ isActive: body.isActive }), ip, now)
    .run();

  return c.json({ success: true, data: { id, isActive: body.isActive } });
});

export default adminCustomers;
