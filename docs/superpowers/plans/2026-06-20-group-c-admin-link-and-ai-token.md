# Admin Buy Link & AI Assistant Token (Group C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one-click "Beli" web links for catalog orders on the admin orders page, a secure bearer-token authentication flow for API requests, a management UI on `/admin/settings` to generate and revoke tokens, and a Claude Code agent skill file mapping available endpoints.

**Architecture:** Extend SQLite database with `api_tokens` table, join product variant URL onto the admin orders query, intercept authorization headers inside Hono's `authMiddleware` using sha256 hashes of Bearer tokens, build a token creation/revocation UI on the admin Settings page, and write the agent instruction document in `.claude/skills/jastip-admin/SKILL.md`.

**Tech Stack:** Astro 6, Hono, Cloudflare D1 (SQLite), Web Crypto API, Playwright.

---

### Task 1: Database Migration & Schema Setup

**Files:**
- Create: `db/migration_v09_api_tokens.sql`
- Modify: `db/schema.sql` (append additions)

- [ ] **Step 1: Create the SQL migration file**
Create `db/migration_v09_api_tokens.sql` with the following content:
```sql
-- ============================================================
-- Kotemart Jastip — Migration v09
-- Adds api_tokens table for full admin API authorization
-- ============================================================

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

- [ ] **Step 2: Apply migration locally**
Run: `npx wrangler d1 execute DB --local --file=db/migration_v09_api_tokens.sql`
Expected output: Success message showing table creation.

- [ ] **Step 3: Update `db/schema.sql`**
Append the `api_tokens` table and index SQL commands to the bottom of `db/schema.sql`.

- [ ] **Step 4: Commit**
```bash
git add db/migration_v09_api_tokens.sql db/schema.sql
git commit -m "db: add schema migration v09 for API tokens"
```

---

### Task 2: Buy Links on Admin Orders Page

**Files:**
- Modify: `src/pages/admin/orders.astro`
- Modify: `src/lib/types.ts` (extend OrderRow)

- [ ] **Step 1: Update the OrderRow TypeScript interface**
In `src/lib/types.ts`, update `OrderRow`:
```typescript
export interface OrderRow extends Order {
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp?: string | null;
  buy_url?: string | null; // Added
}
```

- [ ] **Step 2: Modify the orders SQL query to join variant URL**
In `src/pages/admin/orders.astro` line 15, update the query:
```sql
SELECT o.id, o.user_id, o.product_id, o.type, o.name, o.description, o.reference_url, o.qty,
       o.status, o.price_jpy, o.jpy_rate_snapshot, o.fee_pct_snapshot,
       o.price_idr_estimate, o.price_idr_final, o.manual_idr_override,
       o.bought_price_jpy, o.custom_fee_idr, o.down_payment_idr, o.paid_amount_idr,
       o.notes, o.cancellation_reason, o.cancelled_at, o.settled_at, o.created_at,
       u.name as buyer_name, u.email as buyer_email, u.whatsapp_number as buyer_whatsapp,
       v.product_url as buy_url
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN product_variants v ON v.id = o.variant_id
ORDER BY o.created_at DESC
```

- [ ] **Step 3: Render the "Beli" link in the order row markup**
In `src/pages/admin/orders.astro` around line 124 (inside the "Produk / Nama" table cell):
```html
<td class="py-4 px-4 max-w-[200px] truncate">
  <div class="font-semibold text-[#1A1D23]">{order.name}</div>
  <div class="flex gap-2 mt-0.5">
    {order.reference_url && (
      <a href={order.reference_url} target="_blank" class="text-[0.75rem] text-[#1A8F89] hover:underline" rel="noreferrer">
        Link Produk
      </a>
    )}
    {order.buy_url && (
      <a href={order.buy_url} target="_blank" class="text-[0.75rem] text-[#0F726E] font-semibold hover:underline" rel="noreferrer">
        Beli
      </a>
    )}
  </div>
