# Kotemart Jastip Catalog — EARS Requirements Specification

**Version:** v01  **Generated:** 2026-06-16  **Stack:** Astro + TailwindCSS + daisyUI + HonoJS on Cloudflare Pages/Workers, D1 + R2

---

## Introduction

This document expresses user requirements for the **Kotemart Jastip Catalog** system using the **EARS (Easy Approach to Requirements Syntax)** notation developed by Alistair Mavin et al. EARS provides six structured natural-language templates that eliminate ambiguity common in free-form requirements:

| Template | Pattern |
|---|---|
| **Ubiquitous** | The \<system\> shall \<action\> |
| **Event-driven** | When \<trigger\>, the \<system\> shall \<action\> |
| **State-driven** | While \<state\>, the \<system\> shall \<action\> |
| **Conditional** | If \<condition\>, then the \<system\> shall \<action\> |
| **Optional feature** | Where \<feature is included\>, the \<system\> shall \<action\> |
| **Unwanted behavior** | If \<trigger\> occurs, then the \<system\> shall \<response\> |

Requirements are numbered with module-scoped prefixes (e.g., `REQ-AUTH-01`) and grouped by the eight functional modules below. Each requirement targets one EARS type. A full Traceability Matrix is provided at the end.

---

## 1. Auth — Google OAuth2, Sessions, Logout, Role Detection

- **REQ-AUTH-01:** The Kotemart Jastip Catalog shall authenticate users exclusively via Google OAuth2, redirecting unauthenticated visitors to the Google sign-in consent screen.
- **REQ-AUTH-02:** When a user successfully completes the Google OAuth2 flow, the Kotemart Jastip Catalog shall create a secure, HTTP-only session cookie with a 7-day expiry and redirect the user to their intended destination URL.
- **REQ-AUTH-03:** When a user clicks the "Logout" button, the Kotemart Jastip Catalog shall invalidate the server-side session record, clear the session cookie, and redirect the user to the public landing page.
- **REQ-AUTH-04:** While a valid session exists, the Kotemart Jastip Catalog shall attach the authenticated user's ID, email, display name, and role (`admin` or `customer`) to every server-side request context.
- **REQ-AUTH-05:** If a Google account email is present in the `admin_users` table in D1, then the Kotemart Jastip Catalog shall assign that user the `admin` role upon session creation; otherwise it shall assign the `customer` role.
- **REQ-AUTH-06:** If an incoming request carries an expired or tampered session token, then the Kotemart Jastip Catalog shall return an HTTP 401 response and redirect the client to the login page without exposing internal error details.
- **REQ-AUTH-07:** While a user holds the `customer` role, the Kotemart Jastip Catalog shall deny access to all routes prefixed with `/admin` and return an HTTP 403 response.
- **REQ-AUTH-08:** If a session idle period exceeds 7 days without renewal, then the Kotemart Jastip Catalog shall automatically expire the session and require the user to re-authenticate.

---

## 2. Catalog — Listing, Filter, Detail, Photo Gallery, JPY→IDR Estimate, Disclaimer

- **REQ-CAT-01:** The Kotemart Jastip Catalog shall display all active catalog items as a paginated grid, showing item name, thumbnail image, JPY price, and IDR estimate on each card.
- **REQ-CAT-02:** When a user applies a category or keyword filter, the Kotemart Jastip Catalog shall re-render the catalog grid to show only items matching all active filter criteria without requiring a full page reload.
- **REQ-CAT-03:** When a user selects a catalog item, the Kotemart Jastip Catalog shall display a detail page containing the full item description, all uploaded photos in a scrollable gallery, JPY price, estimated IDR price, and the currency disclaimer.
- **REQ-CAT-04:** While viewing any catalog item price in IDR, the Kotemart Jastip Catalog shall compute the displayed IDR estimate using the formula `IDR_estimate = JPY_price × current_JPY_rate × (1 + fee_percentage / 100)` sourced from the global settings.
- **REQ-CAT-05:** The Kotemart Jastip Catalog shall display a prominent disclaimer on every IDR estimate stating that the shown price is an approximation only and the final price will be confirmed by the admin after purchase.
- **REQ-CAT-06:** Where R2 photo storage is configured, the Kotemart Jastip Catalog shall serve catalog item images directly from the R2 public bucket URL and fall back to a placeholder image if no photos are attached.
- **REQ-CAT-07:** If a catalog item's `is_active` flag is set to false, then the Kotemart Jastip Catalog shall exclude that item from all customer-facing listing and search results while remaining visible in the admin item management view.
- **REQ-CAT-08:** When an admin updates the global JPY rate in settings, the Kotemart Jastip Catalog shall immediately reflect the new IDR estimates on all catalog pages for subsequent page loads without retroactively altering any existing order records.

