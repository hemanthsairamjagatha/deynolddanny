-- =============================================================================
-- Migration 0004: Order audit logs table
-- =============================================================================
-- Adds the order_audit_logs table for tracking every status change and
-- admin/webhook action on an order.
-- delivered_at column already exists in 0001_initial_schema.sql (line 218).
-- =============================================================================

PRAGMA foreign_keys = ON;

-- Audit trail for every status change, shipping event, and webhook action
CREATE TABLE IF NOT EXISTS order_audit_logs (
  id           TEXT NOT NULL PRIMARY KEY,     -- hex(randomblob(8)) — 16 hex chars
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,                 -- 'status_change' | 'ndr' | 'ship' | 'cancel' | 'refund'
  detail       TEXT,                          -- human-readable description
  performed_by TEXT,                          -- admin user ID, 'system', 'shiprocket_webhook', etc.
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_order_id ON order_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON order_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON order_audit_logs(created_at DESC);

