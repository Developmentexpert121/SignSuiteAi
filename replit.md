# SignSuiteIQ.ai Platform

## Overview
SignSuiteIQ.ai is a multi-tenant Single Sign-On (SSO) platform designed to centralize identity management for InstalliQ, SignSalesIQ, and SignTakeoffIQ applications. It provides a unified authentication and authorization system, enabling businesses to manage users, app access, and subscriptions efficiently. The platform aims to streamline user experience across integrated products and offers robust administration features for super_admins and company admins.

## User Preferences
N/A

## System Architecture

**Monorepo Structure:** The project is organized as a pnpm workspace monorepo using TypeScript, facilitating shared code and streamlined development across different components.

**Technology Stack:**
- **Backend:** Node.js 24, Express 5, TypeScript 5.9.
- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, wouter for routing.
- **Database:** DigitalOcean PostgreSQL, managed via raw `pg` pool, with an auto-healing schema and seed data mechanism.
- **Authentication:** bcrypt for password validation, face-api.js for face-lock, and localStorage for session management.

**Key Artifacts:**
- `artifacts/signsuiteiq/`: React/Vite application for marketing and dashboard functionalities.
- `artifacts/api-server/`: Express 5 backend API server.
- `artifacts/mockup-sandbox/`: A server for design component previews.

**Database Schema Highlights:**
- `users`: Stores user details, roles (super_admin, admin, user), and links to companies.
- `business_details`: Contains company information and administrative links.
- `user_app_access`: Manages user entitlements to specific applications (InstalliQ, SignSalesIQ, SignTakeoffIQ).
- `user_subscriptions`: Integrates with Stripe for subscription management.
- `sso_codes`: Stores short-lived, single-use codes for SSO flow.
- `user_subscriptions` includes `archived_at` for soft-deletion and `payment_method_brand`, `payment_method_last4`, `receipt_url` for payment details.

**Role-Based Access Control:**
- `super_admin`: Full platform control, manages all companies and users.
- `admin`: Manages users and app access within their specific company.
- `user`: Accesses applications based on granted entitlements.

**API Features:**
- **Authentication:** Login (password and face-login), session management.
- **Admin Management:**
    - Retrieve platform/company statistics.
    - List and manage companies.
    - List, create, and manage user app access (grant/revoke).
    - Manage payment transactions, including search, filter, sort, and archive/restore/delete functionalities.
- **SSO Hub:** Issue single-use codes for cross-product sign-in and exchange codes for user identity.
- **Stripe Integration:** Checkout, confirm checkout, subscription management, and webhook handling. Supports dynamic price resolution using `lookup_key` for flexible plan management.

**Frontend UI/UX:**
- **Dashboard:** Role-based views (AdminPanel for super_admin/admin, AppLauncher for user).
- **Admin Panel:**
    - Sidebar navigation: Overview, Companies, Users, Payments (super_admin only).
    - **Companies Tab:** Expandable cards displaying company administrators and users, with options to manage users.
    - **Users Tab:** Searchable/filterable table with app access toggles. Active view supports archive (soft-delete); archive view supports restore and (super_admin only) permanent delete via `DELETE /api/admin/users/:id/permanent` (must be archived; super admins protected; FK on `business_details.admin_id` is nulled before delete).
    - **Cascade archive/restore:** When an admin is soft-deleted (via either the Admins tab or the Users tab), every other non-super-admin user in the same `company_id` is also soft-deleted in the same DB transaction and tagged with `users.cascade_deleted_by = adminId`. Restoring the admin (via either tab) auto-restores those tagged users (sets `deleted_at = NULL`, clears `cascade_deleted_by`). Users that were independently archived (`cascade_deleted_by IS NULL`) are NOT auto-restored — they must be restored individually. Soft-deleted users cannot log in (every login query in `routes/auth.ts` filters `deleted_at IS NULL`). Permanent-delete of an admin leaves any orphan `cascade_deleted_by` references in place (intentional — the children stay archived but can be restored individually).
    - **Payments Tab:** Displays transaction history with advanced search, filtering, and sorting. Includes stats tiles for revenue and subscription status. Provides archive, restore, and permanent delete options for transactions, with optimistic UI updates.
- **Pricing:** Dynamically displays plan card states (e.g., "covered," "current," "choose") based on user's owned subscriptions, prioritizing `fullsuite` access.
- **Live Admin → Public Wiring (Products & Plans):**
    - Public site (`Pricing.tsx`, `Home.tsx` products grid + pricing-preview, `Navbar.tsx` Products dropdown) fetches from `GET /api/public/products` and `GET /api/public/plans` — there are no hardcoded product/plan arrays anymore.
    - Super Admin Panel "Products" and "Plans" tabs (`AdminPanel.tsx`) provide full CRUD: create new rows ("+ Add Product/Plan"), edit existing rows, soft toggle Active/Inactive (server filters Inactive from public endpoints), toggle "Coming Soon" (card stays visible but price is replaced with a "Coming Soon" badge and the CTA becomes a disabled "Coming Soon" button), upload logo from disk (POST `/api/admin/upload-logo` writes to `artifacts/api-server/public/uploads/` served at `/api/uploads/<file>`) or paste a URL, and delete.
    - DB columns `products_config.coming_soon` and `plans_config.coming_soon` are added by idempotent migrations in `lib/db/src/migrations.ts`.
    - Logo upload route requires the global `express.json({ limit: "10mb" })` parser (see `app.ts`) to accept base64-encoded images.
    - Admin-added products without a hand-built page route fall back to `/pricing#plans` from the navbar (extend `PRODUCT_KEY_TO_PATH` + add a `<Route>` in `App.tsx` to give them a dedicated page).
    - Note for Stripe: newly-created plans need `seed-stripe` to run before checkout works (the checkout endpoint resolves Stripe price by `${planKey}_${billing}` lookup_key).

**Database Management:**
- Schema and seed data are maintained in `lib/db/src/` with idempotent migration and seeding scripts.
- `bootstrapDatabase` automatically applies schema changes and seeds data on server boot, ensuring environments self-heal.
- Production user and subscription data are snapshotted into `snapshot-data.ts` for consistent environment cloning, containing sensitive PII and bcrypt hashes.

**Brand Colors:**
- Primary Navy: `#1C2A3A`
- Orange accent: `#E8932C`
- Cyan brand: `#29ABE2`
- Product accents: Teal (InstalliQ), Blue (SignSalesIQ), Amber (SignTakeoffIQ).

## External Dependencies

- **DigitalOcean PostgreSQL:** Primary database service.
- **Stripe:** Payment gateway for managing subscriptions, checkouts, and webhooks.
- **face-api.js:** Library for face detection and recognition, used for face-lock authentication.
- **`pg`:** Node.js client for PostgreSQL.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Utility-first CSS framework.
- **Framer Motion:** React animation library.
- **wouter:** Small routing library for React.