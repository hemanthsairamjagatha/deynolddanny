import type { D1Database } from '@cloudflare/workers-types';
import type { DbOrder, DbOrderItem } from '../../types/models.js';
import type { ApiOrderItem } from '../../types/api.js';
import { formatPaiseToDisplay } from '../../services/money.js';
import { generateId } from '../../services/crypto.js';
import { PREFIX_ORDER, PREFIX_ORDER_ITEM, STOCK_RESERVATION_MINUTES } from '../../config/constants.js';
import { nowIso, generateOrderNumber, runBatch } from '../client.js';

export interface CreateOrderInput {
  userId: string;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  cfOrderId: string;
  idempotencyKey?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  couponCode?: string;
  customerNotes?: string;
}

export interface CreateOrderItemInput {
  orderId: string;
  variantId: string;
  productId: string;
  titleSnapshot: string;
  skuSnapshot: string;
  sizeSnapshot: string;
  colorSnapshot: string;
  imageSnapshot: string;
  unitPricePaise: number;
  quantity: number;
  discountPaise?: number;
  taxablePaise?: number;
  taxPaise?: number;
  hsnCode?: string | null;
  gstRateBps?: number;
}

export function prepareCreateOrderStatement(
  db: D1Database,
  id: string,
  orderNumber: string,
  input: CreateOrderInput,
  now: string,
  expiresEpoch: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO orders (
         id, order_number, user_id, status, subtotal_paise, shipping_paise,
         discount_paise, tax_paise, total_paise, currency, payment_status,
         refunded_paise, dispute_frozen, stock_committed, stock_released,
         idempotency_key, expires_epoch, cf_order_id,
         shipping_name, shipping_phone, shipping_line1, shipping_line2,
         shipping_city, shipping_state, shipping_pincode, shipping_country,
         coupon_code, customer_notes, created_at, updated_at
       ) VALUES (
         ?1,?2,?3,'pending',?4,?5,?6,?7,?8,'INR','pending',
         0,0,0,0,
         ?9,?10,?11,
         ?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?22
       )`,
    )
    .bind(
      id, orderNumber, input.userId,
      input.subtotalPaise, input.shippingPaise, input.discountPaise, input.taxPaise, input.totalPaise,
      input.idempotencyKey ?? null, expiresEpoch, input.cfOrderId,
      input.shippingName, input.shippingPhone, input.shippingLine1, input.shippingLine2 ?? null,
      input.shippingCity, input.shippingState, input.shippingPincode, input.shippingCountry,
      input.couponCode ?? null, input.customerNotes ?? null, now,
    );
}

export function prepareCreateOrderItemStatements(
  db: D1Database,
  items: CreateOrderItemInput[],
): D1PreparedStatement[] {
  return items.map((item) =>
    db
      .prepare(
        `INSERT INTO order_items (
           id, order_id, variant_id, product_id,
           title_snapshot, sku_snapshot, size_snapshot, color_snapshot, image_snapshot,
           unit_price_paise, quantity, total_paise,
           discount_paise, taxable_paise, tax_paise, hsn_code, gst_rate_bps
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`,
      )
      .bind(
        generateId(PREFIX_ORDER_ITEM),
        item.orderId,
        item.variantId,
        item.productId,
        item.titleSnapshot,
        item.skuSnapshot,
        item.sizeSnapshot,
        item.colorSnapshot,
        item.imageSnapshot,
        item.unitPricePaise,
        item.quantity,
        item.unitPricePaise * item.quantity,
        item.discountPaise ?? 0,
        item.taxablePaise ?? item.unitPricePaise * item.quantity,
        item.taxPaise ?? 0,
        item.hsnCode ?? null,
        item.gstRateBps ?? 0,
      ),
  );
}

/**
 * Atomically creates the pending order AND all its line-item snapshots inside a single D1 batch
 * BEFORE calling external payment gateways (so late webhooks or orphan sessions always have order_items).
 */
export async function createOrderWithItems(
  db: D1Database,
  input: Omit<CreateOrderInput, 'cfOrderId'> & { cfOrderId?: string },
  items: Omit<CreateOrderItemInput, 'orderId'>[],
): Promise<DbOrder> {
  const id = generateId(PREFIX_ORDER);
  const orderNumber = await generateOrderNumber(db);
  const now = nowIso();
  const expiresEpoch = Math.floor(Date.now() / 1000) + STOCK_RESERVATION_MINUTES * 60;
  const fullInput: CreateOrderInput = {
    ...input,
    cfOrderId: input.cfOrderId || `pending_${id}`,
  };

  const fullItems: CreateOrderItemInput[] = items.map((i) => ({ ...i, orderId: id }));

  await runBatch(db, [
    prepareCreateOrderStatement(db, id, orderNumber, fullInput, now, expiresEpoch),
    ...prepareCreateOrderItemStatements(db, fullItems),
  ]);

  return (await getOrderById(db, id))!;
}

export async function getOrderById(db: D1Database, id: string): Promise<DbOrder | null> {
  return db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first<DbOrder>();
}

export async function getOrderByCfOrderId(db: D1Database, cfOrderId: string): Promise<DbOrder | null> {
  return db
    .prepare(
      `SELECT o.* FROM orders o
       WHERE o.cf_order_id = ?1
          OR o.id = (SELECT pa.order_id FROM payment_attempts pa WHERE pa.gateway_order_id = ?1 LIMIT 1)
       LIMIT 1`,
    )
    .bind(cfOrderId)
    .first<DbOrder>();
}

export async function getOrderByNumber(db: D1Database, orderNumber: string): Promise<DbOrder | null> {
  return db.prepare(`SELECT * FROM orders WHERE order_number = ?1`).bind(orderNumber).first<DbOrder>();
}

export async function getUserOrders(
  db: D1Database,
  userId: string,
  page = 1,
  limit = 10,
): Promise<{ orders: DbOrder[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;
  const [countRes, dataRes] = await db.batch([
    db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?1`).bind(userId),
    db
      .prepare(
        `SELECT * FROM orders WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`,
      )
      .bind(userId, safeLimit, offset),
  ]);

  return {
    orders: (dataRes.results ?? []) as DbOrder[],
    total: (countRes.results?.[0] as { cnt: number })?.cnt ?? 0,
  };
}

