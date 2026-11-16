-- =============================================================================
-- DEYNOLD DANNY — Schema Hardening, Triggers, Financial & Ops Tables
-- Migration: 0005_schema_hardening_and_triggers.sql
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- -----------------------------------------------------------------------------
-- 1. Fix external-content FTS5 triggers on products (0001 delete crash fix)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_products_fts_update;
DROP TRIGGER IF EXISTS trg_products_fts_delete;

CREATE TRIGGER IF NOT EXISTS trg_products_fts_update AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, id, title, description, material)
  VALUES ('delete', old.rowid, old.id, old.title, old.description, old.material);
  INSERT INTO products_fts(rowid, id, title, description, material)
  VALUES (new.rowid, new.id, new.title, new.description, new.material);
END;

CREATE TRIGGER IF NOT EXISTS trg_products_fts_delete AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, id, title, description, material)
  VALUES ('delete', old.rowid, old.id, old.title, old.description, old.material);
END;

INSERT INTO products_fts(products_fts) VALUES ('rebuild');

-- -----------------------------------------------------------------------------
-- 2. Users hardening (token_version for immediate session revocation & DPDP delete)
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, role);

-- -----------------------------------------------------------------------------
-- 3. Refresh token family tracking for rotation replay detection
-- -----------------------------------------------------------------------------
ALTER TABLE refresh_tokens ADD COLUMN token_family TEXT;
ALTER TABLE refresh_tokens ADD COLUMN revoked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family);

-- -----------------------------------------------------------------------------
-- 4. Products & Variants hardening (sort_order, dimensions, tax metadata)
-- -----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN hsn_code TEXT;
ALTER TABLE products ADD COLUMN gst_rate_bps INTEGER;
ALTER TABLE products ADD COLUMN weight_grams INTEGER DEFAULT 500;
ALTER TABLE products ADD COLUMN length_cm INTEGER DEFAULT 30;
ALTER TABLE products ADD COLUMN breadth_cm INTEGER DEFAULT 25;
ALTER TABLE products ADD COLUMN height_cm INTEGER DEFAULT 5;

ALTER TABLE product_variants ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_variants_product_sort ON product_variants(product_id, is_active, sort_order);

-- Enforce stock >= reserved_stock >= 0 invariant at database layer
CREATE TRIGGER IF NOT EXISTS trg_variants_stock_check_insert
BEFORE INSERT ON product_variants
BEGIN
  SELECT CASE
    WHEN NEW.stock < 0 OR NEW.reserved_stock < 0 OR NEW.reserved_stock > NEW.stock THEN
      RAISE(ABORT, 'STOCK_INVARIANT_VIOLATION')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_variants_stock_check_update
BEFORE UPDATE OF stock, reserved_stock ON product_variants
BEGIN
  SELECT CASE
    WHEN NEW.stock < 0 OR NEW.reserved_stock < 0 OR NEW.reserved_stock > NEW.stock THEN
      RAISE(ABORT, 'STOCK_INVARIANT_VIOLATION')
  END;
END;

