/**
 * One-time backfill: enqueue an "upsert" provisioning job for every active
 * user against every child app (installiq, signsalesiq, signtakeoffiq).
 *
 * Important: existing users' bcrypt password hashes cannot be replayed to
 * child apps, so this backfill enqueues *no* password. Child apps should
 * create the user with a placeholder/disabled password and require the user
 * to use "Forgot password" (or log in via SSO once) to set one.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/backfillProvisioning.ts
 *
 * Safe to re-run: jobs are simply re-queued; the worker will retry any that
 * are still pending and skip duplicates on the receiver side via email match.
 */
import { pool } from "@workspace/db";
import { enqueueProvisionForUser, runOnce } from "../services/provisioning";

async function main(): Promise<void> {
  const r = await pool.query<{ id: number; email: string | null }>(
    `SELECT id, email FROM users
      WHERE deleted_at IS NULL AND email IS NOT NULL
      ORDER BY id`,
  );
  console.log(`Backfilling ${r.rows.length} active users to all child apps…`);

  let enqueued = 0;
  for (const u of r.rows) {
    await enqueueProvisionForUser(u.id, "upsert");
    enqueued++;
    if (enqueued % 25 === 0) console.log(`  …enqueued ${enqueued}`);
  }
  console.log(`Enqueued ${enqueued * 3} jobs (3 per user). Draining now…`);

  await runOnce();
  console.log("Drain pass complete. Pending jobs will retry on the worker.");

  const summary = await pool.query<{
    app_key: string;
    succeeded: string;
    pending: string;
    failed_terminal: string;
  }>(
    `SELECT app_key,
            COUNT(*) FILTER (WHERE succeeded_at IS NOT NULL)               AS succeeded,
            COUNT(*) FILTER (WHERE succeeded_at IS NULL AND attempts < 10) AS pending,
            COUNT(*) FILTER (WHERE succeeded_at IS NULL AND attempts >= 10) AS failed_terminal
       FROM provision_jobs
      GROUP BY app_key
      ORDER BY app_key`,
  );
  console.table(summary.rows);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
