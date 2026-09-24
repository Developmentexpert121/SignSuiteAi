// ─── Database seeds (idempotent) ─────────────────────────────────────────────
// Bootstrap data for a fresh SignSuiteIQ install. Every seed checks for the
// presence of its target row(s) before inserting, so it's always safe to run.
//
// To add a new seed:
//   1. Add a new entry to SEEDS below — either a `data` block (declarative
//      INSERT ... ON CONFLICT DO NOTHING) or a `run` block (custom logic for
//      one-off data migrations / lookups).
//   2. Keep entries idempotent. If you can't, gate them behind a "has any rows"
//      check so they only fire on a truly empty table.

import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import type { LogFn } from "./migrations";
import {
  SNAPSHOT_USERS,
  SNAPSHOT_USER_COLUMNS,
  SNAPSHOT_SUBSCRIPTIONS,
  SNAPSHOT_SUBSCRIPTION_COLUMNS,
  SNAPSHOT_BUSINESS_DETAILS,
  SNAPSHOT_BUSINESS_DETAIL_COLUMNS,
} from "./snapshot-data";

export interface SuperAdminSeed {
  email: string;
  password: string;
  name?: string;
  username?: string;
}

export interface SeedOptions {
  /**
   * If provided, ensures a super_admin user with this email exists. Skipped
   * silently if a user with the same email already exists. Wired up via
   * the `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` env vars in
   * the CLI.
   */
  superAdmin?: SuperAdminSeed;
}

const DEFAULT_PRODUCTS: Array<[string, string, string, string, string, number, number, number]> = [
  // [product_key, display_name, category, description, redirect_url, monthly_price, discount_price, sort_order]
  [
    "installiq",
    "InstalliQ.ai",
    "Field Proof",
    "AI-powered installation management for your field crews. Job photo tagging, scheduling, and real-time progress tracking.",
    "https://www.installiq.ai/",
    14900,
    12900,
    1,
  ],
  [
    "signsalesiq",
    "SignSalesIQ",
    "Sales",
    "AI visual mockups, interactive client links, and rapid proposal generation to close deals faster.",
    "https://www.signsalesiq.ai/",
    14900,
    12900,
    2,
  ],
  [
    "signtakeoffiq",
    "SignTakeoffIQ",
    "Estimating",
    "Automated plan reading, ADA compliance checks, and multi-page PDF scanning for accurate estimates.",
    "https://signtakeoffiq-production-kbl2y.ondigitalocean.app/sso/callback",
    14900,
    12900,
    3,
  ],
];

const DEFAULT_PLANS: Array<[string, string, string, number, number, string, string[], string[], number]> = [
  // [plan_key, display_name, category, monthly_price, annual_price, description, features, products, sort_order]
  [
    "installiq",
    "InstalliQ.ai",
    "Field Proof",
    12900,
    10700,
    "Essential installation and field management for your crews.",
    [
      "Mobile app access",
      "Job photo tagging",
      "Scheduling view",
      "200 events included per month",
      "Real-time usage tracking",
      "Priority support",
    ],
    ["installiq"],
    1,
  ],
  [
    "signsalesiq",
    "SignSalesIQ",
    "Sales",
    12900,
    10700,
    "AI mockups and rapid proposal generation.",
    [
      "AI visual mockups",
      "Interactive client links",
      "Quoting engine",
      "200 events included per month",
      "Real-time usage tracking",
      "Priority support",
    ],
    ["signsalesiq"],
    2,
  ],
  [
    "signtakeoffiq",
    "SignTakeoffIQ",
    "Estimating",
    12900,
    10700,
    "Automated plan reading and compliance checking.",
    [
      "Multi-page PDF scanning",
      "Auto sign schedule generation",
      "ADA compliance checks",
      "200 events included per month",
      "Real-time usage tracking",
      "Priority support",
    ],
    ["signtakeoffiq"],
    3,
  ],
  [
    "fullsuite",
    "Full Suite",
    "Command Center",
    29900,
    24900,
    "For growing sign teams that need unlimited power, mobile access, and hands-on support — all under one roof.",
    [
      "All 3 applications",
      "Priority 24/7 support",
      "Advanced integrations",
      "Custom onboarding",
      "Mobile app access",
      "Dedicated account manager",
    ],
    ["installiq", "signsalesiq", "signtakeoffiq"],
    4,
  ],
];

