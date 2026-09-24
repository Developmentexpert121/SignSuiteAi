import { bootstrapDatabase, pool, type SeedOptions } from "@workspace/db";
import { logger } from "./logger";

// ─── api-server boot hook ────────────────────────────────────────────────────
// Delegates to the single source of truth in @workspace/db. Every server boot
// runs migrations + seeds idempotently, so any environment self-heals to the
// current schema on restart. The actual table & seed definitions live in:
//
//   - lib/db/src/migrations.ts  (CREATE TABLE / ALTER TABLE)
//   - lib/db/src/seeds.ts       (INSERT ... ON CONFLICT DO NOTHING)
//
// On a fresh deploy the seeder also auto-creates a default super admin (see
// DEFAULT_SUPER_ADMIN in seeds.ts) so the app is immediately usable. Override
// per-deploy by setting SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD
// (and optionally SEED_SUPER_ADMIN_NAME / SEED_SUPER_ADMIN_USERNAME). Existing
// users are never modified — the seed skips silently when the email is taken.
export async function initTables(): Promise<void> {
  const seedOpts = buildSeedOptionsFromEnv();
  try {
    await bootstrapDatabase(pool, seedOpts, (msg) => logger.info(msg));
  } catch (err) {
    // Fail loudly: a server that boots against an incompatible schema is worse
    // than one that refuses to start. Whatever supervisor is running us
    // (DigitalOcean App Platform, dev workflow, pm2, etc.) should restart and
    // surface the failure rather than letting the API serve broken responses.
    logger.error({ err }, "initTables: bootstrap failed — refusing to start");
    throw err;
  }
}

function buildSeedOptionsFromEnv(): SeedOptions {
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
