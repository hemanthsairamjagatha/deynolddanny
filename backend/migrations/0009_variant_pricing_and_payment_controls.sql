-- =============================================================================
-- DEYNOLD DANNY — Size-Wise Variant Pricing & Admin Payment Controls
-- Migration: 0009_variant_pricing_and_payment_controls.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. Size-wise / variant-wise price overrides (NULL inherits products.price_paise / compare_paise)
ALTER TABLE product_variants ADD COLUMN price_paise INTEGER CHECK (price_paise IS NULL OR price_paise > 0);
ALTER TABLE product_variants ADD COLUMN compare_paise INTEGER CHECK (compare_paise IS NULL OR compare_paise > 0);

-- 2. Audited admin order price adjustments (courtesy discounts, shipping waivers, bespoke fees)
ALTER TABLE orders ADD COLUMN admin_adjustment_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN admin_adjustment_reason TEXT;

-- 3. Immutable Admin Payment Manipulation & Settlement Audit Ledger
CREATE TABLE IF NOT EXISTS payment_adjustments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL CHECK (action_type IN (
    'manual_mark_paid',
    'amount_adjustment',
    'payment_status_override',
    'manual_refund',
    'gateway_config_change'
  )),
  delta_paise     INTEGER NOT NULL DEFAULT 0,
  previous_total_paise INTEGER,
  new_total_paise      INTEGER,
  payment_method  TEXT,
  reference_code  TEXT,
  reason          TEXT NOT NULL,
  metadata_json   TEXT,
  actor_id        TEXT NOT NULL,
  actor_email     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_adjustments_order   ON payment_adjustments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_adjustments_created ON payment_adjustments(created_at DESC);
