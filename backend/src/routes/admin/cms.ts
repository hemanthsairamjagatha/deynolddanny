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
import { signPreviewToken } from '../../services/mfa.js';
import { generateId } from '../../services/crypto.js';
import { nowIso } from '../../db/client.js';

const adminCms = new Hono<{ Bindings: Env }>();

const createPageSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  routePath: z.string().min(1).max(160).optional(),
  pageType: z.enum(['home', 'category_template', 'collection', 'custom', 'legal', 'contact', 'pdp_global', 'utility']).default('custom'),
  title: z.string().min(2).max(160),
  templateKey: z.string().max(60).default('editorial'),
  seo: z.record(z.unknown()).default({}),
  layout: z.record(z.unknown()).default({}),
});

const updatePageSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
  scheduledAt: z.string().nullable().optional(),
  templateKey: z.string().max(60).optional(),
  seo: z.record(z.unknown()).optional(),
  layout: z.record(z.unknown()).optional(),
});

const createSectionSchema = z.object({
  sectionType: z.string().min(2).max(60),
  title: z.string().min(1).max(140),
  sectionKey: z.string().min(1).max(80).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isDraftVisible: z.boolean().default(true),
  props: z.record(z.unknown()).default({}),
  scheduleStart: z.string().nullable().optional(),
  scheduleEnd: z.string().nullable().optional(),
});

const updateSectionSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  sectionKey: z.string().min(1).max(80).optional(),
  isDraftVisible: z.boolean().optional(),
  props: z.record(z.unknown()).optional(),
  scheduleStart: z.string().nullable().optional(),
  scheduleEnd: z.string().nullable().optional(),
});

