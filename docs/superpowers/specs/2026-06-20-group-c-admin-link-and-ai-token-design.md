# Group C — Admin Buy Link + AI Assistant Token

**Date:** 2026-06-20
**Branch target:** `feature/order-flow-info` (or a fresh branch)
**Status:** Design — pending implementation plan
**Independent of:** Groups A & B (no shared surface).

## Goal

Two admin-facing additions:
1. **C1** — a one-click "buy" web link on every admin order row (catalog orders use the
   variant's `product_url`; custom orders already show `reference_url`).
2. **C2** — a generated bearer token that lets an AI agent manage the jastip as a full admin
   via the existing API (no OAuth/browser), plus a Claude-Code skill file teaching the agent
   how to use it.

---

## C1 — Buy link on admin orders

**Files:** `src/pages/admin/orders.astro`

### Query
Extend the orders query (`:15`) to surface the variant buy URL for catalog orders:
- Add `o.variant_id` to the SELECT.
- `LEFT JOIN product_variants v ON v.id = o.variant_id`.
- Select `v.product_url AS buy_url`.

Add `buy_url: string | null` and `variant_id: string | null` to the `OrderRow` type
(`src/lib/types.ts`) — or to the local row shape if `OrderRow` is page-local.

### UI
In the "Produk / Nama" cell (`:124`), below the product name:
- If `order.buy_url` exists (catalog order with a variant URL) → show a "Beli" link
  (`target="_blank"`, `rel="noreferrer"`), same styling as the existing "Link Produk".
- Else if `order.reference_url` exists (custom order) → keep the existing "Link Produk" link.
- Both can show when both exist; the goal is every row has a buy link when any URL is present.

Stash `buy_url` on the row's `data-*` attributes if the link needs to be reachable from the
row's action scripts (not strictly required for a static anchor).

### Testing
E2E (`tests/e2e.spec.ts`): a catalog order whose variant has a `product_url` renders a "Beli"
link with the correct `href`; a custom order renders "Link Produk" from `reference_url`.

---

## C2 — AI assistant token + skill

### C2.0 — Schema
**File:** `db/migration_v09_api_tokens.sql`

```sql
CREATE TABLE IF NOT EXISTS api_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL DEFAULT 'AI Assistant',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  revoked_at   DATETIME
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
```

Raw token is shown **once** at creation; only `token_hash` (sha256 hex) is persisted. Revocation
= setting `revoked_at` (row kept for audit). No expiry (revocable only) per decision.

### C2.1 — Token auth in `authMiddleware`
**File:** `src/pages/api/[...path].ts` (`:28`)

Extend `authMiddleware` to accept `Authorization: Bearer <raw_token>` in addition to the
session cookie:
1. Read `Authorization` header. If present and starts with `Bearer `:
   - `const hash = await sha256(raw)` (use `crypto.subtle`, hex-encode).
   - Look up `api_tokens` by `token_hash` WHERE `revoked_at IS NULL`.
   - If found: load the linked `users` row, stamp `last_used_at = CURRENT_TIMESTAMP`
     (fire-and-forget `UPDATE`), set `c.set('user', user)`, `await next()`.
   - If not found: return `401`.
2. Else fall through to the existing cookie/session path unchanged.

Because the token resolves to a real admin `user`, it passes `adminMiddleware` automatically —
**every existing admin endpoint is usable by the agent with no new routes**. Actions are
attributed to the linked admin user (the one who generated the token).

A small `sha256hex(input: string): Promise<string>` helper is added (Web Crypto). Token
generation reuses the existing `generateToken()` from `src/lib/session.ts` (two concatenated
UUIDs), optionally prefixed `jastip_` for readability.

### C2.2 — Token management UI + endpoints
**File:** `src/pages/admin/settings.astro` (new "API Tokens" section), `src/pages/api/[...path].ts`

New admin endpoints (both behind `authMiddleware` + `adminMiddleware`):
- `POST /api/admin/tokens` — body `{ label?: string }`. Creates a token linked to the current
  admin (`c.get('user').id`), returns `{ id, label, token }` exactly once (the raw token; the
  hash is stored, the raw value is never retrievable again).
- `DELETE /api/admin/tokens/:id` — sets `revoked_at` (soft revoke).
- `GET /api/admin/tokens` — lists `{ id, label, created_at, last_used_at, revoked_at }` (no
  raw tokens).

UI on `/admin/settings`:
- "Generate Token" button + optional label input.
- On success: a modal/toast showing the raw token with a Copy button and a warning that it
  won't be shown again.
- A table of existing tokens (label, created, last used, status, Revoke button).

### C2.3 — Agent skill
**File:** new `.claude/skills/jastip-admin/SKILL.md`

Claude-Code-style skill (YAML frontmatter `name`, `description`) whose body documents:
- **Base URL:** `https://jastip.dkotama.com` (configurable via `JASTIP_BASE_URL`).
- **Auth:** every request carries `Authorization: Bearer $JASTIP_TOKEN` — the token comes from
  the `JASTIP_TOKEN` env var and is **never** written into the skill or committed.
- **Endpoints the agent may use** (verified against `api/[...path].ts`):
  - `GET /api/admin/orders` — list/filter orders.
  - `PATCH /api/admin/orders/:id/status` — advance status (`Draft`→`Pending`→`Bought`).
  - `PATCH /api/admin/orders/:id/cancel` — cancel (not allowed once Bought).
  - `PATCH /api/admin/orders/:id/payment` — DP / paid amount.
  - `GET /api/products`, `POST/PUT/DELETE /api/products[/:id]`, variant sub-routes — catalog CRUD.
  - `POST /api/gate/toggle` — open/close the batch gate.
  - `GET/PUT /api/admin/settings` — read/update settings (rate, fee, categories, etc.).
  - `GET /api/admin/profit`, `GET /api/admin/users`.
- **Example flows:** "list pending orders and summarize", "mark order KTM-xxxx Bought"
  (`PATCH /api/admin/orders/KTM-xxxx/status`), "close the gate" (`POST /api/gate/toggle`).
  Each as a short curl-style call.
- **Constraints:** never leak the token; confirm before destructive actions (cancel order,
  delete product, close gate) — same caution as a human admin.

The skill is loaded by a local Claude Code agent the operator runs against the deploy.

### Testing
- Unit: `sha256hex` round-trip (hash then verify against a known vector).
- E2E (`tests/e2e.spec.ts`):
  1. Token auth — a request with a valid `Bearer` token reaches an admin endpoint (e.g.
     `GET /api/admin/settings`) and returns 200; a revoked token returns 401; a missing/invalid
     token returns 401.
  2. Generate/revoke flow on `/admin/settings` — generate shows the token once, revoke
     invalidates it.
  3. The C1 buy-link assertion (above).

Token values used in tests are generated and revoked within the test (cleanup on teardown).

---

## Security notes

- Raw tokens are returned exactly once; only hashes are stored — a DB leak does not expose
  usable tokens.
- `Authorization` header is checked before the cookie, but both are mutually exclusive paths;
  a browser session is unaffected.
- Token = full admin. Mitigations: revocable instantly, `last_used_at` for monitoring,
  operator keeps the token in a secret (env/`.dev.vars`), never in the repo. A future scope
  cap can be layered on without changing the auth shape.

---

## Out of scope

- Token capability scoping / read-only mode (deferred — currently full admin).
- Token expiry/rotation automation (revocable only, per decision).
