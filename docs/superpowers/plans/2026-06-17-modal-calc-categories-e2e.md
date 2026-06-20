# Modal Live-Calc, Categories CRUD, E2E Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live IDR price calculation to the admin product modal, add dynamic category management in admin settings (stored in D1), propagate categories to catalog filter and product form, and extend E2E tests to cover all new and existing CRUD flows.

**Architecture:** Categories stored as `product_categories` JSON in the existing `settings` D1 key-value table — no schema migration. Settings type + `getSettings()` extended to carry the new field. Both `catalog/index.astro` and `admin/products.astro` read categories from SSR settings at page load. Modal pricing display is pure client-side math using rate/fee injected via `define:vars`.

**Tech Stack:** Astro SSR + Hono (Cloudflare Workers) + D1 SQLite + Zod + Playwright E2E

---

## File Map

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `product_categories` to `Settings` interface |
| `src/lib/pricing.ts` | Extend `getSettings()` to read + parse `product_categories` |
| `src/pages/api/[...path].ts` | Extend `updateSettingsSchema` + handler to write `product_categories` |
| `src/pages/admin/settings.astro` | Add Categories CRUD card UI + JS |
| `src/pages/admin/products.astro` | Read categories from settings SSR; add live-calc rows to modal |
| `src/pages/catalog/index.astro` | Read categories from settings SSR (remove MASTER_CATEGORIES hardcode) |
| `db/seed.sql` | Add `product_categories` seed row |
| `tests/e2e.spec.ts` | Add CUJ-11 (Product CRUD), CUJ-12 (live calc), CUJ-13 (categories CRUD) |

---

## Task 1: Extend `Settings` type and `getSettings()`

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Update `Settings` interface in `src/lib/types.ts`**

Replace the existing `Settings` interface (currently ends at `telegram_link`):

```ts
export interface Settings {
  gate_status: 'Open' | 'Closed';
  jpy_to_idr_rate: number;
  global_fee_pct: number;
  telegram_link: string;
  product_categories: string[];
}
```

`MASTER_CATEGORIES` stays in the file as the fallback default:
```ts
export const MASTER_CATEGORIES = ['Elektronik', 'Figure', 'Snack', 'Pakaian'] as const;
export type ProductCategory = typeof MASTER_CATEGORIES[number];
```

- [ ] **Step 2: Extend `getSettings()` in `src/lib/pricing.ts`**

Update the query to include `product_categories`, then parse + fall back:

```ts
export async function getSettings(db: D1Database): Promise<Settings> {
  const rows = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN ('gate_status','jpy_to_idr_rate','global_fee_pct','telegram_link','product_categories')`)
    .all<{ key: string; value: string }>();

  const map: Record<string, string> = {};
  for (const row of rows.results) {
    map[row.key] = row.value;
  }

  let product_categories: string[] = [...MASTER_CATEGORIES];
  if (map['product_categories']) {
    try {
      const parsed = JSON.parse(map['product_categories']);
      if (Array.isArray(parsed) && parsed.length > 0) {
        product_categories = parsed;
      }
    } catch { /* use fallback */ }
  }

  return {
    gate_status: (map['gate_status'] ?? 'Closed') as 'Open' | 'Closed',
    jpy_to_idr_rate: parseFloat(map['jpy_to_idr_rate'] ?? '110'),
    global_fee_pct: parseFloat(map['global_fee_pct'] ?? '5'),
    telegram_link: map['telegram_link'] ?? '',
    product_categories,
  };
}
```

- [ ] **Step 3: Add seed row to `db/seed.sql`**

After the existing settings inserts, add:

```sql
INSERT OR REPLACE INTO settings(key, value) VALUES
  ('product_categories', '["Elektronik","Figure","Snack","Pakaian"]');
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/pricing.ts db/seed.sql
git commit -m "feat: add product_categories to Settings type and getSettings()"
```

---

## Task 2: Extend API to write `product_categories`

**Files:**
- Modify: `src/pages/api/[...path].ts`

- [ ] **Step 1: Extend `updateSettingsSchema`**

Find the `updateSettingsSchema` const (currently ~line 809) and add the new field:

```ts
const updateSettingsSchema = z.object({
  gate_status: z.enum(['Open', 'Closed']).optional(),
  jpy_to_idr_rate: z.number().positive().optional(),
  global_fee_pct: z.number().min(0).optional(),
  telegram_link: z.string().url().or(z.literal('')).optional(),
  product_categories: z.array(z.string().min(1)).min(1).optional(),
});
```

- [ ] **Step 2: Extend the `PUT /api/admin/settings` handler to write `product_categories`**

Find the `if (body.gate_status !== undefined) updates.push(...)` block and add after the last existing `if`:

```ts
if (body.product_categories !== undefined)
  updates.push(['product_categories', JSON.stringify(body.product_categories)]);