// ─── GET /api/admin/cms/pages ────────────────────────────────────────────────
adminCms.get('/pages', requirePermission('cms.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM cms_sections s WHERE s.page_id = p.id) AS section_count
       FROM cms_pages p
       ORDER BY p.is_system_route DESC, p.updated_at DESC`,
    )
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        routePath: p.route_path,
        pageType: p.page_type,
        title: p.title,
        status: p.status,
        templateKey: p.template_key,
        isSystemRoute: Number(p.is_system_route) === 1,
        sectionCount: Number(p.section_count ?? 0),
        scheduledAt: p.scheduled_at,
        publishedAt: p.published_at,
        updatedAt: p.updated_at,
      })),
    },
  });
});

// ─── POST /api/admin/cms/pages ───────────────────────────────────────────────
adminCms.post(
  '/pages',
  requirePermission('cms.write'),
  zValidator('json', createPageSchema),
  async (c) => {
    const adminId = c.get('userId');
    const body = c.req.valid('json');
    const id = generateId('page_');
    const routePath = body.routePath || (body.pageType === 'legal' ? `/legal/${body.slug}` : `/pages/${body.slug}`);
    const now = nowIso();

    try {
      await c.env.DB
        .prepare(
          `INSERT INTO cms_pages
           (id, slug, route_path, page_type, title, status, template_key, is_system_route,
            draft_seo_json, published_seo_json, draft_layout_json, published_layout_json,
            updated_by, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'draft', ?6, 0, ?7, '{}', ?8, '{}', ?9, ?10, ?10)`,
        )
        .bind(
          id,
          body.slug,
          routePath,
          body.pageType,
          body.title,
          body.templateKey,
          JSON.stringify(body.seo),
          JSON.stringify(body.layout),
          adminId,
          now,
        )
        .run();
    } catch {
      return c.json(
        { success: false, error: { code: 'CONFLICT', message: 'Page slug or route already exists.', status: 409 } },
        409,
      );
    }

    await recordCmsRevision(c.env.DB, 'page', id, 'create_page', { title: body.title, sections: [] }, adminId);
    await auditAdminAction(c, 'CREATE_CMS_PAGE', 'cms_page', id, { slug: body.slug, routePath });

    return c.json({ success: true, data: { id, slug: body.slug, routePath, status: 'draft' } }, 201);
  },
);

// ─── GET /api/admin/cms/pages/:pageId ────────────────────────────────────────
adminCms.get('/pages/:pageId', requirePermission('cms.read'), async (c) => {
  const pageId = c.req.param('pageId');
  const page = await c.env.DB
    .prepare(`SELECT * FROM cms_pages WHERE id = ?1 OR slug = ?1 LIMIT 1`)
    .bind(pageId)
    .first<Record<string, unknown>>();

  if (!page) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'CMS page not found.', status: 404 } }, 404);
  }

  const sections = await c.env.DB
    .prepare(`SELECT * FROM cms_sections WHERE page_id = ?1 ORDER BY sort_order ASC`)
    .bind(page.id)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      page: {
        id: page.id,
        slug: page.slug,
        routePath: page.route_path,
        pageType: page.page_type,
        title: page.title,
        status: page.status,
        templateKey: page.template_key,
        isSystemRoute: Number(page.is_system_route) === 1,
        draftSeo: safeJsonParse(String(page.draft_seo_json ?? '{}'), {}),
        publishedSeo: safeJsonParse(String(page.published_seo_json ?? '{}'), {}),
        draftLayout: safeJsonParse(String(page.draft_layout_json ?? '{}'), {}),
        publishedLayout: safeJsonParse(String(page.published_layout_json ?? '{}'), {}),
        scheduledAt: page.scheduled_at,
        publishedAt: page.published_at,
        updatedAt: page.updated_at,
      },
      sections: (sections.results ?? []).map((s) => ({
        id: s.id,
        pageId: s.page_id,
        sectionKey: s.section_key,
        sectionType: s.section_type,
        title: s.title,
        sortOrder: Number(s.sort_order),
        isDraftVisible: Number(s.is_draft_visible) === 1,
        isPublishedVisible: Number(s.is_published_visible) === 1,
        status: s.status,
        draftProps: safeJsonParse(String(s.draft_props_json ?? '{}'), {}),
        publishedProps: safeJsonParse(String(s.published_props_json ?? '{}'), {}),
        scheduleStart: s.schedule_start,
        scheduleEnd: s.schedule_end,
        updatedAt: s.updated_at,
      })),
    },
  });
});

// ─── PATCH /api/admin/cms/pages/:pageId ──────────────────────────────────────
adminCms.patch(
  '/pages/:pageId',
  requirePermission('cms.write'),
  zValidator('json', updatePageSchema),
  async (c) => {
    const adminId = c.get('userId');
    const pageId = c.req.param('pageId');
    const body = c.req.valid('json');
    const existing = await c.env.DB
      .prepare(`SELECT * FROM cms_pages WHERE id = ?1 LIMIT 1`)
      .bind(pageId)
      .first<Record<string, unknown>>();

    if (!existing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found.', status: 404 } }, 404);
    }

    const sets: string[] = ['updated_by = ?1', 'updated_at = ?2'];
    const vals: unknown[] = [adminId, nowIso()];
    const addSet = (col: string, val: unknown) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.title !== undefined) addSet('title', body.title);
    if (body.slug !== undefined && Number(existing.is_system_route) === 0) addSet('slug', body.slug);
    if (body.templateKey !== undefined) addSet('template_key', body.templateKey);
    if (body.scheduledAt !== undefined) addSet('scheduled_at', body.scheduledAt);
    if (body.status !== undefined && body.status !== 'published') addSet('status', body.status);
    if (body.seo !== undefined) addSet('draft_seo_json', JSON.stringify(body.seo));
    if (body.layout !== undefined) addSet('draft_layout_json', JSON.stringify(body.layout));

    vals.push(pageId);
    await c.env.DB
      .prepare(`UPDATE cms_pages SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await auditAdminAction(c, 'UPDATE_CMS_PAGE', 'cms_page', pageId, body);
    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── DELETE /api/admin/cms/pages/:pageId ─────────────────────────────────────
adminCms.delete('/pages/:pageId', requirePermission('cms.publish'), async (c) => {
  const pageId = c.req.param('pageId');
  const page = await c.env.DB
    .prepare(`SELECT is_system_route, slug FROM cms_pages WHERE id = ?1 LIMIT 1`)
    .bind(pageId)
    .first<{ is_system_route: number; slug: string }>();

  if (!page) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found.', status: 404 } }, 404);
  }
  if (page.is_system_route === 1) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'System storefront pages cannot be deleted.', status: 403 } },
      403,
    );
  }

  await c.env.DB.prepare(`DELETE FROM cms_pages WHERE id = ?1`).bind(pageId).run();
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'DELETE_CMS_PAGE', 'cms_page', pageId, { slug: page.slug });
  return c.json({ success: true, data: { deleted: true } });
});

