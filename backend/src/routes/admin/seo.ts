import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache } from '../../services/storefrontCache.js';

const seo = new Hono<{ Bindings: Env }>();

// GET /redirects
seo.get('/redirects', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, source_path, target_path, status_code, note, is_active, hits AS hit_count, created_by, created_at, updated_at
     FROM cms_redirects ORDER BY created_at DESC`,
  ).all();
  return c.json({ success: true, data: rows.results });
});

// POST /redirects
seo.post('/redirects', requirePermission('seo.write'), async (c) => {
  const { source_path, target_path, status_code = 301, note = '' } =
    await c.req.json<{ source_path: string; target_path: string; status_code?: number; note?: string }>();
  if (!source_path || !target_path) {
    return c.json(
      { success: false, error: { message: 'source_path and target_path are required' } },
      400,
    );
  }
  const id = crypto.randomUUID();
  const actor = c.get('userEmail') ?? c.get('userId') ?? 'admin';
  await c.env.DB.prepare(
    `INSERT INTO cms_redirects (id, source_path, target_path, status_code, note, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, source_path.trim(), target_path.trim(), status_code, note, actor)
    .run();
  await invalidateStorefrontCache(c.env);
  return c.json({ success: true, data: { id } }, 201);
});

// PATCH /redirects/:id
seo.patch('/redirects/:id', requirePermission('seo.write'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<Record<string, unknown>>();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.source_path !== undefined) { fields.push('source_path = ?'); vals.push(body.source_path); }
  if (body.target_path !== undefined) { fields.push('target_path = ?'); vals.push(body.target_path); }
  if (body.status_code !== undefined) { fields.push('status_code = ?'); vals.push(body.status_code); }
  if (body.note !== undefined) { fields.push('note = ?'); vals.push(body.note); }
  if (body.is_active !== undefined) { fields.push('is_active = ?'); vals.push(body.is_active ? 1 : 0); }
  if (!fields.length) {
    return c.json({ success: false, error: { message: 'Nothing to update' } }, 400);
  }
  fields.push(`updated_at = datetime('now')`);
  vals.push(id);
  await c.env.DB.prepare(`UPDATE cms_redirects SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();
  await invalidateStorefrontCache(c.env);
  return c.json({ success: true });
});

// DELETE /redirects/:id
seo.delete('/redirects/:id', requirePermission('seo.write'), async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare(`DELETE FROM cms_redirects WHERE id = ?`).bind(id).run();
  await invalidateStorefrontCache(c.env);
  return c.json({ success: true });
});

export default seo;
