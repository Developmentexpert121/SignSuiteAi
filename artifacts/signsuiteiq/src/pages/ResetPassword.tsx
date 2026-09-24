import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import logoFull from "@assets/SignSuiteIQ_v4_clean_no_icons_1776093556689.png";

type Status =
  | { kind: "verifying" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; email: string }
  | { kind: "submitting"; email: string }
  | { kind: "success" };

function getTokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  const sp = new URLSearchParams(window.location.search);
  return sp.get("token")?.trim() ?? "";
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token] = useState<string>(() => getTokenFromUrl());
  const [status, setStatus] = useState<Status>({ kind: "verifying" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify the token up-front so we can show "expired/invalid" before
  // the user types a password.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setStatus({ kind: "invalid", message: "This reset link is missing its token. Please request a new one." });
        return;
      }
      try {
        const res = await fetch(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`);
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; email?: string; error?: string };
        if (cancelled) return;
        if (res.ok && data.ok && data.email) {
          setStatus({ kind: "ready", email: data.email });
        } else {
          setStatus({
            kind: "invalid",
            message: data.error ?? "This reset link is invalid or has expired.",
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({ kind: "invalid", message: "Could not verify reset link. Please try again." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // After success, send the user back to the login page so they can sign in
  // with their new password.
  useEffect(() => {
    if (status.kind !== "success") return;
    const t = window.setTimeout(() => setLocation("/login?reset=success"), 1800);
    return () => window.clearTimeout(t);
  }, [status, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (status.kind !== "ready") return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setStatus({ kind: "submitting", email: status.email });
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus({ kind: "success" });
      } else {
        setError(data.error ?? "Could not reset password. The link may have expired.");
        setStatus({ kind: "ready", email: (status as { email: string }).email });
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus({ kind: "ready", email: (status as { email: string }).email });
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1C2A3A] via-[#22344a] to-[#1C2A3A] flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-8 pt-8 pb-2 flex justify-center">
          <img src={logoFull} alt="SignSuiteIQ" className="h-10 object-contain" />
        </div>

        <div className="px-8 pb-8 pt-4">
          <h1 className="text-2xl font-bold text-[#1C2A3A] text-center">Reset your password</h1>

          {status.kind === "verifying" && (
            <div className="mt-8 flex flex-col items-center gap-3 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin text-[#E8932C]" />
              <p className="text-sm">Verifying your reset link…</p>
            </div>
          )}

          {status.kind === "invalid" && (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{status.message}</p>
              </div>
              <Link href="/login">
                <a className="block w-full text-center bg-[#E8932C] hover:bg-[#d6831f] text-white font-semibold py-2.5 rounded-lg transition">
                  Back to sign in
                </a>
              </Link>
            </div>
          )}

          {(status.kind === "ready" || status.kind === "submitting") && (
            <>
              <p className="mt-2 text-sm text-slate-600 text-center">
                Choose a new password for{" "}
                <span className="font-medium text-[#1C2A3A]">{status.email}</span>.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-[#E8932C] focus:ring-2 focus:ring-[#E8932C]/20 outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm new password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={show ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-[#E8932C] focus:ring-2 focus:ring-[#E8932C]/20 outline-none text-sm"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status.kind === "submitting"}
                  className="w-full bg-[#E8932C] hover:bg-[#d6831f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {status.kind === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Set new password"
                  )}
                </button>

                <div className="text-center">
                  <Link href="/login">
                    <a className="text-sm text-slate-500 hover:text-[#1C2A3A]">Back to sign in</a>
                  </Link>
                </div>
              </form>
            </>
          )}

          {status.kind === "success" && (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Password updated</p>
                  <p>Redirecting you to sign in…</p>
                </div>
              </div>
              <Link href="/login">
                <a className="block w-full text-center bg-[#E8932C] hover:bg-[#d6831f] text-white font-semibold py-2.5 rounded-lg transition">
                  Go to sign in
                </a>
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
