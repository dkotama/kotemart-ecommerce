# Group B — Product Note Badges + Master Data Restructure

**Date:** 2026-06-20
**Branch target:** `feature/order-flow-info` (or a fresh branch)
**Status:** Design — pending implementation plan
**Depends on:** Group A (A5 ports the confirm dialog to `catalog/index.astro`, where notes must
also render; A4.2 introduces the Master Data nav group this spec shares).

## Goal

Admin attaches multiple descriptive/handling notes to a product (e.g. "Kotak terpisah",
"Coklat diusahakan tidak meleleh"), chosen from a template library plus free text. The buyer
sees these notes as a list inside the **Tambah Pesanan** confirmation dialog. Showing them is
the buyer's explicit acceptance of the condition. **Display-only** — notes are not stored on
the order (admin already knows them, having set them).

Distinct from tags: notes are longer, buyer-facing handling notices, not search/filter labels.

---

## B0 — Schema

**File:** `db/migration_v08_product_notes.sql` (or folded into v07 if Group A hasn't shipped)

```sql
ALTER TABLE products ADD COLUMN notes TEXT NOT NULL DEFAULT '[]';
```
JSON array of strings, mirroring the `images` pattern.

**File:** `src/lib/pricing.ts` — extend `getSettings`:
- Add `'note_templates'` to the `WHERE key IN (...)` list (`:62`).
- Parse to `string[]` with a `MASTER_NOTES` default (empty array), same shape as
  `product_categories` (`:70-75`).
- Return `note_templates` from `getSettings`.

**File:** `src/lib/types.ts`
- `Product.notes: string[]`.
- `Settings.note_templates: string[]`.

---

## B1 — Master Data admin section (shared with Group A)

**File:** `src/pages/admin/layout.astro`

Introduce a **Master Data** nav group with three sub-items:

| Sub-page | Route | Manages | Source |
|----------|-------|---------|--------|
| Categories | `/admin/master/categories` | `settings.product_categories` | Moved from `/admin/settings` (B2) |
| Tags | `/admin/master/tags` | master `tags` table | Group A (A4.2) |
| Note Templates | `/admin/master/notes` | `settings.note_templates` | New (B3) |

Render as a collapsible group in the sidebar (parent "Master Data", three children). Existing
top-level nav items (Orders, Products, Profit, Settings, Users) remain.

---

## B2 — Move category management out of Settings

**Files:** `src/pages/admin/settings.astro`, new `src/pages/admin/master/categories.astro`

- Extract the category list-editor UI from `/admin/settings` into the new
  `/admin/master/categories` page (same add/remove/edit behavior, same backing
  `settings.product_categories` key — no API change).
- `/admin/settings` drops the categories section (other settings untouched).

---

## B3 — Note Templates master page

**File:** new `src/pages/admin/master/notes.astro`

List-editor for `note_templates` — add / rename / remove template wordings. Same UI pattern as
the categories editor. Backed by `settings.note_templates` (read via `getSettings`, written via
the existing `PUT /api/admin/settings` at `api/[...path].ts:885`). Add `note_templates` to that
route's `updateSettingsSchema` (`:878`) and handler (`:894`), mirroring `product_categories`.

---

## B4 — Admin product modal: notes control

**File:** `src/pages/admin/products.astro`

Add a "Catatan Produk" section to the product modal:
- Template quick-pick: render `note_templates` as chips; clicking adds the wording to the
  product's notes.
- Free-text: a text input + "Tambah" button to add a custom one-off note.
- Selected notes render as removable chips (× removes).
- On save, send `notes: string[]` in the product create/update body.
- On edit, seed chips from the product's existing `notes`.

**API** (`src/pages/api/[...path].ts`): product create/update accept and persist `notes`;
product GET returns `notes` parsed to an array.

---

## B5 — Buyer: notes in the confirm dialog (display-only)

The confirm dialog (`#confirm-order-dialog`) gains a notes section. When the product being
ordered has `notes.length > 0`, render them as a `<ul>` of info-styled list items (small info
icon + wording) inside the dialog's existing info box. No notes → section hidden.

The dialog needs the current product's notes:

- **Detail page** (`src/pages/catalog/[id].astro`): pass `product.notes` into the confirm-open
  flow (the `<script define:vars>` already passes product data) and render the list when the
  dialog opens.
- **Catalog index mobile/iPad** (`src/pages/catalog/index.astro`): after Group A's A5 ports the
  confirm dialog here, pass the sheet product's `notes` into the dialog open. The product data
  is already available client-side in `productsWithIdr`; ensure `notes` is included in the
  server-side product payload for this page.

Notes are **not** written to `orders.notes` or any order field — display-only.

---

## B6 — (Optional) Notes on the product detail page

Show the product's notes as small badges near the description on `/catalog/[id].astro`, so the
buyer sees them before even opening the confirm dialog. Low priority; defer if time-boxed.

---

## Testing

**File:** `tests/e2e.spec.ts` — add CUJ suites:

1. **Notes in confirm dialog** — a product with notes: opening the Tambah Pesanan confirm
   dialog lists each note; confirming creates the order (notes are display-only, not asserted
   on the order). A product without notes: the section is absent.
2. **Master Data editors** — add/remove a category on `/admin/master/categories`; add/remove a
   note template on `/admin/master/notes`; (Group A covers tag editor).

No new business-logic helpers required; no unit tests unless one is introduced.

---

## Out of scope

- Persisting notes onto the order (explicitly declined — display-only).
- **Group C** — product web link on the admin orders page; AI assistant token + `skill.md`.
