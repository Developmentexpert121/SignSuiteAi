import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LogOut, ExternalLink, ArrowRight, Settings, ArrowLeft } from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import { ACCESS_CHANGED_EVENT } from "@/lib/sessionGuard";
import AdminPanel from "@/components/AdminPanel";
import AccountSettings from "@/components/AccountSettings";
import installiQLogo from "@assets/InstalliQ_Logo_nobg.png";
import signSalesLogo from "@assets/SignSalesIQ_Logo_nobg.png";
import signTakeoffLogo from "@assets/SignTakeoffIQ_Logo_nobg.png";

interface AppProduct {
  key: string;
  label: string;
  category: string;
  description: string;
  logo: string;
  href?: string;
  accentColor: string;
  glowColor: string;
  comingSoon?: boolean;
  underMaintenance?: boolean;
}

// Static fallback logos keyed by product_key
const LOGOS: Record<string, string> = {
  installiq:    installiQLogo,
  signsalesiq:  signSalesLogo,
  signtakeoffiq: signTakeoffLogo,
};
const ACCENTS: Record<string, { accentColor: string; glowColor: string }> = {
  installiq:    { accentColor: "from-teal-500/20 to-teal-600/5",  glowColor: "group-hover:shadow-teal-500/10" },
  signsalesiq:  { accentColor: "from-blue-500/20 to-blue-600/5",  glowColor: "group-hover:shadow-blue-500/10" },
  signtakeoffiq:{ accentColor: "from-amber-500/20 to-amber-600/5",glowColor: "group-hover:shadow-amber-500/10" },
};

// Static fallback (used if API is unavailable)
const STATIC_PRODUCTS: AppProduct[] = [
  { key: "installiq",    label: "InstalliQ.ai",   category: "Field Proof", description: "AI-powered installation management for your field crews.",                              logo: installiQLogo,  href: "https://www.installiq.ai/",   accentColor: "from-teal-500/20 to-teal-600/5",   glowColor: "group-hover:shadow-teal-500/10" },
  { key: "signsalesiq",  label: "SignSalesIQ",     category: "Sales",       description: "AI visual mockups and rapid proposal generation to close deals faster.",               logo: signSalesLogo,  href: "https://www.signsalesiq.ai/", accentColor: "from-blue-500/20 to-blue-600/5",   glowColor: "group-hover:shadow-blue-500/10" },
  { key: "signtakeoffiq",label: "SignTakeoffIQ",   category: "Estimating",  description: "Automated plan reading, ADA compliance checks, and multi-page PDF scanning.",         logo: signTakeoffLogo,href: "",                             accentColor: "from-amber-500/20 to-amber-600/5", glowColor: "group-hover:shadow-amber-500/10", comingSoon: true },
];

// Apps we recognise as real launchable products (excludes future/coming-soon
// keys that may appear elsewhere). Used to decide an install manager's
// "only product" status for auto-entry.
const KNOWN_APP_KEYS = ["installiq", "signsalesiq", "signtakeoffiq"];

/**
 * An Install Manager whose only granted product is InstalliQ should land
 * straight inside InstalliQ on login rather than the SignSuite launcher.
 * Gated tightly so multi-app users and admins are never auto-redirected.
 */
function shouldAutoEnterInstalliq(u: ReturnType<typeof getUser>): boolean {
  if (!u) return false;
  if (u.role === "super_admin" || u.role === "admin" || u.isMaster) return false;
  if ((u.jobTitle || "").trim().toLowerCase() !== "install manager") return false;
  const apps = (Array.isArray(u.apps) ? u.apps : []).filter(a => KNOWN_APP_KEYS.includes(a));
  return apps.length === 1 && apps[0] === "installiq";
}

