# Kotemart Jastip Catalog — Product Requirements Document (PRD)
**Version:** v01
**Generated:** 2026-06-16
**Source spec:** kotemart-jastip_v01_spec.md

---

## 1. Personas

### Buyer
- **Role:** Pembeli / pelanggan jastip
- **Goals:** Menemukan produk yang ingin dibeli dari Jepang, mendaftarkan pesanan dengan mudah, memantau status dan harga konfirmasi pesanan mereka
- **Frustrations:** Tidak tahu apakah jastip sedang buka, bingung harga estimasi vs harga final, tidak punya cara untuk track pesanan selain via chat

### Admin
- **Role:** Pengelola jastip (operator tunggal)
- **Goals:** Mengelola katalog produk, memproses pesanan pembeli secara teratur, memantau profit per batch jastip, mengontrol kapan jastip buka dan tutup
- **Frustrations:** Pesanan tersebar di chat Telegram tanpa struktur, sulit menghitung profit per batch, tidak bisa track mana order yang sudah settled

---

## 2. User Stories

### Module: Auth
- As a Buyer, I want to login using my Google account, so that I don't need to create a separate username and password.
- As a Buyer, I want to be automatically redirected to the catalog after login, so that I can start browsing immediately.
- As a Buyer, I want to logout from the website, so that I can secure my account on shared devices.
- As an Admin, I want only authenticated users to access the catalog, so that the catalog is not publicly visible.
- As a Buyer, I want an "Auth Recovery" modal to appear when my session expires mid-form, so that I can reconnect without losing my in-progress work.
- As a Buyer, I want my form data to be automatically restored after re-authentication, so that I don't have to re-type everything.

### Module: Catalog
- As a Buyer, I want to see all available products in a grid with photos and estimated IDR prices, so that I can quickly browse what's available.
- As a Buyer, I want to filter products by category, so that I can find items relevant to my interests.
- As a Buyer, I want to see full product detail including description, photo gallery, JPY price, and IDR estimate, so that I can make an informed order decision.
- As a Buyer, I want to see a clear disclaimer that the price shown is an estimate, so that I'm not surprised when the final price differs.
- As an Admin, I want to add, edit, and delete products in the catalog, so that the catalog stays up to date per batch.
- As an Admin, I want to upload multiple photos per product to cloud storage, so that buyers can see the product from multiple angles.
- As an Admin, I want the upload button to show clear progress states (Compressing → Uploading → Success/Error), so that I know what the system is doing with my photos.
- As an Admin, I want the system to auto-compress and convert my photos to WebP format before uploading, so that storage and bandwidth are minimized.
- As an Admin, I want an immediate error toast if I try to upload a file larger than 5MB, so that I can fix the problem before a slow upload fails.
- As an Admin, I want to assign a category to each product, so that buyers can filter by category.

### Module: Jastip Gate
- As an Admin, I want to toggle the jastip gate between Open and Closed, so that I can control when buyers can submit new orders.
- As a Buyer, I want to see a clear notification when jastip is closed, so that I know to wait or contact admin.
- As a Buyer, I want to see the Telegram contact link when jastip is closed, so that I can ask questions directly.

### Module: Order List
- As a Buyer, I want to add a catalog product to my order list while the gate is open, so that I can reserve my interest before the batch closes.
- As a Buyer, I want to specify the quantity for each item I order, so that admin knows exactly how many I need.
- As a Buyer, I want to see all my orders and their current status (Draft, Pending, Bought, Settled, Cancelled), so that I can track my purchases without asking admin.
- As a Buyer, I want to see the confirmed final IDR price once my order is Settled, so that I know the exact amount I'll pay.
- As a Buyer, I want to see a "Locked" padlock icon on my order once it reaches Pending or higher, so that I know my price estimate is frozen and will not change with market fluctuations.

