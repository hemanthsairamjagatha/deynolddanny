import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { getDashboardOverview, getRevenueByDay, getTopProducts, getRecentOrders } from '../../db/queries/analytics.js';
import { getLowStockVariants } from '../../db/queries/inventory.js';

const dashboard = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/dashboard ────────────────────────────────────────────────

dashboard.get('/', async (c) => {
  const days = Number(c.req.query('days') ?? '30');

  const [overview, revenue, topProducts, recentOrders, lowStock] = await Promise.all([
    getDashboardOverview(c.env.DB),
    getRevenueByDay(c.env.DB, days),
    getTopProducts(c.env.DB, days, 10),
    getRecentOrders(c.env.DB, 10),
    getLowStockVariants(c.env.DB, 3),
  ]);

  return c.json({
    success: true,
    data: {
      overview,
      revenue,
      topProducts,
      recentOrders,
      lowStock,
    },
  });
});

export default dashboard;

