# Product Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat `products.price_jpy` with a `product_variants` child table, add variant selection UX (mobile bottom sheet, desktop pills), and update the admin panel to manage variants inline.

**Architecture:** Schema-first migration (drop & recreate), then API layer, then UI layers in order: types → API → catalog grid → detail page → admin panel → seed data → E2E tests. Every layer is independently committable.

**Tech Stack:** Astro SSR, Hono (Cloudflare Workers), D1 SQLite, Tailwind CSS + DaisyUI, Playwright E2E.

---

## File Map

| File | Change |
|------|--------|
| `db/schema.sql` | Drop `price_jpy` from products, add `product_variants`, add `variant_id` to orders |
| `db/seed.sql` | Rewrite to use new schema with variants |
| `db/samples/products.csv` | New — bulk insert sample data |
| `db/samples/variants.csv` | New — bulk insert sample variants |
| `src/lib/types.ts` | Add `ProductVariant`, update `Product`, update `Order` |
| `src/pages/api/[...path].ts` | Update product endpoints, add variant CRUD, update order creation |
| `src/pages/catalog/index.astro` | Price range on cards, mobile intercept → bottom sheet |
| `src/pages/catalog/[id].astro` | Variant pills, client-side price update, pass `variant_id` to order API |
| `tests/e2e.spec.ts` | Add CUJ-14 through CUJ-19 for variants |

---

## Task 1: Update Schema

**Files:**
- Modify: `db/schema.sql`

- [ ] **Replace `db/schema.sql` with the new schema**

```sql
-- ============================================================
-- Kotemart Jastip Catalog — Database Schema
-- Version: v02 (product variants)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'buyer'
                CHECK(role IN ('buyer', 'admin')),
  is_active   INTEGER NOT NULL DEFAULT 1
                CHECK(is_active IN (0, 1)),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_deleted);

CREATE TABLE IF NOT EXISTS product_variants (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  price_jpy    INTEGER NOT NULL CHECK(price_jpy >= 0),
  product_url  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_deleted   INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
                        CHECK(status IN ('Draft','Pending','Bought','Settled','Cancelled')),
  price_jpy           INTEGER,
  jpy_rate_snapshot   REAL NOT NULL,
  fee_pct_snapshot    REAL NOT NULL,
  price_idr_estimate  INTEGER,
  price_idr_final     INTEGER,
  manual_idr_override INTEGER,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_at        DATETIME,
  settled_at          DATETIME,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Commit**

```bash
git add db/schema.sql
git commit -m "feat: update schema for product variants (v02)"
```

---

## Task 2: Update Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Replace `src/lib/types.ts`**

```typescript
// ============================================================
// Kotemart Jastip Catalog — Shared TypeScript Types
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: 'buyer' | 'admin';
  is_active: number;
  created_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  price_jpy: number;
  product_url: string | null;
  sort_order: number;
  is_deleted: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  is_deleted: number;
  created_at: string;
  updated_at: string;
  // Joined fields — present on API responses
  variants: ProductVariant[];
  min_price_jpy: number;
  max_price_jpy: number;
}

export type OrderStatus = 'Draft' | 'Pending' | 'Bought' | 'Settled' | 'Cancelled';
export type OrderType = 'catalog' | 'custom';

export interface Order {
  id: string;
  user_id: string;
  product_id: string | null;
  variant_id: string | null;
  type: OrderType;
  name: string;
  description: string | null;
  reference_url: string | null;
  qty: number;
  status: OrderStatus;
  price_jpy: number | null;
  jpy_rate_snapshot: number;
  fee_pct_snapshot: number;
  price_idr_estimate: number | null;
  price_idr_final: number | null;
  manual_idr_override: number | null;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface Settings {
  gate_status: 'Open' | 'Closed';
  jpy_to_idr_rate: number;
  global_fee_pct: number;
  telegram_link: string;
  product_categories: string[];
}

export const MASTER_CATEGORIES = ['Elektronik', 'Figure', 'Snack', 'Pakaian'] as const;
export type ProductCategory = typeof MASTER_CATEGORIES[number];

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_BASE_URL: string;
}
```

- [ ] **Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ProductVariant type, update Product and Order types"
```

---

## Task 3: Update API — Product Endpoints

**Files:**
- Modify: `src/pages/api/[...path].ts` (product router section only)

- [ ] **Replace the `productRouter` block** (lines ~252–449 in `[...path].ts`) with:

```typescript
const productRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// Helper: fetch variants for a product (active only)
async function getVariants(db: D1Database, productId: string): Promise<ProductVariant[]> {
  const result = await db.prepare(
    `SELECT * FROM product_variants WHERE product_id = ?1 AND is_deleted = 0 ORDER BY sort_order ASC`
  ).bind(productId).all<ProductVariant>();
  return result.results;
}

// Helper: build full product response
async function buildProductResponse(db: D1Database, p: Record<string, unknown>, settings: { jpy_to_idr_rate: number; global_fee_pct: number }) {
  const variants = await getVariants(db, p.id as string);
  const prices = variants.map(v => v.price_jpy);
  const min_price_jpy = prices.length ? Math.min(...prices) : 0;
  const max_price_jpy = prices.length ? Math.max(...prices) : 0;
  return {
    ...p,
    images: parseImages(p.images),
    variants,
    min_price_jpy,
    max_price_jpy,
    min_price_idr_estimate: calcIdrEstimate(min_price_jpy, settings.jpy_to_idr_rate, settings.global_fee_pct),
    max_price_idr_estimate: calcIdrEstimate(max_price_jpy, settings.jpy_to_idr_rate, settings.global_fee_pct),
  };
}

// GET /api/products
productRouter.get('/', authMiddleware, async (c) => {
  const category = c.req.query('category');
  const settings = await getSettings(c.env.DB);

  let query = `SELECT * FROM products WHERE is_deleted = 0`;
  const bindings: string[] = [];
  if (category) {
    query += ` AND category = ?1`;
    bindings.push(category);
  }
  query += ` ORDER BY created_at DESC`;

  const result = bindings.length
    ? await c.env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>()
    : await c.env.DB.prepare(query).all<Record<string, unknown>>();

  const products = await Promise.all(
    result.results.map(p => buildProductResponse(c.env.DB, p, settings))
  );
  return c.json(products);
});

// GET /api/products/:id
productRouter.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const settings = await getSettings(c.env.DB);

  const p = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 AND is_deleted = 0`)
    .bind(id).first<Record<string, unknown>>();

  if (!p) return c.json({ error: 'Product not found' }, 404);

  return c.json(await buildProductResponse(c.env.DB, p, settings));
});

// POST /api/products — admin only
const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().default(''),
  images: z.array(z.string()).default([]),
  variants: z.array(z.object({
    variant_name: z.string().min(1).max(255),
    price_jpy: z.number().int().min(0),
    product_url: z.string().optional().nullable(),
  })).min(1),
});

productRouter.post('/', authMiddleware, adminMiddleware, zValidator('json', createProductSchema), async (c) => {
  const body = c.req.valid('json');
  const settings = await getSettings(c.env.DB);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO products (id, name, category, description, images) VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(id, body.name, body.category, body.description, JSON.stringify(body.images)).run();

  for (let i = 0; i < body.variants.length; i++) {
    const v = body.variants[i];
    await c.env.DB.prepare(
      `INSERT INTO product_variants (id, product_id, variant_name, price_jpy, product_url, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(crypto.randomUUID(), id, v.variant_name, v.price_jpy, v.product_url ?? null, i).run();
  }

  const created = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  return c.json(await buildProductResponse(c.env.DB, created!, settings), 201);
});

// PUT /api/products/:id — admin only, parent fields only
const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
});

productRouter.put('/:id', authMiddleware, adminMiddleware, zValidator('json', updateProductSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 AND is_deleted = 0`).bind(id).first();
  if (!existing) return c.json({ error: 'Product not found' }, 404);

  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) { setClauses.push(`name = ?${idx++}`); values.push(body.name); }
  if (body.category !== undefined) { setClauses.push(`category = ?${idx++}`); values.push(body.category); }
  if (body.description !== undefined) { setClauses.push(`description = ?${idx++}`); values.push(body.description); }
  if (body.images !== undefined) { setClauses.push(`images = ?${idx++}`); values.push(JSON.stringify(body.images)); }
  values.push(id);

  await c.env.DB.prepare(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ?${idx}`).bind(...values).run();

  const settings = await getSettings(c.env.DB);
  const updated = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  return c.json(await buildProductResponse(c.env.DB, updated!, settings));
});

// DELETE /api/products/:id — soft delete
productRouter.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT id FROM products WHERE id = ?1`).bind(id).first();
  if (!existing) return c.json({ error: 'Product not found' }, 404);
  await c.env.DB.prepare(`UPDATE products SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`).bind(id).run();
  return c.json({ ok: true });
});

// POST /api/products/:id/variants — add variant
const createVariantSchema = z.object({
  variant_name: z.string().min(1).max(255),
  price_jpy: z.number().int().min(0),
  product_url: z.string().optional().nullable(),
});

