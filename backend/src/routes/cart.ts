import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import type { ApiCartSummary, ApiCartItem } from '../types/api.js';
import { authOptional, authRequired } from '../middleware/auth.js';
import {
  getOrCreateCart,
  getCartWithItems,
  addCartItem,
  updateCartItemQty,
  removeCartItem,
  clearCart,
  mergeGuestCart,
} from '../db/queries/cart.js';
import { getVariantById } from '../db/queries/products.js';
import {
  FREE_SHIPPING_THRESHOLD_PAISE,
} from '../config/constants.js';

const cart = new Hono<{ Bindings: Env }>();

// ─── Helper: resolve cart identity ─────────────────────────────────────────

function getCartIdentity(c: any): { userId?: string; sessionId?: string } {
  const userId: string | undefined = c.get('userId');
  const sessionId = c.req.header('x-session-id') ?? undefined;
  return { userId, sessionId };
}

function buildSummary(items: ApiCartItem[]): ApiCartSummary {
  const subtotalPaise = items.reduce((acc: number, item: ApiCartItem) => acc + item.pricePaise * item.qty, 0);
  return {
    items,
    subtotalPaise,
    subtotalNum: Math.round(subtotalPaise / 100),
    subtotalFormatted: `₹ ${(subtotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    qualifiesFreeShipping: subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE,
  };
}

// ─── GET /api/cart ───────────────────────────────────────────────────────────

cart.get('/', authOptional, async (c) => {
  const identity = getCartIdentity(c);
  if (!identity.userId && !identity.sessionId) {
    return c.json({ success: true, data: buildSummary([]) });
  }

  const cartRecord = await getOrCreateCart(c.env.DB, identity);
  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  const items = result?.items ?? [];

  return c.json({ success: true, data: buildSummary(items) });
});

// ─── POST /api/cart/items — add item ────────────────────────────────────────

const addItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});

cart.post('/items', authOptional, zValidator('json', addItemSchema), async (c) => {
  const { variantId, quantity } = c.req.valid('json');
  const identity = getCartIdentity(c);

  if (!identity.userId && !identity.sessionId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'x-session-id header required for guest cart.', status: 400 } },
      400,
    );
  }

  // Verify variant exists and has enough stock
  const variant = await getVariantById(c.env.DB, variantId);
  if (!variant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product variant not found.', status: 404 } },
      404,
    );
  }

  const available = variant.stock - variant.reserved_stock;
  if (available < quantity) {
    return c.json(
      { success: false, error: { code: 'OUT_OF_STOCK', message: `Only ${available} units available.`, status: 409 } },
      409,
    );
  }

  const cartRecord = await getOrCreateCart(c.env.DB, identity);
  await addCartItem(c.env.DB, cartRecord.id, variantId, quantity);

  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  const items = result?.items ?? [];

  return c.json({ success: true, data: buildSummary(items) }, 201);
});

// ─── PATCH /api/cart/items/:itemId — update quantity ────────────────────────

const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(10),
});

cart.patch('/items/:itemId', authOptional, zValidator('json', updateItemSchema), async (c) => {
  const cartItemId = c.req.param('itemId');
  const { quantity } = c.req.valid('json');
  const identity = getCartIdentity(c);

  if (!identity.userId && !identity.sessionId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'x-session-id header required.', status: 400 } },
      400,
    );
  }

  const cartRecord = await getOrCreateCart(c.env.DB, identity);
  await updateCartItemQty(c.env.DB, cartItemId, cartRecord.id, quantity);

  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  const items = result?.items ?? [];

  return c.json({ success: true, data: buildSummary(items) });
});

// ─── DELETE /api/cart/items/:itemId ─────────────────────────────────────────

cart.delete('/items/:itemId', authOptional, async (c) => {
  const cartItemId = c.req.param('itemId');
  const identity = getCartIdentity(c);

  if (!identity.userId && !identity.sessionId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'x-session-id header required.', status: 400 } },
      400,
    );
  }

  const cartRecord = await getOrCreateCart(c.env.DB, identity);
  await removeCartItem(c.env.DB, cartItemId, cartRecord.id);

  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  const items = result?.items ?? [];

  return c.json({ success: true, data: buildSummary(items) });
});

// ─── DELETE /api/cart — clear cart ──────────────────────────────────────────

cart.delete('/', authOptional, async (c) => {
  const identity = getCartIdentity(c);
  if (!identity.userId && !identity.sessionId) {
    return c.json({ success: true, data: buildSummary([]) });
  }
  const cartRecord = await getOrCreateCart(c.env.DB, identity);
  await clearCart(c.env.DB, cartRecord.id);
  return c.json({ success: true, data: buildSummary([]) });
});

// ─── POST /api/cart/merge — merge guest cart after sign-in ──────────────────

const mergeSchema = z.object({
  sessionId: z.string().min(1),
});

cart.post('/merge', authRequired, zValidator('json', mergeSchema), async (c) => {
  const userId = c.get('userId');
  const { sessionId } = c.req.valid('json');

  await mergeGuestCart(c.env.DB, sessionId, userId);

  const cartRecord = await getOrCreateCart(c.env.DB, { userId });
  const result = await getCartWithItems(c.env.DB, cartRecord.id);
  const items = result?.items ?? [];

  return c.json({ success: true, data: buildSummary(items) });
});

export default cart;

