import bcrypt from "bcryptjs";
import { createPool, type Pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Cross-app login fallback against the InstalliQ database.
 *
 * SignSuiteIQ is the identity hub, but a large number of accounts were created
 * directly inside InstalliQ (admins, super admins and end users) and never
 * existed in the SignSuiteIQ users table. The product requirement is that ANY
 * credential that works on the InstalliQ login page must also work on the
 * SignSuiteIQ login page.
 *
 * Rather than a one-off bulk copy (which goes stale the moment someone changes
 * their InstalliQ password), we verify credentials lazily: when SignSuiteIQ's
 * local auth fails, we look the user up in InstalliQ's database and compare the
 * password against InstalliQ's own bcrypt hash. On success the caller mirrors
 * the account into SignSuiteIQ (copying the exact hash, so it stays in sync).
 *
 * We read InstalliQ's DB directly instead of calling its /api/auth/login API
 * because that endpoint AUTO-REGISTERS unknown emails — which would let anyone
 * mint a SignSuiteIQ account. A direct read only ever confirms a pre-existing,
 * non-deleted InstalliQ user.
 */

export interface InstalliqUser {
  email: string | null;
  username: string;
  name: string | null;
  role: string;
  /** InstalliQ's stored bcrypt hash — copied verbatim into SignSuiteIQ. */
  passwordHash: string;
  phone: string | null;
}

let _pool: Pool | null = null;
let _disabled = false;

/**
 * Lazily build (once) a pooled connection to the InstalliQ database. Returns
 * null when INSTALLIQ_DATABASE_URL is not configured, in which case the
 * fallback is simply skipped and login behaves exactly as before.
 */
function installiqPool(): Pool | null {
  if (_disabled) return null;
  if (_pool) return _pool;

  const url = process.env.INSTALLIQ_DATABASE_URL;
  if (!url?.trim()) {
    _disabled = true;
    logger.warn(
      "INSTALLIQ_DATABASE_URL not set — cross-app login fallback to InstalliQ is disabled.",
    );
    return null;
  }

  try {
    _pool = createPool(url.trim());
    _pool.on("error", (err: unknown) => {
      logger.error({ err }, "InstalliQ fallback pool error");
    });
    return _pool;
  } catch (err) {
    _disabled = true;
    logger.error({ err }, "Failed to initialise InstalliQ fallback pool");
    return null;
  }
}

/**
 * Verify a login identifier (email OR username) + password against InstalliQ.
 * Returns the InstalliQ user record on success, or null on any failure
 * (no such user, deleted user, wrong password, DB unreachable, disabled).
 */
export async function verifyInstalliqCredentials(
  identifier: string,
  password: string,
): Promise<InstalliqUser | null> {
  const p = installiqPool();
  if (!p) return null;

  try {
    const r = await p.query<{
      email: string | null;
      username: string;
      name: string | null;
      role: string | null;
      password: string;
      phone: string | null;
    }>(
      `SELECT email, username, name, role, password, phone
         FROM users
        WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1))
          AND deleted_at IS NULL
        LIMIT 1`,
      [identifier.trim()],
    );

    const row = r.rows[0];
    if (!row?.password) return null;

    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return null;

    return {
      email: row.email,
      username: row.username,
      name: row.name,
      role: normaliseRole(row.role),
      passwordHash: row.password,
      phone: row.phone,
    };
  } catch (err) {
    logger.error({ err }, "InstalliQ credential verification failed");
    return null;
  }
}

/**
 * Map an InstalliQ role onto a SignSuiteIQ role. SignSuiteIQ recognises
 * 'user', 'admin' and 'super_admin'; InstalliQ has historically also used
 * 'master'/'owner' for top-level accounts.
 */
function normaliseRole(role: string | null): string {
  const r = (role ?? "user").toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "master") return "super_admin";
  if (r === "admin" || r === "owner") return "admin";
  return "user";
}
