import { createMiddleware } from 'hono/factory';

/**
 * Applies security-hardening HTTP response headers to every response.
 * Must be registered before route handlers so headers are always present.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  await next();
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:;",
  );
  c.header('X-Powered-By', 'DEYNOLD DANNY');
});
