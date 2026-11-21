import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache } from '../../services/storefrontCache.js';
import { getLiveFxSnapshot } from '../../services/fxRates.js';

const settings = new Hono<{ Bindings: Env }>();

const patchSettingsSchema = z
  .object({
    freeShippingThresholdPaise: z.number().int().min(0).optional(),
    standardShippingPaise: z.number().int().min(0).optional(),
    shiprocketPickupPincode: z.string().max(12).optional(),
    taxInclusive: z.boolean().optional(),
    gstPercent: z.number().min(0).max(28).optional(),
    returnWindowDays: z.number().int().min(0).max(90).optional(),
    upiMaxPaise: z.number().int().min(0).optional(),
    panVerificationThresholdPaise: z.number().int().min(0).optional(),
    cartReservationMinutes: z.number().int().min(5).max(120).optional(),
    maxCartItems: z.number().int().min(1).max(50).optional(),
    enableFitFinder: z.boolean().optional(),
    enableReviewsOnPdp: z.boolean().optional(),
    requireVerifiedPurchase: z.boolean().optional(),
    allowReviewsWithoutPurchase: z.boolean().optional(),
    autoApproveReviews: z.boolean().optional(),
    enableTestCheckout: z.boolean().optional(),
    primaryGateway: z.enum(['razorpay', 'cashfree']).optional(),
    enableRazorpay: z.boolean().optional(),
    enableCashfree: z.boolean().optional(),
    enableCod: z.boolean().optional(),
    codEnabled: z.boolean().optional(),
    codMaxOrderPaise: z.number().int().min(0).optional(),
    codMaxPaise: z.number().int().min(0).optional(),
    codFeePaise: z.number().int().min(0).optional(),
    autoRefundDuplicateCapture: z.boolean().optional(),
    fxMode: z.enum(['auto', 'manual']).optional(),
    fxSpreadPercent: z.number().min(0).max(15).optional(),
    enabledMarkets: z.array(z.string().min(2).max(4)).optional(),
    pdpShowExclusiveBanner: z.boolean().optional(),
    pdpExclusiveBannerText: z.string().max(200).optional(),
    pdpShippingSummary: z.string().max(300).optional(),
    cartGiftNoteEnabled: z.boolean().optional(),
    cartTaxNote: z.string().max(300).optional(),
    robotsDisallowPaths: z.array(z.string().max(120)).optional(),
  })
  .strict();

// GET /fx — view all 12 global markets + current live/manual FX rates
settings.get('/fx', requirePermission('settings.write', 'dashboard.read', 'catalog.read'), async (c) => {
  const snapshot = await getLiveFxSnapshot(c.env, false);
  return c.json({ success: true, data: snapshot });
});

// POST /fx/refresh — force-refresh live FX rates from upstream into KV immediately
settings.post('/fx/refresh', requirePermission('settings.write'), async (c) => {
  const snapshot = await getLiveFxSnapshot(c.env, true);
  await auditAdminAction(c, 'REFRESH_FX_RATES', 'store_settings', 'fx');
  return c.json({ success: true, data: snapshot });
});

// GET / — returns store_settings singleton
settings.get('/', requirePermission('settings.write', 'dashboard.read', 'orders.read', 'health.read'), async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT settings_json FROM store_settings WHERE id = 'default'`,
  ).first<{ settings_json: string }>();
  const data = row ? JSON.parse(row.settings_json) : {};
  return c.json({ success: true, data });
});

// PATCH / — update store_settings with strict validation & audit trail
settings.patch('/', requirePermission('settings.write'), zValidator('json', patchSettingsSchema), async (c) => {
  const body = c.req.valid('json');
  const actor = c.get('userEmail') ?? c.get('userId') ?? 'admin';
  const row = await c.env.DB.prepare(
    `SELECT settings_json FROM store_settings WHERE id = 'default'`,
  ).first<{ settings_json: string }>();
  const existing = row ? JSON.parse(row.settings_json) : {};
  const merged = { ...existing, ...body };
  if (body.requireVerifiedPurchase !== undefined) {
    merged.allowReviewsWithoutPurchase = !body.requireVerifiedPurchase;
  }
  await c.env.DB.prepare(
    `INSERT INTO store_settings (id, settings_json, updated_by, updated_at)
     VALUES ('default', ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_by = excluded.updated_by, updated_at = datetime('now')`,
  )
    .bind(JSON.stringify(merged), actor)
    .run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'UPDATE_STORE_SETTINGS', 'store_settings', 'default', body);
  return c.json({ success: true, data: merged });
});

// POST /cache/flush
settings.post('/cache/flush', requirePermission('settings.write'), async (c) => {
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'FLUSH_STOREFRONT_CACHE', 'store_settings', 'cache');
  return c.json({ success: true, data: { flushed: true } });
});

export default settings;