// ─── Tile click → mint SSO code → redirect to product app ────────────────────
async function launchProduct(
  appKey: string,
  fallbackHref: string | undefined,
  userId: number | undefined,
  opts?: { newTab?: boolean; onError?: () => void },
) {
  if (!userId) return;
  const newTab = opts?.newTab !== false; // default: open in a new tab
  const open = (url: string) => {
    if (newTab) window.open(url, "_blank", "noopener,noreferrer");
    else window.location.assign(url);
  };
  const handleError = (msg: string) => {
    // When auto-entering same-tab, fall back to the launcher silently rather
    // than alerting + popping a new tab.
    if (opts?.onError) { opts.onError(); return; }
    alert(msg);
    if (fallbackHref) window.open(fallbackHref, "_blank", "noopener,noreferrer");
  };
  try {
    const res = await fetch("/api/sso/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": String(userId) },
      body: JSON.stringify({ appKey }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body && body.error) || `Could not launch (HTTP ${res.status}).`;
      handleError(`${msg}\n\nFalling back to ${fallbackHref || "the product page"}.`);
      return;
    }
    const { redirectUrl } = await res.json();
    if (redirectUrl) {
      open(redirectUrl);
    } else if (fallbackHref) {
      open(fallbackHref);
    } else {
      handleError("Could not launch the product.");
    }
  } catch (err) {
    handleError("Could not reach the sign-in service. Try again in a moment.");
  }
}

