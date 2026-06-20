// ============================================================
// Kotemart Jastip Catalog — Session Management
// ============================================================

import type { User } from './types';

/**
 * Generates a 64-character hex token by concatenating two random UUIDs
 * and stripping the hyphens.
 */
export function generateToken(): string {
  const a = crypto.randomUUID().replace(/-/g, '');
  const b = crypto.randomUUID().replace(/-/g, '');
  return (a + b).slice(0, 64);
}

/**
 * Inserts a new session row with a 24-hour expiry and returns the token.
 */
export async function createSession(
  db: D1Database,
  userId: string,
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES (?1, ?2, ?3)`,
    )
    .bind(token, userId, expiresAt)
    .run();

  return token;
}

/**
 * Validates a session token.
 *
 * - Returns the associated user object if the session is valid and the user is active.
 * - Deletes the session row if it has expired.
 * - Returns null for any invalid / expired / disabled-user case.
 */
export async function validateSession(
  db: D1Database,
  token: string,
): Promise<Pick<User, 'id' | 'email' | 'name' | 'avatar_url' | 'role' | 'is_active'> | null> {
  if (!token) return null;

  const row = await db
    .prepare(
      `SELECT
         s.expires_at,
         u.id,
         u.email,
         u.name,
         u.avatar_url,
         u.role,
         u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?1`,
    )
    .bind(token)
    .first<{
      expires_at: string;
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      role: 'buyer' | 'admin';
      is_active: number;
    }>();

  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    // Clean up expired session
    await db.prepare(`DELETE FROM sessions WHERE id = ?1`).bind(token).run();
    return null;
  }

  // Check if user is active
  if (row.is_active !== 1) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    role: row.role,
    is_active: row.is_active,
  };
}

/**
 * Deletes a session by its token (logout).
 */
export async function deleteSession(
  db: D1Database,
  token: string,
): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id = ?1`).bind(token).run();
}
