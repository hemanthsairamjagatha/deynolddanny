// KV-cached storefront snapshot compiler, CMS revision recorder & schedule helper

import type { Env } from '../types/bindings.js';
import type { DbCategory } from '../types/models.js';
import { nowIso } from '../db/client.js';
import { generateId } from './crypto.js';
import { resolveStorePolicy } from '../config/policy.js';

export const STOREFRONT_CACHE_KEY = 'storefront:published:v1';
export const STOREFRONT_CACHE_TTL_SECONDS = 3600;

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function isWithinSchedule(
  start: string | null | undefined,
  end: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (start) {
    const s = Date.parse(start);
    if (!Number.isNaN(s) && nowMs < s) return false;
  }
  if (end) {
    const e = Date.parse(end);
    if (!Number.isNaN(e) && nowMs > e) return false;
  }
  return true;
}

export interface CompiledStorefrontBundle {
  version: string;
  compiledAt: string;
  brand: Record<string, unknown>;
  storeConfig: Record<string, unknown>;
  navigation: Record<string, unknown>;
  categories: Array<Record<string, unknown>>;
  collections: Array<Record<string, unknown>>;
  homepageSections: Array<Record<string, unknown>>;
  pdpConfig: Record<string, unknown>;
  contactPage: Record<string, unknown>;
  legalPages: Record<string, Record<string, unknown>>;
  sizeGuides: Array<Record<string, unknown>>;
  redirects: Array<{ sourcePath: string; targetPath: string; statusCode: number }>;
  robotsDisallowPaths: string[];
}

