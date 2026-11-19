import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache, safeJsonParse } from '../../services/storefrontCache.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminSizeGuides = new Hono<{ Bindings: Env }>();

const sizeGuideSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(120),
  categorySlug: z.string().max(80).nullable().optional(),
  tables: z.array(z.unknown()).default([]),
  measurementNotes: z.array(z.string()).default([]),
  fitRules: z.record(z.unknown()).default({}),
});

// ─── GET /api/admin/size-guides ──────────────────────────────────────────────
adminSizeGuides.get('/', requirePermission('catalog.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT * FROM size_guides ORDER BY title ASC`)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        categorySlug: r.category_slug,
        tables: safeJsonParse(String(r.tables_json ?? '[]'), []),
        measurementNotes: safeJsonParse(String(r.measurement_notes_json ?? '[]'), []),
        fitRules: safeJsonParse(String(r.fit_rules_json ?? '{}'), {}),
        updatedAt: r.updated_at,
      })),
    },
  });
});

// ─── POST /api/admin/size-guides ─────────────────────────────────────────────
adminSizeGuides.post(
  '/',
  requirePermission('catalog.write'),
  zValidator('json', sizeGuideSchema),
  async (c) => {
    const body = c.req.valid('json');
    const id = generateId('sg_');
    const now = nowIso();

    try {
      await c.env.DB
        .prepare(
          `INSERT INTO size_guides (id, slug, title, category_slug, tables_json, measurement_notes_json, fit_rules_json, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        )
        .bind(
          id,
          body.slug,
          body.title,
          body.categorySlug ?? null,
          JSON.stringify(body.tables),
          JSON.stringify(body.measurementNotes),
          JSON.stringify(body.fitRules),
          now,
        )
        .run();
    } catch {
      return c.json({ success: false, error: { code: 'CONFLICT', message: 'Size guide slug already exists.', status: 409 } }, 409);
    }

    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'CREATE_SIZE_GUIDE', 'size_guide', id, { slug: body.slug });

    return c.json({ success: true, data: { id, slug: body.slug } }, 201);
  },
);

// ─── PATCH /api/admin/size-guides/:id ────────────────────────────────────────
adminSizeGuides.patch(
  '/:id',
  requirePermission('catalog.write'),
  zValidator('json', sizeGuideSchema.partial()),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const sets: string[] = ['updated_at = ?1'];
    const vals: any[] = [nowIso()];
    const add = (col: string, val: any) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.slug !== undefined) add('slug', body.slug);
    if (body.title !== undefined) add('title', body.title);
    if (body.categorySlug !== undefined) add('category_slug', body.categorySlug);
    if (body.tables !== undefined) add('tables_json', JSON.stringify(body.tables));
    if (body.measurementNotes !== undefined) add('measurement_notes_json', JSON.stringify(body.measurementNotes));
    if (body.fitRules !== undefined) add('fit_rules_json', JSON.stringify(body.fitRules));

    vals.push(id);
    await c.env.DB
      .prepare(`UPDATE size_guides SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'UPDATE_SIZE_GUIDE', 'size_guide', id, body);

    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── DELETE /api/admin/size-guides/:id ───────────────────────────────────────
adminSizeGuides.delete('/:id', requirePermission('catalog.delete'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM size_guides WHERE id = ?1`).bind(id).run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'DELETE_SIZE_GUIDE', 'size_guide', id);
  return c.json({ success: true, data: { deleted: true } });
});

export default adminSizeGuides;
