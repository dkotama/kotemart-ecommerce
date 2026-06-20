# Risk Register — Kotemart Jastip Catalog
Source context: discovery session 2026-06-16
Source spec: `kotemart-jastip_v01_spec.md`
Generated: 2026-06-16

---

## 1. Technical Risks

### RISK-1: Google OAuth2 misconfiguration delays launch
- **Description:** If the Google Cloud Console OAuth2 client is not correctly configured (wrong redirect URI, unverified app, or missing scopes), the login flow will fail for all users and the site becomes inaccessible.
- **Category:** Technical
- **Likelihood:** Medium
- **Impact:** High
- **Severity:** High
- **Mitigation:** Document exact OAuth2 setup steps (redirect URI format for Cloudflare Pages, required scopes); test auth flow on staging before go-live. Add setup checklist for client.
- **Owner:** Shared

### RISK-2: D1 SQLite limitations hit at scale
- **Description:** Cloudflare D1 has per-database storage limits and potential query latency under write-heavy workloads; if usage grows beyond the small-scale assumption (<1k users), query performance may degrade.
- **Category:** Technical
- **Likelihood:** Low
- **Impact:** Medium
- **Severity:** Low
- **Mitigation:** Design schema with indexed queries on `user_id`, `status`, `created_at`; monitor D1 usage metrics via Cloudflare dashboard. Acceptable for personal jastip scale.
- **Owner:** Agency

### RISK-3: R2 image upload size or format rejection
- **Description:** If admin uploads very large files or unsupported formats (e.g., HEIC from iPhone), the upload may fail silently or cause R2 storage cost spikes.
- **Category:** Technical
- **Likelihood:** Medium
- **Impact:** Medium
- **Severity:** Medium
- **Mitigation:** Enforce client-side file type validation (JPG, PNG, WEBP only) and file size cap (≤5MB per photo); display clear error if rejected. Compress images before upload using browser API.
- **Owner:** Agency

### RISK-4: Session token leak or CSRF vulnerability
- **Description:** If session tokens are stored insecurely (e.g., localStorage) or CSRF protection is not implemented on state-changing endpoints, a malicious actor could hijack buyer sessions or submit unauthorized orders.
- **Category:** Technical
- **Likelihood:** Low
- **Impact:** High
- **Severity:** Medium
- **Mitigation:** Store session in HttpOnly cookie (not localStorage); validate session token on every API request; implement CSRF token or SameSite=Strict cookie policy.
- **Owner:** Agency

### RISK-5: JPY rate snapshot logic breaks profit accuracy
- **Description:** If the rate snapshot is not correctly persisted per order at creation time, rate changes could retroactively alter profit calculations, making the profit tracker unreliable.
- **Category:** Technical
- **Likelihood:** Medium
- **Impact:** High
- **Severity:** High
- **Mitigation:** Write unit tests for rate snapshot immutability; store `jpy_rate_snapshot` and `fee_pct_snapshot` as immutable columns in the `orders` table; prohibit UPDATE on these fields after order creation.
- **Owner:** Agency

---

## 2. Business Risks

### RISK-6: Buyers confused by "estimasi" pricing causing disputes
- **Description:** If buyers place orders based on the IDR estimate and the final price differs significantly, there may be disputes or cancellations that damage trust.
- **Category:** Business
- **Likelihood:** Medium
- **Impact:** High
- **Severity:** High
- **Mitigation:** Display prominent disclaimer on every price shown ("Harga estimasi — harga final dikonfirmasi admin setelah barang dibeli"). Admin should communicate large price deviations via Telegram before marking Settled.
- **Owner:** Shared

### RISK-7: Jastip gate mismanagement (open when not ready)
- **Description:** If admin forgets to close the gate between batches, buyers may submit orders for a batch that has not yet been planned, causing confusion in order management.
- **Category:** Business
- **Likelihood:** Medium
- **Impact:** Medium
- **Severity:** Medium
- **Mitigation:** Add prominent gate status indicator in admin dashboard; consider gate auto-close reminder or a "batch mode" toggle that disables orders outside active batch window.
- **Owner:** Client