// ─── POST /api/admin/cms/pages/:pageId/sections ──────────────────────────────
adminCms.post(
  '/pages/:pageId/sections',
  requirePermission('cms.write'),
  zValidator('json', createSectionSchema),
  async (c) => {
    const pageId = c.req.param('pageId');
    const body = c.req.valid('json');
    const maxRow = await c.env.DB
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM cms_sections WHERE page_id = ?1`)
      .bind(pageId)
      .first<{ m: number }>();

    const secId = generateId('sec_');
    const now = nowIso();
    const sortOrder = body.sortOrder ?? (maxRow?.m ?? 0) + 1;
    const key = body.sectionKey || `${body.sectionType}-${Date.now().toString(36)}`;

    await c.env.DB
      .prepare(
        `INSERT INTO cms_sections
         (id, page_id, section_key, section_type, title, sort_order, is_draft_visible, is_published_visible, status,
          draft_props_json, published_props_json, schedule_start, schedule_end, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'draft', ?8, '{}', ?9, ?10, ?11, ?11)`,
      )
      .bind(
        secId,
        pageId,
        key,
        body.sectionType,
        body.title,
        sortOrder,
        body.isDraftVisible ? 1 : 0,
        JSON.stringify(body.props),
        body.scheduleStart ?? null,
        body.scheduleEnd ?? null,
        now,
      )
      .run();

    await auditAdminAction(c, 'ADD_CMS_SECTION', 'cms_section', secId, { pageId, type: body.sectionType });
    return c.json({ success: true, data: { id: secId, sortOrder } }, 201);
  },
);

// ─── PATCH /api/admin/cms/sections/:sectionId ────────────────────────────────
adminCms.patch(
  '/sections/:sectionId',
  requirePermission('cms.write'),
  zValidator('json', updateSectionSchema),
  async (c) => {
    const sectionId = c.req.param('sectionId');
    const body = c.req.valid('json');
    const existing = await c.env.DB
      .prepare(`SELECT * FROM cms_sections WHERE id = ?1 LIMIT 1`)
      .bind(sectionId)
      .first<Record<string, unknown>>();

    if (!existing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Section not found.', status: 404 } }, 404);
    }

    const sets: string[] = ['updated_at = ?1'];
    const vals: unknown[] = [nowIso()];
    const addSet = (col: string, val: unknown) => {
      sets.push(`${col} = ?${vals.length + 1}`);
      vals.push(val);
    };

    if (body.title !== undefined) addSet('title', body.title);
    if (body.sectionKey !== undefined) addSet('section_key', body.sectionKey);
    if (body.isDraftVisible !== undefined) addSet('is_draft_visible', body.isDraftVisible ? 1 : 0);
    if (body.props !== undefined) addSet('draft_props_json', JSON.stringify(body.props));
    if (body.scheduleStart !== undefined) addSet('schedule_start', body.scheduleStart);
    if (body.scheduleEnd !== undefined) addSet('schedule_end', body.scheduleEnd);

    vals.push(sectionId);
    await c.env.DB
      .prepare(`UPDATE cms_sections SET ${sets.join(', ')} WHERE id = ?${vals.length}`)
      .bind(...vals)
      .run();

    await auditAdminAction(c, 'UPDATE_CMS_SECTION_DRAFT', 'cms_section', sectionId);
    return c.json({ success: true, data: { updated: true } });
  },
);

// ─── POST /api/admin/cms/sections/:sectionId/duplicate ───────────────────────
adminCms.post('/sections/:sectionId/duplicate', requirePermission('cms.write'), async (c) => {
  const sectionId = c.req.param('sectionId');
  const src = await c.env.DB
    .prepare(`SELECT * FROM cms_sections WHERE id = ?1 LIMIT 1`)
    .bind(sectionId)
    .first<Record<string, unknown>>();

  if (!src) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Section not found.', status: 404 } }, 404);
  }

  const maxRow = await c.env.DB
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM cms_sections WHERE page_id = ?1`)
    .bind(src.page_id)
    .first<{ m: number }>();

  const newId = generateId('sec_');
  const now = nowIso();
  await c.env.DB
    .prepare(
      `INSERT INTO cms_sections
       (id, page_id, section_key, section_type, title, sort_order, is_draft_visible, is_published_visible, status,
        draft_props_json, published_props_json, schedule_start, schedule_end, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'draft', ?8, '{}', ?9, ?10, ?11, ?11)`,
    )
    .bind(
      newId,
      src.page_id,
      `${src.section_key}-copy-${Date.now().toString(36)}`,
      src.section_type,
      `${src.title} (Copy)`,
      (maxRow?.m ?? 0) + 1,
      src.is_draft_visible,
      src.draft_props_json,
      src.schedule_start,
      src.schedule_end,
      now,
    )
    .run();

  await auditAdminAction(c, 'DUPLICATE_CMS_SECTION', 'cms_section', newId, { from: sectionId });
  return c.json({ success: true, data: { id: newId } }, 201);
});

