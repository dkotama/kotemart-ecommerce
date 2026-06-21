# Catalog Link & Price Audit Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new admin page to audit catalog product variants, view source URLs, update variant JPY prices and images, and add/delete variants inline.

**Architecture:** Grouped expandable products view. Clicking a product expands to show variants inside a detailed sub-row, permitting inline edits and actions via standard fetch requests.

**Tech Stack:** Astro, Tailwind CSS, Cloudflare D1 SQL.

---

### Task 1: Navigation Integration

**Files:**
- Modify: `src/pages/admin/layout.astro:46-55`
- Test: Build project and visually verify new navigation link exists in admin panel.

- [ ] **Step 1: Update navigation highlighting and add Audit Katalog link**

Modify `src/pages/admin/layout.astro` to make the "Katalog" path check exact (or not match `/admin/products/audit`) and add the "Audit Katalog" link.

```astro
        <a
          href="/admin/products"
          class={`sidebar-nav-item ${currentPath === '/admin/products' ? 'active' : ''}`}
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Katalog
        </a>
        <a
          href="/admin/products/audit"
          class={`sidebar-nav-item pl-6 ${currentPath.startsWith('/admin/products/audit') ? 'active' : ''}`}
        >
          Audit Katalog
        </a>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Successful build with no compilation errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/layout.astro
git commit -m "admin: add audit catalog link to sidebar navigation"
```

---

### Task 2: Page Route & Database Querying Setup

**Files:**
- Create: `src/pages/admin/products/audit.astro`
- Test: Open URL `/admin/products/audit` after starting dev server, verify empty/loading shell.

- [ ] **Step 1: Create audit page base structure and data fetcher**

Create the SSR page `src/pages/admin/products/audit.astro` that fetches products, variants, and system settings.

```astro
---
export const prerender = false;

import AdminLayout from '../layout.astro';
import { env } from 'cloudflare:workers';
import type { Product, Settings } from '../../../lib/types';
import { getSettings } from '../../../lib/pricing';

const user = Astro.locals.user;

let products: any[] = [];
let settings: Settings | null = null;

try {
  const db = (env as any).DB;
  if (db) {
    settings = await getSettings(db);
    
    // Fetch products along with variant details
    const result = await db.prepare(`
      SELECT 
        p.*, 
        COUNT(v.id) as variant_count,
        SUM(CASE WHEN v.product_url IS NULL OR v.product_url = '' THEN 1 ELSE 0 END) as missing_links,
        SUM(CASE WHEN v.images = '[]' OR v.images IS NULL OR v.images = '' THEN 1 ELSE 0 END) as missing_images
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
        variants: []
      }));

      // Fetch all active variants for all products to build the tree client/server side
      const variantsResult = await db.prepare(`
        SELECT * FROM product_variants 
        WHERE is_deleted = 0 
        ORDER BY sort_order ASC
      `).all();

      if (variantsResult?.results) {
        const variantsGrouped = (variantsResult.results as any[]).reduce((acc, v) => {
          if (!acc[v.product_id]) acc[v.product_id] = [];
          acc[v.product_id].push({
            ...v,
            images: (() => { try { return JSON.parse(v.images || '[]'); } catch { return []; } })()
          });
          return acc;
        }, {} as Record<string, any[]>);

        products.forEach(p => {
          p.variants = variantsGrouped[p.id] || [];
        });
      }
    }
  }
} catch (err) {
  console.error('Admin catalog audit fetch error:', err);
}

const rate = settings?.jpy_to_idr_rate ?? 110;
const fee = settings?.global_fee_pct ?? 5;
const categories = settings?.product_categories ?? [];
---

<AdminLayout title="Audit Katalog" user={user} currentPath="/admin/products/audit">
  <div class="mb-6">
    <h2 class="text-[1.5rem] font-bold text-[#1A1D23] tracking-[-0.02em]">Audit Katalog</h2>
    <p class="text-[0.8125rem] text-[#5B606D]">Audit link produk, update harga varian, dan pasang foto secara instan.</p>
  </div>
  <div id="audit-root" data-products={JSON.stringify(products)}>
    <!-- Subcomponents will be implemented here -->
  </div>
