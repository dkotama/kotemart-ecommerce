# Order Flow Simplification, Down Payments & Site Info

**Date:** 2026-06-19
**Status:** Approved design, pending implementation plan

## Motivation

1. The current order flow (`Draft → Pending → Bought → Settled`) is confusing — the difference between "Bought" and "Settled" pricing is unclear to the admin. Consolidate the terminal states.
2. Buyers pay down payments (DP) before full settlement; the app has no way to track partial payments or show paid/unpaid status.
3. Banking info is hardcoded in `my-orders.astro`; it should be admin-editable.
4. No way to announce "barang tiba" (goods arrived) to buyers.
5. The site has no footer.

## Scope

Five independent changes:

1. Order flow simplification (remove `Settled`)
2. Down payment tracking per order
3. Configurable banking info
4. Arrival notification banner
5. Site-wide footer

---

## 1. Order Flow Simplification

### New status flow

`Draft → Pending → Bought` (terminal). `Cancelled` is allowed only from `Draft` or `Pending`.

**Removed:** `Settled` status.

### Transition semantics

| Transition | Trigger | Price updates (all optional, overwrite current value) |
|---|---|---|
| `Draft → Pending` | Admin accepts order | Admin sets/edits estimated IDR (`price_idr_estimate`). Custom orders still require `price_jpy`. |
| `Pending → Bought` | Admin records purchase | Admin sets actual `bought_price_jpy`, and optionally `price_idr_final`, `custom_fee_idr`, `manual_idr_override`. |

Each price update overwrites the current order value. No field is mandatory beyond the existing custom-order `price_jpy` requirement at Pending.

### Schema changes (`orders` table)

- Remove `Settled` from the `status` CHECK constraint (now `Draft, Pending, Bought, Cancelled`).
- Keep all existing columns. Repurpose `settled_at` as the "finalized/purchased" timestamp, set during the `Pending → Bought` transition. (Renaming the column would force a migration; keeping the name avoids churn. The semantic is "the order reached its final priced state.")
- `custom_fee_idr` and `manual_idr_override` are now set during the Bought transition instead of the removed Settle step. They still feed the profit report.

No columns are added or dropped for this section — only the CHECK constraint changes and semantics shift.

### API changes (`src/pages/api/[...path].ts`)

- `STATUS_ORDER` / `isForwardTransition`:
  - `Draft: 0, Pending: 1, Bought: 2, Cancelled: 99`.
  - Bought is terminal — no forward transition out of it.
- **Remove** `PATCH /api/admin/orders/:id/settle` and its `settleSchema`.
- **Merge** settle fields into the existing status endpoint. `PATCH /api/admin/orders/:id/status` schema becomes:
  - `status: z.enum(['Pending', 'Bought']).optional()`
  - `price_jpy: z.number().int().min(0).optional()` (custom orders, at Pending)
  - `bought_price_jpy: z.number().int().min(0).optional()` (at Bought)
  - `price_idr_final: z.number().int().min(0).optional()` (at Bought, optional)
  - `custom_fee_idr: z.number().int().min(0).optional()` (at Bought, optional)
  - `manual_idr_override: z.number().int().min(0).optional()` (at Bought, optional)
- When `status === 'Bought'`, set `settled_at = CURRENT_TIMESTAMP` along with any price fields.
- Profit report query changes `WHERE o.status = 'Settled'` → `WHERE o.status = 'Bought'`, and sorts by `settled_at`. Cancelled query unchanged.

### UI changes

**`src/pages/admin/orders.astro`:**
- Remove the Settle modal and its form handler.
- Bought modal gains optional fields: Final IDR price, Custom fee, Manual override (mirroring the old Settle modal fields).
- Status filter pills: remove "Settled".
- Action menu: `Bought` orders show no further actions (terminal) except nothing — Cancel also no longer offered from Bought. Cancel only from Draft/Pending.