### Module: Custom Order
- As a Buyer, I want to submit a custom order with a product URL, description, quantity, and notes, so that I can request items that are not in the catalog (e.g., from Amazon JP, Yahoo Auction).
- As a Buyer, I want my custom order to appear in my order history alongside catalog orders, so that I have one unified view of all my requests.
- As an Admin, I want to receive custom order submissions in the order management view, so that I can process them the same way as catalog orders.
- As an Admin, I want to input the JPY price and fee for custom orders, so that the system can generate an IDR estimate for the buyer.

### Module: Order Management
- As an Admin, I want to see all orders (catalog and custom) in one view, so that I can manage the entire batch from one place.
- As an Admin, I want to update the status of an order from Draft → Pending → Bought → Settled, so that buyers are kept informed.
- As an Admin, I want to input the confirmed final IDR price when marking an order as Settled, so that the buyer can see the exact amount in their order history.
- As an Admin, I want each order to preserve the JPY rate at the time it was created, so that profit calculations remain accurate even after the rate is updated.
- As an Admin, I want to see the `jpy_rate_snapshot` and `fee_pct_snapshot` stored on each order, so that I can audit what rate was used at the time of price locking.
- As an Admin, I want to enter a `manual_idr_override` when settling an order, so that I can correct the final price independently of the formula.
- As an Admin, I want to cancel any order via a "Three Dots" menu with a mandatory Cancellation Reason, so that I can handle edge cases without deleting historical data.
- As an Admin, I want to toggle a "Show Cancelled" filter on the Order Management view, so that I can review what was lost without it polluting normal operations.

### Module: Profit Tracker
- As an Admin, I want to see a profit summary per jastip batch showing total revenue, total HPP, and gross profit, so that I can evaluate the profitability of each batch.
- As an Admin, I want the profit dashboard to only include Settled orders, so that unconfirmed or cancelled orders don't skew my profit numbers.
- As an Admin, I want to see a per-order breakdown within a batch, so that I can identify which products had the best margin.
- As an Admin, I want to toggle a "Show Cancelled" filter on the Profit Tracker, so that I can review cancelled revenue separately without it polluting the profit totals.

### Module: Admin Panel & Global Settings
- As an Admin, I want to set the JPY exchange rate manually, so that I control the pricing baseline for each batch.
- As an Admin, I want to set a global fee percentage, so that the system automatically adds my margin to all IDR estimates.
- As an Admin, I want to update the Telegram contact link from the settings, so that the CTA shown to buyers is always current.
- As an Admin, I want updating the JPY rate to only affect future product saves — not retroactively change existing products or orders — so that historical pricing integrity is maintained.
- As an Admin, I want to view the list of registered users and disable any user's access, so that I can control who can see the catalog.

---

## 3. Acceptance Criteria

### Auth
**Story: Login with Google**
```
Given a user is not logged in
When they visit the website
Then they are presented with a Google login button
```
```
Given a user clicks the Google login button
When they complete Google authentication
Then they are redirected to the catalog page with an active session
```
```
Given a logged-in user clicks logout
When the logout action completes
Then their session is deleted and they are redirected to the login page
```

### Catalog
**Story: Browse catalog**
```
Given a logged-in buyer visits the catalog
When the page loads
Then all published products are shown with photo, name, category, and IDR estimate
```
```
Given a buyer selects a category filter
When the filter is applied
Then only products in that category are displayed
```
**Story: Product detail**
```
Given a buyer opens a product detail page
When the page loads
Then they see photo gallery, description, price in JPY, estimated price in IDR, and a disclaimer: "Harga ini adalah estimasi. Harga final akan dikonfirmasi setelah barang dibeli."
```

### Jastip Gate
**Story: Gate Closed behavior**
```
Given admin has set the gate to Closed
When a buyer visits the catalog
Then they see a banner: "Jastip sedang tutup" and a Telegram contact link
And the order submission buttons are disabled or hidden
```
```
Given admin sets gate to Open
When a buyer visits the catalog
Then the order form and "Add to Order" buttons are active
```

### Order List
**Story: Add catalog order**
```
Given the gate is Open and a buyer is viewing a product detail page
When they click "Add to Order" and specify quantity
Then the order is saved with status Draft and appears in their My Orders page
```
```
Given an order reaches status Settled
When the buyer views My Orders
Then they see the confirmed final IDR price next to that order
```

