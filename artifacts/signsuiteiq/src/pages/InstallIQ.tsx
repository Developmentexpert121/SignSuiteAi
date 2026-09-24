import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Check, ShieldCheck, Wifi, Clock, Users, Zap, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import installiQLogo from "@assets/InstalliQ_Logo_nobg.png";
import calendarImg from "@assets/Calendar_1776104844947.jpg";
import dashboardImg from "@assets/DashboardPhoto_1776104844948.jpg";
import eventEntryImg from "@assets/EventEntry_1776104844948.jpg";
import installTimeImg from "@assets/InstallTime_estimator_1776104844948.jpg";
import surveyDetailImg from "@assets/Survery_Photo_1_1776104844948.jpg";
import surveysGridImg from "@assets/Survery_Photo_2_1776104844948.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
};

const DEMO_VIDEO = `${import.meta.env.BASE_URL}installiq_demo.mp4`;

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative z-10 w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl bg-black"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.92, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Video */}
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

function BrowserFrame({ src, alt, url = "app.installiiq.ai" }: { src: string; alt: string; url?: string }) {
  return (
    <div className="rounded-lg overflow-hidden shadow-2xl border border-border">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded border border-gray-200 px-3 py-1 text-xs text-gray-400 font-mono">
          {url}
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block" />
    </div>
  );
}

