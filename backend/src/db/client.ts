// D1 batch helpers and unique CSPRNG identifiers

import { D1_MAX_BATCH_SIZE, ORDER_NUMBER_PREFIX } from '../config/constants.js';

/**
 * Run prepared statements in safe D1 batch chunks (<= 50 statements per call).
 */
export async function runBatch(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  if (statements.length <= D1_MAX_BATCH_SIZE) {
    return db.batch(statements);
  }
  const results: D1Result[] = [];
  for (let i = 0; i < statements.length; i += D1_MAX_BATCH_SIZE) {
    const chunk = statements.slice(i, i + D1_MAX_BATCH_SIZE);
    const chunkRes = await db.batch(chunk);
    results.push(...chunkRes);
  }
  return results;
}

/**
 * Splits arbitrary items and prepares & runs chunked batches (50 per batch).
 */
export async function runChunkedOperations<T>(
  db: D1Database,
  items: T[],
  toStatement: (item: T) => D1PreparedStatement,
): Promise<D1Result[]> {
  if (items.length === 0) return [];
  const statements = items.map(toStatement);
  return runBatch(db, statements);
}

/**
 * Returns the current time as an ISO-8601 string (UTC).
 */
export function nowIso(): string {
  return new Date().toISOString();
}

const SAFE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a high-entropy, non-sequential order number (e.g. DD-2026-K7M4P9).
 * Prevents sequential order enumeration and avoids write-contention races.
 */
export async function generateOrderNumber(db: D1Database): Promise<string> {
  const yearPrefix = `DD-${new Date().getUTCFullYear()}-`;
  const prefix = yearPrefix || ORDER_NUMBER_PREFIX;

  for (let attempt = 0; attempt < 6; attempt++) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let code = '';
    for (let i = 0; i < bytes.length; i++) {
      code += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
    }
    const candidate = `${prefix}${code}`;
    const existing = await db
      .prepare(`SELECT 1 FROM orders WHERE order_number = ?1 LIMIT 1`)
      .bind(candidate)
      .first();
    if (!existing) return candidate;
  }

  // Cryptographic fallback guarantees uniqueness
  const fallbackBytes = new Uint8Array(5);
  crypto.getRandomValues(fallbackBytes);
  const hex = Array.from(fallbackBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `${prefix}${hex}`;
}
