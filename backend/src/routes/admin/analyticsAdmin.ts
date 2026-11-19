import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { requirePermission } from '../../middleware/adminAuth.js';
import { getDashboardOverview, getRevenueByDay, getTopProducts } from '../../db/queries/analytics.js';

const analyticsAdmin = new Hono<{ Bindings: Env }>();

// GET /dashboard — enhanced dashboard with period
analyticsAdmin.get('/dashboard', requirePermission('analytics.read'), async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query('days') ?? '30') || 30));
  const [overview, revenue, topProducts] = await Promise.all([
    getDashboardOverview(c.env.DB),
    getRevenueByDay(c.env.DB, days),
    getTopProducts(c.env.DB, days, 10),
  ]);
  const totalRevenuePaise = revenue.reduce((sum, r) => sum + r.revenuePaise, 0);
  const ordersCount = revenue.reduce((sum, r) => sum + r.orderCount, 0);
  return c.json({
    success: true,
    data: {
      overview,
      revenue,
      daily: revenue.map((r) => ({ date: r.date, revenue_paise: r.revenuePaise, orders: r.orderCount })),
      topProducts: topProducts.map((p) => ({
        id: p.productId,
        name: p.title,
        units_sold: p.unitsSold,
        revenue_paise: p.totalSoldPaise,
      })),
      period: days,
      totalRevenuePaise,
      ordersCount,
      lowStockCount: overview.lowStockCount,
    },
  });
});

// GET /events — query analytics_events
analyticsAdmin.get('/events', requirePermission('analytics.read'), async (c) => {
  const { event_type, event_name, limit = '100', offset = '0' } = c.req.query();
  const filterName = event_name ?? event_type;
  let sql = `SELECT id, event_name, event_name AS event_type, session_id, user_id, path, entity_id, value_paise, meta_json, created_at FROM analytics_events`;
  const params: unknown[] = [];
  if (filterName) {
    sql += ` WHERE event_name = ?`;
    params.push(filterName);
  }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Math.min(200, Math.max(1, Number(limit) || 100)), Math.max(0, Number(offset) || 0));
  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ success: true, data: rows.results });
});

export default analyticsAdmin;
