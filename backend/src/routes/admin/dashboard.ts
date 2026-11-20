import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { getDashboardOverview, getRevenueByDay, getTopProducts, getRecentOrders } from '../../db/queries/analytics.js';
import { getLowStockVariants } from '../../db/queries/inventory.js';

const dashboard = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/dashboard ────────────────────────────────────────────────

dashboard.get('/', async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query('days') ?? '30') || 30));

  const [overview, revenue, topProducts, recentOrders, lowStock, activeProdRow] = await Promise.all([
    getDashboardOverview(c.env.DB),
    getRevenueByDay(c.env.DB, days),
    getTopProducts(c.env.DB, days, 10),
    getRecentOrders(c.env.DB, 10),
    getLowStockVariants(c.env.DB, 5),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM products WHERE is_active = 1`).first<{ cnt: number }>(),
  ]);

  const totalRevenuePaise = revenue.reduce((sum, r) => sum + Number(r.revenuePaise ?? 0), 0);
  const totalOrders = revenue.reduce((sum, r) => sum + Number(r.orderCount ?? 0), 0);

  return c.json({
    success: true,
    data: {
      overview: {
        ...overview,
        totalRevenuePaise,
        totalOrders,
        activeProducts: Number(activeProdRow?.cnt ?? 0),
      },
      revenue: revenue.map((r) => ({ ...r, revenue: r.revenuePaise })),
      topProducts: topProducts.map((p) => ({
        ...p,
        name: p.title,
        units_sold: p.unitsSold,
        revenue_paise: p.totalSoldPaise,
      })),
      recentOrders: recentOrders.map((o) => ({
        ...o,
        display_id: o.order_number,
      })),
      lowStock: lowStock.map((v) => ({
        ...v,
        product_name: v.productTitle,
        color: v.colorName,
      })),
    },
  });
});

export default dashboard;

