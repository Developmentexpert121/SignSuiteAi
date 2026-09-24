import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Check, Play, ArrowRight, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotFound from "./not-found";
import { PageBuilder } from "@/components/PageBuilder";
import { isAdmin, getUser } from "@/lib/auth";
import type {
  PageContent, PageSection,
  HeroSection, TrustBandSection, StatsBandSection,
  FeatureSection, WorkflowSection, CTASection,
} from "@/components/PageBuilder";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12 } } };

interface Product {
  product_key: string;
  display_name: string;
  description: string;
  logo_url: string;
  redirect_url: string;
  monthly_price: number;
  discount_price: number;
  coming_soon: boolean;
  page_content: PageContent | null;
}

function BrowserFrame({ src, alt, url }: { src: string; alt: string; url?: string }) {
  return (
    <div className="rounded-lg overflow-hidden shadow-2xl border border-border">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        {url && (
          <div className="flex-1 bg-white rounded border border-gray-200 px-3 py-1 text-xs text-gray-400 font-mono truncate">
            {url}
          </div>
        )}
      </div>
      <img src={src} alt={alt} className="w-full block" />
    </div>
  );
}

function getAccentColor(content: PageContent | null): string {
  const hero = content?.sections?.find(s => s.type === "hero") as HeroSection | undefined;
  return hero?.accent_color ?? "#E8932C";
}

// ── Section renderers ──────────────────────────────────────────────────────────

