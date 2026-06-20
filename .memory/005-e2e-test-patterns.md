# 005 — E2E Test Patterns

Single test file: `tests/e2e.spec.ts`. All tests use Playwright.

**Selectors:** Always `data-testid="kebab-case-name"`. Never class selectors, never text selectors. Stable across UI refactors.

**Auth:** `loginAs(page, role)` helper via `/api/auth/mock-login?role=`. No real Google OAuth in tests.

**Cleanup:** Tests restore settings to original state and delete test-created rows in `afterEach`.

**Structure:** CUJ (Critical User Journey) numbered suites — `test.describe('CUJ-XX: Description')`. API tests in separate `describe` blocks using `page.request.*`.

**Run:** `npm test` or `npx playwright test`.
