import type { D1Database } from '@cloudflare/workers-types';
import type { DbCart, DbCartItem } from '../../types/models.js';
import type { ApiCartItem } from '../../types/api.js';
import { formatPaiseToDisplay, paiseToRupees } from '../../services/money.js';
import { generateId } from '../../services/crypto.js';
import { PREFIX_CART, PREFIX_CART_ITEM } from '../../config/constants.js';
import { nowIso } from '../client.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CartWithItems {
  cart: DbCart;
  items: ApiCartItem[];
}

interface RawCartItem {
  cart_item_id: string;
  variant_id: string;
  product_id: string;
  quantity: number;
  title: string;
  size: string;
  color_name: string;
  color_hex: string;
  price_paise: number;
  default_img: string;
  stock: number;
  reserved_stock: number;
  slug: string;
}

// ─── Get or create cart ─────────────────────────────────────────────────────

export async function getOrCreateCart(
  db: D1Database,
  identity: { userId?: string; sessionId?: string },
): Promise<DbCart> {
  const { userId, sessionId } = identity;

  if (!userId && !sessionId) throw new Error('Must provide userId or sessionId');

  // Try to find existing cart
  let cart: DbCart | null = null;
  if (userId) {
    cart = await db
      .prepare(`SELECT * FROM carts WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`)
      .bind(userId)
      .first<DbCart>();
  } else if (sessionId) {
    cart = await db
      .prepare(`SELECT * FROM carts WHERE session_id = ?1 ORDER BY created_at ASC LIMIT 1`)
      .bind(sessionId)
      .first<DbCart>();
  }

  if (cart) return cart;

  // Create new cart
  const id = generateId(PREFIX_CART);
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO carts (id, user_id, session_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(id, userId ?? null, sessionId ?? null, now, now)
    .run();

  return { id, user_id: userId ?? null, session_id: sessionId ?? null, created_at: now, updated_at: now };
}

// ─── Full cart with enriched items ─────────────────────────────────────────

export async function getCartWithItems(
  db: D1Database,
  cartId: string,
): Promise<CartWithItems | null> {
  const cart = await db
    .prepare(`SELECT * FROM carts WHERE id = ?1`)
    .bind(cartId)
    .first<DbCart>();

  if (!cart) return null;

  const result = await db
    .prepare(
      `SELECT
         ci.id            AS cart_item_id,
         ci.variant_id,
         ci.quantity,
         pv.product_id,
         pv.size,
         pv.color_name,
         pv.color_hex,
         pv.stock,
         pv.reserved_stock,
         p.title,
         p.price_paise,
         p.default_img,
         p.slug
       FROM cart_items ci
       INNER JOIN product_variants pv ON pv.id = ci.variant_id AND pv.is_active = 1
       INNER JOIN products p ON p.id = pv.product_id AND p.is_active = 1
       WHERE ci.cart_id = ?1`,
    )
    .bind(cartId)
    .all<RawCartItem>();

  const items: ApiCartItem[] = (result.results ?? []).map((r) => ({
    cartItemId: r.cart_item_id,
    variantId: r.variant_id,
    productId: r.product_id,
    title: r.title,
    size: r.size,
    color: r.color_name,
    img: r.default_img,
    qty: r.quantity,
    availableStock: r.stock - r.reserved_stock,
    price: formatPaiseToDisplay(r.price_paise),
    priceNum: paiseToRupees(r.price_paise),
    pricePaise: r.price_paise,
  }));

  return { cart, items };
}

// ─── Add item ───────────────────────────────────────────────────────────────

export async function addCartItem(
  db: D1Database,
  cartId: string,
  variantId: string,
  qty: number,
): Promise<void> {
  const id = generateId(PREFIX_CART_ITEM);
  const now = nowIso();

  // Upsert: if the variant is already in cart, increase quantity
  await db.batch([
    db
      .prepare(
        `INSERT INTO cart_items (id, cart_id, variant_id, quantity, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(cart_id, variant_id) DO UPDATE SET
           quantity = quantity + excluded.quantity,
           updated_at = excluded.updated_at`,
      )
      .bind(id, cartId, variantId, qty, now),
    db
      .prepare(`UPDATE carts SET updated_at = ?1 WHERE id = ?2`)
      .bind(now, cartId),
  ]);
}

// ─── Update quantity ─────────────────────────────────────────────────────────

export async function updateCartItemQty(
  db: D1Database,
  cartItemId: string,
  cartId: string,
  qty: number,
): Promise<void> {
  const now = nowIso();
  await db.batch([
    db
      .prepare(`UPDATE cart_items SET quantity = ?1, updated_at = ?2 WHERE id = ?3 AND cart_id = ?4`)
      .bind(qty, now, cartItemId, cartId),
    db
      .prepare(`UPDATE carts SET updated_at = ?1 WHERE id = ?2`)
      .bind(now, cartId),
  ]);
}

// ─── Remove item ─────────────────────────────────────────────────────────────

export async function removeCartItem(
  db: D1Database,
  cartItemId: string,
  cartId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM cart_items WHERE id = ?1 AND cart_id = ?2`)
    .bind(cartItemId, cartId)
    .run();
}

// ─── Clear cart ───────────────────────────────────────────────────────────────

export async function clearCart(db: D1Database, cartId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM cart_items WHERE cart_id = ?1`).bind(cartId),
    db
      .prepare(`UPDATE carts SET updated_at = ?1 WHERE id = ?2`)
      .bind(nowIso(), cartId),
  ]);
}

