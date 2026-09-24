import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Lock, Mail, Eye, EyeOff, ArrowRight, ShieldCheck, Zap, BarChart3, Users, ScanFace } from "lucide-react";

import logoFull from "@assets/SignSuiteIQ_v4_clean_no_icons_1776093556689.png";
import installiQLogo from "@assets/InstalliQ_Logo_nobg.png";
import signSalesLogo from "@assets/SignSalesIQ_Logo_nobg.png";
import signTakeoffLogo from "@assets/SignTakeoffIQ_Logo_nobg.png";
import { saveUser, validateCredentials, isLoggedIn, getRememberedLogin, setRememberedLogin } from "@/lib/auth";
import { getPendingCheckout, clearPendingCheckout } from "@/lib/pendingCheckout";
import { savePendingActivation, type PlanKey } from "@/lib/activePlan";
import FaceLockModal from "@/components/FaceLockModal";
import { prewarmFaceModels } from "@/lib/faceModels";

// The backend resolves the actual Stripe price ID by `${planKey}_${billing}`
// lookup_key on every checkout request, so we never hardcode environment-
// specific Stripe IDs in the frontend. To onboard a new Stripe account, run
// `pnpm --filter @workspace/scripts run seed-stripe` against it once.

/* ─── Constants ──────────────────────────────────────────────────── */
const PHRASES = ["AI-Powered Takeoffs", "Instant Proposals", "Field Proof Scheduling", "Precision Estimating"];

const FEATURES = [
  { icon: Zap,         title: "AI-Powered Workflow",  desc: "Automate takeoffs, proposals, and field scheduling." },
  { icon: ShieldCheck, title: "Secure & Reliable",    desc: "Enterprise security with role-based access control." },
  { icon: BarChart3,   title: "Real-Time Visibility", desc: "Live dashboards and reporting across every job." },
  { icon: Users,       title: "Built for Sign Teams", desc: "Manage estimates, sales, and installs across multiple projects — one account." },
];

const PRODUCT_LOGOS = [
  { src: installiQLogo,   label: "InstalliQ.ai",   sub: "Field Proof"  },
  { src: signSalesLogo,   label: "SignSalesIQ",     sub: "Sales"        },
  { src: signTakeoffLogo, label: "SignTakeoffIQ",   sub: "Estimating"   },
];

const PARTICLES = [
  { w: 3, left: 8,  dur: 7,  delay: 0    },
  { w: 2, left: 18, dur: 9,  delay: 0.8  },
  { w: 4, left: 27, dur: 6,  delay: 1.6  },
  { w: 2, left: 36, dur: 11, delay: 0.3  },
  { w: 3, left: 45, dur: 8,  delay: 2.1  },
  { w: 2, left: 54, dur: 7,  delay: 1.0  },
  { w: 4, left: 63, dur: 10, delay: 2.8  },
  { w: 2, left: 72, dur: 6,  delay: 0.5  },
  { w: 3, left: 81, dur: 9,  delay: 1.9  },
  { w: 2, left: 90, dur: 7,  delay: 3.2  },
];

