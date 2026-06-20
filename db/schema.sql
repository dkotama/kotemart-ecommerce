-- ============================================================
-- Kotemart Jastip Catalog — Database Schema
-- Version: v03 (whatsapp, bought price, custom fee)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  avatar_url       TEXT,
  role             TEXT NOT NULL DEFAULT 'buyer'
                     CHECK(role IN ('buyer', 'admin')),
  is_active        INTEGER NOT NULL DEFAULT 1
                     CHECK(is_active IN (0, 1)),
  whatsapp_number  TEXT,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images      TEXT NOT NULL DEFAULT '[]',
  is_deleted  INTEGER NOT NULL DEFAULT 0
                CHECK(is_deleted IN (0, 1)),
  notes       TEXT NOT NULL DEFAULT '[]',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_deleted);

CREATE TABLE IF NOT EXISTS product_variants (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name        TEXT NOT NULL,
  price_jpy           INTEGER NOT NULL CHECK(price_jpy >= 0),
  price_idr_estimate  INTEGER NOT NULL DEFAULT 0,
  product_url         TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
  images              TEXT NOT NULL DEFAULT '[]',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
  product_id          TEXT REFERENCES products(id),
  variant_id          TEXT REFERENCES product_variants(id),
  type                TEXT NOT NULL
                        CHECK(type IN ('catalog', 'custom')),
  name                TEXT NOT NULL,
  description         TEXT,
  reference_url       TEXT,
  qty                 INTEGER NOT NULL CHECK(qty >= 1),
  status              TEXT NOT NULL DEFAULT 'Draft'
                        CHECK(status IN ('Draft','Pending','Bought','Cancelled')),
  price_jpy           INTEGER,
  jpy_rate_snapshot   REAL NOT NULL,
  fee_pct_snapshot    REAL NOT NULL,
  price_idr_estimate  INTEGER,
  price_idr_final     INTEGER,
  manual_idr_override INTEGER,
  bought_price_jpy    INTEGER,
  custom_fee_idr      INTEGER,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_at        DATETIME,
  down_payment_idr    INTEGER,
  paid_amount_idr     INTEGER NOT NULL DEFAULT 0,
  settled_at          DATETIME,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_variant ON orders(variant_id);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);

CREATE TABLE IF NOT EXISTS api_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL DEFAULT 'AI Assistant',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  revoked_at   DATETIME
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);