---

## 3. Jastip Gate — Open/Close Toggle, Banner, CTA, Order Lock When Closed

- **REQ-GATE-01:** The Kotemart Jastip Catalog shall maintain a global Jastip Gate state (`open` or `closed`) stored in the D1 global settings table, readable by all modules.
- **REQ-GATE-02:** While the Jastip Gate is in the `open` state, the Kotemart Jastip Catalog shall display a prominent banner on the catalog and order pages indicating that orders are currently being accepted, along with a visible "Order Now" call-to-action button.
- **REQ-GATE-03:** While the Jastip Gate is in the `closed` state, the Kotemart Jastip Catalog shall replace the "Order Now" call-to-action with a non-interactive "Gate Closed — Orders Not Accepted" notice and disable all order submission controls.
- **REQ-GATE-04:** When an admin toggles the Jastip Gate from `open` to `closed`, the Kotemart Jastip Catalog shall update the gate state in D1 within one database transaction and immediately reflect the closed state to all subsequent user requests.
- **REQ-GATE-05:** When an admin toggles the Jastip Gate from `closed` to `open`, the Kotemart Jastip Catalog shall update the gate state and display the acceptance banner and CTA on all relevant pages for new page loads.
- **REQ-GATE-06:** If a customer submits an order creation request while the gate state is `closed`, then the Kotemart Jastip Catalog shall reject the request with an HTTP 422 response and display a user-facing message explaining that the gate is currently closed.
- **REQ-GATE-07:** The Kotemart Jastip Catalog shall expose the current gate state and a descriptive batch label (e.g., "Batch #7 — June 2026") on the public landing page so customers can see at a glance whether ordering is available.

---

## 4. Order List — Add Catalog Order, Qty, History, Status View, Final Price on Settled

- **REQ-ORD-01:** While the Jastip Gate is in the `open` state, the Kotemart Jastip Catalog shall allow an authenticated customer to add a catalog item to their order list by specifying a quantity of at least 1.
- **REQ-ORD-02:** When a customer submits a catalog order, the Kotemart Jastip Catalog shall create an order record in D1 with status `Draft`, link it to the current batch, capture a snapshot of the JPY rate and fee percentage at submission time, and return the new order ID to the client.
- **REQ-ORD-03:** The Kotemart Jastip Catalog shall display a personal order history page to each authenticated customer listing all their orders across all batches, sorted by submission date descending, with current status and item summary visible per row.
- **REQ-ORD-04:** While an order is in `Draft`, `Pending`, or `Bought` status, the Kotemart Jastip Catalog shall display the IDR estimate computed from the rate snapshot captured at order submission time.
- **REQ-ORD-05:** When an order transitions to `Settled` status, the Kotemart Jastip Catalog shall display the admin-entered final IDR price on the customer's order history and order detail page, replacing the estimate.
- **REQ-ORD-06:** If a customer attempts to submit a duplicate catalog order for the same item within the same open batch, then the Kotemart Jastip Catalog shall increment the quantity of the existing order record rather than creating a second record, and confirm the update to the user.
- **REQ-ORD-07:** If a customer specifies a quantity of zero or a negative value when adding a catalog order, then the Kotemart Jastip Catalog shall reject the request with a validation error and prompt the customer to enter a quantity of 1 or more.
- **REQ-ORD-08:** The Kotemart Jastip Catalog shall allow a customer to view the full detail of any individual order, including item name, quantity, submitted JPY price, rate snapshot, estimated IDR, current status, and final price once settled.

