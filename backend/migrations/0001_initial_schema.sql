-- =============================================================================
-- DEYNOLD DANNY — D1 Initial Schema
-- Migration: 0001_initial_schema.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL COLLATE NOCASE,
  full_name       TEXT,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin', 'superadmin')),
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_login_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- -----------------------------------------------------------------------------
-- 2. otps
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otps (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL COLLATE NOCASE,
  otp_hash        TEXT NOT NULL,
  purpose         TEXT NOT NULL DEFAULT 'login' CHECK(purpose IN ('login', 'admin_login', 'update_email')),
  expires_at      TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  consumed        INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0, 1)),
  ip_address      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_otps_lookup ON otps(email, purpose, consumed, expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_rate   ON otps(email, created_at);

-- -----------------------------------------------------------------------------
-- 3. addresses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_type    TEXT NOT NULL DEFAULT 'Home' CHECK(address_type IN ('Home', 'Office', 'Other')),
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  line1           TEXT NOT NULL,
  line2           TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'IN',
  is_default      INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id, is_default);

-- -----------------------------------------------------------------------------
-- 4. categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  tagline         TEXT DEFAULT 'SCOPRI ORA',
  image_url       TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_slug        ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active_sort ON categories(is_active, sort_order);

-- -----------------------------------------------------------------------------
-- 5. products
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT UNIQUE NOT NULL,
  sku_prefix             TEXT UNIQUE NOT NULL,
  title                  TEXT NOT NULL,
  description            TEXT,
  material               TEXT,
  care_guide             TEXT,
  gender                 TEXT,
  tag                    TEXT,
  size_and_fit_json      TEXT,
  composition_care_json  TEXT,
  shipping_returns_json  TEXT,
  price_paise            INTEGER NOT NULL CHECK(price_paise > 0),
  compare_paise          INTEGER,
  badge                  TEXT,
  section_group          TEXT NOT NULL CHECK(section_group IN ('mastery', 'style_space', 'news')),
  category_id            TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  default_img            TEXT NOT NULL,
  hover_img              TEXT NOT NULL,
  is_active              INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  is_featured            INTEGER NOT NULL DEFAULT 1 CHECK(is_featured IN (0, 1)),
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_section  ON products(section_group, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, is_active, sort_order);

-- -----------------------------------------------------------------------------
-- 6. product_variants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             TEXT UNIQUE NOT NULL,
  size            TEXT NOT NULL,
  color_name      TEXT NOT NULL DEFAULT 'Default',
  color_hex       TEXT NOT NULL DEFAULT '#111111',
  stock           INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  reserved_stock  INTEGER NOT NULL DEFAULT 0 CHECK(reserved_stock >= 0),
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_product_size_color UNIQUE (product_id, size, color_name)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_variants_sku     ON product_variants(sku);

-- -----------------------------------------------------------------------------
-- 7. product_images  (color_name supports swatch-specific gallery)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name      TEXT NOT NULL DEFAULT 'Default',
  image_url       TEXT NOT NULL,
  alt_text        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_prod_images ON product_images(product_id, color_name, sort_order);

-- -----------------------------------------------------------------------------
-- 8. product_cross_sells  (style_it_with + related)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_cross_sells (
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relation_type     TEXT NOT NULL CHECK(relation_type IN ('style_it_with', 'related')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, target_product_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_cross_sells ON product_cross_sells(product_id, relation_type);

-- -----------------------------------------------------------------------------
-- 9. carts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  session_id      TEXT UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_carts_user    ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(session_id);

-- -----------------------------------------------------------------------------
-- 10. cart_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
  id              TEXT PRIMARY KEY,
  cart_id         TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id      TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_cart_variant UNIQUE (cart_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- -----------------------------------------------------------------------------
-- 11. orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  order_number        TEXT UNIQUE NOT NULL,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  subtotal_paise      INTEGER NOT NULL CHECK(subtotal_paise >= 0),
  shipping_paise      INTEGER NOT NULL DEFAULT 0 CHECK(shipping_paise >= 0),
  discount_paise      INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0),
  tax_paise           INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0),
  total_paise         INTEGER NOT NULL CHECK(total_paise >= 0),
  payment_status      TEXT NOT NULL DEFAULT 'pending'
                      CHECK(payment_status IN ('pending','paid','failed','refunded','user_dropped')),
  cf_order_id         TEXT UNIQUE,
  cf_payment_id       TEXT,
  payment_method      TEXT,
  paid_at             TEXT,
  shipping_name       TEXT NOT NULL,
  shipping_phone      TEXT NOT NULL,
  shipping_line1      TEXT NOT NULL,
  shipping_line2      TEXT,
  shipping_city       TEXT NOT NULL,
  shipping_state      TEXT NOT NULL,
  shipping_pincode    TEXT NOT NULL,
  shipping_country    TEXT NOT NULL DEFAULT 'IN',
  courier_partner     TEXT,
  tracking_number     TEXT,
  shipped_at          TEXT,
  delivered_at        TEXT,
  coupon_code         TEXT,
  customer_notes      TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user        ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cf_id       ON orders(cf_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pending_reap ON orders(status, payment_status, created_at);

-- -----------------------------------------------------------------------------
-- 12. order_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id          TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_id          TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  title_snapshot      TEXT NOT NULL,
  sku_snapshot        TEXT NOT NULL,
  size_snapshot       TEXT NOT NULL,
  color_snapshot      TEXT NOT NULL,
  image_snapshot      TEXT NOT NULL,
  unit_price_paise    INTEGER NOT NULL CHECK(unit_price_paise > 0),
  quantity            INTEGER NOT NULL CHECK(quantity > 0),
  total_paise         INTEGER NOT NULL CHECK(total_paise > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- -----------------------------------------------------------------------------
-- 13. wishlists
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlists (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_user_wishlist UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);

-- -----------------------------------------------------------------------------
-- 14. newsletter_subscribers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL COLLATE NOCASE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'unsubscribed')),
  unsub_token     TEXT UNIQUE NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- 15. coupons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id                  TEXT PRIMARY KEY,
  code                TEXT UNIQUE NOT NULL COLLATE NOCASE,
  discount_type       TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed_amount')),
  discount_value      INTEGER NOT NULL,
  min_order_paise     INTEGER NOT NULL DEFAULT 0,
  max_discount_paise  INTEGER,
  usage_limit         INTEGER,
  used_count          INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  expires_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- 16. admin_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
  id              TEXT PRIMARY KEY,
  admin_id        TEXT NOT NULL REFERENCES users(id),
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  metadata        TEXT,
  ip_address      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_logs ON admin_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 17. FTS5 — instant product search
-- -----------------------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  id UNINDEXED,
  title,
  description,
  material,
  content='products',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS trg_products_fts_insert AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, id, title, description, material)
  VALUES (new.rowid, new.id, new.title, new.description, new.material);
END;

CREATE TRIGGER IF NOT EXISTS trg_products_fts_update AFTER UPDATE ON products BEGIN
  DELETE FROM products_fts WHERE rowid = old.rowid;
  INSERT INTO products_fts(rowid, id, title, description, material)
  VALUES (new.rowid, new.id, new.title, new.description, new.material);
END;

CREATE TRIGGER IF NOT EXISTS trg_products_fts_delete AFTER DELETE ON products BEGIN
  DELETE FROM products_fts WHERE rowid = old.rowid;
END;