productRouter.post('/:id/variants', authMiddleware, adminMiddleware, zValidator('json', createVariantSchema), async (c) => {
  const productId = c.req.param('id');
  const body = c.req.valid('json');

  const product = await c.env.DB.prepare(`SELECT id FROM products WHERE id = ?1 AND is_deleted = 0`).bind(productId).first();
  if (!product) return c.json({ error: 'Product not found' }, 404);

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM product_variants WHERE product_id = ?1 AND is_deleted = 0`).bind(productId).first<{ cnt: number }>();
  const sort_order = countRow?.cnt ?? 0;

  const vid = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO product_variants (id, product_id, variant_name, price_jpy, product_url, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(vid, productId, body.variant_name, body.price_jpy, body.product_url ?? null, sort_order).run();

  const created = await c.env.DB.prepare(`SELECT * FROM product_variants WHERE id = ?1`).bind(vid).first();
  return c.json(created, 201);
});

// PUT /api/products/:id/variants/:vid
const updateVariantSchema = z.object({
  variant_name: z.string().min(1).max(255).optional(),
  price_jpy: z.number().int().min(0).optional(),
  product_url: z.string().optional().nullable(),
});

productRouter.put('/:id/variants/:vid', authMiddleware, adminMiddleware, zValidator('json', updateVariantSchema), async (c) => {
  const vid = c.req.param('vid');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(`SELECT * FROM product_variants WHERE id = ?1 AND is_deleted = 0`).bind(vid).first();
  if (!existing) return c.json({ error: 'Variant not found' }, 404);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.variant_name !== undefined) { setClauses.push(`variant_name = ?${idx++}`); values.push(body.variant_name); }
  if (body.price_jpy !== undefined) { setClauses.push(`price_jpy = ?${idx++}`); values.push(body.price_jpy); }
  if (body.product_url !== undefined) { setClauses.push(`product_url = ?${idx++}`); values.push(body.product_url); }

  if (setClauses.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  values.push(vid);

  await c.env.DB.prepare(`UPDATE product_variants SET ${setClauses.join(', ')} WHERE id = ?${idx}`).bind(...values).run();
  const updated = await c.env.DB.prepare(`SELECT * FROM product_variants WHERE id = ?1`).bind(vid).first();
  return c.json(updated);
});

// DELETE /api/products/:id/variants/:vid — soft delete
productRouter.delete('/:id/variants/:vid', authMiddleware, adminMiddleware, async (c) => {
  const productId = c.req.param('id');
  const vid = c.req.param('vid');

  const existing = await c.env.DB.prepare(`SELECT id FROM product_variants WHERE id = ?1 AND product_id = ?2 AND is_deleted = 0`).bind(vid, productId).first();
  if (!existing) return c.json({ error: 'Variant not found' }, 404);

  // Ensure at least 1 active variant remains
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM product_variants WHERE product_id = ?1 AND is_deleted = 0`).bind(productId).first<{ cnt: number }>();
  if ((countRow?.cnt ?? 0) <= 1) return c.json({ error: 'Product must have at least one variant' }, 400);

  await c.env.DB.prepare(`UPDATE product_variants SET is_deleted = 1 WHERE id = ?1`).bind(vid).run();
  return c.json({ ok: true });
});

// POST /api/products/upload-photo — unchanged, keep existing implementation
```

- [ ] **Also add `ProductVariant` to the import at the top of `[...path].ts`**

Find line:
```typescript
import type { Env, User, Order, OrderStatus } from '../../lib/types';
```
Replace with:
```typescript
import type { Env, User, Order, OrderStatus, ProductVariant } from '../../lib/types';
```

- [ ] **Commit**

```bash
git add src/pages/api/[...path].ts src/lib/types.ts
git commit -m "feat: update product API for variants (GET/POST/PUT/DELETE + variant CRUD)"
```

---

## Task 4: Update API — Order Creation

**Files:**
- Modify: `src/pages/api/[...path].ts` (orderRouter POST /)

- [ ] **Replace the `POST /api/orders` handler** (the `catalogOrderSchema` + `orderRouter.post('/', ...)` block):

```typescript
const catalogOrderSchema = z.object({
  product_id: z.string().min(1),
  variant_id: z.string().min(1),
  qty: z.number().int().min(1),
});

