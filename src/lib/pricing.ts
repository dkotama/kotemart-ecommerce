// ============================================================
// Kotemart Jastip Catalog — Pricing Helpers
// ============================================================

import { MASTER_CATEGORIES, type Settings } from './types';

/**
 * Rounds a number up to the nearest 1,000 (e.g. 12,345 -> 13,000).
 */
export function ceilTo1000(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

/**
 * Computes the IDR estimate using the canonical pricing formula:
 *   price_idr = price_jpy * jpy_rate * (1 + fee_pct / 100)
 *
 * Returns a rounded integer (no fractional IDR).
 */
export function calcIdrEstimate(
  priceJpy: number,
  jpyRate: number,
  feePct: number,
): number {
  const rawIdr = priceJpy * jpyRate * (1 + feePct / 100);
  // Ceiling to nearest 1,000 to avoid "angka keriting" (e.g. 12,345 -> 13,000)
  return ceilTo1000(rawIdr);
}

/**
 * Generates a unique order ID in the format KTM-XXXX, where XXXX is 4
 * alphanumeric characters (uppercase). Retries automatically if a collision
 * is detected in the database (very unlikely in practice).
 */
export async function generateOrderId(db: D1Database): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous charset
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = '';
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    for (const byte of randomBytes) {
      suffix += chars[byte % chars.length];
    }
    const candidate = `KTM-${suffix}`;
    const existing = await db
      .prepare(`SELECT id FROM orders WHERE id = ?1`)
      .bind(candidate)
      .first<{ id: string }>();
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback: use timestamp-based suffix
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `KTM-${ts}`;
}

/**
 * Reads all four canonical settings keys from the D1 `settings` table and
 * returns them as a typed object. Uses sane defaults if a key is missing.
 */
export async function getSettings(db: D1Database): Promise<Settings> {
  const rows = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN ('gate_status','jpy_to_idr_rate','global_fee_pct','telegram_link','product_categories','arrival_notification','bank_name','bank_account_number','bank_account_name','note_templates')`)
    .all<{ key: string; value: string }>();

  const map: Record<string, string> = {};
  for (const row of rows.results) {
    map[row.key] = row.value;
  }

  let product_categories: string[] = [...MASTER_CATEGORIES];
  if (map['product_categories']) {
    try {
      const parsed = JSON.parse(map['product_categories']);
      if (Array.isArray(parsed)) {
        product_categories = parsed;
      }
    } catch { /* use fallback */ }
  }

  let note_templates: string[] = [];
  if (map['note_templates']) {
    try {
      const parsed = JSON.parse(map['note_templates']);
      if (Array.isArray(parsed)) {
        note_templates = parsed;
      }
    } catch { /* use fallback */ }
  }

  return {
    gate_status: (map['gate_status'] ?? 'Closed') as 'Open' | 'Closed',
    jpy_to_idr_rate: parseFloat(map['jpy_to_idr_rate'] ?? '110'),
    global_fee_pct: parseFloat(map['global_fee_pct'] ?? '5'),
    telegram_link: map['telegram_link'] ?? '',
    product_categories,
    arrival_notification: map['arrival_notification'] ?? '',
    bank_name: map['bank_name'] ?? '',
    bank_account_number: map['bank_account_number'] ?? '',
    bank_account_name: map['bank_account_name'] ?? '',
    note_templates,
  };
}
