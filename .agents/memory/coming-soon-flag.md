---
name: coming_soon product/plan flag
description: How "Coming Soon" is modeled and which surfaces enforce it across SignSuiteIQ
---

# `coming_soon` flag

A product/plan is marked "Coming Soon" via the `coming_soon` boolean column on
`products_config` (product) and `plans_config` (plan) in the live DB. Both must
be set for a fully coming-soon product (plan gates pricing display; product gates
launch/catalog display).

**Who owns it:** the admin UI + DB own this flag. `lib/db/src/seeds.ts`
intentionally does NOT manage `coming_soon`.

**Why it matters:** a fresh reseed resets `coming_soon` back to `false` for every
product/plan. After any reseed of the live DB you must re-apply coming-soon flags
manually (e.g. `UPDATE products_config SET coming_soon=true WHERE product_key=...`).

**Surfaces that must stay consistent** when toggling coming-soon — the flag both
*displays* a Coming Soon badge and *blocks launch/purchase*:
- Display: Pricing, Home product grid, Navbar Products dropdown, Dashboard
  "Other Products" group (all read the flag live from the API).
- Launch/purchase enforcement: `/api/sso/issue` denies minting an SSO code for a
  coming-soon product (super_admin may still launch for testing);
  `/api/sso/me/apps` returns coming-soon products in `locked` with a `comingSoon`
  flag and no `upgradeUrl`; the embedded app-switcher widget renders those as a
  non-clickable "Coming Soon" tile.

**How to apply:** when adding/removing a coming-soon product, update the DB flag(s)
AND verify every surface above still reflects it — display alone is not enough,
the launch/purchase paths gate on it too.
