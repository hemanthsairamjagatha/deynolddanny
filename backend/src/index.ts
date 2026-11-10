/**
 * DEYNOLD DANNY — Cloudflare Worker Entrypoint
 *
 * Mounts all routes, middleware, and background handlers.
 * fetch   → HTTP API (Hono)
 * scheduled → Cron: inventory reaper every 5 minutes
 * queue   → Email queue consumer
 */

import { Hono } from 'hono';
import type { Env } from './types/bindings.js';
import type { EmailJob } from './types/api.js';

// ─── Middleware ──────────────────────────────────────────────────────────────
import { securityHeaders } from './middleware/securityHeaders.js';
import { cors as corsMiddleware } from './middleware/cors.js';
import { setupErrorHandler } from './middleware/errorHandler.js';

// ─── Public Routes ──────────────────────────────────────────────────────────
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import cartRouter from './routes/cart.js';
import checkoutRouter from './routes/checkout.js';
import paymentsRouter from './routes/payments.js';
import ordersRouter from './routes/orders.js';
import wishlistRouter from './routes/wishlist.js';
import usersRouter from './routes/users.js';
import searchRouter from './routes/search.js';
import newsletterRouter from './routes/newsletter.js';

// ─── Admin Routes ────────────────────────────────────────────────────────────
import adminRouter from './routes/admin/index.js';

// ─── Background Handlers ─────────────────────────────────────────────────────
import { releaseExpiredReservations } from './services/stockEngine.cron.js';
import { processEmailQueue } from './queues/emailConsumer.js';

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// Global middleware — applied to every request
app.use('*', securityHeaders);
app.use('*', corsMiddleware);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({
    success: true,
    data: {
      status: 'ok',
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
  }),
);

// ─── Mount public routers ─────────────────────────────────────────────────────
app.route('/api/auth', authRouter);
app.route('/api/products', productsRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/cart', cartRouter);
app.route('/api/checkout', checkoutRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/orders', ordersRouter);
app.route('/api/wishlist', wishlistRouter);
app.route('/api/users', usersRouter);
app.route('/api/search', searchRouter);
app.route('/api/newsletter', newsletterRouter);

// ─── Mount admin router (all routes behind adminAuth middleware) ───────────────
app.route('/api/admin', adminRouter);

// ─── Global error handler (registers onError + notFound) ─────────────────────
setupErrorHandler(app);

// ─── Worker export ────────────────────────────────────────────────────────────
export default {
  /**
   * HTTP handler — all API requests come through here
   */
  fetch: app.fetch,

  /**
   * Scheduled handler — cron triggers (every 5 minutes via wrangler.toml)
   * Releases expired stock reservations for abandoned checkouts.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(releaseExpiredReservations(event, env, ctx));
  },

  /**
   * Queue handler — processes async email jobs
   */
  async queue(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
    await processEmailQueue(batch, env);
  },
};
