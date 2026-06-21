---
name: catalog-audit
description: Page for admin to easily audit links, update prices, and swap variant images directly
metadata:
  type: project
---

# Design Spec: Catalog Link & Price Audit Page

This document outlines the design for a new admin dashboard page that allows administrators to audit catalog items, click source links, inline-update variant JPY pricing and image URLs/uploads, and add new variants quickly without opening the full edit modal.

## 1. Requirements & Scope

- **Route:** `/admin/products/audit` (file: `src/pages/admin/products/audit.astro`).
- **Sidebar Integration:** "Audit Katalog" link under the "Master Data" group in `src/pages/admin/layout.astro`.
- **Layout & Structure:**
  - Main view lists products (Grouped style).
  - Search bar (by product name), Category dropdown, and "Audit Issue" filter ("Semua", "Tanpa Link", "Tanpa Gambar", "Ada Masalah").
  - Click product row to expand/collapse variant list below it.
- **Variant Actions:**
  - Update variant name, JPY price, and source product URL inline.
  - Paste image URL or upload image to R2 directly per variant.
  - Calculate dynamic IDR price estimates locally using current JPY rate and fee settings.
  - Save button per variant row (calls API PUT route).
  - Delete button per variant row (soft deletes).
  - "Add Variant" quick-form at the bottom of the variants sub-list to add new variants easily.

## 2. API & Data Flow

No new API endpoints are needed. The page will utilize existing endpoints:
- `GET /api/products` for initial listing/search if needed, or query directly from D1 during SSR.
- `PUT /api/products/:productId/variants/:variantId` for saving edits.
- `DELETE /api/products/:productId/variants/:variantId` for soft-deleting.
- `POST /api/products/:productId/variants` for adding new variants.
- `POST /api/products/upload-photo` for R2 image uploads.

### Database Query
SSR page will perform a grouped query of products:
```sql
SELECT p.*, COUNT(v.id) as total_variants,
       SUM(CASE WHEN v.product_url IS NULL OR v.product_url = '' THEN 1 ELSE 0 END) as missing_links,
       SUM(CASE WHEN v.images = '[]' OR v.images IS NULL OR v.images = '' THEN 1 ELSE 0 END) as missing_images
FROM products p
LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_deleted = 0
WHERE p.is_deleted = 0
GROUP BY p.id
ORDER BY p.created_at DESC
```

## 3. UI/UX Component Specifications

### Filter Bar
- Search Input: Real-time client-side filter of product name or product description.
- Category Filter: Dropdown showing categories from settings.
- Issue Filter dropdown:
  - **Semua**: Show all products.
  - **Tanpa Link**: Show products where at least one variant has no `product_url`.
  - **Tanpa Gambar**: Show products where at least one variant has no images.
  - **Ada Masalah**: Show products with either missing link or missing image.

### Products Table
- Columns:
  - Thumbnail (first image of first variant or product image).
  - Product Name (bold) & Description.
  - Category tag.
  - Variants count & Issue warning badges (e.g. "Tanpa Link" / "Tanpa Gambar").
  - Expand/Collapse Button (caret/chevron icon).

### Expanded Variants List (Sub-Row)
- Placed directly below the parent product row inside an accordion panel.
- Renders a table/list of variants:
  - **Image:** Variant image thumbnail, text input for Image URL (to edit/paste), and "Upload" button.
  - **Name:** Text input.
  - **URL:** Text input for product URL + small external link button to open the URL in a new tab.
  - **Price JPY:** Number input.
  - **Est. IDR:** Computed client-side text (using `Math.ceil(price_jpy * jpy_rate * (1 + fee_pct / 100) / 1000) * 1000`).
  - **Actions:**
    - "Simpan" (Row-level save: triggers PUT request, shows loading spinner, shows success checkmark).
    - "Hapus" (Row-level delete: soft-deletes variant after confirmation).
- **Quick Add Variant Row:**
  - Input fields for name, URL, price, and image.
  - "Tambah Varian" button. Calls POST API endpoint, then appends to list.

## 4. Testing Strategy

### E2E / Integration Tests
Add automated tests in `tests/e2e.spec.ts`:
- Verify navigation link works.
- Verify search and filtering filters product rows based on missing URLs/images.
- Verify expanding a product shows its variants.
- Verify changing a variant's JPY price, clicking "Simpan", and verifying the updated IDR price and DB state.
- Verify uploading an image and saving changes.
- Verify quick-adding a variant works.
- Verify soft-deleting a variant works.
