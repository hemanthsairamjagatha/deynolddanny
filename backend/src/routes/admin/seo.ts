import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache } from '../../services/storefrontCache.js';

const seo = new Hono<{ Bindings: Env }>();

function isSafeRedirectTarget(target: string): boolean {
  const trimmed = target.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const redirectSchema = z.object({
  source_path: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((v) => v.startsWith('/') && !v.startsWith('//'), 'source_path must start with a single /'),
  target_path: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(isSafeRedirectTarget, 'target_path must be a relative path (/...) or http(s) URL'),
  status_code: z.union([z.literal(301), z.literal(302)]).default(301),
  note: z.string().max(300).optional().default(''),
  is_active: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

// GET /redirects
seo.get('/redirects', requirePermission('seo.write', 'cms.read'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, source_path, target_path, status_code, note, is_active, hits AS hit_count, created_by, created_at, updated_at
     FROM cms_redirects ORDER BY created_at DESC`,
  ).all();
  return c.json({ success: true, data: rows.results });
});

// POST /redirects
seo.post('/redirects', requirePermission('seo.write'), zValidator('json', redirectSchema), async (c) => {
  const { source_path, target_path, status_code, note } = c.req.valid('json');
  const id = crypto.randomUUID();
  const actor = c.get('userEmail') ?? c.get('userId') ?? 'admin';
  try {
    await c.env.DB.prepare(
      `INSERT INTO cms_redirects (id, source_path, target_path, status_code, note, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, source_path, target_path, status_code, note, actor)
      .run();
  } catch {
    return c.json(
      { success: false, error: { code: 'CONFLICT', message: `A redirect for "${source_path}" already exists.`, status: 409 } },
      409,
    );
  }
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'CREATE_SEO_REDIRECT', 'cms_redirect', id, { source_path, target_path, status_code });
  return c.json({ success: true, data: { id } }, 201);
});

// PATCH /redirects/:id
seo.patch('/redirects/:id', requirePermission('seo.write'), zValidator('json', redirectSchema.partial()), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.source_path !== undefined) { fields.push('source_path = ?'); vals.push(body.source_path); }
  if (body.target_path !== undefined) { fields.push('target_path = ?'); vals.push(body.target_path); }
  if (body.status_code !== undefined) { fields.push('status_code = ?'); vals.push(body.status_code); }
  if (body.note !== undefined) { fields.push('note = ?'); vals.push(body.note); }
  if (body.is_active !== undefined) { fields.push('is_active = ?'); vals.push(body.is_active ? 1 : 0); }
  if (!fields.length) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Nothing to update', status: 400 } }, 400);
  }
  fields.push(`updated_at = datetime('now')`);
  vals.push(id);
  await c.env.DB.prepare(`UPDATE cms_redirects SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'UPDATE_SEO_REDIRECT', 'cms_redirect', id, body);
  return c.json({ success: true });
});

// DELETE /redirects/:id
seo.delete('/redirects/:id', requirePermission('seo.write'), async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare(`DELETE FROM cms_redirects WHERE id = ?`).bind(id).run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'DELETE_SEO_REDIRECT', 'cms_redirect', id);
  return c.json({ success: true });
});

export default seo;
