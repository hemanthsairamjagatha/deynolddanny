import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache, safeJsonParse } from '../../services/storefrontCache.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminCategories = new Hono<{ Bindings: Env }>();

const categorySchema = z.object({
  id: z.string().min(2).max(80).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  heroTitle: z.string().max(140).nullable().optional(),
  eyebrow: z.string().max(80).nullable().optional(),
  subtitle: z.string().max(240).nullable().optional(),
  tagline: z.string().max(80).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  mobileImage: z.string().max(500).nullable().optional(),
  focalX: z.number().int().min(0).max(100).default(50),
  focalY: z.number().int().min(0).max(100).default(50),
  sortOrder: z.number().int().default(0),
  isActive: z.union([z.literal(0), z.literal(1)]).default(1),
  editorial: z.record(z.unknown()).default({}),
  seo: z.record(z.unknown()).default({}),
});

adminCategories.get('/', requirePermission('catalog.read', 'cms.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
       FROM categories c ORDER BY c.sort_order ASC, c.title ASC`,
    )
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        heroTitle: r.hero_title ?? r.title,
        eyebrow: r.eyebrow ?? '',
        subtitle: r.subtitle ?? '',
        tagline: r.tagline ?? '',
        imageUrl: r.image_url ?? '',
        mobileImage: r.mobile_image ?? r.image_url ?? '',
        focalX: Number(r.focal_x ?? 50),
        focalY: Number(r.focal_y ?? 50),
        sortOrder: Number(r.sort_order ?? 0),
        isActive: Number(r.is_active ?? 1) === 1,
        productCount: Number(r.product_count ?? 0),
        editorial: safeJsonParse(String(r.editorial_json ?? '{}'), {}),
        seo: safeJsonParse(String(r.seo_json ?? '{}'), {}),
      })),
    },
  });
});

adminCategories.post(
  '/',
  requirePermission('catalog.write'),
  zValidator('json', categorySchema),
  async (c) => {
    const body = c.req.valid('json');
    const id = body.id || generateId('cat_');

    try {
      await c.env.DB
        .prepare(
          `INSERT INTO categories
           (id, slug, title, hero_title, eyebrow, subtitle, tagline, image_url, mobile_image, focal_x, focal_y, sort_order, is_active, editorial_json, seo_json, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
        )
        .bind(
          id,
          body.slug,
          body.title,
          body.heroTitle ?? body.title,
          body.eyebrow ?? null,
          body.subtitle ?? null,
          body.tagline ?? 'SCOPRI ORA',
          body.imageUrl ?? '/images/category-abiti.jpg',
          body.mobileImage ?? body.imageUrl ?? '/images/category-abiti.jpg',
          body.focalX,
          body.focalY,
          body.sortOrder,
          body.isActive,
          JSON.stringify(body.editorial),
          JSON.stringify(body.seo),
          nowIso(),
        )
        .run();
    } catch {
      return c.json({ success: false, error: { code: 'CONFLICT', message: 'Category slug already exists.', status: 409 } }, 409);
    }

    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'CREATE_CATEGORY', 'category', id, { slug: body.slug });
    return c.json({ success: true, data: { id, slug: body.slug } }, 201);
  },
);

adminCategories.patch(
  '/:id',
  requirePermission('catalog.write'),
  zValidator('json', categorySchema.partial()),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, val: unknown) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.slug !== undefined) add('slug', body.slug);
    if (body.title !== undefined) add('title', body.title);
    if (body.heroTitle !== undefined) add('hero_title', body.heroTitle);
    if (body.eyebrow !== undefined) add('eyebrow', body.eyebrow);
    if (body.subtitle !== undefined) add('subtitle', body.subtitle);
    if (body.tagline !== undefined) add('tagline', body.tagline);
    if (body.imageUrl !== undefined) add('image_url', body.imageUrl);
    if (body.mobileImage !== undefined) add('mobile_image', body.mobileImage);
    if (body.focalX !== undefined) add('focal_x', body.focalX);
    if (body.focalY !== undefined) add('focal_y', body.focalY);
    if (body.sortOrder !== undefined) add('sort_order', body.sortOrder);
    if (body.isActive !== undefined) add('is_active', body.isActive);
    if (body.editorial !== undefined) add('editorial_json', JSON.stringify(body.editorial));
    if (body.seo !== undefined) add('seo_json', JSON.stringify(body.seo));

    if (!sets.length) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No category fields supplied.', status: 400 } }, 400);
    }

    vals.push(id);
    await c.env.DB
      .prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'UPDATE_CATEGORY', 'category', id, body);
    return c.json({ success: true, data: { updated: true } });
  },
);

adminCategories.delete('/:id', requirePermission('catalog.delete'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`UPDATE categories SET is_active = 0 WHERE id = ?1`).bind(id).run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'ARCHIVE_CATEGORY', 'category', id);
  return c.json({ success: true, data: { archived: true } });
});

export default adminCategories;
