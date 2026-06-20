-- ============================================================
-- Kotemart Jastip — Migration v08
-- Adds notes to products
-- ============================================================

ALTER TABLE products ADD COLUMN notes TEXT NOT NULL DEFAULT '[]';
