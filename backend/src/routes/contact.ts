import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { sendContactAdminEmail } from '../services/resend.js';

const contact = new Hono<{ Bindings: Env }>();

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(2000),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).default('email'),
});

export type ContactFormData = z.infer<typeof contactSchema>;

// ─── POST /api/contact ──────────────────────────────────────────────────────

contact.post('/', zValidator('json', contactSchema), async (c) => {
  const body = c.req.valid('json');
  const env = c.env;

  // Rate-limit guard: max 3 submissions per email per hour (using KV)
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const rateLimitKey = `contact:${body.email}:${hourBucket}`;
  const existing = await env.CATALOG_KV.get(rateLimitKey);
  const count = existing ? parseInt(existing, 10) : 0;

  if (count >= 3) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many contact submissions. Please try again later.',
          status: 429,
        },
      },
      429,
    );
  }

  await env.CATALOG_KV.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });

  // Send email notification to admin (non-blocking, never fails the request)
  if (env.RESEND_API_KEY && env.ADMIN_EMAILS) {
    const adminEmails = env.ADMIN_EMAILS.split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (adminEmails.length > 0) {
      c.executionCtx.waitUntil(
        sendContactAdminEmail(env.RESEND_API_KEY, adminEmails[0], body),
      );
    }
  }

  return c.json({
    success: true,
    data: {
      received: true,
      message:
        'Thank you for reaching out. A member of our client concierge team will respond within 24 hours.',
    },
  });
});

export default contact;

