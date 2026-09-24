import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Plus, Save, Layers, ArrowLeft, CheckCircle, Pencil, Upload, ImageIcon, Video as VideoIcon, X } from "lucide-react";
import { getUser } from "../lib/auth";

// ── Image upload field — text URL input + Upload button + thumbnail preview ──
// Posts to /api/admin/upload-image (base64 in JSON, ≤8MB) and writes the
// returned public URL back into the section. Also accepts a pasted external
// URL — both flows end up in the same `value` field.
function ImageUploadField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image too large (max 8MB)");
      return;
    }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Failed to read file"));
        r.readAsDataURL(file);
      });
      const user = getUser();
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(user?.id ?? 0),
        },
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Upload failed");
        return;
      }
      onChange(data.url);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-2">{label}</label>
      <div className="flex gap-2 items-stretch">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "https://..."}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1C2A3A] focus:outline-none focus:border-orange-400"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-orange-200 text-orange-600 hover:bg-orange-50 transition-all disabled:opacity-60 whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-all"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      {value ? (
        <div className="mt-2 inline-block border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <img src={value} alt="preview" className="block max-h-32 max-w-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" /> No image set — paste a URL or click Upload
        </p>
      )}
    </div>
  );
}

// ── Video URL field — text URL input + preview player ────────────────────────
// Videos are URL-paste only (YouTube/Vimeo embeds or direct .mp4 URLs). For
// direct video URLs we show an inline preview player so admins can confirm
// the link works before saving.
function VideoUrlField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const isDirectVideo = !!value && /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(value);
  return (
    <div>
      <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-2">{label}</label>
      <div className="flex gap-2 items-stretch">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "https://... (.mp4, YouTube, or Vimeo URL)"}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1C2A3A] focus:outline-none focus:border-orange-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-all"
            title="Remove video"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {value ? (
        isDirectVideo ? (
          <div className="mt-2 inline-block border border-gray-200 rounded-lg overflow-hidden bg-black">
            <video src={value} controls className="block max-h-40 max-w-full" />
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
            <VideoIcon className="w-3 h-3" /> External video link saved (preview only available for direct .mp4/.webm URLs)
          </p>
        )
      ) : (
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
          <VideoIcon className="w-3 h-3" /> No video set — paste a URL to a .mp4, YouTube, or Vimeo
        </p>
      )}
    </div>
  );
}

// ── Exported types (also used by ProductPage.tsx) ─────────────────────────────
export interface HeroSection {
  type: "hero";
  tagline: string;
  description: string;
  accent_color: string;
  hero_bg_color: string;
  demo_video_url?: string;
  hero_image_url?: string;
  hero_image_url_label?: string;
  pills?: string[];
}
export interface TrustBandSection {
  type: "trust_band";
  items: string[];
}
export interface StatsBandSection {
  type: "stats_band";
  bg_color?: string;
  items: { value: string; label: string }[];
}
export interface FeatureSection {
  type: "feature";
  label: string;
  title: string;
  description: string;
  bullets: string[];
  screenshot_url?: string;
  screenshot_url_label?: string;
  layout: "image-right" | "image-left";
  alt_bg?: boolean;
}
export interface WorkflowSection {
  type: "workflow";
  title: string;
  subtitle: string;
  steps: { num: string; title: string; desc: string }[];
}
export interface CTASection {
  type: "cta";
  title: string;
  description: string;
}
export type PageSection =
  | HeroSection
  | TrustBandSection
  | StatsBandSection
  | FeatureSection
  | WorkflowSection
  | CTASection;

export interface PageContent { sections: PageSection[]; }

// ── Templates based on existing product page structures ───────────────────────

