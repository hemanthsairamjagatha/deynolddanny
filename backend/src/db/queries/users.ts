import { nowIso } from '../client.js';

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByEmail(db: D1Database, email: string) {
  return db
    .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`)
    .bind(email.toLowerCase())
    .first<Record<string, unknown>>();
}

export async function getUserById(db: D1Database, id: string) {
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).bind(id).first<Record<string, unknown>>();
}

export async function upsertUser(
  db: D1Database,
  data: { id: string; email: string; fullName?: string | null },
) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (id, email, full_name, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)`,
    )
    .bind(data.id, data.email.toLowerCase(), data.fullName ?? null, nowIso())
    .run();
  // Update full_name if provided on subsequent logins
  if (data.fullName) {
    await db
      .prepare(`UPDATE users SET full_name = ?1, updated_at = ?2 WHERE email = ?3 AND full_name IS NULL`)
      .bind(data.fullName, nowIso(), data.email.toLowerCase())
      .run();
  }
  return getUserByEmail(db, data.email);
}

export async function updateUser(
  db: D1Database,
  userId: string,
  fields: { fullName?: string; phone?: string },
) {
  await db
    .prepare(
      `UPDATE users SET full_name = COALESCE(?1, full_name), phone = COALESCE(?2, phone), updated_at = ?3
       WHERE id = ?4`,
    )
    .bind(fields.fullName ?? null, fields.phone ?? null, nowIso(), userId)
    .run();
  return getUserById(db, userId);
}

export async function updateLastLogin(db: D1Database, userId: string) {
  await db
    .prepare(`UPDATE users SET last_login_at = ?1, updated_at = ?1 WHERE id = ?2`)
    .bind(nowIso(), userId)
    .run();
}

