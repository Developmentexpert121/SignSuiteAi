import { Router, type IRouter } from 'express';
import crypto from 'node:crypto';
import { pool } from '@workspace/db';
import { logger } from '../lib/logger';
import {
  issueWidgetToken,
  widgetTokenFromAuthHeader,
  WIDGET_TOKEN_TTL_SECONDS,
} from '../lib/widgetToken';
import { isSameOriginPortalRequest } from '../lib/widgetCors';

const router: IRouter = Router();

const CODE_TTL_SECONDS = 60;
const VALID_APPS = new Set(['installiq', 'signsalesiq', 'signtakeoffiq']);

function getRequestIp(req: any): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  return fwd.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

/**
 * Per-app shared secret used to authenticate the product app's backend
 * when it calls /sso/exchange. Configure as env vars:
 *   SSO_SECRET_INSTALLIQ, SSO_SECRET_SIGNSALESIQ, SSO_SECRET_SIGNTAKEOFFIQ
 *
 * If no secret is configured for an app, exchange is rejected — secure by
 * default. The matching product app must include the secret in its server-
 * to-server request body.
 */
function expectedSecretFor(appKey: string): string | undefined {
  const envName = `SSO_SECRET_${appKey.toUpperCase()}`;
  const v = process.env[envName];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Best-effort cleanup of expired or used SSO codes. Runs lazily on each
 * issue call. Bounded delete to avoid long-running queries on large tables.
 */
async function pruneExpiredCodes(): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM sso_codes
        WHERE code IN (
          SELECT code FROM sso_codes
           WHERE expires_at < NOW() - INTERVAL '1 hour'
              OR used_at  < NOW() - INTERVAL '1 hour'
           LIMIT 500
        )`,
    );
  } catch (err) {
    logger.warn({ err }, 'sso_codes prune failed');
  }
}

/**
 * POST /api/sso/issue
 * Body: { appKey: string, returnTo?: string }
 * Headers: X-User-Id (the logged-in SignSuiteIQ user)
 *
 * Mints a single-use, 60-second SSO code for the given user + product app
 * and returns the redirect URL the browser should be sent to. The receiving
 * product app is expected to expose a `/sso/callback?code=...` route.
 */
router.post('/sso/issue', async (req, res) => {
  try {
    // Identity is resolved from EITHER an Authorization: Bearer <widget_token>
    // (used by the embedded app-switcher widget on child-app domains, where
    // we cannot trust an arbitrary X-User-Id) OR the legacy X-User-Id header
    // sent by the SignSuiteIQ dashboard itself (same-origin, behind the
    // standard requireUser middleware on other routes).
    // Prefer a verified widget bearer token. If one is present and valid,
    // we MUST also confirm the user's current widget_token_version matches
    // the version baked into the token — that's how a "revoke all tokens"
    // action takes effect immediately. The legacy X-User-Id header is only
    // honored for requests originating from a trusted portal origin (the
    // SignSuiteIQ dashboard itself); browsers on child-app or third-party
    // origins cannot forge an SSO code by passing X-User-Id.
    let userId = 0;
    const widgetPayload = widgetTokenFromAuthHeader(req.headers['authorization']);
    if (widgetPayload) {
      const tvQ = await pool.query<{ widget_token_version: number }>(
        `SELECT widget_token_version FROM users WHERE id = $1`,
        [widgetPayload.uid],
      );
      if (tvQ.rowCount === 0 || tvQ.rows[0].widget_token_version !== widgetPayload.tv) {
        return res.status(401).json({ error: 'Token revoked' });
      }
      userId = widgetPayload.uid;
    } else if (isSameOriginPortalRequest(req)) {
      const userIdHeader = req.headers['x-user-id'];
      const userIdRaw = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
      const parsed = Number(userIdRaw);
      if (parsed && !Number.isNaN(parsed)) userId = parsed;
    }
    if (!userId) {
      return res.status(401).json({ error: 'Not signed in' });
    }

    const { appKey, returnTo } = req.body ?? {};
    if (!appKey || typeof appKey !== 'string' || !VALID_APPS.has(appKey)) {
      return res.status(400).json({ error: 'Invalid appKey' });
    }

    // Confirm the user actually exists and isn't archived/deleted.
    const userQ = await pool.query(
      `SELECT id, role FROM users
       WHERE id = $1 AND deleted_at IS NULL AND archived_at IS NULL`,
      [userId],
    );
    if (userQ.rowCount === 0) {
      return res.status(401).json({ error: 'Account not available' });
    }
    const role = userQ.rows[0].role as string;

    // Entitlement check. Super admins always pass; everyone else needs
    // either an active access grant or an active subscription whose plan
    // includes this app.
    if (role !== 'super_admin') {
      const accessQ = await pool.query(
        `SELECT 1 FROM user_app_access
         WHERE user_id = $1 AND app_key = $2 AND is_active = TRUE
         LIMIT 1`,
        [userId, appKey],
      );
      let entitled = (accessQ.rowCount ?? 0) > 0;

      if (!entitled) {
        const subQ = await pool.query(
          `SELECT s.plan_key, p.products
             FROM user_subscriptions s
             LEFT JOIN plans_config p ON p.plan_key = s.plan_key
            WHERE s.user_id = $1
              AND s.status IN ('active', 'trialing')
            ORDER BY s.updated_at DESC`,
          [userId],
        );
        for (const row of subQ.rows) {
          const products = Array.isArray(row.products) ? row.products : [];
          if (products.includes(appKey)) { entitled = true; break; }
        }
      }

      if (!entitled) {
        return res.status(403).json({ error: 'Not entitled to this app' });
      }
    }

    // Look up the configured product redirect URL.
    const prodQ = await pool.query(
      `SELECT redirect_url, coming_soon, under_maintenance FROM products_config WHERE product_key = $1 LIMIT 1`,
      [appKey],
    );
    // Coming-soon products are not launchable. Super admins may still launch
    // for pre-launch testing; everyone else is blocked.
    if (prodQ.rows[0]?.coming_soon === true && role !== 'super_admin') {
      return res.status(403).json({ error: 'This app is coming soon and not yet available.' });
    }
    // Products under maintenance are temporarily not launchable. Super admins
    // may still launch to verify the fix; everyone else is blocked.
    if (prodQ.rows[0]?.under_maintenance === true && role !== 'super_admin') {
      return res.status(503).json({ error: 'This app is temporarily under maintenance. Please try again later.' });
    }
    const baseUrl = String(prodQ.rows[0]?.redirect_url ?? '').trim();
    if (!baseUrl) {
      return res.status(500).json({
        error: `No redirect_url configured for ${appKey}. Set it in products_config.`,
      });
    }

    // Opportunistic prune (fire-and-forget; don't block the request).
    void pruneExpiredCodes();

    // Mint the code.
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);
    await pool.query(
      `INSERT INTO sso_codes (code, user_id, app_key, expires_at, issued_ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [code, userId, appKey, expiresAt, getRequestIp(req)],
    );

    // Build the redirect URL: <product base>/sso/callback?code=...
    let redirectBase: URL;
    try { redirectBase = new URL(baseUrl); }
    catch {
      return res.status(500).json({ error: `Invalid redirect_url for ${appKey}` });
    }
    const callback = new URL('/sso/callback', redirectBase);
    callback.searchParams.set('code', code);
    if (returnTo && typeof returnTo === 'string') {
      callback.searchParams.set('returnTo', returnTo);
    }

    return res.json({
      redirectUrl: callback.toString(),
      expiresInSeconds: CODE_TTL_SECONDS,
    });
  } catch (err) {
    logger.error({ err }, 'sso/issue failed');
    return res.status(500).json({ error: 'Failed to mint SSO code' });
  }
});

