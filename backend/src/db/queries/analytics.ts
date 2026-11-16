import type { D1Database } from '@cloudflare/workers-types';
import { formatPaiseToDisplay } from '../../services/money.js';

export interface DashboardOverview {
  todayRevenuePaise: number;
  todayRevenueFormatted: string;
  todayOrderCount: number;
  pendingOrderCount: number;
  totalCustomers: number;
  lowStockCount: number;
}

const PAID_NET_REVENUE_FILTER = `payment_status IN ('paid', 'partially_refunded') AND status != 'cancelled' AND status != 'refunded'`;

export async function getDashboardOverview(db: D1Database): Promise<DashboardOverview> {
  const [todayRev, pendingOrders, totalCustomers, lowStock] = await db.batch([
    db.prepare(
      `SELECT
         COALESCE(SUM(MAX(0, total_paise - COALESCE(refunded_paise, 0))), 0) AS revenue,
         COUNT(*) AS cnt
       FROM orders
       WHERE ${PAID_NET_REVENUE_FILTER}
         AND date(created_at) = date('now')`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS cnt FROM orders WHERE status IN ('pending', 'awaiting_capture', 'confirmed_needs_allocation')`,
    ),
    db.prepare(`SELECT COUNT(*) AS cnt FROM users WHERE role = 'customer' AND is_active = 1 AND deleted_at IS NULL`),
    db.prepare(
      `SELECT COUNT(*) AS cnt FROM product_variants WHERE (stock - reserved_stock) <= 3 AND is_active = 1`,
    ),
  ]);

  const todayRow = todayRev.results?.[0] as { revenue: number; cnt: number } | undefined;
  const revenuePaise = todayRow?.revenue ?? 0;

  return {
    todayRevenuePaise: revenuePaise,
    todayRevenueFormatted: formatPaiseToDisplay(revenuePaise),
    todayOrderCount: todayRow?.cnt ?? 0,
    pendingOrderCount: (pendingOrders.results?.[0] as { cnt: number })?.cnt ?? 0,
    totalCustomers: (totalCustomers.results?.[0] as { cnt: number })?.cnt ?? 0,
    lowStockCount: (lowStock.results?.[0] as { cnt: number })?.cnt ?? 0,
  };
}

export interface RevenueByDay {
  date: string;
  revenuePaise: number;
  revenueFormatted: string;
  orderCount: number;
}

export async function getRevenueByDay(
  db: D1Database,
  days = 30,
): Promise<RevenueByDay[]> {
  const safeDays = Math.min(365, Math.max(1, Math.floor(days)));
  const result = await db
    .prepare(
      `SELECT
         date(created_at) AS date,
         COALESCE(SUM(MAX(0, total_paise - COALESCE(refunded_paise, 0))), 0) AS revenuePaise,
         COUNT(*) AS orderCount
       FROM orders
       WHERE ${PAID_NET_REVENUE_FILTER}
         AND created_at >= date('now', ?1)
       GROUP BY date(created_at)
       ORDER BY date ASC`,
    )
    .bind(`-${safeDays} days`)
    .all<{ date: string; revenuePaise: number; orderCount: number }>();

  return (result.results ?? []).map((r) => ({
    date: r.date,
    revenuePaise: r.revenuePaise,
    revenueFormatted: formatPaiseToDisplay(r.revenuePaise),
    orderCount: r.orderCount,
  }));
}

export interface TopProduct {
  productId: string;
  title: string;
  totalSoldPaise: number;
  totalSoldFormatted: string;
  unitsSold: number;
}

export async function getTopProducts(
  db: D1Database,
  days = 30,
  limit = 10,
): Promise<TopProduct[]> {
  const safeDays = Math.min(365, Math.max(1, Math.floor(days)));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const result = await db
    .prepare(
      `SELECT
         oi.product_id AS productId,
         oi.title_snapshot AS title,
         SUM(MAX(0, oi.total_paise - COALESCE(oi.discount_paise, 0))) AS totalSoldPaise,
         SUM(MAX(0, oi.quantity - COALESCE(oi.refunded_qty, 0))) AS unitsSold
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.payment_status IN ('paid', 'partially_refunded')
         AND o.status NOT IN ('cancelled', 'refunded')
         AND o.created_at >= date('now', ?1)
       GROUP BY oi.product_id, oi.title_snapshot
       ORDER BY totalSoldPaise DESC
       LIMIT ?2`,
    )
    .bind(`-${safeDays} days`, safeLimit)
    .all<TopProduct>();

  return (result.results ?? []).map((r) => ({
    ...r,
    totalSoldFormatted: formatPaiseToDisplay(r.totalSoldPaise),
  }));
}

export async function getRecentOrders(db: D1Database, limit = 10) {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const result = await db
    .prepare(
      `SELECT o.id, o.order_number, o.status, o.payment_status,
              o.total_paise, o.refunded_paise, o.created_at, u.email AS customer_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT ?1`,
    )
    .bind(safeLimit)
    .all<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      total_paise: number;
      refunded_paise: number;
      created_at: string;
      customer_email: string;
    }>();
  return (result.results ?? []).map((r) => ({
    ...r,
    totalFormatted: formatPaiseToDisplay(r.total_paise),
  }));
}
