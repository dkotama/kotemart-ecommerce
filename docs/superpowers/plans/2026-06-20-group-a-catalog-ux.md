# Group A — Catalog & Ordering UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement responsive grid layout, card spacing adjustments, parent/variant multi-image galleries, normalized master tag system with filter dropdown and search integration, and fix the mobile/iPad order confirmation gate bug.

**Architecture:** Extend SQLite database with `product_variants.images` and `tags`/`product_tags` tables, update Hono API endpoints with validation, build custom image uploads and tag management in Astro-rendered admin UI, and align interactive JS scripts (detail page, bottom sheet, catalog page) to reflect media state and trigger WA/confirm gates.

**Tech Stack:** Astro 6, Hono, Cloudflare D1 (SQLite), Zod, Tailwind CSS, Playwright.

---

### Task 1: Database Migration & Schema Types

**Files:**
- Create: `db/migration_v07_catalog_media_tags.sql`
- Modify: `db/schema.sql` (append additions)
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create the SQL migration file**
Create `db/migration_v07_catalog_media_tags.sql` with the following content:
```sql
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
```

- [ ] **Step 2: Apply the migration to the local database**
Run: `npx wrangler d1 execute DB --local --file=db/migration_v07_catalog_media_tags.sql`
Expected output: Success messages showing table modifications and creation.

- [ ] **Step 3: Update `db/schema.sql`**
Append the same migration SQL commands (without `ALTER TABLE` if not needed, but since it's a seed reset, modify the existing `product_variants` table declaration to include `images TEXT NOT NULL DEFAULT '[]'`, and append the `tags` and `product_tags` table definitions at the bottom).
Verify that running `npm run db:reset` succeeds.

- [ ] **Step 4: Update TypeScript Types**
Edit `src/lib/types.ts` to include `images` on `ProductVariant` and `tags` on `Product`:
```typescript
// Replace lines 23-33 in src/lib/types.ts
export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  price_jpy: number;
  product_url: string | null;
  sort_order: number;
  is_deleted: number;
  created_at: string;
  price_idr_estimate?: number;
  images?: string[]; // Added
}

// Replace lines 35-48 in src/lib/types.ts
export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  is_deleted: number;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
  min_price_jpy: number;
  max_price_jpy: number;
  tags?: { id: string; name: string }[]; // Added
}
```

- [ ] **Step 5: Commit**
```bash
git add db/migration_v07_catalog_media_tags.sql db/schema.sql src/lib/types.ts
git commit -m "db: add schema migration v07 for tags and variant images"
```

---

### Task 2: Responsive Grid & Card Spacing Fixes

**Files:**
- Modify: `src/pages/catalog/index.astro`

- [ ] **Step 1: Modify layout grid column utility classes**
Find `#product-grid` grid template definitions in `src/pages/catalog/index.astro`:
Line 248:
```html
<div id="product-grid" class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-[12px] sm:gap-[24px]">
```
Replace with:
```html
<div id="product-grid" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-[12px] sm:gap-[24px]">
```
And inside the `<script define:vars>` render logic at line 412:
```javascript
grid.className = 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-[12px] sm:gap-[24px]';
```
Replace with:
```javascript
grid.className = 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-[12px] sm:gap-[24px]';
```

- [ ] **Step 2: Fix card divider spacing**
Locate the disclaimer paragraph inside `renderCard(product, mode)` in `src/pages/catalog/index.astro` at line 377:
```javascript
<p class="text-[0.75rem] sm:text-[0.8125rem] leading-[1.5] text-[#5B606D] mt-auto pt-[8px] sm:pt-[12px] border-t border-[#E8E9ED]">Harga estimasi. Final konfirmasi setelah beli.</p>
```
Replace with:
```javascript
<p class="text-[0.75rem] sm:text-[0.8125rem] leading-[1.5] text-[#5B606D] mt-auto pt-[8px] sm:pt-[12px] mt-[16px] sm:mt-[24px] border-t border-[#E8E9ED]">Harga estimasi. Final konfirmasi setelah beli.</p>
```

- [ ] **Step 3: Run dev server to verify visually**
Run `npm run dev` and open in browser. Check grid at mobile, tablet (iPad), and wide desktop viewport sizes. Verify that the divider line is further away from the price tags.

- [ ] **Step 4: Commit**
```bash
git add src/pages/catalog/index.astro
git commit -m "style: update grid columns to 2/4/5 and add card divider spacing"
```

---

### Task 3: API Endpoints for Tags & Variant Images

**Files:**
- Modify: `src/pages/api/[...path].ts`

- [ ] **Step 1: Add Tag Hono Router and Endpoints**
In `src/pages/api/[...path].ts`, add the tag router endpoints and validation:
```typescript
const tagRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// GET /api/tags
tagRouter.get('/', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare(`SELECT * FROM tags ORDER BY name ASC`).all();
  return c.json(result.results || []);
});

// POST /api/admin/tags (admin only, create/rename tag)
const tagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50),
});
adminRouter.post('/tags', zValidator('json', tagSchema), async (c) => {
  const body = c.req.valid('json');
  const id = body.id || crypto.randomUUID();
  
  await c.env.DB.prepare(
    `INSERT INTO tags (id, name) VALUES (?1, ?2)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name
     ON CONFLICT(name) DO UPDATE SET id = id`
  ).bind(id, body.name).run();
  
  const created = await c.env.DB.prepare(`SELECT * FROM tags WHERE id = ?1 OR name = ?2`).bind(id, body.name).first();
  return c.json(created);
});

// DELETE /api/admin/tags/:id (admin only, delete tag and cascaded junction mappings)
adminRouter.delete('/tags/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM tags WHERE id = ?1`).bind(id).run();
  return c.json({ ok: true });
});
```
Make sure to mount `tagRouter`:
```typescript
app.route('/tags', tagRouter);
```

- [ ] **Step 2: Update Product Responses to include Tags & Variant Images**
Update `buildProductResponse` in `src/pages/api/[...path].ts`:
```typescript
async function getVariants(db: D1Database, productId: string): Promise<ProductVariant[]> {
  const result = await db.prepare(
    `SELECT * FROM product_variants WHERE product_id = ?1 AND is_deleted = 0 ORDER BY sort_order ASC`
  ).bind(productId).all<Record<string, unknown>>();
  
  return (result.results || []).map(v => ({
    ...v,
    images: parseImages(v.images),
  })) as unknown as ProductVariant[];
}

