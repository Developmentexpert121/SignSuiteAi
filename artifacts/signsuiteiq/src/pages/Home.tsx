import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Check, Loader2, ArrowUpCircle, ArrowDownCircle, Lock } from "lucide-react";
import { isLoggedIn, getUser } from "@/lib/auth";
import { savePendingCheckout } from "@/lib/pendingCheckout";
import {
  useActivePlans, savePendingActivation, getPlanAction, getPlanExpiry,
  type ActivePlan, type PlanKey,
} from "@/lib/activePlan";

import installiQLogo from "@assets/InstalliQ_Logo_nobg.png";
import signSalesLogo from "@assets/SignSalesIQ_Logo_nobg.png";
import signTakeoffLogo from "@assets/SignTakeoffIQ_Logo_nobg.png";

// Per-product accent palette (badge background, badge text, check icon, link
// color) for the Products grid. New admin-added products fall back to the
// neutral slate palette.
const PRODUCT_THEMES: Record<string, { badge: string; badgeText: string; check: string; link: string }> = {
  installiq:     { badge: "bg-accent/10",  badgeText: "text-accent",     check: "text-accent",     link: "text-accent" },
  signsalesiq:   { badge: "bg-blue-50",    badgeText: "text-blue-700",   check: "text-blue-500",   link: "text-blue-600" },
  signtakeoffiq: { badge: "bg-amber-50",   badgeText: "text-amber-700",  check: "text-amber-500",  link: "text-amber-600" },
};
const NEUTRAL_THEME = { badge: "bg-slate-50", badgeText: "text-slate-700", check: "text-slate-500", link: "text-slate-600" };

// Fallback bundled logos for legacy product keys when products_config.logo_url
// is empty. Newly-added admin products will set logo_url explicitly.
const PRODUCT_LOGO_FALLBACK: Record<string, string> = {
  installiq: installiQLogo,
  signsalesiq: signSalesLogo,
  signtakeoffiq: signTakeoffLogo,
};

// Marketing feature taglines per product on the Home grid. Until the schema
// grows a per-product features column, these stay client-side; new products
// render with no bullet list.
const PRODUCT_HOME_FEATURES: Record<string, string[]> = {
  installiq:     ["Smart Scheduling", "AI Work Order Parsing", "Photo Capture & AI Tagging", "Site Survey", "Archive Photo Integration", "Client Communication"],
  signsalesiq:   ["47+ Sign Type Mock-ups", "Unlimited Mock-ups", "Reference Measurement", "Real Environment Placement", "Live Client Adjustments", "Sign Code Look-up"],
  signtakeoffiq: ["AI Plan Recognition", "Plan Mark-ups", "ADA & Fire Code Compliance", "Automated Read Counts", "Editable Sign Schedules"],
};

// Map a product_key from the DB to the marketing page URL on this site. New
// keys without a hand-built page fall back to /pricing so the link still works.
// All products — including the original 3 built-ins — now route through the
// dynamic /products/:key page so admin Page Builder edits are visible.
// (The legacy hardcoded /installiiq, /signsalesiq, /signtakeoffiq routes
//  still exist as fallbacks but are no longer linked from the site.)
const PRODUCT_KEY_TO_PATH: Record<string, string> = {};
function pathForProductKey(key: string): string {
  return PRODUCT_KEY_TO_PATH[key] ?? `/products/${key}`;
}

// Per-pricing-card category palette (small uppercase tag + check icons).
const PRICING_CATEGORY_STYLES: Record<string, { tag: string; check: string }> = {
  "Field Proof":     { tag: "text-teal-600",  check: "text-teal-500"  },
  "Sales":           { tag: "text-blue-600",  check: "text-blue-500"  },
  "Estimating":      { tag: "text-amber-600", check: "text-amber-500" },
  "Command Center":  { tag: "text-accent",    check: "text-accent"    },
};
function styleForCategory(cat: string) {
  return PRICING_CATEGORY_STYLES[cat] ?? { tag: "text-slate-600", check: "text-slate-500" };
}