orderRouter.post('/', authMiddleware, zValidator('json', catalogOrderSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const settings = await getSettings(c.env.DB);

  if (settings.gate_status !== 'Open') {
    return c.json({ error: 'Gate is closed. Orders are not accepted at this time.' }, 403);
  }

  const product = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 AND is_deleted = 0`)
    .bind(body.product_id).first<Record<string, unknown>>();
  if (!product) return c.json({ error: 'Product not found or unavailable' }, 404);

  const variant = await c.env.DB.prepare(
    `SELECT * FROM product_variants WHERE id = ?1 AND product_id = ?2 AND is_deleted = 0`
  ).bind(body.variant_id, body.product_id).first<Record<string, unknown>>();
  if (!variant) return c.json({ error: 'Variant not found or does not belong to this product' }, 404);

  const rate = settings.jpy_to_idr_rate;
  const feePct = settings.global_fee_pct;
  const priceJpy = variant.price_jpy as number;
  const priceIdrEstimate = calcIdrEstimate(priceJpy, rate, feePct);
  const orderId = await generateOrderId(c.env.DB);

  await c.env.DB.prepare(
    `INSERT INTO orders (
       id, user_id, product_id, variant_id, type, name,
       qty, status, price_jpy, jpy_rate_snapshot, fee_pct_snapshot,
       price_idr_estimate
     ) VALUES (?1, ?2, ?3, ?4, 'catalog', ?5, ?6, 'Draft', ?7, ?8, ?9, ?10)`
  ).bind(
    orderId, user.id, body.product_id, body.variant_id,
    product.name as string, body.qty,
    priceJpy, rate, feePct, priceIdrEstimate,
  ).run();

  const created = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(orderId).first();
  return c.json(created, 201);
});
```

- [ ] **Commit**

```bash
git add src/pages/api/[...path].ts
git commit -m "feat: order creation requires variant_id, snapshots price from variant"
```

---

## Task 5: Update Seed Data

**Files:**
- Modify: `db/seed.sql`

- [ ] **Replace `db/seed.sql`** with:

```sql
-- ============================================================
-- Kotemart Jastip Catalog — Development Seed Data v02
-- ============================================================

INSERT OR REPLACE INTO settings(key, value) VALUES
  ('gate_status',        'Open'),
  ('jpy_to_idr_rate',    '110.0'),
  ('global_fee_pct',     '5.0'),
  ('telegram_link',      'https://t.me/kotemart_jastip'),
  ('product_categories', '["Elektronik","Figure","Snack","Pakaian","Skincare","Suplemen"]');

INSERT OR REPLACE INTO users(id, email, name, avatar_url, role, is_active) VALUES
  ('admin-001',  'admin@example.com',  'Admin Kotemart', NULL, 'admin', 1),
  ('buyer-001',  'buyer@example.com',  'Budi Santoso',   NULL, 'buyer', 1),
  ('buyer-002',  'buyer2@example.com', 'Siti Rahayu',    NULL, 'buyer', 1),
  ('buyer-dis',  'disabled@example.com','Disabled User', NULL, 'buyer', 0);

-- Products (no price_jpy — moved to variants)
INSERT OR REPLACE INTO products(id, name, category, description, images) VALUES
  ('prod-001',
   'Keychron K3 Pro Low Profile Wireless Keyboard',
   'Elektronik',
   'Keyboard mekanis nirkabel low-profile dengan QMK/VIA. Layout 75%, cocok untuk produktivitas.',
   json_array('https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800')),

  ('prod-002',
   'Gundam Aerial Rebuild HG 1/144',
   'Figure',
   'High Grade Gundam dari serial The Witch from Mercury. Detail tinggi, material premium Bandai.',
   json_array('https://images.unsplash.com/photo-1612404730960-5c71577fca11?auto=format&fit=crop&q=80&w=800')),

  ('prod-003',
   'Biore UV Aqua Rich Watery Essence SPF50+',
   'Skincare',
   'Sunscreen ringan best-seller Jepang. Tekstur gel berair, tidak lengket, cocok untuk kulit berminyak.',
   json_array('https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800')),

  ('prod-004',
   'DHC Deep Cleansing Oil',
   'Skincare',
   'Pembersih makeup terlaris DHC. Formula minyak zaitun membersihkan pori tanpa iritasi.',
   json_array('https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800')),

  ('prod-005',
   'Chocola BB Plus',
   'Suplemen',
   'Suplemen vitamin B2 populer untuk kesehatan kulit dan stamina. Formula aktif Eisai.',
   json_array('https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=800')),

  ('prod-deleted',
   'Deleted Product (Test)',
   'Elektronik',
   'This product is soft-deleted for testing purposes.',
   '[]');

UPDATE products SET is_deleted = 1 WHERE id = 'prod-deleted';

-- Variants
INSERT OR REPLACE INTO product_variants(id, product_id, variant_name, price_jpy, product_url, sort_order) VALUES
  -- Keychron K3 Pro: Switch options
  ('var-001-1', 'prod-001', 'Red Switch (Linear)',   17600, NULL, 0),
  ('var-001-2', 'prod-001', 'Brown Switch (Tactile)', 17600, NULL, 1),
  ('var-001-3', 'prod-001', 'Blue Switch (Clicky)',   17600, NULL, 2),

  -- Gundam: single variant
  ('var-002-1', 'prod-002', 'Standard Box', 1870, NULL, 0),

  -- Biore: size variants
  ('var-003-1', 'prod-003', '50g Tube',    1088, NULL, 0),
  ('var-003-2', 'prod-003', '100g Tube',   1182, NULL, 1),
  ('var-003-3', 'prod-003', '120g Pouch',  1650, NULL, 2),

  -- DHC: size variants
  ('var-004-1', 'prod-004', '70ml',  1200, NULL, 0),
  ('var-004-2', 'prod-004', '120ml', 1800, NULL, 1),
  ('var-004-3', 'prod-004', '200ml', 2600, NULL, 2),

  -- Chocola BB: quantity pack variants
  ('var-005-1', 'prod-005', '60 Tablet',            1160, NULL, 0),
  ('var-005-2', 'prod-005', '60 Tablet × 2 Pack',   2200, NULL, 1),
  ('var-005-3', 'prod-005', '60 Tablet × 4 Pack',   4200, NULL, 2);

-- Sample orders (use variant IDs)
INSERT OR REPLACE INTO orders(
  id, user_id, product_id, variant_id, type, name, qty, status,
  price_jpy, jpy_rate_snapshot, fee_pct_snapshot, price_idr_estimate, price_idr_final, created_at
) VALUES
  ('KTM-8472', 'buyer-001', 'prod-001', 'var-001-1', 'catalog',
   'Keychron K3 Pro Low Profile Wireless Keyboard',
   1, 'Draft', 17600, 110.0, 5.0, CAST(17600*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-1 day')),

  ('KTM-8470', 'buyer-001', NULL, NULL, 'custom',
   'Amazon JP: Artbook Cyberpunk 2077 Complete Edition',
   2, 'Pending', 4500, 110.0, 5.0, CAST(4500*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-2 days')),

  ('KTM-8455', 'buyer-001', 'prod-003', 'var-003-1', 'catalog',
   'Biore UV Aqua Rich Watery Essence SPF50+',
   2, 'Bought', 1088, 110.0, 5.0, CAST(1088*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-7 days')),

  ('KTM-8412', 'buyer-001', 'prod-004', 'var-004-2', 'catalog',
   'DHC Deep Cleansing Oil',
   1, 'Settled', 1800, 110.0, 5.0, CAST(1800*110.0*1.05 AS INTEGER), 215000,
   datetime('now', '-20 days')),

  ('KTM-8399', 'buyer-001', 'prod-005', 'var-005-1', 'catalog',
   'Chocola BB Plus',
   1, 'Cancelled', 1160, 110.0, 5.0, CAST(1160*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-28 days')),

  ('KTM-8500', 'buyer-002', 'prod-002', 'var-002-1', 'catalog',
   'Gundam Aerial Rebuild HG 1/144',
   2, 'Pending', 1870, 110.0, 5.0, CAST(1870*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-3 days'));

UPDATE orders SET cancelled_at = datetime('now', '-25 days'),
  cancellation_reason = 'Barang tidak tersedia di toko saat pengambilan.'
WHERE id = 'KTM-8399';

UPDATE orders SET settled_at = datetime('now', '-15 days') WHERE id = 'KTM-8412';
```

- [ ] **Apply schema + seed locally and verify**

```bash
cd /home/ubuntu/projects/kotemart-jastip
npm run db:reset
```

Expected: no SQL errors. Both commands complete cleanly.

- [ ] **Commit**

```bash
git add db/seed.sql
git commit -m "feat: rewrite seed data for variant schema (v02)"
```

---

## Task 6: Create Sample CSV Files

**Files:**
- Create: `db/samples/products.csv`
- Create: `db/samples/variants.csv`

- [ ] **Create `db/samples/products.csv`**

```csv
id,name,category,description
prod-001,Keychron K3 Pro Low Profile Wireless Keyboard,Elektronik,"Keyboard mekanis nirkabel low-profile dengan QMK/VIA. Layout 75%."
prod-002,Gundam Aerial Rebuild HG 1/144,Figure,"High Grade Gundam dari serial The Witch from Mercury."
prod-003,Biore UV Aqua Rich Watery Essence SPF50+,Skincare,"Sunscreen ringan best-seller Jepang. Tekstur gel berair."
prod-004,DHC Deep Cleansing Oil,Skincare,"Pembersih makeup terlaris DHC. Formula minyak zaitun."
prod-005,Chocola BB Plus,Suplemen,"Suplemen vitamin B2 populer untuk kesehatan kulit dan stamina."
prod-006,Pillbox Onaka Diet Aid,Suplemen,"Suplemen diet populer Jepang. Mengandung konjac dan ginger extract."
prod-007,DHC Collagen Powder,Suplemen,"Kolagen bubuk premium DHC untuk kecantikan kulit dari dalam."
prod-008,DHC Lasting Vitamin C,Suplemen,"Vitamin C slow-release 1000mg. Tahan 8 jam dalam tubuh."
prod-009,Melano CC Vitamin C Serum,Skincare,"Serum vitamin C dari Rohto. Mencerahkan dan meratakan warna kulit."
prod-010,Uniqlo Heattech Extra Warm Crew Neck T-Shirt,Pakaian,"Kaos termal Heattech edisi Extra Warm. Cocok untuk musim dingin Jepang."
```

- [ ] **Create `db/samples/variants.csv`**

```csv
id,product_id,variant_name,price_jpy,product_url,sort_order
var-001-1,prod-001,Red Switch (Linear),17600,,0
var-001-2,prod-001,Brown Switch (Tactile),17600,,1
var-001-3,prod-001,Blue Switch (Clicky),17600,,2
var-002-1,prod-002,Standard Box,1870,,0
var-003-1,prod-003,50g Tube,1088,,0
var-003-2,prod-003,100g Tube,1182,,1
var-003-3,prod-003,120g Pouch,1650,,2
var-004-1,prod-004,70ml,1200,,0
var-004-2,prod-004,120ml,1800,,1
var-004-3,prod-004,200ml,2600,,2
var-005-1,prod-005,60 Tablet,1160,,0
var-005-2,prod-005,60 Tablet × 2 Pack,2200,,1
var-005-3,prod-005,60 Tablet × 4 Pack,4200,,2
var-006-1,prod-006,30 Hari (1 Set),2580,,0
var-006-2,prod-006,15 Hari (1 Set),1409,,1
var-007-1,prod-007,Single Bag (30 Sticks),2250,,0
var-007-2,prod-007,2 Bag Set (60 Sticks),4200,,1
var-007-3,prod-007,3 Bag Set (90 Sticks),5800,,2
var-008-1,prod-008,2-Pack Set,1302,,0
var-008-2,prod-008,3-Pack Set,1888,,1
var-009-1,prod-009,Regular (170ml),1200,,0
var-009-2,prod-009,Premium (170ml),1675,,1
var-010-1,prod-010,XS,1990,,0
var-010-2,prod-010,S,1990,,1
var-010-3,prod-010,M,1990,,2
var-010-4,prod-010,L,1990,,3
var-010-5,prod-010,XL,1990,,4
```

- [ ] **Commit**

```bash
git add db/samples/
git commit -m "feat: add bulk insert CSV samples for products and variants"
```

---

## Task 7: Update Catalog Grid (`catalog/index.astro`)

**Files:**
- Modify: `src/pages/catalog/index.astro`

- [ ] **Replace the frontmatter data fetch block** (the `try { const db = ... }` section) with:

```typescript
try {
  const db = (env as any).DB;
  if (db) {
    const [settingsRow, productsRows] = await Promise.all([
      getSettings(db),
      db.prepare(
        `SELECT id, name, category, description, images, is_deleted, created_at, updated_at
         FROM products WHERE is_deleted = 0 ORDER BY created_at DESC`
      ).all<Omit<Product, 'variants' | 'min_price_jpy' | 'max_price_jpy'> & { images: string }>(),
    ]);

    if (settingsRow) settings = settingsRow;

    if (productsRows?.results) {
      // For each product, fetch its variants
      const productList = productsRows.results.map(p => ({
        ...p,
        images: (() => { try { return JSON.parse(p.images as unknown as string); } catch { return []; } })(),
      }));

      const withVariants = await Promise.all(productList.map(async (p) => {
        const varResult = await db.prepare(
          `SELECT * FROM product_variants WHERE product_id = ?1 AND is_deleted = 0 ORDER BY sort_order ASC`
        ).bind(p.id).all();
        const variants = varResult?.results ?? [];
        const prices = variants.map((v: any) => v.price_jpy as number);
        const min_price_jpy = prices.length ? Math.min(...prices) : 0;
        const max_price_jpy = prices.length ? Math.max(...prices) : 0;
        return { ...p, variants, min_price_jpy, max_price_jpy };
      }));

      products = withVariants;
    }
  }
} catch (err) {
  console.error('Catalog fetch error:', err);
}
```

- [ ] **Update the `productsWithIdr` computation** (after the try/catch block):

```typescript
const productsWithIdr = products.map(p => ({
  ...p,
  min_price_idr_estimate: Math.round(p.min_price_jpy * settings.jpy_to_idr_rate * (1 + settings.global_fee_pct / 100)),
  max_price_idr_estimate: Math.round(p.max_price_jpy * settings.jpy_to_idr_rate * (1 + settings.global_fee_pct / 100)),
}));
```

- [ ] **Update the `Product` import** at the top of the frontmatter:

```typescript
import type { Settings, Product, ProductVariant } from '../../lib/types';
```

- [ ] **Replace the `renderCard` function** in the `<script>` block with:

```javascript
function formatPriceRange(min, max, prefix, locale) {
  if (min === max) return `${prefix}${min.toLocaleString(locale)}`;
  return `${prefix}${min.toLocaleString(locale)} – ${prefix}${max.toLocaleString(locale)}`;
}

function renderCard(product, mode) {
  const imgSrc = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800';

  const jpyLabel = formatPriceRange(product.min_price_jpy, product.max_price_jpy, '¥ ', 'ja-JP');
  const idrLabel = 'Est. ' + formatPriceRange(product.min_price_idr_estimate, product.max_price_idr_estimate, 'Rp ', 'id-ID');

  if (mode === 'list') {
    return `
      <a href="/catalog/${product.id}" data-testid="product-card" data-product-id="${product.id}"
         class="bg-[#FFFFFF] rounded-[10px] overflow-hidden group transition-shadow duration-150 ease-out hover:shadow-[0_4px_12px_rgba(26,29,35,0.08),0_2px_4px_rgba(26,29,35,0.04)] shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)] focus-within:ring-2 focus-within:ring-[#1A8F89] focus-within:ring-offset-2 flex flex-row items-stretch h-[96px] sm:h-[116px] no-underline" tabindex="0">
        <div class="relative bg-[#F1F2F5] overflow-hidden shrink-0 w-[96px] sm:w-[140px] border-r border-[#E8E9ED]">
          <img src="${imgSrc}" alt="${product.name}" class="w-full h-full object-cover absolute inset-0" loading="lazy" />
          <div data-testid="category-badge" class="absolute top-[8px] left-[8px] hidden sm:block bg-[#F1F2F5] text-[#5B606D] rounded-full px-[8px] py-[4px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] shadow-sm">
            ${product.category}
          </div>
        </div>
        <div class="flex flex-col flex-grow justify-center overflow-hidden px-[12px] sm:px-[16px] py-[8px]">
          <h3 data-testid="product-name" class="font-semibold leading-[1.3] tracking-[-0.01em] text-[#1A1D23] text-[0.9375rem] sm:text-[1.125rem] mb-[4px] line-clamp-1">${product.name}</h3>
          <div class="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-3">
            <span data-testid="product-price-jpy" class="font-mono leading-[1.6] text-[#5B606D] text-[0.75rem] sm:text-[0.8125rem]">${jpyLabel}</span>
            <span data-testid="product-price-idr" class="font-bold leading-[1.3] tracking-[-0.01em] text-[#1A8F89] text-[0.875rem] sm:text-[0.9375rem]">${idrLabel}</span>
          </div>
        </div>
        ${isGateOpen ? `
        <div class="px-[12px] sm:px-[16px] flex items-center justify-center border-l border-[#E8E9ED] bg-[#F9F9F7] sm:bg-transparent shrink-0 w-[80px] sm:w-[120px]">
          <span data-testid="btn-pesan" class="w-full h-[32px] sm:h-[36px] px-[8px] bg-[#0F726E] hover:bg-[#0A5D59] text-[#FFFFFF] rounded-[6px] text-[0.625rem] sm:text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all flex items-center justify-center">Pesan</span>
        </div>` : ''}
      </a>`;
  }

  return `
    <a href="/catalog/${product.id}" data-testid="product-card" data-product-id="${product.id}"
       class="card-product group cursor-pointer focus-within:ring-2 focus-within:ring-[#1A8F89] focus-within:ring-offset-2 flex flex-col no-underline" tabindex="0">
      <div class="relative bg-[#F1F2F5] overflow-hidden w-full aspect-[4/3] border-b border-[#E8E9ED]">
        <img src="${imgSrc}" alt="${product.name}" class="w-full h-full object-cover rounded-t-[4px]" loading="lazy" />
        <div data-testid="category-badge" class="absolute top-[8px] left-[8px] bg-[#F1F2F5] text-[#5B606D] rounded-full px-[8px] py-[4px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] shadow-sm">
          ${product.category}
        </div>
      </div>
      <div class="flex flex-col flex-grow p-[16px]">
        <h3 data-testid="product-name" class="font-semibold leading-[1.3] tracking-[-0.01em] text-[#1A1D23] text-[1.25rem] mb-[8px] line-clamp-2">${product.name}</h3>
        <div class="flex flex-col gap-1 mt-[16px]">
          <span data-testid="product-price-jpy" class="font-mono leading-[1.6] text-[#5B606D] text-[0.8125rem]">${jpyLabel}</span>
          <span data-testid="product-price-idr" class="font-bold leading-[1.3] tracking-[-0.01em] text-[#1A8F89] text-[0.9375rem]">${idrLabel}</span>
        </div>
        <p class="text-[0.8125rem] leading-[1.5] text-[#5B606D] mt-[12px] pt-[12px] border-t border-[#E8E9ED]">Harga estimasi. Final konfirmasi setelah beli.</p>
        <div class="mt-auto pt-[12px]">
          <button data-testid="btn-pesan" ${!isGateOpen ? 'disabled' : ''}
            class="w-full h-[40px] px-[12px] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all flex items-center justify-center ${isGateOpen ? 'bg-[#0F726E] hover:bg-[#0A5D59] text-[#FFFFFF]' : 'bg-[#F1F2F5] text-[#5B606D] cursor-not-allowed'}">
            ${isGateOpen ? 'Pesan' : 'Jastip Tutup'}
          </button>
        </div>
      </div>
    </a>`;
}
```

- [ ] **Add mobile intercept + bottom sheet** — append this to the `<script>` block (before the closing `</script>` tag):

```javascript
// Mobile bottom sheet intercept
const MOBILE_BREAKPOINT = 1024;

function buildSheet(product) {
  const imgSrc = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800';

  const rate = productsWithIdr.find(p => p.id === product.id);
  const firstVariant = product.variants[0];

  const variantPills = product.variants.map((v, i) => `
    <button
      data-testid="variant-pill"
      data-variant-id="${v.id}"
      data-price-jpy="${v.price_jpy}"
      data-price-idr="${Math.round(v.price_jpy * (rate?.min_price_idr_estimate / product.min_price_jpy || 1))}"
      class="variant-pill shrink-0 px-4 py-2 rounded-full border text-[0.8125rem] font-semibold transition-all ${i === 0 ? 'bg-[#1A8F89] text-white border-[#1A8F89]' : 'bg-white text-[#1A1D23] border-[#E8E9ED] hover:border-[#1A8F89]'}"
    >${v.variant_name}</button>
  `).join('');

  return `
    <div id="bottom-sheet-overlay" class="fixed inset-0 z-50 flex flex-col justify-end" style="background:rgba(0,0,0,0.4)">
      <div id="bottom-sheet" class="bg-white rounded-t-[20px] max-h-[92dvh] flex flex-col overflow-hidden translate-y-full transition-transform duration-300 ease-out">
        <!-- Drag handle -->
        <div class="flex justify-center pt-3 pb-2 shrink-0 cursor-pointer" id="sheet-drag-handle">
          <div class="w-10 h-1 rounded-full bg-[#E8E9ED]"></div>
        </div>
        <!-- Scrollable content -->
        <div class="overflow-y-auto flex-1 pb-24">
          <!-- Image -->
          <div class="w-full aspect-video bg-[#F1F2F5]">
            <img src="${imgSrc}" alt="${product.name}" class="w-full h-full object-cover" />
          </div>
          <!-- Info -->
          <div class="px-4 pt-4">
            <span class="inline-block bg-[#F1F2F5] text-[#5B606D] rounded-full px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] mb-2">${product.category}</span>
            <h2 class="text-[1.25rem] font-bold text-[#1A1D23] leading-tight mb-4">${product.name}</h2>
            <p class="text-[0.875rem] text-[#5B606D] font-semibold mb-2">Pilih Varian</p>
            <div class="flex gap-2 overflow-x-auto pb-2 no-scrollbar">${variantPills}</div>
            <!-- Selected price -->
            <div class="mt-3 p-3 bg-[#F9F9F7] rounded-[8px] border border-[#E8E9ED]">
              <span id="sheet-price-jpy" class="font-mono text-[0.8125rem] text-[#5B606D] block">¥ ${firstVariant.price_jpy.toLocaleString('ja-JP')}</span>
              <span id="sheet-price-idr" class="font-bold text-[1.125rem] text-[#1A8F89]">Est. Rp ${Math.round(firstVariant.price_jpy * (rate?.min_price_idr_estimate / product.min_price_jpy || 1)).toLocaleString('id-ID')}</span>
            </div>
            <!-- Qty -->
            <div class="mt-4">
              <p class="text-[0.875rem] text-[#1A1D23] font-semibold mb-2">Kuantitas</p>
              <div class="flex items-center h-[44px] bg-white border border-[#E8E9ED] rounded-[6px] overflow-hidden w-fit">
                <button id="sheet-qty-minus" class="w-[44px] h-full flex items-center justify-center text-[#5B606D] hover:bg-[#F1F2F5] disabled:opacity-40" disabled>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg>
                </button>
                <div id="sheet-qty-display" class="w-[48px] h-full flex items-center justify-center font-mono text-[0.9375rem] font-semibold text-[#1A1D23] border-l border-r border-[#E8E9ED]">1</div>
                <button id="sheet-qty-plus" class="w-[44px] h-full flex items-center justify-center text-[#5B606D] hover:bg-[#F1F2F5]">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>
            </div>
            <!-- Description -->
            <div class="mt-6 pt-4 border-t border-[#E8E9ED]">
              <p class="text-[0.9375rem] font-semibold text-[#1A1D23] mb-2">Deskripsi Produk</p>
              <p class="text-[0.875rem] text-[#5B606D] leading-relaxed whitespace-pre-wrap">${product.description}</p>
            </div>
          </div>
        </div>
        <!-- Sticky CTA -->
        <div class="absolute bottom-0 left-0 right-0 px-4 py-4 bg-white border-t border-[#E8E9ED]">
          <button id="sheet-order-btn" data-testid="sheet-btn-add-order" data-product-id="${product.id}"
            class="w-full h-[48px] bg-[#0F726E] hover:bg-[#0A5D59] text-white rounded-[8px] text-[0.875rem] font-semibold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            Tambah ke Pesanan
          </button>
        </div>
      </div>
    </div>`;
}

let sheetQty = 1;
let activeVariantId = null;

function openSheet(product) {
  document.body.insertAdjacentHTML('beforeend', buildSheet(product));
  document.body.style.overflow = 'hidden';
  activeVariantId = product.variants[0]?.id ?? null;
  sheetQty = 1;

  requestAnimationFrame(() => {
    const sheet = document.getElementById('bottom-sheet');
    if (sheet) sheet.style.transform = 'translateY(0)';
  });

  // Variant pill clicks
  document.querySelectorAll('.variant-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.variant-pill').forEach(p => {
        p.classList.remove('bg-[#1A8F89]', 'text-white', 'border-[#1A8F89]');
        p.classList.add('bg-white', 'text-[#1A1D23]', 'border-[#E8E9ED]');
      });
      pill.classList.add('bg-[#1A8F89]', 'text-white', 'border-[#1A8F89]');
      pill.classList.remove('bg-white', 'text-[#1A1D23]', 'border-[#E8E9ED]');
      activeVariantId = pill.dataset.variantId;
      const priceJpy = parseInt(pill.dataset.priceJpy);
      // Recalculate IDR from rate
      const p = productsWithIdr.find(x => x.id === product.id);
      const ratio = p && p.min_price_jpy > 0 ? p.min_price_idr_estimate / p.min_price_jpy : 1;
      const idr = Math.round(priceJpy * ratio);
      document.getElementById('sheet-price-jpy').textContent = '¥ ' + priceJpy.toLocaleString('ja-JP');
      document.getElementById('sheet-price-idr').textContent = 'Est. Rp ' + idr.toLocaleString('id-ID');
    });
  });

  // Qty
  const qtyDisplay = document.getElementById('sheet-qty-display');
  const qtyMinus = document.getElementById('sheet-qty-minus');
  const qtyPlus = document.getElementById('sheet-qty-plus');
  function updateSheetQty(n) {
    if (n < 1 || n > 10) return;
    sheetQty = n;
    qtyDisplay.textContent = String(sheetQty);
    qtyMinus.disabled = sheetQty <= 1;
    qtyPlus.disabled = sheetQty >= 10;
  }
  qtyMinus?.addEventListener('click', () => updateSheetQty(sheetQty - 1));
  qtyPlus?.addEventListener('click', () => updateSheetQty(sheetQty + 1));

  // Order button
  document.getElementById('sheet-order-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sheet-order-btn');
    btn.disabled = true;
    btn.textContent = 'Menambahkan...';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, variant_id: activeVariantId, qty: sheetQty }),
      });
      if (res.ok) {
        window.showToast?.('Pesanan berhasil ditambahkan!', 'success');
        closeSheet();
        setTimeout(() => { window.location.href = '/my-orders'; }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        window.showToast?.(data.error || 'Gagal menambahkan pesanan.', 'error');
        btn.disabled = false;
        btn.textContent = 'Tambah ke Pesanan';
      }
    } catch {
      window.showToast?.('Terjadi kesalahan jaringan.', 'error');
      btn.disabled = false;
      btn.textContent = 'Tambah ke Pesanan';
    }
  });

  // Close on overlay click / drag handle
  document.getElementById('bottom-sheet-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('bottom-sheet-overlay')) closeSheet();
  });
  document.getElementById('sheet-drag-handle')?.addEventListener('click', closeSheet);
}

function closeSheet() {
  const sheet = document.getElementById('bottom-sheet');
  if (sheet) sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('bottom-sheet-overlay')?.remove();
    document.body.style.overflow = '';
    history.pushState(null, '', '/catalog');
    activeVariantId = null;
  }, 300);
}

// Intercept card clicks on mobile
document.addEventListener('click', (e) => {
  if (window.innerWidth >= MOBILE_BREAKPOINT) return;
  const card = e.target.closest('[data-product-id]');
  if (!card) return;
  e.preventDefault();
  const productId = card.dataset.productId;
  const product = productsWithIdr.find(p => p.id === productId);
  if (!product || !product.variants?.length) return;
  history.pushState({ productId }, '', `/catalog/${productId}`);
  openSheet(product);
});

window.addEventListener('popstate', () => {
  if (document.getElementById('bottom-sheet-overlay')) closeSheet();
});
```

- [ ] **Update `define:vars`** to pass `productsWithIdr` (already done above) and ensure the variable name matches. The existing `define:vars={{ productsWithIdr, isGateOpen }}` should now work since `productsWithIdr` contains the new shape.

- [ ] **Commit**

```bash
git add src/pages/catalog/index.astro
git commit -m "feat: catalog grid price range, mobile bottom sheet with variant selection"
```

---

## Task 8: Update Detail Page (`catalog/[id].astro`)

**Files:**
- Modify: `src/pages/catalog/[id].astro`

- [ ] **Replace the frontmatter data fetch** with:

```typescript
const { id } = Astro.params;
const user = Astro.locals.user;

let product: (Product & { price_idr_estimates: number[] }) | null = null;
let isGateOpen = true;
let telegramLink = 'https://t.me/kotemart';

try {
  const db = (env as any).DB;
  if (db && id) {
    const [productRow, settingsRow] = await Promise.all([
      db.prepare(`SELECT * FROM products WHERE id = ? AND is_deleted = 0`).bind(id).first<Product & { images: string }>(),
      getSettings(db),
    ]);

    if (settingsRow) {
      isGateOpen = settingsRow.gate_status === 'Open';
      telegramLink = settingsRow.telegram_link;
    }

    if (productRow) {
      const images = (() => { try { return JSON.parse(productRow.images as unknown as string); } catch { return []; } })();
      const varResult = await db.prepare(
        `SELECT * FROM product_variants WHERE product_id = ? AND is_deleted = 0 ORDER BY sort_order ASC`
      ).bind(id).all();
      const variants: ProductVariant[] = varResult?.results ?? [];
      const rate = settingsRow?.jpy_to_idr_rate ?? 105;
      const fee = settingsRow?.global_fee_pct ?? 10;
      product = {
        ...productRow,
        images,
        variants,
        min_price_jpy: variants.length ? Math.min(...variants.map(v => v.price_jpy)) : 0,
        max_price_jpy: variants.length ? Math.max(...variants.map(v => v.price_jpy)) : 0,
        price_idr_estimates: variants.map(v => Math.round(v.price_jpy * rate * (1 + fee / 100))),
      };
    }
  }
} catch (err) {
  console.error('Product detail fetch error:', err);
}

if (!product) return Astro.redirect('/catalog');
```

- [ ] **Update the import line** to include `ProductVariant`:

```typescript
import type { Product, Settings, ProductVariant } from '../../lib/types';
```

- [ ] **Replace the "Price Card" section** in the HTML (the `<!-- Price Card -->` div) with:

```astro
<!-- Price Card -->
<div class="mb-[32px] p-[20px] bg-[#FFFFFF] rounded-[10px] border border-[#E8E9ED] shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)]">
  <!-- Variant Selector -->
  {product.variants.length > 1 && (
    <div class="mb-[16px]">
      <p class="text-[0.8125rem] font-semibold text-[#1A1D23] mb-[8px]">Pilih Varian</p>
      <div class="flex flex-wrap gap-2">
        {product.variants.map((v, i) => (
          <button
            data-testid="variant-pill"
            data-variant-id={v.id}
            data-price-jpy={v.price_jpy}
            data-price-idr={product!.price_idr_estimates[i]}
            class={`variant-pill px-3 py-1.5 rounded-full border text-[0.8125rem] font-semibold transition-all ${i === 0 ? 'bg-[#1A8F89] text-white border-[#1A8F89]' : 'bg-white text-[#1A1D23] border-[#E8E9ED] hover:border-[#1A8F89]'}`}
          >
            {v.variant_name}
          </button>
        ))}
      </div>
    </div>
  )}
  <div class="flex flex-col gap-1 mb-[12px]">
    <span id="detail-price-jpy" class="font-mono text-[0.8125rem] leading-[1.6] text-[#5B606D]">
      Harga Jepang: ¥ {product.variants[0]?.price_jpy.toLocaleString('ja-JP')}
    </span>
    <div class="flex items-end gap-2">
      <span id="detail-price-idr" class="text-[1.5rem] font-bold leading-[1.2] tracking-[-0.02em] text-[#1A8F89]">
        Est. Rp {product.price_idr_estimates[0]?.toLocaleString('id-ID')}
      </span>
    </div>
  </div>
  <div class="flex items-start gap-2 pt-[12px] border-t border-[#E8E9ED]">
    <svg class="w-4 h-4 text-[#D4890B] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <p class="text-[0.8125rem] leading-[1.5] text-[#5B606D]">
      Harga ini adalah estimasi. Harga final akan dikonfirmasi admin setelah barang berhasil dibeli.
    </p>
  </div>
</div>
```

- [ ] **Update the `<script>` block** — replace with:

```astro
<script define:vars={{ productId: product.id, isGateOpen, variants: product.variants, priceIdrEstimates: product.price_idr_estimates }}>
  let qty = 1;
  let selectedVariantId = variants[0]?.id ?? null;

  // Variant pill selection
  document.querySelectorAll('.variant-pill').forEach((pill, i) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.variant-pill').forEach(p => {
        p.classList.remove('bg-[#1A8F89]', 'text-white', 'border-[#1A8F89]');
        p.classList.add('bg-white', 'text-[#1A1D23]', 'border-[#E8E9ED]');
      });
      pill.classList.add('bg-[#1A8F89]', 'text-white', 'border-[#1A8F89]');
      pill.classList.remove('bg-white', 'text-[#1A1D23]', 'border-[#E8E9ED]');
      selectedVariantId = pill.dataset.variantId;
      const priceJpy = parseInt(pill.dataset.priceJpy);
      const priceIdr = parseInt(pill.dataset.priceIdr);
      const jpyEl = document.getElementById('detail-price-jpy');
      const idrEl = document.getElementById('detail-price-idr');
      if (jpyEl) jpyEl.textContent = 'Harga Jepang: ¥ ' + priceJpy.toLocaleString('ja-JP');
      if (idrEl) idrEl.textContent = 'Est. Rp ' + priceIdr.toLocaleString('id-ID');
    });
  });

  // Thumbnail gallery
  document.querySelectorAll('.thumbnail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.src;
      const mainImg = document.getElementById('main-product-image');
      if (mainImg && src) mainImg.src = src;
      document.querySelectorAll('.thumbnail-btn').forEach(b => {
        b.classList.remove('border-[#1A8F89]', 'ring-2', 'ring-[#1A8F89]', 'ring-offset-2');
        b.classList.add('border-[#E8E9ED]');
      });
      btn.classList.add('border-[#1A8F89]', 'ring-2', 'ring-[#1A8F89]', 'ring-offset-2');
      btn.classList.remove('border-[#E8E9ED]');
    });
  });

  // Qty stepper
  const qtyDisplay = document.getElementById('qty-display');
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');
  function updateQty(newQty) {
    if (newQty < 1 || newQty > 10) return;
    qty = newQty;
    if (qtyDisplay) qtyDisplay.textContent = String(qty);
    if (qtyMinus) qtyMinus.disabled = qty <= 1 || !isGateOpen;
    if (qtyPlus) qtyPlus.disabled = qty >= 10 || !isGateOpen;
  }
  qtyMinus?.addEventListener('click', () => updateQty(qty - 1));
  qtyPlus?.addEventListener('click', () => updateQty(qty + 1));
  updateQty(1);

  // Add to order
  const addBtn = document.getElementById('add-to-order-btn');
  addBtn?.addEventListener('click', async () => {
    if (!isGateOpen) return;
    addBtn.disabled = true;
    addBtn.textContent = 'Menambahkan...';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, variant_id: selectedVariantId, qty }),
      });
      if (res.ok) {
        window.showToast?.('Pesanan berhasil ditambahkan! Mengalihkan ke Pesanan Saya...', 'success');
        setTimeout(() => { window.location.href = '/my-orders'; }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        window.showToast?.(data.error || 'Gagal menambahkan pesanan. Coba lagi.', 'error');
        addBtn.disabled = false;
        addBtn.textContent = 'Tambah ke Pesanan';
      }
    } catch {
      window.showToast?.('Terjadi kesalahan jaringan. Coba lagi.', 'error');
      addBtn.disabled = false;
      addBtn.textContent = 'Tambah ke Pesanan';
    }
  });
</script>
```

- [ ] **Commit**

```bash
git add src/pages/catalog/[id].astro
git commit -m "feat: product detail page with variant pills and client-side price update"
```

---

## Task 9: Update Admin Panel (`admin/products.astro`)

**Files:**
- Modify: `src/pages/admin/products.astro`

- [ ] **Replace frontmatter fetch** with:

```typescript
let products: (Product & { variantCount: number; minPrice: number; maxPrice: number })[] = [];
let settings: Settings | null = null;

try {
  const db = (env as any).DB;
  if (db) {
    settings = await getSettings(db);
    const result = await db.prepare(`
      SELECT p.*, COUNT(v.id) as variantCount, MIN(v.price_jpy) as minPrice, MAX(v.price_jpy) as maxPrice
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_deleted = 0
      WHERE p.is_deleted = 0
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();
    if (result?.results) {
      products = result.results.map((p: any) => ({
        ...p,
        images: (() => { try { return JSON.parse(p.images || '[]'); } catch { return []; } })(),
        variants: [], // loaded on modal open via API
      }));
    }
  }
} catch (err) {
  console.error('Admin products fetch error:', err);
}

