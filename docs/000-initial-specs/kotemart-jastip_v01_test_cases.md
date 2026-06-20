# Kotemart Jastip Catalog — E2E Test Cases
**Version:** v01  
**Generated:** 2026-06-16  
**Framework:** Playwright (recommended for Astro + Cloudflare Pages)

---

## Test Environment Setup

### Prerequisites

- **Local Dev:** `wrangler dev` running against a local D1 database and R2 bucket (MinIO-compatible).
- **Browser Automation:** Playwright (Chromium, Firefox, WebKit) with `@playwright/test`.
- **Test OAuth:** Configure a Google OAuth2 test app or mock the OAuth flow with pre-seeded session cookies.

### Required Test Fixtures (seed before suite runs)

| Fixture | Details |
|---|---|
| **Admin user** | Google account flagged as `role=admin` in D1 `users` table. Session seeded with 24h expiry. |
| **Buyer user** | Google account flagged as `role=buyer` in D1 `users` table. Session seeded with 24h expiry. |
| **Catalog products** | At least 5 products across 2+ categories, each with `price_jpy`, valid `image_url` in R2, and `is_deleted=false`. |
| **Deleted product** | At least 1 product with `is_deleted=true` for 404 tests. |
| **Gate state** | Start with gate **open** (configurable via admin toggling in tests). |
| **JPY rate** | Seeded `jpy_to_idr_rate` in settings, e.g., `110.0`. |
| **Fee percentage** | Seeded admin fee%, e.g., `5.0`. |

### Playwright Config (Recommended)

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:8788', // wrangler dev port
    storageState: undefined,           // per-test
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### Test Helper: Authenticate

```ts
// helpers/auth.ts
export async function loginAs(page: Page, role: 'buyer' | 'admin') {
  // Seed a session cookie for the given role before navigating,
  // or navigate through the Google OAuth mock flow.
  const token = role === 'admin' ? ADMIN_SESSION_JWT : BUYER_SESSION_JWT;
  await page.context().addCookies([{
    name: 'session', value: token, domain: 'localhost', path: '/',
  }]);
}
```

---

## Auth (TC-AUTH)

### TC-AUTH-01: Happy-path Google OAuth2 login
- **Module:** Auth
- **Persona:** Buyer
- **Preconditions:** No active session, Google OAuth2 test app configured
- **Steps:**
  1. Navigate to `/`.
  2. Click "Login with Google" button.
  3. Complete Google OAuth consent screen (playwright mock / test account).
  4. Wait for redirect back to `/`.
- **Expected Result:** User is redirected to `/catalog` (or `/`). Navbar shows user avatar/name. Session cookie is set with 24h expiry. User record exists in D1 `users` table.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-AUTH-02: Redirect to originally-requested page after login
- **Module:** Auth
- **Persona:** Buyer
- **Preconditions:** Not logged in
- **Steps:**
  1. Navigate directly to `/my-orders` while unauthenticated.
  2. App redirects to `/login` (or shows login prompt with `?redirect=/my-orders`).
  3. Complete Google OAuth2 login.
- **Expected Result:** After successful login, user is redirected to `/my-orders` (the originally requested page).
- **Edge / Negative:** No
- **Priority:** High

### TC-AUTH-03: Logout clears session
- **Module:** Auth
- **Persona:** Buyer
- **Preconditions:** Buyer user logged in
- **Steps:**
  1. Click user avatar / profile menu in navbar.
  2. Click "Logout" / "Sign Out".
  3. After logout, navigate to `/my-orders`.
- **Expected Result:** Session cookie is cleared. User is redirected to login page. `/my-orders` returns login prompt, not order data. D1 session row is deleted (or expired).
- **Edge / Negative:** No
- **Priority:** High

### TC-AUTH-04: Unauthenticated access to protected routes returns login prompt
- **Module:** Auth
- **Persona:** Buyer
- **Preconditions:** No session cookie
- **Steps:**
  1. Navigate to `/my-orders` without logging in.
  2. Navigate to `/catalog/[slug]` without logging in.
  3. Send direct `GET /api/orders` request with no session cookie.