export async function compilePublishedStorefrontBundle(
  env: Env,
): Promise<CompiledStorefrontBundle> {
  const db = env.DB;
  const nowMs = Date.now();
  const basePolicy = resolveStorePolicy(env);

  const [
    brandRow,
    storeRow,
    navRows,
    catRows,
    colRows,
    pageRows,
    sectionRows,
    guideRows,
    redirectRows,
  ] = await Promise.all([
    db.prepare(`SELECT published_json, published_version FROM brand_settings WHERE id = 'default'`).first<{
      published_json: string;
      published_version: number;
    }>(),
    db.prepare(`SELECT settings_json FROM store_settings WHERE id = 'default'`).first<{
      settings_json: string;
    }>(),
    db.prepare(`SELECT menu_key, published_items_json FROM navigation_menus`).all<{
      menu_key: string;
      published_items_json: string;
    }>(),
    db.prepare(`SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC`).all<
      DbCategory & {
        hero_title?: string | null;
        eyebrow?: string | null;
        mobile_image?: string | null;
        focal_x?: number;
        focal_y?: number;
        editorial_json?: string | null;
        seo_json?: string | null;
      }
    >(),
    db.prepare(`SELECT * FROM collections WHERE is_active = 1 ORDER BY sort_order ASC`).all<{
      id: string;
      slug: string;
      title: string;
      eyebrow: string;
      description: string;
      hero_image: string;
      mobile_image: string | null;
      focal_x: number;
      focal_y: number;
      seo_json: string;
    }>(),
    db
      .prepare(
        `SELECT id, slug, route_path, page_type, title, status, published_seo_json, published_layout_json, scheduled_at, published_at
         FROM cms_pages
         WHERE status IN ('published', 'scheduled')`,
      )
      .all<{
        id: string;
        slug: string;
        route_path: string;
        page_type: string;
        title: string;
        status: string;
        published_seo_json: string;
        published_layout_json: string;
        scheduled_at: string | null;
        published_at: string | null;
      }>(),
    db
      .prepare(
        `SELECT id, page_id, section_key, section_type, title, sort_order, is_published_visible, status, published_props_json, schedule_start, schedule_end
         FROM cms_sections
         WHERE is_published_visible = 1 AND status = 'published'
         ORDER BY sort_order ASC`,
      )
      .all<{
        id: string;
        page_id: string;
        section_key: string;
        section_type: string;
        title: string;
        sort_order: number;
        is_published_visible: number;
        status: string;
        published_props_json: string;
        schedule_start: string | null;
        schedule_end: string | null;
      }>(),
    db.prepare(`SELECT id, slug, title, category_slug, tables_json, measurement_notes_json, fit_rules_json FROM size_guides`).all<{
      id: string;
      slug: string;
      title: string;
      category_slug: string | null;
      tables_json: string;
      measurement_notes_json: string;
      fit_rules_json: string;
    }>(),
    db
      .prepare(`SELECT source_path, target_path, status_code FROM cms_redirects WHERE is_active = 1`)
      .all<{ source_path: string; target_path: string; status_code: number }>(),
  ]);

  const brand = safeJsonParse<Record<string, unknown>>(brandRow?.published_json, {});
  const storeSettings = safeJsonParse<Record<string, unknown>>(storeRow?.settings_json, {});

  // Public-only subset of store configuration (NEVER expose internal/credential/provider flags)
  const publicStoreConfig = {
    currency: 'INR',
    freeShippingThresholdPaise: Number(
      storeSettings.freeShippingThresholdPaise ?? basePolicy.freeShippingThresholdPaise,
    ),
    standardShippingPaise: Number(
      storeSettings.standardShippingPaise ?? basePolicy.standardShippingPaise,
    ),
    returnWindowDays: Number(storeSettings.returnWindowDays ?? basePolicy.returnWindowDays),
    taxInclusive: basePolicy.taxInclusive,
    pdpShowExclusiveBanner: Boolean(storeSettings.pdpShowExclusiveBanner ?? true),
    pdpExclusiveBannerText: String(storeSettings.pdpExclusiveBannerText ?? ''),
    pdpShippingSummary: String(storeSettings.pdpShippingSummary ?? ''),
    cartGiftNoteEnabled: Boolean(storeSettings.cartGiftNoteEnabled ?? true),
    cartTaxNote: String(storeSettings.cartTaxNote ?? ''),
    codEnabled: Boolean(storeSettings.codEnabled ?? false),
    codMaxPaise: Number(storeSettings.codMaxPaise ?? 5000000),
    allowReviewsWithoutPurchase: Boolean(storeSettings.allowReviewsWithoutPurchase ?? true),
    enableFitFinder:
      storeSettings.enableFitFinder !== undefined ? Boolean(storeSettings.enableFitFinder) : true,
    enableReviewsOnPdp:
      storeSettings.enableReviewsOnPdp !== undefined ? Boolean(storeSettings.enableReviewsOnPdp) : true,
  };

  const navigation: Record<string, unknown> = {};
  for (const row of navRows.results ?? []) {
    navigation[row.menu_key] = safeJsonParse(row.published_items_json, {});
  }

  const pageById = new Map<string, (typeof pageRows.results)[number]>();
  for (const p of pageRows.results ?? []) {
    if (p.status === 'scheduled' && !isWithinSchedule(p.scheduled_at, null, nowMs)) continue;
    pageById.set(p.id, p);
  }

  const sectionsByPage = new Map<string, Array<Record<string, unknown>>>();
  for (const s of sectionRows.results ?? []) {
    if (!isWithinSchedule(s.schedule_start, s.schedule_end, nowMs)) continue;
    const list = sectionsByPage.get(s.page_id) ?? [];
    list.push({
      id: s.id,
      sectionKey: s.section_key,
      sectionType: s.section_type,
      title: s.title,
      sortOrder: s.sort_order,
      props: safeJsonParse(s.published_props_json, {}),
    });
    sectionsByPage.set(s.page_id, list);
  }

  const homepageSections = sectionsByPage.get('page_home') ?? [];
  const pdpSections = sectionsByPage.get('page_pdp_global') ?? [];
  const pdpConfig = (pdpSections[0]?.props as Record<string, unknown>) ?? {};
  const contactSections = sectionsByPage.get('page_contact') ?? [];
  const contactPage = (contactSections[0]?.props as Record<string, unknown>) ?? {};

  const legalPages: Record<string, Record<string, unknown>> = {};
  for (const p of pageRows.results ?? []) {
    if (p.page_type === 'legal' && pageById.has(p.id)) {
      const firstSec = (sectionsByPage.get(p.id) ?? [])[0];
      legalPages[p.slug] = {
        title: p.title,
        seo: safeJsonParse(p.published_seo_json, {}),
        ...((firstSec?.props as Record<string, unknown>) ?? {}),
      };
    }
  }

  const categories = (catRows.results ?? []).map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    title: cat.title,
    heroTitle: cat.hero_title ?? cat.title,
    eyebrow: cat.eyebrow ?? cat.tagline ?? 'COLLECTION',
    subtitle: cat.subtitle ?? '',
    tagline: cat.tagline ?? '',
    imageUrl: cat.image_url ?? '/images/category-abiti.jpg',
    mobileImage: cat.mobile_image ?? cat.image_url ?? '/images/category-abiti.jpg',
    focalX: cat.focal_x ?? 50,
    focalY: cat.focal_y ?? 50,
    editorial: safeJsonParse(cat.editorial_json, {}),
    seo: safeJsonParse(cat.seo_json, {}),
    sortOrder: cat.sort_order,
  }));

  const collections = (colRows.results ?? []).map((col) => ({
    id: col.id,
    slug: col.slug,
    title: col.title,
    eyebrow: col.eyebrow,
    description: col.description,
    heroImage: col.hero_image,
    mobileImage: col.mobile_image ?? col.hero_image,
    focalX: col.focal_x,
    focalY: col.focal_y,
    seo: safeJsonParse(col.seo_json, {}),
  }));

  const sizeGuides = (guideRows.results ?? []).map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    categorySlug: g.category_slug,
    tables: safeJsonParse(g.tables_json, []),
    notes: safeJsonParse(g.measurement_notes_json, []),
    fitRules: safeJsonParse(g.fit_rules_json, {}),
  }));

  const redirects = (redirectRows.results ?? []).map((r) => ({
    sourcePath: r.source_path,
    targetPath: r.target_path,
    statusCode: r.status_code,
  }));

  const robotsDisallowPaths = Array.isArray(storeSettings.robotsDisallowPaths)
    ? storeSettings.robotsDisallowPaths.map(String)
    : ['/cart', '/checkout', '/account', '/wishlist', '/search', '/admin', '/api'];

  const version = `v_${brandRow?.published_version ?? 1}_${Date.now()}`;
  const bundle: CompiledStorefrontBundle = {
    version,
    compiledAt: nowIso(),
    brand,
    storeConfig: publicStoreConfig,
    navigation,
    categories,
    collections,
    homepageSections,
    pdpConfig,
    contactPage,
    legalPages,
    sizeGuides,
    redirects,
    robotsDisallowPaths,
  };

  try {
    await env.CATALOG_KV.put(STOREFRONT_CACHE_KEY, JSON.stringify(bundle), {
      expirationTtl: STOREFRONT_CACHE_TTL_SECONDS,
    });
  } catch {
    // Non-fatal in test runners without persistent KV
  }

  return bundle;
}

