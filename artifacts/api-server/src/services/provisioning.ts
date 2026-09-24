import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const APP_KEYS = ["installiq", "signsalesiq", "signtakeoffiq"] as const;
type AppKey = (typeof APP_KEYS)[number];

const MAX_ATTEMPTS = 10;
const REQUEST_TIMEOUT_MS = 15_000;
const WORKER_INTERVAL_MS = 60_000;
const BATCH_SIZE = 25;
const BACKOFF_SECONDS = [10, 30, 60, 300, 900, 1800, 3600, 7200, 14400, 28800];

export type ProvisionAction = "upsert" | "delete";

interface UserSnapshot {
  id: number;
  email: string | null;
  username: string;
  name: string;
  role: string;
  phone: string | null;
  job_title: string | null;
  location: string | null;
  company_id: number | null;
  created_by: number | null;
  deleted_at: Date | null;
}

interface CompanySnapshot {
  id: number;
  business_name: string;
  business_email: string | null;
  contact_number: string | null;
  website: string | null;
  admin_id: number | null;
}

interface AdminSnapshot {
  id: number;
  email: string | null;
  username: string;
  name: string;
}

interface JobRow {
  id: string;
  app_key: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const env = process.env as Record<string, string | undefined>;

function secretFor(appKey: AppKey): string | undefined {
  return env[`SSO_SECRET_${appKey.toUpperCase()}`];
}

async function urlFor(appKey: AppKey): Promise<string | undefined> {
  const override = env[`PROVISION_URL_${appKey.toUpperCase()}`];
  if (override?.trim()) return override.trim();

  const r = await pool.query<{ redirect_url: string | null }>(
    `SELECT redirect_url FROM products_config WHERE product_key = $1 LIMIT 1`,
    [appKey],
  );
  const raw = r.rows[0]?.redirect_url;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}/api/internal/provision-user`;
  } catch {
    return undefined;
  }
}

async function loadUser(userId: number): Promise<UserSnapshot | null> {
  const r = await pool.query<UserSnapshot>(
    `SELECT id, email, username, name, role, phone, job_title, location,
            company_id, created_by, deleted_at
       FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

async function loadCompany(
  companyId: number,
): Promise<CompanySnapshot | null> {
  const r = await pool.query<CompanySnapshot>(
    `SELECT id, business_name, business_email, contact_number, website, admin_id
       FROM business_details WHERE id = $1 LIMIT 1`,
    [companyId],
  );
  return r.rows[0] ?? null;
}

/**
 * Load the admin (account owner) a provisioned user should sit under in the
 * child app. Child apps match this admin by email (ids never align across
 * databases) and set the new user's `created_by` to that local admin, so the
 * user appears under the same admin in each app's User Management.
 */
async function loadAdmin(adminId: number): Promise<AdminSnapshot | null> {
  const r = await pool.query<AdminSnapshot>(
    `SELECT id, email, username, name FROM users WHERE id = $1 LIMIT 1`,
    [adminId],
  );
  return r.rows[0] ?? null;
}

/**
 * Deterministic, URL-safe slug for a company. We append the SignSuiteIQ
 * company id so collisions are impossible even if two companies share a name.
 */
function slugifyCompany(name: string, id: number): string {
  const base = (name || "company")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "company";
  return `${base}-${id}`;
}

/**
 * Enqueue an outbound provisioning job for this user against every child app.
 *
 * - `action: "upsert"` — child app should create-or-update the user by email.
 *   When `plaintextPassword` is provided (only at create / password-reset /
 *   forgot-password time), child apps should hash and store it. When omitted,
 *   child apps should keep any existing password unchanged.
 * - `action: "delete"` — child app should soft-archive the user by email.
 *
 * Best-effort: any error here is logged and swallowed so it never blocks the
 * caller's response. The retry worker will pick the job up on its next tick.
 */
// Build the full provisioning payload for a user (identity + company tenant +
// owning-admin block). Returns null when the user can't be provisioned (missing
// row or no email). Shared by the all-apps and single-app enqueue helpers so the
// admin-linking logic stays identical across every provisioning trigger.
async function buildProvisionPayload(
  userId: number,
  action: ProvisionAction,
  plaintextPassword?: string,
): Promise<{ userId: number; payload: Record<string, unknown> } | null> {
  const u = await loadUser(userId);
  if (!u) return null;
  if (!u.email) {
    logger.warn({ userId }, "provisioning skipped: user has no email");
    return null;
  }

  // Load the user's company (if any) so multi-tenant child apps like
  // SignSalesIQ can attach the user to the right tenant. Single-tenant
  // child apps (e.g. InstallIQ) can simply ignore the `tenant` block.
  let tenant: Record<string, unknown> | undefined;
  let admin: Record<string, unknown> | undefined;
  if (u.company_id != null) {
    const c = await loadCompany(u.company_id);
    if (c) {
      tenant = {
        external_id: c.id,
        name: c.business_name,
        slug: slugifyCompany(c.business_name, c.id),
        email: c.business_email,
        phone: c.contact_number,
        website: c.website,
      };

      // Resolve the company's admin (account owner) so child apps can place
      // this user under the same admin in their own User Management. Matched
      // by email on the child side because ids never align across databases.
      // Try business_details.admin_id first, then fall back to users.created_by
      // (always set when a user is created via the admin UI).
      const adminIdToResolve = c.admin_id ?? u.created_by;
      if (adminIdToResolve != null) {
        const a = await loadAdmin(adminIdToResolve);
        if (a?.email) {
          admin = {
            external_id: a.id,
            email: a.email,
            username: a.username,
            name: a.name,
          };
        } else {
          logger.warn(
            { userId: u.id, companyId: c.id, adminId: adminIdToResolve },
            "provisioning: resolved admin has no email; user will not be linked under an admin",
          );
        }
      }
    } else {
      logger.warn(
        { userId: u.id, companyId: u.company_id },
        "provisioning: user has company_id but business_details row missing",
      );
    }
  }

  // Final fallback: if user has no company but was created by an admin,
  // still resolve the admin so the child app can link them properly.
  if (!admin && u.created_by != null) {
    const a = await loadAdmin(u.created_by);
    if (a?.email) {
      admin = {
        external_id: a.id,
        email: a.email,
        username: a.username,
        name: a.name,
      };
    }
  }

  const payload: Record<string, unknown> = {
    external_id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    role: u.role,
    phone: u.phone,
    job_title: u.job_title,
    location: u.location,
    action,
    ...(plaintextPassword ? { password: plaintextPassword } : {}),
    ...(tenant ? { tenant } : {}),
    ...(admin ? { admin } : {}),
  };

  return { userId: u.id, payload };
}

function kickProvisioningWorker(): void {
  setImmediate(() => {
    void runOnce().catch((err) =>
      logger.warn({ err }, "immediate provisioning kick failed"),
    );
  });
}

// Enqueue a provisioning job for the user against EVERY child app. Used on
// create / edit / restore / delete where the user's existence is mirrored to all
// child apps regardless of which products they have access to.
export async function enqueueProvisionForUser(
  userId: number,
  action: ProvisionAction,
  plaintextPassword?: string,
): Promise<void> {
  try {
    const built = await buildProvisionPayload(userId, action, plaintextPassword);
    if (!built) return;

    for (const app of APP_KEYS) {
      await pool.query(
        `INSERT INTO provision_jobs (user_id, app_key, action, payload, next_attempt_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())`,
        [built.userId, app, action, JSON.stringify(built.payload)],
      );
    }

    kickProvisioningWorker();
  } catch (err) {
    logger.warn({ err, userId, action }, "enqueueProvisionForUser failed");
  }
}

// Enqueue a provisioning job for the user against a SINGLE child app. Used when
// product access is granted (`upsert`) or revoked (`delete`) for one app, so the
// user is created/linked in — or soft-removed from — only that child app.
export async function enqueueProvisionForApp(
  userId: number,
  appKey: string,
  action: ProvisionAction,
  plaintextPassword?: string,
): Promise<void> {
  try {
    if (!APP_KEYS.includes(appKey as AppKey)) {
      logger.warn({ userId, appKey }, "enqueueProvisionForApp: unknown appKey");
      return;
    }
    const built = await buildProvisionPayload(userId, action, plaintextPassword);
    if (!built) return;

    await pool.query(
      `INSERT INTO provision_jobs (user_id, app_key, action, payload, next_attempt_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [built.userId, appKey, action, JSON.stringify(built.payload)],
    );

    kickProvisioningWorker();
  } catch (err) {
    logger.warn({ err, userId, appKey, action }, "enqueueProvisionForApp failed");
  }
}

async function processJob(job: JobRow): Promise<void> {
  const appKey = job.app_key as AppKey;
  const url = await urlFor(appKey);
  const secret = secretFor(appKey);

  if (!url || !secret) {
    // Receiver isn't configured yet (Stage 2 not deployed for this app, or
    // the secret hasn't been set). Defer without burning an attempt so jobs
    // survive indefinitely and auto-deliver as soon as config appears.
    await deferWithoutAttempt(
      job.id,
      `missing config (url=${!!url}, secret=${!!secret})`,
      600,
    );
    return;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Secret": secret,
        },
        body: JSON.stringify(job.payload),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) {
      await pool.query(
        `UPDATE provision_jobs
            SET succeeded_at = NOW(),
                last_attempt_at = NOW(),
                attempts = attempts + 1,
                last_error = NULL
          WHERE id = $1`,
        [job.id],
      );
      logger.info(
        {
          appKey,
          userId: (job.payload as { external_id?: number }).external_id,
          action: (job.payload as { action?: string }).action,
        },
        "provision succeeded",
      );
      return;
    }

    const body = await res.text().catch(() => "");
    await markFailed(
      job.id,
      job.attempts,
      `HTTP ${res.status}: ${body.slice(0, 300)}`,
    );
  } catch (err) {
    await markFailed(job.id, job.attempts, (err as Error).message);
  }
}

async function deferWithoutAttempt(
  jobId: string,
  reason: string,
  delaySeconds: number,
): Promise<void> {
  await pool.query(
    `UPDATE provision_jobs
        SET last_error = $1,
            next_attempt_at = NOW() + ($2::int * INTERVAL '1 second')
      WHERE id = $3`,
    [reason, delaySeconds, jobId],
  );
}

async function markFailed(
  jobId: string,
  attempts: number,
  error: string,
): Promise<void> {
  const nextAttempts = attempts + 1;
  if (nextAttempts >= MAX_ATTEMPTS) {
    await pool.query(
      `UPDATE provision_jobs
          SET attempts = $1,
              last_attempt_at = NOW(),
              last_error = $2,
              next_attempt_at = NOW() + INTERVAL '30 days'
        WHERE id = $3`,
      [nextAttempts, error, jobId],
    );
    logger.warn(
      { jobId, error, attempts: nextAttempts },
      "provision job exhausted retries",
    );
    return;
  }
  const backoff =
    BACKOFF_SECONDS[Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1)];
  await pool.query(
    `UPDATE provision_jobs
        SET attempts = $1,
            last_attempt_at = NOW(),
            last_error = $2,
            next_attempt_at = NOW() + ($3::int * INTERVAL '1 second')
      WHERE id = $4`,
    [nextAttempts, error, backoff, jobId],
  );
}

let running = false;

/** Drain all currently-due jobs. Safe to call concurrently — re-entry is a no-op. */
export async function runOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (true) {
      const r = await pool.query<JobRow>(
        `SELECT id, app_key, payload, attempts
           FROM provision_jobs
          WHERE succeeded_at IS NULL
            AND next_attempt_at <= NOW()
            AND attempts < $1
          ORDER BY id
          LIMIT $2`,
        [MAX_ATTEMPTS, BATCH_SIZE],
      );
      if (!r.rows.length) break;
      for (const job of r.rows) {
        await processJob(job);
      }
    }
  } finally {
    running = false;
  }
}

let workerStarted = false;

/** Start the periodic background worker. Idempotent. */
export function startProvisioningWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  const timer = setInterval(() => {
    void runOnce().catch((err) =>
      logger.warn({ err }, "provisioning worker tick failed"),
    );
  }, WORKER_INTERVAL_MS);
  timer.unref();
  // Kick once on startup so any jobs pending from before the last restart
  // are re-attempted immediately rather than after the first interval.
  setImmediate(() => {
    void runOnce().catch((err) =>
      logger.warn({ err }, "provisioning worker boot kick failed"),
    );
  });
  logger.info(
    { intervalMs: WORKER_INTERVAL_MS, apps: APP_KEYS },
    "provisioning worker started",
  );
}
