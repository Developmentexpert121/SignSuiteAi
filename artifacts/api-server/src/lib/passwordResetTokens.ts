import crypto from "node:crypto";
import { pool } from "@workspace/db";

/**
 * Trusted public origin for building user-facing URLs (password-reset and
 * account-invite links). We deliberately do NOT derive this from request
 * headers, because the endpoints that send these emails are reachable
 * without the user being signed in — an attacker could spoof Host /
 * X-Forwarded-Host to redirect a victim's link to an attacker-controlled
 * domain and steal the token. Resolution order:
 *   1. SIGNSUITEIQ_PUBLIC_URL  (set in prod / staging)
 *   2. https://$REPLIT_DEV_DOMAIN  (Replit dev preview)
 *   3. http://localhost:5000  (local dev fallback)
 */
export function trustedPublicOrigin(): string {
  const explicit = process.env.SIGNSUITEIQ_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const replitDev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDev) return `https://${replitDev}`;
  return "http://localhost:5000";
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a single-use, expiring password-reset token for a user. The raw
 * token is returned to the caller (so it can be embedded in an email link)
 * and only its sha256 hash is persisted. Any prior outstanding tokens for
 * the same user are invalidated so only the newest link works.
 */
export async function issueResetToken(
  userId: number,
  ttlMinutes: number,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  // Run invalidation + insert atomically and serialize concurrent issuances
  // for the same user with a per-user advisory lock, so two parallel calls
  // cannot both leave an active token (only the newest link must work).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [userId]);
    await client.query(
      `UPDATE password_reset_tokens
          SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return { rawToken, expiresAt };
}

/** Build a /reset-password?token=... URL for the given raw token. */
export function buildResetUrl(rawToken: string): string {
  return `${trustedPublicOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/** Standard TTLs. */
export const FORGOT_PASSWORD_TTL_MINUTES = 60;          // 1 hour
export const ACCOUNT_INVITE_TTL_MINUTES = 7 * 24 * 60;  // 7 days