function RenderHero({ section, product }: { section: HeroSection; product: Product }) {
  const [showVideo, setShowVideo] = useState(false);
  return (
    <section style={{ background: section.hero_bg_color }} className="relative overflow-hidden py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className={`grid grid-cols-1 ${section.hero_image_url ? "lg:grid-cols-2" : ""} gap-12 items-center`}>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-white max-w-3xl">
            {product.logo_url && (
              <div className="mb-6">
                <img src={product.logo_url} alt={product.display_name} className="h-14 object-contain brightness-0 invert" />
              </div>
            )}

            <h1 className="text-4xl md:text-5xl font-medium leading-tight mb-6 text-white">
              {section.tagline || product.display_name}
            </h1>

            {section.description && (
              <p className="text-white/85 text-lg leading-relaxed mb-8 max-w-xl">{section.description}</p>
            )}

            {(section.pills ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {section.pills!.map(pill => (
                  <span key={pill} className="bg-white/10 border border-white/20 text-white/80 text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-full">
                    {pill}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/pricing">
                <Button size="lg" className="font-medium uppercase tracking-wider px-8 h-12 rounded-sm"
                  style={{ background: "white", color: section.accent_color }}>
                  Start Free Trial
                </Button>
              </Link>
              {section.demo_video_url && (
                <Button size="lg" variant="outline"
                  onClick={() => setShowVideo(true)}
                  className="border-white text-white hover:bg-white/10 font-medium uppercase tracking-wider px-8 h-12 rounded-sm flex items-center gap-2">
                  <Play className="w-4 h-4 fill-white" /> Watch Demo
                </Button>
              )}
            </div>
          </motion.div>

          {section.hero_image_url && (
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <BrowserFrame src={section.hero_image_url} alt={section.tagline || product.display_name} url={section.hero_image_url_label} />
            </motion.div>
          )}
        </div>
      </div>

      {showVideo && section.demo_video_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowVideo(false)}>
          <div className="relative w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl bg-black"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowVideo(false)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center text-lg">
              ✕
            </button>
            <video src={section.demo_video_url} controls autoPlay className="w-full block" style={{ maxHeight: "80vh" }} />
          </div>
        </div>
      )}
    </section>
  );
}

function RenderTrustBand({ section }: { section: TrustBandSection }) {
  return (
    <section className="bg-white border-y border-border py-5">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-muted-foreground">
          {section.items.map(item => (
            <div key={item} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderStatsBand({ section }: { section: StatsBandSection }) {
  return (
    <section className="py-10" style={{ background: section.bg_color ?? "#29ABE2" }}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {section.items.map((item, i) => (
            <div key={i}>
              <div className="text-2xl font-bold mb-1">{item.value}</div>
              <div className="text-white/80 text-sm uppercase tracking-wide">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderFeature({ section, accentColor }: { section: FeatureSection; accentColor: string }) {
  const imgLeft = section.layout === "image-left";
  return (
    <section className={`py-24 ${section.alt_bg ? "bg-white" : "bg-[#FAF8F5]"}`}>
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <motion.div variants={fadeUp} className={`space-y-6 ${imgLeft ? "lg:order-2" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-[3px]" style={{ color: accentColor }}>
              {section.label}
            </p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight leading-tight">
              {section.title}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">{section.description}</p>
            {section.bullets.length > 0 && (
              <ul className="space-y-3 pt-2">
                {section.bullets.map(bullet => (
                  <li key={bullet} className="flex gap-3 items-start text-sm text-foreground/80">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className={imgLeft ? "lg:order-1" : ""}>
            {section.screenshot_url ? (
              <BrowserFrame src={section.screenshot_url} alt={section.title} url={section.screenshot_url_label} />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 h-64 flex items-center justify-center text-gray-300 text-sm bg-gray-50">
                No screenshot set
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function RenderWorkflow({ section, accentColor }: { section: WorkflowSection; accentColor: string }) {
  return (
    <section className="py-24 bg-primary">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-white mb-4">
            {section.title}
          </h2>
          {section.subtitle && <p className="text-white/60 max-w-xl mx-auto">{section.subtitle}</p>}
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
            <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px border-t-2 border-dashed border-white/20" />
            {section.steps.map((step, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} className="flex flex-col items-center text-center flex-1 relative z-10">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-4 shadow-lg"
                  style={{ background: accentColor }}>
                  {step.num}
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm">{step.title}</h3>
                <p className="text-white/60 text-xs leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RenderCTA({ section, accentColor }: { section: CTASection; accentColor: string }) {
  return (
    <section className="py-24 bg-[#FAF8F5]">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-[#1C2A3A] mb-4">
            {section.title}
          </h2>
          {section.description && (
            <p className="text-muted-foreground text-lg mb-8">{section.description}</p>
          )}
          <Link href="/pricing">
            <Button size="lg"
              className="font-medium uppercase tracking-wider px-10 h-12 rounded-sm text-white inline-flex items-center gap-2"
              style={{ background: accentColor }}>
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function renderSection(section: PageSection, i: number, product: Product) {
  const accentColor = getAccentColor(product.page_content);
  switch (section.type) {
    case "hero":       return <RenderHero       key={i} section={section} product={product} />;
    case "trust_band": return <RenderTrustBand  key={i} section={section} />;
    case "stats_band": return <RenderStatsBand  key={i} section={section} />;
    case "feature":    return <RenderFeature    key={i} section={section} accentColor={accentColor} />;
    case "workflow":   return <RenderWorkflow   key={i} section={section} accentColor={accentColor} />;
    case "cta":        return <RenderCTA        key={i} section={section} accentColor={accentColor} />;
    default:           return null;
  }
}

// ── Page component ─────────────────────────────────────────────────────────────
export default function ProductPage() {
  const [, params] = useRoute("/products/:key");
  const key = params?.key ?? "";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  // Initialise editor state synchronously from the URL — this runs once at
  // mount so there is no async race between the fetch and the param check.
  const [showEditor, setShowEditor] = useState<boolean>(() => {
    const hasParam = new URLSearchParams(window.location.search).get("edit") === "true";
    if (hasParam) {
      // Strip the param immediately so a page refresh doesn't re-open the editor.
      window.history.replaceState(null, "", window.location.pathname);
    }
    return hasParam && isAdmin();
  });
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!key) { setLoading(false); return; }
    fetch(`/api/public/products/${key}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setProduct(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [key]);

  // Save updated page_content directly to the DB via the admin API.
  async function handleSaveContent(content: PageContent, extras: { logo_url: string }) {
    if (!product) return;
    setSaving(true);
    try {
      const user = getUser();
      const body = {
        display_name:   product.display_name,
        category:       (product as any).category       ?? "",
        description:    product.description             ?? "",
        logo_url:       extras.logo_url ?? product.logo_url ?? "",
        redirect_url:   product.redirect_url            ?? "",
        monthly_price:  product.monthly_price           ?? 0,
        discount_price: product.discount_price          ?? 0,
        is_active:      true,
        coming_soon:    product.coming_soon             ?? false,
        sort_order:     (product as any).sort_order     ?? 0,
        page_content:   content,
      };
      const res = await fetch(`/api/admin/products_config/${product.product_key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(user?.id ?? 0),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setProduct(p => p ? { ...p, page_content: content, logo_url: extras.logo_url ?? p.logo_url } : p);
        setShowEditor(false);
      }
    } finally {
      setSaving(false);
    }
  }

  // Scroll to the inline editor when it opens.
  useEffect(() => {
    if (showEditor && editorRef.current) {
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [showEditor]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] pt-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return <NotFound />;
  }

  // Floating "Edit Page" button hidden on the public product page.
  // Admins can edit page content from the Admin Panel ("Edit Page" action per product).
  const editButton = null;

  const hasPageContent = !!(product.page_content?.sections?.length);

  // Inline editor rendered below the page sections.
  // When there's no existing page content the admin is building from scratch,
  // so allow full section add/delete/reorder (no restrictSections).
  const inlineEditor = showEditor ? (
    <div ref={editorRef} className="border-t-4 border-orange-400">
      <PageBuilder
        inline
        restrictSections={hasPageContent}
        productName={product.display_name}
        initialContent={product.page_content}
        initialLogoUrl={product.logo_url ?? ""}
        saving={saving}
        onSave={handleSaveContent}
        onClose={() => setShowEditor(false)}
      />
    </div>
  ) : null;

  // If the Page Builder hasn't been used yet:
  //   • Admin in edit mode → skip the dummy fallback and go straight to the builder.
  //   • Regular visitor → render the simple fallback page from product DB fields.
  if (!hasPageContent) {
    // ── Admin editing a brand-new page ────────────────────────────────────────
    if (showEditor) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] pt-20">
          <div ref={editorRef}>
            <PageBuilder
              inline
              productName={product.display_name}
              initialContent={null}
              initialLogoUrl={product.logo_url ?? ""}
              saving={saving}
              onSave={handleSaveContent}
              onClose={() => setShowEditor(false)}
            />
          </div>
        </div>
      );
    }

    // ── Visitor fallback when no page content exists ───────────────────────────
    const descLines = (product.description ?? "")
      .split("\n").map(l => l.trim()).filter(Boolean);
    const shortDesc = descLines[0] ?? "";
    const bullets = descLines.slice(1);
    return (
      <div className="min-h-screen bg-[#FAF8F5] pt-20">
        {/* Hero */}
        <section className="bg-primary py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.06)_0%,transparent_70%)]" />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="max-w-2xl">
              {product.logo_url && (
                <div className="mb-8">
                  <img src={product.logo_url} alt={product.display_name}
                    className="h-14 object-contain brightness-0 invert" />
                </div>
              )}
              <h1 className="text-4xl md:text-5xl font-medium text-white leading-tight mb-6">
                {product.display_name}
              </h1>
              {shortDesc && (
                <p className="text-white/80 text-lg leading-relaxed mb-8">{shortDesc}</p>
              )}
              <Link href="/pricing">
                <Button size="lg"
                  className="bg-accent hover:bg-accent/90 text-white font-medium uppercase tracking-wider px-8 h-12 rounded-sm">
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features (if description has bullet lines) */}
        {bullets.length > 0 && (
          <section className="py-24 bg-background">
            <div className="container mx-auto px-4 max-w-2xl">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <h2 className="text-2xl font-medium mb-8 text-[#1C2A3A]">What's included</h2>
                <ul className="space-y-4">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-base text-foreground/80">
                      <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-20 bg-[#FAF8F5] text-center">
          <div className="container mx-auto px-4 max-w-xl">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <h2 className="text-2xl font-medium text-[#1C2A3A] mb-4">Ready to get started?</h2>
              <p className="text-muted-foreground mb-8">
                See pricing and pick the plan that fits your team.
              </p>
              <Link href="/pricing">
                <Button size="lg"
                  className="bg-accent hover:bg-accent/90 text-white font-medium uppercase tracking-wider px-10 h-12 rounded-sm inline-flex items-center gap-2">
                  View Pricing <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {editButton}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-20">
      {product.page_content?.sections?.map((section, i) => renderSection(section, i, product))}
      {inlineEditor}
      {editButton}
    </div>
  );
}
