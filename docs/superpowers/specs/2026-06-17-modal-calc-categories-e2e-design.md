# Design: Modal Live-Calc, Categories CRUD, E2E Coverage
**Date:** 2026-06-17
**Project:** Kotemart Jastip Catalog
**Scope:** Three coordinated changes — admin product modal pricing display, dynamic category management, and expanded E2E test coverage.

---

## 1. Modal Live-Calculation Fields

### What
Add three read-only computed rows to the admin product modal (in `src/pages/admin/products.astro`), displayed below the JPY Price input. They update live as the admin types in the JPY field.

### Rows
| Label | Value | Formula |
|---|---|---|
| Kurs | `¥1 = Rp {rate}` | Static — from settings, displayed as context |
| Fee IDR | `{fee_pct}% = Rp {fee_idr}` | `round(price_jpy × rate × fee_pct / 100)` |
| Est. IDR | `Rp {idr_estimate}` | `round(price_jpy × rate × (1 + fee_pct / 100))` |

### Implementation
- Settings values (`rate`, `fee_pct`) injected via Astro `define:vars` — no extra API call.
- Client-side `input` handler on `#input-price` recomputes and updates DOM on every keystroke.
- All three rows are `<div>` read-only displays, not `<input>` fields — no schema change.
- When modal opens for edit, values populate immediately from the existing JPY price.

### No backend change required.

---

## 2. Categories CRUD

### Storage
New key `product_categories` in the existing D1 `settings` table.
- Value: JSON array string, e.g. `'["Elektronik","Figure","Snack","Pakaian"]'`
- No new DB table or migration needed.

### Type changes (`src/lib/types.ts`)
- Add `product_categories: string[]` to the `Settings` interface.
- `MASTER_CATEGORIES` becomes a fallback constant only — used when the DB key is absent or empty.

### Pricing lib changes (`src/lib/pricing.ts`)
- `getSettings()` reads the `product_categories` key, parses JSON array, falls back to `MASTER_CATEGORIES`.
- Query extended: add `'product_categories'` to the `WHERE key IN (...)` clause.

### API changes (`src/pages/api/[...path].ts`)
- `GET /api/admin/settings` — already returns full settings object; no change needed once `getSettings()` is updated.
- `PUT /api/admin/settings` schema (`updateSettingsSchema`) — add `product_categories: z.array(z.string().min(1)).min(1).optional()`.
- `PUT /api/admin/settings` handler — if `product_categories` present, write JSON-stringified array to settings key.

### UI changes (`src/pages/admin/settings.astro`)
New "Kategori Produk" card added to the right column (below the Telegram card):

```
┌─────────────────────────────────┐
│ Kategori Produk                 │
│ Kelola kategori yang tersedia   │
│ di katalog dan filter produk.   │
│ ─────────────────────────────── │
│ [Elektronik ✕] [Figure ✕]      │
│ [Snack ✕] [Pakaian ✕]          │
│                                 │
│ [________________] [+ Tambah]   │
│                                 │
│ [    Simpan Kategori    ]       │
└─────────────────────────────────┘
```

- Tags rendered as pill chips with ✕ button (removes from local state only).
- "Tambah" button: validates non-empty, no duplicate (case-insensitive), appends chip.
- "Simpan Kategori" button: `PUT /api/admin/settings` with full `product_categories` array.
- Blocked if array would be empty (min 1 category enforced client-side).
- Success/error via `window.showToast`.

### Downstream consumption
Both pages read categories from SSR settings — no client-side fetch needed:
- `catalog/index.astro`: `const categories = ['Semua', ...settings.product_categories]` (replaces current `MASTER_CATEGORIES` spread)
- `admin/products.astro`: `{settings.product_categories.map(cat => <option value={cat}>{cat}</option>)}` (replaces current hardcoded options)

Both pages need `settings` fetched at SSR time — `catalog/index.astro` already does this; `admin/products.astro` already fetches settings too.

### Seed data
Add `product_categories` key to `db/seed.sql` so dev environment starts with populated categories.

---

## 3. E2E Coverage

All new tests appended to `tests/e2e.spec.ts`.

### New test groups

**CUJ-11: Admin Product CRUD**
- Admin can open "Tambah Produk" modal
- Admin can create a product with no image → 201, product appears in table
- Admin can create a product with a relative image URL (dev path) → 201 (validates the `.url()` fix)
- Admin can edit an existing product name → change persists in table
- Admin can delete a product → row removed from table

**CUJ-12: Modal Live Calculation**
- Admin opens product modal, enters JPY price → Fee IDR and Est. IDR displays update
- Values match formula: `round(price_jpy × rate × (1 + fee_pct/100))`

**CUJ-13: Categories CRUD**
- Admin adds new category "Aksesoris" → appears in filter pills on catalog page
- Admin adds new category → appears in product modal category dropdown
- Admin deletes a category → removed from filter pills and product modal dropdown after save
- Duplicate category rejected (inline validation, no API call)
- Empty category name rejected

---

## Constraints & Non-Goals
- No new DB table. Categories live in the existing `settings` key-value store.
- No real-time sync between tabs — categories refresh on next page load after save.
- Manual IDR override is order-level only (already on `orders.manual_idr_override`) — not added to product catalog.
- Product modal read-only calc rows are display only — no extra field persisted to DB.