```

- [ ] **Step 3: Verify with curl (manual check, dev server must be running)**

```bash
# Start dev if not running: npm run dev
curl -s -X PUT http://localhost:4321/api/admin/settings \
  -H 'Content-Type: application/json' \
  -b 'session=<admin-session-cookie>' \
  -d '{"product_categories":["Elektronik","Figure","Snack"]}' | jq .
# Expected: returns settings object with product_categories array
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/[...path].ts
git commit -m "feat: extend PUT /api/admin/settings to accept product_categories"
```

---

## Task 3: Categories CRUD card in admin settings page

**Files:**
- Modify: `src/pages/admin/settings.astro`

- [ ] **Step 1: Pass `settings` to page and add the Categories card HTML**

The page already fetches `settings`. Add this card inside the right column `<div>` (after the Telegram card closing `</div>`):

```astro
<!-- Categories Card -->
<div class="bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-sm flex flex-col gap-4" data-testid="categories-card">
  <h3 class="font-bold text-[1.125rem] text-[#1A1D23] leading-tight">Kategori Produk</h3>
  <p class="text-[0.8125rem] text-[#5B606D] -mt-2">Kelola kategori yang tersedia di katalog dan filter produk.</p>

  <div class="border-t border-[#E8E9ED] pt-4 flex flex-col gap-3">
    <!-- Tag chips -->
    <div id="categories-chips" class="flex flex-wrap gap-2 min-h-[32px]">
      {settings.product_categories.map(cat => (
        <span
          class="category-chip flex items-center gap-1.5 bg-[#F1F2F5] text-[#1A1D23] rounded-full px-3 py-1 text-[0.75rem] font-semibold"
          data-value={cat}
        >
          {cat}
          <button
            type="button"
            class="chip-remove text-[#5B606D] hover:text-[#D1453B] transition-colors leading-none"
            data-testid={`chip-remove-${cat}`}
            aria-label={`Hapus kategori ${cat}`}
          >✕</button>
        </span>
      ))}
    </div>

    <!-- Add input row -->
    <div class="flex gap-2">
      <input
        type="text"
        id="new-category-input"
        data-testid="new-category-input"
        placeholder="Nama kategori baru..."
        class="flex-grow h-[36px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
      />
      <button
        id="btn-add-category"
        data-testid="btn-add-category"
        type="button"
        class="h-[36px] px-4 bg-[#FFFFFF] border border-[#E8E9ED] hover:bg-[#F1F2F5] text-[#1A1D23] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all shrink-0"
      >
        + Tambah
      </button>
    </div>

    <button
      id="btn-save-categories"
      data-testid="btn-save-categories"
      type="button"
      class="btn-primary-custom h-[40px] w-full"
    >
      Simpan Kategori
    </button>
  </div>
