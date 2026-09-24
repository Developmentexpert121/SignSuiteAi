import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Scoped CORS middleware for the SSO/widget endpoints
 * (/api/sso/exchange, /api/sso/issue, /api/sso/me/*).
 *
 * The global `cors()` middleware is permissive for the rest of the API,
 * but these endpoints touch auth and must only respond to browsers on
 * trusted origins:
 *   - the SignSuiteIQ portal itself (SIGNSUITEIQ_PUBLIC_URL + dev origins)
 *   - the active child-app redirect origins from products_config
 *
 * Same-origin (no Origin header, e.g. server-to-server) and Replit dev
 * preview hosts are always allowed. The allowlist is cached for 60s so
 * an admin toggling a product on/off takes effect quickly without
 * hammering the DB on every preflight.
 */

const STATIC_ALLOWED = new Set<string>();
function addStatic(url: string | undefined) {
  if (!url) return;
  try {
    STATIC_ALLOWED.add(new URL(url).origin);
  } catch {
    /* ignore malformed */
  }
}
addStatic(process.env.SIGNSUITEIQ_PUBLIC_URL);
addStatic(process.env.PUBLIC_URL);
addStatic("https://signsuiteiq.ai");
addStatic("https://www.signsuiteiq.ai");

const CACHE_TTL_MS = 60_000;
let cachedDynamic: Set<string> = new Set();
let cachedAt = 0;
let inflight: Promise<Set<string>> | null = null;

async function loadDynamicOrigins(): Promise<Set<string>> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cachedDynamic;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const q = await pool.query<{ redirect_url: string | null }>(
        `SELECT redirect_url FROM products_config WHERE is_active = TRUE AND redirect_url IS NOT NULL`,
      );
      const next = new Set<string>();
      for (const row of q.rows) {
        if (!row.redirect_url) continue;
        try {
          next.add(new URL(row.redirect_url).origin);
        } catch {
          /* ignore malformed */
        }
      }
      cachedDynamic = next;
      cachedAt = Date.now();
      return next;
    } catch (err) {
      logger.warn({ err }, "widgetCors: failed to refresh allowlist, using stale cache");
      return cachedDynamic;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Development-only origin matcher. Returns true for Replit preview hosts
 * and localhost so the dev workflow (Vite + Replit-hosted dev domain)
 * can call the widget endpoints without an explicit allowlist entry.
 *
 * Returns FALSE in production — there we trust only the static portal
 * origins and the dynamic child-app allowlist from products_config. If
 * we ever ship a non-Replit dev environment, drive this with a single
 * env knob rather than expanding the regex.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
function isReplitDevOrigin(origin: string): boolean {
  if (IS_PRODUCTION) return false;
  try {
    const host = new URL(origin).hostname;
    return /\.(replit\.dev|repl\.co|replit\.app)$/.test(host) || host === "localhost" || host.startsWith("127.0.0.1");
  } catch {
    return false;
  }
}

export async function widgetCors(req: Request, res: Response, next: NextFunction): Promise<void> {
  const originHeader = req.headers["origin"];
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  // No Origin → not a cross-origin browser request. Let it through with no
  // CORS headers (server-to-server or same-origin SPA).
  if (!origin) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    return next();
  }

  const dynamic = await loadDynamicOrigins();
  const allowed = STATIC_ALLOWED.has(origin) || dynamic.has(origin) || isReplitDevOrigin(origin);

  if (!allowed) {
    // Don't echo the origin — the browser will block the response. For
    // preflight we also return 403 so the developer sees the failure.
    if (req.method === "OPTIONS") {
      res.status(403).end();
      return;
    }
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-User-Id");
  res.setHeader("Access-Control-Max-Age", "600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

/**
 * True when the request's Origin header matches a trusted SignSuiteIQ
 * portal origin (not a child app, not the public internet). Used by
 * /sso/issue to decide whether the legacy X-User-Id fallback is safe.
 *
 * Fails CLOSED for missing Origin: modern browsers always send Origin
 * on POST requests (including same-origin POSTs), so a missing Origin
 * means the request came from curl / a server-side script / a non-
 * browser client — none of which should be trusted to forge identity
 * by setting X-User-Id. The legitimate dashboard SPA path always has
 * Origin populated.
 */
export function isSameOriginPortalRequest(req: Request): boolean {
  const originHeader = req.headers["origin"];
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  if (isReplitDevOrigin(origin)) return true;
  return false;
}
