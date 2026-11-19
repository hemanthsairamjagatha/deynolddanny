import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';
import {
  getPublishedStorefrontBundle,
  isWithinSchedule,
  safeJsonParse,
} from '../services/storefrontCache.js';
import { verifyPreviewToken } from '../services/mfa.js';
import { formatPaiseToDisplay, paiseToRupees } from '../services/money.js';
import { getLiveFxSnapshot, resolveMarketFromCountryCode } from '../services/fxRates.js';

const storefront = new Hono<{ Bindings: Env }>();

// ─── GET /api/storefront/exchange-rates ──────────────────────────────────────
// Live KV-cached multi-country INR FX rates with edge GeoIP auto-detection
storefront.get('/exchange-rates', async (c) => {
  const snapshot = await getLiveFxSnapshot(c.env, false);

  // Edge GeoIP detection: check Cloudflare, Vercel headers, or optional ?country= override
  const queryCountry = c.req.query('country')?.trim().toUpperCase();
  const cfCountry =
    (c.req.raw as unknown as { cf?: { country?: string } }).cf?.country ||
    c.req.header('cf-ipcountry') ||
    c.req.header('x-vercel-ip-country') ||
    null;

  const rawCountry = queryCountry && /^[A-Z]{2}$/.test(queryCountry) ? queryCountry : cfCountry;
  const detectedMarket = resolveMarketFromCountryCode(rawCountry);

  return c.json(
    {
      success: true,
      data: {
        ...snapshot,
        detectedCountry: rawCountry ? rawCountry.toUpperCase() : null,
        detectedMarket,
        markets: snapshot.markets.filter((m) => m.enabled),
      },
    },
    200,
    {
      // Private so client browser caches briefly, but shared CDN does not cache GeoIP across users
      'Cache-Control': 'private, no-cache, no-store',
      Vary: 'CF-IPCountry, X-Vercel-IP-Country',
    },
  );
});

// ─── GET /api/storefront/published ───────────────────────────────────────────
// Edge-cached published snapshot containing Brand, Nav, Homepage, Categories, Collections, Redirects
storefront.get('/published', async (c) => {
  const bundle = await getPublishedStorefrontBundle(c.env);
  return c.json({ success: true, data: bundle }, 200, {
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
  });
});

// ─── GET /api/storefront/pages ───────────────────────────────────────────────
storefront.get('/pages', async (c) => {
  const nowMs = Date.now();
  const rows = await c.env.DB
    .prepare(
      `SELECT id, slug, route_path, page_type, title, status, published_seo_json, scheduled_at, published_at
       FROM cms_pages
       WHERE status IN ('published', 'scheduled')
       ORDER BY is_system_route DESC, title ASC`,
    )
    .all<{
      id: string;
      slug: string;
      route_path: string;
      page_type: string;
      title: string;
      status: string;
      published_seo_json: string;
      scheduled_at: string | null;
      published_at: string | null;
    }>();

  const items = (rows.results ?? [])
    .filter((r) => r.status === 'published' || isWithinSchedule(r.scheduled_at, null, nowMs))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      routePath: r.route_path,
      pageType: r.page_type,
      title: r.title,
      seo: safeJsonParse(r.published_seo_json, {}),
      publishedAt: r.published_at,
    }));

  return c.json({ success: true, data: { items } }, 200, {
    'Cache-Control': 'public, s-maxage=120',
  });
});