export async function getOrderItems(db: D1Database, orderId: string): Promise<ApiOrderItem[]> {
  const result = await db
    .prepare(`SELECT * FROM order_items WHERE order_id = ?1`)
    .bind(orderId)
    .all<DbOrderItem>();

  return (result.results ?? []).map((r) => ({
    id: r.id,
    title: r.title_snapshot,
    sku: r.sku_snapshot,
    size: r.size_snapshot,
    color: r.color_snapshot,
    image: r.image_snapshot,
    unitPrice: formatPaiseToDisplay(r.unit_price_paise),
    unitPricePaise: r.unit_price_paise,
    quantity: r.quantity,
    totalPaise: r.total_paise,
  }));
}

export async function updateOrderStatus(
  db: D1Database,
  orderId: string,
  status: DbOrder['status'],
): Promise<void> {
  await db
    .prepare(`UPDATE orders SET status = ?1, updated_at = ?2 WHERE id = ?3`)
    .bind(status, nowIso(), orderId)
    .run();
}

export async function updateOrderPayment(
  db: D1Database,
  orderId: string,
  update: {
    paymentStatus: DbOrder['payment_status'];
    cfPaymentId?: string;
    paymentMethod?: string;
    paidAt?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE orders
       SET payment_status = ?1,
           cf_payment_id = COALESCE(?2, cf_payment_id),
           payment_method = COALESCE(?3, payment_method),
           paid_at = COALESCE(?4, paid_at),
           updated_at = ?5
       WHERE id = ?6`,
    )
    .bind(
      update.paymentStatus,
      update.cfPaymentId ?? null,
      update.paymentMethod ?? null,
      update.paidAt ?? null,
      nowIso(),
      orderId,
    )
    .run();
}

export async function updateOrderTracking(
  db: D1Database,
  orderId: string,
  update: {
    courierPartner?: string;
    trackingNumber?: string;
    shippedAt?: string;
    deliveredAt?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE orders
       SET courier_partner = COALESCE(?1, courier_partner),
           tracking_number = COALESCE(?2, tracking_number),
           shipped_at = COALESCE(?3, shipped_at),
           delivered_at = COALESCE(?4, delivered_at),
           status = CASE
             WHEN ?3 IS NOT NULL AND ?4 IS NULL THEN 'shipped'
             WHEN ?4 IS NOT NULL THEN 'delivered'
             ELSE status
           END,
           updated_at = ?5
       WHERE id = ?6`,
    )
    .bind(
      update.courierPartner ?? null,
      update.trackingNumber ?? null,
      update.shippedAt ?? null,
      update.deliveredAt ?? null,
      nowIso(),
      orderId,
    )
    .run();
}

export async function getAllOrdersAdmin(
  db: D1Database,
  page = 1,
  limit = 20,
  status?: string,
): Promise<{ orders: DbOrder[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  if (status) {
    const [countRes, dataRes] = await db.batch([
      db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE status = ?1`).bind(status),
      db
        .prepare(`SELECT * FROM orders WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`)
        .bind(status, safeLimit, offset),
    ]);

    return {
      orders: (dataRes.results ?? []) as DbOrder[],
      total: (countRes.results?.[0] as { cnt: number })?.cnt ?? 0,
    };
  }

  const [countRes, dataRes] = await db.batch([
    db.prepare(`SELECT COUNT(*) as cnt FROM orders`),
    db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?1 OFFSET ?2`).bind(safeLimit, offset),
  ]);

  return {
    orders: (dataRes.results ?? []) as DbOrder[],
    total: (countRes.results?.[0] as { cnt: number })?.cnt ?? 0,
  };
}