export async function getPublishedStorefrontBundle(env: Env): Promise<CompiledStorefrontBundle> {
  try {
    const cached = await env.CATALOG_KV.get<CompiledStorefrontBundle>(STOREFRONT_CACHE_KEY, 'json');
    if (cached && typeof cached === 'object') {
      return cached;
    }
  } catch {
    // Cache miss or KV transient error -> recompile from D1
  }
  return compilePublishedStorefrontBundle(env);
}

export async function invalidateStorefrontCache(env: Env): Promise<void> {
  try {
    await Promise.all([
      env.CATALOG_KV.delete(STOREFRONT_CACHE_KEY),
      env.CATALOG_KV.put('catalog:version', `v_${Date.now()}`),
    ]);
  } catch {
    // Non-fatal
  }
}

export async function recordCmsRevision(
  db: D1Database,
  entityType: 'page' | 'brand' | 'navigation' | 'store_settings',
  entityId: string,
  action: string,
  snapshot: unknown,
  createdBy: string,
  note?: string,
): Promise<void> {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(version_number), 0) AS max_ver
       FROM cms_revisions
       WHERE entity_type = ?1 AND entity_id = ?2`,
    )
    .bind(entityType, entityId)
    .first<{ max_ver: number }>();

  const nextVer = (row?.max_ver ?? 0) + 1;
  await db
    .prepare(
      `INSERT INTO cms_revisions (id, entity_type, entity_id, version_number, action, snapshot_json, note, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      generateId('rev_'),
      entityType,
      entityId,
      nextVer,
      action,
      JSON.stringify(snapshot),
      note ?? null,
      createdBy,
      nowIso(),
    )
    .run();
}