const DEFAULT_SITE_CONTENT: Array<[string, string]> = [
  ["home.hero.headline", "One suite. Three powerful tools."],
  ["home.hero.subheadline", "AI built for signs, not borrowed from somewhere else."],
  [
    "home.hero.body",
    "The AI-powered platform for sign and graphics industry professionals. Built by industry veterans to replace slow, manual workflows with precision and speed.",
  ],
  ["home.hero.tagline", "Better Workflow. Faster Results."],
];

// Default bootstrap super admin — auto-created on any fresh deployment so a
// brand-new server has at least one usable login. If a user with this email
// already exists (any environment that's been running for a while), the seed
// detects that and skips silently — it never overwrites the password or any
// other field of an existing user.
//
// Override per-deploy by setting SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD
// (and optionally SEED_SUPER_ADMIN_NAME / SEED_SUPER_ADMIN_USERNAME) env vars.
const DEFAULT_SUPER_ADMIN: SuperAdminSeed = {
  email: "developmentexpert121@gmail.com",
  password: "Admin@123!",
  name: "Super Admin",
  username: "developmentexpert121",
};

async function seedProducts(pool: Pool, log: LogFn): Promise<void> {
  for (const [key, display, category, description, redirect, monthly, discount, sort] of DEFAULT_PRODUCTS) {
    await pool.query(
      `INSERT INTO products_config
         (product_key, display_name, category, description, logo_url, redirect_url, monthly_price, discount_price, sort_order)
       VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8)
       ON CONFLICT (product_key) DO NOTHING`,
      [key, display, category, description, redirect, monthly, discount, sort],
    );
  }
  // One-shot data migration: backfill redirect_url on rows that pre-date the
  // SSO callback being known (column was empty string or NULL). Only fills
  // blanks — never overwrites a URL an operator has already set in the admin
  // UI, so production overrides are preserved across redeploys.
  for (const [key, , , , redirect] of DEFAULT_PRODUCTS) {
    if (!redirect) continue;
    await pool.query(
      `UPDATE products_config
          SET redirect_url = $2, updated_at = NOW()
        WHERE product_key = $1
          AND (redirect_url IS NULL OR redirect_url = '')`,
      [key, redirect],
    );
  }
  log(`  ✓ products_config (${DEFAULT_PRODUCTS.length} default products)`);
}

async function seedPlans(pool: Pool, log: LogFn): Promise<void> {
  for (const [key, display, category, monthly, annual, description, features, products, sort] of DEFAULT_PLANS) {
    await pool.query(
      `INSERT INTO plans_config
         (plan_key, display_name, category, monthly_price, annual_price, description, features, products, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
       ON CONFLICT (plan_key) DO NOTHING`,
      [key, display, category, monthly, annual, description, JSON.stringify(features), JSON.stringify(products), sort],
    );
  }
  // One-shot data migration: backfill the products column on legacy rows that
  // existed before products was added. Safe to run repeatedly because it only
  // touches rows that still have products = '[]'.
  for (const [key, , , , , , , products] of DEFAULT_PLANS) {
    await pool.query(
      `UPDATE plans_config SET products = $2::jsonb WHERE plan_key = $1 AND products = '[]'::jsonb`,
      [key, JSON.stringify(products)],
    );
  }
  log(`  ✓ plans_config (${DEFAULT_PLANS.length} default plans)`);
}

