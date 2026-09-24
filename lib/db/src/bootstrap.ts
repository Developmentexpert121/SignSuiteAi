// ─── Database bootstrap (migrations + seeds) ─────────────────────────────────
// One-call helper that brings any Postgres database to the current SignSuiteIQ
// schema and seeds the bootstrap data. Used in two places:
//
//   - On every api-server boot (so every environment self-heals on startup).
//   - From the standalone CLI (`pnpm db:setup`) when spinning up a brand-new
//     server, where the operator can pass SEED_SUPER_ADMIN_EMAIL/PASSWORD
//     to mint the first admin in one shot.

import type { Pool } from "pg";
import { runMigrations, type LogFn } from "./migrations";
import { runSeeds, type SeedOptions } from "./seeds";

export type { SeedOptions, SuperAdminSeed } from "./seeds";
export type { MigrationStep, LogFn } from "./migrations";
export { MIGRATIONS, runMigrations } from "./migrations";
export { runSeeds } from "./seeds";

export async function bootstrapDatabase(
  pool: Pool,
  opts: SeedOptions = {},
  log: LogFn = () => {},
): Promise<void> {
  log("─── SignSuiteIQ database bootstrap ───");
  await runMigrations(pool, log);
  await runSeeds(pool, opts, log);
  log("─── bootstrap complete ───");
}