</div>
```

- [ ] **Step 2: Add the categories JS at the bottom of the page `<script>` block**

Append inside the existing `<script>` block (after `btnSaveTelegram` handler):

```ts
  // ── Categories CRUD ──────────────────────────────────────────────────────
  const chipsContainer = document.getElementById('categories-chips')!;
  const newCatInput = document.getElementById('new-category-input') as HTMLInputElement;
  const btnAddCat = document.getElementById('btn-add-category') as HTMLButtonElement;
  const btnSaveCats = document.getElementById('btn-save-categories') as HTMLButtonElement;

  function getCurrentCategories(): string[] {
    return Array.from(chipsContainer.querySelectorAll<HTMLElement>('.category-chip'))
      .map(el => el.getAttribute('data-value') ?? '')
      .filter(Boolean);
  }

  function addChip(value: string) {
    const span = document.createElement('span');
    span.className = 'category-chip flex items-center gap-1.5 bg-[#F1F2F5] text-[#1A1D23] rounded-full px-3 py-1 text-[0.75rem] font-semibold';
    span.setAttribute('data-value', value);
    span.innerHTML = `${value}<button type="button" class="chip-remove text-[#5B606D] hover:text-[#D1453B] transition-colors leading-none ml-1.5" data-testid="chip-remove-${value}" aria-label="Hapus kategori ${value}">✕</button>`;
    span.querySelector('.chip-remove')!.addEventListener('click', () => span.remove());
    chipsContainer.appendChild(span);
  }

  // Wire remove buttons for server-rendered chips
  chipsContainer.querySelectorAll<HTMLButtonElement>('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.category-chip')?.remove());
  });

  btnAddCat.addEventListener('click', () => {
    const val = newCatInput.value.trim();
    if (!val) {
      window.showToast?.('Nama kategori tidak boleh kosong.', 'error');
      return;
    }
    const existing = getCurrentCategories().map(c => c.toLowerCase());
    if (existing.includes(val.toLowerCase())) {
      window.showToast?.('Kategori sudah ada.', 'error');
      return;
    }
    addChip(val);
    newCatInput.value = '';
  });

  // Also allow Enter key in input
  newCatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); btnAddCat.click(); }
  });

  btnSaveCats.addEventListener('click', async () => {
    const cats = getCurrentCategories();
    if (cats.length === 0) {
      window.showToast?.('Minimal harus ada 1 kategori.', 'error');
      return;
    }
    btnSaveCats.disabled = true;
    try {
      const apiClient = (window as any).apiClient || fetch;
      const res = await apiClient('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ product_categories: cats }),
      });
      if (res.ok) {
        window.showToast?.('Kategori berhasil disimpan!', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        window.showToast?.(err.error || 'Gagal menyimpan kategori.', 'error');
      }
    } catch {
      window.showToast?.('Terjadi kesalahan jaringan.', 'error');
    } finally {
      btnSaveCats.disabled = false;
    }
  });
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/settings.astro
git commit -m "feat: add categories CRUD card to admin settings page"
```

---

## Task 4: Wire categories into catalog filter and product modal dropdown

**Files:**
- Modify: `src/pages/catalog/index.astro`
- Modify: `src/pages/admin/products.astro`

- [ ] **Step 1: Update `catalog/index.astro` to read categories from settings**

In the frontmatter, `settings` is already fetched. Replace the categories line:

```ts
// BEFORE:
const categories = ['Semua', ...MASTER_CATEGORIES];

// AFTER:
const categories = ['Semua', ...settings.product_categories];
```

Remove the now-unused import if present:
```ts
// Remove this line if it exists:
import { MASTER_CATEGORIES } from '../../lib/types';
```

- [ ] **Step 2: Update `admin/products.astro` to read categories from settings**

The page already fetches `settings`. Pass `product_categories` from it.

At the top of the frontmatter, `settings` is already available. Find where the select options are hardcoded and replace:

```astro
<!-- BEFORE: -->
<option value="" disabled selected>Pilih Kategori</option>
{MASTER_CATEGORIES.map(cat => (
  <option value={cat}>{cat}</option>
))}