---

## 5. Custom Order — Form, History Appearance, Admin Pricing Flow

- **REQ-CUST-01:** While the Jastip Gate is in the `open` state, the Kotemart Jastip Catalog shall present authenticated customers with a Custom Order form containing fields for: item URL, item description, quantity, and additional notes.
- **REQ-CUST-02:** When a customer submits a valid Custom Order form, the Kotemart Jastip Catalog shall create a custom order record in D1 with status `Draft`, associate it with the current batch and submitting user, and confirm submission with the assigned order ID.
- **REQ-CUST-03:** The Kotemart Jastip Catalog shall display custom orders alongside catalog orders in the customer's unified order history, distinguished by a "Custom" type badge, with status and submission date visible.
- **REQ-CUST-04:** If a customer submits the Custom Order form without providing at least one of item URL or item description, then the Kotemart Jastip Catalog shall reject the form with a field-level validation error and retain all other entered values.
- **REQ-CUST-05:** When an admin opens a custom order record in the admin panel, the Kotemart Jastip Catalog shall display all submitted fields (URL, description, quantity, notes) and provide an input for entering the JPY price before advancing the order status.
- **REQ-CUST-06:** If an admin attempts to advance a custom order beyond `Draft` status without entering a JPY price, then the Kotemart Jastip Catalog shall block the transition and display a validation message requiring the price field to be filled.
- **REQ-CUST-07:** Where a customer provides an item URL in a custom order, the Kotemart Jastip Catalog shall render the URL as a clickable hyperlink in the admin order detail view to facilitate product verification.

---

## 6. Order Management / Status Flow — Admin Status Transitions, Final Price, Rate Snapshot

- **REQ-MGMT-01:** The Kotemart Jastip Catalog shall enforce a linear order status pipeline: `Draft` → `Pending` → `Bought` → `Settled`, permitting forward transitions only.
- **REQ-MGMT-02:** When an admin advances an order from `Draft` to `Pending`, the Kotemart Jastip Catalog shall record the transition timestamp and the acting admin's user ID in the order audit log.
- **REQ-MGMT-03:** When an admin advances an order to `Settled` status, the Kotemart Jastip Catalog shall require a final IDR price input, persist it to the order record, and mark the order as fully resolved.
- **REQ-MGMT-04:** If an admin attempts to transition an order to any status earlier in the pipeline (e.g., `Bought` → `Pending`), then the Kotemart Jastip Catalog shall reject the request with an HTTP 422 response and display an error message stating that backward transitions are not permitted.
- **REQ-MGMT-05:** While an order is in any status, the Kotemart Jastip Catalog shall preserve the JPY rate and fee percentage snapshot captured at order creation time as immutable fields, preventing any subsequent global rate change from altering those values.
- **REQ-MGMT-06:** When an order reaches `Settled` status, the Kotemart Jastip Catalog shall notify the ordering customer via an in-app status update visible on their order history page, reflecting the final price.
- **REQ-MGMT-07:** The Kotemart Jastip Catalog shall allow admins to filter the order management list by batch, status, order type (catalog or custom), and customer name to facilitate efficient bulk status updates.
- **REQ-MGMT-08:** If an admin attempts to submit a `Settled` status transition without entering a final IDR price, then the Kotemart Jastip Catalog shall block the transition and present a validation error requiring the final price field.

---

## 7. Profit Tracker — Settled-Only, Per-Batch, Per-Order Breakdown, Stat Totals