async function getProductTags(db: D1Database, productId: string) {
  const result = await db.prepare(
    `SELECT t.id, t.name FROM tags t
     JOIN product_tags pt ON pt.tag_id = t.id
     WHERE pt.product_id = ?1`
  ).bind(productId).all();
  return result.results || [];
}

async function buildProductResponse(db: D1Database, p: Record<string, unknown>) {
  const [variants, tags] = await Promise.all([
    getVariants(db, p.id as string),
    getProductTags(db, p.id as string),
  ]);
  const prices = variants.map(v => v.price_jpy);
  const idrEstimates = variants.map(v => v.price_idr_estimate ?? 0);
  const min_price_jpy = prices.length ? Math.min(...prices) : 0;
  const max_price_jpy = prices.length ? Math.max(...prices) : 0;
  const min_price_idr_estimate = idrEstimates.length ? Math.min(...idrEstimates) : 0;
  const max_price_idr_estimate = idrEstimates.length ? Math.max(...idrEstimates) : 0;
  return {
    ...p,
    images: parseImages(p.images),
    variants,
    tags,
    min_price_jpy,
    max_price_jpy,
    min_price_idr_estimate,
    max_price_idr_estimate,
  };
}
```

- [ ] **Step 3: Handle Variant Images and Product Tags during POST / PUT**
Update `createProductSchema` and `updateProductSchema` to support tags, and support variant `images` array on creation and updating.
In `POST /api/products`:
Accept `tag_ids` as `z.array(z.string()).optional()`.
```typescript
const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().default(''),
  images: z.array(z.string()).default([]),
  tag_ids: z.array(z.string()).optional().default([]), // Added
  variants: z.array(z.object({
    variant_name: z.string().min(1).max(255),
    price_jpy: z.number().int().min(0),
    product_url: z.string().optional().nullable(),
    images: z.array(z.string()).optional().default([]), // Added
  })).min(1),
});
```
Update implementation to link tags and insert variant images:
```typescript
  // Inside productRouter.post handler...
  for (let i = 0; i < body.variants.length; i++) {
    const v = body.variants[i];
    const priceIdrEstimate = calcIdrEstimate(v.price_jpy, settings.jpy_to_idr_rate, settings.global_fee_pct);
    await c.env.DB.prepare(
      `INSERT INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order, images) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(crypto.randomUUID(), id, v.variant_name, v.price_jpy, priceIdrEstimate, v.product_url ?? null, i, JSON.stringify(v.images ?? [])).run();
  }

  // Link tags
  if (body.tag_ids && body.tag_ids.length > 0) {
    for (const tagId of body.tag_ids) {
      await c.env.DB.prepare(`INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES (?1, ?2)`)
        .bind(id, tagId).run();
    }
  }
```

Update `PUT /api/products/:id` to support `tag_ids`:
```typescript
const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  tag_ids: z.array(z.string()).optional(), // Added
});
```
Inside `PUT /api/products/:id` handler, update linked tags:
```typescript
  if (body.tag_ids !== undefined) {
    // Delete existing product tags and insert new ones
    await c.env.DB.prepare(`DELETE FROM product_tags WHERE product_id = ?1`).bind(id).run();
    for (const tagId of body.tag_ids) {
      await c.env.DB.prepare(`INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES (?1, ?2)`)
        .bind(id, tagId).run();
    }
  }
```

Update Variant schemas:
```typescript
const createVariantSchema = z.object({
  variant_name: z.string().min(1).max(255),
  price_jpy: z.number().int().min(0),
  product_url: z.string().optional().nullable(),
  images: z.array(z.string()).optional().default([]), // Added
});

const updateVariantSchema = z.object({
  variant_name: z.string().min(1).max(255).optional(),
  price_jpy: z.number().int().min(0).optional(),
  product_url: z.string().optional().nullable(),
  images: z.array(z.string()).optional(), // Added
});
```
Update variant create/update database query binds to pass `images` JSON string.

- [ ] **Step 4: Run manual endpoint checks**
Run API tests using curl/postman or run E2E suites to confirm compilation and existing endpoint functionality.

- [ ] **Step 5: Commit**
```bash
git add src/pages/api/\[...path\].ts
git commit -m "api: update products and variants CRUD endpoints with tags and image arrays"
```

---

### Task 4: Admin Product Modal Gallery & Variant Media Pickers

**Files:**
- Modify: `src/pages/admin/products.astro`

- [ ] **Step 1: Replace parent single uploader with a gallery**
Modify uploader HTML and script. Instead of replacing `images[]` with a single entry, allow multiple appends. Show previews for each image with a delete button.
Modify `#image-preview-container` to render a wrapper where we map and show thumbnail tiles with × buttons.
Update `fileInput` event listener to push the uploaded URL:
```javascript
// Append instead of overwrite:
const existingImgs = JSON.parse(imagesJsonInput.value || '[]');
existingImgs.push(data.url);
imagesJsonInput.value = JSON.stringify(existingImgs);
renderParentImages();
```

- [ ] **Step 2: Implement tag input chips in admin modal**
Add a "Tag Produk" field to the product form inside the modal:
```html
<div class="flex flex-col gap-1">
  <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Tags</label>
  <div id="product-tags-container" class="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border border-[#E8E9ED] rounded-[6px] bg-white items-center">
    <input type="text" id="input-tag" placeholder="Type tag & Enter..." class="border-0 focus:ring-0 p-0 text-[0.8125rem] outline-none ml-1 flex-1 min-w-[100px]" />
  </div>
  <input type="hidden" id="input-tags-json" value="[]" />
</div>
```
Add JS logic in `openProductModal` to fetch `/api/tags`, populate suggestions (using a `<datalist>`), handle tag additions on Enter, render them as chips with remove actions, and serialize their IDs into `input-tags-json`. If a tag isn't in the fetched master list, call `POST /api/admin/tags` to create it on-the-fly and bind it.

- [ ] **Step 3: Add Variant Image Picker**
Extend `renderVariantRows()`: Add an image preview and upload trigger button per variant. Add an input type="file" dynamically or map to a single file uploader that receives `variantKey` metadata.
```javascript
// Inside the mapped variant row string:
const variantImgs = row.images || [];
const vImgSrc = variantImgs[0] || '';
const previewContent = vImgSrc ? `<img src="${vImgSrc}" class="w-full h-full object-cover" />` : '<svg class="w-4 h-4 opacity-40"...></svg>';
`
<div class="flex items-center gap-1.5 shrink-0">
  <div class="w-8 h-8 rounded border bg-[#F1F2F5] overflow-hidden flex items-center justify-center shrink-0 variant-img-preview" data-key="${row._key}">
    ${previewContent}
  </div>
  <button type="button" class="btn btn-xs btn-outline btn-variant-upload" data-key="${row._key}">Foto</button>
</div>
`
```
Hook events to handle image compression and uploading, updating the variant row state `images` array with the R2 URL.

- [ ] **Step 4: Run manual modal verification**
Open products modal, test uploading multiple parent images, adding tags, uploading variant images, and saving the product. Verify data is persisted in local D1 db.

- [ ] **Step 5: Commit**
```bash
git add src/pages/admin/products.astro
git commit -m "admin: support multi-image uploads, tag chips, and variant images in product modal"
```

---

### Task 5: Master Tag Management Page

**Files:**
- Create: `src/pages/admin/master/tags.astro`
- Modify: `src/pages/admin/layout.astro`

- [ ] **Step 1: Create tags management page**
Create `src/pages/admin/master/tags.astro` (using AdminLayout and rendering a table of tags with edit name / delete actions, and a "Tambah Tag" header/form).
```astro
---
export const prerender = false;
import AdminLayout from '../layout.astro';
import { env } from 'cloudflare:workers';

const user = Astro.locals.user;
let tags: { id: string; name: string; created_at: string }[] = [];

try {
  const db = (env as any).DB;
  if (db) {
    const result = await db.prepare(`SELECT * FROM tags ORDER BY name ASC`).all();
    tags = result.results || [];
  }
} catch (err) {
  console.error(err);
}
---
<AdminLayout title="Kelola Tag" user={user} currentPath="/admin/master/tags">
  <div class="mb-6">
    <h2 class="text-[1.5rem] font-bold text-[#1A1D23] tracking-[-0.02em]">Kelola Tag</h2>
    <p class="text-[0.8125rem] text-[#5B606D]">Kelola tag global untuk filter katalog produk.</p>
  </div>
  <!-- Tag CRUD Form & Table Markup here... -->
</AdminLayout>
```

- [ ] **Step 2: Add Master Data Navigation to Sidebar**
Edit `src/pages/admin/layout.astro` to add the Master Data collapsible header and children (Categories, Tags, Note Templates).
```html
<!-- In sidebar menu: -->
<div class="sidebar-group">
  <div class="text-[0.6875rem] font-semibold text-[#5B606D] uppercase tracking-[0.1em] px-4 py-2">Master Data</div>
  <a href="/admin/master/tags" class={`sidebar-nav-item ${currentPath.startsWith('/admin/master/tags') ? 'active' : ''}`}>Tags</a>
</div>
```

- [ ] **Step 3: Verify the Admin Tag page works**
Verify tag additions, renames, and deletions on the master page correctly cascade to product linkages.

- [ ] **Step 4: Commit**
```bash
git add src/pages/admin/master/tags.astro src/pages/admin/layout.astro
git commit -m "admin: implement master tags management page and sidebar group"
```

---

### Task 6: Catalog UI Filters & Detail Variant Swapping

**Files:**
- Modify: `src/pages/catalog/index.astro`
- Modify: `src/pages/catalog/[id].astro`

- [ ] **Step 1: Include tags in catalog product fetches**
In `src/pages/catalog/index.astro`, update D1 product queries to fetch tag data for each product, inserting them into `productsWithIdr`.
```typescript
const withVariants = await Promise.all(productList.map(async (p) => {
  // Fetch tags
  const tagsResult = await db.prepare(
    `SELECT t.id, t.name FROM tags t
     JOIN product_tags pt ON pt.tag_id = t.id
     WHERE pt.product_id = ?1`
  ).bind(p.id).all();
  const tags = tagsResult?.results || [];
  ...
  return { ...p, variants, tags, ... };
}));
```

- [ ] **Step 2: Render tags on catalog cards**
Modify `renderCard` to render small tag labels under the product title:
```javascript
const tagBadges = (product.tags || []).slice(0, 3).map(t => `
  <span class="inline-block bg-[#F1F2F5] text-[#5B606D] rounded-[4px] px-1.5 py-0.5 text-[0.625rem] font-medium mr-1 mb-1">#${esc(t.name)}</span>
`).join('');
const tagOverflow = (product.tags || []).length > 3 ? `<span class="text-[0.625rem] text-[#5B606D] font-medium">+${product.tags.length - 3}</span>` : '';
```

- [ ] **Step 3: Implement tag dropdown filter**
Add tag multi-select dropdown in `src/pages/catalog/index.astro` inside the collapsible filter group, mirroring the category dropdown:
```html
<div class="relative w-full sm:w-auto shrink-0" id="tag-filter-container">
  <!-- Dropdown UI button + panel matching category pattern -->
</div>
```
Modify `getFilteredProducts()` to filter by `selectedTags` and update matching in `#search-input` matching:
```javascript
if (searchQuery.trim()) {
  const q = searchQuery.toLowerCase();
  result = result.filter(p => p.name.toLowerCase().includes(q) || (p.tags || []).some(t => t.name.toLowerCase().includes(q)));
}
```

- [ ] **Step 4: Detail & Sheet variant image swapping**
In `src/pages/catalog/[id].astro` `<script define:vars>`, store each variant's image list. Tapping a variant pill swaps `#main-product-image` and rebuilds the thumbnail strip using the variant's image list (falling back to parent images if empty).
In `src/pages/catalog/index.astro` sheet logic, selecting a variant in the bottom sheet updates `#sheet` image array and rebuilds previews.

- [ ] **Step 5: Commit**
```bash
git add src/pages/catalog/index.astro src/pages/catalog/\[id\].astro
git commit -m "catalog: implement tag filters, card tags, and variant image swapping"
```

---

### Task 7: Mobile/iPad Confirm-Dialog Bug Fix

**Files:**
- Modify: `src/pages/catalog/index.astro`

- [ ] **Step 1: Port dialog markups to catalog index**
Paste `#wa-dialog` and `#confirm-order-dialog` HTML templates (from `catalog/[id].astro`) into the bottom of `src/pages/catalog/index.astro`.

- [ ] **Step 2: Implement order confirm flow for Mobile Sheet**
Update `<script define:vars>` inside `src/pages/catalog/index.astro`. Locate `#sheet-order-btn` event listener:
```javascript
// Replace direct API POST in sheet-order-btn click:
document.getElementById('sheet-order-btn')?.addEventListener('click', () => {
  if (!isGateOpen) return;
  if (!waNumber) {
    waDialog?.showModal();
  } else {
    confirmDialog?.showModal();
  }
});
```
Bind `#confirm-order-btn` click inside `catalog/index.astro` to execute the POST using sheet variables:
```javascript
confirmBtn?.addEventListener('click', async () => {
  confirmDialog?.close();
  // Perform API POST /api/orders with product_id, activeVariantId, and sheetQty.
  // Then toast, refresh order badge, and closeSheet().
});
```

- [ ] **Step 3: Run Playwright test suite**
Run: `npm test`
Expected: Verify that existing tests pass, and manually test mobile viewports to ensure confirm dialog is active.

- [ ] **Step 4: Commit**
```bash
git add src/pages/catalog/index.astro
git commit -m "fix: resolve mobile order confirmation bypass on bottom sheet"
```

---

### Task 8: E2E Verification Tests

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Write E2E test cases**
Open `tests/e2e.spec.ts` and append a test suite `test.describe('CUJ-XX: Group A UX features')` verifying:
1. Mobile sheet order shows WA dialog and confirm dialog.
2. Filter-by-tag returns matching items.
3. Search by tag queries correctly.
4. Detail page variant swap updates media correctly.

- [ ] **Step 2: Run verification**
Run: `npm test`
Expected: ALL tests pass.

- [ ] **Step 3: Commit**
```bash
git add tests/e2e.spec.ts
git commit -m "test: add E2E test coverage for Group A UX features"
```