<!-- AFTER: -->
<option value="" disabled selected>Pilih Kategori</option>
{settings.product_categories.map(cat => (
  <option value={cat}>{cat}</option>
))}
```

Remove the `MASTER_CATEGORIES` import line from products.astro frontmatter (it's now unused).

Also pass `product_categories` to client script via `define:vars` so the modal can re-render without a page reload (needed for CUJ-12 live-calc). Find the `<script>` tag at the bottom and update its opening:

```astro
<script define:vars={{ rate, fee, productCategories: settings.product_categories }}>
```

> Note: `rate` and `fee` are already defined in the frontmatter (`const rate = settings?.jpy_to_idr_rate ?? 110` and `const fee = settings?.global_fee_pct ?? 5`).

- [ ] **Step 3: Commit**

```bash
git add src/pages/catalog/index.astro src/pages/admin/products.astro
git commit -m "feat: read product_categories from settings in catalog and admin products"
```

---

## Task 5: Live-calculation display rows in product modal

**Files:**
- Modify: `src/pages/admin/products.astro`

- [ ] **Step 1: Add read-only calc display below JPY Price input in the modal**

Find the JPY Price input field in the modal (the `<div class="flex flex-col gap-1">` containing `id="input-price"`). Directly after that entire `<div>`, insert:

```astro
<!-- Live pricing preview -->
<div id="price-calc-preview" class="flex flex-col gap-1.5 p-3 bg-[#F9F9F7] rounded-[6px] border border-[#E8E9ED] text-[0.8125rem]">
  <div class="flex justify-between items-center text-[#5B606D]">
    <span>Kurs</span>
    <span id="calc-rate" class="font-mono">¥1 = Rp <span id="calc-rate-val">—</span></span>
  </div>
  <div class="flex justify-between items-center text-[#5B606D]">
    <span>Fee IDR</span>
    <span id="calc-fee-idr" class="font-mono">Rp <span id="calc-fee-idr-val">—</span></span>
  </div>
  <div class="flex justify-between items-center font-semibold text-[#1A1D23] pt-1.5 border-t border-[#E8E9ED]">
    <span>Est. IDR</span>
    <span id="calc-est-idr" class="font-mono text-[#1A8F89]">Rp <span id="calc-est-idr-val">—</span></span>
  </div>
</div>
```

- [ ] **Step 2: Add live-calc JS to the existing client `<script>` block**

The `<script>` tag already has `define:vars={{ rate, fee, productCategories: ... }}` from Task 4. Inside that script, add this function and wire it to the price input:

```ts
  // ── Live price calculation ───────────────────────────────────────────────
  function updateCalcPreview() {
    const jpy = parseInt(priceInput.value, 10) || 0;
    const feeIdr = Math.round(jpy * rate * (fee / 100));
    const estIdr = Math.round(jpy * rate * (1 + fee / 100));

    const fmtIDR = (n: number) => n > 0 ? n.toLocaleString('id-ID') : '—';

    document.getElementById('calc-rate-val')!.textContent = rate.toLocaleString('id-ID');
    document.getElementById('calc-fee-idr-val')!.textContent = fmtIDR(feeIdr);
    document.getElementById('calc-est-idr-val')!.textContent = fmtIDR(estIdr);
  }

  priceInput.addEventListener('input', updateCalcPreview);