// Rich dummy-data version automatically applied when opening the Page Builder
// for a brand-new product. Every section is pre-filled with realistic sample
// content so users can see the full page layout and know exactly what to replace.
const DEFAULT_NEW_PRODUCT_TEMPLATE: PageContent = {
  sections: [
    {
      type: "hero",
      tagline: "Your Product Name — Powerful & Easy",
      description: "Describe your product's core value proposition here. What problem does it solve and who is it for? Keep it to 1–2 clear sentences.",
      accent_color: "#E8932C",
      hero_bg_color: "#1C2A3A",
      pills: ["Feature One", "Feature Two", "Cloud-Based", "AI-Powered"],
      demo_video_url: "",
    },
    {
      type: "trust_band",
      items: ["256-bit SSL", "SOC 2 Ready", "99.9% Uptime", "AI-Powered", "Role-based access control"],
    },
    {
      type: "feature",
      label: "01 — Core Feature",
      title: "Your first major feature headline goes here",
      description: "Describe what this feature does and how it benefits the user. Keep it concise and focused on the value it delivers to your customer.",
      bullets: ["Key capability or benefit one", "Key capability or benefit two", "Key capability or benefit three", "Key capability or benefit four"],
      screenshot_url: "",
      screenshot_url_label: "app.yourproduct.com/dashboard",
      layout: "image-right",
      alt_bg: false,
    },
    {
      type: "feature",
      label: "02 — Second Feature",
      title: "Your second major feature headline goes here",
      description: "Describe what this feature does and how it benefits the user. Focus on outcomes, not just capabilities.",
      bullets: ["Key capability or benefit one", "Key capability or benefit two", "Key capability or benefit three"],
      screenshot_url: "",
      screenshot_url_label: "app.yourproduct.com/feature",
      layout: "image-left",
      alt_bg: true,
    },
    {
      type: "feature",
      label: "03 — Third Feature",
      title: "Your third major feature headline goes here",
      description: "Describe what this feature does and how it benefits the user.",
      bullets: ["Key capability or benefit one", "Key capability or benefit two", "Key capability or benefit three"],
      screenshot_url: "",
      screenshot_url_label: "app.yourproduct.com/reports",
      layout: "image-right",
      alt_bg: false,
    },
    {
      type: "feature",
      label: "04 — Fourth Feature",
      title: "Your fourth major feature headline goes here",
      description: "Describe what this feature does and how it benefits the user.",
      bullets: ["Key capability or benefit one", "Key capability or benefit two", "Key capability or benefit three"],
      screenshot_url: "",
      screenshot_url_label: "app.yourproduct.com/settings",
      layout: "image-left",
      alt_bg: true,
    },
    {
      type: "workflow",
      title: "How it works",
      subtitle: "A simple, powerful workflow — designed for your team from day one.",
      steps: [
        { num: "01", title: "Step One Title", desc: "Brief description of what happens in this step." },
        { num: "02", title: "Step Two Title", desc: "Brief description of what happens in this step." },
        { num: "03", title: "Step Three Title", desc: "Brief description of what happens in this step." },
        { num: "04", title: "Step Four Title", desc: "Brief description of what happens in this step." },
        { num: "05", title: "Step Five Title", desc: "Brief description of what happens in this step." },
      ],
    },
    { type: "cta", title: "Ready to get started?", description: "Start your free trial today. No credit card required." },
  ],
};