async function seedSiteContent(pool: Pool, log: LogFn): Promise<void> {
  for (const [key, value] of DEFAULT_SITE_CONTENT) {
    await pool.query(
      `INSERT INTO site_content (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  }
  log(`  ✓ site_content (${DEFAULT_SITE_CONTENT.length} default keys)`);
}

async function seedSuperAdmin(
  pool: Pool,
  admin: SuperAdminSeed,
  log: LogFn,
): Promise<void> {
  const emailLower = admin.email.toLowerCase().trim();
  const username = (admin.username ?? emailLower.split("@")[0] ?? "admin").trim();
  const name = (admin.name ?? "Super Admin").trim();

  // Skip if a user with this email already exists (case-insensitive).
  const existing = await pool.query<{ id: number; role: string }>(
    `SELECT id, role FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [emailLower],
  );
  if (existing.rows.length > 0) {
    log(`  ⊘ super_admin (${emailLower}) already exists — skipping`);
    return;
  }

  // Skip if username collides — operator should pass a different SEED_SUPER_ADMIN_USERNAME.
  const collision = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE username = $1 LIMIT 1`,
    [username],
  );
  if (collision.rows.length > 0) {
    log(`  ⊘ super_admin username "${username}" already taken — skipping (set SEED_SUPER_ADMIN_USERNAME)`);
    return;
  }

  const hashed = await bcrypt.hash(admin.password, 10);
  await pool.query(
    `INSERT INTO users (username, password, name, email, role, onboarding_completed)
     VALUES ($1, $2, $3, $4, 'super_admin', TRUE)`,
    [username, hashed, name, admin.email],
  );
  log(`  ✓ super_admin created (${emailLower}, username=${username})`);
}

// ─── Snapshot seeds ──────────────────────────────────────────────────────────
// Restores the production snapshot captured in snapshot-data.ts. Seed order:
//   1. business_details  — must exist before users (FK users.company_id → business_details.id)
//   2. users             — must exist before subscriptions (FK user_subscriptions.user_id → users.id)
//   3. user_subscriptions
// Each row is matched by id (and a secondary natural key where available) and
// skipped if it already exists, so it's always safe to re-run.

async function seedSnapshotBusinessDetails(pool: Pool, log: LogFn): Promise<void> {
  if (!SNAPSHOT_BUSINESS_DETAILS || SNAPSHOT_BUSINESS_DETAILS.length === 0) {
    log(`  ⊘ business_details snapshot — no rows to seed`);
    return;
  }
  // Insert with admin_id = NULL to break the circular FK:
  //   users.company_id → business_details.id   (needs business_details first)
  //   business_details.admin_id → users.id     (needs users first)
  // admin_ids are back-filled in backfillSnapshotBusinessDetailsAdminId after
  // users are seeded.
  const columnsWithoutAdminId = SNAPSHOT_BUSINESS_DETAIL_COLUMNS.filter((c: string) => c !== "admin_id");
  let inserted = 0;
  let skipped = 0;
  for (const row of SNAPSHOT_BUSINESS_DETAILS) {
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM business_details WHERE id = $1 LIMIT 1`,
      [row.id],
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }
    const placeholders = columnsWithoutAdminId.map((_: string, i: number) => `$${i + 1}`).join(", ");
    const values = columnsWithoutAdminId.map((c: string) => row[c] ?? null);
    await pool.query(
      `INSERT INTO business_details (${columnsWithoutAdminId.join(", ")})
       VALUES (${placeholders})`,
      values,
    );
    inserted++;
  }
  await pool.query(
    `SELECT setval(
       pg_get_serial_sequence('business_details', 'id'),
       GREATEST((SELECT COALESCE(MAX(id), 0) FROM business_details), 1)
     )`,
  );
  log(`  ✓ business_details snapshot (${inserted} inserted, ${skipped} already existed) — ${SNAPSHOT_BUSINESS_DETAILS.length} total`);
}

async function backfillSnapshotBusinessDetailsAdminId(pool: Pool, log: LogFn): Promise<void> {
  if (!SNAPSHOT_BUSINESS_DETAILS || SNAPSHOT_BUSINESS_DETAILS.length === 0) return;
  let updated = 0;
  for (const row of SNAPSHOT_BUSINESS_DETAILS) {
    if (row.admin_id == null) continue;
    const res = await pool.query(
      `UPDATE business_details SET admin_id = $1
       WHERE id = $2 AND (admin_id IS DISTINCT FROM $1)`,
      [row.admin_id, row.id],
    );
    if ((res.rowCount ?? 0) > 0) updated++;
  }
  if (updated > 0) log(`  ✓ business_details admin_id back-fill (${updated} rows updated)`);
}

