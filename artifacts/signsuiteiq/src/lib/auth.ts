const AUTH_KEY = "ssiq_auth";
const REMEMBER_KEY = "ssiq_remember";

export interface RememberedLogin {
  email: string;
}

/** Read the remembered email from a previous "Remember me" sign-in, if any. */
export function getRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    if (typeof parsed.email !== "string" || !parsed.email) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

/** Save / clear the remembered email based on the user's "Remember me" choice. */
export function setRememberedLogin(remember: boolean, email: string): void {
  try {
    if (remember && email.trim()) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: email.trim() } satisfies RememberedLogin));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
  } catch { /* ignore */ }
}

export interface AuthUser {
  id:            number;
  email:         string;
  username:      string;
  name:          string;
  role:          "super_admin" | "admin" | "user" | string;
  isMaster:      boolean;
  companyId:     number | null;
  companyName:   string | null;
  faceEnabled:   boolean;
  facePhoto?:    string | null;
  googleEnabled?: boolean;
  googleEmail?:  string | null;
  phone?:        string | null;
  jobTitle?:     string | null;
  location?:     string | null;
  apps:          string[];        // user's own granted app access
  allowedApps:   string[];       // apps the admin's plan permits granting
  planKey:       string | null;  // company's active plan key
  loginAt:       number;
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(AUTH_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function saveUser(user: Omit<AuthUser, "loginAt">): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...user, loginAt: Date.now() } satisfies AuthUser));
}

/** Merge updates into the cached user (e.g. after toggling Face Lock or Google Login). */
export function updateUser(patch: Partial<AuthUser>): AuthUser | null {
  const current = getUser();
  if (!current) return null;
  const next: AuthUser = { ...current, ...patch, loginAt: Date.now() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(next));
  return next;
}

/** @deprecated use saveUser() with full profile from API */
export function login(email: string): void {
  const existing = getUser();
  if (existing) return; // don't overwrite a real session
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    id: 0, email, username: email, name: email,
    role: "user", isMaster: false,
    companyId: null, companyName: null,
    faceEnabled: false, apps: [], allowedApps: [], planKey: null,
    loginAt: Date.now(),
  } satisfies AuthUser));
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  // Also clear any cached active-plans so the next sign-in starts from the
  // server's canonical entitlements rather than the previous user's state.
  try {
    localStorage.removeItem("ssiq_active_plans");
    localStorage.removeItem("ssiq_active_plan");
  } catch { /* ignore */ }
}

export function hasAppAccess(appKey: string): boolean {
  const user = getUser();
  if (!user) return false;
  if (user.role === "super_admin" || user.isMaster) return true;
  return user.apps.includes(appKey);
}

export function isAdmin(): boolean {
  const user = getUser();
  return !!user && (user.role === "super_admin" || user.role === "admin");
}

/** @deprecated — credentials validated server-side now */
export function validateCredentials(_email: string, _password: string): boolean {
  return true; // always pass — real check happens in handleLogin via API
}