/**
 * POST /api/sso/exchange
 * Body: { code: string }
 *
 * Called from a product app's backend (NOT the browser) to redeem a code
 * for the user identity. Returns 400 on any problem to avoid leaking which
 * codes ever existed.
 */
router.post('/sso/exchange', async (req, res) => {
  try {
    const { code, clientId } = req.body ?? {};

    // Accept the shared secret via any of (in priority order):
    //   1. X-App-Secret header              (PREFERRED — bypasses Replit's
    //      Deployments WAF, which silently 504s on /api/sso/exchange when
    //      the request contains an Authorization header OR a JSON body
    //      field literally named "clientSecret")
    //   2. clientSecret body field          (legacy — works locally and on
    //      hosts without the WAF; will 504 on Replit Deployments)
    //   3. Authorization: Bearer <secret>   (legacy — same WAF caveat)
    const xAppHeader = req.headers['x-app-secret'];
    const xAppStr = Array.isArray(xAppHeader) ? xAppHeader[0] : xAppHeader;
    const xApp = typeof xAppStr === 'string' ? xAppStr.trim() : '';

    const authHeader = req.headers['authorization'];
    const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearer = typeof authStr === 'string' && authStr.toLowerCase().startsWith('bearer ')
      ? authStr.slice(7).trim()
      : '';

    const bodySecret = typeof req.body?.clientSecret === 'string' ? req.body.clientSecret : '';

    // Body-first within the legacy options so an unrelated Authorization
    // header from an HTTP client can't silently override a valid legacy call.
    const presentedSecret = xApp || bodySecret || bearer;

    if (!code || typeof code !== 'string' || code.length < 32) {
      return res.status(400).json({ error: 'Invalid code' });
    }
    if (!clientId || typeof clientId !== 'string' || !VALID_APPS.has(clientId)) {
      return res.status(400).json({ error: 'Invalid clientId' });
    }
    if (!presentedSecret) {
      return res.status(401).json({ error: 'Missing client secret' });
    }

    // Verify the calling app's shared secret. If no secret is configured
    // for this app on the server, reject — secure by default.
    const expected = expectedSecretFor(clientId);
    if (!expected) {
      logger.error({ clientId }, 'sso/exchange rejected: no SSO_SECRET_* configured for app');
      return res.status(503).json({ error: 'SSO not configured for this app' });
    }
    if (!timingSafeEqual(presentedSecret, expected)) {
      return res.status(401).json({ error: 'Invalid client secret' });
    }

    // Atomic single-use redemption: only the first caller wins, and the
    // claimed clientId must match the app the code was minted for.
    const upd = await pool.query(
      `UPDATE sso_codes
          SET used_at = NOW(), exchanged_ip = $3
        WHERE code = $1
          AND app_key = $2
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING user_id, app_key`,
      [code, clientId, getRequestIp(req)],
    );

    if (upd.rowCount === 0) {
      return res.status(400).json({ error: 'Code is invalid, expired, or already used' });
    }

    const { user_id: userId, app_key: appKey } = upd.rows[0];

    const userQ = await pool.query(
      `SELECT id, name, username, email, phone, role, company_id, widget_token_version
         FROM users
        WHERE id = $1 AND deleted_at IS NULL AND archived_at IS NULL`,
      [userId],
    );
    if (userQ.rowCount === 0) {
      return res.status(400).json({ error: 'Code is invalid, expired, or already used' });
    }
    const u = userQ.rows[0];

    // Mint a short-lived widget token so the child app can embed the
    // app-switcher and call /sso/me/apps + /sso/issue from the browser
    // without us having to trust its X-User-Id header. The token carries
    // the user's current widget_token_version so it can be revoked by
    // bumping that column.
    const { token: widgetToken, expiresInSeconds: widgetTokenExpiresIn } = issueWidgetToken(
      u.id,
      appKey,
      Number(u.widget_token_version ?? 1),
    );

    return res.json({
      appKey,
      user: {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: u.phone,
        role: u.role,
        companyId: u.company_id,
      },
      widgetToken,
      widgetTokenExpiresIn,
    });
  } catch (err) {
    logger.error({ err }, 'sso/exchange failed');
    return res.status(500).json({ error: 'Failed to exchange code' });
  }
});

