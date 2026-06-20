-- ============================================================
-- Kotemart Jastip — Migration v05
-- Adds: down_payment_idr, paid_amount_idr on orders
-- Removes: Settled from orders status CHECK (flow now Draft->Pending->Bought)
--
-- SQLite cannot ALTER a CHECK constraint in place, so the orders table
-- is recreated: new table -> copy data -> drop old -> rename -> rebuild indexes.
-- ============================================================

ALTER TABLE orders ADD COLUMN down_payment_idr INTEGER;
ALTER TABLE orders ADD COLUMN paid_amount_idr INTEGER NOT NULL DEFAULT 0;

CREATE TABLE orders_new (
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
  down_payment_idr    INTEGER,
  paid_amount_idr     INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_at        DATETIME,
  settled_at          DATETIME,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders_new SELECT
  id, user_id, product_id, variant_id, type, name, description,
  reference_url, qty, status, price_jpy, jpy_rate_snapshot, fee_pct_snapshot,
  price_idr_estimate, price_idr_final, manual_idr_override,
  bought_price_jpy, custom_fee_idr,
  down_payment_idr, paid_amount_idr,
  notes, cancellation_reason, cancelled_at, settled_at, created_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_variant ON orders(variant_id);
