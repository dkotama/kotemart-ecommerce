# 006 — No TypeScript in `<script define:vars>` Inline Scripts

Astro `<script define:vars={...}>` blocks render as **inline** scripts and are NOT transpiled through esbuild/TypeScript. Type annotations throw `SyntaxError: Unexpected token ':'` at runtime, halting the entire script.

**Symptom:** page renders (SSR works) but client-rendered content (e.g. catalog product grid) is empty AND nothing is clickable — because the script crashed before `render()` ran.

**Why:** Bundled `<script>` (no `define:vars`) gets full TS transpilation. Inline `define:vars` scripts get variable injection only — raw JS executes as-is.

**Rule:** In `.astro` `<script define:vars>` blocks, write plain JS. No `const x: string[]`, no `Record<string,string>`, no generics. Check the whole block before deploying.