const INSTALLIIQ_TEMPLATE: PageContent = {
  sections: [
    { type: "hero", tagline: "", description: "", accent_color: "#E8932C", hero_bg_color: "#E8932C", pills: [], demo_video_url: "" },
    { type: "trust_band", items: ["256-bit SSL", "SOC 2 Ready", "99.9% Uptime", "AI-Powered Scheduling", "Role-based access control"] },
    { type: "feature", label: "01 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
    { type: "feature", label: "02 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-left", alt_bg: true },
    { type: "feature", label: "03 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
    { type: "feature", label: "04 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-left", alt_bg: true },
    { type: "workflow", title: "How it works", subtitle: "Every step of your workflow — connected, automated, and documented.", steps: [{ num: "01", title: "", desc: "" }, { num: "02", title: "", desc: "" }, { num: "03", title: "", desc: "" }, { num: "04", title: "", desc: "" }, { num: "05", title: "", desc: "" }] },
    { type: "cta", title: "Ready to get started?", description: "Start your free trial today." },
  ],
};

const SIGNSALESIQ_TEMPLATE: PageContent = {
  sections: [
    { type: "hero", tagline: "", description: "", accent_color: "#29ABE2", hero_bg_color: "#0B1E3D", pills: [], demo_video_url: "" },
    { type: "trust_band", items: ["256-bit SSL", "SOC 2 Ready", "99.9% Uptime", "Role-based access control"] },
    { type: "stats_band", bg_color: "#29ABE2", items: [{ value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }] },
    { type: "feature", label: "01 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
    { type: "feature", label: "02 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-left", alt_bg: true },
    { type: "feature", label: "03 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
    { type: "cta", title: "Ready to get started?", description: "Start your free trial today." },
  ],
};

const SIGNTAKEOFFIQ_TEMPLATE: PageContent = {
  sections: [
    { type: "hero", tagline: "", description: "", accent_color: "#F59E0B", hero_bg_color: "#1C1C1E", pills: [], demo_video_url: "" },
    { type: "trust_band", items: ["256-bit SSL", "SOC 2 Ready", "99.9% Uptime"] },
    { type: "feature", label: "01 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
    { type: "feature", label: "02 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-left", alt_bg: true },
    { type: "feature", label: "03 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
    { type: "cta", title: "Ready to get started?", description: "Start your free trial today." },
  ],
};

const MINIMAL_TEMPLATE: PageContent = {
  sections: [
    { type: "hero", tagline: "", description: "", accent_color: "#E8932C", hero_bg_color: "#E8932C", pills: [] },
    { type: "feature", label: "01 — Key Feature", title: "", description: "", bullets: [], screenshot_url: "", layout: "image-right", alt_bg: false },
    { type: "cta", title: "Ready to get started?", description: "" },
  ],
};

const TEMPLATES = [
  { id: "installiiq", label: "InstalliQ Style", description: "Hero → Trust Band → Multiple Features → Workflow Steps → CTA", template: INSTALLIIQ_TEMPLATE, color: "#E8932C" },
  { id: "signsalesiq", label: "SignSalesIQ Style", description: "Hero → Trust Band → Stats Band → Features → CTA", template: SIGNSALESIQ_TEMPLATE, color: "#29ABE2" },
  { id: "signtakeoffiq", label: "SignTakeoffIQ Style", description: "Hero → Trust Band → Features → CTA (compact)", template: SIGNTAKEOFFIQ_TEMPLATE, color: "#F59E0B" },
  { id: "minimal", label: "Minimal", description: "Hero → Single Feature → CTA — lean and clean", template: MINIMAL_TEMPLATE, color: "#6B7280" },
];

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero Section",
  trust_band: "Trust Band",
  stats_band: "Stats Band",
  feature: "Feature Section",
  workflow: "Workflow Steps",
  cta: "CTA / Call to Action",
};

const SECTION_COLORS: Record<string, string> = {
  hero: "#E8932C",
  trust_band: "#6B7280",
  stats_band: "#29ABE2",
  feature: "#8B5CF6",
  workflow: "#059669",
  cta: "#DB2777",
};

// ── Field helpers ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; placeholder?: string;
}) {
  const cls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1C2A3A] focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
  return (
    <div>
      <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-1.5">{label}</label>
      {multiline
        ? <textarea className={cls + " resize-y min-h-[80px]"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input type="text" className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || "#E8932C"} onChange={e => onChange(e.target.value)} className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1C2A3A] font-mono focus:outline-none focus:border-orange-400" placeholder="#E8932C" />
      </div>
    </div>
  );
}

// ── Section editors ────────────────────────────────────────────────────────────
function HeroEditor({ section, onChange }: { section: HeroSection; onChange: (s: HeroSection) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Tagline (big headline)" value={section.tagline} onChange={v => onChange({ ...section, tagline: v })} placeholder="AI-Powered Field Proof" />
      <Field label="Description (subheadline paragraph)" value={section.description} onChange={v => onChange({ ...section, description: v })} multiline placeholder="Streamline your workflow from start to finish..." />
      <Field label="Feature pills (one per line — shown as chips in the hero)" value={(section.pills ?? []).join("\n")} onChange={v => onChange({ ...section, pills: v.split("\n").map(s => s.trim()).filter(Boolean) })} multiline placeholder="Scheduling&#10;AI-Powered&#10;Reports" />
      <VideoUrlField label="Demo video URL (optional)" value={section.demo_video_url ?? ""} onChange={v => onChange({ ...section, demo_video_url: v })} />
      <ImageUploadField label="Hero image (shown next to the headline)" value={section.hero_image_url ?? ""} onChange={v => onChange({ ...section, hero_image_url: v })} />
      <Field label="Hero image browser bar label (optional)" value={section.hero_image_url_label ?? ""} onChange={v => onChange({ ...section, hero_image_url_label: v })} placeholder="app.yourproduct.com" />
      <div className="grid grid-cols-2 gap-4">
        <ColorField label="Accent / Brand color" value={section.accent_color} onChange={v => onChange({ ...section, accent_color: v })} />
        <ColorField label="Hero background color" value={section.hero_bg_color} onChange={v => onChange({ ...section, hero_bg_color: v })} />
      </div>
    </div>
  );
}

function TrustBandEditor({ section, onChange }: { section: TrustBandSection; onChange: (s: TrustBandSection) => void }) {
  return (
    <Field label="Trust items — one per line (e.g. '256-bit SSL', '99.9% Uptime')" value={section.items.join("\n")} onChange={v => onChange({ ...section, items: v.split("\n").map(s => s.trim()).filter(Boolean) })} multiline placeholder="256-bit SSL&#10;SOC 2 Ready&#10;99.9% Uptime&#10;Role-based access control" />
  );
}

function StatsBandEditor({ section, onChange }: { section: StatsBandSection; onChange: (s: StatsBandSection) => void }) {
  const items = section.items ?? [];
  return (
    <div className="space-y-4">
      <ColorField label="Background color" value={section.bg_color ?? "#29ABE2"} onChange={v => onChange({ ...section, bg_color: v })} />
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-2">Stats (Value + Label pairs)</label>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={item.value} onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], value: e.target.value }; onChange({ ...section, items: arr }); }} placeholder="49+" className="w-28 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 font-bold" />
              <input type="text" value={item.label} onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], label: e.target.value }; onChange({ ...section, items: arr }); }} placeholder="Sign Types" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              <button onClick={() => onChange({ ...section, items: items.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => onChange({ ...section, items: [...items, { value: "", label: "" }] })} className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-700 font-medium transition-colors"><Plus className="w-4 h-4" /> Add Stat</button>
        </div>
      </div>
    </div>
  );
}

