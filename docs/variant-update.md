# Kotemart Jastip Catalog — Product Variant Enhancement Request
**Version:** v01
**Date:** 2026-06-17
**Context:** Scraping data shows multiple variants for products (e.g., different pack sizes, counts, volumes, sets).

---

## 1. Context Analysis & Findings
The scraped dataset (`catalog_20260617_175230.csv`) highlights that a single product often has multiple variations on Amazon Japan:
- **Pillbox Onaka:** 30-day supply (¥2,580) vs 15-day supply (¥1,409)
- **DHC Collagen:** Single bag (¥5,215), 2-bag set (¥2,250), 3-bag set (¥5,215), 4-bag set (¥5,215) *[Note: prices reflect scraping raw JPY variations]*
- **DHC Lasting Vitamin C:** 2-pack set (¥1,302) vs 3-pack set (¥1,888)
- **Chocola BB Plus 60 tablets:** Single (¥1,160), 2x pack (¥1,160), 4x pack (¥1,160)
- **Biore UV Sunscreen:** 50g tube (¥1,088), 100g tube (¥1,182), 120g pouch (¥1,650)
- **Melano CC:** Regular (¥1,200) vs Premium (¥1,675)

### Problem Statement
The current system architecture treats each variation as a **distinct product row** in the `products` table (e.g., `prod-008`, `prod-v101`, `prod-v102`). This leads to:
1. **Catalog clutter:** Buyers see multiple cards of the same product with slightly different pack sizes/quantities.
2. **Maintenance overhead:** Managing description/images changes across dozens of separate rows for the same basic product.
3. **Suboptimal UX:** Lack of a clean dropdown selector (e.g., "Pilih Ukuran/Set") on the product detail page.

---

## 2. Proposed System Upgrade: Product Variants Schema

### Schema Enhancement (D1 SQLite)
Introduce a parent-child relationship between a core product and its specific purchasable variants.

#### 1. Modify `products` Table (Parent)
Remove raw price/URL properties that vary per variant. Keep global info.
```sql
CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images      TEXT NOT NULL DEFAULT '[]', -- Default gallery
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Create `product_variants` Table (Child)
Store the specific configurations, prices, and external links.
```sql
CREATE TABLE product_variants (
  id              TEXT PRIMARY KEY, -- e.g., prod-v101
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name    TEXT NOT NULL,    -- e.g., "60 Hari (2 Set)", "120g Pouch"
  price_jpy       INTEGER NOT NULL CHECK(price_jpy >= 0),
  product_url     TEXT,             -- Link to specific Amazon variant page
  images          TEXT,             -- Variant-specific images (NULL to inherit parent)
  is_deleted      INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Update `orders` Table
Ensure orders tie directly to the specific variant selected.
```sql
ALTER TABLE orders ADD COLUMN variant_id TEXT REFERENCES product_variants(id);
```

---

## 3. UI/UX Handling Updates

### A. Catalog Grid Page
- Display only unique **Parent Products** in the main grid view.
- Under the price label, display the **starting price** (e.g., *"Mulai ¥ 1,088"*).

### B. Product Detail Page (`/catalog/[id]`)
- Render a dropdown or segmented pill component to select the variant:
  ```html
  <div class="form-control w-full max-w-xs">
    <label class="label"><span class="label-text">Pilih Ukuran / Varian:</span></label>
    <select class="select select-bordered" id="variant-select">
      <option value="prod-020" data-price="1088">50g Tube (¥ 1,088)</option>
      <option value="prod-v114" data-price="1182">100g Tube (¥ 1,182)</option>
      <option value="prod-v115" data-price="1650">120g Pouch (¥ 1,650)</option>
    </select>
  </div>
  ```
- Dynamic client-side price updates (both JPY and calculated IDR estimate based on the active rate + fee settings) when the variant selection changes.

### C. Admin Panel (`/admin/products`)
- Nested product editing form: Parent product info at top, with a dynamically addable/removable grid of variants below (name, price_jpy, product_url).

---

## 4. Temporary Data Alignment (Immediate Action)
Until the code changes are fully implemented, the scraped flat structures will be synced to D1 as distinct rows to maintain compatibility, but with descriptive suffix tags in the `name` column (e.g., *"DHC Collagen [60 Hari - 2 Set]"*) to prevent buyer confusion.