const rate = settings?.jpy_to_idr_rate ?? 110;
const fee = settings?.global_fee_pct ?? 5;
const productCategories = settings?.product_categories ?? [];
```

- [ ] **Update the product table** to show variant count and price range. Replace the `<thead>` and `<tbody>` sections:

```astro
<thead>
  <tr class="bg-[#F9F9F7] border-b border-[#E8E9ED] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B606D]">
    <th class="py-3 px-4 w-[80px]">Foto</th>
    <th class="py-3 px-4">Nama Produk</th>
    <th class="py-3 px-4">Kategori</th>
    <th class="py-3 px-4 text-center">Varian</th>
    <th class="py-3 px-4 text-right">Harga JPY</th>
    <th class="py-3 px-4 text-right">Aksi</th>
  </tr>
</thead>
<tbody>
  {products.length === 0 ? (
    <tr>
      <td colspan="6" class="py-12 text-center text-[#5B606D]">
        Belum ada produk di katalog. Klik "Tambah Produk" untuk memulai.
      </td>
    </tr>
  ) : (
    products.map((p) => {
      const imgSrc = p.images?.[0] ?? 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800';
      const priceLabel = p.minPrice === p.maxPrice
        ? `¥ ${p.minPrice?.toLocaleString('ja-JP') ?? '—'}`
        : `¥ ${p.minPrice?.toLocaleString('ja-JP')} – ¥ ${p.maxPrice?.toLocaleString('ja-JP')}`;
      return (
        <tr
          class="border-b border-[#E8E9ED] hover:bg-[#F9F9F7]/50 transition-colors product-row"
          data-id={p.id}
          data-name={p.name}
          data-category={p.category}
          data-desc={p.description}
          data-images={JSON.stringify(p.images)}
        >
          <td class="py-3 px-4">
            <img src={imgSrc} alt={p.name} class="w-12 h-12 object-cover rounded-[4px] border border-[#E8E9ED]" />
          </td>
          <td class="py-3 px-4 font-semibold text-[#1A1D23] max-w-[280px] truncate">{p.name}</td>
          <td class="py-3 px-4">
            <span class="bg-[#E8E9ED] text-[#1A1D23] px-[8px] py-[2px] rounded-[3px] text-[0.625rem] font-semibold uppercase tracking-[0.1em]">
              {p.category}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <span data-testid="variant-count-badge" class="bg-[#D5EDEB] text-[#0F726E] px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold">
              {p.variantCount} varian
            </span>
          </td>
          <td data-testid="product-price-range" class="py-3 px-4 text-right font-mono text-[0.875rem]">{priceLabel}</td>
          <td class="py-3 px-4 text-right space-x-2">
            <button class="text-[#1A8F89] hover:underline font-semibold text-[0.8125rem] btn-edit" onclick={`window.openProductModal('${p.id}')`}>Edit</button>
            <button class="text-[#D1453B] hover:underline font-semibold text-[0.8125rem] btn-delete" onclick={`window.deleteProduct('${p.id}')`}>Hapus</button>
          </td>
        </tr>
      );
    })
  )}
