---
name: InstallIQ production database
description: The InstallIQ prod DB as a cross-product data source — connectivity, schema relationship to SignSuiteIQ, and how to copy users into the Replit/DO DB.
---

# InstallIQ production database (cross-product source)

## What it is
- `INSTALLIQ_PROD_DATABASE_URL` is a SEPARATE product's live DB (InstallIQ), not another copy of SignSuiteIQ. Same DigitalOcean account as `DO_DATABASE_URL` and `NEW_PROD_DATABASE_URL` (all managed Postgres on port 25060).

## Connectivity gotcha
- DigitalOcean managed DBs enforce a **Trusted Sources** allowlist. The InstallIQ cluster did NOT include the Replit egress IP, so every connect hung to a 30s timeout (looked like SSL/auth, was actually firewall). The other two clusters were already allowlisted. Fix = user adds Replit's outbound IP (or replicates the other clusters' trusted-source entry) on the InstallIQ cluster.
**Why:** wasted a cycle trying SSL variants; a clean 30s timeout on one DB while sibling DBs connect instantly ⇒ suspect trusted-sources/firewall, not credentials.

## Schema relationship
- InstallIQ `users` is ~identical to SignSuiteIQ/DO `users` (same product family) PLUS an InstallIQ-only `signsuiteiq_user_id` link column. DO has a few extra columns (archived_at, welcome_sent_at, cascade_deleted_by, widget_token_version) that all have defaults.
- Roles use the same vocabulary: super_admin / admin / user, with a separate `is_master` text flag ('true' on root super_admins).

## Copying users INTO DO (the "copy missing users, no other changes" task)
- Determine missing by normalized email OR username (a user can key on either; many InstallIQ users overlap SignSuiteIQ).
- Insert users ONLY — do not create companies or touch other tables when the instruction says "no other changes". Source missing users had company_id NULL anyway.
- Copy the intersection of columns (exclude `id` serial and InstallIQ-only `signsuiteiq_user_id`). Copy the password hash. Preserve `role`.
- Remap `created_by`: source value is an InstallIQ user id; translate to the DO user id by matching the creator's email, else NULL (raw ids do not align across DBs).
- Wrap in one transaction with an in-tx existence re-check to guarantee no duplicates.

## CRITICAL: reporting hierarchy is modeled differently in InstallIQ vs SignSuiteIQ
- In InstallIQ, a user's "which admin am I under" is carried by `created_by` (the admin who created them); their `company_id` can be NULL. In SignSuiteIQ/DO the admin grouping is by `company_id` → `business_details.admin_id`. So copying InstallIQ users with `created_by` alone is NOT enough — they land with `company_id` NULL and show as unassigned/orphaned in the admin panel.
- To preserve "user reports under admin X": after import, set each user's `company_id` to the DO company that X OWNS (`business_details.admin_id = X's DO id`). Find X by email. The admins owning those companies already existed in DO, so this was a plain `company_id` UPDATE — no company creation, no duplicates.
**Why:** user flagged "these users were under an admin in InstallIQ"; the first import preserved created_by but not the company link, so the hierarchy was invisible in the SignSuiteIQ UI.
- Pitfall: DO has duplicate admin rows for the same email (one row keyed on a short username, another on the full email-as-username), with different ids. A company may be owned by one id while a created_by remap resolves to the other. Check company ownership by EMAIL across ALL of that admin's rows, not a single id, or you'll falsely conclude "admin owns no company."