- **Expected Result:** Each protected route either redirects to `/login` or returns HTTP 401 / shows a "Please log in" UI state. API routes return 401 JSON.
- **Edge / Negative:** Yes
- **Priority:** High

---

## Catalog (TC-CAT)

### TC-CAT-01: Catalog page loads with product grid
- **Module:** Catalog
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, 5+ active products in DB, gate open
- **Steps:**
  1. Navigate to `/catalog`.
  2. Wait for page to render.
- **Expected Result:** Product grid is displayed with product cards (image, name, category badge, JPY price, estimated IDR price, "Add to Order" button). No console errors. Page loads within reasonable time.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-CAT-02: Category filter narrows displayed products
- **Module:** Catalog
- **Persona:** Buyer
- **Preconditions:** Products exist in at least 2 categories (e.g., "Figures" and "Plushies"), buyer logged in
- **Steps:**
  1. Navigate to `/catalog`.
  2. Observe all products visible.
  3. Click a category filter chip or dropdown — select "Figures".
- **Expected Result:** Only products in the "Figures" category are shown. Filter chip is visually active/highlighted. Product count indicator updates. Clicking "All" restores full grid.
- **Edge / Negative:** No
- **Priority:** Medium

### TC-CAT-03: Product detail page shows full info
- **Module:** Catalog
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, at least 1 active product
- **Steps:**
  1. On `/catalog`, click a product card.
  2. Navigate to `/catalog/[slug]`.
- **Expected Result:** Detail page renders product image (from R2), name, description, JPY price, estimated IDR price, category, and an "Add to Order" button with quantity selector.
- **Edge / Negative:** No
- **Priority:** High

### TC-CAT-04: JPY and IDR prices both shown with disclaimer
- **Module:** Catalog
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, products have JPY prices, JPY rate is set, fee% is set
- **Steps:**
  1. Navigate to `/catalog`.
  2. Inspect any product card.
  3. Navigate to `/catalog/[slug]` for any product and inspect the detail page.
- **Expected Result:** Every product shows **both** `¥X,XXX JPY` and an estimated `Rp XX,XXX IDR`. A visible disclaimer reads: "Harga IDR adalah estimasi dan dapat berubah hingga pesanan diselesaikan (Settled)." or equivalent Indonesian disclaimer text.
- **Edge / Negative:** No
- **Priority:** High

### TC-CAT-05: Deleted product returns 404 or is hidden
- **Module:** Catalog
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, 1 product with `is_deleted=true` in DB
- **Steps:**
  1. Attempt to navigate directly to `/catalog/[deleted-product-slug]`.
  2. Scan the `/catalog` grid for the deleted product.
- **Expected Result:** Direct URL returns a 404 page (or redirects to `/catalog` with a "not found" message). The deleted product does **not** appear in the catalog grid or search results.
- **Edge / Negative:** Yes
- **Priority:** Medium

### TC-CAT-06: Non-image upload is rejected
- **Module:** Catalog
- **Persona:** Admin
- **Preconditions:** Admin logged in, on admin product create/edit page
- **Steps:**
  1. Navigate to admin product creation form (`/admin/products/new`).
  2. Attempt to upload `malicious.exe` or `document.pdf` as the product image.
  3. Attempt to upload a 50MB JPEG exceeding size limits.
- **Expected Result:** Frontend rejects the file with an inline error message: "Hanya file gambar yang diizinkan (JPEG, PNG, WebP)." Backend/API also validates and returns 400 if frontend check is bypassed. Large file shows "Ukuran file maksimal X MB" error.
- **Edge / Negative:** Yes
- **Priority:** Medium

---

## Jastip Gate (TC-GATE)

### TC-GATE-01: Gate closed — banner is shown to buyers
- **Module:** Jastip Gate
- **Persona:** Buyer
- **Preconditions:** Admin has set gate to **closed**, buyer logged in
- **Steps:**
  1. Navigate to `/catalog` as buyer.
  2. Observe the page.
- **Expected Result:** A prominent banner/alert is displayed: "Jastip sedang ditutup. Anda dapat melihat katalog tetapi tidak dapat menambahkan pesanan baru." (or equivalent). Banner is visible on catalog and product detail pages.
- **Edge / Negative:** No
- **Priority:** High