// ─── GET /api/storefront/pages/:slug ─────────────────────────────────────────
storefront.get('/pages/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const nowMs = Date.now();

  const page = await c.env.DB
    .prepare(
      `SELECT * FROM cms_pages WHERE slug = ?1 AND status IN ('published', 'scheduled') LIMIT 1`,
    )
    .bind(slug)
    .first<{
      id: string;
      slug: string;
      route_path: string;
      page_type: string;
      title: string;
      status: string;
      template_key: string;
      published_seo_json: string;
      published_layout_json: string;
      scheduled_at: string | null;
      published_at: string | null;
    }>();

  if (!page || (page.status === 'scheduled' && !isWithinSchedule(page.scheduled_at, null, nowMs))) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Page not found.', status: 404 } },
      404,
    );
  }

  const sections = await c.env.DB
    .prepare(
      `SELECT id, section_key, section_type, title, sort_order, published_props_json, schedule_start, schedule_end
       FROM cms_sections
       WHERE page_id = ?1 AND is_published_visible = 1 AND status = 'published'
       ORDER BY sort_order ASC`,
    )
    .bind(page.id)
    .all<{
      id: string;
      section_key: string;
      section_type: string;
      title: string;
      sort_order: number;
      published_props_json: string;
      schedule_start: string | null;
      schedule_end: string | null;
    }>();

  const visibleSections = (sections.results ?? [])
    .filter((s) => isWithinSchedule(s.schedule_start, s.schedule_end, nowMs))
    .map((s) => ({
      id: s.id,
      sectionKey: s.section_key,
      sectionType: s.section_type,
      title: s.title,
      sortOrder: s.sort_order,
      props: safeJsonParse(s.published_props_json, {}),
    }));

  return c.json(
    {
      success: true,
      data: {
        id: page.id,
        slug: page.slug,
        routePath: page.route_path,
        pageType: page.page_type,
        title: page.title,
        templateKey: page.template_key,
        seo: safeJsonParse(page.published_seo_json, {}),
        layout: safeJsonParse(page.published_layout_json, {}),
        publishedAt: page.published_at,
        sections: visibleSections,
      },
    },
    200,
    { 'Cache-Control': 'public, s-maxage=120' },
  );
});

// ─── GET /api/storefront/preview?token=... ───────────────────────────────────
// Strictly requires signed HMAC preview token; returns DRAFT state, never indexed/cached
storefront.get('/preview', async (c) => {
  const token = c.req.query('token')?.trim();
  if (!token) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Preview token is required.', status: 401 } },
      401,
    );
  }

  const verified = await verifyPreviewToken(token, c.env.JWT_SECRET);
  if (!verified) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired preview token.', status: 403 } },
      403,
    );
  }

  const slug = verified.slug || 'home';
  const page = await c.env.DB
    .prepare(`SELECT * FROM cms_pages WHERE slug = ?1 OR id = ?2 LIMIT 1`)
    .bind(slug, verified.pageId ?? '')
    .first<{
      id: string;
      slug: string;
      route_path: string;
      page_type: string;
      title: string;
      status: string;
      template_key: string;
      draft_seo_json: string;
      draft_layout_json: string;
    }>();

  if (!page) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Draft page not found.', status: 404 } },
      404,
    );
  }

  const [secRows, brandRow, navRows] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT id, section_key, section_type, title, sort_order, is_draft_visible, draft_props_json
         FROM cms_sections WHERE page_id = ?1 ORDER BY sort_order ASC`,
      )
      .bind(page.id)
      .all<{
        id: string;
        section_key: string;
        section_type: string;
        title: string;
        sort_order: number;
        is_draft_visible: number;
        draft_props_json: string;
      }>(),
    verified.includeBrandDraft
      ? c.env.DB.prepare(`SELECT draft_json FROM brand_settings WHERE id = 'default'`).first<{ draft_json: string }>()
      : Promise.resolve(null),
    verified.includeBrandDraft
      ? c.env.DB.prepare(`SELECT menu_key, draft_items_json FROM navigation_menus`).all<{
          menu_key: string;
          draft_items_json: string;
        }>()
      : Promise.resolve(null),
  ]);

  const draftNav: Record<string, unknown> = {};
  if (navRows?.results) {
    for (const r of navRows.results) {
      draftNav[r.menu_key] = safeJsonParse(r.draft_items_json, {});
    }
  }

  return c.json(
    {
      success: true,
      data: {
        isPreview: true,
        page: {
          id: page.id,
          slug: page.slug,
          routePath: page.route_path,
          pageType: page.page_type,
          title: page.title,
          status: page.status,
          templateKey: page.template_key,
          seo: safeJsonParse(page.draft_seo_json, {}),
          layout: safeJsonParse(page.draft_layout_json, {}),
        },
        sections: (secRows.results ?? [])
          .filter((s) => s.is_draft_visible === 1)
          .map((s) => ({
            id: s.id,
            sectionKey: s.section_key,
            sectionType: s.section_type,
            title: s.title,
            sortOrder: s.sort_order,
            props: safeJsonParse(s.draft_props_json, {}),
          })),
        ...(brandRow ? { brand: safeJsonParse(brandRow.draft_json, {}) } : {}),
        ...(navRows ? { navigation: draftNav } : {}),
      },
    },
    200,
    {
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  );
});

// ─── GET /api/storefront/collections & /:slug ────────────────────────────────
storefront.get('/collections', async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT * FROM collections WHERE is_active = 1 ORDER BY sort_order ASC`)
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
        mobileImage: r.mobile_image || r.hero_image,
        focalX: r.focal_x,
        focalY: r.focal_y,
        seo: safeJsonParse(String(r.seo_json ?? '{}'), {}),
      })),
    },
  });
});

