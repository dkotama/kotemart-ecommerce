# 007 — Landing Page Conventions

`src/pages/index.astro` is a **standalone page** (no `<Layout>`) — logged-in users are redirected to `/catalog` by middleware.

**Style rules for this page only:**
- Style attributes for colors matching design tokens (`#1A1D23`, `#1A8F89`, `#F9F9F7`, `#0F726E`)
- Standalone `<style>` block for marquee keyframes (not loaded from Layout)
- KM logo: gradient `#0F726E → #1A8F89`, 72px, rounded-18px
- H1 must say **"Kotemart Jastip"** (matches OAuth consent screen name)
- Marketplace marquee: 12 brands in their **actual brand colors** (not design tokens)
- Login button links to `/api/auth/login` directly, NOT `/login`
- Footer has `/privacy` and `/terms` links (Google OAuth compliance)

**Why:** Page name must match OAuth consent screen. Standalone keeps it minimal — no navbar for first-time visitors.