### TC-GATE-02: Gate closed — "Add to Order" button is disabled
- **Module:** Jastip Gate
- **Persona:** Buyer
- **Preconditions:** Gate closed, buyer logged in, viewing catalog or product detail
- **Steps:**
  1. On `/catalog`, hover over an "Add to Order" button.
  2. On `/catalog/[slug]`, observe the "Add to Order" button.
- **Expected Result:** "Add to Order" button is **disabled** (grayed out, not clickable) on both grid cards and the detail page. Tooltip or aria-label indicates "Jastip sedang ditutup." Clicking the disabled button does nothing.
- **Edge / Negative:** No
- **Priority:** High

### TC-GATE-03: Gate open — order form is fully active
- **Module:** Jastip Gate
- **Persona:** Buyer
- **Preconditions:** Gate open, buyer logged in
- **Steps:**
  1. Navigate to `/catalog`.
  2. Click "Add to Order" on a product.
  3. Fill quantity and submit.
- **Expected Result:** Button is enabled and clickable. Order is successfully created as Draft. No gate warning banner is visible.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-GATE-04: API bypass attempt when gate is closed returns 403
- **Module:** Jastip Gate
- **Persona:** Buyer
- **Preconditions:** Gate closed, buyer logged in with valid session
- **Steps:**
  1. Using `fetch()` in browser console or Playwright's `page.request`, send:
     ```
     POST /api/orders
     Body: { product_id: X, quantity: 1 }
     ```
  2. Check response.
- **Expected Result:** API returns HTTP 403 with JSON body `{ error: "Jastip is currently closed" }`. No order is created in D1.
- **Edge / Negative:** Yes
- **Priority:** Critical

### TC-GATE-05: Admin closes gate mid-session — buyer sees banner without page refresh
- **Module:** Jastip Gate
- **Persona:** Buyer (with admin doing action in parallel)
- **Preconditions:** Gate open, buyer on catalog page, admin logged in on separate browser/context
- **Steps:**
  1. Buyer is viewing `/catalog` with gate open (buttons enabled).
  2. Admin navigates to `/admin/settings` and toggles gate to **closed**.
  3. Buyer refreshes the page (or waits for polling interval if implemented).
- **Expected Result:** After refresh, buyer sees the gate-closed banner and disabled buttons. (If real-time polling/SSE is not implemented, a manual refresh is acceptable — document this as a known limitation.)
- **Edge / Negative:** Yes
- **Priority:** Medium

---

## Order List (TC-ORD)

### TC-ORD-01: Add catalog product creates a Draft order
- **Module:** Order List
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, gate open, at least 1 active product
- **Steps:**
  1. Navigate to `/catalog`.
  2. Click "Add to Order" on a product.
  3. In the modal/inline form, set quantity to `2`.
  4. Click "Submit" / "Add to Order".
- **Expected Result:** Success toast/message: "Pesanan ditambahkan!" Order appears in `/my-orders` with status **Draft**. Order records: product name, quantity=2, JPY price (snapshot of current product price), estimated IDR (based on current rate snapshot), and current timestamp.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-ORD-02: Quantity = 0 is rejected with validation error
- **Module:** Order List
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, gate open
- **Steps:**
  1. Navigate to `/catalog/[slug]`.
  2. Set quantity to `0` or leave empty.
  3. Click "Add to Order".
- **Expected Result:** Form does not submit. Inline validation error: "Jumlah minimal 1." API also validates: if bypassed, returns 400 `{ error: "quantity must be >= 1" }`.
- **Edge / Negative:** Yes
- **Priority:** Medium

### TC-ORD-03: Order appears in My Orders with correct info
- **Module:** Order List
- **Persona:** Buyer
- **Preconditions:** Buyer has at least 1 Draft order, logged in
- **Steps:**
  1. Navigate to `/my-orders`.
  2. Observe the order list.
- **Expected Result:** Each order card/row shows: product name (or "Custom Order" label), quantity, JPY price snapshot, estimated IDR, status badge ("Draft"), and timestamp. Status badge is color-coded per status.
- **Edge / Negative:** No
- **Priority:** High

