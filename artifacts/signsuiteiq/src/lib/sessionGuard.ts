import { getUser, logout, updateUser } from "./auth";

const HEARTBEAT_INTERVAL_MS = 20_000;
const LOGIN_PATH = "/login";

/**
 * Event fired whenever the heartbeat detects that the signed-in user's product
 * access (granted apps / plan) changed server-side. UI that renders launchable
 * apps listens for this so an admin's grant/revoke shows up without the user
 * having to log out and back in.
 */
export const ACCESS_CHANGED_EVENT = "ssiq:access-changed";

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

let installed = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let evicting = false;

function isApiRequest(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    return url.includes("/api/");
  } catch {
    return false;
  }
}

function requestHadAuth(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(
    init?.headers ??
      (typeof input !== "string" && !(input instanceof URL)
        ? input.headers
        : undefined),
  );
  return headers.has("x-user-id");
}

function evictSession(reason: string): void {
  if (evicting) return;
  if (!getUser()) return;
  evicting = true;
  try {
    logout();
  } catch {
    /* ignore */
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    const here = window.location.pathname;
    if (here !== LOGIN_PATH) {
      window.location.replace(`${LOGIN_PATH}?reason=${encodeURIComponent(reason)}&next=${next}`);
    }
  }
}

async function pingHeartbeat(): Promise<void> {
  const u = getUser();
  if (!u) return;
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      headers: { "x-user-id": String(u.id) },
      cache: "no-store",
    });
    if (res.status === 401) {
      evictSession("session_revoked");
      return;
    }
    if (res.ok) {
      // Keep the cached user's product access in sync with the server so an
      // admin's grant/revoke is reflected without a re-login.
      const data = await res.json().catch(() => null);
      const fresh = data?.user;
      if (fresh && Array.isArray(fresh.apps) && Array.isArray(fresh.allowedApps)) {
        const accessChanged =
          !sameSet(fresh.apps, u.apps ?? []) ||
          !sameSet(fresh.allowedApps, u.allowedApps ?? []) ||
          (fresh.planKey ?? null) !== (u.planKey ?? null);
        if (accessChanged) {
          updateUser({
            apps: fresh.apps,
            allowedApps: fresh.allowedApps,
            planKey: fresh.planKey ?? null,
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(ACCESS_CHANGED_EVENT));
          }
        }
      }
    }
  } catch {
    /* network blip — ignore, next tick will retry */
  }
}

/**
 * Install a global session guard:
 *
 *  1. Wrap window.fetch so any 401 returned to an authed request
 *     ("x-user-id" header present) triggers an immediate logout +
 *     redirect to /login. This catches the case where a super-admin
 *     archives or permanently deletes a user while they are still
 *     using the app — their next click hits 401 and we evict them.
 *
 *  2. Run a 20-second heartbeat against /api/auth/me so even an idle
 *     tab discovers the eviction quickly without the user having to
 *     click anything.
 *
 * Idempotent: safe to call multiple times.
 */
export function installSessionGuard(): void {
  if (installed) return;
  installed = true;

  if (typeof window === "undefined") return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input as RequestInfo, init);
    if (
      res.status === 401 &&
      isApiRequest(input) &&
      requestHadAuth(input, init) &&
      getUser()
    ) {
      evictSession("session_revoked");
    }
    return res;
  };

  // Kick a heartbeat now and then every HEARTBEAT_INTERVAL_MS.
  void pingHeartbeat();
  heartbeatTimer = setInterval(() => {
    void pingHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  // Re-check immediately when the tab regains focus, so a user
  // returning to a stale tab is evicted before they interact.
  window.addEventListener("focus", () => {
    void pingHeartbeat();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void pingHeartbeat();
  });
}
