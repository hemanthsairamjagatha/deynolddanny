import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { Miniflare } from 'miniflare';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'migrations');

let compiledScriptCache = null;

/**
 * Splits a multi-statement SQLite script into individual executable statements.
 * Respects string literals, block/line comments, and `BEGIN ... END;` trigger blocks
 * including nested `CASE ... END` expressions.
 */
export function splitSqliteStatements(sql) {
  const statements = [];
  let current = '';
  let word = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let blockDepth = 0;
  let inTriggerHeader = false;

  const flushWord = () => {
    if (!word) return;
    const w = word.toUpperCase();
    if (w === 'TRIGGER' && /\bCREATE\s+TRIGGER$/i.test(current.trimEnd())) {
      inTriggerHeader = true;
    } else if (w === 'BEGIN' && (inTriggerHeader || blockDepth > 0)) {
      blockDepth += 1;
      inTriggerHeader = false;
    } else if (w === 'CASE' && blockDepth > 0) {
      blockDepth += 1;
    } else if (w === 'END' && blockDepth > 0) {
      blockDepth -= 1;
    }
    word = '';
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1] ?? '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === '-' && next === '-') {
        flushWord();
        inLineComment = true;
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        flushWord();
        inBlockComment = true;
        i += 2;
        continue;
      }
    }

    if (ch === "'" && !inDouble) {
      flushWord();
      current += ch;
      if (inSingle && next === "'") {
        current += next;
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      i += 1;
      continue;
    }

    if (ch === '"' && !inSingle) {
      flushWord();
      current += ch;
      inDouble = !inDouble;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (/[A-Za-z0-9_]/.test(ch)) {
        word += ch;
        current += ch;
        i += 1;
        continue;
      }
      flushWord();
      if (ch === ';' && blockDepth === 0) {
        const stmt = current.trim();
        if (stmt) statements.push(stmt);
        current = '';
        inTriggerHeader = false;
        i += 1;
        continue;
      }
    }

    current += ch;
    i += 1;
  }

  flushWord();
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/**
 * Bundles `src/index.ts` once per test run for fast worker instantiation in Miniflare.
 */
export async function getCompiledWorkerCode() {
  if (compiledScriptCache) return compiledScriptCache;

  const result = await esbuild.build({
    entryPoints: [path.join(BACKEND_ROOT, 'src/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    mainFields: ['module', 'main'],
    conditions: ['workerd', 'worker', 'browser'],
    logLevel: 'silent',
  });

  compiledScriptCache = result.outputFiles[0].text;
  return compiledScriptCache;
}

export const DEFAULT_TEST_BINDINGS = {
  ENVIRONMENT: 'staging',
  FRONTEND_URL: 'https://deynolddanny.com',
  CORS_ORIGINS: 'https://deynolddanny.com',
  JWT_SECRET: 'test-jwt-secret-key-at-least-32-chars-01',
  JWT_SECRET_PREV: 'prev-jwt-secret-key-at-least-32-chars-00',
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  RAZORPAY_WEBHOOK_SECRET: 'rzp_webhook_secret_test_123456',
  CASHFREE_APP_ID: '',
  CASHFREE_SECRET_KEY: 'cf_webhook_secret_test_123456',
  SHIPROCKET_EMAIL: '',
  SHIPROCKET_PASSWORD: '',
  SHIPROCKET_PICKUP_PINCODE: '',
  SHIPROCKET_CHANNEL_ID: '',
  SHIPROCKET_WEBHOOK_TOKEN: 'sr_webhook_secret_test_123456',
  ENABLE_TEST_CHECKOUT_FALLBACK: 'false',
  AUTO_REFUND_DUPLICATE_CAPTURE: 'false',
  COURIER_FAIL_OPEN: 'false',
};

/**
 * Launches an isolated Miniflare instance with clean D1 schema + seed data (`0001..0005`).
 */
export async function createTestWorker(bindingOverrides = {}, { skipSeed = false } = {}) {
  const script = await getCompiledWorkerCode();
  const bindings = { ...DEFAULT_TEST_BINDINGS, ...bindingOverrides };

  const mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2024-09-23',
    d1Databases: { DB: 'deynold-danny-test-db' },
    kvNamespaces: { CATALOG_KV: 'deynold-danny-test-kv' },
    bindings,
  });

  try {
    const db = await mf.getD1Database('DB');
    const kv = await mf.getKVNamespace('CATALOG_KV');

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && (!skipSeed || !f.startsWith('0002_')))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const stmts = splitSqliteStatements(sql);
      for (const stmt of stmts) {
        await db.prepare(stmt).run();
      }
    }

    return {
      mf,
      db,
      kv,
      bindings,
      async request(urlPath, init = {}) {
        const headers = new Headers(init.headers || {});
        if (!headers.has('Origin')) {
          headers.set('Origin', 'https://deynolddanny.com');
        }
        const res = await mf.dispatchFetch(`https://api.deynolddanny.com${urlPath}`, {
          ...init,
          headers,
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // non-JSON response allowed
        }
        return { res, status: res.status, headers: res.headers, text, json };
      },
      async triggerCron(cron = '*/15 * * * *') {
        const worker = await mf.getWorker();
        return worker.scheduled({ cron, scheduledTime: Date.now() });
      },
      async dispose() {
        await mf.dispose();
      },
    };
  } catch (err) {
    await mf.dispose().catch(() => {});
    throw err;
  }
}

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function signHmacSha256Hex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function signCashfreeWebhook(timestamp, rawBody, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(`${timestamp}${rawBody}`).digest('base64');
}