### TC-ORD-04: Order status progression is visible to buyer
- **Module:** Order List
- **Persona:** Buyer
- **Preconditions:** Buyer has orders at various statuses: Draft, Pending, Bought, Settled
- **Steps:**
  1. Navigate to `/my-orders`.
  2. Inspect orders at each status level.
- **Expected Result:** Status badges show correct labels: "Draft", "Pending", "Bought", "Settled". Status transitions are visible (order that was Draft yesterday now shows Pending, etc.). Note: IDR price remains labeled "Estimasi" until Settled, then labeled "Final".
- **Edge / Negative:** No
- **Priority:** High

### TC-ORD-05: Final price is visible when order is Settled
- **Module:** Order List
- **Persona:** Buyer
- **Preconditions:** At least 1 Settled order for the buyer, with `final_price_idr` populated
- **Steps:**
  1. Navigate to `/my-orders`.
  2. Find a Settled order.
  3. Inspect the price display.
- **Expected Result:** Settled order shows "Final: Rp XX,XXX" instead of "Estimasi: Rp XX,XXX". The final IDR price matches the `final_price_idr` value set by admin at settlement. "Estimasi" label/tag is removed for this order.
- **Edge / Negative:** No
- **Priority:** High

### TC-ORD-06: Adding the same product twice creates two separate order lines
- **Module:** Order List
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, gate open, 1 active product
- **Steps:**
  1. Add product X with quantity=1 → order created.
  2. Navigate back to `/catalog`.
  3. Add product X again with quantity=1.
  4. Navigate to `/my-orders`.
- **Expected Result:** Two separate order entries appear in `/my-orders` for the same product — they are **not** merged/aggregated into a single line item. Each has its own order ID, timestamp, and independent status.
- **Edge / Negative:** No
- **Priority:** Medium

---

## Custom Order (TC-CUST)

### TC-CUST-01: Submit a full custom order form
- **Module:** Custom Order
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, gate open
- **Steps:**
  1. Navigate to `/custom-order` (or equivalent page/section).
  2. Fill in "Nama Produk" (product name): "Limited Edition Miku Figure".
  3. Fill in "Deskripsi" (description): "From Comiket 2025, mint condition".
  4. Fill in "URL Referensi" (reference URL): `https://example.com/miku-figure`.
  5. Set quantity to `1`.
  6. Submit the form.
- **Expected Result:** Success message. Order appears in `/my-orders` as **Draft** with label "Custom Order". Order shows: product name, description, reference URL, quantity=1, status Draft, JPY price = `null` (to be priced by admin), IDR estimate = `null` (to be priced by admin).
- **Edge / Negative:** No
- **Priority:** Critical

### TC-CUST-02: Submit custom order without URL (URL is optional)
- **Module:** Custom Order
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, gate open
- **Steps:**
  1. Navigate to `/custom-order`.
  2. Fill in product name and description.
  3. Leave URL field empty.
  4. Submit the form.
- **Expected Result:** Form submits successfully. Order is created as Draft with `reference_url = null`. No validation error about missing URL.
- **Edge / Negative:** Yes (testing optional field boundary)
- **Priority:** Medium

### TC-CUST-03: Invalid URL format shows warning
- **Module:** Custom Order
- **Persona:** Buyer
- **Preconditions:** Buyer logged in, gate open
- **Steps:**
  1. Navigate to `/custom-order`.
  2. Fill in product name and description.
  3. Type `not-a-valid-url` in the URL field.
  4. Submit the form (or tab out of the URL field).
- **Expected Result:** Inline validation warning: "Format URL tidak valid." (or similar). Form does not submit until URL is corrected or cleared. If frontend validation is bypassed, backend returns 400 with a descriptive error.
- **Edge / Negative:** Yes
- **Priority:** Medium

### TC-CUST-04: Custom order appears in My Orders with correct default state
- **Module:** Custom Order
- **Persona:** Buyer
- **Preconditions:** Buyer has submitted at least 1 custom order (Draft, not yet priced by admin)
- **Steps:**
  1. Navigate to `/my-orders`.
  2. Locate the custom order entry.
