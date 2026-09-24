// ─── Schema migrations (idempotent) ──────────────────────────────────────────
// Single source of truth for the SignSuiteIQ Postgres schema. Every statement
// is safe to run repeatedly: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD
// COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS. This file is invoked on
// every api-server boot AND by the standalone `pnpm db:setup` CLI, so a fresh
// database can be brought up to the current schema with one command.
//
// To add a new table or column:
//   1. Add a new entry to MIGRATIONS below (CREATE TABLE IF NOT EXISTS for new
//      tables, ALTER TABLE ADD COLUMN IF NOT EXISTS for new columns on
//      existing tables).
//   2. That's it. The change applies to every environment on next boot/setup.
//
// Order matters when there are foreign keys — keep the dependency order.

import type { Pool } from "pg";

export interface MigrationStep {
  name: string;
  sql: string;
}

export const MIGRATIONS: MigrationStep[] = [
  // ─── users ────────────────────────────────────────────────────────────────
  // Owners, admins, and end-users of all SignSuiteIQ products.
  {
    name: "create_users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id                     SERIAL PRIMARY KEY,
        username               TEXT NOT NULL UNIQUE,
        password               TEXT NOT NULL,
        name                   TEXT NOT NULL,
        email                  TEXT,
        phone                  TEXT,
        role                   TEXT NOT NULL DEFAULT 'user',
        is_master              TEXT NOT NULL DEFAULT 'false',
        temp_password          TEXT,
        job_title              TEXT,
        location               TEXT,
        created_by             INTEGER,
        face_descriptor        TEXT,
        face_photo             TEXT,
        face_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
        face_registered_at     TIMESTAMP,
        onboarding_completed   BOOLEAN NOT NULL DEFAULT FALSE,
        openai_assistant_id    TEXT,
        google_id              TEXT,
        google_email           TEXT,
        google_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
        payment_required       BOOLEAN NOT NULL DEFAULT FALSE,
        payment_completed      BOOLEAN NOT NULL DEFAULT FALSE,
        sender_first_name      TEXT,
        sender_from_email      TEXT,
        sender_reply_to        TEXT,
        sender_company_address TEXT,
        sender_city            TEXT,
        sender_country         TEXT,
        sender_nickname        TEXT,
        sender_verified        BOOLEAN NOT NULL DEFAULT FALSE,
        sendgrid_sender_id     INTEGER,
        pdf_logo_url           TEXT,
        pdf_company_name       TEXT,
        pdf_company_address    TEXT,
        pdf_company_phone      TEXT,
        pdf_company_email      TEXT,
        pdf_template_url       TEXT,
        company_id             INTEGER,
        archived_at            TIMESTAMP,
        deleted_at             TIMESTAMP,
        welcome_sent_at        TIMESTAMPTZ,
        created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  // Future users columns added below, e.g.:
  // { name: "users_add_some_new_col",
  //   sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS some_new_col TEXT` },

  // ─── users: additive backfill columns ─────────────────────────────────────
  // For environments whose `users` table predates these columns. CREATE TABLE
  // IF NOT EXISTS above is a no-op when the table already exists, so we still
  // need explicit ALTER TABLE ADD COLUMN IF NOT EXISTS for any column that
  // wasn't in the original table definition.
  {
    name: "users_add_company_id",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER`,
  },
  {
    name: "users_add_archived_at",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`,
  },
  {
    name: "users_add_welcome_sent_at",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ`,
  },
  {
    name: "users_add_deleted_at",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
  },
  // Tracks which admin (users.id) caused this user to be soft-deleted via a
  // cascade. NULL means the user was archived directly (not via cascade).
  // Plain INTEGER (no FK) so a permanent-delete of the parent admin doesn't
  // cascade-restore or break referential integrity — the orphan reference is
  // intentional and harmless; it just means "no longer auto-restorable".
  {
    name: "users_add_cascade_deleted_by",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS cascade_deleted_by INTEGER`,
  },

  // ─── business_details ─────────────────────────────────────────────────────
  // Each admin/customer "company" — owner of a subscription and a set of users.
  {
    name: "create_business_details",
    sql: `
      CREATE TABLE IF NOT EXISTS business_details (
        id              SERIAL PRIMARY KEY,
        business_name   TEXT NOT NULL DEFAULT '',
        business_email  TEXT,
        contact_number  TEXT,
        website         TEXT,
        admin_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
        active_plan_key TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  },
  // Additive backfills for legacy business_details tables.
  {
    name: "business_details_add_active_plan_key",
    sql: `ALTER TABLE business_details ADD COLUMN IF NOT EXISTS active_plan_key TEXT`,
  },
  {
    name: "business_details_add_admin_id",
    sql: `ALTER TABLE business_details ADD COLUMN IF NOT EXISTS admin_id INTEGER`,
  },

  // users.company_id FK can only be added once business_details exists.
  {
    name: "users_add_company_fk",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'users' AND constraint_name = 'users_company_id_fkey'
        ) THEN
          ALTER TABLE users
            ADD CONSTRAINT users_company_id_fkey
            FOREIGN KEY (company_id) REFERENCES business_details(id) ON DELETE SET NULL;
        END IF;
      END$$;
    `,
  },

  // ─── products_config ──────────────────────────────────────────────────────
  // The product tiles shown on the SignSuiteIQ dashboard.
  {
    name: "create_products_config",
    sql: `
      CREATE TABLE IF NOT EXISTS products_config (
        id              SERIAL PRIMARY KEY,
        product_key     TEXT UNIQUE NOT NULL,
        display_name    TEXT NOT NULL DEFAULT '',
        category        TEXT NOT NULL DEFAULT '',
        description     TEXT NOT NULL DEFAULT '',
        logo_url        TEXT NOT NULL DEFAULT '',
        redirect_url    TEXT NOT NULL DEFAULT '',
        monthly_price   INTEGER NOT NULL DEFAULT 14900,
        discount_price  INTEGER NOT NULL DEFAULT 12900,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        updated_at      TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  // Additive backfills for legacy products_config tables.
  {
    name: "products_config_add_monthly_price",
    sql: `ALTER TABLE products_config ADD COLUMN IF NOT EXISTS monthly_price INTEGER NOT NULL DEFAULT 14900`,
  },
  {
    name: "products_config_add_discount_price",
    sql: `ALTER TABLE products_config ADD COLUMN IF NOT EXISTS discount_price INTEGER NOT NULL DEFAULT 12900`,
  },
  // "Coming Soon" — when true, public site renders the product card without a
  // price and shows a "Coming Soon" CTA instead of a Buy button.
  {
    name: "products_config_add_coming_soon",
    sql: `ALTER TABLE products_config ADD COLUMN IF NOT EXISTS coming_soon BOOLEAN NOT NULL DEFAULT FALSE`,
  },
  // "Under Maintenance" — when true, the product is temporarily not launchable;
  // users see a maintenance notice instead of being able to open it.
  {
    name: "products_config_add_under_maintenance",
    sql: `ALTER TABLE products_config ADD COLUMN IF NOT EXISTS under_maintenance BOOLEAN NOT NULL DEFAULT FALSE`,
  },

  // ─── plans_config ─────────────────────────────────────────────────────────
  // The subscription plans shown on the pricing page.
  {
    name: "create_plans_config",
    sql: `
      CREATE TABLE IF NOT EXISTS plans_config (
        id            SERIAL PRIMARY KEY,
        plan_key      TEXT UNIQUE NOT NULL,
        display_name  TEXT NOT NULL DEFAULT '',
        category      TEXT NOT NULL DEFAULT '',
        monthly_price INTEGER NOT NULL DEFAULT 0,
        annual_price  INTEGER NOT NULL DEFAULT 0,
        description   TEXT NOT NULL DEFAULT '',
        features      JSONB NOT NULL DEFAULT '[]',
        products      JSONB NOT NULL DEFAULT '[]',
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        updated_at    TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  // Additive backfill: `products` was added to plans_config after initial release.
  {
    name: "plans_config_add_products",
    sql: `ALTER TABLE plans_config ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'`,
  },
  // "Coming Soon" — when true, public Pricing page renders the plan card
  // without a price and shows a "Coming Soon" CTA instead of a Buy button.
  {
    name: "plans_config_add_coming_soon",
    sql: `ALTER TABLE plans_config ADD COLUMN IF NOT EXISTS coming_soon BOOLEAN NOT NULL DEFAULT FALSE`,
  },

  // ─── site_content ─────────────────────────────────────────────────────────
  // Editable copy for the marketing site (key/value).
  {
    name: "create_site_content",
    sql: `
      CREATE TABLE IF NOT EXISTS site_content (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `,
  },

  // ─── user_app_access ──────────────────────────────────────────────────────
  // Per-user grants for individual products (alternative to plan-based access).
  {
    name: "create_user_app_access",
    sql: `
      CREATE TABLE IF NOT EXISTS user_app_access (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_key    TEXT NOT NULL,
        granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMP,
        is_active  BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (user_id, app_key)
      )
    `,
  },

  // ─── admin_app_grants ─────────────────────────────────────────────────────
  // Super-admin "free" app grants to an admin: access to a product that is NOT
  // backed by a paid subscription. These are unioned into the admin's (and
  // their company's) allowed apps, so the admin can use the app and grant it to
  // their users without purchasing a plan. Revoking flips is_active to false.
  {
    name: "create_admin_app_grants",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_app_grants (
        id            SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_key       TEXT NOT NULL,
        granted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        granted_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        revoked_at    TIMESTAMP,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (admin_user_id, app_key)
      )
    `,
  },
  {
    name: "idx_admin_app_grants_admin",
    sql: `CREATE INDEX IF NOT EXISTS idx_admin_app_grants_admin ON admin_app_grants(admin_user_id)`,
  },

  // ─── user_subscriptions ───────────────────────────────────────────────────
  // Stripe subscription records, one row per checkout session.
  {
    name: "create_user_subscriptions",
    sql: `
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id                     SERIAL PRIMARY KEY,
        user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_customer_id     TEXT,
        stripe_subscription_id TEXT,
        stripe_session_id      TEXT,
        plan_key               TEXT,
        price_id               TEXT,
        product_id             TEXT,
        status                 TEXT NOT NULL DEFAULT 'pending',
        billing_period         TEXT,
        amount_cents           INTEGER,
        currency               TEXT DEFAULT 'usd',
        current_period_start   TIMESTAMP,
        current_period_end     TIMESTAMP,
        cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
        cancelled_at           TIMESTAMP,
        created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "idx_user_subscriptions_user",
    sql: `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id)`,
  },
  {
    name: "idx_user_subscriptions_customer",
    sql: `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_customer ON user_subscriptions(stripe_customer_id)`,
  },
  // Payment-method snapshot stored at confirm-checkout time so the Super Admin
  // transactions page can show "Visa •••• 4242" without a per-row Stripe call.
  {
    name: "user_subscriptions_add_payment_method_brand",
    sql: `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS payment_method_brand TEXT`,
  },
  {
    name: "user_subscriptions_add_payment_method_last4",
    sql: `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT`,
  },
  {
    name: "user_subscriptions_add_receipt_url",
    sql: `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS receipt_url TEXT`,
  },
  {
    name: "idx_user_subscriptions_created_at",
    sql: `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_created_at ON user_subscriptions(created_at DESC)`,
  },
  // Soft-delete (archive) for transactions on the Super Admin Payments tab.
  // Active rows have archived_at IS NULL; archived rows have a timestamp.
  // Permanent delete on the Archive view does a hard DELETE.
  {
    name: "user_subscriptions_add_archived_at",
    sql: `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL`,
  },
  {
    name: "idx_user_subscriptions_archived_at",
    sql: `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_archived_at ON user_subscriptions(archived_at)`,
  },

  // ─── sso_codes ────────────────────────────────────────────────────────────
  // Single-use, short-lived codes minted when a user clicks a product tile.
  {
    name: "create_sso_codes",
    sql: `
      CREATE TABLE IF NOT EXISTS sso_codes (
        code          TEXT PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_key       TEXT NOT NULL,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at    TIMESTAMP NOT NULL,
        used_at       TIMESTAMP,
        issued_ip     TEXT,
        exchanged_ip  TEXT
      )
    `,
  },
  {
    name: "idx_sso_codes_user",
    sql: `CREATE INDEX IF NOT EXISTS idx_sso_codes_user ON sso_codes(user_id)`,
  },
  {
    name: "idx_sso_codes_expires",
    sql: `CREATE INDEX IF NOT EXISTS idx_sso_codes_expires ON sso_codes(expires_at)`,
  },
  // ─── products_config: page builder content ────────────────────────────────
  {
    name: "products_config_page_content",
    sql: `ALTER TABLE products_config ADD COLUMN IF NOT EXISTS page_content JSONB DEFAULT '{}'::jsonb`,
  },

  // ─── provision_jobs ───────────────────────────────────────────────────────
  // Outbound user-provisioning queue. Whenever a user is created, has their
  // password reset, or is archived in SignSuiteIQ, we enqueue one job per
  // child app (installiq, signsalesiq, signtakeoffiq) to POST that change to
  // the child app's /api/internal/provision-user endpoint. Failed calls are
  // retried with exponential backoff so a child app being briefly down does
  // not lose the change.
  {
    name: "create_provision_jobs",
    sql: `
      CREATE TABLE IF NOT EXISTS provision_jobs (
        id              BIGSERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_key         TEXT NOT NULL,
        action          TEXT NOT NULL,
        payload         JSONB NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        last_attempt_at TIMESTAMP,
        succeeded_at    TIMESTAMP,
        next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "idx_provision_jobs_pending",
    sql: `CREATE INDEX IF NOT EXISTS idx_provision_jobs_pending
            ON provision_jobs(next_attempt_at)
            WHERE succeeded_at IS NULL`,
  },
  {
    name: "idx_provision_jobs_user",
    sql: `CREATE INDEX IF NOT EXISTS idx_provision_jobs_user ON provision_jobs(user_id)`,
  },

  // Password reset tokens. We store only the SHA-256 hash of the token; the
  // raw token only ever appears in the email link. Tokens are single-use
  // (used_at IS NULL) and expire after one hour.
  {
    name: "create_password_reset_tokens",
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          BIGSERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL UNIQUE,
        expires_at  TIMESTAMP NOT NULL,
        used_at     TIMESTAMP,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "idx_password_reset_tokens_user",
    sql: `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
            ON password_reset_tokens(user_id)
            WHERE used_at IS NULL`,
  },

  // Per-user widget-token version. Bumped to instantly revoke every
  // outstanding app-switcher widget token for a user (signed payloads
  // include `tv` and are rejected when the value no longer matches).
  {
    name: "users_add_widget_token_version",
    sql: `ALTER TABLE users
            ADD COLUMN IF NOT EXISTS widget_token_version INTEGER NOT NULL DEFAULT 1`,
  },
];

export type LogFn = (msg: string) => void;

export async function runMigrations(
  pool: Pool,
  log: LogFn = () => {},
): Promise<void> {
  log(`Running ${MIGRATIONS.length} migrations…`);
  for (const step of MIGRATIONS) {
    try {
      await pool.query(step.sql);
      log(`  ✓ ${step.name}`);
    } catch (err) {
      log(`  ✗ ${step.name} — ${(err as Error).message}`);
      throw err;
    }
  }
  log(`✓ All migrations applied`);
}