function FeatureEditor({ section, onChange }: { section: FeatureSection; onChange: (s: FeatureSection) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Section label (e.g. '01 — Calendar')" value={section.label} onChange={v => onChange({ ...section, label: v })} placeholder="01 — Calendar" />
      <Field label="Title" value={section.title} onChange={v => onChange({ ...section, title: v })} placeholder="Smart install calendar with 7-day weather view" />
      <Field label="Description paragraph" value={section.description} onChange={v => onChange({ ...section, description: v })} multiline placeholder="Schedule with confidence. Know before you go..." />
      <Field label="Bullet points (one per line)" value={section.bullets.join("\n")} onChange={v => onChange({ ...section, bullets: v.split("\n").map(s => s.trim()).filter(Boolean) })} multiline placeholder="7-day forecast in every job view&#10;Color-coded status indicators&#10;Full team visibility" />
      <ImageUploadField label="Screenshot / image" value={section.screenshot_url ?? ""} onChange={v => onChange({ ...section, screenshot_url: v })} />
      <Field label="Browser bar label (shown above screenshot image)" value={section.screenshot_url_label ?? ""} onChange={v => onChange({ ...section, screenshot_url_label: v })} placeholder="app.yourproduct.com/calendar" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-2">Image position</label>
          <div className="flex gap-4">
            {(["image-right", "image-left"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={section.layout === opt} onChange={() => onChange({ ...section, layout: opt })} className="accent-orange-500" />
                <span className="text-sm text-[#1C2A3A]">{opt === "image-right" ? "Image Right" : "Image Left"}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-2">Background</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!section.alt_bg} onChange={e => onChange({ ...section, alt_bg: e.target.checked })} className="accent-orange-500" />
            <span className="text-sm text-[#1C2A3A]">White background (vs. light gray)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function WorkflowEditor({ section, onChange }: { section: WorkflowSection; onChange: (s: WorkflowSection) => void }) {
  const steps = section.steps ?? [];
  return (
    <div className="space-y-4">
      <Field label="Section title" value={section.title} onChange={v => onChange({ ...section, title: v })} placeholder="From work order to field proof in one platform" />
      <Field label="Subtitle" value={section.subtitle} onChange={v => onChange({ ...section, subtitle: v })} placeholder="Every step of your workflow — connected and documented." />
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-2">Steps</label>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
              <input type="text" value={step.num} onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], num: e.target.value }; onChange({ ...section, steps: arr }); }} placeholder="01" className="w-12 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-orange-400 text-center" />
              <input type="text" value={step.title} onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], title: e.target.value }; onChange({ ...section, steps: arr }); }} placeholder="Step title" className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400" />
              <input type="text" value={step.desc} onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], desc: e.target.value }; onChange({ ...section, steps: arr }); }} placeholder="Brief description" className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400" />
              <button onClick={() => onChange({ ...section, steps: steps.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => onChange({ ...section, steps: [...steps, { num: String(steps.length + 1).padStart(2, "0"), title: "", desc: "" }] })} className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-700 font-medium transition-colors"><Plus className="w-4 h-4" /> Add Step</button>
        </div>
      </div>
    </div>
  );
}