- **REQ-PROF-01:** The Kotemart Jastip Catalog shall restrict access to the Profit Tracker module exclusively to users with the `admin` role, returning HTTP 403 for any customer-role access attempt.
- **REQ-PROF-02:** While viewing the Profit Tracker, the Kotemart Jastip Catalog shall include only orders with `Settled` status in all profit calculations, excluding Draft, Pending, and Bought orders entirely.
- **REQ-PROF-03:** The Kotemart Jastip Catalog shall display profit data grouped by batch, showing for each batch: total JPY cost, total final IDR collected, total estimated IDR at snapshot rate, and net profit (final IDR minus cost converted at snapshot rate).
- **REQ-PROF-04:** When an admin selects a specific batch in the Profit Tracker, the Kotemart Jastip Catalog shall display a per-order breakdown table listing order ID, item name or custom description, quantity, JPY price, rate snapshot, estimated IDR, final IDR, and individual profit margin.
- **REQ-PROF-05:** The Kotemart Jastip Catalog shall display aggregate stat totals across all batches on the Profit Tracker dashboard, including: total settled orders, total revenue (IDR), total cost (IDR equivalent), and overall profit margin percentage.
- **REQ-PROF-06:** If no settled orders exist for a selected batch, then the Kotemart Jastip Catalog shall display a "No settled orders in this batch" message rather than rendering an empty or broken table.
- **REQ-PROF-07:** Where export functionality is included, the Kotemart Jastip Catalog shall allow admins to download the per-batch profit breakdown as a CSV file containing all per-order fields.

---

## 8. Admin Panel & Global Settings — JPY Rate, Fee%, Telegram Link, Rate Snapshot, User Management

- **REQ-ADM-01:** The Kotemart Jastip Catalog shall provide an Admin Settings page allowing authorized admins to update the global JPY-to-IDR exchange rate, service fee percentage, and Telegram contact link at any time.
- **REQ-ADM-02:** When an admin saves a new JPY rate or fee percentage, the Kotemart Jastip Catalog shall persist the new value to D1 and apply it to all catalog IDR estimates and new order submissions from that point forward.
- **REQ-ADM-03:** If an admin saves a new JPY rate or fee percentage, then the Kotemart Jastip Catalog shall not retroactively update the rate snapshot stored on any existing order record, preserving each order's original pricing context.
- **REQ-ADM-04:** The Kotemart Jastip Catalog shall display the Telegram contact link in a globally visible location (e.g., site footer and order confirmation pages) so customers can reach the admin for inquiries.
- **REQ-ADM-05:** The Kotemart Jastip Catalog shall provide an admin user management interface listing all registered users with their email, display name, assigned role, and registration date, with the ability to promote a customer to admin or demote an admin to customer.
- **REQ-ADM-06:** When an admin promotes a user to the `admin` role, the Kotemart Jastip Catalog shall insert the user's email into the `admin_users` table and apply the new role on the user's next authenticated request.
- **REQ-ADM-07:** If an admin attempts to set the JPY rate to zero or a negative value, then the Kotemart Jastip Catalog shall reject the input with a validation error and retain the previously saved rate unchanged.
- **REQ-ADM-08:** If an admin attempts to set the service fee percentage to a value less than 0 or greater than 100, then the Kotemart Jastip Catalog shall reject the input with a validation error and retain the previously saved fee percentage unchanged.

---

## Traceability Matrix

