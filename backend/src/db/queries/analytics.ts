import type { D1Database } from '@cloudflare/workers-types';
import { formatPaiseToDisplay } from '../../services/money.js';

// ─── Dashboard overview ─────────────────────────────────────────────────────

export interface DashboardOverview {
  todayRevenuePaise: number;
  todayRevenueFormatted: string;
  todayOrderCount: number;
  pendingOrderCount: number;
  totalCustomers: number;
  lowStockCount: number;
}

export async function getDashboardOverview(db: D1Database): Promise<DashboardOverview> {
  const [todayRev, pendingOrders, totalCustomers, lowStock] = await db.batch([
    db.prepare(
      `SELECT
         COALESCE(SUM(total_paise), 0) AS revenue,
         COUNT(*) AS cnt
       FROM orders
       WHERE payment_status = 'paid'
         AND date(created_at) = date('now')`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS cnt FROM orders WHERE status = 'pending' AND payment_status = 'pending'`,
    ),
    db.prepare(`SELECT COUNT(*) AS cnt FROM users WHERE role = 'customer' AND is_active = 1`),
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
    pendingOrderCount: ((pendingOrders.results?.[0] as { cnt: number })?.cnt ?? 0),
    totalCustomers: ((totalCustomers.results?.[0] as { cnt: number })?.cnt ?? 0),
    lowStockCount: ((lowStock.results?.[0] as { cnt: number })?.cnt ?? 0),
  };
}

// ─── Revenue by day ─────────────────────────────────────────────────────────

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
  const result = await db
    .prepare(
      `SELECT
         date(created_at) AS date,
         COALESCE(SUM(total_paise), 0) AS revenuePaise,
         COUNT(*) AS orderCount
       FROM orders
       WHERE payment_status = 'paid'
         AND created_at >= date('now', ?1)
       GROUP BY date(created_at)
       ORDER BY date ASC`,
    )
    .bind(`-${days} days`)
    .all<{ date: string; revenuePaise: number; orderCount: number }>();

  return (result.results ?? []).map((r) => ({
    date: r.date,
    revenuePaise: r.revenuePaise,
    revenueFormatted: formatPaiseToDisplay(r.revenuePaise),
    orderCount: r.orderCount,
  }));
}

// ─── Top products by revenue ─────────────────────────────────────────────────

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
  const result = await db
    .prepare(
      `SELECT
         oi.product_id  AS productId,
         oi.title_snapshot AS title,
         SUM(oi.total_paise) AS totalSoldPaise,
         SUM(oi.quantity)    AS unitsSold
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.payment_status = 'paid'
         AND o.created_at >= date('now', ?1)
       GROUP BY oi.product_id, oi.title_snapshot
       ORDER BY totalSoldPaise DESC
       LIMIT ?2`,
    )
    .bind(`-${days} days`, limit)
    .all<TopProduct>();

  return (result.results ?? []).map((r) => ({
    ...r,
    totalSoldFormatted: formatPaiseToDisplay(r.totalSoldPaise),
  }));
}

// ─── Recent orders (admin feed) ──────────────────────────────────────────────

export async function getRecentOrders(db: D1Database, limit = 10) {
  const result = await db
    .prepare(
      `SELECT o.id, o.order_number, o.status, o.payment_status,
              o.total_paise, o.created_at, u.email AS customer_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT ?1`,
    )
    .bind(limit)
    .all<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      total_paise: number;
      created_at: string;
      customer_email: string;
    }>();
  return (result.results ?? []).map((r) => ({
    ...r,
    totalFormatted: formatPaiseToDisplay(r.total_paise),
  }));
}