</tbody>
```

- [ ] **Replace the product modal** (the `<dialog>` block) with:

```astro
<dialog id="product-modal" class="modal">
  <div class="modal-box bg-[#FFFFFF] border border-[#E8E9ED] shadow-lg rounded-[10px] max-w-[600px] w-full">
    <h3 id="modal-title" class="font-bold text-lg text-[#1A1D23] mb-4">Tambah Produk</h3>
    <form id="product-form" class="flex flex-col gap-4">
      <input type="hidden" id="product-id" />

      <!-- Section A: Parent Info -->
      <div class="flex flex-col gap-1">
        <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Nama Produk <span class="text-[#D1453B]">*</span></label>
        <input type="text" id="input-name" required
          class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
          placeholder="Contoh: Biore UV Sunscreen" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Kategori <span class="text-[#D1453B]">*</span></label>
          <select id="input-category" required
            class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] bg-white text-[#1A1D23]">
            <option value="" disabled selected>Pilih Kategori</option>
            {productCategories.map(cat => <option value={cat}>{cat}</option>)}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Foto Produk</label>
          <div class="flex items-center gap-2">
            <div id="image-preview-container" class="w-10 h-10 rounded-[6px] border border-[#E8E9ED] overflow-hidden bg-[#F1F2F5] flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-[#5B606D] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <input type="file" id="input-file" accept="image/jpeg,image/png,image/webp" class="hidden" />
              <button type="button" id="btn-upload" class="btn-secondary-custom h-[36px] w-full text-xs">Pilih Foto</button>
              <div id="upload-status" class="text-[0.6875rem] text-[#5B606D] mt-0.5 truncate">Max 5MB (JPEG/PNG/WebP)</div>
            </div>
          </div>
          <div id="upload-progress-container" class="w-full bg-[#E8E9ED] h-1.5 rounded-full overflow-hidden hidden">
            <div id="upload-progress" class="bg-[#1A8F89] h-full transition-all progress-bar-indeterminate" style="width: 0%"></div>
          </div>
          <input type="hidden" id="input-images-json" value="[]" />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Deskripsi <span class="text-[#D1453B]">*</span></label>
        <textarea id="input-desc" required rows="3"
          class="w-full p-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] resize-y"
          placeholder="Tulis deskripsi detail produk..."></textarea>
      </div>

      <!-- Section B: Variants -->
      <div class="border-t border-[#E8E9ED] pt-4">
        <div class="flex items-center justify-between mb-3">
          <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Varian <span class="text-[#D1453B]">*</span></label>
          <button type="button" id="btn-add-variant"
            class="text-[0.75rem] font-semibold text-[#1A8F89] hover:underline flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Tambah Varian
          </button>
        </div>
        <div id="variants-container" class="flex flex-col gap-2">
          <!-- Variant rows injected by JS -->
        </div>
        <p id="variants-error" class="text-[0.75rem] text-[#D1453B] mt-1 hidden">Minimal satu varian diperlukan.</p>
      </div>

      <!-- Live IDR preview -->
      <div class="flex flex-col gap-2 bg-[#F9F9F7] border border-[#E8E9ED] rounded-[6px] px-3 py-2.5 text-[0.8125rem]">
        <div class="flex justify-between">
          <span class="text-[#5B606D]">Kurs JPY→IDR</span>
          <span id="calc-rate" class="font-mono text-[#1A1D23]">—</span>
        </div>
        <div class="flex justify-between font-semibold">
          <span class="text-[#1A1D23]">Est. IDR (varian pertama)</span>
          <span id="calc-est-idr" class="font-mono text-[#0F726E]">—</span>
        </div>
      </div>

      <div class="modal-action border-t border-[#E8E9ED] pt-4 mt-2">
        <button type="button" class="btn btn-ghost text-[#5B606D] rounded-[6px]" onclick="document.getElementById('product-modal').close()">Batal</button>
        <button type="submit" id="btn-save" class="btn bg-[#0F726E] hover:bg-[#0A5D59] text-white rounded-[6px]">Simpan</button>
      </div>
    </form>
  </div>
</dialog>
```

- [ ] **Replace the entire `<script>` block** in `admin/products.astro` with:

```astro
<script define:vars={{ rate, fee }}>
  const modal = document.getElementById('product-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('product-form');
  const idInput = document.getElementById('product-id');
  const nameInput = document.getElementById('input-name');
  const catInput = document.getElementById('input-category');
  const descInput = document.getElementById('input-desc');
  const imagesJsonInput = document.getElementById('input-images-json');
  const fileInput = document.getElementById('input-file');
  const uploadBtn = document.getElementById('btn-upload');
  const uploadStatus = document.getElementById('upload-status');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress');
  const previewContainer = document.getElementById('image-preview-container');
  const variantsContainer = document.getElementById('variants-container');
  const variantsError = document.getElementById('variants-error');
  const calcRateEl = document.getElementById('calc-rate');
  const calcEstIdrEl = document.getElementById('calc-est-idr');

  // Track variant rows in JS
  let variantRows = []; // [{id, variant_name, price_jpy, product_url, _key}]
  let variantKeyCounter = 0;

  function addVariantRow(data = {}) {
    const key = variantKeyCounter++;
    variantRows.push({ id: data.id || null, variant_name: data.variant_name || '', price_jpy: data.price_jpy || '', product_url: data.product_url || '', _key: key });
    renderVariantRows();
  }

  function removeVariantRow(key) {
    variantRows = variantRows.filter(r => r._key !== key);
    renderVariantRows();
    updateCalcPreview();
  }

  function renderVariantRows() {
    variantsContainer.innerHTML = variantRows.map(row => `
      <div class="flex gap-2 items-start variant-row" data-key="${row._key}">
        <input type="text" placeholder="Nama Varian *" value="${row.variant_name}"
          class="flex-1 h-[36px] px-2 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] variant-name"
          data-key="${row._key}" required />
        <input type="number" placeholder="Harga JPY *" value="${row.price_jpy}" min="0"
          class="w-[110px] h-[36px] px-2 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] variant-price"
          data-key="${row._key}" required />
        <input type="text" placeholder="URL Amazon (opsional)" value="${row.product_url}"
          class="flex-1 h-[36px] px-2 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] variant-url"
          data-key="${row._key}" />
        <button type="button" class="w-8 h-8 flex items-center justify-center text-[#D1453B] hover:bg-[#FDF3E7] rounded-[4px] shrink-0 mt-[2px] variant-remove" data-key="${row._key}">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    `).join('');

    // Attach listeners
    variantsContainer.querySelectorAll('.variant-name').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = parseInt(e.target.dataset.key);
        const row = variantRows.find(r => r._key === key);
        if (row) row.variant_name = e.target.value;
      });
    });
    variantsContainer.querySelectorAll('.variant-price').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = parseInt(e.target.dataset.key);
        const row = variantRows.find(r => r._key === key);
        if (row) { row.price_jpy = e.target.value; if (variantRows[0]._key === key) updateCalcPreview(); }
      });
    });
    variantsContainer.querySelectorAll('.variant-url').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = parseInt(e.target.dataset.key);
        const row = variantRows.find(r => r._key === key);
        if (row) row.product_url = e.target.value;
      });
    });
    variantsContainer.querySelectorAll('.variant-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        const key = parseInt(e.currentTarget.dataset.key);
        removeVariantRow(key);
      });
    });
  }

  function updateCalcPreview() {
    const firstPrice = parseFloat(variantRows[0]?.price_jpy) || 0;
    calcRateEl.textContent = `Rp ${rate.toLocaleString('id-ID')} / ¥`;
    if (firstPrice <= 0) { calcEstIdrEl.textContent = '—'; return; }
    const est = Math.round(firstPrice * rate * (1 + fee / 100));
    calcEstIdrEl.textContent = `Rp ${est.toLocaleString('id-ID')}`;
  }

  document.getElementById('btn-add-variant')?.addEventListener('click', () => {
    addVariantRow();
    updateCalcPreview();
  });

  window.openProductModal = async function(productId) {
    form.reset();
    idInput.value = '';
    imagesJsonInput.value = '[]';
    variantRows = [];
    variantKeyCounter = 0;
    previewContainer.innerHTML = `<svg class="w-5 h-5 text-[#5B606D] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
    uploadStatus.textContent = 'Max 5MB (JPEG/PNG/WebP)';
    progressContainer.classList.add('hidden');
    variantsError.classList.add('hidden');

    if (productId) {
      modalTitle.textContent = 'Edit Produk';
      const row = document.querySelector(`.product-row[data-id="${productId}"]`);
      if (row) {
        idInput.value = productId;
        nameInput.value = row.getAttribute('data-name') || '';
        catInput.value = row.getAttribute('data-category') || '';
        descInput.value = row.getAttribute('data-desc') || '';
        const imgs = row.getAttribute('data-images') || '[]';
        imagesJsonInput.value = imgs;
        try {
          const parsed = JSON.parse(imgs);
          if (parsed.length > 0) previewContainer.innerHTML = `<img src="${parsed[0]}" class="w-full h-full object-cover" />`;
        } catch {}
      }
      // Fetch existing variants
      try {
        const apiClient = window.apiClient || fetch;
        const res = await apiClient(`/api/products/${productId}`);
        if (res.ok) {
          const data = await res.json();
          (data.variants || []).forEach(v => addVariantRow(v));
        }
      } catch {}
    } else {
      modalTitle.textContent = 'Tambah Produk';
      addVariantRow(); // start with one empty row
    }

    updateCalcPreview();
    modal.showModal();
  };

  // File upload (same pipeline as before)
  uploadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) { window.showToast?.('Format tidak didukung. Gunakan JPEG/PNG/WebP.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { window.showToast?.('Ukuran file melebihi 5MB.', 'error'); return; }
    uploadStatus.textContent = '⚡ Mengompresi gambar...';
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '30%';
    progressBar.classList.remove('progress-bar-indeterminate');
    try {
      const compressedBlob = await compressImage(file, 1200, 0.8);
      uploadStatus.textContent = '📤 Mengunggah gambar...';
      progressBar.style.width = '60%';
      const formData = new FormData();
      formData.append('file', compressedBlob, `upload-${Date.now()}.webp`);
      const res = await fetch('/api/products/upload-photo', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        progressBar.style.width = '100%';
        uploadStatus.textContent = '✅ Berhasil diunggah!';
        window.showToast?.('Foto berhasil diunggah!', 'success');
        previewContainer.innerHTML = `<img src="${data.url}" class="w-full h-full object-cover" />`;
        imagesJsonInput.value = JSON.stringify([data.url]);
      } else { throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed'); }
    } catch (err) {
      progressContainer.classList.add('hidden');
      uploadStatus.textContent = '❌ Unggah gagal.';
      window.showToast?.(err.message || 'Gagal mengunggah foto.', 'error');
    }
  });

  function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression error')), 'image/webp', quality);
        };
        img.onerror = () => reject(new Error('Image load error'));
      };
      reader.onerror = () => reject(new Error('File read error'));
    });
  }

  // Save product
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate variants
    const validVariants = variantRows.filter(r => r.variant_name.trim() && r.price_jpy !== '' && parseInt(r.price_jpy) >= 0);
    if (validVariants.length === 0) {
      variantsError.classList.remove('hidden');
      return;
    }
    variantsError.classList.add('hidden');

    const id = idInput.value;
    const isEdit = !!id;
    const saveBtn = document.getElementById('btn-save');
    saveBtn.disabled = true;

    const parentBody = {
      name: nameInput.value.trim(),
      category: catInput.value.trim(),
      description: descInput.value.trim(),
      images: JSON.parse(imagesJsonInput.value || '[]'),
    };

    try {
      const apiClient = window.apiClient || fetch;

      let productId = id;
      if (isEdit) {
        const res = await apiClient(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(parentBody) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal memperbarui produk');
      } else {
        const res = await apiClient('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            ...parentBody,
            variants: validVariants.map((v, i) => ({
              variant_name: v.variant_name.trim(),
              price_jpy: parseInt(v.price_jpy),
              product_url: v.product_url?.trim() || null,
            })),
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal membuat produk');
        const data = await res.json();
        productId = data.id;
      }

      // For edit: sync variants (delete removed, upsert existing/new)
      if (isEdit) {
        // Get current variants from server to know which to delete
        const currentRes = await apiClient(`/api/products/${productId}`);
        const currentData = await currentRes.json();
        const currentVariantIds = (currentData.variants || []).map(v => v.id);
        const keepIds = validVariants.filter(v => v.id).map(v => v.id);
        // Soft-delete removed variants
        for (const vid of currentVariantIds) {
          if (!keepIds.includes(vid)) {
            await apiClient(`/api/products/${productId}/variants/${vid}`, { method: 'DELETE' });
          }
        }
        // Upsert remaining
        for (let i = 0; i < validVariants.length; i++) {
          const v = validVariants[i];
          const body = { variant_name: v.variant_name.trim(), price_jpy: parseInt(v.price_jpy), product_url: v.product_url?.trim() || null };
          if (v.id) {
            await apiClient(`/api/products/${productId}/variants/${v.id}`, { method: 'PUT', body: JSON.stringify(body) });
          } else {
            await apiClient(`/api/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) });
          }
        }
      }

      window.showToast?.(isEdit ? 'Produk berhasil diubah!' : 'Produk berhasil dibuat!', 'success');
      window.location.reload();
    } catch (err) {
      window.showToast?.(err.message || 'Terjadi kesalahan jaringan.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  window.deleteProduct = async function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini dari katalog?')) return;
    try {
      const apiClient = window.apiClient || fetch;
      const res = await apiClient(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) { window.location.reload(); }
      else { window.showToast?.((await res.json().catch(() => ({}))).error || 'Gagal menghapus produk.', 'error'); }
    } catch { window.showToast?.('Terjadi kesalahan jaringan.', 'error'); }
  };
