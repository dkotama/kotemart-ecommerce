# 001 — Single Catch-All API Router

All API routes live in ONE file: `src/pages/api/[...path].ts` (Hono, ~1054 lines).

**Why:** Astro + Cloudflare's adapter discourages file-based API routes. A single Hono router avoids cold-start overhead from many files and keeps all endpoints visible in one place.

**Rule:** Add new endpoints here, not as separate files under `src/pages/api/`.
