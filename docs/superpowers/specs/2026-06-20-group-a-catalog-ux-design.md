# Group A — Catalog & Ordering UX

**Date:** 2026-06-20
**Branch target:** `feature/order-flow-info` (or a fresh `feature/catalog-ux`)
**Status:** Design — pending implementation plan

Scope: five catalog/ordering improvements plus one bug fix, all touching the catalog surface.
Each section maps to concrete files. Implementation order follows section numbering.

---

## A0 — Schema migration

**File:** `db/migration_v07_catalog_media_tags.sql`

Two additions:

1. Per-variant images — mirror the parent `products.images` pattern:
   ```sql
   ALTER TABLE product_variants ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
   ```
   Stored as a JSON array of R2 URLs. Empty array = "use parent product images".

2. Tagging — master table + junction (normalized, so the admin can rename/delete a tag centrally):
   ```sql
   CREATE TABLE IF NOT EXISTS tags (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL UNIQUE,
     created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE IF NOT EXISTS product_tags (
     product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     tag_id      TEXT NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
     PRIMARY KEY (product_id, tag_id)
   );
   CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);
   ```

   Junction (not a JSON array on `products`) because the user asked for a master
   table managed centrally. Deleting a tag cascades to unlink via `ON DELETE CASCADE`.

**File:** `src/lib/types.ts`
- `ProductVariant` gains `images: string[]`.
- `Product` gains `tags: { id: string; name: string }[]`.
- DB rows return `images`/tag rows as raw JSON/columns; parsing stays at the call site
  (matching the existing `images` parse pattern) — no type change to the raw row shape.

---

## A1 — Grid columns

**File:** `src/pages/catalog/index.astro`

Replace the grid class in two places — the initial markup (`:248`) and the `render()` JS (`:412`):

```
grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-[12px] sm:gap-[24px]
```

- Mobile (<768): **2 cols**
- iPad / tablet (≥768, <1280): **4 cols**
- Desktop (≥1280): **5 cols**

The `md`/`xl` breakpoints cover iPad portrait (768) and landscape (1024) at 4 cols,
stepping to 5 only on wide desktop. List-view branch (`flex flex-col`) unchanged.

---

## A2 — Card divider spacing

**File:** `src/pages/catalog/index.astro` → `renderCard()` grid branch

Symptom: the `border-t` divider above "Harga estimasi. Final konfirmasi setelah beli."
sits too close to the IDR/JPY price block.

Fix: add explicit top margin to the disclaimer paragraph so the divider never hugs the
price. Change the `mt-auto pt-[8px] sm:pt-[12px] border-t` paragraph to
`mt-auto pt-[8px] sm:pt-[12px] mt-[16px] sm:mt-[24px] border-t` (exact value tuned by
eye in dev server). The `mt-auto` still pins it to the card bottom; the added margin
guarantees a minimum gap between price and the divider.

List-view branch is unaffected (it has no divider).

---

## A3 — Multi-image (parent + variant)

### A3.1 Admin modal — parent gallery uploader
**File:** `src/pages/admin/products.astro`

Current behavior: the uploader replaces `images[]` with a single URL
(`imagesJsonInput.value = JSON.stringify([data.url])` at `:392`) and the preview shows one image.

New behavior: "Pilih Foto" **appends** to `images[]`. Replace the single-thumbnail preview
(`#image-preview-container`) with a horizontal thumbnail list — each uploaded image rendered
as a small tile with an × button that removes it from the array and re-renders the list.
`imagesJsonInput` always reflects the full array. On edit, seed the list from the product's
existing `images`.

### A3.2 Admin modal — per-variant image picker
**File:** `src/pages/admin/products.astro` → `renderVariantRows()`

Each variant row gains a small image control: a thumbnail + "Foto" button + × remove.
Add a per-row upload that POSTs to the existing `/api/products/upload-photo` and pushes
the returned URL into that variant's `images[]`. Variants store their own `images` array.
The variant row model (`variantRows`) gains `images: string[]`.

### A3.3 API
**File:** `src/pages/api/[...path].ts`

- Variant create (`POST /api/products/:id/variants`) and update
  (`PUT /api/products/:id/variants/:vid`) accept and persist `images` (JSON array).
- Variant reads (`GET /api/products/:id`, single-product fetches) return `images` parsed
  to an array. Parent product reads already return `images`.
- No new endpoints for image upload — reuse `/api/products/upload-photo`.

### A3.4 Detail page gallery swap
**File:** `src/pages/catalog/[id].astro`

When a variant pill is selected, the gallery switches to **that variant's images** if it has
any; otherwise it falls back to the parent product's images. Concretely: the variant pill's
dataset carries its image list (or we look it up from a JS map of `variantId → images[]`),
and the click handler rebuilds `#main-product-image` + the `#thumbnail-strip`. The existing
thumbnail-strip click handler continues to drive the main image.

### A3.5 Mobile sheet gallery swap
**File:** `src/pages/catalog/index.astro` → `buildSheet()` / variant pill handler

Selecting a variant in the bottom sheet swaps `#sheet` main image to the variant's first
image (fallback: parent image). If the selected variant has multiple images, render a mini
horizontal thumbnail row above the price box; tapping a thumb swaps the sheet main image.

The catalog grid card continues to show `product.images[0]` (unchanged).

---

## A4 — Tagging (master table + junction)

### A4.1 Admin modal — tag chips
**File:** `src/pages/admin/products.astro`

