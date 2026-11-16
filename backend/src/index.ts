// =============================================================================
// DEYNOLD DANNY — Backend API Entry Point (Hono + Cloudflare Workers)
// =============================================================================

import { Hono } from 'hono';
import type { Env } from './types/bindings.js';
import type { EmailJob } from './types/api.js';
import { assertSafeRuntimeSecrets, resolveStorePolicy } from './config/policy.js';
import { cors } from './middleware/cors.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { setupErrorHandler } from './middleware/errorHandler.js';
import { adminAuth } from './middleware/adminAuth.js';
import { releaseExpiredReservations } from './services/stockEngine.cron.js';
import { processEmailQueue } from './queues/emailConsumer.js';

import auth from './routes/auth.js';
import products from './routes/products.js';
import categories from './routes/categories.js';
import cart from './routes/cart.js';
import checkout from './routes/checkout.js';
import payments from './routes/payments.js';
import orders from './routes/orders.js';
import wishlist from './routes/wishlist.js';
import users from './routes/users.js';
import search from './routes/search.js';
import newsletter from './routes/newsletter.js';
import contact from './routes/contact.js';
import coupons from './routes/coupons.js';
import shipping from './routes/shipping.js';
import webhooks from './routes/webhooks.js';
import admin from './routes/admin/index.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', securityHeaders);
app.use('*', cors);

// Runtime secret hygiene guard in staging/production
app.use('*', async (c, next) => {
  const path = c.req.path;
  if (path !== '/health') {
    const configIssues = assertSafeRuntimeSecrets(c.env);
    if (configIssues.length > 0 && c.env.ENVIRONMENT !== 'development') {
      console.error('[Config Guard] Blocked unsafe production config:', configIssues);
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Service configuration incomplete for live environment.',
            status: 503,
          },
        },
        503,
      );
    }
  }
  await next();
});

// ─── Health & Storefront Safe Config Endpoints ──────────────────────────────

app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      service: 'deynold-danny-api',
      environment: c.env.ENVIRONMENT ?? 'production',
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/health/deep', adminAuth, async (c) => {
  const issues = assertSafeRuntimeSecrets(c.env);
  let dbOk = false;
  let kvOk = false;

  try {
    const r = await c.env.DB.prepare(`SELECT 1 AS ok`).first<{ ok: number }>();
    dbOk = r?.ok === 1;
  } catch {}

  try {
    await c.env.CATALOG_KV.get('catalog:version', 'text');
    kvOk = true;
  } catch {}

  const ok = dbOk && kvOk && issues.length === 0;
  return c.json(
    {
      success: ok,
      data: {
        dbOk,
        kvOk,
        configIssues: issues,
        r2Bound: Boolean(c.env.MEDIA_BUCKET),
        queueBound: Boolean(c.env.EMAIL_QUEUE),
        shiprocketWebhookTokenSet: Boolean(c.env.SHIPROCKET_WEBHOOK_TOKEN),
      },
    },
    ok ? 200 : 503,
  );
});

app.get('/api/config/storefront', (c) => {
  const policy = resolveStorePolicy(c.env);
  return c.json({
    success: true,
    data: {
      currency: 'INR',
      freeShippingThresholdPaise: policy.freeShippingThresholdPaise,
      standardShippingPaise: policy.standardShippingPaise,
      taxInclusive: policy.taxInclusive,
      returnWindowDays: policy.returnWindowDays,
      upiMaxPaise: policy.upiMaxPaise,
      panVerificationThresholdPaise: policy.panVerificationThresholdPaise,
      courierCheckEnabled: Boolean(
        policy.shiprocketPickupPincode && c.env.SHIPROCKET_EMAIL && c.env.SHIPROCKET_PASSWORD,
      ),
    },
  });
});

// ─── Public API Routes ──────────────────────────────────────────────────────

app.route('/api/auth', auth);
app.route('/api/products', products);
app.route('/api/categories', categories);
app.route('/api/cart', cart);
app.route('/api/checkout', checkout);
app.route('/api/payments', payments);
app.route('/api/orders', orders);
app.route('/api/wishlist', wishlist);
app.route('/api/users', users);
app.route('/api/search', search);
app.route('/api/newsletter', newsletter);
app.route('/api/contact', contact);
app.route('/api/coupons', coupons);
app.route('/api/shipping', shipping);
app.route('/api/webhooks', webhooks);

// ─── Protected Admin Routes ─────────────────────────────────────────────────

app.route('/api/admin', admin);

setupErrorHandler(app);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(releaseExpiredReservations(event, env, ctx));
  },
  async queue(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
    await processEmailQueue(batch, env);
  },
};
