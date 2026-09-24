// ─── pnpm db:setup CLI ───────────────────────────────────────────────────────
// Brings any Postgres database up to the current SignSuiteIQ schema and seeds
// the bootstrap data. Use this when standing up a brand-new server.
//
//   Usage:
//     pnpm db:setup                  # migrations + seeds
//     pnpm db:migrate                # migrations only
//     pnpm db:seed                   # seeds only (assumes tables exist)
//
//   Required env:
//     DO_DATABASE_URL                # Postgres connection string
//
//   Optional env (overrides the built-in default super admin):
//     SEED_SUPER_ADMIN_EMAIL         # default: developmentexpert121@gmail.com
//     SEED_SUPER_ADMIN_PASSWORD      # default: Admin@123!
//     SEED_SUPER_ADMIN_NAME          # default: "Super Admin"
//     SEED_SUPER_ADMIN_USERNAME      # default: local-part of email
//
// Note: the super admin seed is idempotent. If a user with the resolved email
// already exists, the seed leaves them completely alone — password, role, and
// every other field are preserved.

import {
  bootstrapDatabase,
  buildPoolConfig,
  runMigrations,
  runSeeds,
  type SeedOptions,
} from "@workspace/db";
import pg from "pg";
const { Pool } = pg;

function parseMode(): "all" | "migrate" | "seed" {
  const args = process.argv.slice(2);
  if (args.includes("--migrate-only")) return "migrate";
  if (args.includes("--seed-only")) return "seed";
  return "all";
}

function buildSeedOptions(): SeedOptions {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!email || !password) return {};
  return {
    superAdmin: {
      email,
      password,
      name: process.env.SEED_SUPER_ADMIN_NAME?.trim(),
      username: process.env.SEED_SUPER_ADMIN_USERNAME?.trim(),
    },
  };
}

async function main(): Promise<void> {
  const url = process.env.DO_DATABASE_URL;
  if (!url) {
    console.error("✗ DO_DATABASE_URL is not set");
    process.exit(1);
  }

  const mode = parseMode();
  const seedOpts = buildSeedOptions();
  const pool = new Pool(buildPoolConfig(url));
  const log = (msg: string) => console.log(msg);

  try {
    if (mode === "migrate") {
      await runMigrations(pool, log);
    } else if (mode === "seed") {
      await runSeeds(pool, seedOpts, log);
    } else {
      await bootstrapDatabase(pool, seedOpts, log);
    }
    console.log("\n✓ Database setup complete");
  } catch (err) {
    console.error("\n✗ Database setup failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
