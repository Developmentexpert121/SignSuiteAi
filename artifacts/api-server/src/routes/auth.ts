import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import bcrypt from "bcryptjs";
import {
  hashResetToken,
  issueResetToken,
  buildResetUrl,
  FORGOT_PASSWORD_TTL_MINUTES,
} from "../lib/passwordResetTokens";
import { verifyInstalliqCredentials, type InstalliqUser } from "../lib/installiqAuth";

const router = Router();

// Columns selected for the login response — shared by the primary lookup and
// the post-mirror re-fetch so both return an identical row shape.
const LOGIN_USER_COLUMNS = `
  id, username, name, email, phone, job_title, location, role, password,
  is_master, company_id,
  COALESCE(face_enabled,false) AS face_enabled, face_photo,
  COALESCE(google_enabled,false) AS google_enabled, google_email
`;

interface LoginUserRow {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  location: string | null;
  role: string;
  password: string;
  is_master: string;
  company_id: number | null;
  face_enabled: boolean;
  face_photo: string | null;
  google_enabled: boolean;
  google_email: string | null;
}

/**
 * Mirror an InstalliQ-verified user into the SignSuiteIQ users table so they can
 * log in here with the same credentials. If a SignSuiteIQ row already exists
 * (matched by the local lookup), we only re-sync its password hash — this
 * self-heals drift when a user changed their password on InstalliQ. Otherwise
 * we create the account, copying InstalliQ's bcrypt hash verbatim.
 *
 * Returns the resulting SignSuiteIQ row in the standard login shape, or null on
 * failure.
 */
async function mirrorInstalliqUser(
  iq: InstalliqUser,
  existing: LoginUserRow | null,
): Promise<LoginUserRow | null> {
  try {
    if (existing) {
      // Account exists locally — just bring the password into sync.
      await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [
        iq.passwordHash,
        existing.id,
      ]);
      const refetched = await pool.query<LoginUserRow>(
        `SELECT ${LOGIN_USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
        [existing.id],
      );
      return refetched.rows[0] ?? null;
    }

    // No local account — create one, choosing a free username.
    const emailLower = iq.email?.toLowerCase().trim() || null;
    const baseUsername =
      (iq.username || emailLower?.split("@")[0] || "user")
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "") || "user";
    let username = baseUsername;
    let counter = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const taken = await pool.query(
        `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [username],
      );
      if (taken.rows.length === 0) break;
      username = `${baseUsername}${counter++}`;
    }

    const name = iq.name?.trim() || iq.email?.split("@")[0] || username;
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO users (username, password, name, email, phone, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [username, iq.passwordHash, name, emailLower, iq.phone, iq.role],
    );
    const newId = inserted.rows[0].id;
    logger.info(
      { userId: newId, email: emailLower, role: iq.role },
      "Mirrored InstalliQ account into SignSuiteIQ on first login",
    );
    const refetched = await pool.query<LoginUserRow>(
      `SELECT ${LOGIN_USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
      [newId],
    );
    return refetched.rows[0] ?? null;
  } catch (err) {
    logger.error({ err }, "Failed to mirror InstalliQ user into SignSuiteIQ");
    return null;
  }
}

// ─── Auth middleware (matches the project-wide convention used by admin.ts) ──
// NOTE: identity is derived from the `x-user-id` header set by the SignSuiteIQ
// client. This is the same trust model used by requireAdmin elsewhere in this
// codebase. Sensitive routes verify the id resolves to an active user via DB
// before mutating any state. Replacing this with signed sessions is tracked as
// a follow-up — the change here is to make the new auth routes no weaker than
// the existing admin routes.
async function requireUser(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers["x-user-id"];
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!id || !Number.isFinite(id)) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    const result = await pool.query<{ id: number; role: string }>(
      `SELECT id, role FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!result.rows.length) return res.status(401).json({ error: "Not authenticated." });
    (req as Request & { authUser?: { id: number; role: string } }).authUser = result.rows[0];
    return next();
  } catch (err) {
    logger.error({ err }, "requireUser error");
    return res.status(500).json({ error: "Server error." });
  }
}

function authedUserId(req: Request): number {
  return (req as Request & { authUser?: { id: number } }).authUser!.id;
}

const ALL_APP_KEYS = ["installiq", "signsalesiq", "signtakeoffiq"];