</AdminLayout>
```

- [ ] **Step 2: Run build to verify file imports**

Run: `npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/products/audit.astro
git commit -m "admin: create base route and database query for catalog audit"
```

---

### Task 3: Filter UI & Search Logic

**Files:**
- Modify: `src/pages/admin/products/audit.astro`
- Test: Open `/admin/products/audit` and verify search input, category dropdown, and issues dropdown are rendered.

- [ ] **Step 1: Add Filter Bar markup and client-side logic**

Add the search bar, category filter, and issue filter UI to `src/pages/admin/products/audit.astro`. Add client-side logic inside a `<script>` tag to filter elements.

```astro
<!-- Inside AdminLayout, replace <div id="audit-root"> ... -->
<div class="mb-6 bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
  <div class="relative w-full md:flex-1">
    <input
      type="text"
      id="search-input"
      placeholder="Cari nama produk..."
      class="w-full h-[40px] pl-10 pr-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
    />
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B606D]">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </span>
  </div>

  <div class="w-full md:w-[200px]">
    <select
      id="category-filter"
      class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] bg-white text-[#1A1D23]"
    >
      <option value="">Semua Kategori</option>
      {categories.map(cat => <option value={cat}>{cat}</option>)}
    </select>
  </div>

  <div class="w-full md:w-[200px]">
    <select
      id="issue-filter"
      class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] bg-white text-[#1A1D23]"
    >
      <option value="all">Semua Produk</option>
      <option value="missing_link">Tanpa Link URL</option>
      <option value="missing_image">Tanpa Gambar</option>
      <option value="has_issue">Ada Masalah (Link/Gambar)</option>
    </select>
  </div>
</div>

<div class="bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] overflow-hidden shadow-sm">
  <div class="overflow-x-auto w-full">
    <table class="w-full text-[0.875rem] border-collapse" id="products-table">
      <thead>
        <tr class="bg-[#F9F9F7] border-b border-[#E8E9ED] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B606D]">
          <th class="py-3 px-4 w-[40px]"></th>
          <th class="py-3 px-4 w-[80px]">Foto</th>
          <th class="py-3 px-4">Nama Produk</th>
          <th class="py-3 px-4">Kategori</th>
          <th class="py-3 px-4 text-center">Varian</th>
          <th class="py-3 px-4 text-center">Status Audit</th>
        </tr>
      </thead>
      <tbody id="products-tbody">
        <!-- Rendered by Astro/JS -->
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 2: Add script tag to implement filtering**

Add a `<script>` element under the template body to bind event listeners and apply filters.

```html
<script define:vars={{ rate, fee, products }}>
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const issueFilter = document.getElementById('issue-filter');
  const tbody = document.getElementById('products-tbody');

  let filterQuery = '';
  let selectedCategory = '';
  let selectedIssue = 'all';

  function renderTable() {
    const filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(filterQuery.toLowerCase()) || 
                            p.description.toLowerCase().includes(filterQuery.toLowerCase());
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      
      let matchesIssue = true;
      if (selectedIssue === 'missing_link') {
        matchesIssue = p.missing_links > 0;
      } else if (selectedIssue === 'missing_image') {
        matchesIssue = p.missing_images > 0;
      } else if (selectedIssue === 'has_issue') {
        matchesIssue = p.missing_links > 0 || p.missing_images > 0;
      }

      return matchesSearch && matchesCategory && matchesIssue;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-[#5B606D]">
            Tidak ada produk yang cocok dengan filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const imgSrc = p.images?.[0] ?? 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800';
      const warningBadges = [];
      if (p.missing_links > 0) warningBadges.push(`<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold">Tanpa Link</span>`);
      if (p.missing_images > 0) warningBadges.push(`<span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-semibold">Tanpa Foto</span>`);
      const statusHtml = warningBadges.length > 0 ? warningBadges.join(' ') : `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">Lengkap</span>`;

      return `
        <tr class="border-b border-[#E8E9ED] hover:bg-[#F9F9F7]/50 transition-colors product-row" data-product-id="${p.id}">
          <td class="py-3 px-4 text-center">
            <button class="toggle-variants-btn p-1 hover:bg-[#E8E9ED] rounded" data-product-id="${p.id}">
              <svg class="w-4 h-4 transform transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </td>
          <td class="py-3 px-4">
            <img src="${imgSrc}" alt="${p.name}" class="w-12 h-12 object-cover rounded-[4px] border border-[#E8E9ED]" />
          </td>
          <td class="py-3 px-4 font-semibold text-[#1A1D23]">${p.name}</td>
          <td class="py-3 px-4">
            <span class="bg-[#E8E9ED] text-[#1A1D23] px-[8px] py-[2px] rounded-[3px] text-[0.625rem] font-semibold uppercase tracking-[0.1em]">
              ${p.category}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <span class="bg-[#D5EDEB] text-[#0F726E] px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold">
              ${p.variants?.length ?? 0} varian
            </span>
          </td>
          <td class="py-3 px-4 text-center">${statusHtml}</td>
        </tr>
        <tr class="hidden variant-subrow bg-[#FAF8F5]/30 border-b border-[#E8E9ED]" id="variants-row-${p.id}">
          <td colspan="6" class="p-4 border-l-4 border-[#1A8F89]">
            <div class="flex flex-col gap-4" id="variants-container-${p.id}">
              <!-- Variants list and quick add will go here -->
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row toggles
    tbody.querySelectorAll('.toggle-variants-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.productId;
        const row = document.getElementById(`variants-row-${pid}`);
        const icon = btn.querySelector('svg');
        const isCollapsed = row.classList.contains('hidden');

        if (isCollapsed) {
          row.classList.remove('hidden');
          icon.classList.add('rotate-90');
          // lazy render variants
          renderVariantsForProduct(pid);
        } else {
          row.classList.add('hidden');
          icon.classList.remove('rotate-90');
        }
      });
    });
  }

  // Initial render
  renderTable();

  // Event Listeners
  searchInput.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    renderTable();
  });

  categoryFilter.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    renderTable();
  });

  issueFilter.addEventListener('change', (e) => {
    selectedIssue = e.target.value;
    renderTable();
  });
</script>
```

- [ ] **Step 3: Test and Commit**

Run: `npm run build`
Expected: Pass.

```bash
git add src/pages/admin/products/audit.astro
git commit -m "admin: add search and filter fields with client-side query matching"
```

---

### Task 4: Variant Inline Layout

**Files:**
- Modify: `src/pages/admin/products/audit.astro`
- Test: Open `/admin/products/audit`, expand a product, and verify list of variants is rendered inside.

- [ ] **Step 1: Implement `renderVariantsForProduct` function in Javascript**

Add the `renderVariantsForProduct` renderer under the filter logic. It should layout each variant with editable input fields for name, product URL, JPY price, dynamic IDR preview, image URL, and R2 file selector trigger.

```html
<script define:vars={{ rate, fee, products }}>
  // Place this function inside the <script> tags in audit.astro
  
  function getVariantCountWithIssue(productId) {
    const p = products.find(p => p.id === productId);
    if (!p) return { missingLinks: 0, missingImages: 0 };
    let missingLinks = 0;
    let missingImages = 0;
    p.variants.forEach(v => {
      if (!v.product_url) missingLinks++;
      if (!v.images || v.images.length === 0) missingImages++;
    });
    return { missingLinks, missingImages };
  }

  function recalculateProductIssues(productId) {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    const { missingLinks, missingImages } = getVariantCountWithIssue(productId);
    p.missing_links = missingLinks;
    p.missing_images = missingImages;

    // Update row warning badge dynamically
    const mainRow = document.querySelector(`.product-row[data-product-id="${productId}"]`);
    if (mainRow) {
      const statusTd = mainRow.querySelector('td:last-child');
      const warningBadges = [];
      if (p.missing_links > 0) warningBadges.push(`<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold">Tanpa Link</span>`);
      if (p.missing_images > 0) warningBadges.push(`<span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-semibold">Tanpa Foto</span>`);
      if (statusTd) {
        statusTd.innerHTML = warningBadges.length > 0 ? warningBadges.join(' ') : `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">Lengkap</span>`;
      }
    }
  }

  function renderVariantsForProduct(productId) {
    const p = products.find(prod => prod.id === productId);
    const container = document.getElementById(`variants-container-${productId}`);
    if (!p || !container) return;

    if (!p.variants || p.variants.length === 0) {
      container.innerHTML = `
        <div class="text-[0.8125rem] text-[#5B606D] py-2">Belum ada varian. Gunakan form di bawah untuk menambah.</div>
        ${renderQuickAddFormHtml(productId)}
      `;
      attachQuickAddListeners(productId);
      return;
    }

    const listHtml = p.variants.map(v => {
      const vImg = v.images?.[0] ?? '';
      const jpy = v.price_jpy ?? 0;
      const idrEst = Math.ceil(jpy * rate * (1 + fee / 100) / 1000) * 1000;
      const previewStyle = vImg ? `background-image: url('${vImg}'); background-size: cover; background-position: center;` : '';

      return `
        <div class="flex flex-col md:flex-row gap-3 items-center p-3 bg-white border border-[#E8E9ED] rounded-[6px]" data-variant-id="${v.id}">
          
          <!-- Column 1: Image Control -->
          <div class="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <div class="w-12 h-12 rounded border border-[#E8E9ED] bg-[#F1F2F5] flex items-center justify-center overflow-hidden shrink-0 variant-img-preview-box" style="${previewStyle}">
              ${vImg ? '' : `<svg class="w-5 h-5 text-[#5B606D] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`}
            </div>
            <div class="flex flex-col gap-1 w-full">
              <input type="text" value="${vImg}" placeholder="Image URL" class="h-[28px] px-1.5 border border-[#E8E9ED] rounded-[4px] text-[0.75rem] focus:outline-none focus:ring-1 focus:ring-[#1A8F89] w-full md:w-[150px] variant-img-input" />
              <button type="button" class="h-[24px] px-2 bg-[#F1F2F5] hover:bg-[#E8E9ED] text-[#1A1D23] rounded-[4px] text-[0.6875rem] font-semibold w-full md:w-[150px] btn-upload-variant-photo">Upload Foto</button>
              <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden variant-file-selector" />
            </div>
          </div>

          <!-- Column 2: Name Input -->
          <div class="flex flex-col gap-1 w-full">
            <label class="text-[0.6875rem] text-[#5B606D] font-semibold">Nama Varian</label>
            <input type="text" value="${v.variant_name}" class="h-[36px] px-2.5 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] w-full variant-name-input" />
          </div>

          <!-- Column 3: Source URL & Direct Click -->
          <div class="flex flex-col gap-1 w-full">
            <label class="text-[0.6875rem] text-[#5B606D] font-semibold">URL Link</label>
            <div class="flex gap-1.5">
              <input type="text" value="${v.product_url ?? ''}" class="h-[36px] px-2.5 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] w-full variant-url-input" placeholder="http://..." />
              <a href="${v.product_url ?? '#'}" target="_blank" class="h-[36px] px-3 bg-[#F1F2F5] border border-[#E8E9ED] rounded-[6px] flex items-center justify-center text-[#5B606D] hover:text-[#1A1D23] variant-link-btn select-none ${v.product_url ? '' : 'opacity-40 pointer-events-none'}">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>

          <!-- Column 4: Price JPY & live IDR estimate -->
          <div class="flex gap-2 items-center w-full md:w-auto shrink-0">
            <div class="flex flex-col gap-1">
              <label class="text-[0.6875rem] text-[#5B606D] font-semibold">JPY Price</label>
              <input type="number" value="${jpy}" min="0" class="h-[36px] w-[80px] px-2 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] font-mono variant-price-input" />
            </div>
            <div class="flex flex-col gap-1 shrink-0">
              <label class="text-[0.6875rem] text-[#5B606D] font-semibold">Est. IDR</label>
              <span class="h-[36px] flex items-center px-1 font-mono text-[0.8125rem] text-[#0F726E] font-semibold variant-idr-preview">
                Rp ${idrEst.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <!-- Column 5: Action buttons -->
          <div class="flex md:flex-col gap-1.5 w-full md:w-auto shrink-0 justify-end mt-4 md:mt-0">
            <button type="button" class="h-[32px] px-3 bg-[#0F726E] hover:bg-[#0A5D59] text-white font-semibold rounded-[6px] text-xs transition-colors btn-save-variant flex items-center justify-center gap-1.5 w-full md:w-[80px]">
              Simpan
            </button>
            <button type="button" class="h-[32px] px-3 border border-[#E8E9ED] hover:bg-[#FDEDEC] text-[#D1453B] font-semibold rounded-[6px] text-xs transition-colors btn-delete-variant w-full md:w-[80px]">
              Hapus
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="flex flex-col gap-2.5">
        ${listHtml}
      </div>
      <div class="border-t border-[#E8E9ED] pt-4 mt-2">
        <h4 class="text-[0.8125rem] font-bold text-[#1A1D23] mb-3">Tambah Varian Baru</h4>
        ${renderQuickAddFormHtml(productId)}
      </div>
    `;

    attachVariantActionListeners(productId);
  }
</script>
```

- [ ] **Step 2: Add placeholder functions for form rendering**

Add the helper `renderQuickAddFormHtml(productId)` function inside the `<script>` tag.

```html
<script define:vars={{ rate, fee, products }}>
  // Place inside script tag
  function renderQuickAddFormHtml(productId) {
    return `
      <div class="flex flex-col md:flex-row gap-3 items-center p-3 bg-[#F9F9F7] border border-[#E8E9ED] rounded-[6px] quick-add-row" id="quick-add-form-${productId}">
        <div class="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <div class="w-10 h-10 rounded border border-[#E8E9ED] bg-[#F1F2F5] flex items-center justify-center overflow-hidden shrink-0 quick-add-preview">
            <svg class="w-4 h-4 text-[#5B606D] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div class="flex flex-col gap-1 w-full">
            <input type="text" placeholder="URL Foto" class="h-[28px] px-1.5 border border-[#E8E9ED] rounded-[4px] text-[0.75rem] focus:outline-none focus:ring-1 focus:ring-[#1A8F89] w-full md:w-[130px] qa-img-input" />
            <button type="button" class="h-[24px] px-2 bg-white border border-[#E8E9ED] hover:bg-[#F1F2F5] text-[#1A1D23] rounded-[4px] text-[0.6875rem] font-semibold w-full md:w-[130px] btn-qa-upload">Upload</button>
            <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden qa-file-selector" />
          </div>
        </div>

        <div class="flex flex-col gap-1 w-full">
          <input type="text" placeholder="Nama Varian *" class="h-[36px] px-2.5 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] w-full qa-name-input" />
        </div>

        <div class="flex flex-col gap-1 w-full">
          <input type="text" placeholder="Source URL (opsional)" class="h-[36px] px-2.5 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] w-full qa-url-input" />
        </div>

        <div class="flex gap-2 items-center w-full md:w-auto shrink-0">
          <div class="flex flex-col gap-1">
            <input type="number" placeholder="JPY *" min="0" class="h-[36px] w-[80px] px-2 border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] font-mono qa-price-input" />
          </div>
          <span class="font-mono text-[0.8125rem] text-[#0F726E] font-semibold qa-idr-preview w-[100px]">Rp 0</span>
        </div>

        <button type="button" class="h-[36px] px-4 bg-[#0F726E] hover:bg-[#0A5D59] text-white font-semibold rounded-[6px] text-xs transition-colors btn-submit-qa w-full md:w-[110px]">
          Tambah Varian
        </button>
      </div>
    `;
  }
</script>
```

- [ ] **Step 3: Test build**

Run: `npm run build`
Expected: Successful compile.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/products/audit.astro
git commit -m "admin: structure expanded variants list renderer"
```

---

### Task 5: Interactive Save, Update, and Image Upload

**Files:**
- Modify: `src/pages/admin/products/audit.astro`
- Test: Build and run. Expand a product, change its variant price, click save, verify network tab PUT request succeeds, and page doesn't refresh. Verify IDR preview updates dynamically.

- [ ] **Step 1: Implement action handlers**

Implement `attachVariantActionListeners(productId)` inside the `<script>` tag. Write fetch controllers to PUT updating data to Hono routes and handling image file selection.

```html
<script define:vars={{ rate, fee, products }}>
  // Add this inside the script tag

  function attachVariantActionListeners(productId) {
    const p = products.find(prod => prod.id === productId);
    const container = document.getElementById(`variants-container-${productId}`);
    if (!p || !container) return;

    // Attach JPY change dynamic estimation listener
    container.querySelectorAll('.variant-price-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const row = e.target.closest('[data-variant-id]');
        const vid = row.dataset.variantId;
        const jpy = parseInt(e.target.value) || 0;
        const idrEst = Math.ceil(jpy * rate * (1 + fee / 100) / 1000) * 1000;
        
        const previewEl = row.querySelector('.variant-idr-preview');
        if (previewEl) {
          previewEl.textContent = `Rp ${idrEst.toLocaleString('id-ID')}`;
        }
      });
    });

    // Attach Image URL manual input listener
    container.querySelectorAll('.variant-img-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const row = e.target.closest('[data-variant-id]');
        const previewBox = row.querySelector('.variant-img-preview-box');
        const url = e.target.value;
        if (previewBox) {
          if (url) {
            previewBox.style.backgroundImage = `url('${url}')`;
            previewBox.style.backgroundSize = 'cover';
            previewBox.style.backgroundPosition = 'center';
            previewBox.innerHTML = '';
          } else {
            previewBox.style.backgroundImage = '';
            previewBox.innerHTML = `<svg class="w-5 h-5 text-[#5B606D] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
          }
        }
      });
    });

    // Attach URL text input external link updates
    container.querySelectorAll('.variant-url-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const row = e.target.closest('[data-variant-id]');
        const linkBtn = row.querySelector('.variant-link-btn');
        const url = e.target.value;
        if (linkBtn) {
          if (url) {
            linkBtn.href = url;
            linkBtn.classList.remove('opacity-40', 'pointer-events-none');
          } else {
            linkBtn.href = '#';
            linkBtn.classList.add('opacity-40', 'pointer-events-none');
          }
        }
      });
    });

    // Attach Photo Upload Selector triggers
    container.querySelectorAll('.btn-upload-variant-photo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('[data-variant-id]');
        const fileSelector = row.querySelector('.variant-file-selector');
        fileSelector.click();
      });
    });

    // Upload to API handler
    container.querySelectorAll('.variant-file-selector').forEach(fileSelector => {
      fileSelector.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const row = e.target.closest('[data-variant-id]');
        const imgInput = row.querySelector('.variant-img-input');
        const previewBox = row.querySelector('.variant-img-preview-box');
        const uploadBtn = row.querySelector('.btn-upload-variant-photo');

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const formData = new FormData();
        formData.append('file', file);

        try {
          const res = await fetch('/api/products/upload-photo', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Upload failed');
          }

          const data = await res.json();
          imgInput.value = data.url;
          
          // update preview box
          previewBox.style.backgroundImage = `url('${data.url}')`;
          previewBox.style.backgroundSize = 'cover';
          previewBox.style.backgroundPosition = 'center';
          previewBox.innerHTML = '';

        } catch (err) {
          alert(`Gagal upload: ${err.message}`);
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload Foto';
        }
      });
    });

    // Attach Save buttons
    container.querySelectorAll('.btn-save-variant').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('[data-variant-id]');
        const vid = row.dataset.variantId;
        const nameVal = row.querySelector('.variant-name-input').value.trim();
        const urlVal = row.querySelector('.variant-url-input').value.trim();
        const priceVal = parseInt(row.querySelector('.variant-price-input').value) || 0;
        const imgVal = row.querySelector('.variant-img-input').value.trim();

        if (!nameVal) {
          alert('Nama varian wajib diisi');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          const res = await fetch(`/api/products/${productId}/variants/${vid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variant_name: nameVal,
              product_url: urlVal || null,
              price_jpy: priceVal,
              images: imgVal ? [imgVal] : []
            })
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Gagal menyimpan perubahan');
          }

          const updatedVar = await res.json();
          
          // Update in-memory state
          const vIdx = p.variants.findIndex(v => v.id === vid);
          if (vIdx !== -1) {
            p.variants[vIdx] = {
              ...p.variants[vIdx],
              variant_name: updatedVar.variant_name,
              product_url: updatedVar.product_url,
              price_jpy: updatedVar.price_jpy,
              images: (() => { try { return JSON.parse(updatedVar.images || '[]'); } catch { return []; } })()
            };
          }

          recalculateProductIssues(productId);

          btn.textContent = 'Selesai!';
          btn.classList.remove('bg-[#0F726E]', 'hover:bg-[#0A5D59]');
          btn.classList.add('bg-emerald-600');

          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Simpan';
            btn.classList.remove('bg-emerald-600');
            btn.classList.add('bg-[#0F726E]', 'hover:bg-[#0A5D59]');
          }, 1500);

        } catch (err) {
          alert(`Error: ${err.message}`);
          btn.disabled = false;
          btn.textContent = 'Simpan';
        }
      });
    });

    // Attach Delete buttons
    container.querySelectorAll('.btn-delete-variant').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('[data-variant-id]');
        const vid = row.dataset.variantId;

        if (!confirm('Apakah Anda yakin ingin menghapus varian ini?')) return;

        btn.disabled = true;

        try {
          const res = await fetch(`/api/products/${productId}/variants/${vid}`, {
            method: 'DELETE'
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Gagal menghapus varian');
          }

          // Remove from memory
          p.variants = p.variants.filter(v => v.id !== vid);
          
          // Re-render
          renderVariantsForProduct(productId);
          recalculateProductIssues(productId);

        } catch (err) {
          alert(`Error: ${err.message}`);
          btn.disabled = false;
        }
      });
    });
  }
