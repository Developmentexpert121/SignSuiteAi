import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, HelpCircle, Loader2, CheckCircle2, ArrowUpCircle, ArrowDownCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { isLoggedIn, getUser, saveUser } from "@/lib/auth";
import { savePendingCheckout } from "@/lib/pendingCheckout";
import {
  addActivePlan, syncActivePlansFromAllowedApps,
  getPendingActivation, clearPendingActivation,
  savePendingActivation, getPlanAction, getPlanExpiry,
  useActivePlans,
  type ActivePlan, type PlanKey,
} from "@/lib/activePlan";
import logoFull from "@assets/SignSuiteIQ_v4_clean_transparent.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// The backend resolves the actual Stripe price ID by `${planKey}_${billing}`
// lookup_key on every checkout request, so we never hardcode environment-
// specific Stripe IDs in the frontend. To onboard a new Stripe account, run
// `pnpm --filter @workspace/scripts run seed-stripe` against it once.
const PLAN_KEYS = ['installiq', 'signsalesiq', 'signtakeoffiq', 'fullsuite'] as const;
type PricingPlanKey = (typeof PLAN_KEYS)[number];

// Shape returned by GET /api/public/plans — every visible plan from the
// admin's Plans tab, in sort_order. The Pricing page renders one card per row.
type PublicPlan = {
  plan_key: string;
  display_name: string;
  category: string;
  description: string;
  monthly_price: number;   // cents
  annual_price: number;    // cents — currently unused on this page (monthly only)
  features: string[];
  products: string[];
  coming_soon: boolean;
  sort_order: number;
};

// Per-category accent palette used for the small uppercase tag, the bullet
// check marks, and other small accents on each pricing card. New categories
// fall through to a neutral slate palette so an admin-added plan still
// renders cleanly.
const CATEGORY_STYLES: Record<string, { tag: string; check: string }> = {
  "Field Proof":     { tag: "text-teal-600",  check: "text-teal-500"  },
  "Sales":           { tag: "text-blue-600",  check: "text-blue-500"  },
  "Estimating":      { tag: "text-amber-600", check: "text-amber-500" },
  "Command Center":  { tag: "text-accent",    check: "text-accent"    },
};
function styleForCategory(cat: string) {
  return CATEGORY_STYLES[cat] ?? { tag: "text-slate-600", check: "text-slate-500" };
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};