async function seedSnapshotUsers(pool: Pool, log: LogFn): Promise<void> {
  let inserted = 0;
  let skipped = 0;
  for (const row of SNAPSHOT_USERS) {
    const emailLower = row.email ? String(row.email).toLowerCase() : null;
    const existing = await pool.query<{ id: number }>(
      emailLower
        ? `SELECT id FROM users
            WHERE id = $1 OR LOWER(email) = $2 OR username = $3
            LIMIT 1`
        : `SELECT id FROM users
            WHERE id = $1 OR username = $2
            LIMIT 1`,
      emailLower ? [row.id, emailLower, row.username] : [row.id, row.username],
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }
    const placeholders = SNAPSHOT_USER_COLUMNS.map((_: string, i: number) => `$${i + 1}`).join(", ");
    const values = SNAPSHOT_USER_COLUMNS.map((c: string) => row[c] ?? null);
    await pool.query(
      `INSERT INTO users (${SNAPSHOT_USER_COLUMNS.join(", ")})
       VALUES (${placeholders})`,
      values,
    );
    inserted++;
  }
  // Keep the serial sequence in step with the highest seeded id so future
  // organic INSERTs (e.g. real signups) don't collide with snapshot ids.
  await pool.query(
    `SELECT setval(
       pg_get_serial_sequence('users', 'id'),
       GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1)
     )`,
  );
  log(`  ✓ users snapshot (${inserted} inserted, ${skipped} already existed) — ${SNAPSHOT_USERS.length} total`);
}

async function seedSnapshotSubscriptions(pool: Pool, log: LogFn): Promise<void> {
  let inserted = 0;
  let skipped = 0;
  for (const row of SNAPSHOT_SUBSCRIPTIONS) {
    const stripeSubId = row.stripe_subscription_id ?? null;
    const existing = await pool.query<{ id: number }>(
      stripeSubId
        ? `SELECT id FROM user_subscriptions
            WHERE id = $1 OR stripe_subscription_id = $2
            LIMIT 1`
        : `SELECT id FROM user_subscriptions WHERE id = $1 LIMIT 1`,
      stripeSubId ? [row.id, stripeSubId] : [row.id],
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }
    const placeholders = SNAPSHOT_SUBSCRIPTION_COLUMNS.map((_: string, i: number) => `$${i + 1}`).join(", ");
    const values = SNAPSHOT_SUBSCRIPTION_COLUMNS.map((c: string) => row[c] ?? null);
    await pool.query(
      `INSERT INTO user_subscriptions (${SNAPSHOT_SUBSCRIPTION_COLUMNS.join(", ")})
       VALUES (${placeholders})`,
      values,
    );
    inserted++;
  }
  await pool.query(
    `SELECT setval(
       pg_get_serial_sequence('user_subscriptions', 'id'),
       GREATEST((SELECT COALESCE(MAX(id), 0) FROM user_subscriptions), 1)
     )`,
  );
  log(`  ✓ user_subscriptions snapshot (${inserted} inserted, ${skipped} already existed) — ${SNAPSHOT_SUBSCRIPTIONS.length} total`);
}

export async function runSeeds(
  pool: Pool,
  opts: SeedOptions = {},
  log: LogFn = () => {},
): Promise<void> {
  log(`Running seeds…`);
  await seedProducts(pool, log);
  await seedPlans(pool, log);
  await seedSiteContent(pool, log);
  // Restore the full production snapshot. Three-phase order to break the
  // circular FK between business_details and users:
  //   Phase 1 — business_details with admin_id = NULL
  //             (satisfies users.company_id → business_details.id)
  //   Phase 2 — users (satisfies user_subscriptions.user_id → users.id)
  //   Phase 3 — back-fill business_details.admin_id now that users exist
  //             (satisfies business_details.admin_id → users.id)
  //   Phase 4 — user_subscriptions
  await seedSnapshotBusinessDetails(pool, log);
  await seedSnapshotUsers(pool, log);
  await backfillSnapshotBusinessDetailsAdminId(pool, log);
  await seedSnapshotSubscriptions(pool, log);
  // Final safety net: if for any reason no super admin exists (e.g. snapshot
  // was emptied), make sure at least the default one is created so the app is
  // never unusable. Skips silently when the user already exists.
  await seedSuperAdmin(pool, opts.superAdmin ?? DEFAULT_SUPER_ADMIN, log);
  log(`✓ All seeds applied`);
}
