---
name: prod product-page content is a DATA gap, not stale code
description: Bare product pages in production come from empty products_config.page_content in the separate prod DB, not from an undeployed frontend.
---

# "UI changes aren't live in prod" is usually a DB data gap

Product marketing pages (`/products/:key`) are rendered from
`products_config.page_content` (jsonb `{sections:[...]}`) + `logo_url`. When that
content is empty/null, `ProductPage.tsx` falls back to a bare hero + "Ready to get
started?" CTA — which looks like an out-of-date deploy but is not.

**Why:** page content is built by admins through the in-app Page Builder, which
writes to whatever DB that environment points at. The Replit/dev env writes to
`DO_DATABASE_URL`; live prod is the SEPARATE `NEW_PROD_DATABASE_URL`. Content
created in dev never reaches prod, so pushing code (git→DigitalOcean) can never
make it appear. Symptom: dev shows 10-11 sections per product, prod shows 0.

**How to apply:** when a user says "prod pages don't match Replit / changes aren't
live," FIRST compare `products_config` (sections count + logo_url) across the two
DBs before suspecting the build. Fix by copying `page_content` + `logo_url`
dev→prod (additive; prod was empty; do it in a transaction; cast to the column's
type — page_content is `jsonb`). Leave prod-specific fields (prices, coming_soon,
redirect_url) untouched.

**Images are safe to copy:** page_content/logo image refs are relative
`/api/uploads/...` paths plus a couple of `/_demo.mp4` files. The upload files are
GIT-TRACKED under `artifacts/api-server/public/uploads/` (and demos under
`artifacts/signsuiteiq/public/`), so they ship to prod via the normal git deploy —
copying the DB rows will not produce broken images once the deploy has landed.
