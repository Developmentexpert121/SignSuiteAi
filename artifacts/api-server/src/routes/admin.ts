import express, { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import path from "node:path";
import { promises as fsp } from "node:fs";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { UPLOADS_DIR } from "../lib/paths";
import { generateTempPassword } from "../lib/tempPassword";
import { sendAccountInviteEmail } from "../lib/email";
import { enqueueProvisionForUser, enqueueProvisionForApp } from "../services/provisioning";
import {
  issueResetToken,
  buildResetUrl,
  ACCOUNT_INVITE_TTL_MINUTES,
} from "../lib/passwordResetTokens";

const router = Router();

// All admin endpoints serve live DB data — never cache them so changes
// (user edits, company updates, stats) are immediately visible without refresh.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const APP_KEYS = ["installiq", "signsalesiq", "signtakeoffiq"];
const ALL_APP_KEYS = APP_KEYS;

// ─── Resolve allowed apps for a company as the union of all active per-product
//     subscriptions. Each Stripe subscription in user_subscriptions is mapped
//     through plans_config.products and unioned. Subscriptions are considered
//     active when status is 'active'/'trialing' and current_period_end is in
//     the future (or NULL for freshly-activated rows pending the first webhook).
export async function resolveCompanyAllowedApps(companyId: number | null): Promise<string[]> {
  if (!companyId) return [];
  try {
    const result = await pool.query<{ products: string[] }>(
      `SELECT DISTINCT pc.products
         FROM user_subscriptions us
         JOIN users u         ON u.id = us.user_id
         JOIN plans_config pc ON pc.plan_key = us.plan_key
        WHERE u.company_id = $1
          AND us.status IN ('active','trialing')
          AND (us.current_period_end IS NULL OR us.current_period_end > NOW())`,
      [companyId]
    );
    const apps = new Set<string>();
    for (const row of result.rows) {
      for (const k of (row.products ?? [])) apps.add(k);
    }
    // Union any "free" app grants a super admin gave to admins in this company.
    // These provide access without a paid subscription.
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
    return Array.from(apps);
  } catch {
    return [];
  }
}

// Resolve allowed apps directly by user_id (fallback when the user has no
// company_id assigned yet — e.g. a freshly-registered admin who purchased
// before their company record was linked).
async function resolveUserAllowedApps(userId: number): Promise<string[]> {
  try {
    const result = await pool.query<{ products: string[] }>(
      `SELECT DISTINCT pc.products
         FROM user_subscriptions us
         JOIN plans_config pc ON pc.plan_key = us.plan_key
        WHERE us.user_id = $1
          AND us.status IN ('active','trialing')
          AND (us.current_period_end IS NULL OR us.current_period_end > NOW())`,
      [userId]
    );
    const apps = new Set<string>();
    for (const row of result.rows) {
      for (const k of (row.products ?? [])) apps.add(k);
    }
    // Union any "free" app grants a super admin gave directly to this admin.
    try {
      const grants = await pool.query<{ app_key: string }>(
        `SELECT app_key FROM admin_app_grants WHERE admin_user_id = $1 AND is_active = true`,
        [userId]
      );
      for (const row of grants.rows) apps.add(row.app_key);
    } catch { /* table may not exist yet on a fresh DB — ignore */ }
    return Array.from(apps);
  } catch {
    return [];
  }
}

// Resolve allowed apps for an admin — company-wide first, user-level fallback.
async function resolveAdminAllowedApps(adminUserId: number): Promise<string[]> {
  try {
    const res = await pool.query<{ company_id: number | null }>(
      `SELECT company_id FROM users WHERE id = $1 LIMIT 1`,
      [adminUserId]
    );
    const companyId = res.rows[0]?.company_id ?? null;
    if (companyId) return resolveCompanyAllowedApps(companyId);
    return resolveUserAllowedApps(adminUserId);
  } catch {
    return [];
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // IMPORTANT: filter deleted_at IS NULL so soft-deleted (archived) admins
    // immediately lose privileged API access — even if their client still has
    // an `x-user-id` header. Login routes already enforce this; admin routes
    // must enforce it too.
    const result = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [Number(userId)]
    );
    if (!result.rows.length) return res.status(401).json({ error: "User not found" });
    const user = result.rows[0];
    if (user.role !== "super_admin" && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    (req as any).adminUser = user;
    return next();
  } catch (err) {
    logger.error({ err }, "requireAdmin error");
    return res.status(500).json({ error: "Server error" });
  }
}

function isSuperAdmin(req: Request) {
  return (req as any).adminUser?.role === "super_admin";
}

// A Pool or a pooled client — both expose `.query`, so the helper below can run
// either standalone or inside a transaction.
type Queryable = { query: (...args: any[]) => Promise<any> };

// Recompute the Full Suite bundle membership. The bundle always contains exactly
// the products that are live or under maintenance — i.e. every product that is
// NOT coming soon. Coming soon products are excluded until they go live. This is
// recomputed from products_config on every product create/update/delete, so the
// bundle membership can never drift out of sync with the catalog.
async function syncFullSuiteProducts(db: Queryable) {
  await db.query(`
    UPDATE plans_config
    SET products = COALESCE((
          SELECT jsonb_agg(product_key ORDER BY sort_order, product_key)
          FROM products_config
          WHERE coming_soon = false
        ), '[]'::jsonb),
        updated_at = NOW()
    WHERE plan_key = 'fullsuite'
  `);
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get("/admin/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) {
      const adminUser = (req as any).adminUser;
      const [usersRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND company_id = (SELECT company_id FROM users WHERE id = $1)`, [adminUser.id]),
      ]);
      return res.json({ companies: 1, users: Number(usersRes.rows[0].count) });
    }

    const [companiesRes, usersRes, accessRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM business_details`),
      pool.query(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM user_app_access WHERE is_active = true`),
    ]);

    return res.json({
      companies: Number(companiesRes.rows[0].count),
      users:     Number(usersRes.rows[0].count),
      appGrants: Number(accessRes.rows[0].count),
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/stats error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/admin/companies ─────────────────────────────────────────────────
router.get("/admin/companies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;

    if (isSuperAdmin(req)) {
      const result = await pool.query(`
        SELECT bd.id, bd.business_name, bd.business_email, bd.contact_number, bd.website,
               bd.created_at,
               COUNT(u.id)::int AS user_count,
               admin_u.name AS admin_name, admin_u.email AS admin_email
        FROM business_details bd
        LEFT JOIN users u ON u.company_id = bd.id
        LEFT JOIN users admin_u ON admin_u.id = bd.admin_id
        GROUP BY bd.id, admin_u.name, admin_u.email
        ORDER BY bd.id
      `);
      return res.json(result.rows);
    }

    // Admin: only their own company
    const result = await pool.query(`
      SELECT bd.id, bd.business_name, bd.business_email, bd.contact_number, bd.website,
             bd.created_at,
             COUNT(u.id)::int AS user_count,
             admin_u.name AS admin_name, admin_u.email AS admin_email
      FROM business_details bd
      LEFT JOIN users u ON u.company_id = bd.id
      LEFT JOIN users admin_u ON admin_u.id = bd.admin_id
      WHERE bd.id = (SELECT company_id FROM users WHERE id = $1)
      GROUP BY bd.id, admin_u.name, admin_u.email
    `, [adminUser.id]);
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/companies error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;
    const { companyId, search, archived } = req.query;
    const wantArchived = String(archived ?? "") === "1" || String(archived ?? "") === "true";

    const params: any[] = [];
    const filters: string[] = [
      wantArchived ? "u.deleted_at IS NOT NULL" : "u.deleted_at IS NULL",
    ];

    if (isSuperAdmin(req)) {
      if (companyId) {
        params.push(Number(companyId));
        filters.push(`u.company_id = $${params.length}`);
      }
    } else {
      params.push(adminUser.id);
      filters.push(`u.company_id = (SELECT company_id FROM users WHERE id = $${params.length})`);
    }

    if (search) {
      params.push(`%${search}%`);
      // Match the user directly (name/email/phone) OR include every member of a
      // company whose OWNER (business_details.admin_id) matches the search term.
      // Without the second clause, searching an admin's email/name returns only
      // the admin row and hides their team, so the owner card shows "1 user".
      filters.push(`(
        u.name ILIKE $${params.length}
        OR u.email ILIKE $${params.length}
        OR u.phone ILIKE $${params.length}
        OR u.company_id IN (
          SELECT bd.id FROM business_details bd
          JOIN users au ON au.id = bd.admin_id
          WHERE au.name ILIKE $${params.length}
             OR au.email ILIKE $${params.length}
             OR au.username ILIKE $${params.length}
        )
      )`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT u.id, u.name, u.username, u.email, u.phone, u.job_title, u.location,
             u.role, u.company_id, u.created_at,
             bd.business_name AS company_name,
             bd.active_plan_key AS plan_key,
             pc.display_name   AS plan_name,
             COALESCE(
               json_agg(uaa.app_key ORDER BY uaa.app_key) FILTER (WHERE uaa.is_active = true),
               '[]'::json
             ) AS apps,
             COALESCE((
               SELECT json_agg(row_to_json(c) ORDER BY (c).is_primary DESC, (c).name)
               FROM (
                 SELECT
                   bd2.id,
                   bd2.business_name                        AS name,
                   CASE WHEN bd2.admin_id = u.id
                        THEN 'admin' ELSE 'member' END      AS relationship,
                   (bd2.id = u.company_id)                  AS is_primary,
                   bd2.active_plan_key                      AS plan_key,
                   pc2.display_name                         AS plan_name
                 FROM business_details bd2
                 LEFT JOIN plans_config pc2 ON pc2.plan_key = bd2.active_plan_key
                 WHERE bd2.admin_id = u.id OR bd2.id = u.company_id
               ) c
             ), '[]'::json) AS companies
      FROM users u
      LEFT JOIN business_details bd ON bd.id = u.company_id
      LEFT JOIN plans_config pc     ON pc.plan_key = bd.active_plan_key
      LEFT JOIN user_app_access uaa ON uaa.user_id = u.id
      ${whereClause}
      GROUP BY u.id, bd.business_name, bd.active_plan_key, pc.display_name
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC
    `, params);

    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/users error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Helper: ensure the caller is allowed to manage this user ─────────────────
async function assertCanManageUser(req: Request, userId: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const adminUser = (req as any).adminUser;
  const target = await pool.query<{ role: string; company_id: number | null }>(
    `SELECT role, company_id FROM users WHERE id = $1 LIMIT 1`, [userId]
  );
  if (!target.rows.length) return { ok: false, status: 404, error: "User not found" };
  if (target.rows[0].role === "super_admin") return { ok: false, status: 403, error: "Cannot manage super admins" };
  if (isSuperAdmin(req)) return { ok: true };
  const me = await pool.query<{ company_id: number | null }>(
    `SELECT company_id FROM users WHERE id = $1`, [adminUser.id]
  );
  const myCompany = me.rows[0]?.company_id;
  if (target.rows[0].role !== "user" || !myCompany || target.rows[0].company_id !== myCompany) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}

// ─── DELETE /api/admin/users/:id  (soft delete) ───────────────────────────────
router.delete("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const guard = await assertCanManageUser(req, id);
  if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

  const client = await pool.connect();
  try {
    // If the target is an admin, cascade-archive every other user in the same
    // company (excluding super_admins and users already archived) and tag them
    // with cascade_deleted_by = adminId so we can auto-restore them when the
    // admin is later restored. Direct-archive of the target itself ALWAYS
    // clears its own cascade_deleted_by so that a stale tag from a previous
    // cascade can never trigger an unintended auto-restore later.
    await client.query("BEGIN");
    try {
      const t = await client.query<{ role: string; company_id: number | null }>(
        `SELECT role, company_id FROM users WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!t.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }
      const { role, company_id } = t.rows[0];

      await client.query(
        `UPDATE users SET deleted_at = NOW(), cascade_deleted_by = NULL WHERE id = $1`,
        [id]
      );

      let cascaded = 0;
      let cascadedIds: number[] = [];
      if ((role === "admin" || role === "super_admin") && company_id != null) {
        const r = await client.query<{ id: number }>(
          `UPDATE users
              SET deleted_at = NOW(),
                  cascade_deleted_by = $1
            WHERE company_id = $2
              AND id <> $1
              AND deleted_at IS NULL
              AND role <> 'super_admin'
            RETURNING id`,
          [id, company_id]
        );
        cascadedIds = r.rows.map(x => x.id);
        cascaded = cascadedIds.length;
      }

      await client.query("COMMIT");
      void enqueueProvisionForUser(id, "delete");
      for (const cid of cascadedIds) void enqueueProvisionForUser(cid, "delete");
      return res.json({ ok: true, cascaded });
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    }
  } catch (err) {
    logger.error({ err }, "DELETE /admin/users/:id error");
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ─── POST /api/admin/users/:id/reset-password ────────────────────────────────
router.post("/admin/users/:id/reset-password", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const guard = await assertCanManageUser(req, id);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const u = await pool.query<{ name: string; username: string; email: string | null }>(
      `SELECT name, username, email FROM users WHERE id = $1 LIMIT 1`, [id]
    );
    if (!u.rows.length) return res.status(404).json({ error: "User not found" });

    const customPwd = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (customPwd && customPwd.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const updatedAt = new Date().toISOString();
    let emailSent = false;

    if (customPwd) {
      // Admin chose a specific password — set it directly and let the admin
      // share it manually. We deliberately do not email the password.
      const hashed = await bcrypt.hash(customPwd, 10);
      await pool.query(
        `UPDATE users SET password = $1, temp_password = NULL WHERE id = $2`,
        [hashed, id],
      );
      void enqueueProvisionForUser(id, "upsert", customPwd);
    } else if (u.rows[0].email) {
      // No custom password — email a reset link the user clicks to choose
      // their own password. The user's existing password remains valid until
      // they complete the reset.
      try {
        const { rawToken } = await issueResetToken(id, ACCOUNT_INVITE_TTL_MINUTES);
        const setupUrl = buildResetUrl(rawToken);
        await sendAccountInviteEmail({
          toEmail:  u.rows[0].email,
          toName:   u.rows[0].name,
          username: u.rows[0].username,
          setupUrl,
          expiresInHours: ACCOUNT_INVITE_TTL_MINUTES / 60,
        });
        emailSent = true;
      } catch (emailErr) {
        logger.warn({ emailErr, userId: id }, "Reset-password invite email failed");
      }
    }

    return res.json({
      ok: true,
      name: u.rows[0].name,
      email: u.rows[0].email,
      username: u.rows[0].username,
      emailSent,
      updatedAt,
    });
  } catch (err) {
    logger.error({ err }, "POST /admin/users/:id/reset-password error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/users/:id/restore  (un-archive) ─────────────────────────
router.post("/admin/users/:id/restore", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const guard = await assertCanManageUser(req, id);
  if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

  const client = await pool.connect();
  try {
    // Direct restore of the target ALWAYS clears its own cascade_deleted_by —
    // an independent restore breaks the cascade tag relationship so a future
    // admin restore must not auto-touch this user. If the restored user is an
    // admin, also auto-restore every user tagged with cascade_deleted_by =
    // adminId. Users that were independently archived (cascade_deleted_by IS
    // NULL) stay archived — they must be restored individually.
    await client.query("BEGIN");
    try {
      const t = await client.query<{ role: string }>(
        `SELECT role FROM users WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!t.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      await client.query(
        `UPDATE users SET deleted_at = NULL, cascade_deleted_by = NULL WHERE id = $1`,
        [id]
      );

      let restored = 0;
      let restoredIds: number[] = [];
      if (t.rows[0].role === "admin" || t.rows[0].role === "super_admin") {
        const r = await client.query<{ id: number }>(
          `UPDATE users
              SET deleted_at = NULL,
                  cascade_deleted_by = NULL
            WHERE cascade_deleted_by = $1
              AND deleted_at IS NOT NULL
            RETURNING id`,
          [id]
        );
        restoredIds = r.rows.map(x => x.id);
        restored = restoredIds.length;
      }

      await client.query("COMMIT");
      void enqueueProvisionForUser(id, "upsert");
      for (const rid of restoredIds) void enqueueProvisionForUser(rid, "upsert");
      return res.json({ ok: true, restored });
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    }
  } catch (err) {
    logger.error({ err }, "POST /admin/users/:id/restore error");
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/admin/users/:id/permanent ───────────────────────────────────
// Super admin only — permanently delete an archived (soft-deleted) user from
// the Users tab archive. The Users archive can contain both regular users
// and admins (anyone soft-deleted), so this endpoint accepts any role EXCEPT
// super_admin. Safety: the user must already be archived, and a super admin
// cannot delete themselves.
router.delete("/admin/users/:id/permanent", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const requesterId = (req as any).adminUser?.id;
  if (requesterId === id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const client = await pool.connect();
  try {
    // Wrap everything in a transaction with row-level lock so the archived-only
    // check + cleanup + delete are atomic — prevents a concurrent restore from
    // racing in between (TOCTOU). If cleanup fails, we ROLLBACK so we don't
    // leave the user in a partially-deleted state.
    await client.query("BEGIN");
    try {
      const check = await client.query(
        `SELECT id, role FROM users WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!check.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }
      if (check.rows[0].role === "super_admin") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Cannot permanently delete a super admin" });
      }

      // Single conditional DELETE that re-verifies archived status atomically.
      const del = await client.query(
        `DELETE FROM users WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
        [id]
      );
      if (!del.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "User must be archived before permanent deletion" });
      }

      // Most dependent FKs are ON DELETE CASCADE / SET NULL in the schema,
      // so the row delete above already cleans them up. The explicit cleanup
      // below is a defensive no-op on the current schema but kept for safety
      // on environments where CASCADE may not be present.
      await client.query(`DELETE FROM user_app_access     WHERE user_id  = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM user_subscriptions  WHERE user_id  = $1`, [id]).catch(() => {});
      await client.query(`UPDATE business_details SET admin_id = NULL WHERE admin_id = $1`, [id]).catch(() => {});

      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    }
  } catch (err) {
    logger.error({ err }, "DELETE /admin/users/:id/permanent error");
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ─── GET /api/admin/my-plan ───────────────────────────────────────────────────
router.get("/admin/my-plan", requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;

    if (isSuperAdmin(req)) {
      return res.json({ planKey: null, allowedApps: ALL_APP_KEYS, planName: "All Products", subscriptions: [] });
    }

    // Look up the admin's company
    const meRes = await pool.query<{ company_id: number | null }>(
      `SELECT company_id FROM users WHERE id = $1 LIMIT 1`,
      [adminUser.id]
    );
    const companyId = meRes.rows[0]?.company_id ?? null;

    // List active per-product subscriptions — company-wide when the user
    // belongs to a company, or user-level when they don't (e.g. freshly-
    // registered admin who purchased before being assigned a company record).
    const subsRes = companyId
      ? await pool.query<{
          plan_key: string;
          display_name: string;
          current_period_end: Date | null;
          status: string;
        }>(
          `SELECT us.plan_key, pc.display_name, us.current_period_end, us.status
             FROM user_subscriptions us
             JOIN users u         ON u.id = us.user_id
             JOIN plans_config pc ON pc.plan_key = us.plan_key
            WHERE u.company_id = $1
              AND us.status IN ('active','trialing')
              AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
            ORDER BY us.current_period_end NULLS LAST`,
          [companyId]
        )
      : await pool.query<{
          plan_key: string;
          display_name: string;
          current_period_end: Date | null;
          status: string;
        }>(
          `SELECT us.plan_key, pc.display_name, us.current_period_end, us.status
             FROM user_subscriptions us
             JOIN plans_config pc ON pc.plan_key = us.plan_key
            WHERE us.user_id = $1
              AND us.status IN ('active','trialing')
              AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
            ORDER BY us.current_period_end NULLS LAST`,
          [adminUser.id]
        );

    const allowedApps = companyId
      ? await resolveCompanyAllowedApps(companyId)
      : await resolveUserAllowedApps(adminUser.id);
    const planName = subsRes.rows.length === 0
      ? null
      : subsRes.rows.map(r => r.display_name).join(" + ");

    return res.json({
      planKey: subsRes.rows[0]?.plan_key ?? null,
      allowedApps,
      planName,
      subscriptions: subsRes.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/my-plan error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /api/admin/users/:id/apps ─────────────────────────────────────────
// Body: { appKey: string, action: "grant" | "revoke" }
router.patch("/admin/users/:id/apps", requireAdmin, async (req: Request, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const { appKey, action } = req.body as { appKey: string; action: "grant" | "revoke" };
    const adminUser = (req as any).adminUser;

    if (!APP_KEYS.includes(appKey)) return res.status(400).json({ error: "Invalid appKey" });
    if (!["grant", "revoke"].includes(action)) return res.status(400).json({ error: "Invalid action" });

    // Admins can only modify users in their company
    if (!isSuperAdmin(req)) {
      const check = await pool.query(
        `SELECT 1 FROM users WHERE id = $1 AND company_id = (SELECT company_id FROM users WHERE id = $2)`,
        [targetId, adminUser.id]
      );
      if (!check.rows.length) return res.status(403).json({ error: "Cannot modify users outside your company" });

      // Validate grant against the admin's plan
      if (action === "grant") {
        const allowedApps = await resolveAdminAllowedApps(adminUser.id);
        if (!allowedApps.includes(appKey)) {
          return res.status(403).json({ error: `Your current plan does not include access to ${appKey}. Please upgrade your plan.` });
        }
      }
    }

    if (action === "grant") {
      const existing = await pool.query(
        `SELECT id FROM user_app_access WHERE user_id = $1 AND app_key = $2`,
        [targetId, appKey]
      );
      if (existing.rows.length) {
        await pool.query(
          `UPDATE user_app_access SET is_active = true, granted_at = NOW(), granted_by = $3, revoked_at = NULL WHERE user_id = $1 AND app_key = $2`,
          [targetId, appKey, adminUser.id]
        );
      } else {
        await pool.query(
          `INSERT INTO user_app_access (user_id, app_key, granted_by, granted_at, is_active) VALUES ($1, $2, $3, NOW(), true)`,
          [targetId, appKey, adminUser.id]
        );
      }
      // Mirror the grant to the child app: create/link the user there (under the
      // same admin). Idempotent upsert; no password is sent (we never store
      // plaintext) so the child app keeps any existing credentials.
      void enqueueProvisionForApp(targetId, appKey, "upsert");
    } else {
      await pool.query(
        `UPDATE user_app_access SET is_active = false, revoked_at = NOW() WHERE user_id = $1 AND app_key = $2`,
        [targetId, appKey]
      );
      // Mirror the revoke to the child app: soft-remove the user from that app.
      void enqueueProvisionForApp(targetId, appKey, "delete");
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /admin/users/:id/apps error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
// Creates a regular user (not an admin).
//   - Regular admin → user is created in the admin's own company.
//   - Super admin   → must pick an admin (`adminId` required); the new user
//     inherits that admin's company_id and is recorded as created_by = admin.
router.post("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;

    const { name, email, phone, jobTitle, location, adminId, apps } = req.body as {
      name?: string; email?: string; phone?: string; jobTitle?: string;
      location?: string; adminId?: number; apps?: string[];
    };

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "Full name and email are required." });
    }

    // Resolve which company the new user belongs to:
    //  - Super admin: must pick an admin; the new user inherits that admin's company.
    //  - Regular admin: always created inside the admin's own company.
    let targetCompanyId: number | null = null;
    let owningAdminId: number = adminUser.id;

    if (isSuperAdmin(req)) {
      if (!adminId || !Number.isFinite(Number(adminId))) {
        return res.status(400).json({ error: "Please select which admin this user belongs to." });
      }
      const adminRes = await pool.query<{ id: number; company_id: number | null }>(
        `SELECT id, company_id FROM users
         WHERE id = $1 AND role = 'admin' AND deleted_at IS NULL
         LIMIT 1`,
        [Number(adminId)]
      );
      const chosenAdmin = adminRes.rows[0];
      if (!chosenAdmin) {
        return res.status(400).json({ error: "Selected admin not found." });
      }
      if (!chosenAdmin.company_id) {
        return res.status(400).json({ error: "The selected admin is not linked to a company yet." });
      }
      targetCompanyId = chosenAdmin.company_id;
      owningAdminId = chosenAdmin.id;
    } else {
      const meRes = await pool.query<{ company_id: number | null }>(
        `SELECT company_id FROM users WHERE id = $1`, [adminUser.id]
      );
      targetCompanyId = meRes.rows[0]?.company_id ?? null;
      if (!targetCompanyId) {
        return res.status(400).json({ error: "Your admin account is not linked to a company. Contact a super admin." });
      }
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]);
    if (existing.rows.length) return res.status(409).json({ error: "Email already exists." });

    const username = emailLower.split("@")[0].replace(/[^a-z0-9._-]/g, "");
    // The user will choose their own password via the invite link, so we
    // store a strong random placeholder as the bcrypt hash. A plaintext
    // copy is never persisted (temp_password stays NULL).
    const placeholderPwd = generateTempPassword();
    const hashed = await bcrypt.hash(placeholderPwd, 10);

    const result = await pool.query<{ id: number }>(`
      INSERT INTO users (name, username, email, phone, job_title, location,
                         password, role, company_id, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', $8, $9, NOW())
      RETURNING id
    `, [
      name.trim(), username, emailLower,
      phone?.trim() || null, jobTitle?.trim() || null, location?.trim() || null,
      hashed, targetCompanyId, owningAdminId,
    ]);

    const newId = result.rows[0].id;

    // Grant apps to the new user (validated against the owning admin's plan).
    //   - If the caller passed an explicit `apps` array, honour that selection
    //     (still filtered to what the admin is actually allowed to grant).
    //   - Otherwise default to granting EVERY app the admin has purchased, so
    //     users under an admin get full access by default. The admin can later
    //     revoke any app via the per-user Access controls.
    const allowedForAdmin = await resolveAdminAllowedApps(owningAdminId);
    const appsToGrant = Array.isArray(apps)
      ? apps.filter(a => APP_KEYS.includes(a) && allowedForAdmin.includes(a))
      : allowedForAdmin.filter(a => APP_KEYS.includes(a));
    for (const appKey of appsToGrant) {
      await pool.query(
        `INSERT INTO user_app_access (user_id, app_key, granted_by, granted_at, is_active)
         VALUES ($1, $2, $3, NOW(), true)
         ON CONFLICT (user_id, app_key) DO UPDATE SET is_active = true, granted_at = NOW(), granted_by = $3`,
        [newId, appKey, owningAdminId]
      );
    }

    // Issue an invite link the user clicks to choose their own password.
    let emailSent = false;
    try {
      const { rawToken } = await issueResetToken(newId, ACCOUNT_INVITE_TTL_MINUTES);
      const setupUrl = buildResetUrl(rawToken);
      await sendAccountInviteEmail({
        toEmail: emailLower,
        toName: name.trim(),
        username,
        setupUrl,
        expiresInHours: ACCOUNT_INVITE_TTL_MINUTES / 60,
      });
      await pool.query(`UPDATE users SET welcome_sent_at = NOW() WHERE id = $1`, [newId]);
      emailSent = true;
    } catch (emailErr) {
      logger.warn({ emailErr, userId: newId }, "Account-invite email failed (user still created)");
    }

    // Provision the placeholder credentials to child apps; the user will
    // re-provision with their chosen password as soon as they complete the
    // invite link, so direct login at child apps is unblocked the moment
    // they finish setup.
    void enqueueProvisionForUser(newId, "upsert", placeholderPwd);

    return res.json({
      id: newId,
      username,
      email: emailLower,
      emailSent,
    });
  } catch (err) {
    logger.error({ err }, "POST /admin/users error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/admin/products_config ──────────────────────────────────────────
router.get("/admin/products_config", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const result = await pool.query(`SELECT * FROM products_config ORDER BY sort_order`);
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/products_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/products_config ─────────────────────────────────────────
// Create a brand-new product. product_key must be unique (used as the URL
// slug and as the join key on user_subscriptions / activePlan).
router.post("/admin/products_config", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const {
      product_key, display_name, category, description, logo_url, redirect_url,
      monthly_price, discount_price, is_active, coming_soon, under_maintenance, sort_order, page_content,
    } = req.body;
    const key = String(product_key ?? "").trim().toLowerCase();
    if (!key || !/^[a-z0-9_-]+$/.test(key)) {
      return res.status(400).json({ error: "product_key must be lowercase alphanumeric (a-z, 0-9, _, -)" });
    }
    const dup = await pool.query(`SELECT 1 FROM products_config WHERE product_key=$1 LIMIT 1`, [key]);
    if (dup.rowCount && dup.rowCount > 0) {
      return res.status(409).json({ error: `Product with key '${key}' already exists` });
    }

    // If the caller didn't supply page_content (or supplied an empty one),
    // clone the first existing product's page_content so the new product
    // ships with a fully-built page out of the gate. The admin can then
    // tweak it from the Page Builder.
    let effectivePageContent = page_content;
    const hasSections =
      effectivePageContent &&
      typeof effectivePageContent === "object" &&
      Array.isArray((effectivePageContent as any).sections) &&
      (effectivePageContent as any).sections.length > 0;
    if (!hasSections) {
      const tmpl = await pool.query(
        `SELECT page_content FROM products_config
         WHERE page_content IS NOT NULL
           AND jsonb_array_length(COALESCE(page_content->'sections', '[]'::jsonb)) > 0
         ORDER BY sort_order ASC, product_key ASC
         LIMIT 1`
      );
      if (tmpl.rowCount && tmpl.rows[0]?.page_content) {
        effectivePageContent = tmpl.rows[0].page_content;
      }
    }

    // Create the product AND its matching subscription plan atomically. Products
    // and plans are paired 1:1 on the same key (plan.products = [product_key]);
    // a product is not purchasable until a plan exists. Wrapping both inserts in
    // a single transaction guarantees that pairing — if the plan insert fails we
    // roll the product back too, so we never leave an orphaned product that a
    // retry (blocked by the 409 duplicate check) could not repair.
    const planMonthly = Number.isFinite(Number(monthly_price))  ? Number(monthly_price)  : 14900;
    const planAnnual  = Number.isFinite(Number(discount_price)) ? Number(discount_price) : 12900;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO products_config
          (product_key, display_name, category, description, logo_url, redirect_url,
           monthly_price, discount_price, is_active, coming_soon, under_maintenance, sort_order, page_content, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
      `, [
        key,
        String(display_name ?? "").trim() || key,
        String(category ?? "").trim(),
        String(description ?? ""),
        String(logo_url ?? ""),
        String(redirect_url ?? ""),
        Number.isFinite(Number(monthly_price))  ? Number(monthly_price)  : 14900,
        Number.isFinite(Number(discount_price)) ? Number(discount_price) : 12900,
        is_active ?? true,
        coming_soon ?? false,
        under_maintenance ?? false,
        Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
        JSON.stringify(effectivePageContent ?? {}),
      ]);

      // ON CONFLICT DO NOTHING keeps this safe if a plan with this key somehow
      // already exists (e.g. left over from a prior product of the same key) —
      // we reuse it rather than failing. The admin can fine-tune pricing and
      // features afterward in the Plans tab.
      await client.query(`
        INSERT INTO plans_config
          (plan_key, display_name, category, monthly_price, annual_price, description,
           features, products, is_active, coming_soon, sort_order, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
        ON CONFLICT (plan_key) DO NOTHING
      `, [
        key,
        String(display_name ?? "").trim() || key,
        String(category ?? "").trim(),
        planMonthly,
        planAnnual,
        String(description ?? ""),
        JSON.stringify([]),
        JSON.stringify([key]),
        is_active ?? true,
        coming_soon ?? false,
        Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      ]);

      // Keep the Full Suite bundle in sync — a newly created live/maintenance
      // product joins it automatically; a coming soon one is excluded until it
      // goes live.
      await syncFullSuiteProducts(client);

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    return res.json({ ok: true, product_key: key, plan_key: key });
  } catch (err) {
    logger.error({ err }, "POST /admin/products_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /api/admin/products_config/:key ─────────────────────────────────────
router.put("/admin/products_config/:key", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const { key } = req.params;

    // Fetch existing row so partial updates (e.g. only coming_soon) don't null out other fields.
    const existing = await pool.query(
      `SELECT * FROM products_config WHERE product_key=$1 LIMIT 1`, [key]
    );
    if (!existing.rowCount) return res.status(404).json({ error: "Product not found" });
    const ex = existing.rows[0];

    const body = req.body ?? {};
    const display_name  = body.display_name  !== undefined ? body.display_name  : ex.display_name;
    const category      = body.category      !== undefined ? body.category      : ex.category;
    const description   = body.description   !== undefined ? body.description   : ex.description;
    const logo_url      = body.logo_url      !== undefined ? body.logo_url      : ex.logo_url;
    const redirect_url  = body.redirect_url  !== undefined ? body.redirect_url  : ex.redirect_url;
    const is_active     = body.is_active     !== undefined ? body.is_active     : ex.is_active;
    const coming_soon   = body.coming_soon   !== undefined ? body.coming_soon   : ex.coming_soon;
    const under_maintenance = body.under_maintenance !== undefined ? body.under_maintenance : ex.under_maintenance;
    const sort_order    = body.sort_order    !== undefined ? body.sort_order    : ex.sort_order;
    const monthly_price = body.monthly_price !== undefined
      ? (Number.isFinite(Number(body.monthly_price)) ? Number(body.monthly_price) : ex.monthly_price)
      : ex.monthly_price;
    const discount_price = body.discount_price !== undefined
      ? (Number.isFinite(Number(body.discount_price)) ? Number(body.discount_price) : ex.discount_price)
      : ex.discount_price;
    const page_content = body.page_content !== undefined ? body.page_content : (ex.page_content ?? {});

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        UPDATE products_config
        SET display_name=$1, category=$2, description=$3, logo_url=$4,
            redirect_url=$5, monthly_price=$6, discount_price=$7,
            is_active=$8, coming_soon=$9, under_maintenance=$10,
            sort_order=$11, page_content=$12, updated_at=NOW()
        WHERE product_key=$13
      `, [
        display_name, category, description, logo_url ?? "",
        redirect_url ?? "", monthly_price, discount_price,
        is_active, coming_soon, under_maintenance, sort_order, JSON.stringify(page_content), key,
      ]);
      // Products and plans are paired 1:1 on the same key. Mirror the product's
      // coming_soon onto its individual plan so the public Pricing page stays
      // consistent: a coming-soon product's plan becomes non-purchasable AND
      // drops out of the Full Suite price (which sums only live plans). Flip it
      // back and the plan returns to single purchase and the Full Suite total.
      await client.query(
        `UPDATE plans_config SET coming_soon=$1, updated_at=NOW() WHERE plan_key=$2`,
        [coming_soon, key],
      );
      // Toggling coming_soon adds the product to / removes it from the Full
      // Suite bundle (live + maintenance products are members, coming soon ones
      // are not).
      await syncFullSuiteProducts(client);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /admin/products_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/admin/products_config/:key ──────────────────────────────────
router.delete("/admin/products_config/:key", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const { key } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM products_config WHERE product_key=$1`, [key]);
      // Removing a product also removes it from the Full Suite bundle.
      await syncFullSuiteProducts(client);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/products_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/admin/plans_config ──────────────────────────────────────────────
router.get("/admin/plans_config", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const result = await pool.query(`SELECT * FROM plans_config ORDER BY sort_order`);
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/plans_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/plans_config ────────────────────────────────────────────
router.post("/admin/plans_config", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const {
      plan_key, display_name, category, monthly_price, annual_price,
      description, features, products, is_active, coming_soon, sort_order,
    } = req.body;
    const key = String(plan_key ?? "").trim().toLowerCase();
    if (!key || !/^[a-z0-9_-]+$/.test(key)) {
      return res.status(400).json({ error: "plan_key must be lowercase alphanumeric (a-z, 0-9, _, -)" });
    }
    const dup = await pool.query(`SELECT 1 FROM plans_config WHERE plan_key=$1 LIMIT 1`, [key]);
    if (dup.rowCount && dup.rowCount > 0) {
      return res.status(409).json({ error: `Plan with key '${key}' already exists` });
    }
    await pool.query(`
      INSERT INTO plans_config
        (plan_key, display_name, category, monthly_price, annual_price, description,
         features, products, is_active, coming_soon, sort_order, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
    `, [
      key,
      String(display_name ?? "").trim() || key,
      String(category ?? "").trim(),
      Number.isFinite(Number(monthly_price)) ? Number(monthly_price) : 0,
      Number.isFinite(Number(annual_price))  ? Number(annual_price)  : 0,
      String(description ?? ""),
      JSON.stringify(features ?? []),
      JSON.stringify(products ?? []),
      is_active ?? true,
      coming_soon ?? false,
      Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
    ]);
    return res.json({ ok: true, plan_key: key });
  } catch (err) {
    logger.error({ err }, "POST /admin/plans_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /api/admin/plans_config/:key ────────────────────────────────────────
router.put("/admin/plans_config/:key", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const { key } = req.params;

    // Fetch existing row so partial updates (e.g. only coming_soon) don't null out other fields.
    const existing = await pool.query(
      `SELECT * FROM plans_config WHERE plan_key=$1 LIMIT 1`, [key]
    );
    if (!existing.rowCount) return res.status(404).json({ error: "Plan not found" });
    const ex = existing.rows[0];

    const body = req.body ?? {};
    const display_name  = body.display_name  !== undefined ? body.display_name  : ex.display_name;
    const category      = body.category      !== undefined ? body.category      : ex.category;
    const description   = body.description   !== undefined ? body.description   : ex.description;
    const features      = body.features      !== undefined ? body.features      : ex.features;
    const products      = body.products      !== undefined ? body.products      : ex.products;
    const is_active     = body.is_active     !== undefined ? body.is_active     : ex.is_active;
    const coming_soon   = body.coming_soon   !== undefined ? body.coming_soon   : ex.coming_soon;
    const sort_order    = body.sort_order    !== undefined ? body.sort_order    : ex.sort_order;
    const monthly_price = body.monthly_price !== undefined
      ? (Number.isFinite(Number(body.monthly_price)) ? Number(body.monthly_price) : ex.monthly_price)
      : ex.monthly_price;
    const annual_price = body.annual_price !== undefined
      ? (Number.isFinite(Number(body.annual_price)) ? Number(body.annual_price) : ex.annual_price)
      : ex.annual_price;

    if (key === "fullsuite") {
      await pool.query(`
        UPDATE plans_config
        SET display_name=$1, category=$2,
            description=$3, features=$4, is_active=$5, coming_soon=$6,
            sort_order=$7, updated_at=NOW()
        WHERE plan_key=$8
      `, [
        display_name, category, description, JSON.stringify(features ?? []),
        is_active, coming_soon, sort_order, key,
      ]);
    } else {
      await pool.query(`
        UPDATE plans_config
        SET display_name=$1, category=$2, monthly_price=$3, annual_price=$4,
            description=$5, features=$6, products=$7, is_active=$8,
            coming_soon=$9, sort_order=$10, updated_at=NOW()
        WHERE plan_key=$11
      `, [
        display_name, category, monthly_price, annual_price,
        description, JSON.stringify(features ?? []), JSON.stringify(products ?? []),
        is_active, coming_soon, sort_order, key,
      ]);
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /admin/plans_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/admin/plans_config/:key ─────────────────────────────────────
router.delete("/admin/plans_config/:key", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const { key } = req.params;
    await pool.query(`DELETE FROM plans_config WHERE plan_key=$1`, [key]);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/plans_config error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/upload-logo ─────────────────────────────────────────────
// Accepts a base64-encoded image (data URL or raw base64) in JSON. Writes the
// binary to a project-local uploads dir and returns the public URL.
//
// Why JSON+base64 instead of multer? Avoids adding a new dependency. Express's
// default JSON limit (100kb) is too small for images, so we mount a 10mb-limit
// JSON parser locally on this single route.
router.post(
  "/admin/upload-logo",
  express.json({ limit: "10mb" }),
  requireAdmin,
  async (req, res) => {
    try {
      if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const { filename, dataUrl } = req.body as { filename?: string; dataUrl?: string };
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Missing dataUrl" });
      }
      // Pull the mime type out of the data URL prefix, fall back to png.
      const m = dataUrl.match(/^data:([\w/+.\-]+);base64,(.*)$/);
      let mime = "image/png";
      let b64 = dataUrl;
      if (m) {
        mime = m[1];
        b64 = m[2];
      }
      if (!/^image\//.test(mime)) {
        return res.status(400).json({ error: "Only image/* uploads are allowed" });
      }
      const buf = Buffer.from(b64, "base64");
      // Cap at ~8MB after decoding to keep static-serve sane.
      if (buf.byteLength > 8 * 1024 * 1024) {
        return res.status(413).json({ error: "Image too large (max 8MB)" });
      }
      // Pick an extension. Prefer the original filename's extension when valid
      // so SVGs stay SVGs; otherwise derive from the mime type.
      const allowedExt = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);
      const fnExt = String(filename ?? "").split(".").pop()?.toLowerCase() ?? "";
      const mimeExt = mime.split("/")[1]?.replace("+xml", "") ?? "png";
      const ext = allowedExt.has(fnExt) ? fnExt : (allowedExt.has(mimeExt) ? mimeExt : "png");

      await fsp.mkdir(UPLOADS_DIR, { recursive: true });
      const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await fsp.writeFile(path.join(UPLOADS_DIR, safe), buf);
      // Served by app.ts at /api/uploads (kept under /api so the SignSuiteIQ
      // dev-server's existing /api proxy entry handles it without extra config).
      return res.json({ ok: true, url: `/api/uploads/${safe}` });
    } catch (err) {
      logger.error({ err }, "POST /admin/upload-logo error");
      return res.status(500).json({ error: "Server error" });
    }
  }
);

// ─── POST /api/admin/upload-image ────────────────────────────────────────────
// Same base64-in-JSON pattern as upload-logo, but used by the Page Builder
// editor for screenshot/feature images. Kept as its own route so future
// per-feature limits or processing can be added without affecting the logo
// flow. Accepts any image/* mime up to ~8MB after decoding.
router.post(
  "/admin/upload-image",
  express.json({ limit: "10mb" }),
  requireAdmin,
  async (req, res) => {
    try {
      if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const { filename, dataUrl } = req.body as { filename?: string; dataUrl?: string };
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Missing dataUrl" });
      }
      const m = dataUrl.match(/^data:([\w/+.\-]+);base64,(.*)$/);
      let mime = "image/png";
      let b64 = dataUrl;
      if (m) { mime = m[1]; b64 = m[2]; }
      if (!/^image\//.test(mime)) {
        return res.status(400).json({ error: "Only image/* uploads are allowed" });
      }
      const buf = Buffer.from(b64, "base64");
      if (buf.byteLength > 8 * 1024 * 1024) {
        return res.status(413).json({ error: "Image too large (max 8MB)" });
      }
      // SVG intentionally excluded — SVGs can embed <script> and are served
      // from a same-origin static dir; rendering them via <img> can execute.
      // Screenshots are raster images anyway, so the loss is acceptable.
      if (mime === "image/svg+xml") {
        return res.status(400).json({ error: "SVG uploads are not allowed" });
      }
      const allowedExt = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
      const fnExt = String(filename ?? "").split(".").pop()?.toLowerCase() ?? "";
      const mimeExt = mime.split("/")[1] ?? "png";
      const ext = allowedExt.has(fnExt) ? fnExt : (allowedExt.has(mimeExt) ? mimeExt : "png");

      await fsp.mkdir(UPLOADS_DIR, { recursive: true });
      const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await fsp.writeFile(path.join(UPLOADS_DIR, safe), buf);
      return res.json({ ok: true, url: `/api/uploads/${safe}` });
    } catch (err) {
      logger.error({ err }, "POST /admin/upload-image error");
      return res.status(500).json({ error: "Server error" });
    }
  }
);

// ─── POST /api/admin/activate-plan ───────────────────────────────────────────
// Called by the frontend after a successful Stripe checkout. This is ADDITIVE:
// it upserts an active row in user_subscriptions for this product (with a
// 30-day current_period_end as a fallback until the Stripe webhook fires) and
// then returns the union of all active product subscriptions for the company.
// It will not extend a longer existing period — webhook-supplied dates win.
router.post("/admin/activate-plan", requireAdmin, async (req, res) => {
  const userId = (req as any).adminUser.id;
  const { planKey } = req.body as { planKey?: string };

  const VALID_PLAN_KEYS = ["installiq", "signsalesiq", "signtakeoffiq", "fullsuite"];
  if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
    return res.status(400).json({ error: "Invalid planKey" });
  }

  try {
    const userRes = await pool.query<{ company_id: number | null }>(
      `SELECT company_id FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const companyId = userRes.rows[0]?.company_id ?? null;
    // Note: we proceed even when companyId is null — the subscription row is
    // keyed by user_id and we fall back to user-level resolution below.

    // Upsert an active subscription row for this user/planKey. If a row already
    // exists with a later current_period_end (e.g. set by the Stripe webhook),
    // leave that date alone via GREATEST.
    const existing = await pool.query<{ id: number; current_period_end: Date | null }>(
      `SELECT id, current_period_end FROM user_subscriptions
        WHERE user_id = $1 AND plan_key = $2
        ORDER BY id DESC LIMIT 1`,
      [userId, planKey]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO user_subscriptions
           (user_id, plan_key, status, billing_period, current_period_start, current_period_end, created_at, updated_at)
         VALUES ($1, $2, 'active', 'monthly', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())`,
        [userId, planKey]
      );
    } else {
      await pool.query(
        `UPDATE user_subscriptions
            SET status = 'active',
                billing_period = COALESCE(billing_period, 'monthly'),
                current_period_start = COALESCE(current_period_start, NOW()),
                current_period_end = GREATEST(
                  COALESCE(current_period_end, NOW()),
                  NOW() + INTERVAL '30 days'
                ),
                updated_at = NOW()
          WHERE id = $1`,
        [existing.rows[0].id]
      );
    }

    // Keep active_plan_key roughly in sync for legacy display, but gating now
    // comes from the union below.
    try {
      await pool.query(
        `UPDATE business_details SET active_plan_key = $1 WHERE id = $2`,
        [planKey, companyId]
      );
    } catch { /* ignore */ }

    const allowedApps = companyId
      ? await resolveCompanyAllowedApps(companyId)
      : await resolveUserAllowedApps(userId);

    return res.json({ ok: true, planKey, allowedApps });
  } catch (err) {
    logger.error({ err }, "POST /admin/activate-plan error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/admin/content ───────────────────────────────────────────────────
router.get("/admin/content", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const result = await pool.query(`SELECT key, value FROM site_content ORDER BY key`);
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/content error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /api/admin/content ───────────────────────────────────────────────────
router.put("/admin/content", requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    const { key, value } = req.body as { key: string; value: string };
    if (!key) return res.status(400).json({ error: "key required" });
    await pool.query(`
      INSERT INTO site_content (key, value, updated_at) VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
    `, [key, value ?? ""]);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /admin/content error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/admin/admins ────────────────────────────────────────────────────
// Super admin only — list all admins (excluding super_admins)
router.get("/admin/admins", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    // Include each admin's purchased plans (from user_subscriptions, joined to
    // plans_config for the human-readable display name). Active subscriptions
    // are listed first, then trialing, past_due, etc. Returns NULL if the
    // admin has never purchased anything. We exclude rows where archived_at
    // IS NOT NULL so soft-removed subscription history doesn't surface.
    const result = await pool.query(`
      SELECT u.id, u.name, u.username, u.email, u.phone, u.location, u.role,
             u.company_id, u.created_at, u.temp_password, u.welcome_sent_at,
             bd.business_name AS company_name,
             bd.active_plan_key,
             (
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'plan_key',             us.plan_key,
                   'display_name',         COALESCE(pc.display_name, us.plan_key),
                   'status',               us.status,
                   'current_period_end',   us.current_period_end,
                   'cancel_at_period_end', us.cancel_at_period_end,
                   'amount_cents',         us.amount_cents,
                   'currency',             us.currency,
                   'billing_period',       us.billing_period
                 )
                 ORDER BY
                   CASE us.status
                     WHEN 'active'   THEN 0
                     WHEN 'trialing' THEN 1
                     WHEN 'past_due' THEN 2
                     WHEN 'pending'  THEN 3
                     ELSE 4
                   END,
                   pc.sort_order NULLS LAST,
                   us.created_at DESC
               )
               FROM user_subscriptions us
               LEFT JOIN plans_config pc ON pc.plan_key = us.plan_key
               WHERE us.user_id = u.id
                 AND us.archived_at IS NULL
             ) AS subscriptions,
             (
               SELECT COALESCE(jsonb_agg(g.app_key ORDER BY g.app_key), '[]'::jsonb)
               FROM admin_app_grants g
               WHERE g.admin_user_id = u.id AND g.is_active = true
             ) AS granted_apps
      FROM users u
      LEFT JOIN business_details bd ON bd.id = u.company_id
      WHERE u.role = 'admin'
        AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `);

    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/admins error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /api/admin/admins/:id/app-grants ──────────────────────────────────
// Super admin only — grant or revoke FREE access to an app for an admin (no
// paid subscription required). A granted app is unioned into the admin's (and
// their company's) allowed apps, so the admin can both launch it and grant it
// to their own users. We also give the admin their own user_app_access row so
// the product appears on their personal dashboard and is mirrored to the child
// app. Body: { appKey: string, action: "grant" | "revoke" }
router.patch("/admin/admins/:id/app-grants", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const adminId = Number(req.params.id);
    const superAdmin = (req as any).adminUser;
    const { appKey, action } = req.body as { appKey: string; action: "grant" | "revoke" };

    if (!APP_KEYS.includes(appKey)) return res.status(400).json({ error: "Invalid appKey" });
    if (!["grant", "revoke"].includes(action)) return res.status(400).json({ error: "Invalid action" });

    // Confirm the target is a real, non-deleted admin.
    const target = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'admin' AND deleted_at IS NULL LIMIT 1`,
      [adminId]
    );
    if (!target.rows.length) return res.status(404).json({ error: "Admin not found" });

    if (action === "grant") {
      await pool.query(
        `INSERT INTO admin_app_grants (admin_user_id, app_key, granted_by, granted_at, is_active)
         VALUES ($1, $2, $3, NOW(), true)
         ON CONFLICT (admin_user_id, app_key)
         DO UPDATE SET is_active = true, granted_at = NOW(), granted_by = $3, revoked_at = NULL`,
        [adminId, appKey, superAdmin.id]
      );
      // Give the admin their own launchable access + mirror to the child app.
      await pool.query(
        `INSERT INTO user_app_access (user_id, app_key, granted_by, granted_at, is_active)
         VALUES ($1, $2, $3, NOW(), true)
         ON CONFLICT (user_id, app_key)
         DO UPDATE SET is_active = true, granted_at = NOW(), granted_by = $3, revoked_at = NULL`,
        [adminId, appKey, superAdmin.id]
      );
      void enqueueProvisionForApp(adminId, appKey, "upsert");
    } else {
      await pool.query(
        `UPDATE admin_app_grants SET is_active = false, revoked_at = NOW() WHERE admin_user_id = $1 AND app_key = $2`,
        [adminId, appKey]
      );
      await pool.query(
        `UPDATE user_app_access SET is_active = false, revoked_at = NOW() WHERE user_id = $1 AND app_key = $2`,
        [adminId, appKey]
      );
    }

    // Return the admin's current free grants so the client can update in place.
    const grants = await pool.query<{ app_key: string }>(
      `SELECT app_key FROM admin_app_grants WHERE admin_user_id = $1 AND is_active = true ORDER BY app_key`,
      [adminId]
    );
    return res.json({ ok: true, grantedApps: grants.rows.map(r => r.app_key) });
  } catch (err) {
    logger.error({ err }, "PATCH /admin/admins/:id/app-grants error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/admins ───────────────────────────────────────────────────
// Super admin only — create a new admin user with a temp password + welcome email
router.post("/admin/admins", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const { name, email, phone, location, companyName } = req.body as {
      name?: string; email?: string; phone?: string; location?: string; companyName?: string;
    };

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "Full name and email are required." });
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [emailLower]
    );
    if (existing.rows.length) return res.status(409).json({ error: "Email already exists." });

    const username = emailLower.split("@")[0].replace(/[^a-z0-9._-]/g, "");
    // Placeholder hash; the admin will choose their own password via the
    // invite link. Plaintext is never persisted (temp_password stays NULL).
    const placeholderPwd = generateTempPassword();
    const hashed = await bcrypt.hash(placeholderPwd, 10);

    const result = await pool.query<{ id: number }>(`
      INSERT INTO users (name, username, email, phone, location, password, role, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'admin', NOW())
      RETURNING id
    `, [name.trim(), username, emailLower, phone?.trim() || null, location?.trim() || null, hashed]);

    const newId = result.rows[0].id;

    // If a company name was provided, create a business_details record and link it.
    if (companyName?.trim()) {
      const bdResult = await pool.query<{ id: number }>(
        `INSERT INTO business_details (business_name, admin_id) VALUES ($1, $2) RETURNING id`,
        [companyName.trim(), newId]
      );
      await pool.query(`UPDATE users SET company_id = $1 WHERE id = $2`, [bdResult.rows[0].id, newId]);
    }

    try {
      const { rawToken } = await issueResetToken(newId, ACCOUNT_INVITE_TTL_MINUTES);
      const setupUrl = buildResetUrl(rawToken);
      await sendAccountInviteEmail({
        toEmail: emailLower,
        toName: name.trim(),
        username,
        setupUrl,
        expiresInHours: ACCOUNT_INVITE_TTL_MINUTES / 60,
      });
      await pool.query(`UPDATE users SET welcome_sent_at = NOW() WHERE id = $1`, [newId]);
    } catch (emailErr) {
      logger.warn({ emailErr, userId: newId }, "Account-invite email failed (admin still created)");
    }

    void enqueueProvisionForUser(newId, "upsert", placeholderPwd);

    return res.json({ id: newId, username, email: emailLower });
  } catch (err) {
    logger.error({ err }, "POST /admin/admins error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /api/admin/users/:id ──────────────────────────────────────────────
// Update a non-admin user's profile fields. Super admins can edit any user;
// regular admins can only edit users in their own company.
router.patch("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { name, username, phone, location, job_title } = req.body as {
      name?: string; username?: string; phone?: string; location?: string; job_title?: string;
    };

    if (!name?.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }

    // Make sure the user exists, is not archived, and is not an admin
    const existing = await pool.query(
      `SELECT id, role, company_id, username FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "User not found" });
    if (existing.rows[0].role === "admin") {
      return res.status(400).json({ error: "Use the admin edit endpoint for admins." });
    }

    // Permission: non-super admins can only edit users from their own company
    if (!isSuperAdmin(req)) {
      const requesterCompanyId = (req as any).user?.company_id ?? null;
      if (!requesterCompanyId || requesterCompanyId !== existing.rows[0].company_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Username uniqueness check (case-insensitive) when changed
    let usernameToSave: string = existing.rows[0].username;
    if (typeof username === "string" && username.trim()) {
      const u = username.trim();
      if (u.toLowerCase() !== String(existing.rows[0].username || "").toLowerCase()) {
        const dupU = await pool.query(
          `SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2 LIMIT 1`,
          [u.toLowerCase(), id]
        );
        if (dupU.rows.length) return res.status(409).json({ error: "Username already in use." });
        usernameToSave = u;
      }
    }

    await pool.query(
      `UPDATE users
         SET name = $1,
             username = $2,
             phone = $3,
             location = $4,
             job_title = $5
       WHERE id = $6`,
      [
        name.trim(),
        usernameToSave,
        phone?.trim() || null,
        location?.trim() || null,
        job_title?.trim() || null,
        id,
      ]
    );

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /admin/users/:id error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /api/admin/admins/:id ──────────────────────────────────────────────
// Super admin only — update an admin's profile fields
router.patch("/admin/admins/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { name, username, phone, location } = req.body as {
      name?: string; username?: string; phone?: string; location?: string;
    };

    if (!name?.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }

    // Make sure the admin exists and is not archived
    const existing = await pool.query(
      `SELECT id, username FROM users WHERE id = $1 AND role = 'admin' AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Admin not found" });

    // Username uniqueness check (case-insensitive) when changed
    let usernameToSave: string = existing.rows[0].username;
    if (typeof username === "string" && username.trim()) {
      const u = username.trim();
      if (u.toLowerCase() !== String(existing.rows[0].username || "").toLowerCase()) {
        const dupU = await pool.query(
          `SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2 LIMIT 1`,
          [u.toLowerCase(), id]
        );
        if (dupU.rows.length) return res.status(409).json({ error: "Username already in use." });
        usernameToSave = u;
      }
    }

    await pool.query(
      `UPDATE users
         SET name = $1,
             username = $2,
             phone = $3,
             location = $4
       WHERE id = $5`,
      [name.trim(), usernameToSave, phone?.trim() || null, location?.trim() || null, id]
    );

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /admin/admins/:id error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/admin/admins/:id ─────────────────────────────────────────────
// Super admin only — soft delete (move admin to archive)
router.delete("/admin/admins/:id", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    // Soft-delete the admin AND cascade-archive every other (non super_admin)
    // user in the same company, tagging them with cascade_deleted_by = adminId
    // so they can be auto-restored when the admin is restored. Direct-archive
    // of the admin clears its OWN cascade_deleted_by so any stale tag from a
    // previous cascade can never trigger an unintended auto-restore later.
    await client.query("BEGIN");
    try {
      const t = await client.query<{ company_id: number | null }>(
        `SELECT company_id FROM users
          WHERE id = $1 AND role = 'admin' AND deleted_at IS NULL
          FOR UPDATE`,
        [id]
      );
      if (!t.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Admin not found" });
      }
      const companyId = t.rows[0].company_id;

      await client.query(
        `UPDATE users SET deleted_at = NOW(), cascade_deleted_by = NULL WHERE id = $1`,
        [id]
      );

      let cascaded = 0;
      let cascadedIds: number[] = [];
      if (companyId != null) {
        const r = await client.query<{ id: number }>(
          `UPDATE users
              SET deleted_at = NOW(),
                  cascade_deleted_by = $1
            WHERE company_id = $2
              AND id <> $1
              AND deleted_at IS NULL
              AND role <> 'super_admin'
            RETURNING id`,
          [id, companyId]
        );
        cascadedIds = r.rows.map(x => x.id);
        cascaded = cascadedIds.length;
      }

      await client.query("COMMIT");
      void enqueueProvisionForUser(id, "delete");
      for (const cid of cascadedIds) void enqueueProvisionForUser(cid, "delete");
      return res.json({ ok: true, cascaded });
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    }
  } catch (err) {
    logger.error({ err }, "DELETE /admin/admins/:id error");
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ─── GET /api/admin/admins/archived ───────────────────────────────────────────
// Super admin only — list soft-deleted admins
router.get("/admin/admins/archived", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    // Mirror the active /admin/admins query so archived admins also surface
    // their purchased plans — useful context for the super admin when deciding
    // whether to restore or permanently delete an archived account.
    const result = await pool.query(`
      SELECT u.id, u.name, u.username, u.email, u.phone, u.location, u.role,
             u.company_id, u.created_at, u.deleted_at, u.temp_password,
             bd.business_name AS company_name,
             bd.active_plan_key,
             (
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'plan_key',             us.plan_key,
                   'display_name',         COALESCE(pc.display_name, us.plan_key),
                   'status',               us.status,
                   'current_period_end',   us.current_period_end,
                   'cancel_at_period_end', us.cancel_at_period_end,
                   'amount_cents',         us.amount_cents,
                   'currency',             us.currency,
                   'billing_period',       us.billing_period
                 )
                 ORDER BY
                   CASE us.status
                     WHEN 'active'   THEN 0
                     WHEN 'trialing' THEN 1
                     WHEN 'past_due' THEN 2
                     WHEN 'pending'  THEN 3
                     ELSE 4
                   END,
                   pc.sort_order NULLS LAST,
                   us.created_at DESC
               )
               FROM user_subscriptions us
               LEFT JOIN plans_config pc ON pc.plan_key = us.plan_key
               WHERE us.user_id = u.id
                 AND us.archived_at IS NULL
             ) AS subscriptions
      FROM users u
      LEFT JOIN business_details bd ON bd.id = u.company_id
      WHERE u.role = 'admin'
        AND u.deleted_at IS NOT NULL
      ORDER BY u.deleted_at DESC
    `);

    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/admins/archived error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/admins/:id/restore ───────────────────────────────────────
// Super admin only — restore archived admin
router.post("/admin/admins/:id/restore", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    // Restore the admin (also clearing its own cascade_deleted_by so any stale
    // tag from a previous cascade is wiped) AND auto-restore every user tagged
    // with cascade_deleted_by = adminId. Independently archived users
    // (cascade_deleted_by IS NULL) stay archived.
    await client.query("BEGIN");
    try {
      const r = await client.query(
        `UPDATE users SET deleted_at = NULL, cascade_deleted_by = NULL
          WHERE id = $1 AND role = 'admin' AND deleted_at IS NOT NULL`,
        [id]
      );
      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Archived admin not found" });
      }

      const r2 = await client.query<{ id: number }>(
        `UPDATE users
            SET deleted_at = NULL,
                cascade_deleted_by = NULL
          WHERE cascade_deleted_by = $1
            AND deleted_at IS NOT NULL
          RETURNING id`,
        [id]
      );
      const restoredIds = r2.rows.map(x => x.id);

      await client.query("COMMIT");
      void enqueueProvisionForUser(id, "upsert");
      for (const rid of restoredIds) void enqueueProvisionForUser(rid, "upsert");
      return res.json({ ok: true, restored: restoredIds.length });
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    }
  } catch (err) {
    logger.error({ err }, "POST /admin/admins/:id/restore error");
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/admin/admins/:id/permanent ───────────────────────────────────
// Super admin only — permanently delete an archived admin (hard delete)
router.delete("/admin/admins/:id/permanent", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    // Only allow permanent deletion of already-archived admins (safety)
    const check = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'admin' AND deleted_at IS NOT NULL LIMIT 1`,
      [id]
    );
    if (!check.rows.length) {
      return res.status(400).json({ error: "Admin must be archived before permanent deletion" });
    }

    // Best-effort cleanup of dependent rows (ignore errors if tables/cols don't exist)
    try { await pool.query(`DELETE FROM user_app_access WHERE user_id = $1`, [id]); } catch {}
    try { await pool.query(`DELETE FROM user_subscriptions WHERE user_id = $1`, [id]); } catch {}

    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/admins/:id/permanent error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/admins/:id/resend-welcome ────────────────────────────────
// Super admin only — resend the welcome email using the stored temp_password
router.post("/admin/admins/:id/resend-welcome", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const r = await pool.query<{
      name: string; username: string; email: string | null;
    }>(
      `SELECT name, username, email FROM users WHERE id = $1 AND role = 'admin' LIMIT 1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Admin not found" });

    const u = r.rows[0];
    if (!u.email) return res.status(400).json({ error: "Admin has no email on file" });

    const { rawToken } = await issueResetToken(id, ACCOUNT_INVITE_TTL_MINUTES);
    const setupUrl = buildResetUrl(rawToken);

    await sendAccountInviteEmail({
      toEmail:  u.email,
      toName:   u.name,
      username: u.username,
      setupUrl,
      expiresInHours: ACCOUNT_INVITE_TTL_MINUTES / 60,
    });
    await pool.query(`UPDATE users SET welcome_sent_at = NOW() WHERE id = $1`, [id]);

    return res.json({ ok: true, welcome_sent_at: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "POST /admin/admins/:id/resend-welcome error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Super Admin: Payment Transactions History ────────────────────────────────
// Lists every admin plan purchase recorded in `user_subscriptions`, joined to
// `users` (admin name/email) and `plans_config` (plan label). Supports search,
// status/method/date-range filters, sorting, and pagination — all done in SQL
// so the table remains responsive even with thousands of rows.
router.get("/admin/transactions", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const search       = String(req.query.search ?? "").trim();
    const status       = String(req.query.status ?? "").trim();      // active|trialing|past_due|canceled|incomplete|all
    const method       = String(req.query.method ?? "").trim();      // visa|mastercard|amex|... or "all"
    const dateFrom     = String(req.query.dateFrom ?? "").trim();    // YYYY-MM-DD
    const dateTo       = String(req.query.dateTo ?? "").trim();
    // archived="1"/"true"  → archive view (only soft-deleted rows)
    // archived="all"       → both
    // anything else        → active view (default; only non-archived rows)
    const archivedRaw  = String(req.query.archived ?? "").trim().toLowerCase();
    const archivedView = archivedRaw === "1" || archivedRaw === "true";
    const archivedAll  = archivedRaw === "all";

    // Reject obviously malformed date inputs up-front so Postgres doesn't
    // throw a 500 on a bad ::date cast. We accept the empty string (no filter)
    // and strict YYYY-MM-DD only.
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFrom && !ISO_DATE.test(dateFrom)) {
      return res.status(400).json({ error: "Invalid dateFrom (expected YYYY-MM-DD)" });
    }
    if (dateTo && !ISO_DATE.test(dateTo)) {
      return res.status(400).json({ error: "Invalid dateTo (expected YYYY-MM-DD)" });
    }
    const sortBy       = String(req.query.sortBy ?? "date").trim();  // date|amount|status
    const sortDir      = String(req.query.sortDir ?? "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC";
    const page         = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize     = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
    const offset       = (page - 1) * pageSize;

    const where: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      where.push(`(
        LOWER(u.name)               LIKE LOWER($${p}) OR
        LOWER(u.email)              LIKE LOWER($${p}) OR
        LOWER(us.stripe_session_id) LIKE LOWER($${p}) OR
        LOWER(us.stripe_subscription_id) LIKE LOWER($${p}) OR
        LOWER(us.plan_key)          LIKE LOWER($${p}) OR
        LOWER(COALESCE(pc.display_name,'')) LIKE LOWER($${p})
      )`);
      params.push(`%${search}%`);
      p++;
    }
    if (status && status !== "all") {
      where.push(`us.status = $${p}`);
      params.push(status);
      p++;
    }
    if (method && method !== "all") {
      where.push(`LOWER(COALESCE(us.payment_method_brand,'')) = LOWER($${p})`);
      params.push(method);
      p++;
    }
    if (dateFrom) {
      where.push(`us.created_at >= $${p}::date`);
      params.push(dateFrom);
      p++;
    }
    if (dateTo) {
      // Inclusive end-of-day: add one day, exclusive upper bound.
      where.push(`us.created_at < ($${p}::date + INTERVAL '1 day')`);
      params.push(dateTo);
      p++;
    }
    // Archive scope (default = active only). Stays out of the param list so
    // we don't have to renumber if filters change order.
    if (!archivedAll) {
      where.push(archivedView ? `us.archived_at IS NOT NULL` : `us.archived_at IS NULL`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sortColMap: Record<string, string> = {
      date:   "us.created_at",
      amount: "us.amount_cents",
      status: "us.status",
    };
    const orderCol = sortColMap[sortBy] ?? "us.created_at";

    // Total count for pagination (with same filters but no ORDER/LIMIT).
    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM user_subscriptions us
        JOIN users        u  ON u.id = us.user_id
        LEFT JOIN plans_config pc ON pc.plan_key = us.plan_key
       ${whereSql}
    `;
    const totalRes = await pool.query<{ total: number }>(countSql, params);
    const total = totalRes.rows[0]?.total ?? 0;

    const dataSql = `
      SELECT
        us.id,
        us.stripe_session_id        AS transaction_id,
        us.stripe_subscription_id   AS subscription_id,
        us.stripe_customer_id       AS customer_id,
        us.plan_key,
        COALESCE(pc.display_name, us.plan_key) AS plan_name,
        us.amount_cents,
        us.currency,
        us.status,
        us.billing_period,
        us.payment_method_brand,
        us.payment_method_last4,
        us.receipt_url,
        us.current_period_start,
        us.current_period_end,
        us.cancel_at_period_end,
        us.created_at,
        us.archived_at,
        u.id    AS user_id,
        u.name  AS admin_name,
        u.email AS admin_email,
        u.role  AS admin_role
      FROM user_subscriptions us
      JOIN users        u  ON u.id = us.user_id
      LEFT JOIN plans_config pc ON pc.plan_key = us.plan_key
      ${whereSql}
      ORDER BY ${orderCol} ${sortDir} NULLS LAST, us.id ${sortDir}
      LIMIT $${p} OFFSET $${p + 1}
    `;
    const dataRes = await pool.query(dataSql, [...params, pageSize, offset]);

    // Aggregate stats (across ALL filtered rows, not just this page) for the
    // header tiles. Cheap because the same WHERE filters apply.
    const statsSql = `
      SELECT
        COALESCE(SUM(us.amount_cents) FILTER (WHERE us.status IN ('active','trialing')), 0)::bigint AS gross_active_cents,
        COALESCE(SUM(us.amount_cents), 0)::bigint AS gross_all_cents,
        COUNT(*) FILTER (WHERE us.status = 'active')        ::int AS count_active,
        COUNT(*) FILTER (WHERE us.status = 'past_due')      ::int AS count_past_due,
        COUNT(*) FILTER (WHERE us.status = 'canceled')      ::int AS count_canceled,
        COUNT(*)                                            ::int AS count_total
      FROM user_subscriptions us
      JOIN users        u  ON u.id = us.user_id
      LEFT JOIN plans_config pc ON pc.plan_key = us.plan_key
      ${whereSql}
    `;
    const statsRes = await pool.query(statsSql, params);

    return res.json({
      data: dataRes.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: statsRes.rows[0] ?? null,
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/transactions error");
    return res.status(500).json({ error: "Server error" });
  }
});

// Detail view — returns the same row plus a few enriched Stripe fields.
// Looked up on demand so the list endpoint stays fast.
router.get("/admin/transactions/:id", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const result = await pool.query(
      `SELECT
         us.*,
         u.name  AS admin_name,
         u.email AS admin_email,
         u.role  AS admin_role,
         u.username AS admin_username,
         COALESCE(pc.display_name, us.plan_key) AS plan_name,
         pc.products AS plan_products
       FROM user_subscriptions us
       JOIN users        u  ON u.id = us.user_id
       LEFT JOIN plans_config pc ON pc.plan_key = us.plan_key
       WHERE us.id = $1
       LIMIT 1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ err }, "GET /admin/transactions/:id error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/transactions/:id/archive ──────────────────────────────
// Super admin only — soft-delete a payment row. Hides it from the default
// Payments view; it appears in the "Archived" view where it can be restored
// or permanently deleted.
router.post("/admin/transactions/:id/archive", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const r = await pool.query(
      `UPDATE user_subscriptions SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL`,
      [id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Transaction not found or already archived" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /admin/transactions/:id/archive error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/transactions/:id/restore ──────────────────────────────
// Super admin only — un-archive a payment row.
router.post("/admin/transactions/:id/restore", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const r = await pool.query(
      `UPDATE user_subscriptions SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL`,
      [id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Archived transaction not found" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /admin/transactions/:id/restore error");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/admin/transactions/:id/permanent ──────────────────────────
// Super admin only — permanently delete a payment row. Safety: must be
// archived first. Mirrors the admin/admins permanent-delete pattern.
router.delete("/admin/transactions/:id/permanent", requireAdmin, async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    // Atomic check-and-delete: a single statement that only deletes when the
    // row is currently archived. Avoids the TOCTOU race where a concurrent
    // restore could slip in between a separate SELECT + DELETE.
    const del = await pool.query(
      `DELETE FROM user_subscriptions WHERE id = $1 AND archived_at IS NOT NULL RETURNING id`,
      [id],
    );
    if (!del.rowCount) {
      // Disambiguate: does the row exist at all, or is it just not archived?
      const exists = await pool.query(`SELECT id FROM user_subscriptions WHERE id = $1`, [id]);
      if (!exists.rows.length) return res.status(404).json({ error: "Transaction not found" });
      return res.status(400).json({ error: "Transaction must be archived before permanent deletion" });
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/transactions/:id/permanent error");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
