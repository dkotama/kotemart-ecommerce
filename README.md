# Kotemart Jastip

Personal shopper (jastip) platform — browse a product catalog, place orders, track status. Built entirely via agentic development (Claude Code + SapiBot): specs → implementation plans → TDD → deploy.

## Agentic Development

This entire codebase was produced through iterative AI agent collaboration, not manual authoring. Every commit is agent-authored (SapiBot). The workflow:

1. **Spec documents** — feature specs written as design docs committed to the repo
2. **Implementation plans** — agent generates step-by-step plans from specs
3. **TDD** — failing E2E test written first, then implementation to make it pass
4. **Self-review** — agent reviews its own diffs for bugs, simplicity, duplication
5. **Deploy** — agent deploys to Cloudflare Pages via Wrangler

75 commits, 30 E2E test suites, 0 manual lines of code.

## Features

- **Google OAuth gate** — only admin-approved users can access the app
- **Product catalog** — category filters, tag dropdowns, full-text search, multi-image variants with image swapping
- **Custom orders** — buyers submit unsourced items with reference URLs
- **Order lifecycle** — Draft → Pending → Bought, with DP/payment tracking, cancellation reasons, WhatsApp numbers
- **Admin panel** — product/variant CRUD, tag management, order processing, profit dashboard
- **Master data** — product notes, note templates, tags, categories managed in admin
- **API tokens** — bearer token auth for AI assistants to drive admin endpoints
- **Mobile-first** — responsive grid, bottom sheet confirm dialog, custom CSS design system
- **Footer & legal** — Telegram link, privacy policy, terms of service

## Tech Stack

**Astro 6** (SSR, `output: 'server'`) — renders pages on Cloudflare Workers. Every page server-rendered, no static generation.

**Hono** — lightweight ultrafast web framework for the edge. All API routes live in a single catch-all file (`src/pages/api/[...path].ts`) rather than scattered across files. Hono is ~14KB, handles routing, middleware, and validation via `zValidator`. Chosen over Astro API routes for its speed, built-in Cloudflare Workers bindings, and RPC-style typed endpoints.

**Cloudflare D1** (SQLite at the edge) — transactional, zero-latency reads from Workers. Raw SQL with positional params (`?1, ?2`), no ORM. Schema is 7 tables. Migration files in `db/`.

**Tailwind 4 + DaisyUI** — utility-first CSS with a custom design system. Pages use project-specific classes from `src/styles/global.css` (design tokens, component classes), not DaisyUI component classes. DaisyUI is present for utilities only.

**Google OAuth** — OpenID Connect via `accounts.google.com`. Session stored in httpOnly `SameSite=Lax` cookie, 24-hour expiry. Only admin-approved users (`is_active=1`) can access the app.

**Playwright** — 30 E2E test suites in a single file. Every feature has Critical User Journey coverage. Mock login bypasses real OAuth in tests.

## $0 Hosting on Cloudflare

The entire app runs within Cloudflare's free tier:

| Resource | Free tier limit | This app's usage |
|----------|---------|-----|
| Pages Functions | 100K req/day | Well under |
| D1 | 5GB storage, 5M reads/day | KBs of SQLite |
| R2 | 10GB storage | Product images only |
| Workers | 100K req/day | Not used directly |

No VPS, no database server, no object storage bill. Just `npx wrangler deploy`.

## Get Started

```bash
npm install

# Create env files from samples
cp .env.sample .env
cp .dev.vars.sample .dev.vars
cp wrangler.jsonc.sample wrangler.jsonc

# Set CLOUDFLARE_API_TOKEN in .env
# Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as Cloudflare secrets
# Update wrangler.jsonc with your account_id, database_id, bucket_name, domain

npm run db:reset   # schema + seed
npm run dev        # start dev server (D1/R2 local emulation)
```

## Environment Variables

| Variable | Where |
|----------|-------|
| `CLOUDFLARE_API_TOKEN` | `.env` |
| `GOOGLE_CLIENT_ID` | Cloudflare secret (`wrangler secret put`) |
| `GOOGLE_CLIENT_SECRET` | Cloudflare secret |
| `APP_BASE_URL` | `wrangler.jsonc` → `vars` |

## Project Structure

```
src/
├── pages/
│   ├── api/[...path].ts     # All API routes (Hono, ~1241 lines)
│   ├── index.astro          # Landing page (standalone, no layout)
│   ├── login.astro          # OAuth gate
│   ├── catalog/             # Product browsing grid
│   ├── custom-order.astro   # Unsourced item submission
│   ├── my-orders.astro      # Buyer order history
│   ├── admin/               # Settings, profit dashboard
│   ├── disabled.astro       # Deactivated account page
│   ├── privacy.astro        # Privacy policy
│   └── terms.astro          # Terms of service
├── lib/
│   ├── types.ts             # TS interfaces matching DB schema
│   ├── pricing.ts           # JPY→IDR conversion, order ID generation
│   └── session.ts           # Session cookie helpers
├── layouts/Layout.astro     # App shell (nav + footer)
├── styles/global.css        # Design tokens, utility classes
└── data/                    # Sample catalog data
db/
└── schema.sql               # Full D1 schema
tests/
└── e2e.spec.ts              # 30 Playwright CUJ suites
```

## AI Assistant Integration

Generate an API token from Admin Settings → API Token. Then use bearer auth to drive admin endpoints:

```bash
curl -s "$JASTIP_BASE_URL/api/admin/orders" \
  -H "Authorization: Bearer $JASTIP_TOKEN"
```

See `.claude/skills/jastip-admin/SKILL.md` for the full endpoint reference.

## Scripts

```bash
npm run dev        # wrangler dev + astro
npm run db:reset   # schema + seed
npm test           # playwright E2E
npm run build      # production build
```

## License

MIT
