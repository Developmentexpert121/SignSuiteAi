---
name: product ↔ plan 1:1 pairing
description: SignSuiteIQ products and subscription plans are paired 1:1 on the same key; how creation keeps them in sync
---

# Product ↔ Plan pairing

In SignSuiteIQ, every purchasable product in `products_config` has a matching
subscription plan in `plans_config` keyed on the **same** key
(`plan.products = [product_key]`). A product is not purchasable until its plan
exists — Pricing and the buy/SSO flow read from `plans_config`.

**Creation is atomic:** the admin "create product" endpoint
(`POST /api/admin/products_config`) creates the product AND auto-creates its
matching plan inside a single DB transaction (BEGIN/COMMIT, ROLLBACK on error).

**Why atomic:** the endpoint guards new products with a 409 duplicate check, so a
half-created product (row exists, plan missing) could never be repaired by a
retry. The transaction guarantees the pairing or rolls both back.

**Field mapping product → plan on auto-create:**
- `display_name`, `category`, `description`, `is_active`, `coming_soon`, `sort_order` copied as-is
- product `monthly_price` → plan `monthly_price`; product `discount_price` → plan `annual_price`
- `features` starts empty `[]`; `products` = `[product_key]`
- plan insert uses `ON CONFLICT (plan_key) DO NOTHING` so a pre-existing plan of
  the same key is reused, not clobbered.

**How to apply:** if you add another way to create products (import, seed,
script), create the matching plan in the same operation, or the product is
silently unsellable. The admin can fine-tune plan pricing/features afterward in
the Plans tab.

## Full Suite bundle membership is auto-synced

The `fullsuite` plan's `products` array is the entitlement source of truth for
the bundle. It must always equal **all products where `coming_soon = false`**
(i.e. live + under-maintenance products; coming-soon ones are excluded until
they go live). This is enforced by `syncFullSuiteProducts(db)` in admin.ts, which
recomputes the array from `products_config` and is called inside the transaction
on every product create / update / delete.

**Why recompute (not incremental add/remove):** it's self-healing and drift-free
— a coming_soon toggle, a delete, or a manual DB edit all get corrected on the
next product write. Membership can never silently fall out of sync with the
catalog.

**Frontend already matches:** Pricing's "Best Value" sum filters out coming_soon
plans, so display and entitlement agree.

**How to apply:** any new product-mutation path must call
`syncFullSuiteProducts` (or accept that fullsuite will be stale until the next
product write). Note: this means existing fullsuite subscribers gain access to
new live products automatically — that is the intended behavior.
