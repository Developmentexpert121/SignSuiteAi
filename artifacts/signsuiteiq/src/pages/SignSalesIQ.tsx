import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Check, ShieldCheck, Zap, Users, LayoutDashboard, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import signSalesLogo from "@assets/SignSalesIQ_logo_transparent_1776110103357.png";
import dashboardImg from "@assets/Dashboards_photo_1776107866108.jpg";
import signCodeImg from "@assets/LocalSignCodeScreenShot_1776107866109.jpg";
import loginImg from "@assets/login_Page_1776107866109.jpg";
import mockup2Img from "@assets/Mockup_2_1776107866109.jpg";
import mockupImg from "@assets/Mockup_1776107866109.jpg";
import newOpportunityImg from "@assets/NewOpportunityPhoto_1776107866110.jpg";
import pdfImg from "@assets/PDF_Printout__1776107866110.jpg";
import refMeasurementsImg from "@assets/Refrence_Measurements_1776107866110.jpg";
import signTypeImg from "@assets/SignType_1776107866110.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
};

const DEMO_VIDEO = `${import.meta.env.BASE_URL}signsalesiq_demo.mp4`;

function VideoModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.play();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl bg-black"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
        >
          <X className="w-4 h-4" />
        </button>
        <video
          ref={videoRef}
          src={DEMO_VIDEO}
          controls
          playsInline
          className="w-full block"
          style={{ maxHeight: "80vh" }}
          onEnded={onClose}
        />
      </motion.div>
    </motion.div>
  );
}

function BrowserFrame({ src, alt, url = "app.signsalesiq.com" }: { src: string; alt: string; url?: string }) {
  return (
    <div className="rounded-lg overflow-hidden shadow-2xl border border-border">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded border border-gray-200 px-3 py-1 text-xs text-gray-400 font-mono truncate">
          {url}
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block" />
    </div>
  );
}

