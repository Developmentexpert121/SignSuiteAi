---
name: under_maintenance product flag
description: How "Under Maintenance" is modeled and which surfaces enforce it across SignSuiteIQ
---

# `under_maintenance` flag

A product is marked "Under Maintenance" via the `under_maintenance` boolean column
on `products_config` in the live DB. It mirrors the `coming_soon` pattern but is an
*operational* status, not a marketing one.

**Difference vs coming_soon:** maintenance is intentionally NOT shown on marketing
pages (Home grid, Navbar dropdown, Pricing) — you don't advertise downtime. It only
appears on launcher/operational surfaces and gates launch.

**Surfaces that must stay consistent** when toggling maintenance:
- Launch enforcement: `/api/sso/issue` returns 503 for a maintenance product
  (super_admin may still launch to verify the fix).
- `/api/sso/me/apps` returns `underMaintenance` on the tile; entitled apps stay in
  `apps` (not moved to locked) but flagged.
- Dashboard launcher: entitled maintenance apps stay in "Your Products" but render
  non-clickable (disabled) with an "Under Maintenance" badge + "Temporarily unavailable".
- Embedded app-switcher widget: renders a non-clickable "Maintenance" tile
  (reuses the `.tile.soon` style alongside coming-soon).
- Admin: edit-form toggle + inline quick-toggle buttons on the product list
  ("Maintenance" / "End Maintenance"), plus a red badge.

**Admin quick toggles:** the product list cards expose inline one-click toggles for
both `coming_soon` ("Make Available" / "Coming Soon") and `under_maintenance`. They
PUT a single-field body; `/api/admin/products_config/:key` merges partial bodies
against the existing row, so single-field updates are safe.

**Migrations DO auto-run on api-server boot** via `initTables()` →
`bootstrapDatabase` → `runMigrations` (lib/db). Adding an `ADD COLUMN IF NOT EXISTS`
migration + restarting the API server applies it to the live DB automatically — no
manual psql needed. (Only the stripe-replit-sync schema is separate.)