/* ─── CSS Keyframes ──────────────────────────────────────────────── */
const CSS = `
  @keyframes aurora1 {
    0%,100%{transform:translate(0px,0px) scale(1)}
    33%{transform:translate(60px,40px) scale(1.12)}
    66%{transform:translate(-35px,55px) scale(0.9)}
  }
  @keyframes aurora2 {
    0%,100%{transform:translate(0px,0px) scale(1)}
    33%{transform:translate(-50px,25px) scale(0.85)}
    66%{transform:translate(45px,-25px) scale(1.15)}
  }
  @keyframes aurora3 {
    0%,100%{transform:translate(0px,0px) scale(1)}
    50%{transform:translate(35px,-55px) scale(1.2)}
  }
  @keyframes float-particle {
    0%{transform:translateY(0) scale(1);opacity:0.7}
    80%{opacity:0.4}
    100%{transform:translateY(-110vh) scale(0.4);opacity:0}
  }
  @keyframes orb1{0%,100%{transform:translateY(0px)}50%{transform:translateY(-22px)}}
  @keyframes orb2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-32px)}}
  @keyframes orb3{0%,100%{transform:translateY(0px)}50%{transform:translateY(-16px)}}
  @keyframes shimmer-btn {
    0%{left:-80%} 100%{left:180%}
  }
  @keyframes card-glow {
    0%,100%{box-shadow:0 25px 50px rgba(0,0,0,0.10),0 0 0 0px rgba(232,147,44,0)}
    50%{box-shadow:0 25px 50px rgba(0,0,0,0.12),0 0 0 3px rgba(232,147,44,0.2)}
  }
  @keyframes gradient-text {
    0%{background-position:0% 50%}
    50%{background-position:100% 50%}
    100%{background-position:0% 50%}
  }
  @keyframes or-shimmer {
    0%{background-position:-200% center}
    100%{background-position:200% center}
  }
  @keyframes check-draw {
    from{stroke-dashoffset:20;opacity:0}
    to{stroke-dashoffset:0;opacity:1}
  }
  @keyframes ripple-out {
    0%{transform:scale(0);opacity:0.55}
    100%{transform:scale(5);opacity:0}
  }
  .feat-item{transition:transform 0.18s ease}
  .feat-item:hover{transform:translateX(5px)}
  .stat-item{transition:transform 0.18s ease,background 0.18s ease;border-radius:10px;padding:6px 4px;cursor:default}
  .stat-item:hover{transform:scale(1.08);background:rgba(232,147,44,0.09)}
  .input-wrap{transition:transform 0.15s ease}
  .input-wrap:focus-within{transform:scale(1.015)}
  .arrow-icon{transition:transform 0.2s ease}
  button:hover .arrow-icon{transform:translateX(3px)}
  @media(prefers-reduced-motion:reduce){
    *{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}
  }
`;