Add a "Tag" control to the product modal: a chip input backed by the master `tags` table.
- On modal open, fetch `GET /api/tags` for the autocomplete list.
- Typing shows matching existing tags; Enter adds the chip.
- If a typed value has no match, it is **created** in the master `tags` table on product
  save (`POST /api/tags`), then linked.
- Selected tags render as removable chips (× unlinks).
- Selected tag IDs are sent in the product create/update body as `tag_ids: string[]`.

### A4.2 Tag API + management page
**Files:** `src/pages/api/[...path].ts`, new `src/pages/admin/master/tags.astro`, `src/pages/admin/layout.astro`

- `GET /api/tags` → `[{id, name}]`.
- `POST /api/tags` → create (`{name}`) or rename (`{id, name}`).
- `DELETE /api/tags/:id` → delete tag (junction rows cascade).
- Product create/update accept `tag_ids`; product GET returns `tags: [{id,name}]` (joined).
- Tag management lives on a new **Master Data** page `/admin/master/tags` (list + rename +
  delete + "Tambah Tag"). The Master Data nav group is introduced here and shared with
  Group B — see [Group B spec](./2026-06-20-group-b-product-notes-design.md). The nav group
  in `admin/layout.astro` has sub-items Categories, Tags, Note Templates; Group B adds
  Categories (moved from Settings) and Note Templates, Group A adds Tags.

### A4.3 Catalog card — tag chips
**File:** `src/pages/catalog/index.astro` → `renderCard()`

Render up to 3 tag chips under the product name; if the product has more, show "+N".
Chips are small, muted (`bg-[#F1F2F5] text-[#5B606D]`), consistent with the category badge.
Applies to both grid and list cards (list card: inline after the name, max 2 to save space).

### A4.4 Catalog filter — tag dropdown
**File:** `src/pages/catalog/index.astro`

A second multi-select dropdown mirroring the existing category dropdown, placed **inside the
collapsible filter group immediately after the categories dropdown**. Populated from the full
master tag list (`GET /api/tags`), rendered server-side into the page like the category list.
AND-combined with category and
search: a product must match the selected categories (or all), selected tags (or all), and
the search query. The `getFilteredProducts()` function gains a `selectedTags: Set<string>`
filter; `updateFilterSummary()` includes selected tags.

### A4.5 Search matches tags
**File:** `src/pages/catalog/index.astro` → `getFilteredProducts()`

The search box (`#search-input`) now matches a product when the query is a substring of the
name **or** any tag name (case-insensitive), in addition to the existing name match.

---

## A5 — Mobile/iPad add-to-order confirm-dialog bug

### Root cause
On viewports ≤ `MOBILE_BREAKPOINT` (1024), card taps open the bottom sheet
(`catalog/index.astro:876`) instead of navigating to the detail page. The sheet's order button
(`sheet-order-btn`, `:755`) POSTs `/api/orders` **directly**, skipping two guards that the
desktop detail page (`[id].astro`) enforces:
1. The WhatsApp-number gate dialog (`#wa-dialog`).
2. The order confirmation dialog (`#confirm-order-dialog`).

The breakpoint is `1024`, so **iPad portrait (768) and landscape (1024) both hit this bug**
— the fix must cover the full ≤1024 range, not just phones.

### Fix
**File:** `src/pages/catalog/index.astro`

1. Port the `#wa-dialog` and `#confirm-order-dialog` `<dialog>` markup from
   `src/pages/catalog/[id].astro` (lines 247–334) into `catalog/index.astro`, since the
   bottom sheet lives here and these dialogs don't currently exist on this page.
2. Track the current `waNumber` (from `Astro.locals.user.whatsapp_number`, passed into the
   page's `<script define:vars>`).
3. Rewrite the `sheet-order-btn` click handler to the same flow as the detail page:
   - If `waNumber` missing → open `#wa-dialog`. On its submit (`PATCH /api/orders/me/whatsapp`),
     store the number, then open `#confirm-order-dialog`.
   - Else → open `#confirm-order-dialog` directly.
   - `#confirm-order-btn` → close dialog, POST `/api/orders` with the sheet's
     `{ product_id, variant_id: activeVariantId, qty: sheetQty }`, then toast + close sheet
     + `refreshOrderBadge()`.
4. The WA-number requirement and confirmation copy are identical to the detail page —
   no behavior fork between phone and iPad.

No change to the desktop (≥1024) flow, which already goes through the detail page.

---

## Testing

**File:** `tests/e2e.spec.ts` — add CUJ suites (match existing style, `data-testid` selectors,
mock external systems, clean up):

1. **Mobile/iPad add-to-order confirm gate** — at a ≤1024 viewport, tapping a card opens the
   sheet; tapping the sheet order button opens the WA dialog (when no WA on file) then the
   confirm dialog; the order is not created until "Ya, Tambah Pesanan" is tapped.
2. **Filter by tag** — selecting a tag in the dropdown narrows the grid to tagged products;
   combined category+tag filter is AND.
3. **Search matches tag** — typing a tag name surfaces products with that tag.
4. **Variant image swap (detail)** — selecting a variant with its own images swaps the main
   gallery; selecting one without falls back to parent images.
5. **Multi-image admin upload** — admin uploads multiple parent images and a variant image;
   they persist and render.

No new business-logic helpers are required; if none are introduced, no unit tests are added.
JSON parsing of `images`/tags reuses the existing `try/catch JSON.parse` pattern.

---

## Out of scope (other groups)

- **Group B** — admin-set per-product description badges shown as a list in the Tambah Pesanan
  confirm dialog (e.g. "kotak terpisah", "coklat diusahakan tidak meleleh"). Designed next.
- **Group C** — product web link on the admin orders page; AI assistant token + `skill.md`.
