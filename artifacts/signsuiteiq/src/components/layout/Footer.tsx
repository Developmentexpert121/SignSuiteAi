import { Link, useLocation } from "wouter";
import { useState } from "react";
import logoFull from "@assets/SignSuiteIQ_v4_clean_no_icons_1776093556689.png";
import { isLoggedIn, getUser } from "@/lib/auth";

export function Footer() {
  const [location] = useLocation();
  const isDark = location === "/signtakeoffiq";
  const [isRegularUser] = useState<boolean>(() => isLoggedIn() && getUser()?.role === "user");

  return (
    <footer
      className="text-white"
      style={isDark
        ? { background: "#1C1C1C", borderTop: "1px solid rgba(255,255,255,0.08)" }
        : { background: "hsl(var(--primary))", borderTop: "1px solid rgba(28,42,58,0.2)" }
      }
    >
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <Link href="/" className="block">
              <img src={logoFull} alt="SignSuiteIQ" className="h-20 w-auto object-contain object-left" />
            </Link>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">AI built for signs,<br />not borrowed from somewhere else.</p>
          </div>

          <div>
            <h3 className="font-medium uppercase tracking-widest text-sm text-white mb-6">Products</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/installiiq" className="text-white/60 hover:text-accent transition-colors text-sm">InstalliQ</Link>
              </li>
              <li>
                <Link href="/signsalesiq" className="text-white/60 hover:text-accent transition-colors text-sm">
                  SignSalesIQ
                </Link>
              </li>
              <li>
                <Link href="/signtakeoffiq" className="text-white/60 hover:text-accent transition-colors text-sm">
                  SignTakeoffIQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium uppercase tracking-widest text-sm text-white mb-6">Company</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="text-white/60 hover:text-accent transition-colors text-sm">
                  About Us
                </Link>
              </li>
              {!isRegularUser && (
                <li>
                  <Link href="/pricing" className="text-white/60 hover:text-accent transition-colors text-sm">
                    Pricing
                  </Link>
                </li>
              )}
              <li>
                <Link href="/contact" className="text-white/60 hover:text-accent transition-colors text-sm">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-white/60 hover:text-accent transition-colors text-sm">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium uppercase tracking-widest text-sm text-white mb-6">Legal</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/privacy-policy" className="text-white/60 hover:text-accent transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="text-white/60 hover:text-accent transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            &copy; {new Date().getFullYear()} SignSuiteIQ.ai. All rights reserved.
          </p>
          <div className="flex items-center gap-4" />
        </div>
      </div>
    </footer>
  );
}