### Custom Order
**Story: Submit custom order**
```
Given the gate is Open and a buyer opens the Custom Order form
When they enter a product URL, name, quantity, and notes and submit
Then a custom order is created with status Draft and appears in their My Orders page
```
```
Given a custom order has been submitted
When admin inputs JPY price and fee%
Then the system calculates and displays an IDR estimate for that order using the current rate snapshot
```

### Order Management
**Story: Status update**
```
Given an admin views the Order Management page
When they change an order status to Settled and input the final IDR price
Then the order is marked Settled and the buyer's My Orders page shows the confirmed price
```
```
Given an order is Settled
When admin views profit tracker
Then that order's revenue and HPP are included in the batch summary
```

### Profit Tracker
```
Given admin opens the Profit Tracker for a batch
When the page loads
Then they see: total orders, total revenue IDR, total HPP IDR, gross profit IDR
And only Settled orders are included in these totals
```

### Admin Panel — Rate Update
```
Given admin updates the JPY rate in Global Settings
When they save a new product after the update
Then the new product uses the new rate for IDR estimate
And previously saved products retain their original IDR estimate snapshot
And Settled orders retain their historical JPY rate snapshot
```

---

## 4. Edge Cases & Unhappy Paths

### Auth
- User attempts to access catalog URL directly without being logged in → redirected to login page
- Google OAuth callback fails (network error, invalid token) → user sees error page with retry option
- Session expires mid-session → API returns 401; Global Auth Interceptor triggers "Auth Recovery" modal; form data serialized to `sessionStorage`; after re-auth, data is restored and re-submitted automatically
- Buyer closes the Auth Recovery modal without reconnecting → form data remains in `sessionStorage` until tab is closed; buyer sees a dismissible warning banner on return

### Catalog
- Admin saves a product with no photo → product still saves; catalog shows placeholder image
- Admin uploads a non-image file to R2 → client rejects immediately with error: "Only image files allowed (JPG, PNG, WEBP)"
- Admin uploads a file exceeding 5MB → client shows immediate error toast: "File terlalu besar, maksimal 5MB"; upload does not start
- Browser canvas compression fails (unsupported format) → system falls back to original file; proceeds with upload; shows warning toast
- Buyer accesses a product that has been deleted → 404 page shown
- Admin edits a product's JPY price after orders already exist → existing orders retain their original price snapshot; only the catalog display updates

### Jastip Gate
- Buyer submits order via API call while gate is Closed (bypass attempt) → server-side gate check rejects with 403 "Jastip sedang tutup"
- Admin closes gate while buyer has order form open → on submission, server rejects; buyer sees error "Jastip sudah ditutup, pesananmu tidak bisa dikirim"

### Order List
- Buyer tries to add the same catalog product twice → system allows it (treated as separate order lines) or merges qty — admin to confirm behavior; default: allow separate lines
- Buyer submits order with qty = 0 or negative → form validation rejects before submission

### Custom Order
- Buyer submits custom order with no URL (just description) → system allows it; URL field optional
- Custom order URL is not a valid URL format → client-side warning shown but submission not blocked (buyer may paste partial info)
- Admin inputs JPY price = 0 for custom order → IDR estimate shows 0; admin must confirm this is intentional

### Order Management
- Admin tries to move order status backward (e.g., Settled → Bought) → system prevents backward status transition
- Admin marks order Settled without entering final IDR price → form validation blocks submission with error "Harga final harus diisi sebelum konfirmasi"
- Admin enters `manual_idr_override` → system uses that value as Final IDR, ignoring formula; override is visible and labelled "Manual override" in audit view
- Admin cancels an order without entering Cancellation Reason → modal submit is disabled until reason is filled
- Admin cancels an already-Settled order → system shows warning "Order ini sudah Settled. Batalkan tetap akan menyimpan data historis."; proceeds if confirmed
- Two admin sessions update the same order simultaneously → last-write-wins (acceptable for single-admin use case)