/**
 * Provisions a verified user via the real `/api/auth/verify-otp` endpoint without calling Resend.
 */
export async function authenticateUser(
  worker,
  email,
  { role = 'customer', fullName = 'Test Patron', jwtSecret, ip } = {},
) {
  const secret = jwtSecret || worker.bindings.JWT_SECRET;
  const otp = '123456';
  const otpHash = sha256Hex(`${secret}${otp}`);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = `otp_${crypto.randomUUID().slice(0, 12)}`;

  await worker.db
    .prepare(
      `INSERT INTO otps (id, email, otp_hash, purpose, expires_at, attempts, consumed, created_at)
       VALUES (?1, ?2, ?3, 'login', ?4, 0, 0, ?5)`,
    )
    .bind(otpId, email.toLowerCase(), otpHash, expiresAt, now)
    .run();

  const headers = { 'Content-Type': 'application/json' };
  if (ip) headers['CF-Connecting-IP'] = ip;

  const { res, status, json } = await worker.request('/api/auth/verify-otp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, otp, fullName }),
  });

  if (status !== 200 || !json?.success) {
    throw new Error(`authenticateUser failed (${status}): ${JSON.stringify(json)}`);
  }

  let { accessToken, user } = json.data;
  const setCookieHeader = res.headers.get('set-cookie') || '';
  const match = setCookieHeader.match(/dd_refresh=([^;]+)/);
  const refreshCookie = match ? `dd_refresh=${match[1]}` : '';

  if (role === 'admin' && user.role !== 'admin') {
    await worker.db
      .prepare(`UPDATE users SET role = 'admin', full_name = ?1 WHERE id = ?2`)
      .bind(fullName, user.id)
      .run();
    const refreshed = await worker.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: refreshCookie },
    });
    accessToken = refreshed.json.data.accessToken;
    user = refreshed.json.data.user;
    const newSetCookie = refreshed.headers.get('set-cookie') || '';
    const m2 = newSetCookie.match(/dd_refresh=([^;]+)/);
    return {
      accessToken,
      user,
      refreshCookie: m2 ? `dd_refresh=${m2[1]}` : refreshCookie,
    };
  }

  return { accessToken, user, refreshCookie };
}

/**
 * Helper to fetch the first active variant in D1 for checkout/race tests and optionally set exact stock.
 */
export async function getSeedVariant(worker, setExactStock = null) {
  const variant = await worker.db
    .prepare(
      `SELECT pv.id, pv.product_id, pv.sku, pv.stock, pv.reserved_stock, p.price_paise, p.title, p.slug
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.is_active = 1 AND p.is_active = 1
       LIMIT 1`,
    )
    .first();

  if (!variant) {
    throw new Error('Expected at least 1 seeded product variant in D1');
  }

  if (typeof setExactStock === 'number') {
    await worker.db
      .prepare(`UPDATE product_variants SET stock = ?1, reserved_stock = 0 WHERE id = ?2`)
      .bind(setExactStock, variant.id)
      .run();
    variant.stock = setExactStock;
    variant.reserved_stock = 0;
  }

  return variant;
}
