import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import { invalidateStorefrontCache, safeJsonParse } from '../../services/storefrontCache.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminCollections = new Hono<{ Bindings: Env }>();

const collectionSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(140),
  eyebrow: z.string().max(80).default('Curated Capsule'),
  description: z.string().max(800).default(''),
  heroImage: z.string().max(500).default('/images/category-abiti.jpg'),
  mobileImage: z.string().max(500).nullable().optional(),
  focalX: z.number().int().min(0).max(100).default(50),
  focalY: z.number().int().min(0).max(100).default(50),
  sortOrder: z.number().int().default(0),
  isActive: z.union([z.literal(0), z.literal(1)]).default(1),
  seo: z.record(z.unknown()).default({}),
});

adminCollections.get('/', requirePermission('catalog.read', 'cms.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM collection_products cp WHERE cp.collection_id = c.id) AS product_count
       FROM collections c ORDER BY c.sort_order ASC, c.title ASC`,
    )
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        eyebrow: r.eyebrow,
        description: r.description,
        heroImage: r.hero_image,
        mobileImage: r.mobile_image ?? r.hero_image,
        focalX: Number(r.focal_x ?? 50),
        focalY: Number(r.focal_y ?? 50),
        sortOrder: Number(r.sort_order ?? 0),
        isActive: Number(r.is_active ?? 1) === 1,
        productCount: Number(r.product_count ?? 0),
        seo: safeJsonParse(String(r.seo_json ?? '{}'), {}),
      })),
    },
  });
});

adminCollections.get('/:id', requirePermission('catalog.read', 'cms.read'), async (c) => {
  const id = c.req.param('id');
  const col = await c.env.DB
    .prepare(`SELECT * FROM collections WHERE id = ?1 OR slug = ?1 LIMIT 1`)
    .bind(id)
    .first<Record<string, unknown>>();

  if (!col) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Collection not found.', status: 404 } }, 404);
  }

  const prods = await c.env.DB
    .prepare(
      `SELECT p.id, p.slug, p.title, p.price_paise, p.default_img, cp.sort_order
       FROM collection_products cp
       INNER JOIN products p ON p.id = cp.product_id
       WHERE cp.collection_id = ?1
       ORDER BY cp.sort_order ASC`,
    )
    .bind(col.id)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      collection: {
        id: col.id,
        slug: col.slug,
        title: col.title,
        eyebrow: col.eyebrow,
        description: col.description,
        heroImage: col.hero_image,
        mobileImage: col.mobile_image ?? col.hero_image,
        focalX: Number(col.focal_x ?? 50),
        focalY: Number(col.focal_y ?? 50),
        sortOrder: Number(col.sort_order ?? 0),
        isActive: Number(col.is_active ?? 1) === 1,
        seo: safeJsonParse(String(col.seo_json ?? '{}'), {}),
      },
      products: prods.results ?? [],
    },
  });
});

adminCollections.post('/', requirePermission('catalog.write'), zValidator('json', collectionSchema), async (c) => {
  const body = c.req.valid('json');
  const id = generateId('col_');
  const now = nowIso();

  try {
    await c.env.DB
      .prepare(
        `INSERT INTO collections
         (id, slug, title, eyebrow, description, hero_image, mobile_image, focal_x, focal_y, sort_order, is_active, seo_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
      )
      .bind(
        id,
        body.slug,
        body.title,
        body.eyebrow,
        body.description,
        body.heroImage,
        body.mobileImage ?? body.heroImage,
        body.focalX,
        body.focalY,
        body.sortOrder,
        body.isActive,
        JSON.stringify(body.seo),
        now,
      )
      .run();
  } catch {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Collection slug already exists.', status: 409 } }, 409);
  }

  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'CREATE_COLLECTION', 'collection', id, { slug: body.slug });
  return c.json({ success: true, data: { id, slug: body.slug } }, 201);
});

adminCollections.patch('/:id', requirePermission('catalog.write'), zValidator('json', collectionSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const sets: string[] = ['updated_at = ?1'];
  const vals: unknown[] = [nowIso()];
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = ?${vals.length + 1}`);
    vals.push(val);
  };

  if (body.slug !== undefined) add('slug', body.slug);
  if (body.title !== undefined) add('title', body.title);
  if (body.eyebrow !== undefined) add('eyebrow', body.eyebrow);
  if (body.description !== undefined) add('description', body.description);
  if (body.heroImage !== undefined) add('hero_image', body.heroImage);
  if (body.mobileImage !== undefined) add('mobile_image', body.mobileImage);
  if (body.focalX !== undefined) add('focal_x', body.focalX);
  if (body.focalY !== undefined) add('focal_y', body.focalY);
  if (body.sortOrder !== undefined) add('sort_order', body.sortOrder);
  if (body.isActive !== undefined) add('is_active', body.isActive);
  if (body.seo !== undefined) add('seo_json', JSON.stringify(body.seo));

  vals.push(id);
  await c.env.DB
    .prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
    .bind(...vals)
    .run();

  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'UPDATE_COLLECTION', 'collection', id, body);
  return c.json({ success: true, data: { updated: true } });
});

adminCollections.put(
  '/:id/products',
  requirePermission('catalog.write'),
  zValidator('json', z.object({ productIds: z.array(z.string().min(1)) })),
  async (c) => {
    const collectionId = c.req.param('id');
    const { productIds } = c.req.valid('json');

    const stmts: D1PreparedStatement[] = [
      c.env.DB.prepare(`DELETE FROM collection_products WHERE collection_id = ?1`).bind(collectionId),
    ];
    productIds.forEach((pid, idx) => {
      stmts.push(
        c.env.DB
          .prepare(`INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?1, ?2, ?3)`)
          .bind(collectionId, pid, idx + 1),
      );
    });

    await c.env.DB.batch(stmts);
    await invalidateStorefrontCache(c.env);
    await auditAdminAction(c, 'ASSIGN_COLLECTION_PRODUCTS', 'collection', collectionId, { count: productIds.length });
    return c.json({ success: true, data: { assignedCount: productIds.length } });
  },
);

adminCollections.delete('/:id', requirePermission('catalog.delete'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM collections WHERE id = ?1`).bind(id).run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'DELETE_COLLECTION', 'collection', id);
  return c.json({ success: true, data: { deleted: true } });
});

export default adminCollections;