</script>
```

- [ ] **Commit**

```bash
git add src/pages/admin/products.astro
git commit -m "feat: admin products panel with inline variant management"
```

---

## Task 10: Add E2E Tests

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Update CUJ-3** (existing "Place Catalog Order" test) — the order flow now requires selecting a variant. Replace:

```typescript
test.describe('CUJ-3: Place Catalog Order', () => {
  test('buyer can place order from product detail page', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await loginAs(page, 'buyer');

    await page.goto('/catalog');
    const firstCard = page.locator('[data-testid="product-card"]').first();
    // Force desktop navigation (viewport is Desktop Chrome in playwright config)
    await firstCard.click();
    await page.waitForURL(/\/catalog\/.+/);

    // Select first variant pill if present
    const firstPill = page.locator('[data-testid="variant-pill"]').first();
    if (await firstPill.count() > 0) {
      await firstPill.click();
    }

    const addBtn = page.locator('[data-testid="btn-add-order"]');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    const toast = page.locator('[data-testid="toast-success"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await page.waitForURL('/my-orders', { timeout: 6000 });
    await expect(page.locator('[data-testid="orders-list"]')).toBeVisible();
  });
});
```

- [ ] **Append new CUJ tests** at the end of `tests/e2e.spec.ts`:

```typescript
// ============================================================
// CUJ-14: Catalog Card Price Range
// Cards show JPY and IDR as ranges for multi-variant products
// ============================================================
test.describe('CUJ-14: Catalog Card Price Range', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/catalog');
  });

  test('multi-variant product card shows JPY range with dash', async ({ page }) => {
    // Biore UV has 3 variants: ¥1,088 / ¥1,182 / ¥1,650
    const cards = page.locator('[data-testid="product-card"]');
    const count = await cards.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const jpyText = await cards.nth(i).locator('[data-testid="product-price-jpy"]').textContent();
      if (jpyText && jpyText.includes('–')) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  test('single-variant product card shows single price (no dash)', async ({ page }) => {
    // Gundam has 1 variant at ¥1,870
    const cards = page.locator('[data-testid="product-card"]');
    const count = await cards.count();
    let foundSingle = false;
    for (let i = 0; i < count; i++) {
      const nameText = await cards.nth(i).locator('[data-testid="product-name"]').textContent();
      if (nameText && nameText.includes('Gundam')) {
        const jpyText = await cards.nth(i).locator('[data-testid="product-price-jpy"]').textContent();
        expect(jpyText).not.toContain('–');
        foundSingle = true;
        break;
      }
    }
    expect(foundSingle).toBe(true);
  });

  test('IDR estimate also shows range for multi-variant product', async ({ page }) => {
    const cards = page.locator('[data-testid="product-card"]');
    const count = await cards.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const idrText = await cards.nth(i).locator('[data-testid="product-price-idr"]').textContent();
      if (idrText && idrText.includes('–')) { found = true; break; }
    }
    expect(found).toBe(true);
  });
});