export default function InstallIQ() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-24">
      <AnimatePresence>
        {showDemo && <VideoModal onClose={() => setShowDemo(false)} />}
      </AnimatePresence>

      {/* Hero */}
      <section className="bg-accent relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-white">
              <div className="flex items-center gap-3 mb-6">
                <img src={installiQLogo} alt="InstalliQ.ai" className="h-14 object-contain brightness-0 invert" />
              </div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-[3px] mb-4">Installation Management</p>
              <h1 className="text-4xl md:text-5xl font-medium leading-tight mb-6">
                AI-Powered Field Proof
              </h1>
              <p className="text-white/85 text-lg leading-relaxed mb-10 max-w-lg">
                Streamline your signage installation workflow from scheduling to completion. One platform for your entire install operation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/pricing">
                  <Button size="lg" className="bg-white text-accent hover:bg-white/90 font-medium uppercase tracking-wider px-8 h-12 rounded-sm shadow-sm">
                    Start Free Trial
                  </Button>
                </Link>
                <Button size="lg" variant="outline" onClick={() => setShowDemo(true)} className="border-white text-white hover:bg-white/10 font-medium uppercase tracking-wider px-8 h-12 rounded-sm flex items-center gap-2">
                  <Play className="w-4 h-4 fill-white" />
                  Watch the Demo
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <BrowserFrame src={calendarImg} alt="InstalliQ Install Calendar" url="app.installiiq.ai/calendar" />
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="absolute -bottom-6 -left-6 w-64 rounded-lg overflow-hidden shadow-2xl border border-gray-200 hidden lg:block"
              >
                <img src={eventEntryImg} alt="Job Detail" className="w-full block" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Band */}
      <section className="bg-white border-y border-border py-5">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-muted-foreground">
            {[
              { icon: ShieldCheck, label: "256-bit SSL" },
              { icon: ShieldCheck, label: "SOC 2 Ready" },
              { icon: Wifi, label: "99.9% Uptime" },
              { icon: Zap, label: "AI-Powered Scheduling" },
              { icon: Users, label: "Role-based access control" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature 01 — Calendar */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">01 — Calendar</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Smart install calendar with 7-day weather view
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Schedule with confidence. Know before you go. Live 7-day forecast embedded in every job — color-coded by status so your whole team stays aligned.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "7-day forecast in every job view",
                  "Color-coded status: Scheduled, Confirmed, Survey, Issues, Completed",
                  "Automatic weather alerts on high-risk install days",
                  "Full team visibility — all users, all jobs",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="relative">
              <BrowserFrame src={calendarImg} alt="InstalliQ Calendar with weather" url="app.installiiq.ai/calendar" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 02 — AI Work Orders */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp} className="order-2 lg:order-1">
              <div className="bg-[#FAF8F5] border border-border rounded-lg p-8 space-y-4">
                <div className="bg-white border border-border rounded-md p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Parsed Work Order</p>
                  <div className="space-y-2 text-sm">
                    {[
                      ["Project", "Anduril Boston — 401-51893"],
                      ["Sign Types", "Channel Letters, Cabinet Signs"],
                      ["Quantity", "3 units"],
                      ["Address", "200 Runar Road, Waltham MA 02451"],
                    ].map(([label, val]) => (
                      <div key={label} className="flex gap-3">
                        <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                        <span className="font-medium text-foreground">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-accent text-white rounded-md px-4 py-3 text-sm font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Calendar event created — Thu Apr 17, assigned to Crew A
                </div>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6 order-1 lg:order-2">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">02 — AI Work Orders</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                AI work order recognition & calendar auto-fill
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Drop in a work order — PDF, image, or forwarded email — and InstalliQ parses every detail and creates a calendar event automatically. No re-keying. No missed details.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Reads PDF, image, and email work order formats",
                  "Auto-fills sign types, quantities, location & notes",
                  "Calendar event ready in seconds, assign to any crew",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 03 — Job Detail & Customer Notification */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">03 — Customer Notifications</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Automatic schedule & reschedule emails — always branded
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Every job entry includes a one-click customer notification. Send confirmation, reschedule, or "On My Way" alerts — all branded with your company details.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Auto confirmation on job creation",
                  "Instant reschedule notifications",
                  "Weather forecast embedded per job",
                  "Assigned crew visible to dispatcher",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <div className="rounded-lg overflow-hidden shadow-2xl border border-border max-w-sm mx-auto">
                <img src={eventEntryImg} alt="Job Detail Modal" className="w-full block" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 04 — Photo Dashboard */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp}>
              <BrowserFrame src={dashboardImg} alt="Photo Dashboard" url="app.installiiq.ai/photos" />
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">04–05 — Photos & AI Tagging</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                50 photos per project, AI-tagged at the job site
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Structured before/during/after capture with all job info pre-filled. AI reads and tags every photo by sign type, location, and phase — before you leave the site.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Up to 50 photos with pre-filled job information",
                  "AI tags by sign type, location & install phase",
                  "Channel Letters, Exterior Signs, Window Graphics auto-detected",
                  "Zero manual labeling",
                  "Search by tags, description, or job label",
                  "Export for warranty claims or QC reviews",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 05 — Site Surveys Grid */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">06 — Site Survey Portal</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Survey, annotate exact dimensions, deliver from the portal
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Capture site dimensions and conditions before installation. Annotate photos with measurements, then email directly to the client or install manager without leaving the app.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Dedicated pre-install site survey workflow",
                  "Annotate photos with exact dimensions & markups",
                  "Completed and draft survey management",
                  "Email survey directly to client from the portal",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <BrowserFrame src={surveysGridImg} alt="Site Surveys Grid" url="app.installiiq.ai/site-surveys" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 06 — Survey Detail with Annotation */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp}>
              <BrowserFrame src={surveyDetailImg} alt="Site Survey with Dimension Annotation" url="app.installiiq.ai/site-surveys/detail" />
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">07 — Dimension Annotation</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Annotate photos with real-world measurements on site
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Mark exact dimensions directly on survey photos in the field. Red annotations are saved with the photo, attached to the job, and ready to share — no extra steps.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Draw dimension callouts directly on photos",
                  "Measurements saved with every survey image",
                  "Linked to job number for instant retrieval",
                  "Share annotated images via email from the portal",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature 07 — Install Time Estimator */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp} className="space-y-6">
              <p className="text-accent text-xs font-bold uppercase tracking-[3px]">08 — Install Time Estimator</p>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                Estimate install time based on your actual team
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Tell InstalliQ your crew's skill set and it calculates realistic installation time by sign type and complexity. Better estimates mean tighter schedules and more accurate quotes.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Calibrated to your team's skill set",
                  "Estimates by sign type, quantity & complexity",
                  "Helps build accurate quotes and daily schedules",
                  "Upload work order PDFs or proof images for instant analysis",
                ].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <BrowserFrame src={installTimeImg} alt="Install Time Estimator" url="app.installiiq.ai/time-estimator" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Workflow Diagram */}
      <section className="py-24 bg-primary">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-white mb-4">
              From work order to field proof in one platform
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">Every step of your install workflow — connected, automated, and documented.</p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="max-w-5xl mx-auto"
          >
            <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
              <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px border-t-2 border-dashed border-accent/40" />
              {[
                { num: "01", title: "Upload Work Order", desc: "AI parses & auto-fills the calendar event" },
                { num: "02", title: "Schedule Crew", desc: "Weather-aware calendar, customer notified automatically" },
                { num: "03", title: "Crew On Site", desc: "On My Way tap, site survey, 50-photo capture" },
                { num: "04", title: "AI Tags & Organizes", desc: "Photos sorted, tagged, searchable instantly" },
                { num: "05", title: "Send Field Proof", desc: "Branded report emailed to client from the portal" },
              ].map((step, i) => (
                <motion.div key={i} variants={fadeUp} className="flex flex-col items-center text-center flex-1 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-accent text-white font-bold text-lg flex items-center justify-center mb-4 shadow-lg">
                    {step.num}
                  </div>
                  <h4 className="font-medium text-white mb-2 text-sm">{step.title}</h4>
                  <p className="text-white/50 text-xs leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 bg-accent text-white text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Ready to run tighter installs?</h2>
          <p className="text-white/80 mb-10 text-lg leading-relaxed">
            See how sign shops are cutting admin time and impressing customers on every job.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pricing">
              <Button size="lg" className="bg-white text-accent hover:bg-white/90 font-medium uppercase tracking-wider px-10 h-14 rounded-sm text-lg shadow-sm">
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
