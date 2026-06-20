# Product Note Badges & Master Data Restructure (Group B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement admin-managed product note badges, templates, a central Master Data sidebar nav group (Categories, Tags, Note Templates), and list these note badges to buyers in the Tambah Pesanan confirmation dialog.

**Architecture:** Extend SQLite database with `products.notes` column and settings `note_templates` key, implement note templates API updates, restructure admin navigation layout into a sidebar group, move Category management, create Note Templates master page, add templates/free-text support in product modal, and render badges inside the desktop/mobile order confirmation modals.

**Tech Stack:** Astro 6, Hono, Cloudflare D1 (SQLite), Zod, Tailwind CSS, Playwright.

---

### Task 1: Database Migration & Settings Setup

**Files:**
- Create: `db/migration_v08_product_notes.sql`
- Modify: `db/schema.sql` (append additions)
- Modify: `src/lib/types.ts`
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Create the SQL migration file**
Create `db/migration_v08_product_notes.sql` with the following content:
```sql
-- ============================================================
-- Kotemart Jastip — Migration v08
-- Adds notes to products
-- ============================================================

ALTER TABLE products ADD COLUMN notes TEXT NOT NULL DEFAULT '[]';
```

- [ ] **Step 2: Apply the migration to the local database**
Run: `npx wrangler d1 execute DB --local --file=db/migration_v08_product_notes.sql`
Expected output: Success messages showing table modification.

- [ ] **Step 3: Update `db/schema.sql`**
Add `notes TEXT NOT NULL DEFAULT '[]'` column to the `products` table definition in `db/schema.sql`.

- [ ] **Step 4: Update TypeScript Types**
Edit `src/lib/types.ts` to include `notes` on `Product` and `note_templates` on `Settings`:
```typescript
// Modify Product interface in src/lib/types.ts
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
  tags?: { id: string; name: string }[];
  notes?: string[]; // Added
}

// Modify Settings interface in src/lib/types.ts
export interface Settings {
  gate_status: 'Open' | 'Closed';
  jpy_to_idr_rate: number;
  global_fee_pct: number;
  telegram_link: string;
  product_categories: string[];
  arrival_notification?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  note_templates?: string[]; // Added
}
```

- [ ] **Step 5: Update Settings Retriever and Types in Pricing**
In `src/lib/pricing.ts`, update `getSettings`:
- Add `'note_templates'` to the SQL query `WHERE key IN (...)`:
```typescript
// Line 62 of src/lib/pricing.ts
.prepare(`SELECT key, value FROM settings WHERE key IN ('gate_status','jpy_to_idr_rate','global_fee_pct','telegram_link','product_categories','arrival_notification','bank_name','bank_account_number','bank_account_name','note_templates')`)
```
- Parse `note_templates` from DB output:
```typescript
// In src/lib/pricing.ts (around line 76)
let note_templates: string[] = [];
if (map['note_templates']) {
  try {
    note_templates = JSON.parse(map['note_templates']);
  } catch {}
}
```
- Add it to the returned object:
```typescript
return {
  ...
  note_templates,
};
```

- [ ] **Step 6: Commit**
```bash
git add db/migration_v08_product_notes.sql db/schema.sql src/lib/types.ts src/lib/pricing.ts
git commit -m "db: add schema migration v08 and settings configurations for product notes"
```

---

### Task 2: API Updates for Note Templates & Product Notes

**Files:**
- Modify: `src/pages/api/[...path].ts`

- [ ] **Step 1: Update API validator schema and update logic for Settings**
Find `updateSettingsSchema` in `src/pages/api/[...path].ts` (around line 878) and add `note_templates` support:
```typescript
const updateSettingsSchema = z.object({
  gate_status: z.enum(['Open', 'Closed']).optional(),
  jpy_to_idr_rate: z.number().int().min(1).optional(),
  global_fee_pct: z.number().min(0).optional(),
  telegram_link: z.string().url().optional(),
  product_categories: z.array(z.string().min(1)).min(1).optional(),
  arrival_notification: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  note_templates: z.array(z.string().min(1)).optional(), // Added
});
```
Update Hono `PUT /api/admin/settings` handler to persist `note_templates`:
```typescript
// Line 894:
if (body.note_templates !== undefined) updates.push(['note_templates', JSON.stringify(body.note_templates)]);
```

