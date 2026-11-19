import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { nowIso } from '../../db/client.js';
import { interpolateTemplate, sendConfiguredEmail } from '../../services/resend.js';
import { safeJsonParse } from '../../services/storefrontCache.js';

const adminTemplates = new Hono<{ Bindings: Env }>();

// ─── GET /api/admin/templates ────────────────────────────────────────────────
adminTemplates.get('/', requirePermission('templates.write'), async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT template_key, name, description, subject_template, variables_json, is_active, updated_at FROM email_templates ORDER BY template_key ASC`)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        templateKey: r.template_key,
        name: r.name,
        description: r.description,
        subjectTemplate: r.subject_template,
        variables: safeJsonParse(String(r.variables_json ?? '[]'), []),
        isActive: Number(r.is_active ?? 1) === 1,
        updatedAt: r.updated_at,
      })),
    },
  });
});

// ─── GET /api/admin/templates/:key ───────────────────────────────────────────
adminTemplates.get('/:key', requirePermission('templates.write'), async (c) => {
  const key = c.req.param('key');
  const tpl = await c.env.DB
    .prepare(`SELECT * FROM email_templates WHERE template_key = ?1 LIMIT 1`)
    .bind(key)
    .first<Record<string, unknown>>();

  if (!tpl) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found.', status: 404 } }, 404);
  }

  return c.json({
    success: true,
    data: {
      templateKey: tpl.template_key,
      name: tpl.name,
      description: tpl.description,
      subjectTemplate: tpl.subject_template,
      htmlTemplate: tpl.html_template,
      textTemplate: tpl.text_template,
      variables: safeJsonParse(String(tpl.variables_json ?? '[]'), []),
      isActive: Number(tpl.is_active ?? 1) === 1,
      updatedAt: tpl.updated_at,
    },
  });
});

// ─── PATCH /api/admin/templates/:key ─────────────────────────────────────────
const updateTplSchema = z.object({
  subjectTemplate: z.string().min(2).max(240).optional(),
  htmlTemplate: z.string().min(10).optional(),
  textTemplate: z.string().optional(),
  isActive: z.boolean().optional(),
});

adminTemplates.patch(
  '/:key',
  requirePermission('templates.write'),
  zValidator('json', updateTplSchema),
  async (c) => {
    const key = c.req.param('key');
    const adminId = c.get('userId');
    const body = c.req.valid('json');

    const sets: string[] = ['updated_at = ?1', 'updated_by = ?2'];
    const vals: any[] = [nowIso(), adminId];
    const add = (col: string, val: any) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.subjectTemplate !== undefined) add('subject_template', body.subjectTemplate);
    if (body.htmlTemplate !== undefined) add('html_template', body.htmlTemplate);
    if (body.textTemplate !== undefined) add('text_template', body.textTemplate);
    if (body.isActive !== undefined) add('is_active', body.isActive ? 1 : 0);

    vals.push(key);
    await c.env.DB
      .prepare(`UPDATE email_templates SET ${sets.join(', ')} WHERE template_key = ?${vals.length}`)
      .bind(...vals)
      .run();

    await auditAdminAction(c, 'UPDATE_EMAIL_TEMPLATE', 'email_template', key);

    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── POST /api/admin/templates/:key/test-send ────────────────────────────────
adminTemplates.post(
  '/:key/test-send',
  requirePermission('templates.write'),
  zValidator('json', z.object({ targetEmail: z.string().email(), sampleVars: z.record(z.unknown()).optional() })),
  async (c) => {
    const key = c.req.param('key');
    const { targetEmail, sampleVars } = c.req.valid('json');

    const tpl = await c.env.DB
      .prepare(`SELECT subject_template, html_template FROM email_templates WHERE template_key = ?1 LIMIT 1`)
      .bind(key)
      .first<{ subject_template: string; html_template: string }>();

    if (!tpl) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found.', status: 404 } }, 404);
    }

    const defaultVars: Record<string, string> = {
      brandName: 'DEYNOLD DANNY',
      otp: '789123',
      orderNumber: 'DD-TEST-9001',
      totalFormatted: '₹ 72,500.00',
      conciergeEmail: 'concierge@deynolddanny.com',
      conciergePhone: '+91 11 4820 9000',
      courierPartner: 'BlueDart Air',
      trackingNumber: 'TEST-AWB-12345678',
      productTitle: 'Cady Wide-Leg Trousers',
      variantLabel: 'Butter / IT 48',
      productUrl: 'https://deynolddanny.com/products/cady-trousers',
      ...(sampleVars as Record<string, string>),
    };

    const subject = `[TEST] ${interpolateTemplate(tpl.subject_template, defaultVars, false)}`;
    const html = interpolateTemplate(tpl.html_template, defaultVars, true);

    if (c.env.RESEND_API_KEY) {
      await sendConfiguredEmail(c.env.RESEND_API_KEY, targetEmail, subject, html, c.env.RESEND_FROM_EMAIL);
    }

    await auditAdminAction(c, 'TEST_SEND_EMAIL_TEMPLATE', 'email_template', key, { targetEmail });
    return c.json({ success: true, data: { sent: true, targetEmail } });
  },
);

// ─── GET /api/admin/templates/outbox ─────────────────────────────────────────
adminTemplates.get('/outbox/all', requirePermission('templates.write', 'logs.read'), async (c) => {
  const status = c.req.query('status')?.trim();
  let sql = `SELECT * FROM email_outbox WHERE 1=1`;
  const bindings: any[] = [];
  if (status) {
    bindings.push(status);
    sql += ` AND status = ?${bindings.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;

  const rows = await c.env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return c.json({ success: true, data: { items: rows.results ?? [] } });
});

export default adminTemplates;