### Profit Tracker
- No Settled orders in current batch → dashboard shows 0 for all metrics with message "Belum ada pesanan yang selesai di batch ini"
- Admin updates HPP after Settled → profit recalculates immediately in dashboard
- Cancelled orders appear in totals → dashboard must explicitly exclude `status=Cancelled` from all revenue and profit calculations
- Admin toggles "Show Cancelled" → cancelled orders appear in per-order breakdown with struck-through revenue and "CANCELLED" badge; aggregate totals remain unchanged

### Global Settings — Rate Update
- Admin updates JPY rate → all previously saved products retain their old IDR estimate; new products use new rate
- Admin sets fee% = 0 → IDR estimate = price_jpy × jpy_rate (no margin added); valid state
- Admin sets JPY rate to 0 accidentally → IDR estimate shows 0; system should warn before saving if rate = 0

---

## 5. UX Flow Walkthroughs

### Flow 1: Buyer First-Time Login and Browse Catalog
1. Buyer opens the website URL
2. They see a login page with a "Login dengan Google" button
3. They click login → Google authentication popup appears
4. After successful Google auth, they are redirected to the catalog page
5. If jastip is Open: catalog products appear in a grid with photos and estimated IDR prices
6. If jastip is Closed: a full-page banner appears: "Jastip sedang tutup" with a Telegram contact link and the expected next-open notice (if set)
7. Buyer scrolls catalog, clicks a product to open detail page
8. Detail page shows: photo gallery (swipeable on mobile), product name, category, description, JPY price, IDR estimate with disclaimer
9. Buyer clicks "Pesan" / "Add to Order" button

### Flow 2: Buyer Places a Catalog Order
1. Buyer is on a product detail page, gate is Open; IDR estimate shown uses **current** global rate + fee%
2. They click "Pesan" → qty input appears
3. They set qty and confirm
4. Order saved as Draft; success toast shows "Pesanan ditambahkan"; `jpy_rate_snapshot` and `fee_pct_snapshot` captured at submission time
5. Buyer navigates to "Pesanan Saya" page
6. They see the order listed with status "Draft" and frozen estimated price (no padlock icon at Draft)
7. Admin moves order to Pending → buyer's order row now shows a **padlock icon** ("Harga terkunci")
8. Admin moves through Bought → Settled; at Settled, admin enters `manual_idr_override` or confirms formula price
9. Buyer's order row updates: final IDR price shown, padlock icon remains

### Flow 3: Buyer Submits a Custom Order
1. Buyer opens "Custom Order" page (accessible from nav or catalog page CTA)
2. They fill in: product URL (e.g., Yahoo Auction link), product name/description, quantity, and optional notes
3. They submit the form
4. Order saved as Draft; success message shown
5. Admin sees the custom order in Order Management with type label "Custom"
6. Admin inputs JPY price estimate → system shows IDR estimate
7. Admin processes the order through the same status flow as catalog orders

### Flow 4: Admin Manages Orders and Settles a Batch
1. Admin logs in via Google (same flow, role detected from D1 user table)
2. Admin opens "Order Management" page
3. All orders (catalog + custom) are listed with buyer name, product, qty, status
4. Admin filters by "Draft" to see new orders
5. For each order: admin reviews, moves to Pending (flags to follow up via Telegram); system shows `jpy_rate_snapshot` + `fee_pct_snapshot` used; padlock activates on buyer's view
6. After buying items in Japan: admin moves order to Bought
7. After confirming final cost: admin clicks "Settle" → modal shows formula-calculated price; admin can accept it or input a `manual_idr_override`
8. Order marked Settled; buyer sees final price with padlock icon; profit tracker updates

### Flow 4b: Admin Cancels an Order
1. Admin opens "Three Dots" menu on any order row
2. Admin selects "Cancel Order" → modal opens with mandatory "Cancellation Reason" text input
3. Admin writes reason (e.g., "Barang tidak tersedia di toko") and confirms
4. Order status changes to `Cancelled`; all price snapshots preserved; admin sees order with "CANCELLED" badge
5. In Profit Tracker, cancelled order is excluded from totals; admin can toggle "Show Cancelled" filter to review lost revenue