function CTAEditor({ section, onChange }: { section: CTASection; onChange: (s: CTASection) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Title" value={section.title} onChange={v => onChange({ ...section, title: v })} placeholder="Ready to get started?" />
      <Field label="Description" value={section.description} onChange={v => onChange({ ...section, description: v })} multiline placeholder="Start your free trial today. No credit card required." />
    </div>
  );
}

function SectionEditor({ section, onChange }: { section: PageSection; onChange: (s: PageSection) => void }) {
  switch (section.type) {
    case "hero": return <HeroEditor section={section} onChange={onChange as (s: HeroSection) => void} />;
    case "trust_band": return <TrustBandEditor section={section} onChange={onChange as (s: TrustBandSection) => void} />;
    case "stats_band": return <StatsBandEditor section={section} onChange={onChange as (s: StatsBandSection) => void} />;
    case "feature": return <FeatureEditor section={section} onChange={onChange as (s: FeatureSection) => void} />;
    case "workflow": return <WorkflowEditor section={section} onChange={onChange as (s: WorkflowSection) => void} />;
    case "cta": return <CTAEditor section={section} onChange={onChange as (s: CTASection) => void} />;
  }
}

// ── Default section presets for "Add Section" ─────────────────────────────────
const NEW_SECTION_DEFAULTS: Record<string, PageSection> = {
  hero: { type: "hero", tagline: "", description: "", accent_color: "#E8932C", hero_bg_color: "#E8932C", pills: [], demo_video_url: "" },
  trust_band: { type: "trust_band", items: ["256-bit SSL", "SOC 2 Ready", "99.9% Uptime"] },
  stats_band: { type: "stats_band", bg_color: "#29ABE2", items: [{ value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }] },
  feature: { type: "feature", label: "01 — Feature Name", title: "", description: "", bullets: [], screenshot_url: "", screenshot_url_label: "", layout: "image-right", alt_bg: false },
  workflow: { type: "workflow", title: "How it works", subtitle: "", steps: [{ num: "01", title: "", desc: "" }, { num: "02", title: "", desc: "" }, { num: "03", title: "", desc: "" }] },
  cta: { type: "cta", title: "Ready to get started?", description: "" },
};