</script>
```

- [ ] **Step 2: Run build to verify JS structure**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/products/audit.astro
git commit -m "admin: wire up save, delete, and R2 uploads with backend Hono endpoints"
```

---

### Task 6: Quick Add Varian Flow

**Files:**
- Modify: `src/pages/admin/products/audit.astro`
- Test: Open `/admin/products/audit`. Expand a product, fill out name and price in "Tambah Varian Baru" section, and click "Tambah Varian". Verify it makes a POST request to `/api/products/:id/variants` and appends the row dynamically with success.

- [ ] **Step 1: Implement quick add logic inside `<script>`**

Add quick add event listeners to `src/pages/admin/products/audit.astro` under the existing JS handlers.

```html
<script define:vars={{ rate, fee, products }}>
  // Place inside script tag

  function attachQuickAddListeners(productId) {
    const p = products.find(prod => prod.id === productId);
    const form = document.getElementById(`quick-add-form-${productId}`);
    if (!p || !form) return;

    const jpyInput = form.querySelector('.qa-price-input');
    const idrPreview = form.querySelector('.qa-idr-preview');
    const fileSelector = form.querySelector('.qa-file-selector');
    const uploadBtn = form.querySelector('.btn-qa-upload');
    const imgInput = form.querySelector('.qa-img-input');
    const previewBox = form.querySelector('.quick-add-preview');
    const submitBtn = form.querySelector('.btn-submit-qa');

    // Estimate calculation on input
    jpyInput.addEventListener('input', (e) => {
      const jpy = parseInt(e.target.value) || 0;
      const idrEst = Math.ceil(jpy * rate * (1 + fee / 100) / 1000) * 1000;
      idrPreview.textContent = `Rp ${idrEst.toLocaleString('id-ID')}`;
    });

    // Image upload trigger
    uploadBtn.addEventListener('click', () => fileSelector.click());

    fileSelector.addEventListener('change', async () => {
      const file = fileSelector.files?.[0];
      if (!file) return;

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/products/upload-photo', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data = await res.json();
        imgInput.value = data.url;
        previewBox.style.backgroundImage = `url('${data.url}')`;
        previewBox.style.backgroundSize = 'cover';
        previewBox.style.backgroundPosition = 'center';
        previewBox.innerHTML = '';
      } catch (err) {
        alert(`Gagal upload: ${err.message}`);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
      }
    });

    // Direct Image URL change preview
    imgInput.addEventListener('input', (e) => {
      const url = e.target.value;
      if (url) {
        previewBox.style.backgroundImage = `url('${url}')`;
        previewBox.style.backgroundSize = 'cover';
        previewBox.style.backgroundPosition = 'center';
        previewBox.innerHTML = '';
      } else {
        previewBox.style.backgroundImage = '';
        previewBox.innerHTML = `<svg class="w-4 h-4 text-[#5B606D] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
      }
    });

    // Add Varian submit handler
    submitBtn.addEventListener('click', async () => {
      const nameVal = form.querySelector('.qa-name-input').value.trim();
      const urlVal = form.querySelector('.qa-url-input').value.trim();
      const priceVal = parseInt(jpyInput.value) || 0;
      const imgVal = imgInput.value.trim();

      if (!nameVal) {
        alert('Nama varian wajib diisi');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';

      try {
        const res = await fetch(`/api/products/${productId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant_name: nameVal,
            product_url: urlVal || null,
            price_jpy: priceVal,
            images: imgVal ? [imgVal] : []
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menambahkan varian');
        }

        const created = await res.json();
        
        // Push to memory state
        p.variants.push({
          ...created,
          images: (() => { try { return JSON.parse(created.images || '[]'); } catch { return []; } })()
        });

        recalculateProductIssues(productId);
        
        // Re-render
        renderVariantsForProduct(productId);

      } catch (err) {
        alert(`Error: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Tambah Varian';
      }
    });
  }

  // Update variant listeners dispatcher to also attach quick add listeners
  function attachVariantActionListeners(productId) {
    // Keep implementation from previous task, then call:
    attachQuickAddListeners(productId);
  }
</script>
```

- [ ] **Step 2: Run build to verify script output**

Run: `npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/products/audit.astro
git commit -m "admin: add quick-add variant inline form and endpoint submission"
```

---

### Task 7: Playwright E2E Integration Testing

**Files:**
- Modify: `tests/e2e.spec.ts`
- Test: Run `npm test` and verify that the whole suite, including the new audit tests, passes.

- [ ] **Step 1: Add new test suite for catalog audit page**

Append a new describe block at the end of `tests/e2e.spec.ts` targeting `/admin/products/audit`. Add tests to navigate as admin, search products, toggle variants display, update a variant price, assert IDR calculations and successful database persistence.

```typescript
// Add at the end of tests/e2e.spec.ts
test.describe('CUJ-X: Catalog Links and Pricing Audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products/audit');
  });

  test('navigation to page works and layout is rendered', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Audit Katalog');
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('#category-filter')).toBeVisible();
    await expect(page.locator('#issue-filter')).toBeVisible();
  });

  test('can expand product, change JPY price, and save it', async ({ page }) => {
    // Find first toggle button and click it
    const toggleBtn = page.locator('.toggle-variants-btn').first();
    await toggleBtn.click();

    // Check if variant container is visible
    const firstProductRow = page.locator('.product-row').first();
    const productId = await firstProductRow.getAttribute('data-product-id');
    const container = page.locator(`#variants-row-${productId}`);
    await expect(container).toBeVisible();

    // Change variant JPY price
    const priceInput = container.locator('.variant-price-input').first();
    const oldPriceStr = await priceInput.inputValue();
    const newPriceVal = (parseInt(oldPriceStr) || 100) + 10;
    
    await priceInput.fill(newPriceVal.toString());

    // Trigger save
    const saveBtn = container.locator('.btn-save-variant').first();
    await saveBtn.click();
    await expect(saveBtn).toContainText('Selesai!');

    // Re-verify value after page reload to confirm database persistence
    await page.reload();
    await page.locator('.toggle-variants-btn').first().click();
    const updatedPriceStr = await page.locator('.variant-price-input').first().inputValue();
    expect(parseInt(updatedPriceStr)).toBe(newPriceVal);
  });
});
```

- [ ] **Step 2: Run test suite**

Run: `npm test`
Expected: Playwright tests compile and all 20+ tests pass, including the new CUJ-X tests.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.spec.ts
git commit -m "test: add playwright E2E integration tests for catalog audit flow"
```