type PageSectionRaw = { type: string; [key: string]: unknown };
type PublicProduct = {
  product_key: string; display_name: string; category: string; description: string;
  logo_url: string; redirect_url: string; monthly_price: number; discount_price: number;
  coming_soon: boolean; sort_order: number;
  page_content?: { sections: PageSectionRaw[] } | null;
};
type PublicPlan = {
  plan_key: string; display_name: string; category: string; description: string;
  monthly_price: number; annual_price: number; features: string[]; products: string[];
  coming_soon: boolean; sort_order: number;
};

// The backend resolves the actual Stripe price ID by `${planKey}_${billing}`
// lookup_key on every checkout request, so we never hardcode environment-
// specific Stripe IDs in the frontend. To onboard a new Stripe account, run
// `pnpm --filter @workspace/scripts run seed-stripe` against it once.
type HomePlanKey = 'installiq' | 'signsalesiq' | 'signtakeoffiq' | 'fullsuite';



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

const QUOTE_LIMIT = 180;

function TestimonialCard({ testimonial }: { testimonial: { quote: string; author: string; role: string } }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = testimonial.quote.length > QUOTE_LIMIT;
  const displayed = isLong && !expanded ? testimonial.quote.slice(0, QUOTE_LIMIT).trimEnd() + "…" : testimonial.quote;

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} className="bg-card border border-border p-8 rounded-sm shadow-sm flex flex-col">
      <div className="flex gap-1 mb-6 text-accent">
        {[1,2,3,4,5].map((star) => <span key={star}>★</span>)}
      </div>
      <p className="text-foreground/80 leading-relaxed mb-3 italic flex-1">"{displayed}"</p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-accent text-sm font-medium hover:underline text-left mb-6 w-fit"
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
      {!isLong && <div className="mb-6" />}
      <div>
        <h5 className="font-medium">{testimonial.author}</h5>
        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
      </div>
    </motion.div>
  );
}

