import { motion } from "framer-motion";
import { Link } from "wouter";
import { Check, Zap, FileText, ScanSearch, FileSpreadsheet, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import signTakeoffLogo from "@assets/SignTakeoffIQ_Logo_nobg.png";
import frontPageImg from "@assets/FrontPage_1776109046319.jpg";
import jobListImg from "@assets/JobList_1776109046319.jpg";
import markedUpPlanImg from "@assets/MarkedupFloorPlanfor_export_1776109046320.jpg";
import newJobImg from "@assets/newJob_1776109046320.jpg";
import planMarkUpImg from "@assets/Plan_MarkUp_1776109046320.jpg";
import summaryImg from "@assets/Summary_1776109046320.jpg";
import takeoffInAppImg from "@assets/Takeoffinapp_1776109046320.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const AMBER = "#F5A623";
const AMBER_DIM = "rgba(245,166,35,0.12)";
const AMBER_BORDER = "rgba(245,166,35,0.3)";

function DarkBrowserFrame({ src, alt, url = "app.signtakeoffiq.com" }: { src: string; alt: string; url?: string }) {
  return (
    <div className="rounded-lg overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: "#222222", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 rounded px-3 py-1 text-xs font-mono truncate" style={{ background: "#1A1A1A", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {url}
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block" />
    </div>
  );
}

const inter = { fontFamily: "'Inter', sans-serif" };
const interHeading = { fontFamily: "'Inter', sans-serif", fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase" as const };

export default function SignTakeoffIQ() {
  return (
    <div className="min-h-screen pt-24" style={{ background: "#111111", color: "#E8E6E0", ...inter }}>
      {/* Hero */}
      <section className="relative overflow-hidden py-24" style={{ background: "#111111" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center top, rgba(245,166,35,0.08) 0%, transparent 70%)" }} />

        {/* Under Development Banner */}
        <div className="container mx-auto px-4 mb-8 relative z-10">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-[2px]"
              style={{ background: "rgba(245,166,35,0.15)", border: `1px solid ${AMBER_BORDER}`, color: AMBER }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: AMBER }} />
              Under Development · Coming Soon
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-10"
                style={{ background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}`, color: AMBER, ...inter, letterSpacing: "3px", textTransform: "uppercase" }}>
                <Zap className="w-3.5 h-3.5" fill={AMBER} />
                AI-Powered Sign Extraction
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <h1 className="text-4xl md:text-6xl leading-tight mb-8" style={{ ...interHeading, color: "#E8E6E0" }}>
                Extract Sign Data From<br />
                <span style={{ color: AMBER }}>Architectural Plans</span><br />
                In Seconds
              </h1>
            </motion.div>

            <motion.div variants={fadeUp}>
              <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7, ...inter }}>
                Upload PDF drawings and let AI automatically identify every sign, extract specifications, and generate a complete takeoff ready for estimating.
              </p>
            </motion.div>


            {/* Hero screenshot */}
            <motion.div variants={fadeUp}>
              <DarkBrowserFrame src={frontPageImg} alt="SignTakeoffIQ Landing" url="app.signtakeoffiq.com" />
            </motion.div>

            {/* Feature cards below hero */}
            <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {[
                { icon: <ScanSearch className="w-6 h-6" style={{ color: AMBER }} />, title: "Dual AI Scan", desc: "Text + visual raster scan catches every sign — even those buried in floor plan callouts." },
                { icon: <PenLine className="w-6 h-6" style={{ color: AMBER }} />, title: "Review & Verify", desc: "Confidence scores and source badges let you quickly validate extracted data." },
                { icon: <FileSpreadsheet className="w-6 h-6" style={{ color: AMBER }} />, title: "Export Ready", desc: "Download a structured Excel takeoff with By-Sign-Type and By-Sheet breakdowns." },
              ].map(({ icon, title, desc }) => (
                <motion.div key={title} variants={fadeUp} className="p-6 rounded-sm text-left"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="mb-3">{icon}</div>
                  <h4 className="font-bold uppercase tracking-wide mb-2 text-sm" style={{ ...inter, color: "#E8E6E0" }}>{title}</h4>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Stats Band */}
      <section className="py-10 border-y" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 text-center max-w-sm mx-auto">
            {[
              { value: "95%+", label: "High Confidence" },
              { value: "Seconds", label: "Not Hours" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-bold mb-1" style={{ ...interHeading, color: AMBER }}>{value}</div>
                <div className="text-xs uppercase tracking-[2px]" style={{ color: "rgba(255,255,255,0.45)", ...inter }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Feature 01 — Upload & Scan */}
      <section className="py-24" style={{ background: "#111111" }}>
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-[3px]" style={{ color: AMBER, ...inter }}>01 — Upload & Scan</p>
              <h2 className="text-3xl md:text-4xl leading-tight" style={{ ...interHeading, color: "#E8E6E0" }}>
                Drag, Drop,<br />Scan in Seconds
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                Upload architectural PDFs and let dual AI — text extraction + visual raster scan — find every sign on every sheet automatically.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Drag & drop PDF upload",
                  "Dual AI: text + visual raster scan",
                  "Multi-sheet support",
                  "Job history with status tracking",
                  "Real jobs: Church Plan Tests, APS Park Lane ES, Living Stone Church",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: AMBER }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-4">
              <DarkBrowserFrame src={newJobImg} alt="New Extraction Job" url="app.signtakeoffiq.com/new-upload" />
              <DarkBrowserFrame src={jobListImg} alt="All Takeoff Jobs" url="app.signtakeoffiq.com/jobs" />
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Feature 02 — Marked-Up Floor Plans */}
      <section className="py-24" style={{ background: "#1A1A1A" }}>
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <DarkBrowserFrame src={markedUpPlanImg} alt="Marked-Up Floor Plan" url="app.signtakeoffiq.com/jobs/church-plan/floor-plans" />
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-[3px]" style={{ color: AMBER, ...inter }}>02 — Marked-Up Floor Plans</p>
              <h2 className="text-3xl md:text-4xl leading-tight" style={{ ...interHeading, color: "#E8E6E0" }}>
                106 Markers.<br />One Plan. Seconds.
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                Every sign location is marked directly on the architectural plan with an amber pin. Click any marker to jump straight to its data entry — nothing falls through the cracks.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Amber markers on every sign location",
                  "Click marker → jump to exact plan position",
                  "Add Marker for missed signs",
                  "Edit Markers to correct or remove",
                  "Re-Scan if needed with one click",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: AMBER }} />
                    {item}
                  </li>
                ))}
              </ul>
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                {[
                  { val: "106", label: "Total Signs" },
                  { val: "101", label: "High Confidence" },
                  { val: "5", label: "Needs Review" },
                ].map(({ val, label }) => (
                  <div key={label} className="rounded-sm p-3 text-center" style={{ background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}` }}>
                    <div className="text-xl font-bold" style={{ color: AMBER, ...inter }}>{val}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)", ...inter }}>{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Feature 03 — Edit Sign Data */}
      <section className="py-24" style={{ background: "#111111" }}>
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-[3px]" style={{ color: AMBER, ...inter }}>03 — Edit Sign Data</p>
              <h2 className="text-3xl md:text-4xl leading-tight" style={{ ...interHeading, color: "#E8E6E0" }}>
                Click Any Sign.<br />Edit Every Detail.
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                AI pre-fills every field from the plan. Review, correct, or confirm — sheet number, sign type, dimensions, mounting, materials, and message copy are all extracted and editable.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Sheet number and Sign ID auto-assigned",
                  "Sign type, qty, location, dimensions pre-filled",
                  "Mounting type & illumination extracted",
                  `Materials: "ADA Tactile with Grade 2 Braille"`,
                  "Message copy pulled from plan callout",
                  "90% confidence badge per entry",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: AMBER }} />
                    {item}
                  </li>
                ))}
              </ul>
              {/* Confidence badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-widest"
                style={{ background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)", color: "#1D9E75", ...inter }}>
                ✓ 90% Confidence · ADA Tactile · Sheet A-111
              </div>
            </motion.div>
            <motion.div variants={fadeUp}>
              <DarkBrowserFrame src={planMarkUpImg} alt="Edit Sign Data Panel" url="app.signtakeoffiq.com/jobs/church-plan/markup" />
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Feature 04 — Sign Type Summary */}
      <section className="py-24" style={{ background: "#1A1A1A" }}>
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <DarkBrowserFrame src={summaryImg} alt="Sign Type Summary" url="app.signtakeoffiq.com/jobs/church-plan/sign-type-summary" />
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-[3px]" style={{ color: AMBER, ...inter }}>04 — Sign Type Summary</p>
              <h2 className="text-3xl md:text-4xl leading-tight" style={{ ...interHeading, color: "#E8E6E0" }}>
                12 Sign Types.<br />106 Signs. Instant.
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                Every sign type broken out automatically — quantities, dimensions, sheet references — all structured and ready to copy into your estimate.
              </p>
              {/* Summary table preview */}
              <div className="rounded-sm overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="grid grid-cols-3 px-4 py-2 text-xs font-bold uppercase tracking-widest"
                  style={{ background: "#222222", color: "rgba(255,255,255,0.35)", ...inter }}>
                  <span>Sign Type</span><span className="text-center">Size</span><span className="text-right">Qty</span>
                </div>
                {[
                  ["Room ID", "6\" × 8\"", "75"],
                  ["Restroom", "6\" × 8\"", "13"],
                  ["Evacuation Route Map", "11\" × 17\"", "2"],
                  ["Electrical Hazard", "7\" × 10\"", "2"],
                  ["Fire Sprinkler System", "6\" × 10\"", "1"],
                ].map(([type, size, qty], i) => (
                  <div key={i} className="grid grid-cols-3 px-4 py-2.5 text-sm border-t"
                    style={{ borderColor: "rgba(255,255,255,0.06)", color: "#E8E6E0" }}>
                    <span style={{ ...inter }}>{type}</span>
                    <span className="text-center" style={{ color: "rgba(255,255,255,0.45)", ...inter }}>{size}</span>
                    <span className="text-right font-bold" style={{ color: AMBER, ...inter }}>{qty}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 px-4 py-2.5 text-sm border-t font-bold"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#E8E6E0", background: AMBER_DIM }}>
                  <span style={{ ...inter }}>Total</span><span /><span className="text-right" style={{ color: AMBER, ...inter }}>106</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Feature 05 — Sign Table & Export */}
      <section className="py-24" style={{ background: "#111111" }}>
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-[3px]" style={{ color: AMBER, ...inter }}>05 — Sign Table & Export</p>
              <h2 className="text-3xl md:text-4xl leading-tight" style={{ ...interHeading, color: "#E8E6E0" }}>
                Full Table with<br />Confidence Scores
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                Every extracted sign in a sortable table — confidence scores, source badges, and flag buttons let you review fast and export with confidence.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Confidence % — 90%+ green, 70% amber warning",
                  "Source badge: TEXT or VISUAL per sign",
                  "Flag button for review items",
                  "Edit any row inline",
                  "Export Marked PDF",
                  "Export XLSX with By-Sign-Type and By-Sheet tabs",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: AMBER }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <DarkBrowserFrame src={takeoffInAppImg} alt="Sign Table" url="app.signtakeoffiq.com/jobs/aps/sign-table" />
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Speed Comparison */}
      <section className="py-24" style={{ background: "#1A1A1A" }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl leading-tight" style={{ ...interHeading, color: "#E8E6E0" }}>
              Bid More Projects<br />with the Same Team
            </h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <motion.div variants={fadeUp} className="rounded-sm p-8 text-center"
              style={{ background: "#222222", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "rgba(255,255,255,0.35)", ...inter }}>Manual Takeoff</p>
              <div className="text-5xl font-bold mb-3" style={{ color: "#E24B4A", ...inter }}>4–6 hrs</div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Per project, per estimator</p>
            </motion.div>
            <motion.div variants={fadeUp} className="text-center">
              <div className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.3)", ...inter }}>VS</div>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-sm p-8 text-center"
              style={{ background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}` }}>
              <p className="text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: AMBER, ...inter }}>With SignTakeoffIQ</p>
              <div className="text-5xl font-bold mb-3" style={{ color: AMBER, ...inter }}>Minutes</div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Upload. Scan. Export.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Workflow Diagram */}
      <section className="py-24" style={{ background: "#111111" }}>
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl leading-tight mb-4" style={{ ...interHeading, color: "#E8E6E0" }}>
              Upload to Export in One Shot
            </h2>
            <p style={{ color: "rgba(255,255,255,0.40)", ...inter }}>From PDF to structured takeoff — without touching a highlighter.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
              <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px border-t-2 border-dashed" style={{ borderColor: AMBER_BORDER }} />
              {[
                { num: "01", title: "Upload PDF", desc: "Drag & drop your architectural plans" },
                { num: "02", title: "Dual AI Scan", desc: "Text + visual raster extraction runs in seconds" },
                { num: "03", title: "Review & Edit", desc: "Click any marker to verify or correct" },
                { num: "04", title: "Add / Remove", desc: "Manually add missed signs or delete false hits" },
                { num: "05", title: "Export", desc: "Marked PDF + XLSX ready for estimating" },
              ].map((step) => (
                <motion.div key={step.num} variants={fadeUp} className="flex flex-col items-center text-center flex-1 relative z-10">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-4 shadow-lg"
                    style={{ background: AMBER, color: "#111111", ...inter }}>
                    {step.num}
                  </div>
                  <h4 className="font-bold text-sm mb-2 uppercase tracking-wide" style={{ color: "#E8E6E0", ...inter }}>{step.title}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)", ...inter }}>{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
      {/* Bottom CTA */}
      <section className="py-24 text-center" style={{ background: "#1A1A1A", borderTop: `1px solid ${AMBER_BORDER}` }}>
        <div className="container mx-auto px-4 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: AMBER, ...inter }}>Ready to Take Off Faster?</p>
          <h2 className="text-3xl md:text-4xl leading-tight mb-4" style={{ ...interHeading, color: "#E8E6E0" }}>
            Bid More Projects.<br />Same Team. Same Hours.
          </h2>
          <p className="mb-10 text-lg" style={{ color: "rgba(255,255,255,0.50)", lineHeight: 1.7, ...inter }}>
            Stop spending half your day on manual plan reading. Let AI handle the takeoff so your team handles more bids.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pricing">
              <Button size="lg" className="font-bold uppercase tracking-[2px] px-10 h-14 rounded-sm text-lg"
                style={{ background: AMBER, color: "#111111", border: "none", ...inter }}>
                Start Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="font-bold uppercase tracking-[2px] px-10 h-14 rounded-sm text-lg"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#E8E6E0", background: "transparent", ...inter }}>
              Watch the Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
