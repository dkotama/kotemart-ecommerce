# 009 — Mock Login Guard & Disabled Account Page

**Mock login** guarded at two layers:
1. API: returns 403 if `APP_BASE_URL` doesn't contain `localhost`/`127.0.0.1`
2. UI: buttons wrapped in `{import.meta.env.DEV && (...)}` (Astro compile-time)

**Disabled accounts** redirect to `/disabled` (standalone Astro page) instead of raw JSON. Callback handler does `c.redirect('/disabled', 302)` when `is_active !== 1`.

**Why:** Mock login buttons must never render in production. Disabled users should see a friendly page, not a JSON error.
