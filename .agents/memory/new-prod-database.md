---
name: new-prod database separation & company_id loss
description: New production runs a SEPARATE DB from the workspace; a migration into it blanked users.company_id and broke owner-grouping.
---

# New production is a separate database

- The live new-production deployment connects to a **different** DigitalOcean Postgres than the workspace `DO_DATABASE_URL`. When debugging "prod looks wrong but workspace looks fine," suspect a different DB before suspecting code.
- The workspace cannot read the deployment's secrets; to inspect live prod, request its URL as a secret (e.g. `NEW_PROD_DATABASE_URL`) via the environment-secrets skill — never have the user paste a connection string into chat.
- The Replit database skill's production mode only covers Replit-managed Postgres, NOT this app's external DigitalOcean DB.

## Source of truth for "previous production"
- `lib/db/src/snapshot-data.ts` holds the authoritative previous-prod user/role/company mapping and is the reference when prod data looks corrupted.
- Snapshot company ids 1–10 align 1:1 by id and name with new-prod companies, so a snapshot `company_id` can be restored directly for those; one snapshot company beyond that range has no new-prod counterpart.

## The defect that broke the Users view
- A migration into new prod **blanked `users.company_id` to NULL** for a batch of users, INCLUDING the company owners (admins). With owners having no company, the dashboard's owner-grouping can't place anyone → users look "missing / not shown by role."
- Fix pattern: match snapshot↔prod users by `lower(trim(email))`, and for active users with `company_id IS NULL`, restore the snapshot's `company_id` (only fill blanks; idempotent; do in a transaction).

**Why:** verified zero role/company *drift* for users present in both — the only corruption was lost company links, not wrong roles.
**How to apply:** if users vanish from owner groups after a prod migration, first check how many active non-super users have NULL `company_id`; restore from the snapshot rather than guessing.

## Multiple admins per company
- A company can legitimately have more than one admin-role user (a canonical owner + co-admins). The owner-grouped Users view shows only ONE admin per company as the group header (the one matching `business_details.admin_id`/`admin_email`); co-admins must still appear as member rows or they vanish entirely. Do not exclude all admins from a company's member rows — exclude only the header admin by id.

## Admin Users view: who is the owner header
- The owner-group headers come from the `admins` list, which is fetched ONLY for super_admins. A regular (non-super) admin therefore has no header and ALL their users fall into the "Unassigned Users" orphan bucket unless the logged-in admin is synthesized as their own owner header from the auth user (they own their company). The backend `/admin/users` for a non-super admin returns every user with `company_id = their company` (includes themselves AND co-admins, no role exclusion), so the frontend grouping — not the data — is what made users look mis-grouped.
**Why:** two distinct "missing/mis-shown users" reports traced to frontend grouping, not data: (1) co-admins dropped from member rows; (2) regular admins getting an empty owner list.

## Admin Users view: search hides team members
- The owner-grouped Users view is built from whatever `/admin/users` returns. The search box filters on the BACKEND. The original search predicate only matched a user's OWN `name/email/phone`, so searching an admin's email returned just the admin row(s) → the owner card showed "1 user" and the team looked missing. It was NOT a data problem (team had correct `company_id`).
**Why:** a "users not showing under the admin panel" report was purely the active search term filtering out child rows.
**How to apply:** the search WHERE clause must ALSO include users whose `company_id` belongs to a company whose owner (`business_details.admin_id`) matches the search term, so searching an owner's identity expands to their whole team. Keep it parameterized; it stays AND-scoped to a non-super admin's own company.

## Do NOT auto-assign these
- Several post-snapshot records are duplicates/junk with no authoritative source. Leave them unassigned for manual review/archive rather than guessing a company.

## Syncing users between DO (Replit/dev) and NEW_PROD
- The two DBs are NOT a simple "dev is missing prod data" relationship: DO has carried EXTRA rows (duplicate *active* rows for the same email — a short-username variant plus a full-email-as-username variant) that prod does not, and prod has carried test-only companies/admins not in DO. Compare both directions before assuming a sync direction.
- When copying users across the two DBs: match existing-vs-new by normalized email OR username (a person can key on either). Raw `id`s and `company_id`s do NOT line up across DBs — remap company by `business_name` (companies 1–11 happen to align 1:1, higher ids do not). Self-owned admin companies have a circular FK (`users.company_id` ↔ `business_details.admin_id`), so insert order must be: insert user (company_id NULL) → insert business_details with admin_id=newUserId → UPDATE user.company_id. Copy the password hash so logins keep working.
**Why:** a requested "copy missing users to the Replit DB" turned out to be ~4 test accounts; the real risk was creating duplicates and breaking hierarchy, not missing customer data.
