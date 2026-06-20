# Kotemart Jastip — Project Context

## Memory

Read `.memory/` at session start for project decisions and conventions. Guidelines for updating this memory are in `.memory/000-how-to-memory.md`.

## Guidelines

**Simplicity first.** Minimum code that solves the problem. No abstractions for single-use code. No speculative features. If you write 200 lines and it could be 50, rewrite it.

**Surgical changes.** Touch only what the task requires. Match existing style. Don't refactor unrelated code.

**Goal-driven.** Define success criteria before coding. "Fix the bug" → reproduce it in a test first.

**TDD (mandatory).** Write a failing test before implementation code. E2E tests go in `tests/e2e.spec.ts` using `data-testid` selectors. Unit tests for business logic in `src/lib/`.

**CUJ coverage.** Every new feature or behavior change needs a Critical User Journey test. Mock external systems. Tests clean up after themselves.

## Stack

- **Astro 6** (SSR, `output: 'server'`). Every page: `export const prerender = false`.
- **Hono** — ALL API routes in one catch-all file: `src/pages/api/[...path].ts`. Add endpoints there.
- **Cloudflare D1** (SQLite) — raw SQL only, no ORM. `db.prepare('... WHERE x = ?1').bind(val)`. Positional params `?1 ?2 ?N`. Never interpolate user input into SQL.
- **Cloudflare R2** — bucket `kotemart-jastip-images` for image uploads.
- **Tailwind 4 + DaisyUI** — but pages use custom CSS in `src/styles/global.css`, not DaisyUI classes.
- **Playwright** — single file `tests/e2e.spec.ts` for all E2E tests.
- **Deploy**: `npx wrangler deploy` → Cloudflare Pages at `jastip.dkotama.com`.

## Key source-of-truth files

| File | What it defines |
|------|-----------------|
| `db/schema.sql` | 6 tables: users, sessions, products, product_variants, orders, settings |
| `src/lib/types.ts` | TS interfaces matching schema exactly (User, Product, Order, Settings, Env) |
| `src/lib/pricing.ts` | `calcIdrEstimate()`, `generateOrderId()`, `getSettings()` — reuse, don't rewrite |
| `src/lib/session.ts` | 64-char hex token, httpOnly cookie, 24h expiry |
| `src/styles/global.css` | Design tokens (`@theme { --color-* }`), custom utility classes, animations |
| `tests/e2e.spec.ts` | 19 CUJ test suites + API tests. Match this style. |

## Conventions

- **Files**: `kebab-case.astro`, `kebab-case.ts`, `SCREAMING_SNAKE.sql`
- **TS**: `camelCase` vars, `PascalCase` types, `SCREAMING_SNAKE` consts
- **DB columns**: `snake_case`. IDs: TEXT UUIDs (products/variants) or `KTM-XXXX` (orders)
- **Soft-delete**: `is_deleted` flag on products/variants — never hard-delete
- **Test selectors**: `data-testid="kebab-case-name"` (not classes, not text)
- **Settings**: KV table, read via `getSettings(db)` — keys: `gate_status`, `jpy_to_idr_rate`, `global_fee_pct`, `telegram_link`, `product_categories`

## Pricing formula

`price_idr = ceil_to_1000(price_jpy × jpy_rate × (1 + fee_pct / 100))`

Use `calcIdrEstimate()` from `src/lib/pricing.ts`.

## Dev commands

```
npm run dev          # wrangler pages dev + astro (D1/R2 local emulation)
npm run db:reset     # db:schema + db:seed
npm test             # playwright test
npm run build        # astro build
```
