import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiCartSummary, ApiCartItem } from '../types/api.js';
import { resolveStorePolicy } from '../config/policy.js';
import { authOptional, authRequired } from '../middleware/auth.js';
import {
  findCart,
  getOrCreateCart,
  getCartWithItems,
  getCartItemVariantQty,
  addCartItem,
  updateCartItemQty,
  removeCartItem,
  clearCart,
  mergeGuestCart,
} from '../db/queries/cart.js';
import { getVariantById } from '../db/queries/products.js';

const cart = new Hono<{ Bindings: Env }>();

function getCartIdentity(c: any): { userId?: string; sessionId?: string } {
  const userId: string | undefined = c.get('userId');
  const rawSid = c.req.header('x-session-id')?.trim();
  const sessionId = rawSid && /^sess_[a-zA-Z0-9_-]{8,80}$/.test(rawSid) ? rawSid : undefined;
  return { userId, sessionId };
}

function buildSummary(items: ApiCartItem[], freeThresholdPaise: number): ApiCartSummary {
  const subtotalPaise = items.reduce(
    (acc: number, item: ApiCartItem) => acc + item.pricePaise * item.qty,
    0,
  );
  return {
    items,
    subtotalPaise,
    subtotalNum: Math.round(subtotalPaise / 100),
    subtotalFormatted: `₹ ${(subtotalPaise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    qualifiesFreeShipping: subtotalPaise >= freeThresholdPaise,
  };
}

// ─── GET /api/cart (read-only: never inserts empty guest cart rows) ─────────

cart.get('/', authOptional, async (c) => {
  const policy = resolveStorePolicy(c.env);
  const identity = getCartIdentity(c);
  if (!identity.userId && !identity.sessionId) {
    return c.json({ success: true, data: buildSummary([], policy.freeShippingThresholdPaise) });
  }

  const existingCart = await findCart(c.env.DB, identity);
  if (!existingCart) {
    return c.json({ success: true, data: buildSummary([], policy.freeShippingThresholdPaise) });
  }

  const result = await getCartWithItems(c.env.DB, existingCart.id);
  const items = result?.items ?? [];

  return c.json({ success: true, data: buildSummary(items, policy.freeShippingThresholdPaise) });
});

// ─── POST /api/cart/items ───────────────────────────────────────────────────

const addItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});

cart.post('/items', authOptional, zValidator('json', addItemSchema), async (c) => {
  const policy = resolveStorePolicy(c.env);
  const { variantId, quantity } = c.req.valid('json');
  const identity = getCartIdentity(c);

  if (!identity.userId && !identity.sessionId) {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid x-session-id header required for guest cart.', status: 400 },
      },
      400,
    );
  }

  const variant = await getVariantById(c.env.DB, variantId);
  if (!variant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product variant not found.', status: 404 } },
      404,
    );
  }

  const cartRecord = await getOrCreateCart(c.env.DB, identity);
  const existingQty = await getCartItemVariantQty(c.env.DB, cartRecord.id, variantId);
  const newCumulativeQty = existingQty + quantity;
  const available = Math.max(0, variant.stock - variant.reserved_stock);

  if (newCumulativeQty > 10) {
    return c.json(
      {
        success: false,
        error: { code: 'MAX_QTY_EXCEEDED', message: 'Maximum 10 units per variant allowed in bag.', status: 400 },
      },
      400,
    );
  }

  if (available < newCumulativeQty) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message:
            available === 0
              ? 'This variant is currently out of stock.'
              : `Only ${available} unit(s) available (you already have ${existingQty} in bag).`,
          status: 409,
        },
      },
      409,
    );
  }

  await addCartItem(c.env.DB, cartRecord.id, variantId, quantity);

  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  const items = result?.items ?? [];

  return c.json(
    { success: true, data: buildSummary(items, policy.freeShippingThresholdPaise) },
    201,
  );
});

// ─── PATCH /api/cart/items/:itemId ──────────────────────────────────────────

const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(10),
});

cart.patch('/items/:itemId', authOptional, zValidator('json', updateItemSchema), async (c) => {
  const policy = resolveStorePolicy(c.env);
  const cartItemId = c.req.param('itemId');
  const { quantity } = c.req.valid('json');
  const identity = getCartIdentity(c);

  if (!identity.userId && !identity.sessionId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'x-session-id header required.', status: 400 } },
      400,
    );
  }

  const cartRecord = await findCart(c.env.DB, identity);
  if (!cartRecord) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Cart not found.', status: 404 } },
      404,
    );
  }

  const cartItemRow = await c.env.DB
    .prepare(
      `SELECT ci.id, ci.variant_id, pv.stock, pv.reserved_stock, pv.is_active
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.id = ?1 AND ci.cart_id = ?2 LIMIT 1`,
    )
    .bind(cartItemId, cartRecord.id)
    .first<{
      id: string;
      variant_id: string;
      stock: number;
      reserved_stock: number;
      is_active: number;
    }>();

  if (!cartItemRow) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Cart item not found.', status: 404 } },
      404,
    );
  }

  const available = Math.max(0, cartItemRow.stock - cartItemRow.reserved_stock);
  if (cartItemRow.is_active !== 1 || available < quantity) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: available === 0 ? 'Item is currently out of stock.' : `Only ${available} unit(s) available.`,
          status: 409,
        },
      },
      409,
    );
  }

  await updateCartItemQty(c.env.DB, cartItemId, cartRecord.id, quantity);
  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  return c.json({
    success: true,
    data: buildSummary(result?.items ?? [], policy.freeShippingThresholdPaise),
  });
});

// ─── DELETE /api/cart/items/:itemId ─────────────────────────────────────────

cart.delete('/items/:itemId', authOptional, async (c) => {
  const policy = resolveStorePolicy(c.env);
  const cartItemId = c.req.param('itemId');
  const identity = getCartIdentity(c);

  if (!identity.userId && !identity.sessionId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'x-session-id header required.', status: 400 } },
      400,
    );
  }

  const cartRecord = await findCart(c.env.DB, identity);
  if (!cartRecord) {
    return c.json({ success: true, data: buildSummary([], policy.freeShippingThresholdPaise) });
  }

  await removeCartItem(c.env.DB, cartItemId, cartRecord.id);
  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  return c.json({
    success: true,
    data: buildSummary(result?.items ?? [], policy.freeShippingThresholdPaise),
  });
});

// ─── DELETE /api/cart ───────────────────────────────────────────────────────

cart.delete('/', authOptional, async (c) => {
  const policy = resolveStorePolicy(c.env);
  const identity = getCartIdentity(c);
  if (!identity.userId && !identity.sessionId) {
    return c.json({ success: true, data: buildSummary([], policy.freeShippingThresholdPaise) });
  }
  const cartRecord = await findCart(c.env.DB, identity);
  if (cartRecord) {
    await clearCart(c.env.DB, cartRecord.id);
  }
  return c.json({ success: true, data: buildSummary([], policy.freeShippingThresholdPaise) });
});

// ─── POST /api/cart/merge ───────────────────────────────────────────────────

const mergeSchema = z.object({
  sessionId: z.string().regex(/^sess_[a-zA-Z0-9_-]{8,80}$/, 'Invalid session identifier format').optional(),
});

cart.post('/merge', authRequired, zValidator('json', mergeSchema), async (c) => {
  const policy = resolveStorePolicy(c.env);
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const headerSid = c.req.header('x-session-id')?.trim();
  const targetSessionId =
    headerSid && /^sess_[a-zA-Z0-9_-]{8,80}$/.test(headerSid) ? headerSid : body.sessionId;

  if (targetSessionId) {
    await mergeGuestCart(c.env.DB, targetSessionId, userId);
  }

  const cartRecord = await findCart(c.env.DB, { userId });
  const result = cartRecord ? await getCartWithItems(c.env.DB, cartRecord.id) : null;
  return c.json({
    success: true,
    data: buildSummary(result?.items ?? [], policy.freeShippingThresholdPaise),
  });
});

export default cart;