- **Expected Result:** Custom order is clearly distinguishable from catalog orders (e.g., "Custom Order" badge/label). JPY price shows "—" or "Menunggu harga admin". IDR estimate shows "—" or "Menunggu harga admin". Status is Draft.
- **Edge / Negative:** No
- **Priority:** High

### TC-CUST-05: Admin prices a custom order → buyer sees IDR estimate
- **Module:** Custom Order
- **Persona:** Admin (action) → Buyer (verification)
- **Preconditions:** 1 Draft custom order for buyer, admin logged in (separate context)
- **Steps:**
  1. Admin navigates to `/admin/orders`.
  2. Admin finds the custom order and sets `price_jpy = 5000`.
  3. Admin advances order to Pending.
  4. Buyer refreshes `/my-orders`.
- **Expected Result:** Buyer now sees `¥5,000 JPY` and estimated IDR (based on current rate snapshot) for the custom order. "Menunggu harga admin" placeholders are replaced with actual values.
- **Edge / Negative:** No
- **Priority:** High

---

## Order Management (TC-MGMT)

### TC-MGMT-01: Admin sees all orders across all buyers
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, at least 3 orders from 2+ different buyers, varying statuses
- **Steps:**
  1. Navigate to `/admin/orders`.
  2. Inspect the order table/list.
- **Expected Result:** All orders from all buyers are visible. Columns include: Order ID, Buyer Name/Email, Product Name, Quantity, JPY Price, Estimated IDR, Status, Timestamp. Orders are sortable/filterable.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-MGMT-02: Admin moves order from Draft → Pending
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, 1 Draft order (catalog or custom) with JPY price set
- **Steps:**
  1. Navigate to `/admin/orders`.
  2. Find the Draft order.
  3. Click status action → "Mark as Pending" (or dropdown).
  4. Confirm the action.
- **Expected Result:** Order status updates to **Pending**. Success toast. Buyer sees updated status in `/my-orders`. Status change is logged (timestamp/audit if implemented).
- **Edge / Negative:** No
- **Priority:** Critical

### TC-MGMT-03: Admin moves order from Pending → Bought
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, 1 Pending order
- **Steps:**
  1. Find the Pending order in `/admin/orders`.
  2. Click status action → "Mark as Bought".
  3. Confirm.
- **Expected Result:** Order status is now **Bought**. JPY rate snapshot remains unchanged from order creation time. Buyer sees "Bought" badge in `/my-orders`.
- **Edge / Negative:** No
- **Priority:** High

### TC-MGMT-04: Admin settles order from Bought → Settled with final price
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, 1 Bought order
- **Steps:**
  1. Find the Bought order in `/admin/orders`.
  2. Click "Settle" action.
  3. A modal/form appears prompting for `final_price_idr`. Enter `550000`.
  4. Confirm.
- **Expected Result:** Order status is now **Settled**. `final_price_idr = 550000` is stored. Buyer sees "Final: Rp 550,000" in `/my-orders`. Order appears in Profit Tracker with this final price. No further status transitions are possible.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-MGMT-05: Backward status transition is blocked
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, 1 Pending order
- **Steps:**
  1. Attempt to move the Pending order back to Draft via UI action.
  2. Using Playwright, send a direct API call:
     ```
     PATCH /api/admin/orders/[id]/status
     Body: { status: "draft" }
     ```
- **Expected Result:** UI does not offer a "back to Draft" option for Pending orders. API returns HTTP 422 or 400 `{ error: "Status cannot be changed backward" }`. The order remains Pending.
- **Edge / Negative:** Yes
- **Priority:** High

### TC-MGMT-06: Settle without final price is blocked
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, 1 Bought order
- **Steps:**
  1. Attempt to settle the order without entering a `final_price_idr` (empty or 0).
  2. Attempt API call:
     ```
     PATCH /api/admin/orders/[id]/settle
     Body: { final_price_idr: 0 }
     ```
- **Expected Result:** UI shows validation "Harga final harus lebih dari 0." API returns 400. Order remains Bought.
- **Edge / Negative:** Yes
- **Priority:** High