// ── Main PageBuilder export ────────────────────────────────────────────────────
interface PageBuilderProps {
  productName: string;
  initialContent: PageContent | null;
  initialLogoUrl?: string;
  onSave: (content: PageContent, extras: { logo_url: string }) => void;
  onClose: () => void;
  /** Renders as a normal in-page div instead of a fixed full-screen overlay */
  inline?: boolean;
  /** Hides add / delete / reorder controls — sections can be edited but not restructured */
  restrictSections?: boolean;
  /** Shows a saving spinner on the Save button */
  saving?: boolean;
}

export function PageBuilder({ productName, initialContent, initialLogoUrl, onSave, onClose, inline, restrictSections, saving }: PageBuilderProps) {
  const hasInitial = (initialContent?.sections?.length ?? 0) > 0;
  // New products skip the template picker and open directly in the editor
  // pre-loaded with the full InstalliQ-style layout + dummy data so users
  // can immediately see the complete page structure and know what to replace.
  const [sections, setSections] = useState<PageSection[]>(
    hasInitial
      ? initialContent!.sections
      : DEFAULT_NEW_PRODUCT_TEMPLATE.sections.map(s => ({ ...s }))
  );
  // Product logo (rendered in the hero banner). Stored on the products_config
  // row, but exposed here so admins can upload/replace it from the same
  // Page Builder screen instead of having to flip back to the Product form.
  const [logoUrl, setLogoUrl] = useState<string>(initialLogoUrl ?? "");
  const [phase, setPhase] = useState<"template" | "editor">("editor");
  const [addOpen, setAddOpen] = useState(false);

  const update = (i: number, s: PageSection) => setSections(arr => arr.map((x, j) => j === i ? s : x));
  const remove = (i: number) => { setSections(arr => arr.filter((_, j) => j !== i)); };
  const moveUp = (i: number) => { if (i === 0) return; setSections(arr => { const a = [...arr]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; }); };
  const moveDown = (i: number) => { if (i === sections.length - 1) return; setSections(arr => { const a = [...arr]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; }); };
  const addSection = (type: string) => { setSections(arr => [...arr, { ...NEW_SECTION_DEFAULTS[type] } as PageSection]); setAddOpen(false); };

  // ── Template picker phase ──────────────────────────────────────────────────
  if (phase === "template") {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to product
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-[#1C2A3A]">Page Builder — {productName}</span>
            </div>
          </div>
          {hasInitial && (
            <button onClick={() => setPhase("editor")} className="text-sm text-orange-500 hover:text-orange-700 font-medium transition-colors">
              Skip — keep existing content →
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-[#1C2A3A] mb-3">Choose a page structure</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Pick one of the existing page structures as your starting point. You can add, remove, or reorder any section after selecting.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSections(t.template.sections.map(s => ({ ...s }))); setPhase("editor"); }}
                  className="text-left bg-white border-2 border-gray-100 hover:border-orange-300 rounded-xl p-6 transition-all hover:shadow-md group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105" style={{ background: t.color + "20" }}>
                      <Layers className="w-6 h-6" style={{ color: t.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[#1C2A3A] mb-1 group-hover:text-orange-600 transition-colors">{t.label}</div>
                      <div className="text-sm text-gray-500 leading-relaxed mb-3">{t.description}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.template.sections.map((s, i) => (
                          <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                            style={{ color: SECTION_COLORS[s.type], borderColor: SECTION_COLORS[s.type] + "60", background: SECTION_COLORS[s.type] + "10" }}>
                            {SECTION_LABELS[s.type]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-gray-400 text-sm mt-8">
              Or{" "}
              <button onClick={() => { setSections([]); setPhase("editor"); }} className="text-orange-500 hover:text-orange-700 font-medium transition-colors">
                start with a blank page
              </button>
              {" "}and add sections manually.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Section editor phase ───────────────────────────────────────────────────
  // Inline mode: normal in-page div (sticky header sticks below navbar).
  // Fullscreen mode: fixed overlay covering the whole viewport.
  const outerCls = inline
    ? "bg-slate-50"
    : "fixed inset-0 z-[200] bg-slate-50 flex flex-col";

  return (
    <div className={outerCls}>
      {/* Header */}
      <div className={`bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm ${inline ? "sticky top-[80px] z-10" : "flex-shrink-0"}`}>
        <div className="flex items-center gap-3">
          {!inline && (
            <>
              <button onClick={onClose} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to product
              </button>
              <div className="h-5 w-px bg-gray-200" />
            </>
          )}
          <div className="flex items-center gap-2">
            {inline
              ? <Pencil className="w-4 h-4 text-orange-500" />
              : <Layers className="w-4 h-4 text-orange-500" />
            }
            <span className="font-semibold text-[#1C2A3A]">
              {inline ? `Editing — ${productName}` : `Page Builder — ${productName}`}
            </span>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!restrictSections && (
            <button onClick={() => setPhase("template")} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
              Change Template
            </button>
          )}
          {inline && (
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
              Cancel
            </button>
          )}
          <button
            onClick={() => onSave({ sections }, { logo_url: logoUrl })}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: "#E8932C" }}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : inline ? "Save Changes" : "Save Page"}
          </button>
        </div>
      </div>

      {/* Section list */}
      <div className={`p-6 ${inline ? "" : "flex-1 overflow-auto"}`} onClick={() => addOpen && setAddOpen(false)}>
        <div className="max-w-3xl mx-auto">
          {/* Product logo (rendered in the hero banner) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-orange-500">Product Logo</span>
              <span className="text-xs text-gray-400">— shown in the hero banner</span>
            </div>
            <ImageUploadField label="Logo image" value={logoUrl} onChange={setLogoUrl} />
          </div>

          {sections.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium mb-1">No sections yet</p>
              {!restrictSections && (
                <p className="text-sm">
                  Add sections below, or{" "}
                  <button className="text-orange-500 hover:text-orange-700 font-medium" onClick={() => setPhase("template")}>
                    pick a template
                  </button>{" "}to start.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 mb-4">
            {sections.map((section, i) => {
              const color = SECTION_COLORS[section.type];
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Card header — always-visible label, reorder, delete (no toggle) */}
                  <div className="flex items-center gap-3 px-4 py-3 select-none border-b border-gray-100 bg-gray-50/40">
                    <div className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[#1C2A3A] text-sm">{SECTION_LABELS[section.type]}</span>
                        {section.type === "feature" && (
                          <span className="text-xs text-gray-400">— {(section as FeatureSection).label || "Untitled"}</span>
                        )}
                        {section.type === "hero" && (section as HeroSection).tagline && (
                          <span className="text-xs text-gray-400 truncate max-w-[180px]">— {(section as HeroSection).tagline}</span>
                        )}
                      </div>
                    </div>
                    {!restrictSections && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => moveUp(i)} disabled={i === 0} className="p-1.5 rounded text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors" title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveDown(i)} disabled={i === sections.length - 1} className="p-1.5 rounded text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors" title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(i)} className="p-1.5 rounded text-gray-300 hover:text-red-500 transition-colors ml-1" title="Delete section"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>

                  {/* Always-expanded editor — no accordion. Admin sees every
                      field for every section without having to click to expand. */}
                  <div className="px-5 py-5 bg-gray-50/30">
                    <SectionEditor section={section} onChange={s => update(i, s)} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add section button — hidden in restrictSections mode */}
          {!restrictSections && (
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setAddOpen(o => !o); }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Section
                <ChevronDown className={`w-4 h-4 transition-transform ${addOpen ? "rotate-180" : ""}`} />
              </button>

              {addOpen && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-20" onClick={e => e.stopPropagation()}>
                  {Object.entries(SECTION_LABELS).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => addSection(type)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SECTION_COLORS[type] }} />
                      <span className="text-sm text-[#1C2A3A] font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom save */}
          {sections.length > 0 && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => onSave({ sections }, { logo_url: logoUrl })}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-60"
                style={{ background: "#E8932C" }}
              >
                <CheckCircle className="w-4 h-4" />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