// ─── DELETE /api/admin/cms/sections/:sectionId ───────────────────────────────
adminCms.delete('/sections/:sectionId', requirePermission('cms.write'), async (c) => {
  const sectionId = c.req.param('sectionId');
  await c.env.DB.prepare(`DELETE FROM cms_sections WHERE id = ?1`).bind(sectionId).run();
  await auditAdminAction(c, 'DELETE_CMS_SECTION', 'cms_section', sectionId);
  return c.json({ success: true, data: { deleted: true } });
});

// ─── PATCH /api/admin/cms/pages/:pageId/reorder ──────────────────────────────
adminCms.patch(
  '/pages/:pageId/reorder',
  requirePermission('cms.write'),
  zValidator('json', z.object({ orderedSectionIds: z.array(z.string().min(1)).min(1) })),
  async (c) => {
    const pageId = c.req.param('pageId');
    const { orderedSectionIds } = c.req.valid('json');
    const now = nowIso();

    const stmts = orderedSectionIds.map((id, idx) =>
      c.env.DB
        .prepare(`UPDATE cms_sections SET sort_order = ?1, updated_at = ?2 WHERE id = ?3 AND page_id = ?4`)
        .bind(idx + 1, now, id, pageId),
    );
    await c.env.DB.batch(stmts);

    await auditAdminAction(c, 'REORDER_CMS_SECTIONS', 'cms_page', pageId, { orderedSectionIds });
    return c.json({ success: true, data: { reordered: orderedSectionIds.length } });
  },
);

// ─── POST /api/admin/cms/pages/:pageId/publish ───────────────────────────────
adminCms.post('/pages/:pageId/publish', requirePermission('cms.publish'), async (c) => {
  const adminId = c.get('userId');
  const pageId = c.req.param('pageId');
  const page = await c.env.DB
    .prepare(`SELECT * FROM cms_pages WHERE id = ?1 LIMIT 1`)
    .bind(pageId)
    .first<Record<string, unknown>>();

  if (!page) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found.', status: 404 } }, 404);
  }

  const now = nowIso();
  const nextStatus = page.scheduled_at && Date.parse(String(page.scheduled_at)) > Date.now()
    ? 'scheduled'
    : 'published';

  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `UPDATE cms_pages
         SET published_seo_json = draft_seo_json,
             published_layout_json = draft_layout_json,
             status = ?1,
             published_at = ?2,
             updated_by = ?3,
             updated_at = ?2
         WHERE id = ?4`,
      )
      .bind(nextStatus, now, adminId, pageId),
    c.env.DB
      .prepare(
        `UPDATE cms_sections
         SET published_props_json = draft_props_json,
             is_published_visible = is_draft_visible,
             status = CASE WHEN is_draft_visible = 1 THEN 'published' ELSE 'hidden' END,
             updated_at = ?1
         WHERE page_id = ?2`,
      )
      .bind(now, pageId),
  ]);

  const freshSecs = await c.env.DB
    .prepare(`SELECT id, section_key, section_type, title, sort_order, is_draft_visible, draft_props_json FROM cms_sections WHERE page_id = ?1 ORDER BY sort_order ASC`)
    .bind(pageId)
    .all<Record<string, unknown>>();

  const snapshot = {
    title: page.title,
    seo: safeJsonParse(String(page.draft_seo_json ?? '{}'), {}),
    layout: safeJsonParse(String(page.draft_layout_json ?? '{}'), {}),
    sections: (freshSecs.results ?? []).map((s) => ({
      id: s.id,
      sectionKey: s.section_key,
      sectionType: s.section_type,
      title: s.title,
      sortOrder: s.sort_order,
      isVisible: Number(s.is_draft_visible) === 1,
      props: safeJsonParse(String(s.draft_props_json ?? '{}'), {}),
    })),
  };

  await recordCmsRevision(c.env.DB, 'page', pageId, 'publish', snapshot, adminId);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'PUBLISH_CMS_PAGE', 'cms_page', pageId, { slug: page.slug, status: nextStatus });

  return c.json({ success: true, data: { publishedAt: now, status: nextStatus } });
});

