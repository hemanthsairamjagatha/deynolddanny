import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { requirePermission, auditAdminAction } from '../../middleware/adminAuth.js';
import { assertSafeRuntimeSecrets } from '../../config/policy.js';
import { invalidateStorefrontCache } from '../../services/storefrontCache.js';
import { releaseExpiredReservations } from '../../services/stockEngine.cron.js';
import { nowIso } from '../../db/client.js';

const systemAdmin = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/system/health ────────────────────────────────────────────
systemAdmin.get('/health', requirePermission('health.read', 'settings.write', 'logs.read'), async (c) => {
  const env = c.env;
  const issues = assertSafeRuntimeSecrets(env);
  let dbOk = false;
  let kvOk = false;
  let catalogVersion = 'v1';

  try {
    const r = await env.DB.prepare(`SELECT 1 AS ok`).first<{ ok: number }>();
    dbOk = r?.ok === 1;
  } catch {}

  try {
    catalogVersion = (await env.CATALOG_KV.get('catalog:version', 'text')) || 'v1';
    kvOk = true;
  } catch {}

  const [counts, pendingHolds] = await Promise.all([
    env.DB
      .batch([
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM products WHERE is_active = 1`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM product_variants WHERE is_active = 1`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM orders`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM users WHERE role = 'customer'`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM newsletter_subscribers WHERE status = 'active'`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM media_assets`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM email_outbox WHERE status = 'failed'`),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM webhook_events WHERE status = 'failed'`),
      ])
      .catch(() => []),
    env.DB
      .prepare(
        `SELECT COUNT(*) AS cnt FROM orders
         WHERE status = 'pending' AND payment_status = 'pending' AND stock_released = 0 AND expires_epoch > 0 AND expires_epoch < ?1`,
      )
      .bind(Math.floor(Date.now() / 1000))
      .first<{ cnt: number }>()
      .catch(() => ({ cnt: 0 })),
  ]);

  const pick = (i: number) => Number(((counts[i]?.results?.[0] as { cnt?: number } | undefined)?.cnt) ?? 0);

  return c.json({
    success: true,
    data: {
      checkedAt: nowIso(),
      environment: env.ENVIRONMENT ?? 'production',
      catalogVersion,
      services: {
        d1Database: { ok: dbOk, detail: dbOk ? 'Connected & responding' : 'D1 probe failed' },
        edgeKvCache: { ok: kvOk, detail: kvOk ? `Connected (catalog ${catalogVersion})` : 'KV probe failed' },
        r2MediaBucket: { ok: Boolean(env.MEDIA_BUCKET), detail: env.MEDIA_BUCKET ? 'R2 bound for media uploads' : 'Using D1 media_blobs fallback' },
        emailDelivery: {
          ok: Boolean(env.RESEND_API_KEY && !env.RESEND_API_KEY.includes('placeholder')),
          detail: env.RESEND_FROM_EMAIL ? `Sender: ${env.RESEND_FROM_EMAIL}` : 'RESEND_FROM_EMAIL not set',
        },
        razorpay: {
          ok: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && !env.RAZORPAY_KEY_ID.includes('placeholder')),
          detail: env.RAZORPAY_KEY_ID ? `Key: ${env.RAZORPAY_KEY_ID.slice(0, 12)}…` : 'Not configured',
        },
        cashfree: {
          ok: Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY && !env.CASHFREE_APP_ID.includes('placeholder')),
          detail: env.CASHFREE_APP_ID
            ? `${env.CASHFREE_API_URL?.includes('sandbox') ? 'Sandbox' : 'Production'} (${env.CASHFREE_APP_ID.slice(0, 8)}…)`
            : 'Not configured',
        },
        shiprocket: {
          ok: Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD),
          detail: env.SHIPROCKET_EMAIL
            ? `Configured (pickup ${env.SHIPROCKET_PICKUP_PINCODE || 'not set'})`
            : 'Not configured',
        },
      },
      configIssues: issues,
      metrics: {
        activeProducts: pick(0),
        activeVariants: pick(1),
        totalOrders: pick(2),
        customers: pick(3),
        newsletterSubscribers: pick(4),
        mediaAssets: pick(5),
        failedEmails: pick(6),
        failedWebhooks: pick(7),
        expiredPendingHolds: Number(pendingHolds?.cnt ?? 0),
      },
    },
  });
});

// ─── POST /api/admin/system/reap-holds — Manually release expired stock holds
systemAdmin.post('/reap-holds', requirePermission('settings.write', 'inventory.adjust'), async (c) => {
  const result = await releaseExpiredReservations(null, c.env, c.executionCtx as any);
  await auditAdminAction(c, 'MANUAL_REAP_EXPIRED_HOLDS', 'system', 'cron', result);
  return c.json({ success: true, data: result });
});

// ─── POST /api/admin/system/flush-cache — Purge storefront & catalog KV caches
systemAdmin.post('/flush-cache', requirePermission('settings.write'), async (c) => {
  await invalidateStorefrontCache(c.env);
  try {
    await c.env.CATALOG_KV.put('catalog:version', `v_${Date.now()}`);
  } catch {}
  await auditAdminAction(c, 'FLUSH_ALL_EDGE_CACHES', 'system', 'cache');
  return c.json({ success: true, data: { flushed: true, at: nowIso() } });
});

export default systemAdmin;
