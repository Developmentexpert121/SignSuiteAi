import { motion } from "framer-motion";
import { Zap, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function About() {
  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Hero / Mission */}
      <section className="bg-primary text-white py-32 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-medium tracking-tight mb-8">
              Built by sign people, <br/>for sign people.
            </h1>
            <p className="text-xl text-white/80 leading-relaxed">
              We spent decades in the sign industry watching highly skilled professionals waste hours on manual takeoffs, crude mockups, and chaotic field management. 
              We built SignSuiteIQ because we were tired of generic software that didn't understand the unique complexities of building and installing signs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Our Core Values</h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {[
              {
                title: "Speed without compromise",
                desc: "In our industry, the first to bid often wins. We use AI to compress days of administrative work into minutes, giving you a massive competitive advantage.",
                icon: <Zap className="w-8 h-8 text-accent" />
              },
              {
                title: "Built to change the industry",
                desc: "The sign vertical hasn't seen real innovation in decades. We're changing that — bringing AI-powered tools purpose-built for sign professionals that redefine how takeoffs, sales, and installations get done.",
                icon: <TrendingUp className="w-8 h-8 text-accent" />
              },
              {
                title: "Radical simplicity",
                desc: "Sign shops are busy enough. We don't believe in steep learning curves. Our interfaces are flat, clean, and intuitive enough for anyone to use on day one.",
                icon: <Sparkles className="w-8 h-8 text-accent" />
              }
            ].map((val, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-card border border-border p-8 rounded-sm shadow-sm text-center">
                <div className="w-16 h-16 bg-accent/10 flex items-center justify-center rounded-full mx-auto mb-6">
                  {val.icon}
                </div>
                <h3 className="text-xl font-medium mb-4">{val.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {val.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Hiring Band */}
      <section className="py-20 bg-accent text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight mb-6">Want to help build the future of the sign industry?</h2>
          <p className="mb-8 text-white/90">We're always looking for talented engineers, designers, and industry experts.</p>
          <Button variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-accent uppercase tracking-wide rounded-sm px-8">
            View Open Roles
          </Button>
        </div>
      </section>
    </div>
  );
}