// ─── POST /api/admin/cms/pages/:pageId/preview-token ─────────────────────────
adminCms.post('/pages/:pageId/preview-token', requirePermission('cms.read'), async (c) => {
  const adminId = c.get('userId');
  const pageId = c.req.param('pageId');
  const page = await c.env.DB
    .prepare(`SELECT id, slug, route_path FROM cms_pages WHERE id = ?1 LIMIT 1`)
    .bind(pageId)
    .first<{ id: string; slug: string; route_path: string }>();

  if (!page) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found.', status: 404 } }, 404);
  }

  const token = await signPreviewToken(
    { pageId: page.id, slug: page.slug, adminId, includeBrandDraft: true },
    c.env.JWT_SECRET,
  );
  const previewPath = `${page.route_path.replace(/\/\*$/, '') || '/'}?dd_preview=${encodeURIComponent(token)}`;

  return c.json({ success: true, data: { token, previewPath, expiresInMinutes: 30 } });
});

// ─── GET /api/admin/cms/pages/:pageId/revisions ──────────────────────────────
adminCms.get('/pages/:pageId/revisions', requirePermission('cms.read'), async (c) => {
  const pageId = c.req.param('pageId');
  const rows = await c.env.DB
    .prepare(
      `SELECT id, version_number, action, note, created_by, created_at, snapshot_json
       FROM cms_revisions
       WHERE entity_type = 'page' AND entity_id = ?1
       ORDER BY version_number DESC LIMIT 30`,
    )
    .bind(pageId)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((r) => ({
        id: r.id,
        versionNumber: r.version_number,
        action: r.action,
        note: r.note,
        createdBy: r.created_by,
        createdAt: r.created_at,
        snapshot: safeJsonParse(String(r.snapshot_json ?? '{}'), {}),
      })),
    },
  });
});

// ─── POST /api/admin/cms/revisions/:revId/restore ────────────────────────────
adminCms.post('/revisions/:revId/restore', requirePermission('cms.write'), async (c) => {
  const adminId = c.get('userId');
  const revId = c.req.param('revId');
  const rev = await c.env.DB
    .prepare(`SELECT * FROM cms_revisions WHERE id = ?1 AND entity_type = 'page' LIMIT 1`)
    .bind(revId)
    .first<{ id: string; entity_id: string; version_number: number; snapshot_json: string }>();

  if (!rev) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revision not found.', status: 404 } }, 404);
  }

  const snap = safeJsonParse<{
    title?: string;
    seo?: unknown;
    layout?: unknown;
    sections?: Array<{
      id?: string;
      sectionKey?: string;
      sectionType: string;
      title: string;
      sortOrder?: number;
      isVisible?: boolean;
      props?: unknown;
    }>;
  }>(rev.snapshot_json, {});

  const now = nowIso();
  const pageId = rev.entity_id;

  const stmts: D1PreparedStatement[] = [
    c.env.DB
      .prepare(
        `UPDATE cms_pages
         SET title = COALESCE(?1, title),
             draft_seo_json = ?2,
             draft_layout_json = ?3,
             updated_by = ?4,
             updated_at = ?5
         WHERE id = ?6`,
      )
      .bind(
        snap.title ?? null,
        JSON.stringify(snap.seo ?? {}),
        JSON.stringify(snap.layout ?? {}),
        adminId,
        now,
        pageId,
      ),
    c.env.DB.prepare(`DELETE FROM cms_sections WHERE page_id = ?1`).bind(pageId),
  ];

  (snap.sections ?? []).forEach((s, idx) => {
    stmts.push(
      c.env.DB
        .prepare(
          `INSERT INTO cms_sections
           (id, page_id, section_key, section_type, title, sort_order, is_draft_visible, is_published_visible, status,
            draft_props_json, published_props_json, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'draft', ?8, '{}', ?9, ?9)`,
        )
        .bind(
          s.id || generateId('sec_'),
          pageId,
          s.sectionKey || `${s.sectionType}-${idx + 1}`,
          s.sectionType,
          s.title,
          s.sortOrder ?? idx + 1,
          s.isVisible === false ? 0 : 1,
          JSON.stringify(s.props ?? {}),
          now,
        ),
    );
  });

  await c.env.DB.batch(stmts);
  await recordCmsRevision(
    c.env.DB,
    'page',
    pageId,
    'restore_draft',
    snap,
    adminId,
    `Restored from v${rev.version_number}`,
  );
  await auditAdminAction(c, 'RESTORE_CMS_PAGE_REVISION', 'cms_page', pageId, { revId });

  return c.json({ success: true, data: { restoredVersion: rev.version_number, pageId } });
});

export default adminCms;