### Flow 5: Admin Checks Profit for a Batch
1. Admin opens "Profit Tracker" page
2. They select the batch (by date range or batch name)
3. Dashboard loads: total orders, total revenue IDR, total HPP IDR, gross profit IDR
4. Admin scrolls to per-order breakdown: each Settled order shows final price, HPP, margin
5. Admin can identify highest-margin products for future batch prioritization

### Flow 6: Admin Updates JPY Rate and Adds New Product
1. Admin opens Global Settings
2. Admin updates JPY rate (e.g., from 96 to 98) → confirms save
3. System saves new rate; existing products and orders unchanged
4. Admin opens "Tambah Produk", enters name, category, JPY price
5. System auto-calculates IDR estimate using new rate + current fee%
6. Admin uploads photos → **client pre-processes**: compresses to max 1200px width, converts to WebP 80% quality via canvas API
7. Upload button states: `IDLE` → `COMPRESSING` (spinner) → `UPLOADING` (progress bar 0–100%) → `SUCCESS` (green toast) or `ERROR` (red toast)
8. On success: R2 CDN URLs saved with product
9. Admin saves product → new product appears in catalog with updated estimate

### Flow 7: Session Expiry During Order Submission
1. Buyer has filled in a Custom Order form (URL, name, qty, notes)
2. Mid-completion, session expires silently in background
3. Buyer clicks "Submit" → API returns 401
4. Global Auth Interceptor fires: form data serialized to `sessionStorage`; "Auth Recovery" modal appears: "Sesi kamu habis. Sambungkan ulang dengan Google untuk melanjutkan."
5. Buyer clicks "Reconnect with Google" → Google OAuth popup; on success, session renewed
6. App redirects back to Custom Order page; form fields auto-populated from `sessionStorage`
7. Buyer reviews pre-filled form and resubmits — no data loss

---

## 7. System Behaviour Definitions

The following definitions capture outstanding logic and UI requirements agreed during specification. They are **binding** for implementation.

---

### 7.1 Pricing Logic Engine

**Immutable per-order fields:** Every order stores three values that never mutate after the order moves past Draft:
- `jpy_rate_snapshot` — the JPY→IDR rate at submission time
- `fee_pct_snapshot` — the admin fee percentage at submission time
- `manual_idr_override` — nullable; if set, takes precedence over formula

**Formula:**
```
Final IDR = (JPY_Price × jpy_rate_snapshot × (1 + fee_pct_snapshot / 100))
```

**Override rule:** If `manual_idr_override IS NOT NULL`, that value becomes the Final IDR regardless of the formula calculation.

**Page-by-page price display:**

| Page | Persona | Price Shown | Source |
|---|---|---|---|
| Product Detail | Buyer | IDR Estimate | **Current** global rate + fee% (live) |
| My Orders (Draft) | Buyer | IDR Estimate | Frozen snapshot from submission |
| My Orders (Pending+) | Buyer | Locked IDR Estimate + 🔒 padlock icon | `jpy_rate_snapshot` + `fee_pct_snapshot` |
| My Orders (Settled) | Buyer | Final IDR | `manual_idr_override` or formula result |
| Order Management | Admin | Frozen estimate + snapshot audit | `jpy_rate_snapshot` + `fee_pct_snapshot` displayed; `manual_idr_override` input field visible on Settle modal |

---

### 7.2 Session Timeout & Auth Recovery (Global Auth Interceptor)

Every API call is wrapped by a Global Auth Interceptor that monitors `401 Unauthorized` responses.

**Flow when a 401 is detected:**