### RISK-8: Single-admin bottleneck
- **Description:** Because the system supports only one admin role, if the admin is unavailable (travel, emergency), orders pile up unprocessed and buyers receive no status updates.
- **Category:** Business
- **Likelihood:** Low
- **Impact:** Medium
- **Severity:** Low
- **Mitigation:** Document that multi-admin support is out of scope for v1. Admin should set Telegram status message during unavailability. Future v2 can add delegated admin access.
- **Owner:** Client

---

## 3. Schedule Risks

### RISK-9: Cloudflare D1 + Workers local dev environment setup delays
- **Description:** Cloudflare's local development environment (`wrangler dev`) for D1 and Workers can be complex to configure, especially for developers not familiar with the platform; this could add 1–2 days of setup overhead.
- **Category:** Schedule
- **Likelihood:** Medium
- **Impact:** Medium
- **Severity:** Medium
- **Mitigation:** Begin with a minimal `wrangler` hello-world spike in Week 1; document D1 migration workflow and local env setup before starting feature development.
- **Owner:** Agency

### RISK-10: Custom Order scope expansion mid-project
- **Description:** The custom order module allows buyers to request anything from any URL (Amazon, Yahoo Auction, etc.); client may request additional validation or product lookup automation, expanding scope beyond the simple form agreed.
- **Category:** Schedule
- **Likelihood:** Medium
- **Impact:** Medium
- **Severity:** Medium
- **Mitigation:** Clearly document that custom order is a "free-form form" only — no product lookup, no price auto-fetch. Any automation is a separate change order. Agree on this in kickoff.
- **Owner:** Shared

---

## 4. Dependency Risks

### RISK-11: Astro build/hydration mismatch between SSG and SSR pages
- **Description:** Mixing SSG catalog pages with SSR order/admin pages in the same Astro project requires careful adapter configuration. If `@astrojs/cloudflare` adapter is misconfigured, SSR pages may fail to hydrate or return stale data on Cloudflare Pages.
- **Category:** Dependency
- **Likelihood:** Low
- **Impact:** Medium
- **Severity:** Low
- **Mitigation:** Use Astro's `hybrid` output mode; define explicit `export const prerender = false` on SSR pages; test all page render modes on `wrangler pages dev` before deploying.
- **Owner:** Agency

### RISK-12: Client delays providing Google OAuth credentials or Cloudflare account access
- **Description:** If the client does not provide Google Cloud Console OAuth2 credentials or Cloudflare account access by Week 1, auth development cannot start, delaying the entire project timeline.
- **Category:** Dependency
- **Likelihood:** Medium
- **Impact:** High
- **Severity:** High
- **Mitigation:** Include credential delivery deadline in the client responsibilities section (Week 1). Start with mock auth flow as fallback to unblock frontend development while waiting.
- **Owner:** Client

---

## 5. Summary

| Risk ID | Title | Category | Severity | Owner |
|---|---|---|---|---|
| RISK-1 | Google OAuth2 misconfiguration delays launch | Technical | High | Shared |
| RISK-5 | JPY rate snapshot logic breaks profit accuracy | Technical | High | Agency |
| RISK-6 | Buyers confused by "estimasi" pricing causing disputes | Business | High | Shared |
| RISK-12 | Client delays providing OAuth or Cloudflare credentials | Dependency | High | Client |
| RISK-3 | R2 image upload size or format rejection | Technical | Medium | Agency |
| RISK-4 | Session token leak or CSRF vulnerability | Technical | Medium | Agency |
| RISK-7 | Jastip gate mismanagement | Business | Medium | Client |
| RISK-9 | Cloudflare D1 + Workers local dev setup delays | Schedule | Medium | Agency |
| RISK-10 | Custom Order scope expansion mid-project | Schedule | Medium | Shared |
| RISK-11 | Astro build/hydration mismatch between SSG and SSR pages | Dependency | Low | Agency |
| RISK-2 | D1 SQLite limitations hit at scale | Technical | Low | Agency |
| RISK-8 | Single-admin bottleneck during unavailability | Business | Low | Client |

**Critical:** 0  **High:** 4  **Medium:** 5  **Low:** 3
