import "dotenv/config";
import { runMigrations } from "stripe-replit-sync";
import { buildSafeConnectionString } from "@workspace/db";
import { getStripeSync } from "./stripeClient";
import app from "./app";
import { logger } from "./lib/logger";
import { initTables } from "./lib/initTables";
import { startProvisioningWorker } from "./services/provisioning";

async function initStripe() {
  const rawDatabaseUrl =
    process.env.DO_DATABASE_URL || process.env.DATABASE_URL;
  if (!rawDatabaseUrl) {
    logger.warn(
      "DO_DATABASE_URL/DATABASE_URL not set — skipping Stripe initialization",
    );
    return;
  }
  const databaseUrl = buildSafeConnectionString(rawDatabaseUrl);

  // Run stripe-replit-sync migrations to create the stripe.* schema tables.
  // Note: stripe-replit-sync uses its own internal connection; this call may
  // target Replit's managed Postgres rather than DO_DATABASE_URL — that is
  // expected and non-breaking.
  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" } as any);
    logger.info("Stripe schema ready");
  } catch (err) {
    logger.warn(
      { err },
      "Stripe schema migration skipped — continuing without stripe sync tables",
    );
  }

  // Set up the webhook and kick off the background data backfill.
  // Both are non-critical: if stripe-replit-sync cannot reach its internal
  // Postgres tables (e.g. when running against an external DO database that
  // does not have the stripe.* schema), the app still starts and all
  // non-Stripe features work normally test .
  try {
    const stripeSync = await getStripeSync();
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      await stripeSync.findOrCreateManagedWebhook(
        `https://${domain}/api/stripe/webhook`,
      );
      logger.info("Stripe webhook configured");
    }

    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: Error) => {
        if ((err.message ?? "").includes("stripe.accounts")) {
          // stripe-replit-sync's internal tables are not available in the
          // external DO database — this is expected and harmless.
          //
          logger.warn(
            "Stripe backfill skipped: stripe-replit-sync tables not present in this database (non-blocking)",
          );
        } else {
          logger.warn({ err }, "Stripe backfill error (non-blocking)");
        }
      });
  } catch (err) {
    logger.warn(
      { err },
      "Stripe webhook/sync setup skipped — server will still start",
    );
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initTables();
await initStripe();
startProvisioningWorker();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