```

Also call `updateCalcPreview()` inside `window.openProductModal` after setting `priceInput.value` (both the add and edit branches):

```ts
  // At the end of window.openProductModal, before modal.showModal():
  updateCalcPreview();
  modal.showModal();
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/products.astro
git commit -m "feat: add live IDR price calculation preview to product modal"
```

---

## Task 6: E2E — CUJ-11: Admin Product CRUD

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Append CUJ-11 test group to `tests/e2e.spec.ts`**

Add at the end of the file:

```ts
// ============================================================
// CUJ-11: Admin Product CRUD
// Admin can create, edit, and delete catalog products
// ============================================================
test.describe('CUJ-11: Admin Product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin can open Tambah Produk modal', async ({ page }) => {
    await page.goto('/admin/products');
    await page.locator('#btn-add-product').click();
    const modal = page.locator('#product-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Tambah Produk');
  });

  test('admin can create product with no image and it appears in table', async ({ page }) => {
    await page.goto('/admin/products');
    await page.locator('#btn-add-product').click();

    await page.locator('#input-name').fill('Test Produk E2E');
    await page.locator('#input-category').selectOption({ index: 1 });
    await page.locator('#input-price').fill('5000');
    await page.locator('#input-desc').fill('Deskripsi test produk untuk E2E.');
    await page.locator('#btn-save').click();

    // Modal closes and product appears in table
    await expect(page.locator('#product-modal')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toContainText('Test Produk E2E', { timeout: 5000 });
  });

  test('admin can create product with relative image URL (dev path) — no 400', async ({ request }) => {
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    const res = await request.post('/api/products', {
      data: {
        name: 'Produk Dengan Gambar Dev',
        category: 'Elektronik',
        price_jpy: 3000,
        description: 'Test relative image URL dari upload dev.',
        images: ['/api/photos/products/test-uuid.webp'],
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Produk Dengan Gambar Dev');
  });

  test('admin can edit an existing product name', async ({ page }) => {
    await page.goto('/admin/products');
    const firstEditBtn = page.locator('.btn-edit').first();
    await firstEditBtn.click();

    const modal = page.locator('#product-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Edit Produk');

    await page.locator('#input-name').fill('Nama Produk Diedit E2E');
    await page.locator('#btn-save').click();

    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toContainText('Nama Produk Diedit E2E', { timeout: 5000 });
  });

  test('admin can delete a product and it is removed from table', async ({ page }) => {
    // Create a product first via API so we have a known target
    await page.request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    const createRes = await page.request.post('/api/products', {
      data: {
        name: 'Produk Akan Dihapus',
        category: 'Elektronik',
        price_jpy: 1000,
        description: 'Ini akan dihapus.',
        images: [],
      },
    });
    expect(createRes.status()).toBe(201);

    await page.goto('/admin/products');
    await expect(page.locator('table')).toContainText('Produk Akan Dihapus');

    // Click delete on the row containing our product
    const row = page.locator('tr', { hasText: 'Produk Akan Dihapus' });
    page.on('dialog', dialog => dialog.accept());
    await row.locator('.btn-delete').click();

    await expect(page.locator('table')).not.toContainText('Produk Akan Dihapus', { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run CUJ-11 tests to verify they pass**

```bash
cd /home/ubuntu/projects/kotemart-jastip && npx playwright test --grep "CUJ-11" --reporter=list
```

Expected: all 4 tests pass (or skip gracefully if the test DB state differs).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.spec.ts
git commit -m "test: add CUJ-11 admin product CRUD E2E tests"
```

---

## Task 7: E2E — CUJ-12: Modal Live Calculation

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Append CUJ-12 test group**

```ts
// ============================================================
// CUJ-12: Modal Live Calculation
// Price inputs update Fee IDR and Est. IDR displays live
// ============================================================
test.describe('CUJ-12: Modal Live Calculation', () => {
  test('entering JPY price updates Fee IDR and Est IDR displays', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products');
    await page.locator('#btn-add-product').click();

    const modal = page.locator('#product-modal');
    await expect(modal).toBeVisible();

    // Get current rate and fee from admin settings API
    const settingsRes = await page.request.get('/api/admin/settings');
    const settings = await settingsRes.json();
    const rate: number = settings.jpy_to_idr_rate;
    const feePct: number = settings.global_fee_pct;

    const jpy = 10000;
    await page.locator('#input-price').fill(String(jpy));

    const expectedFeeIdr = Math.round(jpy * rate * (feePct / 100));
    const expectedEstIdr = Math.round(jpy * rate * (1 + feePct / 100));

    // The displayed values should contain the expected numbers (formatted)
    const feeValEl = page.locator('#calc-fee-idr-val');
    const estValEl = page.locator('#calc-est-idr-val');

    // Check that displayed text contains the numeric value (locale-formatted, no strict format)
    const feeText = await feeValEl.textContent();
    const estText = await estValEl.textContent();

    // Strip non-digits and compare
    const feeNum = parseInt(feeText?.replace(/\D/g, '') ?? '0', 10);
    const estNum = parseInt(estText?.replace(/\D/g, '') ?? '0', 10);

    expect(feeNum).toBe(expectedFeeIdr);
    expect(estNum).toBe(expectedEstIdr);
  });

  test('calc preview shows dashes when JPY is empty or zero', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products');
    await page.locator('#btn-add-product').click();

    await expect(page.locator('#product-modal')).toBeVisible();
    // Clear price
    await page.locator('#input-price').fill('0');

    const feeText = await page.locator('#calc-fee-idr-val').textContent();
    const estText = await page.locator('#calc-est-idr-val').textContent();
    expect(feeText?.trim()).toBe('—');
    expect(estText?.trim()).toBe('—');
  });
});
```

- [ ] **Step 2: Run CUJ-12 tests**

```bash
npx playwright test --grep "CUJ-12" --reporter=list
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.spec.ts
git commit -m "test: add CUJ-12 modal live calculation E2E tests"
```

---

## Task 8: E2E — CUJ-13: Categories CRUD

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Append CUJ-13 test group**

```ts
// ============================================================
// CUJ-13: Categories CRUD
// Admin can add/delete categories; changes appear in catalog and product modal
// ============================================================
test.describe('CUJ-13: Categories CRUD', () => {
  const TEST_CATEGORY = 'Aksesoris';

  test.afterEach(async ({ page }) => {
    // Restore original categories after each test
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', {
      data: { product_categories: ['Elektronik', 'Figure', 'Snack', 'Pakaian'] },
    });
  });

  test('admin can add a new category and it appears in catalog filter pills', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');

    await page.locator('[data-testid="new-category-input"]').fill(TEST_CATEGORY);
    await page.locator('[data-testid="btn-add-category"]').click();

    // Chip should appear
    await expect(page.locator(`[data-testid="chip-remove-${TEST_CATEGORY}"]`)).toBeVisible();

    await page.locator('[data-testid="btn-save-categories"]').click();
    const toast = page.locator('[data-testid="toast-success"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Navigate to catalog and check filter pill
    await loginAs(page, 'buyer');
    await page.goto('/catalog');
    await expect(page.locator(`[data-testid="filter-pill-${TEST_CATEGORY}"]`)).toBeVisible();
  });

  test('new category appears in admin product modal dropdown', async ({ page }) => {
    // Add category via API
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', {
      data: { product_categories: ['Elektronik', 'Figure', 'Snack', 'Pakaian', TEST_CATEGORY] },
    });

    await page.goto('/admin/products');
    await page.locator('#btn-add-product').click();
    await expect(page.locator('#product-modal')).toBeVisible();

    const options = await page.locator('#input-category option').allTextContents();
    expect(options).toContain(TEST_CATEGORY);
  });

  test('admin can delete a category chip before saving', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');

    // Remove "Snack" chip
    await page.locator('[data-testid="chip-remove-Snack"]').click();
    await expect(page.locator('[data-testid="chip-remove-Snack"]')).not.toBeVisible();
  });

  test('duplicate category name is rejected without API call', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');

    await page.locator('[data-testid="new-category-input"]').fill('Elektronik');
    await page.locator('[data-testid="btn-add-category"]').click();

    // Error toast, not success
    await expect(page.locator('[data-testid="toast-error"]')).toBeVisible({ timeout: 2000 });
  });

  test('empty category name is rejected without API call', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');

    await page.locator('[data-testid="new-category-input"]').fill('');
    await page.locator('[data-testid="btn-add-category"]').click();

    await expect(page.locator('[data-testid="toast-error"]')).toBeVisible({ timeout: 2000 });
  });
});
```

- [ ] **Step 2: Run CUJ-13 tests**

```bash
npx playwright test --grep "CUJ-13" --reporter=list
```

Expected: all 5 tests pass.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npx playwright test --reporter=list
```

