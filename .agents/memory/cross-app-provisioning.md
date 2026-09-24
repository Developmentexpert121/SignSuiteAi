---
name: Cross-app user provisioning
description: How/why SignSuiteIQ syncs users into child apps (InstallIQ/SignSalesIQ) and the admin-grouping decision.
---

Cross-app user sync is HTTP-based and queue-backed, NOT direct cross-DB writes:
SignSuiteIQ enqueues a row per child app into `provision_jobs`; a worker POSTs the
payload (signed with `X-App-Secret: SSO_SECRET_<APP>`) to each child app's
`POST /api/internal/provision-user`. The child app owns its own DB write. This
keeps products loosely coupled and is the intended architecture — prefer fixing/
extending it over writing into another product's live DB.

**Decision — group synced users under the COMPANY OWNER, not the literal creator.**
The payload carries an `admin` block resolved from `business_details.admin_id`
(the account owner) → users row, sent as `{external_id,email,username,name}`.
Child apps match that admin by **email** (ids never align across databases) and set
the new user's local `created_by` to the matched admin.
**Why:** child apps (esp. InstallIQ) group users under an admin via `created_by`.
A super-admin can create a user for another admin's company, so the literal
creator is the wrong anchor; the company owner is correct. In the normal
`POST /admin/users` flow `created_by` == `business_details.admin_id` anyway.
**How to apply:** any change to who a user "belongs to" must keep email as the
cross-DB join key; if email drift becomes a problem, have child apps also store a
SignSuiteIQ admin id and fall back to it.

**Known external blockers (not SignSuiteIQ code):** child apps must (1) expose
`/api/internal/provision-user`, (2) validate the SAME shared secret we send
(an InstallIQ `401 invalid app secret` means the secrets differ), and (3) consume
the `admin` block. Without all three, jobs sit pending/exhausted in `provision_jobs`.

**Dev vs prod (do NOT chase this 401):** SignSuiteIQ PRODUCTION runs on
DigitalOcean, where `SSO_SECRET_INSTALLIQ` is set to match InstallIQ — that is the
worker that really delivers. The Replit DEV env intentionally holds a
non-matching `SSO_SECRET_INSTALLIQ`, so any dev-side probe to installiq.ai returns
`401 invalid app secret` BY DESIGN. Don't request/rotate the Replit secret over a
dev 401. Also: code changes here are not live until deployed to the DO production
where the worker actually runs — verify the payload locally (simulate it), test
end-to-end only in production.

**A 401 in PROD's queue IS real (distinct from the dev-by-design 401):** monitor
the live queue by reading `provision_jobs` in `NEW_PROD_DATABASE_URL` (request it
as a secret). If installiq jobs that previously succeeded start returning
`HTTP 401 invalid app secret` right after the CHILD app is redeployed, the child's
expected secret changed/rotated — SignSuiteIQ-prod's `SSO_SECRET_INSTALLIQ` no
longer matches what InstallIQ-prod checks. Fix is env-only (align the two values in
the DigitalOcean dashboards), NOT code. To confirm the new admin-linking code is
actually live, read the newest installiq job's `payload` in NEW_PROD and check it
contains the `admin` block — a populated `admin` block proves the deploy landed
even while the secret 401 blocks delivery.

**Granting/revoking access on an EXISTING user must mirror per-app:** the create
flow provisions to ALL child apps, but the access endpoint
(`PATCH /api/admin/users/:id/apps`, used by both the inline app toggle and the
"Manage Product Access → Save access" modal) historically wrote ONLY
`user_app_access` in SignSuiteIQ — it never called child apps, so toggling InstallIQ
access on an existing user did NOT create/link them there. Fix: grant → enqueue a
single-app `upsert`, revoke → single-app `delete`, scoped to just that app (NOT the
all-apps `enqueueProvisionForUser`). Receivers are app-local (`/api/internal/
provision-user`), so `delete` per app means soft-remove from that one app only.
No plaintext password is sent on a later grant (we never store it), so the child
app keeps any credentials the user already set.
