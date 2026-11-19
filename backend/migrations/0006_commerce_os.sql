-- =============================================================================
-- DEYNOLD DANNY COMMERCE OPERATING SYSTEM — Migration 0006
-- Adds: Granular RBAC + Admin Staff Grants + TOTP MFA + Brand Identity +
--       Visual Content Studio (Pages, Sections, Revisions, Navigation, Redirects) +
--       Media Library (Folders, Assets, Binary Fallback Blobs) +
--       Collections + Extended Category Merchandising + Size Guides +
--       Product Reviews + Contact Inquiries + Email Templates + Store Settings +
--       Analytics Events
-- Safe to run regardless of whether 0002_seed_data.sql was skipped in tests.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. RBAC, STAFF AUTHORIZATION GRANTS & TOTP MFA
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_roles (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  mfa_required INTEGER NOT NULL DEFAULT 0 CHECK (mfa_required IN (0, 1)),
  is_system    INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  code        TEXT PRIMARY KEY,
  module      TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id         TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES admin_permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

-- Explicit staff grant created by a Super Admin (prevents privilege escalation if users.role is altered illegally)
CREATE TABLE IF NOT EXISTS admin_staff_grants (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES admin_roles(id),
  granted_by  TEXT NOT NULL,
  note        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_mfa_secrets (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_enc    TEXT NOT NULL,
  backup_hashes_json TEXT NOT NULL DEFAULT '[]',
  verified_at        TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extend users (last_login_at already exists in 0001; only add new columns)
ALTER TABLE users ADD COLUMN admin_role_id TEXT;
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE refresh_tokens ADD COLUMN mfa_verified INTEGER NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 2. MEDIA LIBRARY
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_folders (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT REFERENCES media_folders(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_assets (
  id              TEXT PRIMARY KEY,
  folder_id       TEXT REFERENCES media_folders(id) ON DELETE SET NULL,
  key             TEXT NOT NULL UNIQUE,
  url             TEXT NOT NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  width           INTEGER,
  height          INTEGER,
  alt_text        TEXT NOT NULL DEFAULT '',
  default_focal_x INTEGER NOT NULL DEFAULT 50 CHECK (default_focal_x BETWEEN 0 AND 100),
  default_focal_y INTEGER NOT NULL DEFAULT 50 CHECK (default_focal_y BETWEEN 0 AND 100),
  tags_json       TEXT NOT NULL DEFAULT '[]',
  source_type     TEXT NOT NULL DEFAULT 'r2' CHECK (source_type IN ('r2', 'local_seed', 'db_blob', 'external')),
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fallback storage when Cloudflare R2 binding is absent in dev/test environments
CREATE TABLE IF NOT EXISTS media_blobs (
  asset_key   TEXT PRIMARY KEY,
  mime_type   TEXT NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON media_assets(folder_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. CENTRALIZED BRAND IDENTITY & STORE CONFIGURATION
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brand_settings (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  draft_json        TEXT NOT NULL,
  published_json    TEXT NOT NULL,
  draft_version     INTEGER NOT NULL DEFAULT 1,
  published_version INTEGER NOT NULL DEFAULT 1,
  updated_by        TEXT,
  published_by      TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  published_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS store_settings (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  settings_json TEXT NOT NULL,
  updated_by    TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 4. VISUAL CONTENT STUDIO (CMS PAGES, SECTIONS, REVISIONS, NAVIGATION, REDIRECTS)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms_pages (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  route_path          TEXT NOT NULL UNIQUE,
  page_type           TEXT NOT NULL DEFAULT 'custom' CHECK (page_type IN ('home', 'category_template', 'collection', 'custom', 'legal', 'contact', 'pdp_global', 'utility')),
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  template_key        TEXT NOT NULL DEFAULT 'editorial',
  is_system_route     INTEGER NOT NULL DEFAULT 0 CHECK (is_system_route IN (0, 1)),
  draft_seo_json      TEXT NOT NULL DEFAULT '{}',
  published_seo_json  TEXT NOT NULL DEFAULT '{}',
  draft_layout_json   TEXT NOT NULL DEFAULT '{}',
  published_layout_json TEXT NOT NULL DEFAULT '{}',
  scheduled_at        TEXT,
  published_at        TEXT,
  updated_by          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cms_sections (
  id                   TEXT PRIMARY KEY,
  page_id              TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  section_key          TEXT NOT NULL,
  section_type         TEXT NOT NULL,
  title                TEXT NOT NULL,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  is_draft_visible     INTEGER NOT NULL DEFAULT 1 CHECK (is_draft_visible IN (0, 1)),
  is_published_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_published_visible IN (0, 1)),
  status               TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden')),
  draft_props_json     TEXT NOT NULL DEFAULT '{}',
  published_props_json TEXT NOT NULL DEFAULT '{}',
  schedule_start       TEXT,
  schedule_end         TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cms_sections_page_order ON cms_sections(page_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS cms_revisions (
  id             TEXT PRIMARY KEY,
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('page', 'brand', 'navigation', 'store_settings')),
  entity_id      TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  action         TEXT NOT NULL DEFAULT 'save',
  snapshot_json  TEXT NOT NULL,
  note           TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cms_revisions_entity ON cms_revisions(entity_type, entity_id, version_number DESC);

CREATE TABLE IF NOT EXISTS navigation_menus (
  id                  TEXT PRIMARY KEY,
  menu_key            TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  draft_items_json    TEXT NOT NULL DEFAULT '[]',
  published_items_json TEXT NOT NULL DEFAULT '[]',
  updated_by          TEXT,
  published_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cms_redirects (
  id          TEXT PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
  note        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  hits        INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 5. COLLECTIONS, CATEGORY MERCHANDISING EXTENSIONS, SIZE GUIDES, REVIEWS, INQUIRIES, TEMPLATES
-- -----------------------------------------------------------------------------

ALTER TABLE categories ADD COLUMN hero_title TEXT;
ALTER TABLE categories ADD COLUMN eyebrow TEXT;
ALTER TABLE categories ADD COLUMN mobile_image TEXT;
ALTER TABLE categories ADD COLUMN focal_x INTEGER NOT NULL DEFAULT 50;
ALTER TABLE categories ADD COLUMN focal_y INTEGER NOT NULL DEFAULT 50;
ALTER TABLE categories ADD COLUMN editorial_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE categories ADD COLUMN seo_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS collections (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  eyebrow      TEXT NOT NULL DEFAULT 'Curated Capsule',
  description  TEXT NOT NULL DEFAULT '',
  hero_image   TEXT NOT NULL DEFAULT '/images/category-abiti.jpg',
  mobile_image TEXT,
  focal_x      INTEGER NOT NULL DEFAULT 50 CHECK (focal_x BETWEEN 0 AND 100),
  focal_y      INTEGER NOT NULL DEFAULT 50 CHECK (focal_y BETWEEN 0 AND 100),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  seo_json     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS size_guides (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  category_slug          TEXT,
  tables_json            TEXT NOT NULL DEFAULT '[]',
  measurement_notes_json TEXT NOT NULL DEFAULT '[]',
  fit_rules_json         TEXT NOT NULL DEFAULT '{}',
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name       TEXT NOT NULL,
  author_email      TEXT NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             TEXT NOT NULL DEFAULT '',
  body              TEXT NOT NULL,
  fit_feedback      TEXT DEFAULT 'true_to_size' CHECK (fit_feedback IN ('runs_small', 'true_to_size', 'runs_large')),
  verified_purchase INTEGER NOT NULL DEFAULT 0 CHECK (verified_purchase IN (0, 1)),
  is_featured       INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_reply       TEXT,
  moderated_by      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON product_reviews(product_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  subject           TEXT NOT NULL,
  message           TEXT NOT NULL,
  preferred_contact TEXT NOT NULL DEFAULT 'email',
  status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'archived')),
  assigned_to       TEXT,
  internal_notes    TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON contact_inquiries(status, created_at DESC);

CREATE TABLE IF NOT EXISTS email_templates (
  template_key     TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  subject_template TEXT NOT NULL,
  html_template    TEXT NOT NULL,
  text_template    TEXT NOT NULL DEFAULT '',
  variables_json   TEXT NOT NULL DEFAULT '[]',
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  updated_by       TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  event_name  TEXT NOT NULL,
  session_id  TEXT,
  user_id     TEXT,
  path        TEXT,
  entity_id   TEXT,
  value_paise INTEGER,
  meta_json   TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_time ON analytics_events(event_name, created_at DESC);

-- =============================================================================
-- 6. SEED PERMISSIONS & SYSTEM ROLES
-- =============================================================================

INSERT OR IGNORE INTO admin_permissions (code, module, label, description) VALUES
  ('dashboard.read',   'Dashboard',     'View Executive Dashboard',      'Access KPIs, operational alerts, and revenue overview'),
  ('catalog.read',     'Catalog',       'View Catalog',                  'Browse products, variants, categories, collections, and size guides'),
  ('catalog.write',    'Catalog',       'Edit Catalog & Merchandising',  'Create, edit, duplicate, and organize products, categories, collections, and size guides'),
  ('catalog.delete',   'Catalog',       'Archive / Delete Catalog',      'Archive, restore, or remove catalog items and variants'),
  ('inventory.read',   'Inventory',     'View Inventory & Movements',    'Inspect live warehouse stock levels, reservations, and restock alerts'),
  ('inventory.adjust', 'Inventory',     'Adjust Stock & Notify Alerts',  'Record stock receipts, cycle counts, bulk adjustments, and restock notifications'),
  ('orders.read',      'Orders',        'View Orders & Invoices',        'Inspect customer orders, GST invoices, payment attempts, and tracking'),
  ('orders.fulfill',   'Orders',        'Fulfill & Ship Orders',         'Transition order status, book Shiprocket AWB, and update tracking'),
  ('orders.refund',    'Orders',        'Issue Refunds',                 'Execute partial or full refunds via payment gateways'),
  ('orders.cancel',    'Orders',        'Cancel Orders',                 'Cancel eligible orders and restore inventory atomically'),
  ('returns.manage',   'Returns',       'Manage Returns & Exchanges',    'Approve/reject client return requests, log inspections, and restock'),
  ('disputes.manage',  'Finance',       'Manage Payment Disputes',       'Review chargebacks/disputes and resolve payment freezes'),
  ('customers.read',   'Customers',     'View Customer Profiles',        'View client directory, order history, wishlists, and addresses'),
  ('customers.write',  'Customers',     'Manage Customer Accounts',      'Suspend/activate client accounts, revoke sessions, and manage newsletter subscribers'),
  ('inquiries.manage', 'Concierge',     'Handle Client Inquiries',       'Respond to and resolve contact form inquiries'),
  ('coupons.read',     'Promotions',    'View Promotions & Coupons',     'Inspect discount codes and redemption attribution'),
  ('coupons.write',    'Promotions',    'Manage Promotions & Coupons',   'Create, edit, pause, or delete promotional codes'),
  ('reviews.moderate', 'Merchandising', 'Moderate Customer Reviews',     'Approve, reject, feature, and reply to product reviews'),
  ('cms.read',         'Content Studio','View Pages & Drafts',           'Open Visual Content Studio and preview unpublished drafts'),
  ('cms.write',        'Content Studio','Edit Content Drafts',           'Modify sections, images, focal points, copy, and save page drafts'),
  ('cms.publish',      'Content Studio','Publish Storefront Changes',    'Publish CMS pages, restore revisions, and push changes live'),
  ('media.read',       'Media Library', 'Browse Media Library',          'View folders, previews, dimensions, and usage references'),
  ('media.write',      'Media Library', 'Upload & Edit Media',           'Upload images, create folders, edit alt text, tags, and default focal points'),
  ('media.delete',     'Media Library', 'Delete Media Assets',           'Remove unused assets from R2 and the media registry'),
  ('brand.write',      'Brand Identity','Manage Brand Identity',         'Update logos, palette colors, typography, house info, and publish brand tokens'),
  ('navigation.write', 'Navigation',    'Manage Menus & Mega Menu',      'Configure Header, Drawer, Announcement Bar, Cookie Notice, and Footer navigation'),
  ('seo.write',        'SEO & Redirects','Manage SEO & Redirects',       'Configure URL redirects, sitemap behavior, and robots directives'),
  ('templates.write',  'Messaging',     'Manage Email Templates',        'Edit transactional email templates and inspect/retry email outbox'),
  ('analytics.read',   'Analytics',     'View Analytics & Reports',      'Explore sales funnels, category performance, and CSV exports'),
  ('settings.write',   'Configuration', 'Manage Store Configuration',    'Modify store policy, shipping rates, tax rules, payment toggles, and flush KV cache'),
  ('security.manage',  'Security',      'Manage Staff, Roles & MFA',     'Invite staff, assign granular roles, enforce MFA, and revoke sessions'),
  ('logs.read',        'Security',      'Inspect Security Audit Logs',   'Search admin activity, order audit trails, and gateway webhook logs'),
  ('health.read',      'System',        'View System Health',            'Monitor D1/KV/R2 diagnostics and integration readiness');

INSERT OR IGNORE INTO admin_roles (id, slug, name, description, mfa_required, is_system) VALUES
  ('role_super_admin',   'super_admin',   'Super Administrator',      'Unrestricted Commerce OS control including security, RBAC, MFA, finance, and publishing.', 1, 1),
  ('role_merch_director','merch_director','Merchandising Director',   'Full catalog, inventory, pricing, collections, reviews, promotions, and analytics access.', 1, 1),
  ('role_studio_editor', 'studio_editor', 'Visual Studio Editor',     'Complete storefront CMS, brand identity, navigation, SEO, and media library control.', 0, 1),
  ('role_order_manager', 'order_manager', 'Order & Fulfilment Lead',  'Orders, Shiprocket fulfilment, pincode checks, returns, stock monitoring, and concierge.', 0, 1),
  ('role_concierge',     'concierge',     'Private Client Concierge', 'Customer lookup, order tracking, returns assistance, review moderation, and inquiries.', 0, 1),
  ('role_finance',       'finance',       'Finance & Audit Analyst',  'Orders financial ledger, payment attempts, refunds, disputes, analytics, and audit logs.', 1, 1);

-- Super Admin receives every permission
INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
SELECT 'role_super_admin', code FROM admin_permissions;

-- Merchandising Director
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('role_merch_director', 'dashboard.read'),
  ('role_merch_director', 'catalog.read'),
  ('role_merch_director', 'catalog.write'),
  ('role_merch_director', 'catalog.delete'),
  ('role_merch_director', 'inventory.read'),
  ('role_merch_director', 'inventory.adjust'),
  ('role_merch_director', 'coupons.read'),
  ('role_merch_director', 'coupons.write'),
  ('role_merch_director', 'reviews.moderate'),
  ('role_merch_director', 'media.read'),
  ('role_merch_director', 'media.write'),
  ('role_merch_director', 'analytics.read');

-- Visual Studio Editor
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('role_studio_editor', 'dashboard.read'),
  ('role_studio_editor', 'catalog.read'),
  ('role_studio_editor', 'cms.read'),
  ('role_studio_editor', 'cms.write'),
  ('role_studio_editor', 'cms.publish'),
  ('role_studio_editor', 'media.read'),
  ('role_studio_editor', 'media.write'),
  ('role_studio_editor', 'media.delete'),
  ('role_studio_editor', 'brand.write'),
  ('role_studio_editor', 'navigation.write'),
  ('role_studio_editor', 'seo.write');

-- Order & Fulfilment Lead
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('role_order_manager', 'dashboard.read'),
  ('role_order_manager', 'orders.read'),
  ('role_order_manager', 'orders.fulfill'),
  ('role_order_manager', 'orders.cancel'),
  ('role_order_manager', 'returns.manage'),
  ('role_order_manager', 'inventory.read'),
  ('role_order_manager', 'customers.read'),
  ('role_order_manager', 'inquiries.manage');

-- Private Client Concierge
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('role_concierge', 'dashboard.read'),
  ('role_concierge', 'orders.read'),
  ('role_concierge', 'customers.read'),
  ('role_concierge', 'customers.write'),
  ('role_concierge', 'inquiries.manage'),
  ('role_concierge', 'reviews.moderate'),
  ('role_concierge', 'returns.manage');

-- Finance & Audit Analyst
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('role_finance', 'dashboard.read'),
  ('role_finance', 'orders.read'),
  ('role_finance', 'orders.refund'),
  ('role_finance', 'disputes.manage'),
  ('role_finance', 'coupons.read'),
  ('role_finance', 'analytics.read'),
  ('role_finance', 'logs.read'),
  ('role_finance', 'health.read');

-- =============================================================================
-- 7. SEED STOREFRONT CATEGORY EXTENSIONS (16 REAL STOREFRONT CATEGORIES)
-- =============================================================================

INSERT OR IGNORE INTO categories (id, slug, title, subtitle, tagline, image_url, sort_order, is_active) VALUES
  ('cat-sweaters',          'sweaters',          'Sweaters',          'Knitwear & Sweaters',             'SCOPRI ORA', '/images/category-maglieria.jpg',         9,  1),
  ('cat-jackets',           'jackets',           'Jackets',           'Sculptural Outerwear',            'SCOPRI ORA', '/images/category-giubbini.jpg',          10, 1),
  ('cat-denim-jackets',     'denim-jackets',     'Denim Jackets',     'Selvedge & Structured',           'SCOPRI ORA', '/images/category-denim-sweatshirts.jpg', 11, 1),
  ('cat-leather-jackets',   'leather-jackets',   'Leather Jackets',   'Artisanal Calfskin',              'SCOPRI ORA', '/images/category-capispalla.jpg',        12, 1),
  ('cat-knitwear',          'knitwear',          'Knitwear',          'Pure Cashmere & Merino',          'SCOPRI ORA', '/images/category-felpe.jpg',             13, 1),
  ('cat-suits',             'suits',             'Suits',             'Architectural Tailoring',         'SCOPRI ORA', '/images/category-abiti.jpg',             14, 1),
  ('cat-tailoring',         'tailoring',         'Tailoring',         'Atelier Sartorial',               'SCOPRI ORA', '/images/mastery-1-model.jpg',            15, 1),
  ('cat-coats',             'coats',             'Coats',             'Winter Overcoats',                'SCOPRI ORA', '/images/category-cappotti.jpg',          16, 1),
  ('cat-trousers',          'trousers',          'Trousers',          'Tailored Silhouettes',            'SCOPRI ORA', '/images/category-pantaloni.jpg',         17, 1),
  ('cat-shirts',            'shirts',            'Shirts',            'Poplin & Jacquard',               'SCOPRI ORA', '/images/category-shirts.jpg',            18, 1),
  ('cat-denim-shirts',      'denim-shirts',      'Denim Shirts',      'Indigo Atelier Weave',            'SCOPRI ORA', '/images/category-denim-shirts.jpg',      19, 1),
  ('cat-polo-t-shirts',     'polo-t-shirts',     'Polo T-Shirts',     'Refined Pique & Silk',            'SCOPRI ORA', '/images/category-polo-t-shirts.jpg',     20, 1),
  ('cat-t-shirts',          't-shirts',          'T-Shirts',          'Mercerized Essentials',           'SCOPRI ORA', '/images/category-hoodies.jpg',           21, 1),
  ('cat-hoodies',           'hoodies',           'Hoodies',           'Elevated Athleisure',             'SCOPRI ORA', '/images/category-hoodies.jpg',           22, 1),
  ('cat-footwear',          'footwear',          'Footwear',          'Goodyear Welted Craft',           'SCOPRI ORA', '/images/category-scarpe.jpg',            23, 1),
  ('cat-accessories',       'accessories',       'Accessories',       'Finest Leather Goods',            'SCOPRI ORA', '/images/category-accessori.jpg',         24, 1);

-- =============================================================================
-- 8. SEED BRAND IDENTITY SINGLETON
-- =============================================================================

INSERT OR IGNORE INTO brand_settings (id, draft_json, published_json, draft_version, published_version, updated_by, published_by)
VALUES (
  'default',
  '{"businessName":"DEYNOLD DANNY Atelier Pvt. Ltd.","displayName":"DEYNOLD DANNY","shortMark":"DD","siteTitleTemplate":"%s | DEYNOLD DANNY","defaultMetaTitle":"DEYNOLD DANNY | Luxury Fashion House & Artisanal Tailoring — Made in India","defaultMetaDescription":"Official DEYNOLD DANNY Online Flagship. Experience quiet luxury, bespoke cashmere tailoring, handcrafted footwear, and sartorial overcoats. Made in India.","originBadgeText":"MADE IN INDIA","editorialTagline":"Autumn / Winter 2026 Architectural Tailoring","houseStory":"Crafted through enduring discipline, architectural proportions, and noble Indian & European fibers.","logoPrimaryUrl":"/logo.png","logoInverseUrl":"/logo.png","logoCompactUrl":"/logo.png","faviconUrl":"/favicon.svg","ogDefaultImageUrl":"/hero-banner.jpg","conciergeEmail":"concierge@deynolddanny.com","privacyEmail":"privacy@deynolddanny.com","conciergePhone":"+91 11 4820 9000","atelierName":"DEYNOLD DANNY Flagship Atelier","atelierAddress":"Sartorial House, New Delhi, India","atelierHours":"Monday – Saturday: 10:00 – 19:00 IST","gstin":"07AAACD0000A1Z5","cin":"U18101DL2024PTC000001","regionLabel":"India","currencyCode":"INR","currencySymbol":"₹","copyrightText":"© 2026 DEYNOLD DANNY. All rights reserved.","attributionText":"HANDCRAFTED BY PIXENOX SOLUTIONS","attributionUrl":"https://www.pixenox.com","showAttribution":true,"colors":{"primary":"#001526","secondary":"#111111","accent":"#8C7355","canvas":"#ffffff","surface":"#faf8f5","studioWarm":"#cfcac6","ink":"#111111","mutedInk":"#666666","border":"#ebebeb","headerBg":"#ffffff","footerBg":"#ffffff"},"typography":{"displayFont":"Montserrat","bodyFont":"Montserrat","monoFont":"JetBrains Mono","baseSizePx":16,"letterSpacingScale":"editorial"},"socialLinks":[{"platform":"Instagram","handle":"@deynolddanny","url":"https://instagram.com/deynolddanny","visible":true},{"platform":"YouTube","handle":"Deynold Danny House","url":"https://youtube.com/@deynolddanny","visible":false},{"platform":"LinkedIn","handle":"Deynold Danny","url":"https://linkedin.com/company/deynolddanny","visible":false}]}',
  '{"businessName":"DEYNOLD DANNY Atelier Pvt. Ltd.","displayName":"DEYNOLD DANNY","shortMark":"DD","siteTitleTemplate":"%s | DEYNOLD DANNY","defaultMetaTitle":"DEYNOLD DANNY | Luxury Fashion House & Artisanal Tailoring — Made in India","defaultMetaDescription":"Official DEYNOLD DANNY Online Flagship. Experience quiet luxury, bespoke cashmere tailoring, handcrafted footwear, and sartorial overcoats. Made in India.","originBadgeText":"MADE IN INDIA","editorialTagline":"Autumn / Winter 2026 Architectural Tailoring","houseStory":"Crafted through enduring discipline, architectural proportions, and noble Indian & European fibers.","logoPrimaryUrl":"/logo.png","logoInverseUrl":"/logo.png","logoCompactUrl":"/logo.png","faviconUrl":"/favicon.svg","ogDefaultImageUrl":"/hero-banner.jpg","conciergeEmail":"concierge@deynolddanny.com","privacyEmail":"privacy@deynolddanny.com","conciergePhone":"+91 11 4820 9000","atelierName":"DEYNOLD DANNY Flagship Atelier","atelierAddress":"Sartorial House, New Delhi, India","atelierHours":"Monday – Saturday: 10:00 – 19:00 IST","gstin":"07AAACD0000A1Z5","cin":"U18101DL2024PTC000001","regionLabel":"India","currencyCode":"INR","currencySymbol":"₹","copyrightText":"© 2026 DEYNOLD DANNY. All rights reserved.","attributionText":"HANDCRAFTED BY PIXENOX SOLUTIONS","attributionUrl":"https://www.pixenox.com","showAttribution":true,"colors":{"primary":"#001526","secondary":"#111111","accent":"#8C7355","canvas":"#ffffff","surface":"#faf8f5","studioWarm":"#cfcac6","ink":"#111111","mutedInk":"#666666","border":"#ebebeb","headerBg":"#ffffff","footerBg":"#ffffff"},"typography":{"displayFont":"Montserrat","bodyFont":"Montserrat","monoFont":"JetBrains Mono","baseSizePx":16,"letterSpacingScale":"editorial"},"socialLinks":[{"platform":"Instagram","handle":"@deynolddanny","url":"https://instagram.com/deynolddanny","visible":true},{"platform":"YouTube","handle":"Deynold Danny House","url":"https://youtube.com/@deynolddanny","visible":false},{"platform":"LinkedIn","handle":"Deynold Danny","url":"https://linkedin.com/company/deynolddanny","visible":false}]}',
  1, 1, 'system', 'system'
);

-- =============================================================================
-- 9. SEED STORE CONFIGURATION SINGLETON
-- =============================================================================

INSERT OR IGNORE INTO store_settings (id, settings_json, updated_by) VALUES (
  'default',
  '{"freeShippingThresholdPaise":1000000,"standardShippingPaise":25000,"returnWindowDays":14,"lowStockThreshold":5,"reservationMinutes":15,"codEnabled":false,"codMaxPaise":5000000,"activePaymentGateways":["razorpay","cashfree"],"autoApproveReviews":false,"allowReviewsWithoutPurchase":true,"requireMfaForStaff":false,"pdpShowExclusiveBanner":true,"pdpExclusiveBannerText":"Online exclusive — Dispatched in DEYNOLD DANNY archival keepsake packaging.","pdpShippingSummary":"Free express shipping on orders over ₹10,000. Complimentary 14-day returns.","cartGiftNoteEnabled":true,"cartTaxNote":"All prices include GST. Final taxes calculated at dispatch.","robotsDisallowPaths":["/cart","/checkout","/account","/wishlist","/search","/admin","/api"],"shiprocketPickupLocation":"Primary Atelier Warehouse"}',
  'system'
);

-- =============================================================================
-- 10. SEED NAVIGATION MENUS, ANNOUNCEMENT BAR & COOKIE BANNER
-- =============================================================================

INSERT OR IGNORE INTO navigation_menus (id, menu_key, title, draft_items_json, published_items_json, updated_by) VALUES
  (
    'nav_announcement',
    'announcement_bar',
    'Global Announcement Bar',
    '{"enabled":true,"dismissible":true,"bgColor":"#111111","textColor":"#ffffff","autoRotateSeconds":6,"messages":[{"id":"ann_1","text":"AUTUMN / WINTER 2026 ARCHITECTURAL TAILORING — COMPLIMENTARY EXPRESS DELIVERY OVER ₹10,000","ctaLabel":"DISCOVER","ctaUrl":"/categories/suits","active":true},{"id":"ann_2","text":"PRIVATE CLIENT CONCIERGE AVAILABLE MON–SAT 10:00–19:00 IST","ctaLabel":"BOOK APPOINTMENT","ctaUrl":"/contact","active":true}]}',
    '{"enabled":true,"dismissible":true,"bgColor":"#111111","textColor":"#ffffff","autoRotateSeconds":6,"messages":[{"id":"ann_1","text":"AUTUMN / WINTER 2026 ARCHITECTURAL TAILORING — COMPLIMENTARY EXPRESS DELIVERY OVER ₹10,000","ctaLabel":"DISCOVER","ctaUrl":"/categories/suits","active":true},{"id":"ann_2","text":"PRIVATE CLIENT CONCIERGE AVAILABLE MON–SAT 10:00–19:00 IST","ctaLabel":"BOOK APPOINTMENT","ctaUrl":"/contact","active":true}]}',
    'system'
  ),
  (
    'nav_header_primary',
    'header_primary',
    'Header Navigation & Mega Menu',
    '[{"id":"hn_1","label":"MASTERY","href":"/#mastery","badge":null,"visible":true,"megaMenu":{"enabled":true,"columns":[{"title":"Quiet Luxury Capsules","links":[{"label":"Tailored Virgin Wool","href":"/categories/tailoring"},{"label":"Cashmere Knitwear","href":"/categories/knitwear"},{"label":"Architectural Suits","href":"/categories/suits"}]},{"title":"Curated Stories","links":[{"label":"AW26 Campaign","href":"/collections/aw26-architectural"},{"label":"Thread Mastery","href":"/categories/sweaters"}]}],"featuredCard":{"title":"Autumn / Winter 2026","subtitle":"Explore architectural tailoring","image":"/hero-banner.jpg","href":"/collections/aw26-architectural"}}},{"id":"hn_2","label":"NEW COLLECTION","href":"/#new-collection","badge":"NEW","visible":true,"megaMenu":{"enabled":true,"columns":[{"title":"Seasonal Highlights","links":[{"label":"All New Arrivals","href":"/#new-collection"},{"label":"Coats & Outerwear","href":"/categories/coats"},{"label":"Leather Jackets","href":"/categories/leather-jackets"}]}],"featuredCard":{"title":"The Cashmere Atelier","subtitle":"Outer-Mongolian fleece","image":"/images/news-1-model.jpg","href":"/collections/quiet-luxury-cashmere"}}},{"id":"hn_3","label":"TAILORING","href":"/categories/tailoring","badge":null,"visible":true,"megaMenu":{"enabled":false,"columns":[]}},{"id":"hn_4","label":"ACCESSORIES","href":"/categories/accessories","badge":null,"visible":true,"megaMenu":{"enabled":false,"columns":[]}}]',
    '[{"id":"hn_1","label":"MASTERY","href":"/#mastery","badge":null,"visible":true,"megaMenu":{"enabled":true,"columns":[{"title":"Quiet Luxury Capsules","links":[{"label":"Tailored Virgin Wool","href":"/categories/tailoring"},{"label":"Cashmere Knitwear","href":"/categories/knitwear"},{"label":"Architectural Suits","href":"/categories/suits"}]},{"title":"Curated Stories","links":[{"label":"AW26 Campaign","href":"/collections/aw26-architectural"},{"label":"Thread Mastery","href":"/categories/sweaters"}]}],"featuredCard":{"title":"Autumn / Winter 2026","subtitle":"Explore architectural tailoring","image":"/hero-banner.jpg","href":"/collections/aw26-architectural"}}},{"id":"hn_2","label":"NEW COLLECTION","href":"/#new-collection","badge":"NEW","visible":true,"megaMenu":{"enabled":true,"columns":[{"title":"Seasonal Highlights","links":[{"label":"All New Arrivals","href":"/#new-collection"},{"label":"Coats & Outerwear","href":"/categories/coats"},{"label":"Leather Jackets","href":"/categories/leather-jackets"}]}],"featuredCard":{"title":"The Cashmere Atelier","subtitle":"Outer-Mongolian fleece","image":"/images/news-1-model.jpg","href":"/collections/quiet-luxury-cashmere"}}},{"id":"hn_3","label":"TAILORING","href":"/categories/tailoring","badge":null,"visible":true,"megaMenu":{"enabled":false,"columns":[]}},{"id":"hn_4","label":"ACCESSORIES","href":"/categories/accessories","badge":null,"visible":true,"megaMenu":{"enabled":false,"columns":[]}}]',
    'system'
  ),
  (
    'nav_drawer',
    'header_drawer',
    'Slide-Out Navigation Drawer',
    '{"collections":[{"label":"Suits & Tailoring","href":"/categories/tailoring"},{"label":"Coats & Outerwear","href":"/categories/coats"},{"label":"Cashmere & Knitwear","href":"/categories/knitwear"},{"label":"Shirts & Denim","href":"/categories/shirts"},{"label":"Trousers & Cady","href":"/categories/trousers"},{"label":"Goodyear Welted Footwear","href":"/categories/footwear"},{"label":"Archival Accessories","href":"/categories/accessories"},{"label":"Curated Collections","href":"/collections"}],"services":[{"label":"Private Client Portal","href":"/account"},{"label":"Order Tracking","href":"/orders/track"},{"label":"Wishlist","href":"/wishlist"},{"label":"Concierge & Atelier","href":"/contact"},{"label":"Shipping & Returns","href":"/legal/shipping-returns"}]}',
    '{"collections":[{"label":"Suits & Tailoring","href":"/categories/tailoring"},{"label":"Coats & Outerwear","href":"/categories/coats"},{"label":"Cashmere & Knitwear","href":"/categories/knitwear"},{"label":"Shirts & Denim","href":"/categories/shirts"},{"label":"Trousers & Cady","href":"/categories/trousers"},{"label":"Goodyear Welted Footwear","href":"/categories/footwear"},{"label":"Archival Accessories","href":"/categories/accessories"},{"label":"Curated Collections","href":"/collections"}],"services":[{"label":"Private Client Portal","href":"/account"},{"label":"Order Tracking","href":"/orders/track"},{"label":"Wishlist","href":"/wishlist"},{"label":"Concierge & Atelier","href":"/contact"},{"label":"Shipping & Returns","href":"/legal/shipping-returns"}]}',
    'system'
  ),
  (
    'nav_footer',
    'footer_columns',
    'Footer Navigation & Newsletter Copy',
    '{"columns":[{"id":"fc_1","title":"GET TO KNOW US","links":[{"label":"Categories","href":"/categories"},{"label":"Collections","href":"/collections"},{"label":"Architectural Tailoring","href":"/categories/suits"},{"label":"Privacy Policy","href":"/legal/privacy-policy"},{"label":"Terms & Conditions","href":"/legal/terms"}]},{"id":"fc_2","title":"CUSTOMER CARE","links":[{"label":"Contact Concierge","href":"/contact"},{"label":"Track Your Order","href":"/orders/track"},{"label":"Shipping & Returns","href":"/legal/shipping-returns"},{"label":"Private Client Account","href":"/account"},{"label":"Cookie Preferences","href":"/legal/cookie-policy"}]}],"newsletter":{"enabled":true,"heading":"SIGN UP FOR OUR NEWSLETTER","description":"Receive private invitations to seasonal previews, trunk shows, and sartorial releases.","placeholder":"Enter your email address","buttonLabel":"Subscribe","successMessage":"Thank you for subscribing to DEYNOLD DANNY."}}',
    '{"columns":[{"id":"fc_1","title":"GET TO KNOW US","links":[{"label":"Categories","href":"/categories"},{"label":"Collections","href":"/collections"},{"label":"Architectural Tailoring","href":"/categories/suits"},{"label":"Privacy Policy","href":"/legal/privacy-policy"},{"label":"Terms & Conditions","href":"/legal/terms"}]},{"id":"fc_2","title":"CUSTOMER CARE","links":[{"label":"Contact Concierge","href":"/contact"},{"label":"Track Your Order","href":"/orders/track"},{"label":"Shipping & Returns","href":"/legal/shipping-returns"},{"label":"Private Client Account","href":"/account"},{"label":"Cookie Preferences","href":"/legal/cookie-policy"}]}],"newsletter":{"enabled":true,"heading":"SIGN UP FOR OUR NEWSLETTER","description":"Receive private invitations to seasonal previews, trunk shows, and sartorial releases.","placeholder":"Enter your email address","buttonLabel":"Subscribe","successMessage":"Thank you for subscribing to DEYNOLD DANNY."}}',
    'system'
  ),
  (
    'nav_cookie',
    'cookie_banner',
    'Cookie Consent Banner',
    '{"enabled":true,"title":"Client Privacy & Cookie Governance","description":"We use strictly necessary cookies to protect your shopping bag and session. Optional analytics help refine our flagship digital atelier in compliance with DPDP & GDPR.","acceptAllLabel":"Accept All","essentialOnlyLabel":"Essential Only","policyLabel":"Privacy Policy","policyUrl":"/legal/privacy-policy"}',
    '{"enabled":true,"title":"Client Privacy & Cookie Governance","description":"We use strictly necessary cookies to protect your shopping bag and session. Optional analytics help refine our flagship digital atelier in compliance with DPDP & GDPR.","acceptAllLabel":"Accept All","essentialOnlyLabel":"Essential Only","policyLabel":"Privacy Policy","policyUrl":"/legal/privacy-policy"}',
    'system'
  );

-- =============================================================================
-- 11. SEED MEDIA LIBRARY FOLDERS & EXISTING STOREFRONT ASSETS
-- =============================================================================

INSERT OR IGNORE INTO media_folders (id, parent_id, name, slug, sort_order) VALUES
  ('fld_brand',       NULL, 'Brand & Logos',         'brand-logos',       1),
  ('fld_campaigns',   NULL, 'Campaigns & Hero',      'campaigns-hero',    2),
  ('fld_categories',  NULL, 'Categories',            'categories',        3),
  ('fld_products',    NULL, 'Product Photography',   'products',          4),
  ('fld_editorials',  NULL, 'Editorial & Lookbooks', 'editorials',        5);

INSERT OR IGNORE INTO media_assets (id, folder_id, key, url, filename, mime_type, alt_text, default_focal_x, default_focal_y, tags_json, source_type, created_by) VALUES
  ('med_logo',       'fld_brand',      'local/logo.png',                   '/logo.png',                         'logo.png',                   'image/png',  'DEYNOLD DANNY Anchor Monogram Logo',        50, 50, '["brand","logo"]',      'local_seed', 'system'),
  ('med_hero',       'fld_campaigns',  'local/hero-banner.jpg',            '/hero-banner.jpg',                  'hero-banner.jpg',            'image/jpeg', 'DEYNOLD DANNY Modern Lifestyle Campaign',   50, 35, '["hero","aw26"]',       'local_seed', 'system'),
  ('med_hero_png',   'fld_campaigns',  'local/hero-banner.png',            '/hero-banner.png',                  'hero-banner.png',            'image/png',  'DEYNOLD DANNY Campaign Alternate',          50, 40, '["hero"]',              'local_seed', 'system'),
  ('med_cat_abiti',  'fld_categories', 'local/category-abiti.jpg',         '/images/category-abiti.jpg',        'category-abiti.jpg',         'image/jpeg', 'Luxury Suits Category',                     50, 30, '["category","suits"]',  'local_seed', 'system'),
  ('med_cat_capp',   'fld_categories', 'local/category-cappotti.jpg',      '/images/category-cappotti.jpg',     'category-cappotti.jpg',      'image/jpeg', 'Architectural Coats Category',              50, 30, '["category","coats"]',  'local_seed', 'system'),
  ('med_cat_camic',  'fld_categories', 'local/category-camicie.jpg',       '/images/category-camicie.jpg',      'category-camicie.jpg',       'image/jpeg', 'Sartorial Shirts Category',                 50, 35, '["category","shirts"]', 'local_seed', 'system'),
  ('med_cat_magl',   'fld_categories', 'local/category-maglieria.jpg',     '/images/category-maglieria.jpg',    'category-maglieria.jpg',     'image/jpeg', 'Cashmere Knitwear Category',                50, 35, '["category","knitwear"]','local_seed', 'system'),
  ('med_cat_pant',   'fld_categories', 'local/category-pantaloni.jpg',     '/images/category-pantaloni.jpg',    'category-pantaloni.jpg',     'image/jpeg', 'Tailored Trousers Category',                50, 40, '["category","trousers"]','local_seed', 'system'),
  ('med_cat_acc',    'fld_categories', 'local/category-accessori.jpg',     '/images/category-accessori.jpg',    'category-accessori.jpg',     'image/jpeg', 'Accessories Category',                      50, 50, '["category","acc"]',    'local_seed', 'system'),
  ('med_cat_scarpe', 'fld_categories', 'local/category-scarpe.jpg',        '/images/category-scarpe.jpg',       'category-scarpe.jpg',        'image/jpeg', 'Goodyear Welted Footwear',                  50, 60, '["category","footwear"]','local_seed', 'system'),
  ('med_cat_polo',   'fld_categories', 'local/category-polo-t-shirts.jpg', '/images/category-polo-t-shirts.jpg','category-polo-t-shirts.jpg', 'image/jpeg', 'Polo T-Shirts Category',                    50, 35, '["category","polo"]',   'local_seed', 'system'),
  ('med_cat_hood',   'fld_categories', 'local/category-hoodies.jpg',       '/images/category-hoodies.jpg',      'category-hoodies.jpg',       'image/jpeg', 'Hoodies Category',                          50, 35, '["category","hoodies"]','local_seed', 'system'),
  ('med_cat_dshirt', 'fld_categories', 'local/category-denim-shirts.jpg',  '/images/category-denim-shirts.jpg', 'category-denim-shirts.jpg',  'image/jpeg', 'Denim Shirts Category',                     50, 35, '["category","denim"]',  'local_seed', 'system'),
  ('med_cat_dsweat', 'fld_categories', 'local/category-denim-sweatshirts.jpg','/images/category-denim-sweatshirts.jpg','category-denim-sweatshirts.jpg','image/jpeg','Denim Jackets Category',             50, 35, '["category","denim"]',  'local_seed', 'system'),
  ('med_m1_model',   'fld_products',   'local/mastery-1-model.jpg',        '/images/mastery-1-model.jpg',       'mastery-1-model.jpg',        'image/jpeg', 'Tailored Virgin Wool Suit Model',           50, 25, '["product","mastery"]', 'local_seed', 'system'),
  ('med_m1_prod',    'fld_products',   'local/mastery-1-product.jpg',      '/images/mastery-1-product.jpg',     'mastery-1-product.jpg',      'image/jpeg', 'Tailored Virgin Wool Suit Studio',          50, 50, '["product","mastery"]', 'local_seed', 'system'),
  ('med_m2_model',   'fld_products',   'local/mastery-2-model.jpg',        '/images/mastery-2-model.jpg',       'mastery-2-model.jpg',        'image/jpeg', 'Cashmere Mock-Neck Knit Model',             50, 25, '["product","mastery"]', 'local_seed', 'system'),
  ('med_n1_model',   'fld_products',   'local/news-1-model.jpg',           '/images/news-1-model.jpg',          'news-1-model.jpg',           'image/jpeg', 'New Arrival Cashmere Overcoat',             50, 25, '["product","new"]',     'local_seed', 'system'),
  ('med_cady_model', 'fld_products',   'local/cady-trousers-model.jpg',    '/images/cady-trousers-model.jpg',   'cady-trousers-model.jpg',    'image/jpeg', 'Cady Wide-Leg Trousers Model',              50, 35, '["product","cady"]',    'local_seed', 'system'),
  ('med_style_bg',   'fld_editorials', 'local/style-1-model.jpg',          '/images/style-1-model.jpg',         'style-1-model.jpg',          'image/jpeg', 'Style Layering Atelier Backdrop',           50, 30, '["editorial","looks"]', 'local_seed', 'system');

-- =============================================================================
-- 12. SEED COLLECTIONS & SIZE GUIDES
-- =============================================================================

INSERT OR IGNORE INTO collections (id, slug, title, eyebrow, description, hero_image, mobile_image, focal_x, focal_y, sort_order, is_active, seo_json) VALUES
  ('col_aw26',     'aw26-architectural',    'AW26 Architectural Tailoring', 'Autumn / Winter 2026', 'Structured shoulders, sculptural drape, and natural virgin wool engineered for quiet presence.', '/hero-banner.jpg',             '/hero-banner.jpg',         50, 35, 1, 1, '{"title":"AW26 Architectural Tailoring | DEYNOLD DANNY","description":"Explore Autumn/Winter 2026 architectural tailoring."}'),
  ('col_cashmere', 'quiet-luxury-cashmere', 'Quiet Luxury Cashmere',        'Pure Cashmere House',  'Outer-Mongolian inner fleece spun to featherlight warmth with hand-finished edges.',          '/images/mastery-2-model.jpg',  '/images/mastery-2-model.jpg', 50, 25, 2, 1, '{"title":"Quiet Luxury Cashmere | DEYNOLD DANNY","description":"Discover pure Mongolian cashmere knitwear."}'),
  ('col_atelier',  'archival-accessories',  'Archival Footwear & Leather',  'Calzature & Pelletteria','Goodyear welted French calfskin footwear and signature atelier leather essentials.',         '/images/category-scarpe.jpg',  '/images/category-scarpe.jpg', 50, 50, 3, 1, '{"title":"Archival Accessories & Footwear | DEYNOLD DANNY","description":"Handcrafted footwear and leather goods."}');

INSERT OR IGNORE INTO size_guides (id, slug, title, category_slug, tables_json, measurement_notes_json, fit_rules_json) VALUES
  (
    'sg_tailoring',
    'italian-tailoring',
    'Italian Tailoring & Outerwear Size Matrix',
    'suits',
    '[{"name":"Chest & Shoulder Matrix","headers":["IT","US / UK","INTL","Chest (cm)","Waist (cm)","Shoulder (cm)"],"rows":[["46","36","S","92-95","78-81","44.5"],["48","38","M","96-99","82-85","46.0"],["50","40","L","100-103","86-89","47.5"],["52","42","XL","104-107","90-94","49.0"],["54","44","XXL","108-111","95-99","50.5"]]}]',
    '["All tailored coats and suits follow a classic Italian drop-7 architectural cut.","For layering over heavyweight cashmere knitwear, select one size up."]',
    '{"defaultFitPreference":"tailored","heightRangeCm":[160,205],"weightRangeKg":[50,120]}'
  ),
  (
    'sg_trousers',
    'trousers-and-cady',
    'Trousers & Cady Silhouettes Size Guide',
    'trousers',
    '[{"name":"IT Trouser Conversion","headers":["IT","US","UK","FR","Waist (cm)","Hip (cm)","Inseam (cm)"],"rows":[["36","0","4","32","60-63","86-89","79"],["38","2","6","34","64-67","90-93","80"],["40","4","8","36","68-71","94-97","80"],["42","6","10","38","72-75","98-101","81"],["44","8","12","40","76-80","102-106","81"],["46","10","14","42","81-85","107-111","82"]]}]',
    '["Relaxed elasticated waistbands accommodate half-size ease.","Unfinished hems on virgin wool styles allow complimentary atelier tailoring."]',
    '{"defaultFitPreference":"relaxed","heightRangeCm":[155,195],"weightRangeKg":[45,105]}'
  );

-- =============================================================================
-- 13. SEED EMAIL TEMPLATES
-- =============================================================================

INSERT OR IGNORE INTO email_templates (template_key, name, description, subject_template, html_template, text_template, variables_json, is_active) VALUES
  (
    'otp',
    'Client Access OTP Code',
    '6-digit passwordless login verification code dispatched on sign-in and sign-up.',
    'Your {{brandName}} Verification Code',
    '<div style="font-family:Montserrat,sans-serif;max-width:540px;margin:40px auto;padding:44px;border:1px solid #eaeaea;background:#ffffff;color:#111111;"><p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c7355;margin:0 0 12px;">{{brandName}}</p><h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">Verification Code</h1><p style="font-size:13px;line-height:1.7;color:#555555;">Please enter the one-time security code below to enter your private client portal:</p><div style="margin:24px 0;padding:20px;background:#111111;color:#ffffff;font-family:monospace;font-size:30px;letter-spacing:8px;text-align:center;">{{otp}}</div><p style="font-size:12px;color:#777777;">Valid for 10 minutes. Inquiries: {{conciergeEmail}}</p></div>',
    'Your {{brandName}} verification code is {{otp}}. Valid for 10 minutes.',
    '["brandName","otp","conciergeEmail"]',
    1
  ),
  (
    'order_confirmed',
    'Order Confirmation',
    'Sent when customer payment clears and order moves into Atelier Preparation.',
    'Order {{orderNumber}} Confirmed — {{brandName}}',
    '<div style="font-family:Montserrat,sans-serif;max-width:600px;margin:40px auto;padding:44px;border:1px solid #eaeaea;background:#ffffff;color:#111111;"><p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c7355;margin:0 0 12px;">{{brandName}} &bull; ATELIER</p><h1 style="font-size:22px;font-weight:400;margin:0 0 8px;">Order Confirmed</h1><p style="font-size:12px;color:#666666;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 28px;">Reference {{orderNumber}}</p><p style="font-size:13px;line-height:1.7;color:#333333;">Thank you for your commission totaling <strong>{{totalFormatted}}</strong>. Each garment undergoes final atelier inspection before archival packaging.</p><p style="font-size:12px;color:#777777;margin-top:32px;">Questions? Contact {{conciergeEmail}} or {{conciergePhone}}.</p></div>',
    'Order {{orderNumber}} confirmed for {{totalFormatted}}.',
    '["brandName","orderNumber","totalFormatted","conciergeEmail","conciergePhone"]',
    1
  ),
  (
    'order_shipped',
    'Dispatch & AWB Notification',
    'Sent when Shiprocket AWB / courier tracking is assigned and order ships.',
    'Order {{orderNumber}} Dispatched — {{brandName}}',
    '<div style="font-family:Montserrat,sans-serif;max-width:600px;margin:40px auto;padding:44px;border:1px solid #eaeaea;background:#ffffff;color:#111111;"><p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c7355;">{{brandName}} &bull; DISPATCH</p><h1 style="font-size:22px;font-weight:400;">Your Commission Is En Route</h1><p style="font-size:13px;color:#333333;line-height:1.7;">Order <strong>{{orderNumber}}</strong> has left our New Delhi atelier via <strong>{{courierPartner}}</strong>.</p><p style="font-family:monospace;font-size:15px;padding:14px;background:#faf8f5;border:1px solid #eaeaea;">AWB / Tracking: {{trackingNumber}}</p></div>',
    'Order {{orderNumber}} dispatched via {{courierPartner}} ({{trackingNumber}}).',
    '["brandName","orderNumber","courierPartner","trackingNumber"]',
    1
  ),
  (
    'restock_alert',
    'Garment Restock Notification',
    'Sent to wishlisted / waiting patrons when out-of-stock variant inventory is replenished.',
    'Back in Atelier Stock: {{productTitle}} — {{brandName}}',
    '<div style="font-family:Montserrat,sans-serif;max-width:560px;margin:40px auto;padding:44px;border:1px solid #eaeaea;background:#ffffff;color:#111111;"><p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c7355;">{{brandName}}</p><h1 style="font-size:22px;font-weight:400;">Requested Piece Replenished</h1><p style="font-size:13px;color:#333333;line-height:1.7;"><strong>{{productTitle}}</strong> ({{variantLabel}}) has returned in limited atelier quantity.</p><a href="{{productUrl}}" style="display:inline-block;margin-top:16px;padding:12px 26px;background:#111111;color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">View Piece</a></div>',
    '{{productTitle}} ({{variantLabel}}) is back in stock at {{productUrl}}.',
    '["brandName","productTitle","variantLabel","productUrl"]',
    1
  );

-- =============================================================================
-- 14. SEED STOREFRONT CMS PAGES & SECTIONS (HOMEPAGE, CONTACT, LEGAL, PDP, UTILITY)
-- =============================================================================

INSERT OR IGNORE INTO cms_pages (id, slug, route_path, page_type, title, status, template_key, is_system_route, draft_seo_json, published_seo_json, updated_by) VALUES
  ('page_home',             'home',             '/',                       'home',       'Homepage Flagship',           'published', 'homepage',    1, '{"title":"DEYNOLD DANNY | Luxury Fashion House & Artisanal Tailoring","description":"Official DEYNOLD DANNY Online Flagship. Quiet luxury architectural tailoring, cashmere knitwear, footwear, and bespoke essentials."}', '{"title":"DEYNOLD DANNY | Luxury Fashion House & Artisanal Tailoring","description":"Official DEYNOLD DANNY Online Flagship. Quiet luxury architectural tailoring, cashmere knitwear, footwear, and bespoke essentials."}', 'system'),
  ('page_pdp_global',       'pdp-global',       '/products/*',             'pdp_global', 'Product Detail Defaults',     'published', 'pdp',         1, '{}', '{}', 'system'),
  ('page_contact',          'contact',          '/contact',                'contact',    'Atelier Contact & Concierge', 'published', 'contact',     1, '{"title":"Contact Atelier | DEYNOLD DANNY","description":"Connect with the DEYNOLD DANNY private client concierge and New Delhi atelier."}', '{"title":"Contact Atelier | DEYNOLD DANNY","description":"Connect with the DEYNOLD DANNY private client concierge and New Delhi atelier."}', 'system'),
  ('page_legal_privacy',    'privacy-policy',   '/legal/privacy-policy',   'legal',      'Privacy Policy',              'published', 'legal',       1, '{"title":"Privacy Policy | DEYNOLD DANNY","description":"Client data confidentiality and privacy commitment of DEYNOLD DANNY."}', '{"title":"Privacy Policy | DEYNOLD DANNY","description":"Client data confidentiality and privacy commitment of DEYNOLD DANNY."}', 'system'),
  ('page_legal_shipping',   'shipping-returns', '/legal/shipping-returns', 'legal',      'Shipping & Returns Policy',   'published', 'legal',       1, '{"title":"Shipping & Returns | DEYNOLD DANNY","description":"Complimentary express dispatch and 14-day atelier returns."}', '{"title":"Shipping & Returns | DEYNOLD DANNY","description":"Complimentary express dispatch and 14-day atelier returns."}', 'system'),
  ('page_legal_terms',      'terms',            '/legal/terms',            'legal',      'Terms & Conditions',          'published', 'legal',       1, '{"title":"Terms & Conditions | DEYNOLD DANNY","description":"Terms governing purchases at DEYNOLD DANNY Online Flagship."}', '{"title":"Terms & Conditions | DEYNOLD DANNY","description":"Terms governing purchases at DEYNOLD DANNY Online Flagship."}', 'system'),
  ('page_legal_cookie',     'cookie-policy',    '/legal/cookie-policy',    'legal',      'Cookie Policy',               'published', 'legal',       1, '{"title":"Cookie Policy | DEYNOLD DANNY","description":"How DEYNOLD DANNY governs strictly necessary and analytics cookies."}', '{"title":"Cookie Policy | DEYNOLD DANNY","description":"How DEYNOLD DANNY governs strictly necessary and analytics cookies."}', 'system');

-- Homepage Sections (Exact structure mirroring src/pages/index.astro + StyleLayering + EditorialDuo)
INSERT OR IGNORE INTO cms_sections (id, page_id, section_key, section_type, title, sort_order, is_draft_visible, is_published_visible, status, draft_props_json, published_props_json) VALUES
  (
    'sec_home_hero',
    'page_home',
    'hero-banner',
    'hero_banner',
    'Campaign Hero Banner',
    1, 1, 1, 'published',
    '{"eyebrow":"Modern Sartorial","headline":"DEYNOLD DANNY","description":"Autumn / Winter 2026 Architectural Tailoring","desktopImage":"/hero-banner.jpg","mobileImage":"/hero-banner.jpg","focalX":50,"focalY":35,"overlayColor":"#000000","overlayOpacity":28,"ctaLabel":"Discover Collection","ctaUrl":"/#mastery","secondaryCtaLabel":"Shop Tailoring","secondaryCtaUrl":"/categories/suits","heightPreset":"editorial-855"}',
    '{"eyebrow":"Modern Sartorial","headline":"DEYNOLD DANNY","description":"Autumn / Winter 2026 Architectural Tailoring","desktopImage":"/hero-banner.jpg","mobileImage":"/hero-banner.jpg","focalX":50,"focalY":35,"overlayColor":"#000000","overlayOpacity":28,"ctaLabel":"Discover Collection","ctaUrl":"/#mastery","secondaryCtaLabel":"Shop Tailoring","secondaryCtaUrl":"/categories/suits","heightPreset":"editorial-855"}'
  ),
  (
    'sec_home_best_sellers',
    'page_home',
    'mastery',
    'product_carousel',
    'Our Best Sellers Carousel',
    2, 1, 1, 'published',
    '{"sectionId":"mastery","eyebrow":"SIGNATURE SELECTION","title":"Our Best Sellers","sourceMode":"section","sectionGroup":"mastery","limit":8,"ctaLabel":"Explore Collection","ctaUrl":"/categories/suits","tabs":[{"label":"Sweaters","href":"/categories/sweaters"},{"label":"Denim Sweatshirts","href":"/categories/jackets"},{"label":"Polo T-Shirts","href":"/categories/polo-t-shirts"},{"label":"Hoodies","href":"/categories/hoodies"},{"label":"Shirts","href":"/categories/shirts"}]}',
    '{"sectionId":"mastery","eyebrow":"SIGNATURE SELECTION","title":"Our Best Sellers","sourceMode":"section","sectionGroup":"mastery","limit":8,"ctaLabel":"Explore Collection","ctaUrl":"/categories/suits","tabs":[{"label":"Sweaters","href":"/categories/sweaters"},{"label":"Denim Sweatshirts","href":"/categories/jackets"},{"label":"Polo T-Shirts","href":"/categories/polo-t-shirts"},{"label":"Hoodies","href":"/categories/hoodies"},{"label":"Shirts","href":"/categories/shirts"}]}'
  ),
  (
    'sec_home_categories',
    'page_home',
    'category-grid',
    'category_grid',
    'Core Category Editorial Grid',
    3, 1, 1, 'published',
    '{"heading":"Curated Wardrobes","columns":3,"items":[{"title":"Denim Sweatshirts","subtitle":"Collezione Denim Sweat Shirts Uomo - DEYNOLD DANNY","href":"/categories/denim-jackets","desktopImage":"/images/category-denim-sweatshirts.jpg","mobileImage":"/images/category-denim-sweatshirts.jpg","focalX":50,"focalY":35},{"title":"Shirts","subtitle":"Collezione Shirts Uomo - DEYNOLD DANNY","href":"/categories/shirts","desktopImage":"/images/category-shirts.jpg","mobileImage":"/images/category-shirts.jpg","focalX":50,"focalY":35},{"title":"Polo T-Shirts","subtitle":"Collezione Polo T-shirts Uomo - DEYNOLD DANNY","href":"/categories/polo-t-shirts","desktopImage":"/images/category-polo-t-shirts.jpg","mobileImage":"/images/category-polo-t-shirts.jpg","focalX":50,"focalY":35},{"title":"Hoodies","subtitle":"Collezione Hoodies Uomo - DEYNOLD DANNY","href":"/categories/hoodies","desktopImage":"/images/category-hoodies.jpg","mobileImage":"/images/category-hoodies.jpg","focalX":50,"focalY":35},{"title":"Denim Shirts","subtitle":"Collezione Denim Shirts Uomo - DEYNOLD DANNY","href":"/categories/denim-shirts","desktopImage":"/images/category-denim-shirts.jpg","mobileImage":"/images/category-denim-shirts.jpg","focalX":50,"focalY":35},{"title":"Sweaters","subtitle":"Collezione Felpe Uomo - DEYNOLD DANNY","href":"/categories/sweaters","desktopImage":"/images/category-felpe.jpg","mobileImage":"/images/category-felpe.jpg","focalX":50,"focalY":35}]}',
    '{"heading":"Curated Wardrobes","columns":3,"items":[{"title":"Denim Sweatshirts","subtitle":"Collezione Denim Sweat Shirts Uomo - DEYNOLD DANNY","href":"/categories/denim-jackets","desktopImage":"/images/category-denim-sweatshirts.jpg","mobileImage":"/images/category-denim-sweatshirts.jpg","focalX":50,"focalY":35},{"title":"Shirts","subtitle":"Collezione Shirts Uomo - DEYNOLD DANNY","href":"/categories/shirts","desktopImage":"/images/category-shirts.jpg","mobileImage":"/images/category-shirts.jpg","focalX":50,"focalY":35},{"title":"Polo T-Shirts","subtitle":"Collezione Polo T-shirts Uomo - DEYNOLD DANNY","href":"/categories/polo-t-shirts","desktopImage":"/images/category-polo-t-shirts.jpg","mobileImage":"/images/category-polo-t-shirts.jpg","focalX":50,"focalY":35},{"title":"Hoodies","subtitle":"Collezione Hoodies Uomo - DEYNOLD DANNY","href":"/categories/hoodies","desktopImage":"/images/category-hoodies.jpg","mobileImage":"/images/category-hoodies.jpg","focalX":50,"focalY":35},{"title":"Denim Shirts","subtitle":"Collezione Denim Shirts Uomo - DEYNOLD DANNY","href":"/categories/denim-shirts","desktopImage":"/images/category-denim-shirts.jpg","mobileImage":"/images/category-denim-shirts.jpg","focalX":50,"focalY":35},{"title":"Sweaters","subtitle":"Collezione Felpe Uomo - DEYNOLD DANNY","href":"/categories/sweaters","desktopImage":"/images/category-felpe.jpg","mobileImage":"/images/category-felpe.jpg","focalX":50,"focalY":35}]}'
  ),
  (
    'sec_home_new_arrival',
    'page_home',
    'new-collection',
    'product_carousel',
    'New Arrival Carousel',
    4, 1, 1, 'published',
    '{"sectionId":"new-collection","eyebrow":"SEASONAL RELEASE","title":"NEW ARRIVAL","sourceMode":"section","sectionGroup":"new-arrival","limit":8,"ctaLabel":"View All New Arrivals","ctaUrl":"/collections/aw26-architectural","tabs":[]}',
    '{"sectionId":"new-collection","eyebrow":"SEASONAL RELEASE","title":"NEW ARRIVAL","sourceMode":"section","sectionGroup":"new-arrival","limit":8,"ctaLabel":"View All New Arrivals","ctaUrl":"/collections/aw26-architectural","tabs":[]}'
  ),
  (
    'sec_home_editorial_duo',
    'page_home',
    'editorial-duo',
    'editorial_duo',
    'Footwear & Accessories Editorial Duo',
    5, 1, 1, 'published',
    '{"heading":"","items":[{"eyebrow":"GOOD YEAR WELTED","title":"Scarpe & Footwear","description":"French box calfskin hand-burnished by master cordwainers.","ctaLabel":"Explore Footwear","href":"/categories/footwear","desktopImage":"/images/category-scarpe.jpg","mobileImage":"/images/category-scarpe.jpg","focalX":50,"focalY":55},{"eyebrow":"ATELIER FINISHING","title":"Archival Accessories","description":"Saddlery belts, cashmere scarves, and brushed palladium hardware.","ctaLabel":"Explore Accessories","href":"/categories/accessories","desktopImage":"/images/category-accessori.jpg","mobileImage":"/images/category-accessori.jpg","focalX":50,"focalY":50}]}',
    '{"heading":"","items":[{"eyebrow":"GOOD YEAR WELTED","title":"Scarpe & Footwear","description":"French box calfskin hand-burnished by master cordwainers.","ctaLabel":"Explore Footwear","href":"/categories/footwear","desktopImage":"/images/category-scarpe.jpg","mobileImage":"/images/category-scarpe.jpg","focalX":50,"focalY":55},{"eyebrow":"ATELIER FINISHING","title":"Archival Accessories","description":"Saddlery belts, cashmere scarves, and brushed palladium hardware.","ctaLabel":"Explore Accessories","href":"/categories/accessories","desktopImage":"/images/category-accessori.jpg","mobileImage":"/images/category-accessori.jpg","focalX":50,"focalY":50}]}'
  ),
  (
    'sec_home_style_layering',
    'page_home',
    'style-layering',
    'style_layering',
    'Style Layering Interactive Wardrobe',
    6, 1, 1, 'published',
    '{"title":"Style Layering","ctaLabel":"Shop All Looks","ctaUrl":"/collections/aw26-architectural","tabs":[{"key":"atelier","label":"ATELIER DEYNOLD","backdropImage":"/images/style-1-model.jpg","focalX":50,"focalY":30,"pieces":[{"title":"Tailored Virgin Wool Suit","subtitle":"100% Virgin Wool • Charcoal","image":"/images/mastery-1-model.jpg","href":"/products/tailored-virgin-wool-suit","price":"₹ 2,700.00"},{"title":"Cashmere Mock-Neck Knit","subtitle":"Pure Inner Fleece • Ivory","image":"/images/mastery-2-model.jpg","href":"/products/cashmere-mock-neck-knit","price":"₹ 16,200.00"},{"title":"Hand-Burnished Oxford","subtitle":"French Calfskin • Espresso","image":"/images/category-scarpe.jpg","href":"/categories/footwear","price":"₹ 24,500.00"}]},{"key":"cashmere","label":"QUIET CASHMERE","backdropImage":"/images/mastery-2-model.jpg","focalX":50,"focalY":25,"pieces":[{"title":"Double-Breasted Overcoat","subtitle":"Virgin Wool & Cashmere","image":"/images/news-1-model.jpg","href":"/categories/coats","price":"₹ 38,000.00"},{"title":"Cady Relaxed Trousers","subtitle":"Architectural Drape","image":"/images/cady-trousers-model.jpg","href":"/products/cady-trousers","price":"₹ 72,500.00"},{"title":"Saddle Calfskin Belt","subtitle":"Brushed Palladium Buckle","image":"/images/category-accessori.jpg","href":"/categories/accessories","price":"₹ 11,500.00"}]}]}',
    '{"title":"Style Layering","ctaLabel":"Shop All Looks","ctaUrl":"/collections/aw26-architectural","tabs":[{"key":"atelier","label":"ATELIER DEYNOLD","backdropImage":"/images/style-1-model.jpg","focalX":50,"focalY":30,"pieces":[{"title":"Tailored Virgin Wool Suit","subtitle":"100% Virgin Wool • Charcoal","image":"/images/mastery-1-model.jpg","href":"/products/tailored-virgin-wool-suit","price":"₹ 2,700.00"},{"title":"Cashmere Mock-Neck Knit","subtitle":"Pure Inner Fleece • Ivory","image":"/images/mastery-2-model.jpg","href":"/products/cashmere-mock-neck-knit","price":"₹ 16,200.00"},{"title":"Hand-Burnished Oxford","subtitle":"French Calfskin • Espresso","image":"/images/category-scarpe.jpg","href":"/categories/footwear","price":"₹ 24,500.00"}]},{"key":"cashmere","label":"QUIET CASHMERE","backdropImage":"/images/mastery-2-model.jpg","focalX":50,"focalY":25,"pieces":[{"title":"Double-Breasted Overcoat","subtitle":"Virgin Wool & Cashmere","image":"/images/news-1-model.jpg","href":"/categories/coats","price":"₹ 38,000.00"},{"title":"Cady Relaxed Trousers","subtitle":"Architectural Drape","image":"/images/cady-trousers-model.jpg","href":"/products/cady-trousers","price":"₹ 72,500.00"},{"title":"Saddle Calfskin Belt","subtitle":"Brushed Palladium Buckle","image":"/images/category-accessori.jpg","href":"/categories/accessories","price":"₹ 11,500.00"}]}]}'
  );

-- Legal & Contact CMS Sections (Notice privacy-policy fixes legacy "Cashfree, Stripe" to "Razorpay, Cashfree")
INSERT OR IGNORE INTO cms_sections (id, page_id, section_key, section_type, title, sort_order, is_draft_visible, is_published_visible, status, draft_props_json, published_props_json) VALUES
  (
    'sec_pdp_defaults',
    'page_pdp_global',
    'pdp-config',
    'pdp_template',
    'Product Detail Page Global Configuration',
    1, 1, 1, 'published',
    '{"showOriginBadge":true,"originBadgeText":"MADE IN INDIA","showExclusiveBanner":true,"exclusiveBannerText":"Online exclusive — Dispatched in DEYNOLD DANNY archival keepsake packaging.","styleItWithHeading":"Style it with","relatedHeading":"You may also like","reviewsHeading":"Patron Impressions & Fit Notes","showReviews":true,"showFitFinder":true,"showSizeGuide":true,"conciergeHeading":"Atelier Assistance"}',
    '{"showOriginBadge":true,"originBadgeText":"MADE IN INDIA","showExclusiveBanner":true,"exclusiveBannerText":"Online exclusive — Dispatched in DEYNOLD DANNY archival keepsake packaging.","styleItWithHeading":"Style it with","relatedHeading":"You may also like","reviewsHeading":"Patron Impressions & Fit Notes","showReviews":true,"showFitFinder":true,"showSizeGuide":true,"conciergeHeading":"Atelier Assistance"}'
  ),
  (
    'sec_contact_main',
    'page_contact',
    'contact-atelier',
    'contact_page',
    'Contact & Private Appointments',
    1, 1, 1, 'published',
    '{"eyebrow":"Client Concierge & Atelier","title":"Connect With The House","subtitle":"Private fitting inquiries, bespoke alterations, order concierge, and international client relations.","subjects":["Product & Sizing Inquiry","Order Status & Delivery","Private Atelier Appointment","Bespoke & Alterations","Press & Editorial"]}',
    '{"eyebrow":"Client Concierge & Atelier","title":"Connect With The House","subtitle":"Private fitting inquiries, bespoke alterations, order concierge, and international client relations.","subjects":["Product & Sizing Inquiry","Order Status & Delivery","Private Atelier Appointment","Bespoke & Alterations","Press & Editorial"]}'
  ),
  (
    'sec_legal_privacy_body',
    'page_legal_privacy',
    'privacy-body',
    'legal_document',
    'Privacy Policy Content',
    1, 1, 1, 'published',
    '{"effectiveDate":"November 2026","eyebrow":"HOUSE GOVERNANCE","heading":"Privacy Policy","sections":[{"heading":"1. Client Data Confidentiality","body":"At DEYNOLD DANNY, client discretion and data integrity are fundamental to our atelier heritage. We protect all personal, measurement, and transactional records using strict transport and cryptographic controls in accordance with India DPDP Act 2023 and international privacy principles."},{"heading":"2. Information Collected & Purpose","body":"We collect your email address, verified delivery addresses, order history, and optional consent preferences solely to authenticate passwordless sessions, fulfill commissions, dispatch logistics updates via Shiprocket, and deliver requested newsletters."},{"heading":"3. Payment Processing","body":"All payment processing is executed through PCI-DSS Level 1 compliant gateway partners (Razorpay, Cashfree). DEYNOLD DANNY does not store raw credit card credentials, CVV, or banking passwords on our servers."},{"heading":"4. Client Data Rights","body":"Patrons may export a portable archive or request anonymization/erasure of personal data directly inside their Private Client Portal or by contacting privacy@deynolddanny.com."}]}',
    '{"effectiveDate":"November 2026","eyebrow":"HOUSE GOVERNANCE","heading":"Privacy Policy","sections":[{"heading":"1. Client Data Confidentiality","body":"At DEYNOLD DANNY, client discretion and data integrity are fundamental to our atelier heritage. We protect all personal, measurement, and transactional records using strict transport and cryptographic controls in accordance with India DPDP Act 2023 and international privacy principles."},{"heading":"2. Information Collected & Purpose","body":"We collect your email address, verified delivery addresses, order history, and optional consent preferences solely to authenticate passwordless sessions, fulfill commissions, dispatch logistics updates via Shiprocket, and deliver requested newsletters."},{"heading":"3. Payment Processing","body":"All payment processing is executed through PCI-DSS Level 1 compliant gateway partners (Razorpay, Cashfree). DEYNOLD DANNY does not store raw credit card credentials, CVV, or banking passwords on our servers."},{"heading":"4. Client Data Rights","body":"Patrons may export a portable archive or request anonymization/erasure of personal data directly inside their Private Client Portal or by contacting privacy@deynolddanny.com."}]}'
  ),
  (
    'sec_legal_shipping_body',
    'page_legal_shipping',
    'shipping-body',
    'legal_document',
    'Shipping & Returns Policy',
    1, 1, 1, 'published',
    '{"effectiveDate":"November 2026","eyebrow":"ATELIER LOGISTICS","heading":"Shipping & Returns","sections":[{"heading":"1. Complimentary Express Dispatch","body":"All orders above ₹10,000 qualify for complimentary insured express delivery across India. Orders below ₹10,000 carry a flat standard courier fee of ₹250."},{"heading":"2. Preparation & Tracking","body":"Ready-to-wear commissions are inspected and dispatched within 24–48 business hours in signature archival packaging. Live Shiprocket AWB milestones are emailed immediately upon dispatch."},{"heading":"3. 14-Day Returns & Exchanges","body":"Unworn, unaltered garments with intact house tags may be returned or exchanged within 14 days of delivery through your Private Client Portal or concierge desk."}]}',
    '{"effectiveDate":"November 2026","eyebrow":"ATELIER LOGISTICS","heading":"Shipping & Returns","sections":[{"heading":"1. Complimentary Express Dispatch","body":"All orders above ₹10,000 qualify for complimentary insured express delivery across India. Orders below ₹10,000 carry a flat standard courier fee of ₹250."},{"heading":"2. Preparation & Tracking","body":"Ready-to-wear commissions are inspected and dispatched within 24–48 business hours in signature archival packaging. Live Shiprocket AWB milestones are emailed immediately upon dispatch."},{"heading":"3. 14-Day Returns & Exchanges","body":"Unworn, unaltered garments with intact house tags may be returned or exchanged within 14 days of delivery through your Private Client Portal or concierge desk."}]}'
  ),
  (
    'sec_legal_terms_body',
    'page_legal_terms',
    'terms-body',
    'legal_document',
    'Terms & Conditions',
    1, 1, 1, 'published',
    '{"effectiveDate":"November 2026","eyebrow":"ATELIER CONDITIONS","heading":"Terms & Conditions","sections":[{"heading":"1. Scope & Pricing","body":"All prices displayed across DEYNOLD DANNY are in Indian Rupees (INR) inclusive of applicable GST unless explicitly noted. Inventory allocation is confirmed strictly upon authorized payment verification."},{"heading":"2. Intellectual Property","body":"All silhouettes, textile photography, brand monograms, and editorial copy remain the exclusive property of DEYNOLD DANNY Atelier Pvt. Ltd."},{"heading":"3. Governing Law","body":"All transactions and disputes are governed by the laws of India under the exclusive jurisdiction of courts in New Delhi."}]}',
    '{"effectiveDate":"November 2026","eyebrow":"ATELIER CONDITIONS","heading":"Terms & Conditions","sections":[{"heading":"1. Scope & Pricing","body":"All prices displayed across DEYNOLD DANNY are in Indian Rupees (INR) inclusive of applicable GST unless explicitly noted. Inventory allocation is confirmed strictly upon authorized payment verification."},{"heading":"2. Intellectual Property","body":"All silhouettes, textile photography, brand monograms, and editorial copy remain the exclusive property of DEYNOLD DANNY Atelier Pvt. Ltd."},{"heading":"3. Governing Law","body":"All transactions and disputes are governed by the laws of India under the exclusive jurisdiction of courts in New Delhi."}]}'
  ),
  (
    'sec_legal_cookie_body',
    'page_legal_cookie',
    'cookie-body',
    'legal_document',
    'Cookie Policy Content',
    1, 1, 1, 'published',
    '{"effectiveDate":"November 2026","eyebrow":"DIGITAL GOVERNANCE","heading":"Cookie Policy","sections":[{"heading":"1. Strictly Necessary Cookies","body":"We store a secure HttpOnly refresh token cookie strictly to keep client sessions authenticated without exposing credentials to browser scripts."},{"heading":"2. Analytics Consent (Opt-In)","body":"Storefront analytics remain fail-closed until you explicitly choose Accept All in our Cookie Governance Banner. You can withdraw consent at any time."}]}',
    '{"effectiveDate":"November 2026","eyebrow":"DIGITAL GOVERNANCE","heading":"Cookie Policy","sections":[{"heading":"1. Strictly Necessary Cookies","body":"We store a secure HttpOnly refresh token cookie strictly to keep client sessions authenticated without exposing credentials to browser scripts."},{"heading":"2. Analytics Consent (Opt-In)","body":"Storefront analytics remain fail-closed until you explicitly choose Accept All in our Cookie Governance Banner. You can withdraw consent at any time."}]}'
  );
