import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import {
  invalidateStorefrontCache,
  recordCmsRevision,
  safeJsonParse,
} from '../../services/storefrontCache.js';
import { nowIso } from '../../db/client.js';

const adminNavigation = new Hono<{ Bindings: Env }>();

adminNavigation.get('/', requirePermission('navigation.write', 'cms.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT * FROM navigation_menus ORDER BY id ASC`)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        id: r.id,
        menuKey: r.menu_key,
        title: r.title,
        draft: safeJsonParse(String(r.draft_items_json ?? '{}'), {}),
        published: safeJsonParse(String(r.published_items_json ?? '{}'), {}),
        hasUnpublishedChanges: r.draft_items_json !== r.published_items_json,
        updatedBy: r.updated_by,
        publishedAt: r.published_at,
        updatedAt: r.updated_at,
      })),
    },
  });
});

adminNavigation.patch(
  '/:menuKey',
  requirePermission('navigation.write'),
  zValidator('json', z.object({ draft: z.unknown(), title: z.string().min(1).max(120).optional() })),
  async (c) => {
    const adminId = c.get('userId');
    const menuKey = c.req.param('menuKey');
    const { draft, title } = c.req.valid('json');
    const now = nowIso();

    const existing = await c.env.DB
      .prepare(`SELECT id FROM navigation_menus WHERE menu_key = ?1 LIMIT 1`)
      .bind(menuKey)
      .first<{ id: string }>();

    if (!existing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Navigation menu not found.', status: 404 } }, 404);
    }

    await c.env.DB
      .prepare(
        `UPDATE navigation_menus
         SET draft_items_json = ?1,
             title = COALESCE(?2, title),
             updated_by = ?3,
             updated_at = ?4
         WHERE menu_key = ?5`,
      )
      .bind(JSON.stringify(draft), title ?? null, adminId, now, menuKey)
      .run();

    await auditAdminAction(c, 'SAVE_NAVIGATION_DRAFT', 'navigation_menu', menuKey);
    return c.json({ success: true, data: { menuKey, draft } });
  },
);

adminNavigation.post('/:menuKey/publish', requirePermission('navigation.write', 'cms.publish'), async (c) => {
  const adminId = c.get('userId');
  const menuKey = c.req.param('menuKey');
  const row = await c.env.DB
    .prepare(`SELECT draft_items_json FROM navigation_menus WHERE menu_key = ?1 LIMIT 1`)
    .bind(menuKey)
    .first<{ draft_items_json: string }>();

  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Navigation menu not found.', status: 404 } }, 404);
  }

  const now = nowIso();
  await c.env.DB
    .prepare(
      `UPDATE navigation_menus
       SET published_items_json = draft_items_json,
           updated_by = ?1,
           published_at = ?2,
           updated_at = ?2
       WHERE menu_key = ?3`,
    )
    .bind(adminId, now, menuKey)
    .run();

  await recordCmsRevision(
    c.env.DB,
    'navigation',
    menuKey,
    'publish',
    safeJsonParse(row.draft_items_json, {}),
    adminId,
  );
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'PUBLISH_NAVIGATION', 'navigation_menu', menuKey);

  return c.json({ success: true, data: { menuKey, publishedAt: now } });
});

export default adminNavigation;
