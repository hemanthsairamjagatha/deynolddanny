import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { checkD1RateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';
import { sendContactAdminEmail } from '../services/resend.js';
import { generateId } from '../services/crypto.js';
import { nowIso } from '../db/client.js';

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

  const [emailLimit, ipLimit] = await Promise.all([
    checkD1RateLimit(env.DB, `contact_email:${body.email}`, 3, 3600),
    checkD1RateLimit(env.DB, `contact_ip:${ip}`, 6, 3600),
  ]);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    return c.json(createRateLimitResponse('Too many contact submissions. Please try again later.'), 429);
  }

  const inquiryId = generateId('inq_');
  const now = nowIso();
  await env.DB
    .prepare(
      `INSERT INTO contact_inquiries (id, name, email, phone, subject, message, preferred_contact, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'new', ?8, ?8)`,
    )
    .bind(
      inquiryId,
      body.name,
      body.email,
      body.phone ?? null,
      body.subject,
      body.message,
      body.preferredContact,
      now,
    )
    .run();

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
      inquiryId,
      received: true,
      message:
        'Thank you for reaching out. A member of our client concierge team will respond within 24 hours.',
    },
  });
});

export default contact;
