import { Link, useLocation } from "wouter";
import { Menu, X, LogIn, LayoutDashboard, ChevronDown, LogOut } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import logoFull from "@assets/SignSuiteIQ_v4_clean_no_icons_1776093556689.png";
import { isLoggedIn, getUser, logout } from "@/lib/auth";
import { getActivePlans, PLAN_LABELS, type ActivePlan } from "@/lib/activePlan";

// Default product list rendered before /api/public/products responds. Keeps
// the dropdown from flashing empty on first paint and acts as a fallback if
// the API is briefly unreachable. Once the fetch resolves, the live admin-
// edited list replaces it.
type NavProduct = { name: string; path: string; desc: string };
const FALLBACK_PRODUCTS: NavProduct[] = [
  { name: "InstalliQ.ai",   path: "/products/installiq",     desc: "Installation management" },
  { name: "SignSalesIQ",    path: "/products/signsalesiq",   desc: "Sales intelligence" },
  { name: "SignTakeoffIQ",  path: "/products/signtakeoffiq", desc: "AI plan takeoffs" },
];

// Map a product_key from the DB to the marketing page URL on this site.
// All products route through /products/:key — see Home.tsx for context.
const PRODUCT_KEY_TO_PATH: Record<string, string> = {};
// For admin-created products: always use /products/:key so the link works
// whether or not the Page Builder has been used yet.
function pathForProductKey(key: string): string {
  return PRODUCT_KEY_TO_PATH[key] ?? `/products/${key}`;
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isRegularUser, setIsRegularUser] = useState(false);
  const [activePlans, setActivePlansState] = useState<ActivePlan[]>([]);
  const [products, setProducts] = useState<NavProduct[]>(FALLBACK_PRODUCTS);
  const activePlan: ActivePlan | null = activePlans.length > 0 ? activePlans[activePlans.length - 1] : null;
  const planBadgeLabel =
    activePlans.length === 0
      ? ""
      : activePlans.length === 1
        ? PLAN_LABELS[activePlans[0].planKey]
        : activePlans.some(p => p.planKey === "fullsuite")
          ? PLAN_LABELS.fullsuite
          : `${activePlans.length} plans`;
  const [location, navigate] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const li = isLoggedIn();
    setLoggedIn(li);
    setIsRegularUser(li && getUser()?.role === "user");
    setActivePlansState(li ? getActivePlans() : []);
  }, [location]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Pull live product list (and re-pull on every route change so admin edits
  // appear without a hard refresh after navigating away from /admin).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/products", { cache: "no-store" });
        if (!res.ok) return;
        const rows: Array<{
          product_key: string; display_name: string; category: string;
          description: string; coming_soon?: boolean;
        }> = await res.json();
        if (cancelled) return;
        const mapped: NavProduct[] = rows
          .map(r => ({
            name: r.display_name,
            path: pathForProductKey(r.product_key),
            desc: r.coming_soon ? "Coming soon" : (r.category || r.description || ""),
          }));
        if (mapped.length) setProducts(mapped);
      } catch { /* keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, [location]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isHome = location === "/";
  const isDark = location === "/signtakeoffiq";
  const isDashboard = location === "/dashboard";
  const forceLight = scrolled || isDashboard || isHome;
  const textColor = forceLight ? "text-foreground/80" : isDark ? "text-white/90" : "text-foreground/80";

  const navLinks = [
    ...(isRegularUser ? [] : [{ name: "Pricing", path: "/pricing" }]),
    { name: "About", path: "/about" },
  ];

  function handleNavLogout() {
    logout();
    setLoggedIn(false);
    setActivePlansState([]);
    navigate("/");
  }

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        forceLight
          ? "bg-white/95 backdrop-blur-md border-b border-border shadow-sm"
          : isDark
          ? "bg-[#1C1C1C] border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              {forceLight || !isHome ? (
                <>
                  <div className="w-8 h-8 rounded bg-primary flex items-center justify-center overflow-hidden">
                    <div className="flex items-end gap-[2px] h-5">
                      <div className="w-[3px] h-2 bg-brand-cyan rounded-t-sm"></div>
                      <div className="w-[3px] h-3 bg-brand-cyan rounded-t-sm"></div>
                      <div className="w-[3px] h-4 bg-[#2E86C1] rounded-t-sm"></div>
                      <div className="w-[3px] h-5 bg-accent rounded-t-sm"></div>
                    </div>
                  </div>
                  <span className={`font-semibold text-xl tracking-tight ${isDark && !scrolled ? "text-white" : "text-primary"}`}>
                    SignSuite<span className="text-brand-cyan">IQ</span>
                  </span>
                </>
              ) : (
                <img src={logoFull} alt="SignSuiteIQ" className="h-[84px] w-auto object-contain" />
              )}
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {/* Home link — hidden on home page */}
            {!isHome && (
              <Link
                href="/"
                className={`text-sm font-medium tracking-wide uppercase transition-colors hover:text-accent ${textColor}`}
              >
                Home
              </Link>
            )}

            {/* Products Dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                className={`flex items-center gap-1 text-sm font-medium tracking-wide uppercase transition-colors hover:text-accent ${textColor}`}
                onClick={() => setProductsOpen((v) => !v)}
              >
                Products
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${productsOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {productsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-white rounded-sm border border-border shadow-lg overflow-hidden"
                  >
                    {products.map((p) => (
                      <Link
                        key={p.path}
                        href={p.path}
                        onClick={() => setProductsOpen(false)}
                        className="flex flex-col px-4 py-3.5 hover:bg-muted/50 transition-colors border-b border-border last:border-0 group"
                      >
                        <span className="text-sm font-bold text-foreground group-hover:text-accent transition-colors tracking-wide">{p.name}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">{p.desc}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.path}
                className={`text-sm font-medium tracking-wide uppercase transition-colors hover:text-accent ${
                  location === link.path ? "text-accent" : textColor
                }`}
              >
                {link.name}
              </Link>
            ))}

            <Link href={loggedIn ? "/dashboard" : "/login"}>
              <Button variant="ghost" className={`font-medium tracking-wide uppercase text-sm gap-2 ${forceLight ? "text-foreground/80 hover:text-foreground" : (isHome || isDark) ? "text-white/90 hover:text-white" : "text-foreground/80 hover:text-foreground"}`}>
                {loggedIn ? <LayoutDashboard className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                {loggedIn ? "Dashboard" : "Login"}
              </Button>
            </Link>
            {loggedIn && activePlan ? (
              <Link href="/dashboard">
                <div className="flex items-center gap-2 border border-accent/40 bg-accent/10 rounded-sm px-4 py-2 hover:bg-accent/20 transition-colors cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span className="text-sm font-semibold text-accent tracking-wide">{planBadgeLabel}</span>
                  <span className="text-xs text-accent/70 capitalize">· {activePlan.billingPeriod}</span>
                </div>
              </Link>
            ) : !isRegularUser ? (
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              >
                <Link href="/pricing">
                  <Button className="bg-accent hover:bg-accent/90 text-white rounded-sm px-6 font-medium tracking-wide uppercase shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                    Start Free Trial
                  </Button>
                </Link>
              </motion.div>
            ) : null}

            {loggedIn && (
              <button
                onClick={handleNavLogout}
                title="Sign Out"
                className={`flex items-center gap-1.5 text-sm font-medium tracking-wide uppercase transition-colors hover:text-red-500 ${textColor}`}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            )}
          </nav>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 ${forceLight ? "text-foreground" : (isHome || isDark) ? "text-white" : "text-foreground"}`}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-border overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {/* Home link — hidden on home page */}
              {!isHome && (
                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className="block text-base font-medium uppercase tracking-wide text-foreground/80 hover:text-accent py-2"
                >
                  Home
                </Link>
              )}

              {/* Products expandable */}
              <button
                onClick={() => setMobileProductsOpen((v) => !v)}
                className="flex items-center justify-between w-full text-base font-medium uppercase tracking-wide text-foreground/80 hover:text-accent py-2"
              >
                Products
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileProductsOpen ? "rotate-180" : ""}`} />
              </button>
              {mobileProductsOpen && (
                <div className="space-y-1 pb-1">
                  {products.map((p) => (
                    <Link
                      key={p.path}
                      href={p.path}
                      onClick={() => { setIsOpen(false); setMobileProductsOpen(false); }}
                      className="block pl-4 py-2 text-sm font-bold tracking-wide text-foreground/80 hover:text-accent"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.path}
                  onClick={() => setIsOpen(false)}
                  className="block text-base font-medium uppercase tracking-wide text-foreground/80 hover:text-accent py-2"
                >
                  {link.name}
                </Link>
              ))}
              <Link href={loggedIn ? "/dashboard" : "/login"} onClick={() => setIsOpen(false)}>
                <div className="flex items-center gap-2 text-base font-medium uppercase tracking-wide text-foreground/80 hover:text-accent py-2">
                  {loggedIn ? <LayoutDashboard className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {loggedIn ? "Dashboard" : "Login"}
                </div>
              </Link>
              <div className="pt-2 space-y-2">
                {loggedIn && activePlan ? (
                  <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                    <div className="flex items-center gap-2 border border-accent/40 bg-accent/10 rounded-sm px-4 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      <span className="text-sm font-semibold text-accent">{planBadgeLabel}</span>
                      <span className="text-xs text-accent/70 capitalize ml-1">· {activePlan.billingPeriod}</span>
                    </div>
                  </Link>
                ) : !isRegularUser ? (
                  <Link href="/pricing" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-accent hover:bg-accent/90 text-white rounded-sm font-medium uppercase tracking-wide">
                      Start Free Trial
                    </Button>
                  </Link>
                ) : null}
                {loggedIn && (
                  <button
                    onClick={() => { setIsOpen(false); handleNavLogout(); }}
                    className="flex items-center gap-2 w-full text-base font-medium uppercase tracking-wide text-red-500/80 hover:text-red-600 py-2"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