// ─── Verify a Google ID token via Google's tokeninfo endpoint ─────────────────
async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; sub: string; name?: string; picture?: string } | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const data = await res.json() as { email?: string; sub?: string; aud?: string; name?: string; picture?: string; email_verified?: string };
    if (!data.email || !data.sub) return null;
    if (data.email_verified === "false") return null;
    const expectedAud = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    if (expectedAud && data.aud !== expectedAud) {
      logger.warn({ aud: data.aud }, "Google ID token aud mismatch");
      return null;
    }
    return { email: data.email.toLowerCase(), sub: data.sub, name: data.name, picture: data.picture };
  } catch (err) {
    logger.error({ err }, "Google token verify failed");
    return null;
  }
}

// ─── Euclidean distance for face lock ────────────────────────────────────────
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function parseDescriptor(raw: string): number[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as number[];
    if (parsed && typeof parsed === "object") return Object.values(parsed) as number[];
    return null;
  } catch {
    return null;
  }
}

// ─── Resolve allowed apps for a user as the union of every active per-product
//     subscription owned by anyone in their company. Each product is its own
//     month-to-month subscription, so multiple purchases stack additively.
async function resolveAllowedApps(role: string, companyId: number | null): Promise<{ allowedApps: string[]; planKey: string | null }> {
  if (role === "super_admin") {
    return { allowedApps: ALL_APP_KEYS, planKey: null };
  }
  if (!companyId) {
    return { allowedApps: [], planKey: null };
  }

  try {
    const subsRes = await pool.query<{ products: string[]; plan_key: string }>(
      `SELECT us.plan_key, pc.products
         FROM user_subscriptions us
         JOIN users u         ON u.id = us.user_id
         JOIN plans_config pc ON pc.plan_key = us.plan_key
        WHERE u.company_id = $1
          AND us.status IN ('active','trialing')
          AND (us.current_period_end IS NULL OR us.current_period_end > NOW())`,
      [companyId]
    );

    const apps = new Set<string>();
    for (const row of subsRes.rows) {
      for (const k of (row.products ?? [])) apps.add(k);
    }
    // Union any "free" app grants a super admin gave to admins in this company.
    // These provide access (and the right to grant to users) without a paid
    // subscription.
    try {
      const grants = await pool.query<{ app_key: string }>(
        `SELECT DISTINCT g.app_key
           FROM admin_app_grants g
           JOIN users u ON u.id = g.admin_user_id
          WHERE u.company_id = $1 AND g.is_active = true`,
        [companyId]
      );
      for (const row of grants.rows) apps.add(row.app_key);
    } catch { /* table may not exist yet on a fresh DB — ignore */ }
    const allowedApps = Array.from(apps);
    const planKey = subsRes.rows[0]?.plan_key ?? null;
    return { allowedApps, planKey };
  } catch {
    return { allowedApps: [], planKey: null };
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await pool.query<LoginUserRow>(
      `SELECT ${LOGIN_USER_COLUMNS}
       FROM users
       WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1))
         AND deleted_at IS NULL
       LIMIT 1`,
      [email.trim()]
    );

    let user: LoginUserRow | null = result.rows[0] ?? null;

    // Primary path: validate against the local SignSuiteIQ password hash.
    let authed = user ? await bcrypt.compare(password, user.password) : false;

    // Fallback path: if local auth didn't succeed (account doesn't exist here,
    // or its password is out of sync with InstalliQ), verify the credentials
    // against the InstalliQ database. On success, mirror the account into
    // SignSuiteIQ so this and future logins work with the same credentials.
    if (!authed) {
      const iq = await verifyInstalliqCredentials(email.trim(), password);
      if (iq) {
        const mirrored = await mirrorInstalliqUser(iq, user);
        if (mirrored) {
          user = mirrored;
          authed = true;
        }
      }
    }

    if (!user || !authed) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Fetch app access for this user (their own granted products)
    const appAccess = await pool.query<{ app_key: string }>(
      `SELECT app_key FROM user_app_access WHERE user_id = $1 AND is_active = true`,
      [user.id]
    );

    // Fetch company name if company_id exists
    let companyName: string | null = null;
    if (user.company_id) {
      const co = await pool.query<{ business_name: string }>(
        `SELECT business_name FROM business_details WHERE id = $1`,
        [user.company_id]
      );
      companyName = co.rows[0]?.business_name ?? null;
    }

    // Resolve which apps the admin's plan allows granting
    const { allowedApps, planKey } = await resolveAllowedApps(user.role, user.company_id);

    logger.info({ userId: user.id, role: user.role }, "User logged in");

    return res.json({
      success: true,
      user: {
        id:            user.id,
        email:         user.email ?? user.username,
        username:      user.username,
        name:          user.name,
        phone:         user.phone,
        jobTitle:      user.job_title,
        location:      user.location,
        role:          user.role,
        isMaster:      user.is_master === "true",
        companyId:     user.company_id,
        companyName,
        faceEnabled:   user.face_enabled,
        facePhoto:     user.face_photo,
        googleEnabled: user.google_enabled,
        googleEmail:   user.google_email,
        apps:          appAccess.rows.map(r => r.app_key),
        allowedApps,
        planKey,
      },
    });
  } catch (err) {
    logger.error({ err }, "Login DB error");
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ─── POST /api/auth/face-login ────────────────────────────────────────────────
router.post("/auth/face-login", async (req, res) => {
  const { descriptor } = req.body as { descriptor: unknown };

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ error: "Invalid face descriptor — expected 128-element array." });
  }

  const submittedDesc = descriptor as number[];

  try {
    const result = await pool.query<{
      id: number;
      username: string;
      name: string;
      email: string | null;
      role: string;
      face_descriptor: string;
      company_id: number | null;
      job_title: string | null;
    }>(
      `SELECT id, username, name, email, role, face_descriptor, company_id, job_title
       FROM users
       WHERE face_enabled = true
         AND face_descriptor IS NOT NULL
         AND deleted_at IS NULL`
    );

    const THRESHOLD = 0.6;
    let bestUser: typeof result.rows[0] | null = null;
    let bestDist = Infinity;

    for (const row of result.rows) {
      const stored = parseDescriptor(row.face_descriptor);
      if (!stored || stored.length !== 128) continue;
      const dist = euclideanDistance(submittedDesc, stored);
      if (dist < THRESHOLD && dist < bestDist) {
        bestDist = dist;
        bestUser = row;
      }
    }

    if (!bestUser) {
      logger.info("Face login: no match found");
      return res.status(401).json({ error: "Face not recognized. Please use email/password or contact your admin." });
    }

    // Fetch app access
    const appAccess = await pool.query<{ app_key: string }>(
      `SELECT app_key FROM user_app_access WHERE user_id = $1 AND is_active = true`,
      [bestUser.id]
    );

    // Resolve allowed apps based on plan
    const { allowedApps, planKey } = await resolveAllowedApps(bestUser.role, bestUser.company_id);

    logger.info({ userId: bestUser.id, dist: bestDist.toFixed(4) }, "Face login: match found");

    return res.json({
      success: true,
      user: {
        id:         bestUser.id,
        email:      bestUser.email ?? bestUser.username,
        username:   bestUser.username,
        name:       bestUser.name,
        role:       bestUser.role,
        jobTitle:   bestUser.job_title,
        companyId:  bestUser.company_id,
        apps:       appAccess.rows.map(r => r.app_key),
        allowedApps,
        planKey,
      },
    });
  } catch (err) {
    logger.error({ err }, "Face login DB error");
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ─── Helper: build the standard user response from a DB row ───────────────────
async function buildUserResponse(userId: number) {
  const result = await pool.query<{
    id: number; username: string; name: string;
    email: string | null; phone: string | null; job_title: string | null; location: string | null;
    role: string; is_master: string; company_id: number | null;
    face_enabled: boolean; face_photo: string | null;
    google_enabled: boolean; google_email: string | null;
  }>(
    `SELECT id, username, name, email, phone, job_title, location, role, is_master, company_id,
            COALESCE(face_enabled,false) AS face_enabled, face_photo,
            COALESCE(google_enabled,false) AS google_enabled, google_email
     FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const u = result.rows[0];

  const appAccess = await pool.query<{ app_key: string }>(
    `SELECT app_key FROM user_app_access WHERE user_id = $1 AND is_active = true`,
    [u.id]
  );

  let companyName: string | null = null;
  if (u.company_id) {
    const co = await pool.query<{ business_name: string }>(
      `SELECT business_name FROM business_details WHERE id = $1`,
      [u.company_id]
    );
    companyName = co.rows[0]?.business_name ?? null;
  }

  const { allowedApps, planKey } = await resolveAllowedApps(u.role, u.company_id);

  return {
    id:            u.id,
    email:         u.email ?? u.username,
    username:      u.username,
    name:          u.name,
    phone:         u.phone,
    jobTitle:      u.job_title,
    location:      u.location,
    role:          u.role,
    isMaster:      u.is_master === "true",
    companyId:     u.company_id,
    companyName,
    faceEnabled:   u.face_enabled,
    facePhoto:     u.face_photo,
    googleEnabled: u.google_enabled,
    googleEmail:   u.google_email,
    apps:          appAccess.rows.map(r => r.app_key),
    allowedApps,
    planKey,
  };
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", requireUser, async (req, res) => {
  try {
    const user = await buildUserResponse(authedUserId(req));
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ user });
  } catch (err) {
    logger.error({ err }, "GET /auth/me error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
// Self-service profile update. Users may update their own name, phone, and
// location only. Email and job_title are intentionally NOT editable here —
// email is the immutable account identifier; job_title is assigned by an admin.
router.patch("/auth/me", requireUser, async (req, res) => {
  const userId = authedUserId(req);
  const { name, phone, location } = req.body as {
    name?: string; phone?: string; location?: string;
  };

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Full name is required." });
  }

  try {
    await pool.query(
      `UPDATE users
          SET name     = $1,
              phone    = $2,
              location = $3
        WHERE id = $4`,
      [
        name.trim(),
        phone?.trim() || null,
        location?.trim() || null,
        userId,
      ]
    );
    const user = await buildUserResponse(userId);
    return res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, "PATCH /auth/me error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/face-register ─────────────────────────────────────────────
router.post("/auth/face-register", requireUser, async (req, res) => {
  const userId = authedUserId(req);
  const { descriptor, photo } = req.body as { descriptor: unknown; photo?: string };
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ error: "Invalid face descriptor — expected 128-element array." });
  }
  try {
    await pool.query(
      `UPDATE users
         SET face_descriptor = $1,
             face_photo = COALESCE($2, face_photo),
             face_enabled = true,
             face_registered_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(descriptor), photo ?? null, userId]
    );
    const user = await buildUserResponse(userId);
    return res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, "Face register error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/face-disable ──────────────────────────────────────────────
router.post("/auth/face-disable", requireUser, async (req, res) => {
  const userId = authedUserId(req);
  try {
    await pool.query(
      `UPDATE users SET face_enabled = false, face_descriptor = NULL, face_photo = NULL WHERE id = $1`,
      [userId]
    );
    const user = await buildUserResponse(userId);
    return res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, "Face disable error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/google-link ───────────────────────────────────────────────
// Body: { credential } — Google ID token from GIS One Tap / button on the client.
router.post("/auth/google-link", requireUser, async (req, res) => {
  const userId = authedUserId(req);
  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });

  const profile = await verifyGoogleIdToken(credential);
  if (!profile) return res.status(400).json({ error: "Invalid Google credential." });

  try {
    // Make sure no other user has already linked this Google account.
    const conflict = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE google_id = $1 AND id <> $2 AND deleted_at IS NULL LIMIT 1`,
      [profile.sub, userId]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: "This Google account is already linked to another user." });
    }
    await pool.query(
      `UPDATE users SET google_id = $1, google_email = $2, google_enabled = true WHERE id = $3`,
      [profile.sub, profile.email, userId]
    );
    const user = await buildUserResponse(userId);
    return res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, "Google link error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/google-unlink ─────────────────────────────────────────────
router.post("/auth/google-unlink", requireUser, async (req, res) => {
  const userId = authedUserId(req);
  try {
    await pool.query(
      `UPDATE users SET google_id = NULL, google_email = NULL, google_enabled = false WHERE id = $1`,
      [userId]
    );
    const user = await buildUserResponse(userId);
    return res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, "Google unlink error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/google-login ──────────────────────────────────────────────
// Body: { credential } — Google ID token. Looks up the user by google_id /
// google_email and signs them in if google_enabled is true.
router.post("/auth/google-login", async (req, res) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });

  const profile = await verifyGoogleIdToken(credential);
  if (!profile) return res.status(401).json({ error: "Invalid Google credential." });

  try {
    const lookup = await pool.query<{ id: number }>(
      `SELECT id FROM users
       WHERE deleted_at IS NULL
         AND COALESCE(google_enabled,false) = true
         AND (google_id = $1 OR LOWER(google_email) = $2 OR LOWER(email) = $2)
       LIMIT 1`,
      [profile.sub, profile.email]
    );
    if (lookup.rows.length === 0) {
      return res.status(401).json({
        error: "No SignSuiteIQ account is linked to this Google account. Please sign in with email/password and enable Google Login from Account Settings.",
      });
    }
    const user = await buildUserResponse(lookup.rows[0].id);
    if (!user) return res.status(401).json({ error: "User not found." });
    logger.info({ userId: user.id }, "Google login");
    return res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, "Google login error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
// Public — issues a single-use, time-limited reset *link* to the user's email.
// The link points at /reset-password?token=... where the user chooses their
// own password. Always returns 200 to avoid account-enumeration; only logs
// whether a real account was matched.
router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });

    const emailLower = email.toLowerCase().trim();
    const r = await pool.query<{
      id: number; name: string; email: string;
    }>(
      `SELECT id, name, email FROM users
        WHERE LOWER(email) = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [emailLower]
    );

    if (r.rows.length) {
      const u = r.rows[0];
      const { rawToken } = await issueResetToken(u.id, FORGOT_PASSWORD_TTL_MINUTES);
      const resetUrl = buildResetUrl(rawToken);

      try {
        const { sendPasswordResetLinkEmail } = await import("../lib/email");
        await sendPasswordResetLinkEmail({
          toEmail: u.email,
          toName: u.name,
          resetUrl,
          expiresInMinutes: FORGOT_PASSWORD_TTL_MINUTES,
        });
        logger.info({ userId: u.id }, "Forgot-password reset link sent");
      } catch (emailErr) {
        logger.warn({ emailErr, userId: u.id }, "Forgot-password reset link email failed");
      }
    } else {
      logger.info({ email: emailLower }, "Forgot-password requested for unknown email");
    }

    return res.json({
      ok: true,
      message:
        "If an account with that email exists, we've emailed a password-reset link. Check your inbox.",
    });
  } catch (err) {
    logger.error({ err }, "Forgot-password error");
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── GET /api/auth/reset-password/verify?token=... ────────────────────────────
// Public — lets the /reset-password page check up-front whether the token is
// usable, so we can show "link expired / already used" instead of waiting
// until the user types a new password.
router.get("/auth/reset-password/verify", async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token ?? "");
    if (!token) return res.status(400).json({ ok: false, error: "Token is required." });

    const r = await pool.query<{ id: number; email: string }>(
      `SELECT u.id, u.email
         FROM password_reset_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1
          AND t.used_at IS NULL
          AND t.expires_at > NOW()
          AND u.deleted_at IS NULL
        LIMIT 1`,
      [hashResetToken(token)],
    );

    if (!r.rows.length) {
      return res.status(400).json({ ok: false, error: "This reset link is invalid or has expired." });
    }
    return res.json({ ok: true, email: r.rows[0].email });
  } catch (err) {
    logger.error({ err }, "reset-password verify error");
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
// Public — consumes a reset token and sets a new password chosen by the user.
router.post("/auth/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token) return res.status(400).json({ error: "Token is required." });
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (password.length > 200) {
      return res.status(400).json({ error: "Password is too long." });
    }

    const tokenHash = hashResetToken(token);
    const hashed = await bcrypt.hash(password, 10);

    // Atomically *claim* the token (single-use under concurrency: two parallel
    // requests with the same token cannot both succeed because the
    // `used_at IS NULL` predicate guards the UPDATE), then set the password
    // and invalidate any other outstanding tokens for that user.
    let userId: number;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const claim = await client.query<{ user_id: number }>(
        `UPDATE password_reset_tokens
            SET used_at = NOW()
          WHERE token_hash = $1
            AND used_at IS NULL
            AND expires_at > NOW()
        RETURNING user_id`,
        [tokenHash],
      );
      if (!claim.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This reset link is invalid or has expired." });
      }
      userId = claim.rows[0].user_id;

      // Refuse to reset a password for a soft-deleted account.
      const userCheck = await client.query<{ id: number }>(
        `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [userId],
      );
      if (!userCheck.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This reset link is invalid or has expired." });
      }

      await client.query(
        `UPDATE users SET password = $1, temp_password = NULL WHERE id = $2`,
        [hashed, userId],
      );
      await client.query(
        `UPDATE password_reset_tokens
            SET used_at = NOW()
          WHERE user_id = $1 AND used_at IS NULL`,
        [userId],
      );
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    // Push the new password to the child apps so direct login works
    // everywhere with the same credentials.
    try {
      const { enqueueProvisionForUser } = await import("../services/provisioning");
      void enqueueProvisionForUser(userId, "upsert", password);
    } catch (provErr) {
      logger.warn({ err: provErr, userId }, "reset-password: provisioning enqueue failed");
    }

    logger.info({ userId }, "Password reset via link completed");
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset-password error");
    return res.status(500).json({ error: "Server error." });
  }
});

export default router;