/**
 * GET /api/sso/me/apps
 * Auth: Authorization: Bearer <widget_token>
 *
 * Returns the user identity (from the widget token) plus two lists:
 *   - apps:    products this user can launch (entitlement-checked)
 *   - locked:  products in the public catalog the user does NOT have
 * Both lists are scoped to the same public product catalog returned by
 * /api/public/products, so the widget never reveals products that are not
 * publicly visible. Used by the embeddable app-switcher widget the child
 * apps drop in via `<script src="…/widget/app-switcher.js">`.
 */
router.get('/sso/me/apps', async (req, res) => {
  try {
    const payload = widgetTokenFromAuthHeader(req.headers['authorization']);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userQ = await pool.query(
      `SELECT id, name, email, role, widget_token_version
         FROM users
        WHERE id = $1 AND deleted_at IS NULL AND archived_at IS NULL`,
      [payload.uid],
    );
    if (userQ.rowCount === 0) {
      return res.status(401).json({ error: 'Account not available' });
    }
    const user = userQ.rows[0];
    // Reject tokens that have been revoked (version bumped).
    if (Number(user.widget_token_version ?? 1) !== payload.tv) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    const role = user.role as string;

    // Build the entitlement set the same way /sso/issue does so the widget
    // and the launch click can never disagree.
    const entitled = new Set<string>();
    if (role === 'super_admin') {
      for (const k of VALID_APPS) entitled.add(k);
    } else {
      const accessQ = await pool.query<{ app_key: string }>(
        `SELECT app_key FROM user_app_access
          WHERE user_id = $1 AND is_active = TRUE`,
        [payload.uid],
      );
      for (const row of accessQ.rows) entitled.add(row.app_key);

      const subQ = await pool.query<{ products: string[] }>(
        `SELECT p.products
           FROM user_subscriptions s
           LEFT JOIN plans_config p ON p.plan_key = s.plan_key
          WHERE s.user_id = $1
            AND s.status IN ('active', 'trialing')`,
        [payload.uid],
      );
      for (const row of subQ.rows) {
        const products = Array.isArray(row.products) ? row.products : [];
        for (const k of products) entitled.add(k);
      }
    }

    // Public product catalog — same source as /api/public/products so the
    // widget can only ever surface products that are publicly visible.
    const productsQ = await pool.query<{
      product_key: string;
      display_name: string;
      category: string;
      description: string;
      logo_url: string | null;
      redirect_url: string | null;
      sort_order: number;
      coming_soon: boolean;
      under_maintenance: boolean;
    }>(
      `SELECT product_key, display_name, category, description, logo_url, redirect_url, sort_order, coming_soon, under_maintenance
         FROM products_config
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, display_name ASC`,
    );

    interface AppTile {
      key: string;
      label: string;
      category: string;
      description: string;
      logoUrl: string | null;
      fallbackUrl: string | null;
      upgradeUrl?: string;
      comingSoon?: boolean;
      underMaintenance?: boolean;
    }
    const portalBase = (process.env.SIGNSUITEIQ_PUBLIC_URL || "https://signsuiteiq.ai").replace(/\/+$/, "");
    const apps: AppTile[] = [];
    const locked: AppTile[] = [];
    for (const p of productsQ.rows) {
      if (!VALID_APPS.has(p.product_key)) continue;
      const tile: AppTile = {
        key: p.product_key,
        label: p.display_name,
        category: p.category,
        description: p.description,
        logoUrl: p.logo_url ?? null,
        fallbackUrl: p.redirect_url ?? null,
      };
      if (p.under_maintenance === true) tile.underMaintenance = true;
      if (p.coming_soon === true) {
        // Coming-soon products are surfaced but not launchable or purchasable.
        tile.comingSoon = true;
        locked.push(tile);
      } else if (entitled.has(p.product_key)) {
        apps.push(tile);
      } else {
        // Deep-link to the product's marketing/pricing page on SignSuiteIQ
        // so the user can purchase access right from the widget.
        tile.upgradeUrl = `${portalBase}/products/${encodeURIComponent(p.product_key)}`;
        locked.push(tile);
      }
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        currentApp: payload.app,
      },
      apps,
      locked,
      portalUrl: process.env.SIGNSUITEIQ_PUBLIC_URL || null,
      widgetTokenExpiresAt: payload.exp * 1000,
      widgetTokenTtlSeconds: WIDGET_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    logger.error({ err }, 'sso/me/apps failed');
    return res.status(500).json({ error: 'Failed to load apps' });
  }
});