**`src/pages/my-orders.astro`:**
- `STATUS_STEPS` becomes `['Draft', 'Pending', 'Bought']` (3 steps).
- `STATUS_INDEX` updated accordingly.
- "Total Tagihan" summary card filters by `status === 'Bought'` (was `Settled`), using `price_idr_final ?? price_idr_estimate`.

**`src/lib/types.ts`:**
- `OrderStatus` → `'Draft' | 'Pending' | 'Bought' | 'Cancelled'`.

---

## 2. Down Payment Tracking

### Approach

Single cumulative `paid_amount_idr` per order (Approach A from the design discussion). One number in, one DP threshold, derived display.

### Schema (`orders` table, two new columns)

- `down_payment_idr INTEGER` — the DP threshold. NULL until admin sets it.
- `paid_amount_idr INTEGER NOT NULL DEFAULT 0` — actual cumulative amount the buyer has paid.

### DP default computation

Computed lazily in the UI, not stored by default:
- Default = `ceilTo1000(currentPrice * 0.5)` where `currentPrice = price_idr_final ?? price_idr_estimate`.
- Uses the same rounding as `calcIdrEstimate` (ceil to nearest 1000).
- When admin opens the DP input, pre-fill with this default. On save, store the entered value. If admin never sets it, `down_payment_idr` stays NULL and "DP" is not shown.

Add a `ceilTo1000(value)` helper, or reuse the rounding inside `calcIdrEstimate` by extracting it. (Decision: add a small exported `ceilTo1000` in `src/lib/pricing.ts` and have `calcIdrEstimate` use it.)

### Display (buyer `my-orders.astro` + admin `orders.astro`)

Per order, compute:
- `total = (price_idr_final ?? price_idr_estimate) * qty`
- `remaining = total - paid_amount_idr`
- `dpMet = down_payment_idr !== null && paid_amount_idr >= down_payment_idr`