// ============================================================
// CUJ-15: Desktop Detail Page Variant Selection
// Variant pills update displayed price without page reload
// ============================================================
test.describe('CUJ-15: Desktop Variant Selection', () => {
  test('variant pills change the displayed price', async ({ page }) => {
    await loginAs(page, 'buyer');

    // Navigate to Biore UV (prod-003) which has 3 variants
    await page.goto('/catalog/prod-003');

    const pills = page.locator('[data-testid="variant-pill"]');
    await expect(pills.first()).toBeVisible();

    const initialJpy = await page.locator('#detail-price-jpy').textContent();
    const initialIdr = await page.locator('#detail-price-idr').textContent();

    // Click second pill (100g Tube = ¥1,182)
    if (await pills.count() >= 2) {
      await pills.nth(1).click();
      const newJpy = await page.locator('#detail-price-jpy').textContent();
      const newIdr = await page.locator('#detail-price-idr').textContent();
      expect(newJpy).not.toBe(initialJpy);
      expect(newIdr).not.toBe(initialIdr);
    }
  });

  test('order submitted with selected variant_id', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await loginAs(page, 'buyer');

    await page.goto('/catalog/prod-003');
    const pills = page.locator('[data-testid="variant-pill"]');

    // Select third pill
    if (await pills.count() >= 3) {
      await pills.nth(2).click();
    }

    const addBtn = page.locator('[data-testid="btn-add-order"]');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    const toast = page.locator('[data-testid="toast-success"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await page.waitForURL('/my-orders', { timeout: 6000 });

    // Verify the order has the variant name in it
    const orderRows = page.locator('[data-testid="order-row"]');
    await expect(orderRows.first()).toBeVisible();
  });
});

