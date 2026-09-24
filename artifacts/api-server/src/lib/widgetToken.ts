import crypto from "node:crypto";

/**
 * Short-lived signed token issued to child apps after a successful
 * /api/sso/exchange. The child app stores it client-side and the
 * embedded app-switcher widget presents it on subsequent calls to
 * /api/sso/me/apps and /api/sso/issue, so we never trust the child app
 * to send the user's identity.
 *
 * Format: base64url(payload).base64url(hmac_sha256(payload, secret))
 * Payload: JSON { uid, app, tv, iat, exp }
 *   uid: SignSuiteIQ user id
 *   app: the child app the token was minted for (audit only)
 *   tv : the user's widget_token_version at mint time. Routes compare
 *        this against the DB row so a "revoke all tokens" action is
 *        just `UPDATE users SET widget_token_version = widget_token_version + 1`.
 *
 * The signing secret is WIDGET_TOKEN_SECRET if set, otherwise a
 * deterministic derivation from the per-app SSO_SECRET_* values so
 * deployments get a stable secret out of the box without an extra env var.
 */

export const WIDGET_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h

let cachedSecret: Buffer | null = null;
function getSigningSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const explicit = (process.env.WIDGET_TOKEN_SECRET ?? "").trim();
  if (explicit.length >= 16) {
    cachedSecret = Buffer.from(explicit, "utf8");
    return cachedSecret;
  }
  const parts = [
    process.env.SSO_SECRET_INSTALLIQ ?? "",
    process.env.SSO_SECRET_SIGNSALESIQ ?? "",
    process.env.SSO_SECRET_SIGNTAKEOFFIQ ?? "",
  ].filter(Boolean);
  if (parts.length === 0) {
    throw new Error(
      "Widget token signing is not configured. Set WIDGET_TOKEN_SECRET (>=16 chars) or at least one SSO_SECRET_* env var.",
    );
  }
  cachedSecret = crypto.createHash("sha256").update(parts.join("|")).digest();
  return cachedSecret;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface WidgetTokenPayload {
  uid: number;
  app: string;
  tv: number;
  iat: number;
  exp: number;
}

export function issueWidgetToken(
  userId: number,
  appKey: string,
  tokenVersion: number,
): { token: string; expiresInSeconds: number } {
  const now = Math.floor(Date.now() / 1000);
  const payload: WidgetTokenPayload = {
    uid: userId,
    app: appKey,
    tv: tokenVersion,
    iat: now,
    exp: now + WIDGET_TOKEN_TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto.createHmac("sha256", getSigningSecret()).update(payloadB64).digest();
  const token = `${payloadB64}.${b64urlEncode(sig)}`;
  return { token, expiresInSeconds: WIDGET_TOKEN_TTL_SECONDS };
}

/**
 * Verify signature + expiry only. Callers MUST additionally compare
 * `payload.tv` against the user's current `widget_token_version` in the
 * DB before trusting the token — that's the revocation primitive.
 */
export function verifyWidgetToken(token: string): WidgetTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".", 2);
  if (!payloadB64 || !sigB64) return null;

  let expected: Buffer;
  try {
    expected = crypto.createHmac("sha256", getSigningSecret()).update(payloadB64).digest();
  } catch {
    return null;
  }
  let presented: Buffer;
  try {
    presented = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (presented.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(presented, expected)) return null;

  let payload: WidgetTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as WidgetTokenPayload;
  } catch {
    return null;
  }
  if (
    typeof payload?.uid !== "number" ||
    typeof payload?.app !== "string" ||
    typeof payload?.tv !== "number" ||
    typeof payload?.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/**
 * Extract a widget token from the `Authorization: Bearer …` header on a
 * request. Returns the verified payload (signature + expiry only — the
 * caller must still validate `tv` against the DB) or null.
 */
export function widgetTokenFromAuthHeader(headerValue: string | string[] | undefined): WidgetTokenPayload | null {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== "string") return null;
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;
  return verifyWidgetToken(token);
}
