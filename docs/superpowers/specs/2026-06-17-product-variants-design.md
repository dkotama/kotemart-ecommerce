# Product Variant Enhancement — Design Spec
**Date:** 2026-06-17
**Status:** Approved

---

## Context

Scraped data shows products on Amazon Japan have multiple purchasable configurations (pack sizes, volumes, sets). The current flat `products` table treats each configuration as a separate row, causing catalog clutter, maintenance overhead, and poor UX. This spec introduces a parent-child variant model.

**Constraints:**
- Cloudflare Workers + D1 SQLite + R2 + Astro + Hono
- Primary audience is Indonesian buyers, primarily on mobile
- Existing product data will be dropped; catalog re-entered via new admin UI
- All products must have at least one variant — no optional variant fallback

---

## 1. Schema

### `products` (parent) — drop `price_jpy`
```sql
CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images      TEXT NOT NULL DEFAULT '[]',
  is_deleted  INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_deleted);
```

### `product_variants` (child) — new table
```sql
CREATE TABLE product_variants (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  price_jpy    INTEGER NOT NULL CHECK(price_jpy >= 0),
  product_url  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,  -- assigned as row index (0,1,2…) at save time
  is_deleted   INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
```

### `orders` — add `variant_id`
```sql
ALTER TABLE orders ADD COLUMN variant_id TEXT REFERENCES product_variants(id);
```

`product_id` stays on `orders` for human-readable admin context. `variant_id` is required for new catalog orders. `price_jpy` snapshot continues to be captured at order creation from the selected variant.

---

## 2. API

### Extended product response shape
Both list and detail endpoints return variants joined:

```json
{
  "id": "prod-001",
  "name": "Biore UV Sunscreen",
  "category": "Skincare",
  "description": "...",
  "images": ["https://..."],
  "min_price_jpy": 1088,
  "max_price_jpy": 1650,
  "variants": [
    { "id": "var-001", "variant_name": "50g Tube", "price_jpy": 1088, "product_url": "https://..." },
    { "id": "var-002", "variant_name": "100g Tube", "price_jpy": 1182, "product_url": "https://..." },
    { "id": "var-003", "variant_name": "120g Pouch", "price_jpy": 1650, "product_url": "https://..." }
  ]
}
```

`min_price_jpy` / `max_price_jpy` are derived from `MIN`/`MAX` of active variants — used for price range labels on catalog cards.

### Endpoint changes

| Method | Path | Change |
|--------|------|--------|
| `GET /api/products` | JOIN variants, return full shape above | modified |
| `GET /api/products/:id` | JOIN variants, return full shape above | modified |
| `POST /api/products` | body includes `variants[]` (min 1 required) | modified |
| `PUT /api/products/:id` | updates parent fields only | modified |
| `POST /api/products/:id/variants` | create a new variant | new |
| `PUT /api/products/:id/variants/:vid` | edit variant_name / price_jpy / product_url | new |
| `DELETE /api/products/:id/variants/:vid` | soft-delete variant (is_deleted=1) | new |
| `POST /api/orders` | body requires `variant_id`; validates it belongs to `product_id` | modified |

### Order creation logic
1. Validate `variant_id` belongs to `product_id` and `is_deleted = 0`
2. Read `price_jpy` from the variant row
3. Snapshot `price_jpy`, `jpy_rate_snapshot`, `fee_pct_snapshot` as before
4. Store `variant_id` on the order row

### Soft-delete constraint
Variants are soft-deleted (never hard-deleted) to preserve `price_jpy` legibility on historical orders.

---

## 3. Catalog Grid (`/catalog`)

### Card price display
- Single variant: `¥ 1,088` / `Est. Rp 125.000`
- Multiple variants: `¥ 1,088 – ¥ 1,650` / `Est. Rp 125.000 – Rp 190.000`
- Both JPY and IDR show ranges using `min_price_jpy` / `max_price_jpy`
- IDR range computed from `min_price_jpy` and `max_price_jpy` using `jpy_to_idr_rate * (1 + fee_pct/100)`

### Mobile intercept (client JS)
On card tap when `window.innerWidth < 1024`:
1. `event.preventDefault()`
2. Look up product from pre-loaded `productsWithIdr` array by id — no fetch needed
3. `history.pushState({ productId }, '', /catalog/:id)`
4. Render bottom sheet from in-memory data

`popstate` listener dismisses the sheet and restores `/catalog` URL when back is pressed.

### Data passed to client
`define:vars` block in `catalog/index.astro` passes `productsWithIdr` array. Each item now includes `variants[]`, `min_price_jpy`, `max_price_jpy`, and computed `min_price_idr_estimate` / `max_price_idr_estimate`. All data needed for the bottom sheet is available at page load — no secondary fetch required.

---

## 4. Mobile Bottom Sheet

Triggered on card tap when `window.innerWidth < 1024`. Covers full screen from bottom with drag-handle dismiss. Body scroll locked while open.