/**
 * POST /api/sso/me/revoke
 * Auth: Authorization: Bearer <widget_token>
 *
 * Revokes EVERY outstanding widget token for the calling user by bumping
 * their `widget_token_version`. The next /sso/me/apps or /sso/issue call
 * with the old token will get a 401. The user must redo the SSO loop to
 * get a fresh token. This is the "sign out everywhere" primitive.
 */
router.post('/sso/me/revoke', async (req, res) => {
  try {
    const payload = widgetTokenFromAuthHeader(req.headers['authorization']);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const upd = await pool.query<{ widget_token_version: number }>(
      `UPDATE users
          SET widget_token_version = widget_token_version + 1
        WHERE id = $1
          AND widget_token_version = $2
          AND deleted_at IS NULL
        RETURNING widget_token_version`,
      [payload.uid, payload.tv],
    );
    if (upd.rowCount === 0) {
      // Either user not found OR already revoked from another tab — both
      // are effectively success from the caller's point of view.
      return res.json({ revoked: true });
    }
    return res.json({ revoked: true, widgetTokenVersion: upd.rows[0].widget_token_version });
  } catch (err) {
    logger.error({ err }, 'sso/me/revoke failed');
    return res.status(500).json({ error: 'Failed to revoke token' });
  }
});

export default router;