// ─── Merge guest cart into user cart ─────────────────────────────────────────

export async function mergeGuestCart(
  db: D1Database,
  guestSessionId: string,
  userId: string,
): Promise<void> {
  // Find guest cart
  const guestCart = await db
    .prepare(`SELECT * FROM carts WHERE session_id = ?1 LIMIT 1`)
    .bind(guestSessionId)
    .first<DbCart>();

  if (!guestCart) return;

  // Find or create user cart
  let userCart = await db
    .prepare(`SELECT * FROM carts WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`)
    .bind(userId)
    .first<DbCart>();

  if (!userCart) {
    // Claim the guest cart as user cart
    await db
      .prepare(`UPDATE carts SET user_id = ?1, session_id = NULL, updated_at = ?2 WHERE id = ?3`)
      .bind(userId, nowIso(), guestCart.id)
      .run();
    return;
  }

  // Merge guest items into user cart (upsert each item)
  const guestItems = await db
    .prepare(`SELECT * FROM cart_items WHERE cart_id = ?1`)
    .bind(guestCart.id)
    .all<DbCartItem>();

  if (!guestItems.results?.length) return;

  const now = nowIso();
  const mergeStatements = (guestItems.results ?? []).map((item) =>
    db
      .prepare(
        `INSERT INTO cart_items (id, cart_id, variant_id, quantity, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(cart_id, variant_id) DO UPDATE SET
           quantity = MAX(quantity, excluded.quantity),
           updated_at = excluded.updated_at`,
      )
      .bind(generateId(PREFIX_CART_ITEM), userCart!.id, item.variant_id, item.quantity, now),
  );

  await db.batch([
    ...mergeStatements,
    db.prepare(`DELETE FROM cart_items WHERE cart_id = ?1`).bind(guestCart.id),
    db.prepare(`DELETE FROM carts WHERE id = ?1`).bind(guestCart.id),
    db.prepare(`UPDATE carts SET updated_at = ?1 WHERE id = ?2`).bind(now, userCart.id),
  ]);
}

// ─── Get cart by cartId (identity helper) ───────────────────────────────────

export async function getCartById(db: D1Database, cartId: string): Promise<DbCart | null> {
  return db.prepare(`SELECT * FROM carts WHERE id = ?1`).bind(cartId).first<DbCart>();
}