function calcTimeLeft(expiry: number) {
  const rem = Math.max(0, expiry - Date.now());
  const s = Math.floor(rem / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
function pad(n: number) { return String(n).padStart(2, "0"); }

function HomePlanCountdown({ activePlan, dark = false }: { activePlan: ActivePlan; dark?: boolean }) {
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

// Accepts any string plan_key (admin can add new plans). Stripe checkout
// resolves the price via DB lookup_key on the backend.
function HomePlanButton({ planKey, activePlans, loadingPlan, onCheckout, dark = false }: {
  planKey: string; activePlans: ActivePlan[]; loadingPlan: string | null;
  onCheckout: (key: string) => void; dark?: boolean;
}) {
  const action = getPlanAction(planKey as PlanKey, activePlans);
  const isLoading = loadingPlan === planKey;

  if (action === "current") {
    // Only render the countdown for the exact plan the user purchased — never
    // fall back to fullsuite, otherwise individual cards inherit the wrong
    // renewal date when the user owns Full Suite.
    const match = activePlans.find(p => p.planKey === planKey);
    if (match) return <HomePlanCountdown activePlan={match} dark={dark} />;
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

export default function Home() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  // Live-subscribed list — re-renders the moment a plan is purchased on
  // any tab/page so the Home hero CTA and pricing cards stay current
  // without requiring a manual refresh.
  const activePlans = useActivePlans();
  // Live products + plans, fetched once on mount. Empty arrays render
  // skeletons so the layout doesn't jump while the API responds.
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [plans, setPlans] = useState<PublicPlan[]>([]);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      try {
        const [pRes, plRes] = await Promise.all([
          fetch("/api/public/products", { cache: "no-store" }),
          fetch("/api/public/plans", { cache: "no-store" }),
        ]);
        if (pRes.ok) {
          const rows: PublicProduct[] = await pRes.json();
          if (!cancelled) setProducts(rows);
        }
        if (plRes.ok) {
          const rows: PublicPlan[] = await plRes.json();
          if (!cancelled) setPlans(rows);
        }
      } catch { /* keep empty */ }
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
  const activePlan: ActivePlan | null = activePlans.length > 0 ? activePlans[activePlans.length - 1] : null;
  const [isRegularUser] = useState<boolean>(() => isLoggedIn() && getUser()?.role === "user");
  const [, navigate] = useLocation();

  async function handleCheckout(planKey: string) {
    if (!isLoggedIn()) {
      // savePendingCheckout's PlanKey union is the legacy 4 plans. Newly-
      // added admin plans flow through the same flow at runtime, so we cast.
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

  const individualPlans = plans.filter(p => p.plan_key !== "fullsuite");
  const activeIndividualPlans = individualPlans.filter(p => !p.coming_soon);
  const activeSumCents = activeIndividualPlans
    .reduce((acc, p) => acc + p.monthly_price, 0);
  const fullSumCents = individualPlans
    .reduce((acc, p) => acc + p.monthly_price, 0);
  const activeIndividualCount = activeIndividualPlans.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(28,42,58,0)_0%,rgba(28,42,58,1)_100%)] opacity-50"></div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="max-w-4xl mx-auto text-center"
          >
            <p className="text-accent italic text-xl md:text-2xl font-medium mb-4">AI built for signs, not borrowed from somewhere else.</p>
            <h1 className="text-5xl md:text-7xl font-medium text-white tracking-tight leading-tight mb-6">
              One suite. <br/><span className="text-accent">Three powerful tools.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-4 max-w-2xl mx-auto leading-relaxed">
              The AI-powered platform for sign and graphics industry professionals. Built by industry veterans to replace slow, manual workflows with precision and speed.
            </p>
            <p className="text-brand-cyan italic text-2xl md:text-3xl font-medium mb-10">Better Workflow. Faster Results.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={activePlan ? "/dashboard" : "/pricing"}>
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white uppercase tracking-wider font-medium px-8 h-14 rounded-sm">
                  {activePlan ? "Go to Dashboard" : "Start Free Trial"}
                </Button>
              </Link>
              <a href="#products">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 uppercase tracking-wider font-medium px-8 h-14 rounded-sm bg-transparent">
                  See All Products
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Product cards rendered live from /api/public/products. Admin
                changes (display name, category, description, logo, status,
                "coming soon") appear here on next page load.

                Note: cards use explicit initial/animate (not variants) because
                they mount AFTER the parent's whileInView already fired with
                skeleton placeholders. Without this, late-mounting children
                inherit `hidden` from the parent's variants and stay invisible. */}
            {products.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <motion.div key={i} variants={fadeUp} className="bg-card border border-border rounded-sm p-8 shadow-sm h-[480px] animate-pulse">
                  <div className="h-12 w-32 bg-gray-200 rounded mb-6" />
                  <div className="h-6 w-24 bg-gray-100 rounded mb-4" />
                  <div className="h-7 w-40 bg-gray-200 rounded mb-3" />
                  <div className="h-4 w-full bg-gray-100 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-gray-100 rounded" />
                </motion.div>
              ))
            ) : (
              products.map((p, idx) => {
                const hasBuiltinTheme = !!PRODUCT_THEMES[p.product_key];
                const theme = PRODUCT_THEMES[p.product_key] ?? NEUTRAL_THEME;
                const logo = p.logo_url || PRODUCT_LOGO_FALLBACK[p.product_key] || "";

                // Parse description: first non-empty line = short card text;
                // subsequent non-empty lines = feature bullets (new products).
                const descLines = (p.description ?? "")
                  .split("\n").map(l => l.trim()).filter(Boolean);
                const shortDesc = descLines[0] ?? p.description;
                const descBullets = descLines.slice(1);

                // Feature bullet priority:
                //   1. Hardcoded list (the three original products)
                //   2. Extra lines in the description field
                //   3. Feature sections from the Page Builder
                const builtinFeatures = PRODUCT_HOME_FEATURES[p.product_key];
                const dynamicFeatures: string[] = builtinFeatures ?? (
                  descBullets.length > 0
                    ? descBullets
                    : (p.page_content?.sections ?? [])
                        .filter(s => s.type === "feature" && Array.isArray((s as any).bullets))
                        .flatMap(s => (s as any).bullets as string[])
                        .slice(0, 6)
                );

                // Pull accent color from the hero section of page_content so
                // new products get a colour-consistent card without hardcoding.
                const heroSection = (p.page_content?.sections ?? []).find(s => s.type === "hero");
                const accentHex: string | undefined = (heroSection as any)?.accent_color;

                // Inline styles override the neutral Tailwind palette when we
                // have a dynamic accent but no built-in theme entry.
                const badgeStyle = (!hasBuiltinTheme && accentHex)
                  ? { background: accentHex + "1a", color: accentHex } : undefined;
                const checkStyle = (!hasBuiltinTheme && accentHex)
                  ? { color: accentHex } : undefined;
                const linkStyle = (!hasBuiltinTheme && accentHex)
                  ? { color: accentHex } : undefined;

                // Route to hand-built pages for legacy keys; to the dynamic
                // /products/:key page for everything else (ProductPage renders
                // a clean fallback even when no Page Builder content exists yet).
                const learnPath = PRODUCT_KEY_TO_PATH[p.product_key] ?? `/products/${p.product_key}`;

                return (
                  <motion.div
                    key={p.product_key}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="bg-card border border-border rounded-sm p-8 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
                  >
                    {p.coming_soon && (
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block"></span>
                        Coming Soon
                      </div>
                    )}
                    <div className="h-16 mb-6 flex items-center">
                      {logo
                        ? <img src={logo} alt={p.display_name} className="h-12 object-contain" />
                        : <div className={`px-4 py-2 ${theme.badge} ${theme.badgeText} text-lg font-bold tracking-tight rounded-sm`} style={badgeStyle}>{p.display_name}</div>}
                    </div>
                    <div
                      className={`inline-block px-3 py-1 ${hasBuiltinTheme ? `${theme.badge} ${theme.badgeText}` : "bg-slate-50 text-slate-700"} text-xs font-bold uppercase tracking-widest rounded-sm mb-4`}
                      style={badgeStyle}
                    >
                      {p.category}
                    </div>
                    <h3 className="text-2xl font-medium mb-3">{p.display_name}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">{shortDesc}</p>
                    {dynamicFeatures.length > 0 && (
                      <ul className="space-y-3 mb-8">
                        {dynamicFeatures.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <CheckCircle2
                              className={`w-5 h-5 ${hasBuiltinTheme ? theme.check : "text-slate-500"} shrink-0`}
                              style={checkStyle}
                            />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center justify-between">
                      <Link
                        href={learnPath}
                        className={`inline-flex items-center ${hasBuiltinTheme ? theme.link : "text-slate-600"} font-medium uppercase tracking-wide text-sm group-hover:gap-3 transition-all gap-2`}
                        style={linkStyle}
                      >
                        Learn more <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>
      </section>

      {/* Value Band */}
      <section className="py-24 bg-secondary text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-6">Built for sign professionals end to end</h2>
            <p className="text-white/70 max-w-2xl mx-auto text-lg">
              We eliminated the busywork so you can focus on building great signs and growing your business.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto"
          >
            {["Cloud-Based Sync", "Mobile Ready", "Role-Based Access", "Secure Data", "Export to PDF", "API Integrations"].map((pill, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white/10 backdrop-blur-sm border border-white/20 px-6 py-3 rounded-full text-sm font-medium tracking-wide uppercase">
                {pill}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Trusted by the best in the business</h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {[
              {
                quote: "SignSuiteIQ has completely transformed how we operate. What used to take our sales team 3 days to put together, we're now turning around in 15 minutes. The speed alone has been a game-changer — but it's the accuracy that's really set us apart. With the reference measurement tool, our sales reps no longer need to make multiple site visits just to get dimensions for a sign project. We can pull photos directly from Google Maps or snap them on a phone, and SignSuiteIQ generates a professional mock-up that gives the customer a real sense of what their sign will look like — right on the spot. That combination of speed and presentation has had a direct impact on our bottom line. Our win rate has doubled. Customers see a polished proposal with a realistic visual in the same conversation, and they're ready to say yes. We're closing faster, visiting less, and winning more. SignSuiteIQ didn't just improve our process — it changed the way we sell.",
                author: "VJ",
                role: "FASTSIGNS Plaistow"
              },
              {
                quote: "The automated takeoffs are indistinguishable from magic. What used to take our estimating team a full day now takes 10 minutes. Incredible.",
                author: "Sarah L.",
                role: "Lead Estimator, Horizon Signs"
              },
              {
                quote: "InstalliQ has transformed the way we schedule and manage our installation team. It provides a seamless way to communicate with customers — installers can notify them when they're on their way, keeping everyone informed from start to finish. Our sales team can quickly pull up project completion photos and share them directly with customers, adding a professional touch to every handoff. Best of all, InstalliQ has helped us cut costs by replacing our separate subscriptions to CompanyCam and scheduling software — consolidating everything into one platform that simply works.",
                author: "John",
                role: "FASTSIGNS Waltham"
              }
            ].map((testimonial, i) => (
              <TestimonialCard key={i} testimonial={testimonial} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Preview — hidden for regular "user" role only */}
      {!isRegularUser && (
      <section className="py-24 bg-muted/50 border-y border-border">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">No hidden fees. Cancel anytime.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
          >
            {/* Home pricing preview rendered live from /api/public/plans —
                the same source of truth as the full Pricing page. */}
            {plans.length === 0 ? (
              [...Array(4)].map((_, i) => (
                <motion.div key={i} variants={fadeUp} className="bg-card border border-border rounded-sm p-8 shadow-sm h-[460px] animate-pulse">
                  <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                  <div className="h-6 w-40 bg-gray-200 rounded mb-6" />
                  <div className="h-10 w-32 bg-gray-200 rounded mb-3" />
                </motion.div>
              ))
            ) : (
              plans.map((plan, idx) => {
                const isFullSuite = plan.plan_key === "fullsuite";
                const styles = styleForCategory(plan.category);
                const monthlyDollars = isFullSuite
                  ? Math.round(activeSumCents / 100)
                  : Math.round(plan.monthly_price / 100);
                const discountFrom = !isFullSuite && plan.monthly_price > 0
                  ? Math.round((plan.monthly_price * 1.155) / 100)
                  : isFullSuite ? Math.round(fullSumCents / 100) : 0;
                return (
                  <motion.div
                    key={plan.plan_key}
                    // Per-card whileInView so cards animate as user scrolls,
                    // even when mounted late after the public/plans fetch.
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
                        <div className="mb-1 flex items-baseline gap-2">
                          {(isFullSuite ? fullSumCents > 0 : discountFrom > monthlyDollars) && (
                            <span className={`text-2xl font-medium line-through ${isFullSuite ? "text-white/50" : "text-muted-foreground"}`}>
                              ${discountFrom}
                            </span>
                          )}
                          <span className="text-4xl font-bold">${monthlyDollars}</span>
                          <span className={isFullSuite ? "text-white/60" : "text-muted-foreground"}>/mo</span>
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
                      <HomePlanButton
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

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mt-10"
          >
            <Link href="/pricing">
              <Button variant="outline" className="rounded-sm uppercase tracking-wider text-xs px-8 h-10">
                See full pricing details →
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
      )}

      {/* CTA */}
      <section className="py-24 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(232,147,44,0.15)_0%,rgba(28,42,58,1)_100%)]"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl font-medium text-white tracking-tight mb-8">Ready to visualize the win?</h2>
          <Link href={activePlan ? "/dashboard" : "/pricing"}>
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-white uppercase tracking-wider font-medium px-10 h-14 rounded-sm text-lg shadow-lg">
              {activePlan ? "Go to Dashboard" : "Start Your Free Trial"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
