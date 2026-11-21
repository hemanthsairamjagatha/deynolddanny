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

const adminBrand = new Hono<{ Bindings: Env }>();

const socialLinkSchema = z.object({
  platform: z.string().min(1).max(40),
  handle: z.string().min(1).max(80),
  url: z.string().max(300),
  visible: z.boolean().default(true),
});

const brandDraftSchema = z.object({
  businessName: z.string().min(2).max(160).optional(),
  displayName: z.string().min(2).max(100).optional(),
  shortMark: z.string().min(1).max(16).optional(),
  siteTitleTemplate: z.string().min(2).max(120).optional(),
  defaultMetaTitle: z.string().max(160).optional(),
  defaultMetaDescription: z.string().max(320).optional(),
  originBadgeText: z.string().max(40).optional(),
  editorialTagline: z.string().max(180).optional(),
  houseStory: z.string().max(800).optional(),
  logoPrimaryUrl: z.string().max(500).optional(),
  logoInverseUrl: z.string().max(500).optional(),
  logoCompactUrl: z.string().max(500).optional(),
  faviconUrl: z.string().max(500).optional(),
  ogDefaultImageUrl: z.string().max(500).optional(),
  conciergeEmail: z.string().email().or(z.literal('')).optional(),
  privacyEmail: z.string().email().or(z.literal('')).optional(),
  conciergePhone: z.string().max(40).optional(),
  atelierName: z.string().max(120).optional(),
  atelierAddress: z.string().max(240).optional(),
  atelierHours: z.string().max(120).optional(),
  gstin: z.string().max(32).optional(),
  cin: z.string().max(40).optional(),
  regionLabel: z.string().max(60).optional(),
  currencyCode: z.string().max(8).optional(),
  currencySymbol: z.string().max(6).optional(),
  copyrightText: z.string().max(200).optional(),
  attributionText: z.string().max(120).optional(),
  attributionUrl: z.string().max(300).optional(),
  showAttribution: z.boolean().optional(),
  colors: z.record(z.string().max(40)).optional(),
  typography: z
    .object({
      displayFont: z.string().max(80),
      bodyFont: z.string().max(80),
      monoFont: z.string().max(80).optional(),
      baseSizePx: z.number().min(12).max(22).optional(),
      letterSpacingScale: z.string().max(40).optional(),
    })
    .optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
});

const LOCKED_ATTRIBUTION = {
  attributionText: 'HANDCRAFTED BY PIXENOX SOLUTIONS',
  attributionUrl: 'https://www.pixenox.com',
  showAttribution: true,
} as const;

// ─── GET /api/admin/brand ────────────────────────────────────────────────────
adminBrand.get('/', requirePermission('brand.write', 'cms.read'), async (c) => {
  const row = await c.env.DB
    .prepare(`SELECT * FROM brand_settings WHERE id = 'default' LIMIT 1`)
    .first<{
      draft_json: string;
      published_json: string;
      draft_version: number;
      published_version: number;
      updated_by: string | null;
      published_by: string | null;
      updated_at: string;
      published_at: string;
    }>();

  if (!row) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Brand identity not initialized.', status: 404 } },
      404,
    );
  }

  return c.json({
    success: true,
    data: {
      draft: { ...safeJsonParse(row.draft_json, {}), ...LOCKED_ATTRIBUTION },
      published: { ...safeJsonParse(row.published_json, {}), ...LOCKED_ATTRIBUTION },
      draftVersion: row.draft_version,
      publishedVersion: row.published_version,
      hasUnpublishedChanges: row.draft_json !== row.published_json,
      updatedBy: row.updated_by,
      publishedBy: row.published_by,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    },
  });
});