</td>
```
Ensure that if it's a catalog order, both the product source/reference URL and the variant buy link display nicely.

- [ ] **Step 4: Verify visually in browser**
Go to `/admin/orders` on local server and verify that catalog orders having variant URLs render the green "Beli" link next to "Link Produk".

- [ ] **Step 5: Commit**
```bash
git add src/pages/admin/orders.astro src/lib/types.ts
git commit -m "admin: add direct variant buy link on orders list"
```

---

### Task 3: API Bearer Token Authentication Middleware

**Files:**
- Modify: `src/pages/api/[...path].ts`

- [ ] **Step 1: Add sha256 helper function**
Add the Web Crypto hashing function helper at the top of `src/pages/api/[...path].ts`:
```typescript
async function sha256(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 2: Update authMiddleware to support Bearer Token header**
In `src/pages/api/[...path].ts` at line 28, rewrite `authMiddleware`:
```typescript
const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: User };
}>(async (c, next) => {
  // Check Authorization header first
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    const hash = await sha256(rawToken);
    
    const tokenRow = await c.env.DB.prepare(
      `SELECT * FROM api_tokens WHERE token_hash = ?1 AND revoked_at IS NULL`
    ).bind(hash).first<{ user_id: string; id: string }>();
    
    if (tokenRow) {
      // Find linked user
      const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?1 AND is_active = 1`)
        .bind(tokenRow.user_id).first<User>();
      if (user) {
        // Stamp last used timestamp (async fire-and-forget)
        c.executionCtx.waitUntil(
          c.env.DB.prepare(`UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?1`)
            .bind(tokenRow.id).run()
        );
        c.set('user', user);
        return await next();
      }
    }
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }

  // Fallback to cookie auth
  const token = getCookie(c, 'session');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const user = await validateSession(c.env.DB, token);
  if (!user) {
    deleteCookie(c, 'session', { path: '/' });
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', user as User);
  await next();
});
```

- [ ] **Step 3: Commit**
```bash
git add src/pages/api/\[...path\].ts
git commit -m "api: intercept Authorization Bearer tokens in authMiddleware"
```

---

### Task 4: Token Management Endpoints

**Files:**
- Modify: `src/pages/api/[...path].ts`

- [ ] **Step 1: Write token endpoints**
Inside the admin router section of `src/pages/api/[...path].ts`, add GET, POST, and DELETE endpoints:
```typescript
import { generateToken } from '../../lib/session';