### TC-MGMT-07: Rate snapshot is immutable after global rate update
- **Module:** Order Management
- **Persona:** Admin
- **Preconditions:** Admin logged in, 1 Pending order with JPY rate snapshot at `110.0`. Current global rate in settings = `110.0`.
- **Steps:**
  1. Admin changes global JPY rate to `115.0` in `/admin/settings`.
  2. Admin creates a new order for a different buyer (rate snapshots to `115.0`).
  3. Navigate to `/admin/orders` and inspect the old Pending order.
  4. Inspect the new order.
- **Expected Result:** Old order retains `rate_snapshot = 110.0` — its estimated IDR is based on 110. New order uses `rate_snapshot = 115.0`. Rate change does **not** retroactively affect existing orders.
- **Edge / Negative:** No
- **Priority:** Critical

---

## Profit Tracker (TC-PROF)

### TC-PROF-01: Dashboard shows Settled-only totals
- **Module:** Profit Tracker
- **Persona:** Admin
- **Preconditions:** Admin logged in, at least 2 Settled orders with `final_price_idr` values, plus some Draft/Pending/Bought orders
- **Steps:**
  1. Navigate to `/admin/profit` (or profit dashboard section).
  2. Inspect total revenue, fee, and net profit figures.
- **Expected Result:** Dashboard aggregates **only** Settled orders. Non-Settled orders (Draft, Pending, Bought) are excluded from totals. KPIs shown: Total Revenue (sum of `final_price_idr`), Total Admin Fee (revenue × fee%), Net Profit (fee total). Optional: total orders count, average order value.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-PROF-02: Zero settled orders shows empty state
- **Module:** Profit Tracker
- **Persona:** Admin
- **Preconditions:** Admin logged in, **zero** Settled orders in DB (all orders Draft/Pending/Bought, or no orders at all)
- **Steps:**
  1. Navigate to `/admin/profit`.
- **Expected Result:** Dashboard shows an empty state message: "Belum ada pesanan yang diselesaikan." (or equivalent). KPIs show `Rp 0` or "—". No errors, no blank screen.
- **Edge / Negative:** Yes
- **Priority:** Medium

### TC-PROF-03: Per-order breakdown is visible
- **Module:** Profit Tracker
- **Persona:** Admin
- **Preconditions:** Admin logged in, 2+ Settled orders
- **Steps:**
  1. Navigate to `/admin/profit`.
  2. Scroll to the breakdown table/list.
- **Expected Result:** Each Settled order is listed with: Order ID, Buyer name, Product name, `final_price_idr`, calculated fee (`final_price_idr × fee%`), settlement date. Subtotal and total rows match KPI values.
- **Edge / Negative:** No
- **Priority:** High

### TC-PROF-04: Date range filter filters Settled orders
- **Module:** Profit Tracker
- **Persona:** Admin
- **Preconditions:** Admin logged in, Settled orders spanning multiple dates (e.g., June 10, June 12, June 15)
- **Steps:**
  1. Navigate to `/admin/profit`.
  2. Set date range filter: June 10 – June 13.
  3. Apply filter.
- **Expected Result:** Only orders settled between June 10 and June 13 appear in the breakdown and totals. Orders settled on June 15 are excluded. KPI values update to reflect filtered subset. Filter can be cleared to show all again.
- **Edge / Negative:** No
- **Priority:** Medium

---

## Admin Panel & Settings (TC-ADM)

### TC-ADM-01: Set JPY to IDR exchange rate
- **Module:** Admin Panel & Settings
- **Persona:** Admin
- **Preconditions:** Admin logged in, on `/admin/settings`
- **Steps:**
  1. Locate "JPY to IDR Rate" input field.
  2. Change value from `110.0` to `112.5`.
  3. Click "Save".
- **Expected Result:** Success toast: "Nilai tukar berhasil diperbarui." New value `112.5` is persisted in D1 settings table. Subsequent new orders use rate `112.5`. Existing orders retain their original snapshot.
- **Edge / Negative:** No
- **Priority:** Critical