Show when `down_payment_idr !== null`:
- `DP: Rp {down_payment_idr}` with a badge **Terbayar** (green) if `dpMet`, else **Belum** (amber).
- `Sisa: Rp {remaining}` (remaining balance after what's been paid).

When `down_payment_idr === null` and `paid_amount_idr > 0`, show only `Terbayar: Rp {paid}` / `Sisa: Rp {remaining}`.

### Admin entry

A DP control accessible from any status (Draft, Pending, Bought). Implementation: add a "Down Payment" option to the order row's action menu (or a dedicated button). Opens a small modal with:
- DP amount input (pre-filled with default).
- Amount paid input (defaults to current `paid_amount_idr`).

New endpoint: `PATCH /api/admin/orders/:id/payment` accepting `down_payment_idr?: number`, `paid_amount_idr?: number`. Admin-only. Independent of status transitions — callable at any stage. No status guard.

### Buyer behavior

Buyers do **not** mark payments. Payment is tracked per-order as a single cumulative number (not per-item). Top-ups simply increase `paid_amount_idr`. The "Sisa" (remaining) is the buyer's outstanding balance.

---

## 3. Configurable Banking Info

### Settings keys (added to `settings` table via existing KV pattern)

- `bank_name` (e.g., "BCA")
- `bank_account_number` (e.g., "1234567890")
- `bank_account_name` (e.g., "Darma Kotama")

### `getSettings()` (`src/lib/pricing.ts`) and `Settings` type

Extend the `Settings` interface and default values with the three bank fields (default empty strings). `getSettings()` reads them like the other string keys.

### API (`PUT /api/admin/settings`)

Add the three optional fields to `updateSettingsSchema`. Persist as plain string settings rows.

### UI

- **Admin Settings page** (`admin/settings.astro`): new "Bank Account" card with three inputs (Bank Name, Account Number, Account Holder) + Save button. Reuse the existing `saveSettings()` helper.
- **Buyer `my-orders.astro`**: replace hardcoded BCA block with values from `getSettings()`. Copy-button copies `bank_account_number` dynamically.

---

## 4. Arrival Notification Banner

### Settings key

- `arrival_notification` (string). Empty = banner hidden.

### `getSettings()` / `Settings` type

Add `arrival_notification: string` (default `''`).

### UI

- **Admin Settings page**: new "Barang Tiba Notification" card with a single-line text input (or short textarea) + Save. Placeholder example: "Barang tiba 20 Juni 2026".
- **Buyer `index.astro`** (home): show a 1-line info banner above the main content when `arrival_notification` is non-empty. Amber/yellow styling consistent with `--color-gate-closed-*` tokens.
- **Buyer `my-orders.astro`**: same banner in the page header area.

---

## 5. Site-Wide Footer

### Scope

Add a footer to `src/layouts/Layout.astro` (buyer-facing layout only — admin pages use `AdminLayout` which extends `Layout`, so decide: footer on buyer pages only, or all). Decision: **buyer pages only** — exclude from admin via a prop or a separate minimal admin layout footer. Simplest: put the footer in `Layout.astro` and pass an `isAdmin` prop to skip rendering on admin pages. Actually cleaner: render footer in `Layout.astro` always, but admin sidebar layout already fills the viewport; rendering footer there is harmless. Decision: render in `Layout.astro` for all pages — keep it minimal.

### Footer content

- Left: `© {year} Kotemart Jastip`
- Right: Telegram link (from settings), Privacy & Terms links
- Border-top, muted text, consistent with design tokens.

`year` is computed server-side from `new Date()` in the layout frontmatter.

---

## Testing (E2E — `tests/e2e.spec.ts`)

New CUJ tests, matching existing style with `data-testid` selectors:

- **CUJ: order flow without Settled** — Draft → Pending (optional est price) → Bought (final price). Assert no Settled pill/action exists. Assert profit report picks up Bought orders.
- **CUJ: down payment** — admin sets DP + paid amount at Pending; buyer sees Terbayar badge + Sisa; partial paid shows Belum.
- **CUJ: banking info** — admin edits bank fields; buyer my-orders shows updated bank; copy button copies new number.
- **CUJ: arrival notification** — admin sets text; home + my-orders show banner; clearing hides it.
- **CUJ: footer** — footer present with current year + telegram link.
- **API tests** — removed `/settle` returns 404; `/status` accepts final price at Bought; `/payment` updates DP + paid.

Existing CUJ-11/12 (order flow with Settle) must be updated to the new Bought-terminal flow.

---

## Files touched

| File | Change |
|---|---|
| `db/schema.sql` | `orders.status` CHECK (drop Settled); add `down_payment_idr`, `paid_amount_idr`. |
| `src/lib/types.ts` | `OrderStatus` (drop Settled); `Settings` bank + arrival fields. |
| `src/lib/pricing.ts` | `ceilTo1000` export; bank + arrival fields in `getSettings`/defaults. |
| `src/pages/api/[...path].ts` | Remove `/settle`; merge fields into `/status`; add `/payment`; update status guards; profit query → Bought; settings schema bank + arrival. |
| `src/pages/admin/orders.astro` | Remove Settle modal; Bought modal gains final-price fields; DP modal + action; DP/paid display column. |
| `src/pages/admin/settings.astro` | Bank Account card; Arrival Notification card. |
| `src/pages/my-orders.astro` | 3-step stepper; Bought-based total; bank from settings; DP/paid display; arrival banner. |
| `src/pages/index.astro` | Arrival notification banner. |
| `src/layouts/Layout.astro` | Footer. |
| `tests/e2e.spec.ts` | Update CUJ-11/12; add DP, bank, arrival, footer CUJs + API tests. |

## Out of scope

- Per-item payment allocation (explicitly rejected — single cumulative amount per order).
- Payment ledger / multiple-payment history (Approach C, rejected).
- Removing the `settled_at` column (kept, repurposed, to avoid migration churn).
