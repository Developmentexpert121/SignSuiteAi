---
name: Product/plan logo rendering
description: How product logos render on the dynamic product page hero and the constraints when replacing them.
---

# Product logo rendering (product page hero)

The dynamic product page hero (`ProductPage.tsx` `RenderHero`) renders the logo from the DATABASE column `products_config.logo_url`, NOT from any frontend `@assets` import. Changing a frontend logo import does NOT affect this hero.

The hero `<img>` applies `brightness-0 invert` to normalize every product logo to a uniform white silhouette on the dark hero.

**Rule:** logos used as `logo_url` MUST be transparent-background PNGs. A solid-background image under `brightness-0 invert` renders as a solid white BOX (the whole rectangle turns white). The existing transparent logos follow a naming convention like `*_nobg.png` / `*_logo_transparent_*.png`.

**Why:** `brightness-0` forces all opaque pixels to black, then `invert` makes them white; transparent regions stay transparent, so only a transparent PNG yields a readable silhouette.

**Critical: use DARK-text transparent logos, not white-text.** The same logo (DB `logo_url` AND the bundled `@assets` imports in Home/Dashboard/Login/AdminPanel) is reused across MANY surfaces. Only the dynamic product hero (`ProductPage.tsx`) uses `brightness-0 invert`; every other surface (Home product cards, Dashboard cards, Login carousel, AdminPanel) renders the logo as-is on a LIGHT/white background with NO invert. So a logo must have dark/colored elements: dark text reads on the light cards, and the hero's invert flips it to white. A white-text-on-dark logo looks fine on the hero but is invisible (or a dark box) on the light cards. The built-in InstalliQ/SignSalesIQ logos follow this (dark/colored on transparent).

When given a white-text-on-dark brand logo, derive a light-mode version: remove the background, then recolor the white fill to dark (e.g. imagemagick `-fuzz 22% -fill "#0f172a" -opaque white`) while leaving the colored accent (blue) intact. Use that one asset everywhere.

**How to apply when replacing a product logo:**
- Make the new logo transparent (remove background) before using it as `logo_url`.
- Uploaded logos are served by api-server from `artifacts/api-server/public/uploads/` at `/api/uploads/<file>` with `maxAge: "30d"`. This dir is git-tracked.
- Because of the 30-day cache, replace with a NEW filename and update `products_config.logo_url` — overwriting the same filename leaves returning visitors with the stale cached image.
- The app DB is DigitalOcean Postgres via `DO_DATABASE_URL` (self-signed cert → `ssl.rejectUnauthorized:false`). The default Replit `executeSql` hits a DIFFERENT DB where `products_config` does not exist; connect with `pg` using `DO_DATABASE_URL` (pg lives in the pnpm store, not at repo root).
