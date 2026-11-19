import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';
import { sendConfiguredEmail } from '../../services/resend.js';

const adminInquiries = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/inquiries ────────────────────────────────────────────────
adminInquiries.get('/', requirePermission('inquiries.manage'), async (c) => {
  const status = c.req.query('status')?.trim();
  let sql = `SELECT * FROM contact_inquiries WHERE 1=1`;
  const bindings: any[] = [];

  if (status) {
    bindings.push(status);
    sql += ` AND status = ?${bindings.length}`;
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: rows.results ?? [],
      total: rows.results?.length ?? 0,
    },
  });
});

// ─── PATCH /api/admin/inquiries/:id ──────────────────────────────────────────
const updateInquirySchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'archived']).optional(),
  assignedTo: z.string().nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
});

adminInquiries.patch(
  '/:id',
  requirePermission('inquiries.manage'),
  zValidator('json', updateInquirySchema),
  async (c) => {
    const inquiryId = c.req.param('id');
    const body = c.req.valid('json');

    const sets: string[] = ['updated_at = ?1'];
    const vals: any[] = [nowIso()];
    const add = (col: string, val: any) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.status !== undefined) add('status', body.status);
    if (body.assignedTo !== undefined) add('assigned_to', body.assignedTo);
    if (body.internalNotes !== undefined) add('internal_notes', body.internalNotes);

    vals.push(inquiryId);
    await c.env.DB
      .prepare(`UPDATE contact_inquiries SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await auditAdminAction(c, 'UPDATE_INQUIRY', 'contact_inquiry', inquiryId, body);

    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── POST /api/admin/inquiries/:id/reply ─────────────────────────────────────
const replySchema = z.object({
  replySubject: z.string().min(2).max(180),
  replyMessage: z.string().min(10).max(4000),
});

adminInquiries.post(
  '/:id/reply',
  requirePermission('inquiries.manage'),
  zValidator('json', replySchema),
  async (c) => {
    const inquiryId = c.req.param('id');
    const { replySubject, replyMessage } = c.req.valid('json');

    const inq = await c.env.DB
      .prepare(`SELECT email, name FROM contact_inquiries WHERE id = ?1 LIMIT 1`)
      .bind(inquiryId)
      .first<{ email: string; name: string }>();

    if (!inq) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Inquiry not found.', status: 404 } }, 404);
    }

    if (c.env.RESEND_API_KEY) {
      const html = `
        <div style="font-family:Montserrat,sans-serif;max-width:560px;margin:30px auto;padding:40px;border:1px solid #eaeaea;background:#ffffff;color:#111111;">
          <p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c7355;margin:0 0 16px;">DEYNOLD DANNY &bull; CLIENT CARE</p>
          <p style="font-size:14px;color:#111111;margin:0 0 16px;">Dear ${inq.name},</p>
          <div style="font-size:13px;line-height:1.7;color:#333333;margin:0 0 24px;white-space:pre-wrap;">${replyMessage}</div>
          <p style="font-size:11px;color:#777777;border-top:1px solid #f0f0f0;padding-top:16px;">DEYNOLD DANNY Flagship Atelier &bull; Sartorial House, New Delhi</p>
        </div>
      `;

      await sendConfiguredEmail(
        c.env.RESEND_API_KEY,
        inq.email,
        replySubject,
        html,
        c.env.RESEND_FROM_EMAIL,
      );
    }

    await c.env.DB
      .prepare(`UPDATE contact_inquiries SET status = 'resolved', updated_at = ?1 WHERE id = ?2`)
      .bind(nowIso(), inquiryId)
      .run();

    await auditAdminAction(c, 'REPLY_INQUIRY', 'contact_inquiry', inquiryId, { to: inq.email });

    return c.json({ success: true, data: { sent: true } });
  },
);

export default adminInquiries;
