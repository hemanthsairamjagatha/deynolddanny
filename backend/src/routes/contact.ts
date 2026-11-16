import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { checkD1RateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';
import { sendContactAdminEmail } from '../services/resend.js';

const contact = new Hono<{ Bindings: Env }>();

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
  subject: z.string().min(2).max(200).default('Client Atelier Enquiry'),
  message: z.string().min(10).max(2000),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).default('email'),
});

export type ContactFormData = z.infer<typeof contactSchema>;

contact.post('/', zValidator('json', contactSchema), async (c) => {
  const body = c.req.valid('json');
  const env = c.env;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown';

  // D1-backed dual rate limit (email + IP) — avoids consuming KV daily write quota
  const [emailLimit, ipLimit] = await Promise.all([
    checkD1RateLimit(env.DB, `contact_email:${body.email}`, 3, 3600),
    checkD1RateLimit(env.DB, `contact_ip:${ip}`, 6, 3600),
  ]);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    return c.json(createRateLimitResponse('Too many contact submissions. Please try again later.'), 429);
  }

  if (env.RESEND_API_KEY && env.ADMIN_EMAILS) {
    const adminEmails = env.ADMIN_EMAILS.split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (adminEmails.length > 0) {
      c.executionCtx.waitUntil(
        sendContactAdminEmail(
          env.RESEND_API_KEY,
          adminEmails[0],
          body,
          env.RESEND_FROM_EMAIL,
        ).catch((err) => console.error('Contact admin email error:', err)),
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
