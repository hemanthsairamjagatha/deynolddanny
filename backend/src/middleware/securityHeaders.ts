import { createMiddleware } from 'hono/factory';

/**
 * Applies security-hardening HTTP response headers to every response.
 * Includes tracing X-Request-ID, HSTS, frame-busting, Permissions-Policy,
 * and CSP configured for Razorpay payment SDK and luxury media assets.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId' as any, requestId);

  await next();

  c.header('X-Request-ID', requestId);
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://api.razorpay.com; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://apiv2.shiprocket.in; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';",
  );
  c.header(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
  );
  c.header('X-Powered-By', 'DEYNOLD DANNY ATELIER');
});