```
1. API returns 401 → interceptor catches it
2. In-progress form data is serialized to sessionStorage
   (key: `auth_recovery_<page>`, value: JSON of form fields)
3. "Auth Recovery" modal appears:
   ┌─────────────────────────────────────┐
   │  ⚠️  Sesi kamu habis                │
   │                                     │
   │  Sambungkan ulang dengan Google     │
   │  untuk melanjutkan. Form kamu       │
   │  akan otomatis terisi kembali.      │
   │                                     │
   │     [Reconnect with Google]         │
   └─────────────────────────────────────┘
4. User clicks "Reconnect" → Google OAuth popup
5. On successful re-auth:
   - Redirect back to previous view
   - Read form data from sessionStorage
   - Auto-populate form fields
   - Clear sessionStorage entry
6. If user closes modal without reconnecting:
   - Form data stays in sessionStorage (until tab close)
   - Dismissible warning banner persists on page
```

**Affected pages:** All form-submission pages (Order submission, Custom Order form, admin product edit, admin settings update).

---

### 7.3 Image Upload Pipeline

All product image uploads go through a **client-side pre-processing pipeline before** reaching the R2 upload endpoint.

**Pipeline stages and UI states:**

| Stage | Button State | User Sees |
|---|---|---|
| `IDLE` | Default | "Tambah Foto" / "Upload" button, normal |
| `COMPRESSING` | Spinner on button | Button shows spinner + text "Memproses..." |
| `UPLOADING` | Progress bar (0–100%) | Progress bar within or below button; "Mengunggah 45%..." |
| `SUCCESS` | Green toast | Toast: "✅ Foto berhasil diupload" (auto-dismiss 3s) |
| `ERROR` | Red toast | Toast: message explaining failure (e.g., "❌ Gagal upload. Coba lagi.") |

**Pre-processing rules:**
- Max width: 1200px (resize using browser Canvas API, maintain aspect ratio)
- Format: WebP, quality 80%
- Source formats accepted: JPG, PNG, WEBP
- Max file size **before** compression: 5MB

**Error conditions:**
| Condition | Behavior |
|---|---|
| File > 5MB (pre-compression) | Immediate error toast: "File terlalu besar, maksimal 5MB" — upload does not start |
| Non-image format | Client-side rejection (file input `accept="image/jpeg,image/png,image/webp"`) |
| Canvas compression fails | Falls back to original file; shows warning toast "Kompresi gagal — mengupload file asli"; upload proceeds |
| R2 upload fails | Red toast: "Gagal upload. Coba lagi."; product save blocked until at least 1 photo succeeds |

---

### 7.4 Cancellation Workflow

Cancellation is an admin-only action available from the "Three Dots" context menu on any order row in Order Management. Cancelled orders are **preserved** in the database — all snapshots and history remain intact.

**Status flow with cancellation:**
```
Draft → Pending → Bought → Settled
            ↘                  ↘
          Cancelled         Cancelled
```

Backward transitions (`Settled → Bought`, `Bought → Pending`) remain blocked. Cancellation is a **terminal state** — order cannot be reactivated from Cancelled.

**Cancellation UI:**
1. Admin clicks "Three Dots" (⋮) on any order row → context menu appears
2. Admin selects "Cancel Order" → modal opens
3. Modal contains:
   - Text area: "Alasan pembatalan" (mandatory, max 500 chars)
   - Warning if order is already Settled: "⚠️ Order ini sudah Settled. Data historis tetap tersimpan."
   - Buttons: [Batalkan] (secondary) / [Konfirmasi Cancel] (danger-red)
4. On confirm: status → `Cancelled`, `cancelled_at` timestamp set, `cancellation_reason` stored

**Profit Tracker impact:**
- `Cancelled` orders are **excluded** from all revenue and profit aggregate calculations by default
- Admin can toggle a "Show Cancelled" filter to review cancelled orders
- When filter is active: cancelled orders appear with struck-through revenue values and "CANCELLED" badge; aggregate totals at top remain unchanged (Settled-only)
- This allows admin to see: "I made X in Settled revenue, lost Y to cancellations"

---

## 8. Out of Scope

- Payment gateway / online payment processing
- Shopping cart / checkout flow
- Automated shipment tracking
- Multi-admin roles or RBAC permissions
- Product review / rating system
- Real-time currency rate from external API