/* ─── Component ──────────────────────────────────────────────────── */
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);
  const [email,              setEmail]        = useState("");
  const [password,           setPassword]     = useState("");
  const [signingIn,          setSigningIn]    = useState(false);
  const [errorMsg,           setErrorMsg]     = useState("");
  const [hasPendingCheckout, setHasPendingCheckout] = useState(false);
  const [showFaceLock,       setShowFaceLock] = useState(false);
  const [showForgot,         setShowForgot]   = useState(false);
  const [forgotEmail,        setForgotEmail]  = useState("");
  const [forgotBusy,         setForgotBusy]   = useState(false);
  const [forgotMsg,          setForgotMsg]    = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submitForgot = async () => {
    if (!forgotEmail.trim()) {
      setForgotMsg({ kind: "err", text: "Please enter your email." });
      return;
    }
    setForgotBusy(true);
    setForgotMsg(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setForgotMsg({
          kind: "ok",
          text: data.message || "If an account with that email exists, a new password has been emailed to you.",
        });
      } else {
        setForgotMsg({ kind: "err", text: data.error || "Could not process the request. Please try again." });
      }
    } catch {
      setForgotMsg({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setForgotBusy(false);
    }
  };
  const [, navigate]                           = useLocation();

  const handleFaceLockSuccess = (user: { id: number; email: string; username: string; name: string; role: string; jobTitle?: string | null; companyId: number | null; apps: string[]; allowedApps?: string[]; planKey?: string | null }) => {
    setShowFaceLock(false);
    saveUser({
      id: user.id, email: user.email, username: user.username,
      name: user.name, role: user.role, isMaster: false,
      jobTitle: user.jobTitle ?? null,
      companyId: user.companyId, companyName: null,
      faceEnabled: true, apps: user.apps,
      allowedApps: user.allowedApps ?? user.apps,
      planKey: user.planKey ?? null,
    });
    // Hydrate the local active-plans cache from the server's entitlements.
    import("@/lib/activePlan")
      .then(m => m.syncActivePlansFromAllowedApps(user.allowedApps ?? user.apps ?? []))
      .catch(() => {});
    navigate("/");
  };

  useEffect(() => {
    const pending = getPendingCheckout();
    setHasPendingCheckout(!!pending);
    if (!pending && isLoggedIn()) {
      navigate("/");
      return;
    }
    // Pre-fill the email + checkbox from the previous "Remember me" sign-in.
    const remembered = getRememberedLogin();
    if (remembered) {
      setEmail(remembered.email);
      setRememberMe(true);
    }
    // Pre-warm the face-recognition models in the background so that when
    // the user taps "Face Unlock" the modal opens almost instantly instead
    // of waiting for ~6.7MB of model files to download.
    prewarmFaceModels();
  }, []);

  /* Typewriter */
  const [display,    setDisplay]    = useState("");
  const [phraseIdx,  setPhraseIdx]  = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  /* (stats removed) */

  /* Constellation canvas */
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);

  /* Mouse spotlight */
  const rightRef     = useRef<HTMLDivElement>(null);
  const [spot,  setSpot]  = useState({ x: -999, y: -999 });

  /* Card tilt */
  const cardRef      = useRef<HTMLDivElement>(null);
  const [tilt,  setTilt]  = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  /* Ripple */
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);

  /* ── Typewriter ──────────────────────────────── */
  useEffect(() => {
    const phrase = PHRASES[phraseIdx];
    const speed  = isDeleting ? 40 : 80;
    const timer  = setTimeout(() => {
      if (!isDeleting) {
        const next = phrase.slice(0, display.length + 1);
        setDisplay(next);
        if (next === phrase) setTimeout(() => setIsDeleting(true), 2000);
      } else {
        const next = display.slice(0, -1);
        setDisplay(next);
        if (next === "") {
          setIsDeleting(false);
          setPhraseIdx(i => (i + 1) % PHRASES.length);
        }
      }
    }, speed);
    return () => clearTimeout(timer);
  }, [display, isDeleting, phraseIdx]);

  /* ── Constellation canvas ────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type Dot = { x: number; y: number; vx: number; vy: number; r: number };
    const dots: Dot[] = Array.from({ length: 22 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r:  0.8 + Math.random() * 1.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width)  d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
      });
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.strokeStyle = `rgba(232,147,44,${(1 - d / 100) * 0.18})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
          }
        }
      }
      dots.forEach(d => {
        ctx.fillStyle = "rgba(232,147,44,0.3)";
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, []);

  /* ── Mouse spotlight ─────────────────────────── */
  const handleRightMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = rightRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  /* ── Card tilt ───────────────────────────────── */
  const handleCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r  = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
    const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
    setTilt({ x: dy * 8, y: -dx * 8 });
    setGlare({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const handleCardLeave = () => { setTilt({ x: 0, y: 0 }); setHovered(false); };

  /* ── Ripple + Login ──────────────────────────── */
  const handleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const r  = e.currentTarget.getBoundingClientRect();
    const id = ++nextId.current;
    setRipples(p => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 700);

    if (!email.trim() || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }
    setErrorMsg("");
    setSigningIn(true);

    try {
      // ── Authenticate against real database ──────────────────────────
      const authRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const authData = await authRes.json();

      if (!authRes.ok) {
        setErrorMsg(authData.error ?? "Invalid email or password. Please try again.");
        return;
      }

      saveUser(authData.user);

      // Persist (or clear) the email for next visit based on the "Remember me" choice.
      setRememberedLogin(rememberMe, authData.user?.email ?? email);

      // Hydrate the local active-plans cache from the server's entitlements so
      // the navbar / pricing page reflect every plan the user already owns.
      try {
        const { syncActivePlansFromAllowedApps } = await import("@/lib/activePlan");
        syncActivePlansFromAllowedApps(authData.user?.allowedApps ?? authData.user?.apps ?? []);
      } catch { /* ignore */ }

      const pending = getPendingCheckout();
      if (pending) {
        clearPendingCheckout();
        savePendingActivation(pending.planKey as PlanKey, "monthly");
        const base     = window.location.origin;
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
        const successUrl = `${base}${basePath}/pricing?success=1`;
        const cancelUrl  = `${base}${basePath}/pricing?canceled=1`;
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planKey:   pending.planKey,
            billing:   "monthly",
            successUrl, cancelUrl,
            userId:    authData.user.id,
            userEmail: authData.user.email,
          }),
        });
        const payload = await res.json().catch(() => ({} as { url?: string; error?: string }));
        if (!res.ok || !payload?.url) {
          throw new Error(payload?.error?.toString().trim() || `Checkout failed (HTTP ${res.status})`);
        }
        window.location.href = payload.url;
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex">
      <style>{CSS}</style>

      {/* ════ Left Panel ════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[42%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(145deg,#1C2A3A 0%,#152231 100%)" }}>

        {/* Aurora blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[500px] h-[500px] rounded-full -top-40 -left-40 opacity-[0.13]"
            style={{ background: "radial-gradient(circle,#E8932C,transparent 65%)", animation: "aurora1 13s ease-in-out infinite" }} />
          <div className="absolute w-[380px] h-[380px] rounded-full opacity-[0.08] top-1/2 -right-20"
            style={{ background: "radial-gradient(circle,#29ABE2,transparent 65%)", animation: "aurora2 16s ease-in-out infinite" }} />
          <div className="absolute w-[340px] h-[340px] rounded-full opacity-[0.07] -bottom-24 left-1/3"
            style={{ background: "radial-gradient(circle,#E8932C,transparent 65%)", animation: "aurora3 11s ease-in-out infinite" }} />
        </div>

        {/* Constellation */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                width: p.w, height: p.w,
                left:  `${p.left}%`, bottom: 0,
                background: "rgba(232,147,44,0.45)",
                animation: `float-particle ${p.dur}s ${p.delay}s ease-in infinite`,
              }} />
          ))}
        </div>

        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-28 h-28 rounded-full blur-3xl opacity-25"
            style={{ background: "#E8932C", bottom: "14%", left: "8%",  animation: "orb1 8s ease-in-out infinite" }} />
          <div className="absolute w-22 h-22 rounded-full blur-2xl opacity-15"
            style={{ background: "#29ABE2", top: "28%",   right: "4%",  animation: "orb2 10s ease-in-out infinite" }} />
          <div className="absolute w-16 h-16 rounded-full blur-2xl opacity-12"
            style={{ background: "#E8932C", top: "8%",    right: "18%", animation: "orb3 12s ease-in-out infinite" }} />
        </div>

        {/* ── Content area ── */}
        <div className="relative z-10 flex-1 min-h-0 overflow-hidden px-8 pt-6 pb-3">
          <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Link href="/">
              <img src={logoFull} alt="SignSuiteIQ" className="h-10 w-auto object-contain object-left mb-3" />
            </Link>
          </motion.div>

          {/* Gradient heading */}
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="text-2xl font-semibold tracking-tight leading-tight mb-0"
            style={{
              background: "linear-gradient(90deg,#ffffff 0%,#E8932C 40%,#29ABE2 70%,#ffffff 100%)",
              backgroundSize: "200%",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              animation: "gradient-text 6s ease infinite",
            }}>
            The Complete<br />Sign Business<br />Platform
          </motion.h1>

          {/* Typewriter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="mb-4 h-5 flex items-center mt-1">
            <span className="text-xs font-medium" style={{ color: "rgba(232,147,44,0.9)" }}>
              {display}<span className="animate-pulse ml-0.5 opacity-70">|</span>
            </span>
          </motion.div>

          {/* Features */}
          <ul className="space-y-2">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.li key={title}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
                className="feat-item flex items-start gap-2.5">
                <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(232,147,44,0.18)" }}>
                  <Icon className="w-3 h-3" style={{ color: "#E8932C" }} />
                </div>
                <div>
                  <p className="font-medium text-[11px] mb-0.5" style={{ color: "#E8932C" }}>{title}</p>
                  <p className="text-white/50 text-[11px] leading-snug">{desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* ── Footer ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}
          className="relative z-10 shrink-0"
          style={{ background: "#ffffff" }}
        >
          {/* Orange gradient accent line */}
          <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg,#E8932C 0%,#f5b96e 50%,#E8932C 100%)" }} />

          <div className="px-6 pt-2.5 pb-3">
            <p className="text-[8px] uppercase tracking-widest text-center mb-2" style={{ color: "#94a3b8" }}>Powered by the SignSuiteIQ Platform</p>
            <div className="grid grid-cols-3 gap-2">
              {PRODUCT_LOGOS.map(({ src, label, sub }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl cursor-pointer transition-all duration-150"
                  style={{ border: "1px solid #f1f5f9", background: "#fafafa" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(232,147,44,0.4)"; (e.currentTarget as HTMLDivElement).style.background = "#fff"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(232,147,44,0.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#f1f5f9"; (e.currentTarget as HTMLDivElement).style.background = "#fafafa"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                >
                  <div className="w-full flex items-center justify-center" style={{ height: 32 }}>
                    <img src={src} alt={label} className="w-auto object-contain" style={{ maxHeight: 28, maxWidth: "100%" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-semibold leading-tight" style={{ color: "#1C2A3A" }}>{label}</p>
                    <p className="text-[7px] uppercase tracking-wider leading-tight" style={{ color: "#E8932C" }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ════ Right Panel ═══════════════════════════════════════════ */}
      <div ref={rightRef}
        className="flex-1 flex flex-col items-center px-6 relative overflow-y-auto"
        style={{ background: "#F5F3EF", scrollbarWidth: "none" }}
        onMouseMove={handleRightMouseMove}>

        {/* Mouse spotlight */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(700px circle at ${spot.x}px ${spot.y}px, rgba(232,147,44,0.07) 0%, transparent 70%)`,
            transition: "background 700ms ease",
          }} />

        {/* Decorative asterisk */}
        <motion.div className="absolute top-6 right-8 text-2xl select-none"
          style={{ color: "#d6d0c4" }}
          initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}>✳</motion.div>

        <motion.div className="w-full max-w-[420px] my-auto py-5"
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>

          {/* ── Card ── */}
          <div ref={cardRef}
            className="bg-white rounded-2xl px-7 py-4 relative overflow-hidden"
            onMouseMove={handleCardMove}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={handleCardLeave}
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 0.12s ease",
              animation: "card-glow 3s ease-in-out infinite",
            }}>

            {/* Glare overlay */}
            {hovered && (
              <div className="absolute inset-0 rounded-2xl pointer-events-none z-30"
                style={{ background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.2) 0%, transparent 55%)` }} />
            )}

            {/* Lock icon */}
            <motion.div className="flex justify-center mb-2"
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.18 }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(232,147,44,0.12)" }}>
                <Lock className="w-4 h-4" style={{ color: "#E8932C" }} />
              </div>
            </motion.div>

            <motion.h2 className="text-lg font-semibold text-center mb-0.5" style={{ color: "#1C2A3A" }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              Welcome back
            </motion.h2>
            <motion.p className="text-center text-xs mb-3" style={{ color: "#94a3b8" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
              Sign in to your account to continue
            </motion.p>

            {hasPendingCheckout && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="mb-4 rounded-lg px-3 py-2.5 text-xs text-center font-medium"
                style={{ background: "rgba(232,147,44,0.12)", color: "#b45309", border: "1px solid rgba(232,147,44,0.3)" }}>
                Sign in to complete your purchase and get started.
              </motion.div>
            )}

            {/* Email */}
            <motion.div className="mb-2 input-wrap"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <label className="block text-xs font-medium mb-1" style={{ color: "#1C2A3A" }}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
                <input type="email" placeholder="Enter your email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
                  style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#1C2A3A" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#E8932C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,147,44,0.15)"; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div className="mb-2 input-wrap"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <label className="block text-xs font-medium mb-1" style={{ color: "#1C2A3A" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
                <input type={showPassword ? "text" : "password"} placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm outline-none transition-all"
                  style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#1C2A3A" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#E8932C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,147,44,0.15)"; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }}>
                  <AnimatePresence mode="wait">
                    <motion.span key={showPassword ? "off" : "on"}
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}>
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>

            {/* Remember + Forgot */}
            <motion.div className="flex items-center justify-between mb-2"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={rememberMe}
                  onChange={() => {
                    const next = !rememberMe;
                    setRememberMe(next);
                    // Persist immediately so unchecking on a shared computer
                    // takes effect even before the next sign-in.
                    setRememberedLogin(next, email);
                  }}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-orange-500" />
                <span className="text-xs" style={{ color: "#64748b" }}>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setForgotMsg(null); setShowForgot(true); }}
                className="text-xs font-medium hover:underline"
                style={{ color: "#E8932C" }}
              >
                Forgot password?
              </button>
            </motion.div>

            {/* Error message */}
            {errorMsg && (
              <p className="text-xs text-red-500 mb-2 text-center">{errorMsg}</p>
            )}

            {/* Sign In button */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-white text-xs uppercase tracking-wider relative overflow-hidden disabled:opacity-70"
                style={{ background: "#E8932C" }}
                whileHover={{ scale: signingIn ? 1 : 1.02 }} whileTap={{ scale: signingIn ? 1 : 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                disabled={signingIn}
                onClick={handleSignIn}>
                {/* Shimmer sweep */}
                {!signingIn && (
                  <span className="absolute top-0 h-full w-10 bg-white/30 blur-sm -skew-x-12 pointer-events-none"
                    style={{ animation: "shimmer-btn 2.5s ease-in-out infinite" }} />
                )}
                {/* Ripples */}
                {ripples.map(r => (
                  <span key={r.id} className="absolute rounded-full bg-white/45 pointer-events-none"
                    style={{ width: 36, height: 36, left: r.x - 18, top: r.y - 18, animation: "ripple-out 0.65s ease-out forwards" }} />
                ))}
                {signingIn ? (
                  <span className="relative z-10 flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <>
                    <ArrowRight className="arrow-icon w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">Sign In</span>
                  </>
                )}
              </motion.button>
            </motion.div>

            {/* OR — shimmer lines */}
            <motion.div className="flex items-center gap-3 my-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <div className="flex-1 h-px rounded"
                style={{ background: "linear-gradient(90deg,#e2e8f0 0%,#E8932C 50%,#e2e8f0 100%)", backgroundSize: "200%", animation: "or-shimmer 3s linear infinite" }} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>or</span>
              <div className="flex-1 h-px rounded"
                style={{ background: "linear-gradient(90deg,#e2e8f0 0%,#E8932C 50%,#e2e8f0 100%)", backgroundSize: "200%", animation: "or-shimmer 3s linear infinite reverse" }} />
            </motion.div>

            {/* Face Lock */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41 }}>
              <motion.button
                onClick={() => setShowFaceLock(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-medium relative overflow-hidden"
                style={{ borderColor: "rgba(232,147,44,0.35)", color: "#b45309", background: "rgba(232,147,44,0.05)" }}
                whileHover={{ scale: 1.01, backgroundColor: "rgba(232,147,44,0.1)" }} whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <ScanFace className="w-3.5 h-3.5" style={{ color: "#E8932C" }} />
                Login with Face Lock
              </motion.button>
            </motion.div>

            {/* Trust badges — SVG check draw */}
            <motion.div className="flex items-center justify-center gap-4 mt-2.5 pt-2.5 border-t"
              style={{ borderColor: "#f1f5f9" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}>
              {["256-bit SSL", "SOC 2 Ready", "99.9% Uptime"].map((badge, i) => (
                <div key={badge} className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="#22c55e" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ strokeDasharray: 20, strokeDashoffset: 20, animation: `check-draw 0.5s ${1.1 + i * 0.15}s ease forwards` }} />
                  </svg>
                  <span className="text-[10px]" style={{ color: "#94a3b8" }}>{badge}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Below card */}
          <motion.div className="text-center mt-2 space-y-0.5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.46 }}>
            <div className="flex items-center justify-center gap-3">
              <Link href="/privacy-policy" className="text-[11px] hover:underline" style={{ color: "#94a3b8" }}>Privacy Policy</Link>
              <span style={{ color: "#d1d5db" }}>·</span>
              <Link href="/terms-of-service" className="text-[11px] hover:underline" style={{ color: "#94a3b8" }}>Terms & Conditions</Link>
            </div>
            <p className="text-[11px]" style={{ color: "#b0b8c8" }}>Powered by SignSuiteIQ.ai — AI Built for Signs</p>
          </motion.div>

          <motion.p className="text-center mt-2.5 text-xs" style={{ color: "#64748b" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}>
            Don't have an account?{" "}
            <Link href="/pricing" className="font-semibold hover:underline" style={{ color: "#E8932C" }}>Start free trial</Link>
          </motion.p>

          <motion.div className="text-center mt-2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs hover:underline transition-colors"
              style={{ color: "#94a3b8" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Home
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Face Lock Modal */}
      {showFaceLock && (
        <FaceLockModal
          onClose={() => setShowFaceLock(false)}
          onSuccess={handleFaceLockSuccess}
        />
      )}

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !forgotBusy && setShowForgot(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-[#1C2A3A] flex items-center gap-2">
                  <Lock className="w-4 h-4" style={{ color: "#E8932C" }} />
                  Forgot your password?
                </h2>
                <button
                  type="button"
                  onClick={() => !forgotBusy && setShowForgot(false)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <ScanFace className="hidden" />
                  <span className="block w-4 h-4 leading-none text-base">×</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Enter the email address on your account. We'll email you a new temporary password right away.
              </p>

              <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
              <div className="relative mb-3">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  autoFocus
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !forgotBusy) submitForgot(); }}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                  disabled={forgotBusy}
                />
              </div>

              {forgotMsg && (
                <p
                  className={`text-xs mb-3 ${forgotMsg.kind === "ok" ? "text-green-600" : "text-red-500"}`}
                >
                  {forgotMsg.text}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => !forgotBusy && setShowForgot(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-gray-200"
                  disabled={forgotBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitForgot}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                  style={{ background: "#E8932C" }}
                  disabled={forgotBusy}
                >
                  {forgotBusy ? "Sending…" : "Email new password"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