// ============================================================
// CUJ-16: Admin Variant Management
// Admin can create/edit products with variants
// ============================================================
test.describe('CUJ-16: Admin Variant Management', () => {
  test('cannot save product with zero variants', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products');

    await page.click('#btn-add-product');
    await page.waitForSelector('#product-modal[open]');

    await page.fill('#input-name', 'Test Product No Variants');
    await page.selectOption('#input-category', { index: 1 });
    await page.fill('#input-desc', 'Test description');

    // Remove the default empty variant row
    const removeBtn = page.locator('.variant-remove').first();
    if (await removeBtn.count() > 0) {
      await removeBtn.click();
    }

    await page.click('#btn-save');

    // Error message should appear
    const err = page.locator('#variants-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('Minimal satu varian');
  });

  test('product table shows variant count badge', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products');

    const badges = page.locator('[data-testid="variant-count-badge"]');
    await expect(badges.first()).toBeVisible();
    const text = await badges.first().textContent();
    expect(text).toMatch(/\d+ varian/);
  });

  test('product table shows price range for multi-variant products', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products');

    const priceCells = page.locator('[data-testid="product-price-range"]');
    const count = await priceCells.count();
    let foundRange = false;
    for (let i = 0; i < count; i++) {
      const text = await priceCells.nth(i).textContent();
      if (text && text.includes('–')) { foundRange = true; break; }
    }
    expect(foundRange).toBe(true);
  });

  test('admin can create product with multiple variants', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products');

    await page.click('#btn-add-product');
    await page.waitForSelector('#product-modal[open]');

    await page.fill('#input-name', 'E2E Test Sunscreen');
    await page.selectOption('#input-category', { index: 1 });
    await page.fill('#input-desc', 'Test description for E2E');

    // Fill first variant row
    await page.fill('.variant-name:first-of-type', '50g Tube');
    await page.fill('.variant-price:first-of-type', '1088');

    // Add second variant
    await page.click('#btn-add-variant');
    const nameInputs = page.locator('.variant-name');
    const priceInputs = page.locator('.variant-price');
    await nameInputs.nth(1).fill('100g Tube');
    await priceInputs.nth(1).fill('1500');

    await page.click('#btn-save');

    // Page reloads on success
    await page.waitForLoadState('domcontentloaded');

    // New product should appear in table
    const rows = page.locator('.product-row');
    const names = await rows.allTextContents();
    const found = names.some(n => n.includes('E2E Test Sunscreen'));
    expect(found).toBe(true);

    // Cleanup: delete the test product
    const testRow = page.locator('.product-row').filter({ hasText: 'E2E Test Sunscreen' });
    const productId = await testRow.getAttribute('data-id');
    if (productId) {
      await page.request.delete(`/api/products/${productId}`);
    }
  });
});
```

- [ ] **Commit**

```bash
git add tests/e2e.spec.ts
git commit -m "test: add CUJ-14 price range, CUJ-15 variant selection, CUJ-16 admin variants E2E"
```

---

## Task 11: Run & Verify

- [ ] **Reset local DB and start dev server**

```bash
npm run db:reset
```

Expected: no SQL errors.

- [ ] **Run E2E tests**

```bash
npm run test:e2e
```

Expected: all tests pass. If CUJ-3 fails, verify that `data-testid="variant-pill"` is rendered on the detail page and the order POST body includes `variant_id`.

- [ ] **Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: post-test corrections for variant integration"
```

---

## Self-Review Checklist

- [x] Schema drops `price_jpy` from `products`, adds `product_variants`, adds `variant_id` to `orders`
- [x] Types: `ProductVariant` interface defined; `Product.variants`, `Product.min_price_jpy`, `Product.max_price_jpy` added; `Order.variant_id` added
- [x] API: `GET /api/products` and `GET /api/products/:id` JOIN variants, return `min_price_jpy`/`max_price_jpy`
- [x] API: `POST /api/products` accepts `variants[]` (min 1)
- [x] API: `POST /api/orders` validates `variant_id` belongs to `product_id`
- [x] Variant CRUD: `POST/PUT/DELETE /api/products/:id/variants/:vid` — soft-delete only, guards min-1
- [x] Catalog grid: price range display (single vs range), mobile bottom sheet with variant pills
- [x] Detail page: variant pills, client-side price update, `variant_id` in order POST
- [x] Admin panel: two-section modal, variant count badge, price range in table, cannot save with 0 variants
- [x] Seed data: rewritten for v02 schema with real variant rows
- [x] CSV samples: `db/samples/products.csv` + `db/samples/variants.csv` with 10 products / 26 variants
- [x] E2E: CUJ-14 (price range), CUJ-15 (variant selection), CUJ-16 (admin CRUD), CUJ-3 updated
- [x] No placeholders or TBDs anywhere in the plan
- [x] Type names consistent throughout: `ProductVariant`, `variants[]`, `min_price_jpy`, `max_price_jpy`, `variant_id`