// GET /api/admin/tokens (admin only)
adminRouter.get('/tokens', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, label, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC`
  ).all();
  return c.json(result.results || []);
});

// POST /api/admin/tokens (admin only, create token)
const createTokenSchema = z.object({
  label: z.string().min(1).max(100).default('AI Assistant'),
});
adminRouter.post('/tokens', zValidator('json', createTokenSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');
  const id = crypto.randomUUID();
  
  // Generate random token and hash it
  const rawToken = 'jastip_' + generateToken();
  const hash = await sha256(rawToken);
  
  await c.env.DB.prepare(
    `INSERT INTO api_tokens (id, user_id, token_hash, label) VALUES (?1, ?2, ?3, ?4)`
  ).bind(id, user.id, hash, body.label).run();
  
  return c.json({ id, label: body.label, token: rawToken }, 201);
});

// DELETE /api/admin/tokens/:id (admin only, soft-revoke token)
adminRouter.delete('/tokens/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(
    `UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?1`
  ).bind(id).run();
  return c.json({ ok: true });
});
```

- [ ] **Step 2: Verify compiling**
Test that Hono API compiles and runs without issues.

- [ ] **Step 3: Commit**
```bash
git add src/pages/api/\[...path\].ts
git commit -m "api: implement token generation and revocation endpoints for admins"
```

---

### Task 5: Admin Token Settings UI

**Files:**
- Modify: `src/pages/admin/settings.astro`

- [ ] **Step 1: Render the Token list panel**
In `src/pages/admin/settings.astro` server-side block, load generated tokens:
```typescript
let tokens: { id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }[] = [];
try {
  const db = (env as any).DB;
  if (db) {
    const res = await db.prepare(`SELECT id, label, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC`).all();
    tokens = res.results || [];
  }
} catch {}
```
Append the API Tokens HTML block underneath Bank Account settings:
```html
<div class="bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-sm flex flex-col gap-4">
  <h3 class="font-bold text-[1.125rem] text-[#1A1D23] leading-tight">API Tokens (AI Assistant)</h3>
  <p class="text-[0.8125rem] text-[#5B606D] -mt-2">Kelola token akses API untuk asisten AI.</p>
  <div class="border-t border-[#E8E9ED] pt-4 flex flex-col gap-4">
    <!-- List of active/revoked tokens in a table or small card list -->
    <div class="flex gap-2">
      <input type="text" id="token-label-input" placeholder="Label token..." class="flex-grow h-[36px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem]" />
      <button id="btn-generate-token" class="h-[36px] px-4 bg-[#0F726E] text-white hover:bg-[#0A5D59] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all">Generate</button>
    </div>
    
    <!-- Token Modal/Toast presentation element -->
    <dialog id="token-show-modal" class="modal">
      <div class="modal-box bg-white max-w-[400px] border">
        <h3 class="font-bold text-md mb-2">Token Berhasil Dibuat!</h3>
        <p class="text-xs text-[#5B606D] mb-4">Salin token ini sekarang. Token tidak akan ditampilkan lagi demi keamanan.</p>
        <div class="flex items-center gap-2 bg-[#F9F9F7] p-2 rounded border mb-4">
          <code id="raw-token-display" class="text-xs break-all flex-grow font-mono font-semibold"></code>
        </div>
        <div class="modal-action">
          <button type="button" class="btn text-xs" onclick="document.getElementById('token-show-modal').close()">Selesai</button>
        </div>
      </div>
    </dialog>
  </div>
</div>
```

- [ ] **Step 2: Add client-side logic to trigger creation / revocation**
Write javascript bindings at the bottom of `/admin/settings.astro` to call `POST /api/admin/tokens` and `DELETE /api/admin/tokens/:id` dynamically and refresh the page.

- [ ] **Step 3: Verify visually in browser**
Open `/admin/settings`, generate a token, verify the modal reveals it, verify list updates and revocation works.

- [ ] **Step 4: Commit**
```bash
git add src/pages/admin/settings.astro
git commit -m "admin: add API token management interface on settings page"
```

---

### Task 6: AI Agent Skill Document

**Files:**
- Create: `.claude/skills/jastip-admin/SKILL.md`

- [ ] **Step 1: Write SKILL.md**
Create `.claude/skills/jastip-admin/SKILL.md` containing the following template:
```markdown
---
name: jastip-admin
description: Manage the Kotemart Jastip orders and catalog using admin API authorization tokens
---

# Jastip Admin API Skill

Allows driving the Kotemart Jastip admin endpoints directly.

## Setup

Set $JASTIP_TOKEN and $JASTIP_BASE_URL (defaults to https://jastip.dkotama.com) environment variables.
Every HTTP request must contain this header:
`Authorization: Bearer $JASTIP_TOKEN`

## Available Endpoints

### 1. Orders
- `GET /api/admin/orders` -> List all orders
- `PATCH /api/admin/orders/:id/status` -> Advance status (Body: `{ "status": "Pending" | "Bought" }`)
- `PATCH /api/admin/orders/:id/cancel` -> Cancel order (Body: `{ "cancellation_reason": string }`)
- `PATCH /api/admin/orders/:id/payment` -> Set DP/Paid amount (Body: `{ "down_payment_idr": number, "paid_amount_idr": number }`)

### 2. Products & Variants
- `GET /api/products` -> List public catalog
- `POST /api/products` -> Create product
- `PUT /api/products/:id` -> Update product details
- `DELETE /api/products/:id` -> Soft-delete product
- `POST /api/products/:id/variants` -> Add variant
- `PUT /api/products/:id/variants/:vid` -> Edit variant

### 3. Settings & Gate
- `POST /api/gate/toggle` -> Open/close batch gate
- `GET /api/admin/settings` -> Read settings
- `PUT /api/admin/settings` -> Update settings (exchange rates, fees, categories)

## Example Flows

### Confirm an order Bought
```bash
curl -X PATCH "$JASTIP_BASE_URL/api/admin/orders/KTM-1234/status" \
  -H "Authorization: Bearer $JASTIP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "Bought"}'
```
```

- [ ] **Step 2: Commit**
```bash
git add .claude/skills/jastip-admin/SKILL.md
git commit -m "docs: add AI assistant skill.md instructions for API access"
```

---

### Task 7: E2E Verification Tests

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Write E2E test cases**
Append tests in `tests/e2e.spec.ts` verifying:
1. Token auth header returns status correctly.
2. Token generation and revocation UI operations on settings.
3. Order rows rendering the Beli links.

- [ ] **Step 2: Run verification**
Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add tests/e2e.spec.ts
git commit -m "test: add E2E tests for Group C buy-links and bearer tokens"
```
