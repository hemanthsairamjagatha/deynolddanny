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
import storefront from './routes/storefront.js';
import publicMedia from './routes/media.js';
import publicReviews from './routes/reviews.js';
import publicAnalytics from './routes/analytics.js';
import admin from './routes/admin/index.js';

const app = new Hono<{ Bindings: Env }>();

// Apply strict API security headers & exact-origin CORS to API, media, and health routes
app.use('/api/*', securityHeaders);
app.use('/api/*', cors);
app.use('/media/*', securityHeaders);
app.use('/media/*', cors);
app.use('/health*', securityHeaders);
app.use('/health*', cors);

// Runtime secret hygiene guard in staging/production
app.use('/api/*', async (c, next) => {
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
app.route('/api/storefront', storefront);
app.route('/media', publicMedia);
app.route('/api/reviews', publicReviews);
app.route('/api/analytics', publicAnalytics);

// ─── Protected Admin API Routes ─────────────────────────────────────────────

app.route('/api/admin', admin);

// ─── Unified Cloudflare Workers Static Assets (Storefront + /admin SPA) ─────

const ADMIN_HTML_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-cache',
};

async function serveAdminSpa(c: any) {
  if (!c.env.ASSETS) return c.notFound();
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/admin/assets/')) {
    const assetRes = await c.env.ASSETS.fetch(c.req.raw);
    const headers = new Headers(assetRes.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(assetRes.body, { status: assetRes.status, headers });
  }
  const indexRes = await c.env.ASSETS.fetch(new Request(new URL('/admin/index.html', url.origin)));
  const headers = new Headers(indexRes.headers);
  for (const [k, v] of Object.entries(ADMIN_HTML_HEADERS)) headers.set(k, v);
  return new Response(indexRes.body, { status: indexRes.status, headers });
}

app.get('/admin', serveAdminSpa);
app.get('/admin/*', serveAdminSpa);

app.get('*', async (c, next) => {
  const path = c.req.path;
  if (!c.env.ASSETS || path.startsWith('/api/') || path.startsWith('/media/') || path.startsWith('/health')) {
    return next();
  }

  const assetRes = await c.env.ASSETS.fetch(c.req.raw);
  if (assetRes.status !== 404) {
    return assetRes;
  }

  // Resolve active D1 SEO redirects before falling back to branded 404 page
  try {
    const redirect = await c.env.DB
      .prepare(
        `SELECT id, target_path, status_code FROM cms_redirects WHERE source_path = ?1 AND is_active = 1 LIMIT 1`,
      )
      .bind(path)
      .first<{ id: string; target_path: string; status_code: number }>();

    if (redirect) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare(`UPDATE cms_redirects SET hits = hits + 1 WHERE id = ?1`).bind(redirect.id).run().catch(() => {}),
      );
      return c.redirect(redirect.target_path, (redirect.status_code === 302 ? 302 : 301) as 301 | 302);
    }
  } catch {
    // Non-fatal fallback to 404 page
  }

  const notFoundRes = await c.env.ASSETS.fetch(new Request(new URL('/404.html', c.req.url)));
  return new Response(notFoundRes.body, { status: 404, headers: notFoundRes.headers });
});

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