### Layout (top to bottom)
```
[ drag handle — centered bar ]
[ product image — 16:9 strip, swipeable if multiple images ]
[ category badge ]
[ product name — large, bold ]
[ divider ]
[ "Pilih Varian" label ]
[ variant pills — horizontal scroll if > 4 ]
  → selected pill shows: ¥ X,XXX  /  Est. Rp X,XXX,XXX below
[ divider ]
[ "Kuantitas" label ]
[ − ] [ qty ] [ + ]
[ sticky bottom CTA: "Tambah ke Pesanan" ]
[ divider ]
[ "Deskripsi Produk" — scrollable ]
```

### Variant selection
- Pills rendered from `variants[]` in fetch response
- First variant selected by default
- Tapping a pill updates the displayed price (JPY + IDR estimate) client-side — no re-fetch
- If gate is closed, CTA is disabled and shows "Jastip Ditutup"

### Animation
CSS `translate-y: 100%` → `translate-y: 0` on open, reversed on close. Transition: `300ms ease-out`.

### Direct link fallback (mobile)
If user arrives at `/catalog/[id]` directly on mobile (shared link), they get the SSR desktop layout rendered in a single-column stack — no bottom sheet. Full content is still accessible.

---

## 5. Desktop Detail Page (`/catalog/[id]`)

SSR page, two-column layout (image left, info right). All variant data loaded at SSR time — variant selection is pure client-side JS, no fetch on selection change.

### Right column layout
```
[ category badge ]
[ product name ]
[ "Pilih Varian:" label ]
[ variant pills — wrapping ]
[ price card: ¥ X,XXX  /  Est. Rp X,XXX,XXX ]  ← updates on pill tap
[ Kuantitas: − 1 + ]
[ Tambah ke Pesanan ]
[ divider ]
[ Deskripsi Produk ]
```

### Variant state
- SSR renders with first variant pre-selected
- Client JS listens to pill taps, updates price card in place
- Selected `variant_id` passed in POST body to `/api/orders`

---

## 6. Admin Panel (`/admin/products`)

### Product table changes
- "Harga JPY" column → shows `¥ min – ¥ max` (or single price if 1 variant)
- New "Varian" column → count badge e.g. `3 varian`

### Product modal — two sections

**Section A — Parent Info** (unchanged fields):
- Nama Produk (required)
- Kategori (required, dropdown from settings)
- Deskripsi (required)
- Foto Produk (R2 upload, same pipeline as today)

**Section B — Varian** (new):
- Inline table: columns Nama Varian / Harga JPY / URL Amazon / remove (✕)
- "+ Tambah Varian" button appends a new empty row
- At least 1 variant row required to enable Save
- `sort_order` assigned as row position index (0, 1, 2…) at save time — no manual drag/reorder in admin UI
- Live IDR preview recalculates from the first variant row's price

### Save logic
1. Validate: ≥1 variant row with name and price_jpy
2. `POST /api/products` with `{ ...parentFields, variants: [...] }` (create) or:
3. `PUT /api/products/:id` for parent fields, then batch variant upserts/deletes (edit)
4. Removed variant rows → `DELETE /api/products/:id/variants/:vid` (soft-delete)

### Delete product
Soft-delete parent (`is_deleted=1`). Variants cascade via `ON DELETE CASCADE` — but since we use soft-delete on parent, variants remain queryable for order history. When querying active products, filter `products.is_deleted = 0`.

---

## 7. TypeScript Types

```typescript
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
  // Joined from product_variants (present on API responses)
  variants?: ProductVariant[];
  min_price_jpy?: number;
  max_price_jpy?: number;
}

// Order gains variant_id
export interface Order {
  // ... existing fields ...
  variant_id: string | null;
}
```

---

## 8. E2E Test Coverage

New/updated CUJ tests:

| Test | Coverage |
|------|----------|
| Catalog card shows price range (min–max JPY and IDR) for multi-variant product | Catalog grid |
| Catalog card shows single price for single-variant product | Catalog grid |
| Mobile: tapping card opens bottom sheet (no navigation) | Bottom sheet |
| Bottom sheet: variant pill selection updates displayed price | Bottom sheet |
| Bottom sheet: "Tambah ke Pesanan" submits with correct variant_id | Bottom sheet |
| Bottom sheet: back button dismisses sheet, restores /catalog URL | Bottom sheet |
| Desktop: `/catalog/[id]` variant pill selection updates price card | Detail page |
| Desktop: order submitted with selected variant_id | Detail page |
| Admin: cannot save product with 0 variants | Admin panel |
| Admin: product table shows variant count badge and price range | Admin panel |
| Admin: add/edit/remove variants in modal, save persists correctly | Admin panel |

---

## 9. Sample Data

After spec approval, bulk insert CSV files will be provided for products and variants to seed the fresh D1 database via Wrangler.

---

## Out of Scope

- Variant-specific images (variants inherit parent images for now)
- Stock/inventory tracking per variant
- Price history or audit log
- Variant-level soft-delete visibility in admin (hidden by default)
