-- =============================================================================
-- DEYNOLD DANNY — Migration 0003
-- refresh_tokens + Shiprocket columns + pincode_cache
-- Safe to re-run: uses IF NOT EXISTS and ALTER TABLE (D1 ignores duplicate columns)
-- =============================================================================
-- NOTE: Run via db:migrate:local / db:migrate:remote scripts in package.json
-- which now chain all three migration files: 0001 → 0002 → 0003
-- =============================================================================
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. refresh_tokens
-- Missing table that causes ALL login flows to crash in production.
-- Stores hashed refresh tokens with expiry, linked to users via FK.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- 2. Shiprocket integration columns on orders
-- Added for the Shiprocket fulfilment flow being built in parallel.
-- D1 silently ignores ALTER TABLE ADD COLUMN if the column already exists,
-- making this safe to re-run.
-- -----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN shiprocket_order_id TEXT;
ALTER TABLE orders ADD COLUMN shiprocket_awb       TEXT;
ALTER TABLE orders ADD COLUMN shiprocket_courier   TEXT;

-- -----------------------------------------------------------------------------
-- 3. pincode_cache
-- Pre-checkout pincode serviceability cache.
-- Stores Shiprocket courier availability per pincode with TTL managed in app.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pincode_cache (
  pincode      TEXT PRIMARY KEY,
  serviceable  INTEGER NOT NULL DEFAULT 1,
  courier_data TEXT,
  cached_at    TEXT NOT NULL
);