- [ ] **Step 2: Update Product endpoints to return and save notes**
In `buildProductResponse`, include notes extraction:
```typescript
async function buildProductResponse(db: D1Database, p: Record<string, unknown>) {
  ...
  return {
    ...p,
    images: parseImages(p.images),
    notes: parseImages(p.notes), // Reuses the parser helper for arrays
    variants,
    tags,
    ...
  };
}
```
Update validation schemas `createProductSchema` and `updateProductSchema` to accept `notes: z.array(z.string()).optional()`:
In `createProductSchema`:
```typescript
notes: z.array(z.string()).optional().default([]),
```
In `updateProductSchema`:
```typescript
notes: z.array(z.string()).optional(),
```
Persist `notes` parameter during Product operations:
- `POST /api/products`:
```typescript
  await c.env.DB.prepare(
    `INSERT INTO products (id, name, category, description, images, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(id, body.name, body.category, body.description, JSON.stringify(body.images), JSON.stringify(body.notes ?? [])).run();
```
- `PUT /api/products/:id`:
```typescript
  if (body.notes !== undefined) { setClauses.push(`notes = ?${idx++}`); values.push(JSON.stringify(body.notes)); }
```

- [ ] **Step 3: Verify Hono compile**
Check for server initialization/compile errors or run existing E2E tests.

- [ ] **Step 4: Commit**
```bash
git add src/pages/api/\[...path\].ts
git commit -m "api: extend products endpoints and settings schema with notes"
```

---

### Task 3: Master Data Layout Restructure

**Files:**
- Modify: `src/pages/admin/layout.astro`

- [ ] **Step 1: Restructure Admin sidebar menu layout**
Open `src/pages/admin/layout.astro` and insert a "Master Data" collapsible group matching existing sidebar styling (replacing/reordering links).
```html
<!-- Inside src/pages/admin/layout.astro aside container line 36 -->
<div class="p-4 flex flex-col gap-1">
  <a
    href="/admin/orders"
    class={`sidebar-nav-item ${currentPath.startsWith('/admin/orders') ? 'active' : ''}`}
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
    Pesanan
  </a>
  <a
    href="/admin/products"
    class={`sidebar-nav-item ${currentPath.startsWith('/admin/products') ? 'active' : ''}`}
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
    Katalog
  </a>

  <!-- MASTER DATA SECTION -->
  <div class="mt-4 mb-1 px-4 text-[0.6875rem] font-bold text-[#5B606D] uppercase tracking-[0.15em] border-t border-[#E8E9ED]/50 pt-4">Master Data</div>
  <a
    href="/admin/master/categories"
    class={`sidebar-nav-item pl-6 ${currentPath.startsWith('/admin/master/categories') ? 'active' : ''}`}
  >
    Kategori
  </a>
  <a
    href="/admin/master/tags"
    class={`sidebar-nav-item pl-6 ${currentPath.startsWith('/admin/master/tags') ? 'active' : ''}`}
  >
    Tags
  </a>
  <a
    href="/admin/master/notes"
    class={`sidebar-nav-item pl-6 ${currentPath.startsWith('/admin/master/notes') ? 'active' : ''}`}
  >
    Template Catatan
  </a>

  <div class="mt-4 border-t border-[#E8E9ED]/50 pt-4"></div>

  <a
    href="/admin/profit"
    class={`sidebar-nav-item ${currentPath.startsWith('/admin/profit') ? 'active' : ''}`}
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    Profit
  </a>
  <a
    href="/admin/settings"
    class={`sidebar-nav-item ${currentPath.startsWith('/admin/settings') ? 'active' : ''}`}
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
    Pengaturan
  </a>
  <a
    href="/admin/users"
    class={`sidebar-nav-item ${currentPath.startsWith('/admin/users') ? 'active' : ''}`}
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    User
  </a>
</div>
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/admin/layout.astro
git commit -m "admin: restructure sidebar navigation with Master Data group"
```

---

### Task 4: Move Category Management & Add Note Templates Editor

**Files:**
- Create: `src/pages/admin/master/categories.astro`
- Create: `src/pages/admin/master/notes.astro`
- Modify: `src/pages/admin/settings.astro`

- [ ] **Step 1: Extract categories layout into `categories.astro`**
Create `src/pages/admin/master/categories.astro` pasting in the categories panel and categories editor JavaScript script from `src/pages/admin/settings.astro`.
Make sure it renders via `AdminLayout` and reads/updates `settings.product_categories` using the Settings API route.

- [ ] **Step 2: Remove categories card from settings page**
Delete the categories card element and script logic in `src/pages/admin/settings.astro` (lines 179-231 and categories save script elements).

- [ ] **Step 3: Create note templates editor page**
Create `src/pages/admin/master/notes.astro` using the exact same structure as `categories.astro`, but managing `settings.note_templates` instead:
```astro
---
export const prerender = false;
import AdminLayout from '../layout.astro';
import { env } from 'cloudflare:workers';
import { getSettings } from '../../../lib/pricing';

const user = Astro.locals.user;
let settings = { note_templates: [] as string[] };

try {
  const db = (env as any).DB;
  if (db) {
    const s = await getSettings(db);
    if (s) settings.note_templates = s.note_templates || [];
  }
} catch (err) {
  console.error(err);
}
---
<AdminLayout title="Template Catatan" user={user} currentPath="/admin/master/notes">
  <div class="mb-6">
    <h2 class="text-[1.5rem] font-bold text-[#1A1D23] tracking-[-0.02em]">Template Catatan</h2>
    <p class="text-[0.8125rem] text-[#5B606D]">Kelola template catatan produk yang bisa dipilih oleh admin.</p>
  </div>
  
  <div class="bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-sm flex flex-col gap-4">
    <div id="notes-chips" class="flex flex-wrap gap-2 min-h-[32px]">
      {settings.note_templates.map(note => (
        <span class="note-chip flex items-center gap-1.5 bg-[#F1F2F5] text-[#1A1D23] rounded-full px-3 py-1 text-[0.75rem] font-semibold" data-value={note}>
          {note}
          <button type="button" class="chip-remove text-[#5B606D] hover:text-[#D1453B] ml-1.5 leading-none">✕</button>
        </span>
      ))}
    </div>
    
    <div class="flex gap-2">
      <input type="text" id="new-note-input" placeholder="Wording catatan baru..." class="flex-grow h-[36px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]" />
      <button id="btn-add-note" type="button" class="h-[36px] px-4 bg-[#FFFFFF] border border-[#E8E9ED] hover:bg-[#F1F2F5] text-[#1A1D23] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em]">+ Tambah</button>
    </div>
    <button id="btn-save-notes" class="btn-primary-custom h-[40px] w-full">Simpan Template</button>
  </div>
</AdminLayout>
```
Write Javascript to bind buttons and call `PUT /api/admin/settings` with `{ note_templates: notes }`.

- [ ] **Step 4: Verify navigation**
Run dev server, navigate Categories, Tags, and Note Templates pages, ensuring each performs reads and updates cleanly.

- [ ] **Step 5: Commit**
```bash
git add src/pages/admin/master/categories.astro src/pages/admin/master/notes.astro src/pages/admin/settings.astro
git commit -m "admin: move category management and implement note templates page"
```

---

### Task 5: Admin Product Modal Notes Configuration

**Files:**
- Modify: `src/pages/admin/products.astro`

- [ ] **Step 1: Fetch Note Templates and append HTML control**
In `src/pages/admin/products.astro` server-side block, load settings (`note_templates`).
Insert Notes panel markup inside `#product-form`:
```html
<div class="flex flex-col gap-2">
  <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Catatan Produk</label>
  <div id="product-notes-chips" class="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border border-[#E8E9ED] rounded-[6px] bg-white items-center">
    <!-- Removable note chips -->
  </div>
  <input type="hidden" id="input-notes-json" value="[]" />
  
  <div class="text-[0.75rem] text-[#5B606D]">Pilih dari template:</div>
  <div class="flex flex-wrap gap-1.5" id="template-notes-picker">
    {settings.note_templates.map(note => (
      <button type="button" class="template-note-btn px-2.5 py-1 rounded bg-[#F1F2F5] hover:bg-[#E8E9ED] text-[#1A1D23] text-[0.75rem] font-medium transition-colors" data-value={note}>
        {note}
      </button>
    ))}
  </div>
  <div class="flex gap-2 mt-1">
    <input type="text" id="input-custom-note" placeholder="Tulis catatan kustom..." class="flex-grow h-[32px] px-2.5 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]" />
    <button type="button" id="btn-add-custom-note" class="h-[32px] px-3 border border-[#E8E9ED] rounded-[6px] text-xs font-semibold text-[#1A1D23]">Tambah</button>
  </div>
</div>
```

- [ ] **Step 2: Add client-side logic to handle product notes**
In the `<script define:vars>` section, update `openProductModal` to parse and render existing notes array into `#product-notes-chips`, map clicks on template buttons to append chips, wire custom note additions on button click/Enter, and serialize array to `#input-notes-json`. Include `notes` key in the payload sent to `api/products` (POST/PUT).

- [ ] **Step 3: Verify note additions**
Run dev server, edit a product, verify selecting template notes and adding custom notes. Save and re-open to confirm persistence.

- [ ] **Step 4: Commit**
```bash
git add src/pages/admin/products.astro
git commit -m "admin: support adding template and custom notes to products in modal"
```

---

### Task 6: Buyer Dialog Product Notes Display

**Files:**
- Modify: `src/pages/catalog/[id].astro`
- Modify: `src/pages/catalog/index.astro`

- [ ] **Step 1: Render Notes inside confirm dialog (Detail page)**
In `src/pages/catalog/[id].astro`, find `#confirm-order-dialog`. Inside the info container, add:
```html
<div id="confirm-notes-section" class="hidden border-t border-[#E8E9ED] mt-3 pt-3">
  <p class="text-[0.75rem] font-semibold text-[#1A1D23] mb-1">Catatan Produk / Ketentuan:</p>
  <ul id="confirm-notes-list" class="flex flex-col gap-1 text-[0.75rem] text-[#5B606D]"></ul>
</div>
```
In `<script define:vars>`, when opening `confirm-order-dialog`, read product notes from the defined Astro variable (`product.notes`). If notes exist, populate `#confirm-notes-list` and unhide `#confirm-notes-section`. Otherwise, hide it.

- [ ] **Step 2: Render Notes inside confirm dialog (Mobile Sheet / Catalog index)**
Ensure product payload in `catalog/index.astro` contains the `notes` parameter.
Locate `#confirm-order-dialog` in `src/pages/catalog/index.astro` (which was added in Group A). Add the same `#confirm-notes-section` container structure.
In the bottom sheet script logic, when presenting the confirmation dialog, load the active product's notes, populate the container, and toggle visibility.

- [ ] **Step 3: (Optional) Render notes as product badges**
On the product detail page `/catalog/[id].astro`, add a container under the variant selection list rendering product notes as border-boxed badges to signal them early to the buyer.

- [ ] **Step 4: Verify visually**
Launch dev server, open a product with notes on desktop/mobile and verify that notes render inside the confirmation dialog when checking out.

- [ ] **Step 5: Commit**
```bash
git add src/pages/catalog/\[id\].astro src/pages/catalog/index.astro
git commit -m "catalog: display product notes badges in desktop and mobile order confirmation dialogs"
```

---

### Task 7: E2E Verification Tests

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Write E2E test cases**
Append tests in `tests/e2e.spec.ts` verifying:
1. Addition/removal of categories on `/admin/master/categories`.
2. Addition/removal of note templates on `/admin/master/notes`.
3. Creating a product with notes and verifying they appear on the desktop and mobile checkout confirmation modals.

- [ ] **Step 2: Run verification**
Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add tests/e2e.spec.ts
git commit -m "test: add E2E tests for Group B categories, notes, and dialog templates"
```
