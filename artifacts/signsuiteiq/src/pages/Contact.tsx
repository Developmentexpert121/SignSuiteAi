import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, MapPin } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function Contact() {
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    address: "",
    phone: "",
    email: "",
    contactMethod: "",
    bestTime: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(41,171,226,0.12)_0%,rgba(28,42,58,1)_70%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="inline-block text-brand-cyan text-xs font-bold uppercase tracking-widest mb-4 border border-brand-cyan/30 px-3 py-1 rounded-sm">Get In Touch</div>
            <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-4">Contact Us</h1>
            <p className="text-white/70 max-w-xl mx-auto text-lg">Have a question or want to learn more? Fill out the form and our team will be in touch shortly.</p>
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
                <Mail className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-2xl font-medium mb-3">Message Sent!</h2>
              <p className="text-muted-foreground">Thanks for reaching out. We'll get back to you soon.</p>
              <Button onClick={() => setSubmitted(false)} variant="outline" className="mt-8 rounded-sm uppercase tracking-wide text-sm">
                Send Another Message
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
              <h2 className="text-xl font-medium text-primary mb-2">Tell us about yourself</h2>

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

              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Contact Name <span className="text-accent">*</span></label>
                <input
                  type="text"
                  name="contactName"
                  required
                  value={form.contactName}
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
                  placeholder="How can we help you?"
                  className="w-full border border-border rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
                />
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-white rounded-sm uppercase tracking-wider font-medium h-12 shadow-sm">
                Send Message
              </Button>
            </motion.form>
          )}
        </div>
      </section>

      {/* Contact Info Band */}
      <section className="py-16 bg-white border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-lg mx-auto text-center">
            {[
              { icon: Mail, label: "Email", value: "hello@signsuite.ai" },
              { icon: MapPin, label: "Location", value: "United States" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-1">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground/80">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
