# 006 — Cloudflare Workers Deploy Workflow

**One wrangler config:** `wrangler.jsonc` (Workers format). `wrangler.json` was stale and was deleted — don't recreate it.

**Route injection required every deploy.** The Astro adapter generates `dist/server/wrangler.json` but does NOT forward `routes`. The custom domain must be injected post-build (route pattern comes from `wrangler.jsonc`):

```
npm run build && node -e 'd=require("./dist/server/wrangler.json");d.routes=[{pattern:"YOUR_DOMAIN",custom_domain:true}];require("fs").writeFileSync("./dist/server/wrangler.json",JSON.stringify(d,null,2))' && wrangler deploy
```

**Secrets** set via `wrangler secret put <NAME>` (not in `vars`). `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are secrets. If a name conflicts with a `vars` key, deploy the config first to unbind, then set the secret.

**Auth:** `CLOUDFLARE_API_TOKEN` set in `.env` (copy `.env.sample`). `source .env` before wrangler commands.

**Why:** Astro adapter ignores `routes`. Secrets + vars can't share binding names on CF. Token lacks account-listing permission so `account_id` is explicit in `wrangler.jsonc`.