Expected: all existing CUJ-1 through CUJ-10 + new CUJ-11/12/13 pass (or existing skipped tests remain skipped).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e.spec.ts
git commit -m "test: add CUJ-13 categories CRUD E2E tests"
```

---

## Self-Review

### Spec coverage check
- ✅ Modal live-calc rows (Fee IDR, Est. IDR, Kurs display) — Task 5
- ✅ `product_categories` in Settings type — Task 1
- ✅ `getSettings()` reads + parses key, falls back to MASTER_CATEGORIES — Task 1
- ✅ `PUT /api/admin/settings` accepts `product_categories` — Task 2
- ✅ Categories card UI in settings page — Task 3
- ✅ Add chip / remove chip / duplicate/empty validation — Task 3
- ✅ Catalog filter pills read from settings — Task 4
- ✅ Admin product modal dropdown reads from settings — Task 4
- ✅ Seed row for `product_categories` — Task 1 Step 3
- ✅ CUJ-11 product CRUD tests (create no-image, create relative URL, edit, delete) — Task 6
- ✅ CUJ-12 live-calc tests (update on input, dashes when zero) — Task 7
- ✅ CUJ-13 categories tests (add→catalog, add→modal, delete chip, dup rejected, empty rejected) — Task 8

### No placeholders found
All steps contain exact code, exact commands, expected output.

### Type consistency
- `Settings.product_categories: string[]` defined in Task 1, consumed identically in Tasks 3, 4, 5, 7, 8.
- `getSettings()` return type matches updated `Settings` interface throughout.
- `updateSettingsSchema` field name `product_categories` matches all API call sites in tests.