-- -----------------------------------------------------------------------------
-- 5. Rebuild orders table with expanded lifecycle CHECKs & financial controls
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders_new (
  id                       TEXT PRIMARY KEY,
  order_number             TEXT UNIQUE NOT NULL,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK(status IN (
                             'pending',
                             'awaiting_capture',
                             'confirmed',
                             'confirmed_needs_allocation',
                             'processing',
                             'shipped',
                             'ndr_pending',
                             'delivered',
                             'return_requested',
                             'returned',
                             'cancelled',
                             'refunded'
                           )),
  subtotal_paise           INTEGER NOT NULL CHECK(subtotal_paise >= 0),
  shipping_paise           INTEGER NOT NULL DEFAULT 0 CHECK(shipping_paise >= 0),
  discount_paise           INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0),
  tax_paise                INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0),
  total_paise              INTEGER NOT NULL CHECK(total_paise >= 0),
  currency                 TEXT NOT NULL DEFAULT 'INR',
  payment_status           TEXT NOT NULL DEFAULT 'pending'
                           CHECK(payment_status IN (
                             'pending',
                             'authorized',
                             'paid',
                             'partially_refunded',
                             'refunded',
                             'failed',
                             'user_dropped',
                             'disputed'
                           )),
  refunded_paise           INTEGER NOT NULL DEFAULT 0 CHECK(refunded_paise >= 0),
  dispute_frozen           INTEGER NOT NULL DEFAULT 0 CHECK(dispute_frozen IN (0, 1)),
  stock_committed          INTEGER NOT NULL DEFAULT 0 CHECK(stock_committed IN (0, 1)),
  stock_released           INTEGER NOT NULL DEFAULT 0 CHECK(stock_released IN (0, 1)),
  idempotency_key          TEXT UNIQUE,
  expires_epoch            INTEGER NOT NULL DEFAULT 0,
  cf_order_id              TEXT UNIQUE,
  cf_payment_id            TEXT,
  payment_method           TEXT,
  paid_at                  TEXT,
  shipping_name            TEXT NOT NULL,
  shipping_phone           TEXT NOT NULL,
  shipping_line1           TEXT NOT NULL,
  shipping_line2           TEXT,
  shipping_city            TEXT NOT NULL,
  shipping_state           TEXT NOT NULL,
  shipping_pincode         TEXT NOT NULL,
  shipping_country         TEXT NOT NULL DEFAULT 'IN',
  courier_partner          TEXT,
  tracking_number          TEXT,
  shiprocket_order_id      TEXT,
  shiprocket_shipment_id   TEXT,
  shiprocket_awb           TEXT,
  shiprocket_courier       TEXT,
  shipped_at               TEXT,
  delivered_at             TEXT,
  cancelled_at             TEXT,
  cancellation_reason      TEXT,
  coupon_code              TEXT,
  customer_notes           TEXT,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO orders_new (
  id, order_number, user_id, status, subtotal_paise, shipping_paise,
  discount_paise, tax_paise, total_paise, currency, payment_status,
  refunded_paise, dispute_frozen, stock_committed, stock_released,
  idempotency_key, expires_epoch,
  cf_order_id, cf_payment_id, payment_method, paid_at,
  shipping_name, shipping_phone, shipping_line1, shipping_line2,
  shipping_city, shipping_state, shipping_pincode, shipping_country,
  courier_partner, tracking_number, shiprocket_order_id, shiprocket_shipment_id,
  shiprocket_awb, shiprocket_courier, shipped_at, delivered_at,
  cancelled_at, cancellation_reason, coupon_code, customer_notes,
  created_at, updated_at
)
SELECT
  id, order_number, user_id, status, subtotal_paise, shipping_paise,
  discount_paise, tax_paise, total_paise, 'INR', payment_status,
  CASE WHEN payment_status = 'refunded' THEN total_paise ELSE 0 END,
  0,
  CASE WHEN payment_status IN ('paid', 'refunded') THEN 1 ELSE 0 END,
  CASE WHEN status IN ('cancelled', 'refunded') AND payment_status != 'paid' THEN 1 ELSE 0 END,
  NULL,
  COALESCE(CAST(strftime('%s', created_at) AS INTEGER) + 900, 0),
  cf_order_id, cf_payment_id, payment_method, paid_at,
  shipping_name, shipping_phone, shipping_line1, shipping_line2,
  shipping_city, shipping_state, shipping_pincode, shipping_country,
  courier_partner, tracking_number, shiprocket_order_id, NULL,
  shiprocket_awb, shiprocket_courier, shipped_at, delivered_at,
  NULL, NULL, coupon_code, customer_notes,
  created_at, updated_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_user          ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cf_id         ON orders(cf_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pending_reap  ON orders(status, payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_expires_epoch ON orders(status, payment_status, expires_epoch);
CREATE INDEX IF NOT EXISTS idx_orders_shiprocket    ON orders(shiprocket_order_id, shiprocket_awb);

-- -----------------------------------------------------------------------------
-- 6. Order Items financial line-item columns (GST/discount/refund tracking)
-- -----------------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN discount_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN taxable_paise  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN tax_paise      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN hsn_code       TEXT;
ALTER TABLE order_items ADD COLUMN gst_rate_bps   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN refunded_qty   INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant  ON cart_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_otps_ip_created     ON otps(ip_address, created_at);

-- -----------------------------------------------------------------------------
-- 7. Payment Attempts, Refunds & Disputes Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_attempts (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempt_number      INTEGER NOT NULL DEFAULT 1,
  gateway             TEXT NOT NULL CHECK(gateway IN ('razorpay', 'cashfree', 'test')),
  gateway_order_id    TEXT UNIQUE,
  gateway_payment_id  TEXT,
  amount_paise        INTEGER NOT NULL CHECK(amount_paise >= 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created'
                      CHECK(status IN ('created', 'authorized', 'captured', 'failed', 'expired', 'superseded')),
  raw_status          TEXT,
  failure_reason      TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_gw_id ON payment_attempts(gateway_payment_id);

CREATE TABLE IF NOT EXISTS refunds (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id        TEXT,
  gateway           TEXT NOT NULL CHECK(gateway IN ('razorpay', 'cashfree', 'manual')),
  gateway_refund_id TEXT UNIQUE,
  amount_paise      INTEGER NOT NULL CHECK(amount_paise > 0),
  reason            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'failed')),
  initiated_by      TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_disputes (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gateway            TEXT NOT NULL CHECK(gateway IN ('razorpay', 'cashfree')),
  gateway_dispute_id TEXT UNIQUE NOT NULL,
  payment_id         TEXT,
  amount_paise       INTEGER NOT NULL DEFAULT 0,
  reason_code        TEXT,
  status             TEXT NOT NULL DEFAULT 'open',
  respond_by         TEXT,
  resolved_outcome   TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_order ON payment_disputes(order_id);

-- -----------------------------------------------------------------------------
-- 8. Webhook Deduplication, D1 Rate Limits & Email Outbox
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id            TEXT PRIMARY KEY,
  gateway       TEXT NOT NULL CHECK(gateway IN ('razorpay', 'cashfree', 'shiprocket')),
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  order_id      TEXT,
  payload_hash  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  received_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at  TEXT,
  CONSTRAINT uq_webhook_gateway_event UNIQUE (gateway, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order ON webhook_events(order_id, received_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 1,
  reset_epoch INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_epoch);

CREATE TABLE IF NOT EXISTS email_outbox (
  id           TEXT PRIMARY KEY,
  dedupe_key   TEXT UNIQUE NOT NULL,
  recipient    TEXT NOT NULL,
  email_type   TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status, created_at);

-- -----------------------------------------------------------------------------
-- 9. Coupons Per-User Redemptions, Inventory Movements, Returns & Restock
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id             TEXT PRIMARY KEY,
  coupon_id      TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id       TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'held' CHECK(status IN ('held', 'applied', 'released')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(coupon_id, user_id, status);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id             TEXT PRIMARY KEY,
  variant_id     TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  order_id       TEXT REFERENCES orders(id) ON DELETE SET NULL,
  movement_type  TEXT NOT NULL CHECK(movement_type IN ('hold', 'release', 'commit', 'return_restock', 'admin_adjust', 'reconciliation_drift')),
  qty_delta      INTEGER NOT NULL,
  stock_after    INTEGER,
  reserved_after INTEGER,
  actor_id       TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON inventory_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order   ON inventory_movements(order_id);

CREATE TABLE IF NOT EXISTS return_requests (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'requested'
              CHECK(status IN ('requested', 'approved', 'rejected', 'pickup_scheduled', 'received', 'inspected', 'refunded', 'closed')),
  reason      TEXT NOT NULL,
  items_json  TEXT NOT NULL,
  resolution  TEXT DEFAULT 'refund' CHECK(resolution IN ('refund', 'exchange')),
  refund_id   TEXT,
  admin_notes TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user  ON return_requests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS restock_subscriptions (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  email      TEXT NOT NULL COLLATE NOCASE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'notified', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_restock_sub UNIQUE (product_id, variant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_restock_sub_variant ON restock_subscriptions(variant_id, status);

PRAGMA foreign_keys = ON;
