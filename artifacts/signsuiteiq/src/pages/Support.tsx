import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Paperclip, X } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const platforms = ["InstalliQ.ai", "SignSalesIQ", "SignTakeoffIQ"];

export default function Support() {
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    contactMethod: "",
    platform: "",
    bestTime: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAttachedFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="pt-24">
      {/* Hero */}
      <section className="bg-primary py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(232,147,44,0.12)_0%,rgba(28,42,58,1)_70%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="inline-block text-accent text-xs font-bold uppercase tracking-widest mb-4 border border-accent/30 px-3 py-1 rounded-sm">We're Here to Help</div>
            <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-4">Support</h1>
            <p className="text-white/70 max-w-xl mx-auto text-lg">Experiencing an issue? Let us know and a member of our support team will reach out within <span className="text-accent font-medium">24–48 hours</span>.</p>
          </motion.div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-2xl">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-border rounded-sm p-12 text-center shadow-sm"
            >
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <LifeBuoy className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-2xl font-medium mb-3">Support Request Received</h2>
              <p className="text-muted-foreground">Our team will review your request and reach out within <strong>24–48 hours</strong>. Thanks for your patience.</p>
              <Button onClick={() => setSubmitted(false)} variant="outline" className="mt-8 rounded-sm uppercase tracking-wide text-sm">
                Submit Another Request
              </Button>
            </motion.div>
          ) : (
            <motion.form
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              onSubmit={handleSubmit}
              className="bg-white border border-border rounded-sm p-8 md:p-10 shadow-sm space-y-6"
            >
              <h2 className="text-xl font-medium text-primary mb-2">Tell us about your issue</h2>

              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Company Name <span className="text-accent">*</span></label>
                <input
                  type="text"
                  name="companyName"
                  required
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Your company name"
                  className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Name <span className="text-accent">*</span></label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Address</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Street, City, State, ZIP"
                  className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground/80">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="(555) 000-0000"
                    className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground/80">Email Address <span className="text-accent">*</span></label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@company.com"
                    className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  />
                </div>
              </div>

              {/* Best Way to Contact */}
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">Best Way to Contact</label>
                <div className="flex gap-6">
                  {["Email", "Phone"].map((method) => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="contactMethod"
                        value={method}
                        checked={form.contactMethod === method}
                        onChange={() => setForm((prev) => ({ ...prev, contactMethod: method }))}
                        className="w-4 h-4 accent-[#E8932C] cursor-pointer"
                      />
                      <span className="text-sm text-foreground/80">{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Platform Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Which platform are you contacting us about? <span className="text-accent">*</span></label>
                <select
                  name="platform"
                  required
                  value={form.platform}
                  onChange={handleChange}
                  className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors bg-white text-foreground/80"
                >
                  <option value="">Select a platform…</option>
                  {platforms.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Best Time to Reach */}
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">Best Time to Reach You</label>
                <div className="flex gap-6">
                  {["Morning", "Afternoon"].map((time) => (
                    <label key={time} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bestTime"
                        value={time}
                        checked={form.bestTime === time}
                        onChange={handleChange}
                        className="w-4 h-4 accent-[#E8932C] cursor-pointer"
                      />
                      <span className="text-sm text-foreground/80">{time}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Message <span className="text-accent">*</span></label>
                <textarea
                  name="message"
                  required
                  value={form.message}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Please describe your issue in detail…"
                  className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">
                  Attach a File <span className="text-muted-foreground font-normal">(optional — screenshot, PDF, etc.)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xlsx,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {attachedFile ? (
                  <div className="flex items-center gap-3 border border-border rounded-sm px-4 py-2.5 bg-muted/30">
                    <Paperclip className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm text-foreground/80 flex-1 truncate">{attachedFile.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{(attachedFile.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-dashed border-border rounded-sm px-4 py-4 text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-2"
                  >
                    <Paperclip className="w-4 h-4" />
                    Click to attach a file
                  </button>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">Accepted: images, PDF, Word, Excel — max 10 MB</p>
              </div>

              {/* Response time notice */}
              <p className="text-xs text-muted-foreground border-t border-border pt-4">
                ⏱ Our support team typically responds within <strong className="text-foreground/70">24–48 hours</strong> on business days.
              </p>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-white rounded-sm uppercase tracking-wider font-medium h-12 shadow-sm">
                Submit Support Request
              </Button>
            </motion.form>
          )}
        </div>
      </section>
    </div>
  );
}