export default function SignSalesIQ() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-24">
      <AnimatePresence>
        {showDemo && <VideoModal onClose={() => setShowDemo(false)} />}
      </AnimatePresence>

      {/* Hero */}
      <section className="bg-[#0B1E3D] relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(41,171,226,0.12)_0%,transparent_70%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-white">
              <div className="flex items-center gap-3 mb-6">
                <img
                  src={signSalesLogo}
                  alt="SignSalesIQ"
                  className="h-16 object-contain"
                  style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 6px rgba(41,171,226,0.6))", opacity: 0.95 }}
                />
              </div>
              <div className="inline-flex items-center gap-2 border border-brand-cyan/40 text-brand-cyan text-xs font-bold uppercase tracking-[2px] px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
                Next-Gen Sign Sales Platform
              </div>
              <h1 className="text-4xl md:text-5xl font-medium leading-tight mb-2">
                AI-Powered
              </h1>
              <h1 className="text-4xl md:text-5xl font-medium leading-tight mb-6 text-brand-cyan">
                Sign Sales
              </h1>
              <p className="text-white/80 text-lg leading-relaxed mb-8 max-w-lg">
                From mockup to proposal to close — all in one platform. Close deals faster without bothering your designer or disrupting your workflow.
              </p>
              <div className="flex flex-wrap gap-2 mb-10">
                {["Mockups", "Proposals", "Tracking", "Local Sign Code"].map((pill) => (
                  <span key={pill} className="bg-white/10 border border-white/20 text-white/80 text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-full">
                    {pill}
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/pricing">
                  <Button size="lg" className="bg-brand-cyan hover:bg-brand-cyan/90 text-white font-medium uppercase tracking-wider px-8 h-12 rounded-sm shadow-sm">
                    Start Free Trial
                  </Button>
                </Link>
                <Button size="lg" variant="outline" onClick={() => setShowDemo(true)} className="border-white text-white hover:bg-white/10 font-medium uppercase tracking-wider px-8 h-12 rounded-sm flex items-center gap-2">
                  <Play className="w-4 h-4 fill-white" />
                  Watch the Demo
                </Button>
              </div>
              <div className="mt-10 pt-8 border-t border-white/15 flex flex-wrap gap-6 text-white/70 text-sm">
                <span className="font-medium">49+ Sign types</span>
                <span className="text-white/30">·</span>
                <span className="font-medium">Minutes not days</span>
                <span className="text-white/30">·</span>
                <span className="font-medium">100% AI-generated</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <BrowserFrame src={dashboardImg} alt="SignSalesIQ Dashboard" url="app.signsalesiq.com/dashboard" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Band */}
      <section className="bg-[#0B1E3D] border-t border-white/10 py-5">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-white/60">
            {["256-bit SSL", "SOC 2 Ready", "99.9% Uptime", "Role-based access control", "49+ sign types trained"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Band */}
      <section className="bg-brand-cyan py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            {[
              { value: "49+", label: "Sign Types" },
              { value: "Minutes", label: "vs 3–5 Days" },
              { value: "Interior & Exterior", label: "Both Supported" },
              { value: "Good / Better / Best", label: "Tiered Proposals" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-bold mb-1">{value}</div>
                <div className="text-white/80 text-sm uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="py-24 bg-[#F8FAFC]">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px] mb-3">See It In Action</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">
              From building photo to branded proposal — in minutes
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Watch how SignSalesIQ turns a cold lead into a polished proposal before you leave the meeting.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative group cursor-pointer"
            onClick={() => setShowDemo(true)}
          >
            {/* Video container styled like BrowserFrame */}
            <div className="rounded-xl overflow-hidden shadow-2xl border border-border bg-[#0B1E3D]">
              {/* Browser chrome */}
              <div className="bg-[#0B1E3D] border-b border-white/10 px-4 py-2.5 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 bg-white/10 rounded border border-white/10 px-3 py-1 text-xs text-white/40 font-mono">
                  app.signsalesiq.com · Live Demo
                </div>
              </div>

              {/* Video with play overlay */}
              <div className="relative bg-black flex items-center justify-center overflow-hidden">
                <video
                  src={DEMO_VIDEO}
                  className="w-full block opacity-60 group-hover:opacity-70 transition-opacity duration-300"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                  <motion.div
                    className="w-20 h-20 rounded-full bg-brand-cyan flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ scale: 1.12 }}
                  >
                    <Play className="w-8 h-8 fill-white text-white ml-1" />
                  </motion.div>
                  <span className="text-white font-medium text-sm uppercase tracking-widest opacity-80">Watch Full Demo</span>
                </div>
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-xl bg-brand-cyan/10 blur-xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </motion.div>
        </div>
      </section>

      {/* Feature 01 — Sign Types */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px]">01 — Sign Types</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                49+ sign types, interior & exterior, already trained
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Every major sign type your team sells is already in the system — channel letters, awnings, monument signs, ADA, vehicle wraps, dimensional letters, EMC boards and dozens more.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "A-Frame, ADA, Awnings, Banners, Blade Signs",
                  "Channel Letters (Front-Lit, Back-Lit, Raceway)",
                  "Dimensional Letters, Door Graphics, EMC boards",
                  "Feather Flags, Light Box, Monument, Pylon, Vehicle Wraps",
                  "Interior & exterior — both fully supported",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <BrowserFrame src={signTypeImg} alt="49+ Sign Types" url="app.signsalesiq.com/sign-types" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 02 — Reference Measurements */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <BrowserFrame src={refMeasurementsImg} alt="Reference Measurements Tool" url="app.signsalesiq.com/reference-measurements" />
              <div className="mt-3 bg-green-50 border border-green-200 rounded-md px-4 py-3 flex items-center gap-2 text-sm text-green-800">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                Scale set · Sign area ≈ 8'5" × 4'9" (39.8 sq ft · based on 2.5 ft reference)
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px]">02 — Reference Measurements</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Measure the sign area without a site visit
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Use Google Street View or any head-on building photo. Draw a reference line on a known object — a door, a brick, a window — enter its real-world size, and SignSalesIQ calculates the exact sign area instantly.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Works with Google Street View or uploaded photos",
                  "Draw reference on any known object",
                  `AI calculates sign area — "8'5" × 4'9" (39.8 sq ft)"`,
                  "Saves hours of site visit time per opportunity",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 03 — AI Mockup Generation */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px]">03 — AI Mockup Generation</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                From street view to polished mockup in minutes
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Upload a building photo or pull from Google Street View. Add logo assets, pick your sign type, set your specs — and let AI generate a realistic mockup placed directly on the real building.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Upload building photo or use Google Street View",
                  "Add logo assets from web or high-res file",
                  "Pick sign type, location, budget range & duration",
                  "Optional AI prompt for custom styling",
                  "Before/after mockup generated in minutes",
                  "Save Image or Crop Sign for delivery",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="relative">
              <BrowserFrame src={mockupImg} alt="AI Mockup Result" url="app.signsalesiq.com/mockup" />
              <motion.div
                initial={{ opacity: 0, x: 20, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute -bottom-8 -right-6 w-56 rounded-lg overflow-hidden shadow-2xl border border-gray-200 hidden lg:block"
              >
                <img src={mockup2Img} alt="Feather Flag Mockup" className="w-full block" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 04 — Local Sign Code */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <BrowserFrame src={signCodeImg} alt="Local Sign Code" url="app.signsalesiq.com/sign-code" />
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800 font-medium">
                ⚠ Sign Permit Will Be Needed for These Sign Types: <span className="bg-amber-200 px-2 py-0.5 rounded text-xs ml-1">Awning</span>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px]">04 — Local Sign Code</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Local sign code rules built into every opportunity
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Enter the client's address and SignSalesIQ automatically pulls the local jurisdiction's sign code — permit requirements, size limits, placement rules, and zoning restrictions. Know before you propose.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Auto-pulls local sign code by client address",
                  "Permit requirements flagged automatically",
                  "Size, placement & zoning rules included",
                  "Sign permit warnings appear on proposal output",
                  "Currently available for major US jurisdictions",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 05 — PDF Proposal */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px]">05 — Branded Proposals</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Send a branded proposal before you leave the meeting
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Every opportunity generates a professional PDF — complete with your company branding, before/after mockups, sign specs, permit notices, and Good/Better/Best tier recommendations.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Branded with company name, address & contact",
                  "Before/after mockup images side by side",
                  "Good / Better / Best pricing tiers",
                  "Permit notices from local sign code",
                  "Export PDF or email directly to client",
                  "Send while still in the sales meeting",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gray-200 rounded-lg translate-x-3 translate-y-3" />
                <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-300">
                  <img src={pdfImg} alt="Branded PDF Proposal" className="w-full block max-w-md" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 06 — New Opportunity */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <BrowserFrame src={newOpportunityImg} alt="New Opportunity Form" url="app.signsalesiq.com/opportunities/new" />
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px]">06 — Opportunity Management</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Every sale starts with a new opportunity
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Create a new opportunity in seconds — client info, sign specs, budget, target audience, and read distance. Everything in one clean form that feeds the entire workflow.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Client information: business name, address, contact, email, phone",
                  "Sign specifications: location type, sign type, budget range, duration",
                  "Target audience and read distance inputs",
                  "Sign Code Lookup toggle — auto-pulls local rules",
                  "Add multiple sign specs to a single opportunity",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Speed Comparison */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              Close deals before your competition even sends a quote
            </h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <motion.div variants={fadeUp} className="bg-gray-50 border border-border rounded-sm p-8 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Traditional Process</p>
              <div className="text-5xl font-bold text-red-500 mb-3">3–5 days</div>
              <p className="text-muted-foreground text-sm">Design team, revisions, back-and-forth</p>
            </motion.div>
            <motion.div variants={fadeUp} className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">VS</div>
            </motion.div>
            <motion.div variants={fadeUp} className="bg-[#0B1E3D] rounded-sm p-8 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan mb-4">With SignSalesIQ</p>
              <div className="text-5xl font-bold text-brand-cyan mb-3">Minutes</div>
              <p className="text-white/70 text-sm">While still in the meeting</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Role-Based Access */}
      <section className="py-24 bg-[#F8FAFC]">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Role-based access for your whole team</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                role: "Admin",
                icon: <ShieldCheck className="w-6 h-6 text-brand-cyan" />,
                desc: "Full access: company settings, users, rules engine, subscription, all opportunities",
              },
              {
                role: "Sales",
                icon: <Zap className="w-6 h-6 text-brand-cyan" />,
                desc: "Create and manage opportunities, generate mockups, send proposals to clients",
              },
              {
                role: "Project Management",
                icon: <LayoutDashboard className="w-6 h-6 text-brand-cyan" />,
                desc: "View and track all opportunities, monitor pipeline and follow-up queues",
              },
            ].map(({ role, icon, desc }) => (
              <motion.div key={role} variants={fadeUp} className="bg-white border border-border rounded-sm p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 rounded-sm flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h4 className="font-medium text-lg mb-2">{role}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Workflow Diagram */}
      <section className="py-24 bg-[#0B1E3D]">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-white mb-4">
              From opportunity to closed deal in one platform
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">Every step of your sales process — connected, automated, and delivered.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
              <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px border-t-2 border-dashed border-brand-cyan/30" />
              {[
                { num: "01", title: "Create Opportunity", desc: "Enter client info & sign specs" },
                { num: "02", title: "Measure Remotely", desc: "Reference tool calculates sign area from photo" },
                { num: "03", title: "Generate Mockup", desc: "AI places sign on real building in minutes" },
                { num: "04", title: "Check Sign Code", desc: "Local permits & rules auto-pulled by address" },
                { num: "05", title: "Send Proposal", desc: "Branded PDF emailed or downloaded instantly" },
              ].map((step) => (
                <motion.div key={step.num} variants={fadeUp} className="flex flex-col items-center text-center flex-1 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-brand-cyan text-white font-bold text-lg flex items-center justify-center mb-4 shadow-lg">
                    {step.num}
                  </div>
                  <h4 className="font-medium text-white mb-2 text-sm">{step.title}</h4>
                  <p className="text-white/40 text-xs leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 bg-[#0B1E3D] border-t border-white/10 text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <p className="text-brand-cyan text-xs font-bold uppercase tracking-[3px] mb-4">Ready to close faster?</p>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-white mb-4">
            Visualize the win — before you leave the meeting.
          </h2>
          <p className="text-white/60 mb-10 text-lg leading-relaxed">
            Stop waiting on designers. Start closing deals the same day you walk in the door.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pricing">
              <Button size="lg" className="bg-brand-cyan hover:bg-brand-cyan/90 text-white font-medium uppercase tracking-wider px-10 h-14 rounded-sm text-lg shadow-sm">
                Start Your Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" onClick={() => setShowDemo(true)} className="border-white text-white hover:bg-white/10 font-medium uppercase tracking-wider px-10 h-14 rounded-sm text-lg flex items-center gap-2">
              <Play className="w-4 h-4 fill-white" />
              Watch the Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
