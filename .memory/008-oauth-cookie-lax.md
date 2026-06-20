# 008 — OAuth Cookie: SameSite=Lax

All `setCookie()` for session cookies must use `sameSite: 'Lax'` — never `'Strict'`.

**Why:** Google OAuth redirects to `/api/auth/callback` from `accounts.google.com`. With `SameSite=Strict`, the browser drops the cookie on cross-site redirect. User appears unauthenticated, middleware sends them back to `/login`. `Lax` allows the cookie on top-level GET navigations (302 redirects) while blocking on subresource requests.
