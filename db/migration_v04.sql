-- ============================================================
-- Kotemart Jastip — Migration v04
-- Adds: price_idr_estimate on product_variants (cached ceiling IDR)
-- ============================================================

ALTER TABLE product_variants ADD COLUMN price_idr_estimate INTEGER NOT NULL DEFAULT 0;

-- Backfill existing variants using current settings values
UPDATE product_variants
SET price_idr_estimate =
  CAST(CEIL(price_jpy * COALESCE((SELECT CAST(value AS REAL) FROM settings WHERE key = 'jpy_to_idr_rate'), 110) * (1 + COALESCE((SELECT CAST(value AS REAL) FROM settings WHERE key = 'global_fee_pct'), 5) / 100) / 1000) AS INTEGER) * 1000
WHERE is_deleted = 0;