storefront.get('/collections/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const col = await c.env.DB
    .prepare(`SELECT * FROM collections WHERE slug = ?1 AND is_active = 1 LIMIT 1`)
    .bind(slug)
    .first<Record<string, unknown>>();

  if (!col) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Collection not found.', status: 404 } },
      404,
    );
  }

  const prods = await c.env.DB
    .prepare(
      `SELECT p.* FROM products p
       INNER JOIN collection_products cp ON cp.product_id = p.id
       WHERE cp.collection_id = ?1 AND p.is_active = 1
       ORDER BY cp.sort_order ASC, p.sort_order ASC`,
    )
    .bind(col.id)
    .all<Record<string, unknown>>();

  return c.json({
    success: true,
    data: {
      id: col.id,
      slug: col.slug,
      title: col.title,
      eyebrow: col.eyebrow,
      description: col.description,
      heroImage: col.hero_image,
      mobileImage: col.mobile_image || col.hero_image,
      focalX: col.focal_x,
      focalY: col.focal_y,
      seo: safeJsonParse(String(col.seo_json ?? '{}'), {}),
      products: (prods.results ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        badge: p.badge ?? null,
        defaultImg: p.default_img,
        hoverImg: p.hover_img,
        link: `/products/${p.slug}`,
        price: formatPaiseToDisplay(Number(p.price_paise)),
        priceNum: paiseToRupees(Number(p.price_paise)),
        pricePaise: Number(p.price_paise),
      })),
    },
  });
});

// ─── GET /api/storefront/size-guides ─────────────────────────────────────────
storefront.get('/size-guides', async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT id, slug, title, category_slug, tables_json, measurement_notes_json, fit_rules_json FROM size_guides`)
    .all<Record<string, string>>();
  return c.json({
    success: true,
    data: {
      items: (rows.results ?? []).map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        categorySlug: g.category_slug,
        tables: safeJsonParse(g.tables_json, []),
        notes: safeJsonParse(g.measurement_notes_json, []),
        fitRules: safeJsonParse(g.fit_rules_json, {}),
      })),
    },
  });
});

// ─── GET /api/storefront/redirects/resolve?path=... ──────────────────────────
storefront.get('/redirects/resolve', async (c) => {
  const rawPath = c.req.query('path')?.trim() || '/';
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const redirect = await c.env.DB
    .prepare(
      `SELECT id, source_path, target_path, status_code FROM cms_redirects WHERE source_path = ?1 AND is_active = 1 LIMIT 1`,
    )
    .bind(cleanPath)
    .first<{ id: string; source_path: string; target_path: string; status_code: number }>();

  if (!redirect) {
    return c.json({ success: true, data: { matched: false } });
  }

  c.executionCtx.waitUntil(
    c.env.DB
      .prepare(`UPDATE cms_redirects SET hits = hits + 1 WHERE id = ?1`)
      .bind(redirect.id)
      .run()
      .catch(() => {}),
  );

  return c.json({
    success: true,
    data: {
      matched: true,
      targetPath: redirect.target_path,
      statusCode: redirect.status_code,
    },
  });
});

export default storefront;