function calcTimeLeft(expiry: number) {
  const rem = Math.max(0, expiry - Date.now());
  const s = Math.floor(rem / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
function pad(n: number) { return String(n).padStart(2, "0"); }

function CurrentPlanBadge({ activePlan, dark }: { activePlan: ActivePlan; dark?: boolean }) {
  const expiry = getPlanExpiry(activePlan);
  const [t, setT] = useState(() => calcTimeLeft(expiry));
  useEffect(() => {
    const id = setInterval(() => setT(calcTimeLeft(expiry)), 1000);
    return () => clearInterval(id);
  }, [expiry]);
  const expiryDate = new Date(expiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const renewLabel = activePlan.billingPeriod === "annual" ? "Active through" : "Renews";
  const tileBase = dark ? "bg-white/5 border-white/10" : "bg-green-50 border-green-100";
  const numClass = dark ? "text-white" : "text-green-700";
  const labelClass = dark ? "text-white/40" : "text-green-500/70";
  return (
    <div className="mb-8">
      <Button disabled className={`w-full rounded-sm flex items-center gap-2 ${dark ? "bg-green-500/20 text-green-300 border-green-500/40" : "bg-green-50 text-green-700 border-green-300"} border`}>
        <CheckCircle2 className="w-4 h-4" /> Current Plan
      </Button>
      <p className={`text-center text-xs mt-2 mb-2.5 ${dark ? "text-green-400/70" : "text-green-600/60"}`}>
        {renewLabel} {expiryDate}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {[{ v: t.days, l: "Days" }, { v: t.hours, l: "Hrs" }, { v: t.minutes, l: "Min" }, { v: t.seconds, l: "Sec" }].map(({ v, l }) => (
          <div key={l} className={`flex flex-col items-center rounded py-2 border ${tileBase}`}>
            <span className={`text-base font-bold tabular-nums leading-none ${numClass}`}>{pad(v)}</span>
            <span className={`text-[9px] uppercase tracking-wider mt-1 ${labelClass}`}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// PlanButton accepts any string plan_key — admin-added plans flow through
// the same Stripe checkout endpoint, which resolves the price by
// `${planKey}_${billing}` lookup_key on the backend.
function PlanButton({ planKey, activePlans, loadingPlan, onCheckout, dark = false }: {
  planKey: string; activePlans: ActivePlan[]; loadingPlan: string | null;
  onCheckout: (key: string) => void; dark?: boolean;
}) {
  const action = getPlanAction(planKey as PlanKey, activePlans);
  const isLoading = loadingPlan === planKey;

  if (action === "current") {
    // Only render the badge for the exact plan the user purchased — never
    // fall back to fullsuite, otherwise individual cards inherit the wrong
    // renewal date when the user owns Full Suite.
    const match = activePlans.find(p => p.planKey === planKey);
    if (match) return <CurrentPlanBadge activePlan={match} dark={dark} />;
  }
  if (action === "covered") {
    // The user owns Full Suite, which already includes this product. Disable
    // the individual card so they can't accidentally double-purchase.
    return (
      <Button
        disabled
        className={`w-full mb-8 rounded-sm flex items-center gap-2 cursor-not-allowed border ${
          dark
            ? "bg-white/5 text-white/50 border-white/10 hover:bg-white/5"
            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-50"
        }`}
        title="Already included in your Full Suite plan"
      >
        <Lock className="w-3.5 h-3.5" />
        Included in Full Suite
      </Button>
    );
  }
  if (action === "upgrade") {
    return (
      <Button variant="outline" className={`w-full mb-8 rounded-sm flex items-center gap-2 ${dark ? "border-blue-400 text-blue-300 hover:bg-blue-900/30" : "border-blue-500 text-blue-600 hover:bg-blue-50"}`}
        onClick={() => onCheckout(planKey)} disabled={isLoading}>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
        Buy Now
      </Button>
    );
  }
  if (action === "downgrade") {
    return (
      <Button variant="outline" className={`w-full mb-8 rounded-sm flex items-center gap-2 ${dark ? "border-amber-400 text-amber-300 hover:bg-amber-900/30" : "border-amber-500 text-amber-600 hover:bg-amber-50"}`}
        onClick={() => onCheckout(planKey)} disabled={isLoading}>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownCircle className="w-4 h-4" />}
        Downgrade
      </Button>
    );
  }
  return (
    <Button variant={dark ? "default" : "outline"}
      className={`w-full mb-8 rounded-sm ${dark ? "bg-accent hover:bg-accent/90 text-white uppercase tracking-wide" : ""}`}
      onClick={() => onCheckout(planKey)} disabled={isLoading}>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      Buy Now
    </Button>
  );
}

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  // Live-subscribed list — re-renders the instant any helper mutates the
  // local cache (e.g. addActivePlan in the checkout-success effect, or a
  // server-reconcile from another tab). No manual setter needed.
  const activePlans = useActivePlans();
  // Plans rendered on the page come live from the admin Plans tab. While the
  // initial fetch is in flight we render skeleton cards so the layout doesn't
  // jump.
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      try {
        const res = await fetch("/api/public/plans", { cache: "no-store" });
        if (!res.ok) return;
        const rows: PublicPlan[] = await res.json();
        if (!cancelled) setPlans(rows);
      } catch { /* keep empty */ }
      finally { if (!cancelled) setPlansLoading(false); }
    };
    doFetch();
    const onVisibility = () => {
      if (document.visibilityState === "visible") doFetch();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const [, navigate] = useLocation();
  const activePlan: ActivePlan | null = activePlans.length > 0 ? activePlans[activePlans.length - 1] : null;

  // Redirect regular "user" role to their dashboard — admins and super_admins
  // can still browse pricing. Allow checkout-return params through so the
  // plan-activation effect below can run.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCheckoutReturn = params.get("success") === "1" || params.get("canceled") === "1";
    const currentUser = getUser();
    if (currentUser?.role === "user" && !isCheckoutReturn) {
      navigate("/dashboard");
    }
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") !== "1") return;

    const pending = getPendingActivation();
    const sessionId = params.get("session_id");
    const currentUser = getUser();

    // Always fire confirm-checkout when we have a sessionId — this persists
    // the real Stripe amount + payment-method onto the user_subscriptions row
    // regardless of whether sessionStorage survived the redirect.
    if (sessionId) {
      fetch("/api/stripe/confirm-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }

    if (pending) {
      // Additively register the just-purchased plan locally so the UI
      // immediately reflects ownership without removing prior plans.
      // addActivePlan broadcasts a change event → useActivePlans here
      // and the dashboard's plan banner both re-render on the spot.
      const plan: ActivePlan = { planKey: pending.planKey, billingPeriod: pending.billingPeriod, startDate: Date.now() };
      addActivePlan(plan);
      clearPendingActivation();
    }

    if (currentUser && (currentUser.role === "admin" || currentUser.role === "super_admin")) {
      // Always reconcile against the server after a successful checkout.
      // We POST activate-plan when we know what was bought (covers the
      // common path) and fall back to GET my-plan when sessionStorage was
      // cleared by the Stripe redirect. We retry briefly because the
      // Stripe webhook that flips the row to "active" can lag the
      // browser redirect by a couple of seconds, especially in test mode.
      const reconcile = async () => {
        try {
          if (pending) {
            const res = await fetch("/api/admin/activate-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.id) },
              body: JSON.stringify({ planKey: pending.planKey }),
            });
            const data = res.ok ? await res.json() : null;
            if (data?.allowedApps) {
              saveUser({
                ...currentUser,
                apps: Array.from(new Set([...(currentUser.apps ?? []), ...data.allowedApps])),
                allowedApps: data.allowedApps,
                planKey: pending.planKey,
              });
              syncActivePlansFromAllowedApps(data.allowedApps);
            }
          }

          // Poll my-plan a few times so we pick up the webhook-supplied
          // row (with real billing dates / Stripe metadata) once it
          // lands, and so any other tab/page that listens to the change
          // event refreshes too.
          const delays = [0, 1500, 4000];
          for (const delay of delays) {
            if (delay) await new Promise(r => setTimeout(r, delay));
            const r = await fetch("/api/admin/my-plan", {
              headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.id) },
              cache: "no-store",
            });
            if (!r.ok) continue;
            const data = await r.json();
            if (data?.allowedApps?.length) {
              saveUser({
                ...currentUser,
                apps: Array.from(new Set([...(currentUser.apps ?? []), ...data.allowedApps])),
                allowedApps: data.allowedApps,
                planKey: data.planKey ?? currentUser.planKey,
              });
              syncActivePlansFromAllowedApps(data.allowedApps);
              break;
            }
          }
        } catch { /* best-effort — page can still be refreshed manually */ }
      };
      void reconcile();
    }
  }, []);

  async function handleCheckout(planKey: string) {
    if (!isLoggedIn()) {
      // savePendingCheckout's PlanKey union is the legacy 4 plans. Newly-
      // added admin plans flow through the same checkout endpoint at runtime,
      // so the cast is safe — the backend resolves Stripe price by lookup_key.
      savePendingCheckout({ planKey: planKey as PlanKey, isAnnual: false });
      navigate("/login");
      return;
    }
    savePendingActivation(planKey as PlanKey, "monthly");
    setLoadingPlan(planKey);
    const currentUser = getUser();
    try {
      const base = window.location.origin;
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const successUrl = `${base}${basePath}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${base}${basePath}/pricing?canceled=1`;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey,
          billing: "monthly",
          successUrl,
          cancelUrl,
          userId:    currentUser?.id,
          userEmail: currentUser?.email,
        }),
      });
      const payload = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !payload?.url) {
        const serverMsg = payload?.error?.toString().trim();
        throw new Error(serverMsg || `Checkout failed (HTTP ${res.status})`);
      }
      window.location.href = payload.url;
    } catch (err) {
      console.error("Checkout error:", err);
      const detail = err instanceof Error && err.message ? err.message : "unknown error";
      alert(`Something went wrong starting checkout.\n\nDetails: ${detail}\n\nPlease try again, or contact support if the problem persists.`);
    } finally {
      setLoadingPlan(null);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const checkoutSuccess = params.get("success") === "1";
  const checkoutCanceled = params.get("canceled") === "1";

  const individualPlans = plans.filter(p => p.plan_key !== "fullsuite");
  const activeIndividualPlans = individualPlans.filter(p => !p.coming_soon);
  // activeSumCents = sum of discount prices of active individual plans (drives Full Suite price)
  const activeSumCents = activeIndividualPlans
    .reduce((acc, p) => acc + p.annual_price, 0);
  // fullSumCents = sum of regular monthly prices (used as Full Suite strikethrough)
  const fullSumCents = individualPlans
    .reduce((acc, p) => acc + p.monthly_price, 0);
  const activeIndividualCount = activeIndividualPlans.length;

  return (
    <div className="min-h-screen bg-background pt-20">
      {checkoutSuccess && (
        <div className="bg-teal-600 text-white text-center py-3 px-4 text-sm font-medium">
          Payment successful! Welcome to SignSuiteIQ — check your email for next steps.
        </div>
      )}
      {checkoutCanceled && (
        <div className="bg-amber-500 text-white text-center py-3 px-4 text-sm font-medium">
          Checkout was canceled. Your plan is still available — choose below when you're ready.
        </div>
      )}
      {/* Header */}
      <section className="bg-primary text-white py-24 relative overflow-hidden text-center">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-medium tracking-tight mb-6">
              Pricing for your workflow
            </h1>
            <p className="text-xl text-white/80 mb-4">
              Simple, transparent monthly pricing for teams up to 20 users.
            </p>
            <p className="text-sm text-accent font-medium uppercase tracking-widest">Billed Monthly · Cancel Anytime</p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section id="plans" className="py-24 -mt-12">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
          >
            {/* Plan cards rendered live from /api/public/plans. Admin edits in
                the Plans tab (price, description, features, status, "coming
                soon") appear here on the next page load. The "fullsuite" plan
                gets a special dark/accent treatment + "Best Value" ribbon. */}
            {plansLoading && plans.length === 0 ? (
              [...Array(4)].map((_, i) => (
                <motion.div key={i} variants={fadeUp} className="bg-white border border-border rounded-sm p-8 shadow-sm h-[460px] animate-pulse">
                  <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                  <div className="h-6 w-40 bg-gray-200 rounded mb-6" />
                  <div className="h-10 w-32 bg-gray-200 rounded mb-3" />
                  <div className="h-4 w-full bg-gray-100 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-gray-100 rounded" />
                </motion.div>
              ))
            ) : plans.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-12">No plans available right now.</p>
            ) : (
              plans.map((plan, idx) => {
                const isFullSuite = plan.plan_key === "fullsuite";
                const styles = styleForCategory(plan.category);
                // displayDollars = discounted price (annual_price field, admin calls it "Discount Price")
                const displayDollars = isFullSuite
                  ? Math.round(activeSumCents / 100)
                  : Math.round(plan.annual_price / 100);
                // strikethroughDollars = regular monthly price, shown only when a discount exists
                const strikethroughDollars = !isFullSuite && plan.monthly_price > plan.annual_price && plan.annual_price > 0
                  ? Math.round(plan.monthly_price / 100)
                  : 0;
                // Full Suite strikethrough = sum of all individual plans' regular monthly prices
                const fullSuiteStrike = isFullSuite && fullSumCents > 0
                  ? Math.round(fullSumCents / 100)
                  : 0;
                // Savings % badge
                const savePct = !isFullSuite && plan.monthly_price > 0 && plan.annual_price > 0 && plan.annual_price < plan.monthly_price
                  ? Math.round((1 - plan.annual_price / plan.monthly_price) * 100)
                  : 0;
                return (
                  <motion.div
                    key={plan.plan_key}
                    // Per-card whileInView (not parent variants) — these
                    // mount AFTER parent's whileInView already fired with
                    // skeleton placeholders, so variant inheritance would
                    // leave them stuck at hidden. Per-card whileInView
                    // preserves the scroll-triggered fade-in.
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    whileHover={{ y: -4 }}
                    className={isFullSuite
                      ? "bg-primary text-white border-2 border-accent rounded-sm p-8 shadow-xl flex flex-col relative z-10"
                      : "bg-card border border-border rounded-sm p-8 shadow-sm flex flex-col bg-white"}
                  >
                    {isFullSuite && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-sm">
                        Best Value
                      </div>
                    )}
                    <div className={`${styles.tag} text-xs font-bold uppercase tracking-widest mb-2`}>
                      {plan.category || "Plan"}
                    </div>
                    <h3 className="text-2xl font-medium mb-4">{plan.display_name}</h3>

                    {plan.coming_soon ? (
                      <>
                        <div className={`mb-1 ${isFullSuite ? "text-white/80" : "text-foreground/80"}`}>
                          <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-sm">
                            Coming Soon
                          </span>
                        </div>
                        <p className={`text-xs mb-6 ${isFullSuite ? "text-white/50" : "text-muted-foreground"}`}>Pricing announced at launch</p>
                      </>
                    ) : (
                      <>
                        <div className="mb-1 flex items-baseline gap-2 flex-wrap">
                          {(isFullSuite ? fullSuiteStrike > 0 : strikethroughDollars > 0) && (
                            <span className={`text-2xl font-medium line-through ${isFullSuite ? "text-white/50" : "text-muted-foreground"}`}>
                              ${isFullSuite ? fullSuiteStrike : strikethroughDollars}
                            </span>
                          )}
                          <span className="text-4xl font-bold">${displayDollars}</span>
                          <span className={isFullSuite ? "text-white/60" : "text-muted-foreground"}>/mo</span>
                          {savePct > 0 && (
                            <span className="text-xs font-bold bg-accent text-white px-2 py-0.5 rounded-full">
                              Save {savePct}%
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mb-6 ${isFullSuite ? "text-white/50" : "text-muted-foreground"}`}>billed monthly</p>
                      </>
                    )}

                    <p className={`text-sm mb-6 min-h-[2.5rem] ${isFullSuite ? "text-white/80" : "text-muted-foreground"}`}>
                      {plan.description}
                    </p>

                    {plan.coming_soon ? (
                      <Button
                        disabled
                        className={`w-full mb-8 rounded-sm cursor-not-allowed ${
                          isFullSuite
                            ? "bg-white/10 text-white/60 hover:bg-white/10"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        Coming Soon
                      </Button>
                    ) : (
                      <PlanButton
                        planKey={plan.plan_key}
                        activePlans={activePlans}
                        loadingPlan={loadingPlan}
                        onCheckout={handleCheckout}
                        dark={isFullSuite}
                      />
                    )}

                    <ul className={`space-y-3 text-sm mt-auto ${isFullSuite ? "text-white/90" : "text-foreground/80"}`}>
                      {plan.features.map((f, i) => {
                        const label = isFullSuite
                          ? f.replace(/^All \d+ applications/, `All ${activeIndividualCount} applications`)
                          : f;
                        return (
                          <li key={i} className="flex gap-3">
                            <Check className={`w-4 h-4 ${styles.check} shrink-0`} />
                            <span>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>
      </section>

      {/* Team Plan Feature Breakdown */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <div className="inline-block text-accent text-xs font-bold uppercase tracking-widest mb-3 border border-accent/30 px-3 py-1 rounded-sm">Full Suite — Team Plan</div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Everything in the Full Suite, built for growing teams.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">For growing sign teams that need unlimited power, mobile access, and hands-on support — all under one roof.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                category: "Team & Users",
                color: "text-cyan-600",
                border: "border-cyan-200",
                bg: "bg-cyan-50/50",
                items: [
                  "Up to 20 team members",
                  "Shared workspace across all three apps",
                  "Role-based access for crew, sales, and admin",
                ]
              },
              {
                category: "Mock-ups & Storage",
                color: "text-blue-600",
                border: "border-blue-200",
                bg: "bg-blue-50/50",
                items: [
                  "Unlimited AI mock-up generations (SignSalesIQ)",
                  "100GB cloud photo storage (InstalliQ)",
                  "Custom templates — save and reuse your best work",
                  "Store setup — branded storefront for client-facing deliverables",
                ]
              },
              {
                category: "AI Access",
                color: "text-accent",
                border: "border-orange-200",
                bg: "bg-orange-50/50",
                items: [
                  "Unlimited AI tokens across all three platforms",
                  "Full AI access: plan recognition, work order parsing, mock-up generation, photo tagging",
                ]
              },
              {
                category: "Mobile",
                color: "text-teal-600",
                border: "border-teal-200",
                bg: "bg-teal-50/50",
                items: [
                  "Mobile-optimized experience for InstalliQ.ai (field crews)",
                  "Mobile-optimized experience for SignSalesIQ (sales on the go)",
                ]
              },
              {
                category: "Support",
                color: "text-violet-600",
                border: "border-violet-200",
                bg: "bg-violet-50/50",
                items: [
                  "Email support across all three platforms",
                  "Virtual support — live chat or screen-share assistance",
                  "Onboarding session to get your team set up fast",
                ]
              },
            ].map((group, i) => (
              <div key={i} className={`bg-white border ${group.border} rounded-sm p-6 shadow-sm`}>
                <div className={`text-xs font-bold uppercase tracking-widest mb-4 ${group.color}`}>{group.category}</div>
                <ul className="space-y-3">
                  {group.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-sm text-foreground/80">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${group.color}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-muted/20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Image side */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="relative rounded-sm overflow-hidden bg-primary flex flex-col items-center justify-center p-12 min-h-[480px] text-center"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(41,171,226,0.15)_0%,rgba(28,42,58,1)_65%)]" />
              <div className="relative z-10 flex flex-col items-center gap-8">
                <img src={logoFull} alt="SignSuiteIQ" className="h-28 w-auto object-contain" />
                <div className="w-12 h-px bg-accent/40" />
                <div className="flex flex-col gap-5 text-left w-full max-w-xs">
                  {["Billing is simple — per company, not per seat.", "Cancel anytime, no questions asked.", "Your data is encrypted and always yours.", "Onboarding support included on every plan."].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <HelpCircle className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                      <p className="text-white/70 text-sm leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Questions side */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <h2 className="text-3xl font-medium tracking-tight mb-10">Frequently Asked Questions</h2>
              <Accordion type="single" collapsible className="w-full space-y-3">
                {[
                  { q: "How does billing work?", a: "We charge per company, not per seat. Your monthly subscription covers unlimited users within your organization. You can pay securely via credit card or ACH." },
                  { q: "Can I cancel at any time?", a: "Yes. You can cancel your monthly plan anytime before the next billing cycle and you will not be charged again." },
                  { q: "Do you charge for team seats?", a: "No! We believe software should connect your whole team. All our plans include unlimited user seats for your employees." },
                  { q: "Is my data secure?", a: "Absolutely. We use enterprise-grade encryption (AES-256) for data at rest and in transit. Your client designs, pricing, and operational data are strictly confidential." },
                  { q: "What onboarding support do you offer?", a: "We offer self-serve video tutorials for all plans. Full Suite subscribers receive dedicated 1-on-1 onboarding sessions to ensure your team hits the ground running." },
                  { q: "Do you offer API access?", a: "Yes, API access is included in the Full Suite plan, allowing you to integrate SignSuiteIQ with your existing ERP, CRM, or accounting software." },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`item-${i}`} className="bg-white border border-border px-6 rounded-sm shadow-sm">
                    <AccordionTrigger className="text-left font-medium hover:no-underline py-5">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-8">Ready to transform your sign business?</h2>
          {activePlan ? (
            <a href="/dashboard">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-white uppercase tracking-wider font-medium px-10 h-14 rounded-sm text-lg">
                Go to Dashboard
              </Button>
            </a>
          ) : (
            <a href="#plans">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-white uppercase tracking-wider font-medium px-10 h-14 rounded-sm text-lg">
                Start Your Free Trial
              </Button>
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