// ─── PATCH /api/admin/brand/draft ────────────────────────────────────────────
adminBrand.patch(
  '/draft',
  requirePermission('brand.write'),
  zValidator('json', brandDraftSchema),
  async (c) => {
    const adminId = c.get('userId');
    const body = c.req.valid('json');
    const current = await c.env.DB
      .prepare(`SELECT draft_json, draft_version FROM brand_settings WHERE id = 'default'`)
      .first<{ draft_json: string; draft_version: number }>();

    const merged = {
      ...safeJsonParse<Record<string, unknown>>(current?.draft_json, {}),
      ...body,
      ...LOCKED_ATTRIBUTION,
    };
    const now = nowIso();
    const nextVer = (current?.draft_version ?? 1) + 1;

    await c.env.DB
      .prepare(
        `UPDATE brand_settings SET draft_json = ?1, draft_version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = 'default'`,
      )
      .bind(JSON.stringify(merged), nextVer, adminId, now)
      .run();

    await recordCmsRevision(c.env.DB, 'brand', 'default', 'save_draft', merged, adminId);
    await auditAdminAction(c, 'SAVE_BRAND_DRAFT', 'brand_settings', 'default', { version: nextVer });

    return c.json({ success: true, data: { draft: merged, draftVersion: nextVer } });
  },
);

// ─── POST /api/admin/brand/publish ───────────────────────────────────────────
adminBrand.post('/publish', requirePermission('brand.write'), async (c) => {
  const adminId = c.get('userId');
  const row = await c.env.DB
    .prepare(`SELECT draft_json, published_version FROM brand_settings WHERE id = 'default'`)
    .first<{ draft_json: string; published_version: number }>();

  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Brand record missing.', status: 404 } }, 404);
  }

  const now = nowIso();
  const nextPub = (row.published_version ?? 1) + 1;

  await c.env.DB
    .prepare(
      `UPDATE brand_settings
       SET published_json = draft_json, published_version = ?1, published_by = ?2, published_at = ?3
       WHERE id = 'default'`,
    )
    .bind(nextPub, adminId, now)
    .run();

  const snapshot = safeJsonParse(row.draft_json, {});
  await recordCmsRevision(c.env.DB, 'brand', 'default', 'publish', snapshot, adminId);
  await invalidateStorefrontCache(c.env);
  await auditAdminAction(c, 'PUBLISH_BRAND_IDENTITY', 'brand_settings', 'default', {
    publishedVersion: nextPub,
  });

  return c.json({
    success: true,
    data: { published: snapshot, publishedVersion: nextPub, publishedAt: now },
  });
});

// ─── GET /api/admin/brand/revisions ──────────────────────────────────────────
adminBrand.get('/revisions', requirePermission('brand.write', 'cms.read'), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT id, version_number, action, note, created_by, created_at, snapshot_json
       FROM cms_revisions
       WHERE entity_type = 'brand' AND entity_id = 'default'
       ORDER BY version_number DESC LIMIT 30`,
    )
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

// ─── POST /api/admin/brand/revisions/:revId/restore ──────────────────────────
adminBrand.post('/revisions/:revId/restore', requirePermission('brand.write'), async (c) => {
  const adminId = c.get('userId');
  const revId = c.req.param('revId');
  const rev = await c.env.DB
    .prepare(
      `SELECT snapshot_json, version_number FROM cms_revisions WHERE id = ?1 AND entity_type = 'brand' LIMIT 1`,
    )
    .bind(revId)
    .first<{ snapshot_json: string; version_number: number }>();

  if (!rev) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revision not found.', status: 404 } }, 404);
  }

  const now = nowIso();
  await c.env.DB
    .prepare(
      `UPDATE brand_settings SET draft_json = ?1, draft_version = draft_version + 1, updated_by = ?2, updated_at = ?3 WHERE id = 'default'`,
    )
    .bind(rev.snapshot_json, adminId, now)
    .run();

  await recordCmsRevision(
    c.env.DB,
    'brand',
    'default',
    'restore_draft',
    safeJsonParse(rev.snapshot_json, {}),
    adminId,
    `Restored from v${rev.version_number}`,
  );
  await auditAdminAction(c, 'RESTORE_BRAND_REVISION', 'brand_settings', revId);

  return c.json({
    success: true,
    data: { restoredVersion: rev.version_number, draft: safeJsonParse(rev.snapshot_json, {}) },
  });
});

export default adminBrand;
