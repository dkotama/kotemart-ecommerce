-- ============================================================
-- Kotemart Jastip — Migration v07
-- Adds variant images and tag master + junction tables
-- ============================================================

-- Add images column to product variants
ALTER TABLE product_variants ADD COLUMN images TEXT NOT NULL DEFAULT '[]';

-- Master tags table
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for product tags mapping
CREATE TABLE IF NOT EXISTS product_tags (
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);