| REQ ID | EARS Type | Module | User Story Ref | Priority (MoSCoW) |
|---|---|---|---|---|
| REQ-AUTH-01 | Ubiquitous | Auth | US-AUTH-001: As a visitor, I want to sign in with Google | Must |
| REQ-AUTH-02 | Event-driven | Auth | US-AUTH-002: As a user, I want a session created after OAuth success | Must |
| REQ-AUTH-03 | Event-driven | Auth | US-AUTH-003: As a user, I want to log out and have my session cleared | Must |
| REQ-AUTH-04 | State-driven | Auth | US-AUTH-004: As the system, I want user context on every request | Must |
| REQ-AUTH-05 | Conditional | Auth | US-AUTH-005: As an admin, I want my role auto-detected at login | Must |
| REQ-AUTH-06 | Unwanted behavior | Auth | US-AUTH-006: As the system, I want expired tokens rejected safely | Must |
| REQ-AUTH-07 | State-driven | Auth | US-AUTH-007: As the system, I want customers blocked from admin routes | Must |
| REQ-AUTH-08 | Unwanted behavior | Auth | US-AUTH-008: As the system, I want idle sessions auto-expired | Must |
| REQ-CAT-01 | Ubiquitous | Catalog | US-CAT-001: As a customer, I want to browse catalog items in a grid | Must |
| REQ-CAT-02 | Event-driven | Catalog | US-CAT-002: As a customer, I want to filter catalog items by category | Must |
| REQ-CAT-03 | Event-driven | Catalog | US-CAT-003: As a customer, I want to view item detail with photo gallery | Must |
| REQ-CAT-04 | State-driven | Catalog | US-CAT-004: As a customer, I want to see IDR estimates on all prices | Must |
| REQ-CAT-05 | Ubiquitous | Catalog | US-CAT-005: As a customer, I want a disclaimer next to every IDR price | Must |
| REQ-CAT-06 | Optional feature | Catalog | US-CAT-006: As an admin, I want photos served from R2 storage | Must |
| REQ-CAT-07 | Conditional | Catalog | US-CAT-007: As an admin, I want inactive items hidden from customers | Must |
| REQ-CAT-08 | Event-driven | Catalog | US-CAT-008: As a customer, I want fresh IDR estimates after rate change | Must |
| REQ-GATE-01 | Ubiquitous | Jastip Gate | US-GATE-001: As the system, I want a persistent gate state in D1 | Must |
| REQ-GATE-02 | State-driven | Jastip Gate | US-GATE-002: As a customer, I want to see an open-gate banner and CTA | Must |
| REQ-GATE-03 | State-driven | Jastip Gate | US-GATE-003: As a customer, I want order controls disabled when gate closed | Must |
| REQ-GATE-04 | Event-driven | Jastip Gate | US-GATE-004: As an admin, I want gate close to take effect immediately | Must |
| REQ-GATE-05 | Event-driven | Jastip Gate | US-GATE-005: As an admin, I want gate open to show acceptance banner | Must |
| REQ-GATE-06 | Unwanted behavior | Jastip Gate | US-GATE-006: As the system, I want API orders rejected when gate closed | Must |
| REQ-GATE-07 | Ubiquitous | Jastip Gate | US-GATE-007: As a customer, I want to see gate status on landing page | Must |
| REQ-ORD-01 | State-driven | Order List | US-ORD-001: As a customer, I want to add catalog items while gate is open | Must |
| REQ-ORD-02 | Event-driven | Order List | US-ORD-002: As a customer, I want an order created with rate snapshot | Must |
| REQ-ORD-03 | Ubiquitous | Order List | US-ORD-003: As a customer, I want to view my full order history | Must |
| REQ-ORD-04 | State-driven | Order List | US-ORD-004: As a customer, I want IDR estimates shown for active orders | Must |
| REQ-ORD-05 | Event-driven | Order List | US-ORD-005: As a customer, I want to see the final price when settled | Must |
| REQ-ORD-06 | Unwanted behavior | Order List | US-ORD-006: As the system, I want duplicate orders merged by quantity | Must |
| REQ-ORD-07 | Unwanted behavior | Order List | US-ORD-007: As the system, I want zero/negative quantity rejected | Must |
| REQ-ORD-08 | Ubiquitous | Order List | US-ORD-008: As a customer, I want to view full order detail | Must |
| REQ-CUST-01 | State-driven | Custom Order | US-CUST-001: As a customer, I want a custom order form when gate is open | Should |
| REQ-CUST-02 | Event-driven | Custom Order | US-CUST-002: As a customer, I want custom orders saved with Draft status | Should |
| REQ-CUST-03 | Ubiquitous | Custom Order | US-CUST-003: As a customer, I want custom orders in my unified history | Should |
| REQ-CUST-04 | Unwanted behavior | Custom Order | US-CUST-004: As the system, I want empty custom order forms rejected | Should |
| REQ-CUST-05 | Event-driven | Custom Order | US-CUST-005: As an admin, I want to enter JPY price for custom orders | Should |
| REQ-CUST-06 | Unwanted behavior | Custom Order | US-CUST-006: As the system, I want status advance blocked without price | Should |
| REQ-CUST-07 | Optional feature | Custom Order | US-CUST-007: As an admin, I want item URLs rendered as clickable links | Should |
| REQ-MGMT-01 | Ubiquitous | Order Management | US-MGMT-001: As an admin, I want a linear status pipeline enforced | Must |
| REQ-MGMT-02 | Event-driven | Order Management | US-MGMT-002: As an admin, I want transitions logged with timestamp | Must |
| REQ-MGMT-03 | Event-driven | Order Management | US-MGMT-003: As an admin, I want to enter final price on Settled | Must |
| REQ-MGMT-04 | Unwanted behavior | Order Management | US-MGMT-004: As the system, I want backward transitions rejected | Must |
| REQ-MGMT-05 | State-driven | Order Management | US-MGMT-005: As the system, I want rate snapshots immutable on orders | Must |
| REQ-MGMT-06 | Event-driven | Order Management | US-MGMT-006: As a customer, I want in-app notification on Settled | Must |
| REQ-MGMT-07 | Ubiquitous | Order Management | US-MGMT-007: As an admin, I want to filter orders by batch/status/type | Must |
| REQ-MGMT-08 | Unwanted behavior | Order Management | US-MGMT-008: As the system, I want Settled blocked without final price | Must |
| REQ-PROF-01 | Ubiquitous | Profit Tracker | US-PROF-001: As the system, I want profit tracker restricted to admins | Should |
| REQ-PROF-02 | State-driven | Profit Tracker | US-PROF-002: As an admin, I want only Settled orders in profit reports | Should |
| REQ-PROF-03 | Ubiquitous | Profit Tracker | US-PROF-003: As an admin, I want profit grouped by batch | Should |
| REQ-PROF-04 | Event-driven | Profit Tracker | US-PROF-004: As an admin, I want per-order breakdown when batch selected | Should |
| REQ-PROF-05 | Ubiquitous | Profit Tracker | US-PROF-005: As an admin, I want aggregate totals across all batches | Should |
| REQ-PROF-06 | Unwanted behavior | Profit Tracker | US-PROF-006: As the system, I want empty batches to show a message | Should |
| REQ-PROF-07 | Optional feature | Profit Tracker | US-PROF-007: As an admin, I want CSV export of batch profit data | Could |
| REQ-ADM-01 | Ubiquitous | Admin Panel | US-ADM-001: As an admin, I want to update JPY rate, fee%, Telegram link | Must |
| REQ-ADM-02 | Event-driven | Admin Panel | US-ADM-002: As an admin, I want new rates applied to future orders | Must |
| REQ-ADM-03 | Conditional | Admin Panel | US-ADM-003: As the system, I want rate changes non-retroactive on orders | Must |
| REQ-ADM-04 | Ubiquitous | Admin Panel | US-ADM-004: As a customer, I want the Telegram link visible site-wide | Must |
| REQ-ADM-05 | Ubiquitous | Admin Panel | US-ADM-005: As an admin, I want to manage user roles from a list | Must |
| REQ-ADM-06 | Event-driven | Admin Panel | US-ADM-006: As an admin, I want promoted users to gain admin role | Must |
| REQ-ADM-07 | Unwanted behavior | Admin Panel | US-ADM-007: As the system, I want zero/negative JPY rates rejected | Must |
| REQ-ADM-08 | Unwanted behavior | Admin Panel | US-ADM-008: As the system, I want out-of-range fee% rejected | Must |