// ─── App Launcher (for regular users) ─────────────────────────────────────────
function AppLauncher() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState(() => getUser()!);
  const [allProducts, setAllProducts] = useState<AppProduct[]>(STATIC_PRODUCTS);
  const [view, setView] = useState<"launcher" | "settings">("launcher");
  // Install managers whose only product is InstalliQ skip the launcher and are
  // routed straight into InstalliQ via SSO (same tab). Initialised from the
  // cached user so the interstitial shows immediately — no launcher flash.
  const [autoEntering, setAutoEntering] = useState(() => shouldAutoEnterInstalliq(getUser()));

  // Re-read the cached user whenever the session-guard heartbeat detects that
  // this user's product access changed server-side (an admin granted/revoked an
  // app), so launchable tiles update without a logout/login. The heartbeat also
  // fires immediately on page load, so a manual refresh reflects changes too.
  useEffect(() => {
    const refresh = () => {
      const u = getUser();
      if (u) setUser(u);
    };
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    // Capture any cache update the heartbeat may have already applied between
    // the initial state read and this effect running.
    refresh();
    return () => {
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Fire the InstalliQ auto-entry once, when qualified. On any SSO failure we
  // drop back to the launcher rather than trapping the user on a spinner.
  useEffect(() => {
    if (!autoEntering) return;
    const u = getUser();
    if (!u || !shouldAutoEnterInstalliq(u)) { setAutoEntering(false); return; }
    void launchProduct("installiq", "https://www.installiq.ai/", u.id, {
      newTab: false,
      onError: () => setAutoEntering(false),
    });
  }, [autoEntering]);

  useEffect(() => {
    fetch("/api/public/products")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setAllProducts(data.map((p: any) => ({
            key:        p.product_key,
            label:      p.display_name,
            category:   p.category,
            description:p.description,
            logo:       p.logo_url || LOGOS[p.product_key] || "",
            href:       p.redirect_url || "",
            accentColor: ACCENTS[p.product_key]?.accentColor ?? "from-white/10 to-white/5",
            glowColor:   ACCENTS[p.product_key]?.glowColor   ?? "",
            comingSoon:  p.coming_soon ?? false,
            underMaintenance: p.under_maintenance ?? false,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const userApps      = Array.isArray(user?.apps) ? user.apps : [];
  // Coming-soon products are never launchable, even if somehow assigned —
  // always surface them in the "Other Products" group with a Coming Soon tag.
  const availableApps = allProducts.filter(p => userApps.includes(p.key) && !p.comingSoon);
  const lockedApps    = allProducts.filter(p => !userApps.includes(p.key) || p.comingSoon);
  const userName      = (user?.name || user?.username || user?.email || "");

  function handleLogout() {
    logout();
    navigate("/");
  }

  // Install-manager auto-entry interstitial — shown while we mint the SSO code
  // and redirect into InstalliQ in the same tab.
  if (autoEntering) {
    return (
      <div className="min-h-[calc(100vh-96px)] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <img src={installiQLogo} alt="InstalliQ.ai" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="w-6 h-6 mx-auto mb-4 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-xs uppercase tracking-[0.25em] font-medium">
            Opening InstalliQ…
          </p>
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <button
            onClick={() => setView("launcher")}
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-xs uppercase tracking-[0.2em] font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to apps
          </button>
          <AccountSettings />
        </div>
      </div>
    );
  }

  if (!availableApps.length && !lockedApps.length) {
    return (
      <div className="min-h-[calc(100vh-96px)] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-medium mb-3">
            Welcome, {userName.toUpperCase()}
          </p>
          <h1 className="text-gray-900 text-4xl font-medium tracking-tight mb-4">
            No Apps Assigned
          </h1>
          <p className="text-gray-600 text-sm mb-10">
            Contact your administrator to get access to your products.
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 mx-auto text-gray-400 hover:text-gray-700 text-xs uppercase tracking-[0.25em] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-medium mb-2">
            Welcome back
          </p>
          <h1 className="text-gray-900 text-3xl md:text-4xl font-semibold tracking-tight">
            {userName}
          </h1>
          <p className="text-gray-600 text-sm mt-2">
            Select a product below to launch your dashboard
          </p>
        </div>

        {/* Available Products */}
        {availableApps.length > 0 && (
        <div className="mb-3">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium mb-4">
            Your Products
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableApps.map(product => {
              const maint = !!product.underMaintenance;
              return (
              <button
                key={product.key}
                onClick={maint ? undefined : () => launchProduct(product.key, product.href, user?.id)}
                disabled={maint}
                className={`group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${maint ? "opacity-70 cursor-not-allowed" : "hover:border-gray-300 hover:shadow-xl hover:-translate-y-0.5"} ${product.glowColor} transition-all duration-200 text-left`}
              >
                {/* Gradient accent strip */}
                <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${product.accentColor} opacity-60`} />

                {maint && (
                  <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                    Under Maintenance
                  </span>
                )}

                {/* Logo area */}
                <div className="px-6 pt-7 pb-4 flex items-center justify-center">
                  <img
                    src={product.logo}
                    alt={product.label}
                    className={`h-12 w-auto object-contain max-w-[160px] transition-opacity ${maint ? "grayscale opacity-80" : "opacity-95 group-hover:opacity-100"}`}
                  />
                </div>

                {/* Divider */}
                <div className="mx-6 h-px bg-gray-100" />

                {/* Content */}
                <div className="px-6 py-5 flex-1 flex flex-col">
                  <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium mb-1">
                    {product.category}
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed mb-5 flex-1">
                    {product.description}
                  </p>
                  {maint ? (
                    <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium">
                      Temporarily unavailable
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-accent text-xs font-medium group-hover:gap-2.5 transition-all">
                      Launch
                      {product.href ? (
                        <ExternalLink className="w-3 h-3" />
                      ) : (
                        <ArrowRight className="w-3 h-3" />
                      )}
                    </div>
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Locked Products */}
        {lockedApps.length > 0 && (
          <div className="mt-10">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium mb-4">
              Other Products — Contact Your Admin
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lockedApps.map(product => (
                <div
                  key={product.key}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white/60 px-5 py-4 opacity-60"
                >
                  <img
                    src={product.logo}
                    alt={product.label}
                    className="h-7 w-auto object-contain max-w-[100px] grayscale"
                  />
                  <div>
                    <p className="text-gray-700 text-xs font-medium">{product.label}</p>
                    <p className={`text-[10px] ${product.comingSoon ? "text-amber-600 font-semibold uppercase tracking-wider" : "text-gray-400"}`}>
                      {product.comingSoon ? "Coming Soon" : "Not assigned"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account actions */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex items-center gap-6">
          <button
            onClick={() => setView("settings")}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-xs uppercase tracking-[0.25em] font-medium transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Account Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-xs uppercase tracking-[0.25em] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard (role-aware router) ────────────────────────────────────────────
export default function Dashboard() {
  const user = getUser();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  if (!user) return null;

  if (user.role === "super_admin" || user.role === "admin") {
    return <AdminPanel />;
  }

  return <AppLauncher />;
}