### TC-ADM-02: Set admin fee percentage
- **Module:** Admin Panel & Settings
- **Persona:** Admin
- **Preconditions:** Admin logged in, on `/admin/settings`
- **Steps:**
  1. Locate "Admin Fee (%)" input.
  2. Change value from `5.0` to `7.5`.
  3. Click "Save".
- **Expected Result:** Fee percentage updates. New orders calculate IDR estimate using new fee%. Profit tracker uses new fee% for future Settled orders. Existing Settled orders retain their fee calculation (snapshot principle).
- **Edge / Negative:** No
- **Priority:** High

### TC-ADM-03: New product uses the newly-set rate
- **Module:** Admin Panel & Settings
- **Persona:** Admin + Buyer
- **Preconditions:** Admin updates rate to `115.0`, then a buyer places a new order
- **Steps:**
  1. Admin sets rate to `115.0`.
  2. Buyer adds a catalog product (JPY 2000) to order (creates Draft).
  3. Inspect the order's `rate_snapshot` and estimated IDR.
- **Expected Result:** Order's `rate_snapshot = 115.0`. Estimated IDR = `2000 × 115.0 × (1 + fee%)`. This reflects the rate as of order creation time.
- **Edge / Negative:** No
- **Priority:** High

### TC-ADM-04: Old product retains its original estimate after rate change
- **Module:** Admin Panel & Settings
- **Persona:** Buyer
- **Preconditions:** Buyer has a Draft or Pending order created when rate was `110.0`. Admin subsequently changes rate to `115.0`.
- **Steps:**
  1. Admin changes rate to `115.0`.
  2. Buyer navigates to `/my-orders`.
  3. Inspect the old order's estimated IDR.
- **Expected Result:** Old order still shows estimated IDR based on `110.0` (the rate at order creation). A subtle indicator or tooltip may show the snapshot rate. New orders placed after the change use `115.0`.
- **Edge / Negative:** No
- **Priority:** Medium

### TC-ADM-05: Set Telegram / contact link
- **Module:** Admin Panel & Settings
- **Persona:** Admin
- **Preconditions:** Admin logged in, on `/admin/settings`
- **Steps:**
  1. Locate "Telegram Link" or "Contact Link" input.
  2. Enter `https://t.me/kotemart_jastip`.
  3. Click "Save".
  4. Buyer navigates to any page and checks footer/navbar/contact section.
- **Expected Result:** Telegram link is persisted. Buyer sees a Telegram icon/link pointing to the configured URL. Changing the link updates it site-wide for all users.
- **Edge / Negative:** No
- **Priority:** Low

### TC-ADM-06: Disable a user's access
- **Module:** Admin Panel & Settings
- **Persona:** Admin
- **Preconditions:** Admin logged in, at least 1 buyer user exists and has active session
- **Steps:**
  1. Navigate to `/admin/users`.
  2. Find the buyer user.
  3. Toggle "Active" / "Access" to disabled (`is_active = false`).
  4. Buyer refreshes the page or makes a new request.
- **Expected Result:** Buyer's next request returns 403 or redirects to a "Your account has been disabled" page. Existing sessions are invalidated (or checked on next request). Admin can re-enable the user later.
- **Edge / Negative:** Yes
- **Priority:** Medium

---

## Test Coverage Summary

| Module | Total TCs | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Auth (TC-AUTH) | 4 | 1 | 3 | 0 | 0 |
| Catalog (TC-CAT) | 6 | 1 | 2 | 3 | 0 |
| Jastip Gate (TC-GATE) | 5 | 2 | 2 | 1 | 0 |
| Order List (TC-ORD) | 6 | 1 | 3 | 2 | 0 |
| Custom Order (TC-CUST) | 5 | 1 | 2 | 2 | 0 |
| Order Management (TC-MGMT) | 7 | 3 | 4 | 0 | 0 |
| Profit Tracker (TC-PROF) | 4 | 1 | 1 | 2 | 0 |
| Admin Panel & Settings (TC-ADM) | 6 | 1 | 2 | 2 | 1 |
| **TOTAL** | **43** | **11** | **19** | **12** | **1** |

---
*End of test cases — v01*
