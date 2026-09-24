import { useEffect, useState } from "react";
import {
  Mail, Phone, Briefcase, MapPin, Building2,
  ScanFace, CheckCircle2, AlertCircle, Loader2,
  BadgeCheck, Pencil, X, Lock,
} from "lucide-react";
import { getUser, updateUser } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import FaceEnrollModal from "./FaceEnrollModal";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisScriptPromise;
}

export default function AccountSettings() {
  const [user, setUser]       = useState<AuthUser | null>(getUser());
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg,  setMsg]        = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showEnroll, setEnroll] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ name: "", phone: "", location: "" });

  function startEdit(u: AuthUser) {
    setForm({
      name:     u.name     ?? "",
      phone:    u.phone    ?? "",
      location: u.location ?? "",
    });
    setEditing(true);
  }

  async function saveProfile() {
    if (!user) return;
    if (!form.name.trim()) {
      flash("err", "Full name is required.");
      return;
    }
    setBusy("profile");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user.id) },
        body: JSON.stringify({
          name:     form.name.trim(),
          phone:    form.phone.trim(),
          location: form.location.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { flash("err", data.error || "Could not save profile."); return; }
      const merged = updateUser(data.user);
      if (merged) setUser(merged);
      setEditing(false);
      flash("ok", "Profile updated.");
    } finally { setBusy(null); }
  }

  useEffect(() => {
    const me = getUser();
    if (!me?.id) return;
    fetch(`/api/auth/me`, { headers: { "X-User-Id": String(me.id) } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          const merged = updateUser(data.user);
          if (merged) setUser(merged);
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGoogleScript().then(() => setGisReady(true)).catch(() => setGisReady(false));
  }, []);

  function flash(kind: "ok" | "err", text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function disableFace() {
    if (!user) return;
    setBusy("face");
    try {
      const res = await fetch("/api/auth/face-disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user.id) },
      });
      const data = await res.json();
      if (!res.ok) { flash("err", data.error || "Could not disable Face Lock."); return; }
      const merged = updateUser(data.user);
      if (merged) setUser(merged);
      flash("ok", "Face Lock disabled.");
    } finally { setBusy(null); }
  }

  async function unlinkGoogle() {
    if (!user) return;
    setBusy("google");
    try {
      const res = await fetch("/api/auth/google-unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user.id) },
      });
      const data = await res.json();
      if (!res.ok) { flash("err", data.error || "Could not unlink Google."); return; }
      const merged = updateUser(data.user);
      if (merged) setUser(merged);
      flash("ok", "Google Login disabled.");
    } finally { setBusy(null); }
  }

  async function linkGoogle(credential: string) {
    if (!user) return;
    setBusy("google");
    try {
      const res = await fetch("/api/auth/google-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user.id) },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) { flash("err", data.error || "Could not link Google account."); return; }
      const merged = updateUser(data.user);
      if (merged) setUser(merged);
      flash("ok", "Google Login enabled. You can now sign in with Google.");
    } finally { setBusy(null); }
  }

  function startGoogleConnect() {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      flash("err", "Google Sign-In is not configured yet. Ask your administrator to set GOOGLE_CLIENT_ID.");
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => { if (resp?.credential) linkGoogle(resp.credential); },
      ux_mode: "popup",
    });
    window.google.accounts.id.prompt();
  }

  if (!user) {
    return <div className="p-8 text-gray-600">Not signed in.</div>;
  }

  const initials = (user.name || "?")
    .split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  // Job title is admin-assigned. If not set, show a friendly default
  // based on role so super admins / admins see a meaningful value.
  const displayJobTitle =
    user.jobTitle?.trim() ||
    (user.role === "super_admin" ? "Super Admin"
      : user.role === "admin"    ? "Admin"
      : "");

  const enabledCount = (user.faceEnabled ? 1 : 0) + (user.googleEnabled ? 1 : 0);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-[#1C2A3A] text-2xl sm:text-[28px] font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your profile information and sign-in methods.</p>
      </div>

      {msg && (
        <div className={`mb-6 flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
          msg.kind === "ok"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {msg.kind === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* ── Profile section ────────────────────────────────────── */}
      <Section
        title="Profile"
        description="Your personal information and contact details."
        rightHeader={
          editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(false)}
                disabled={busy === "profile"}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={busy === "profile"}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy === "profile" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => startEdit(user)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition inline-flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )
        }
      >
        <div className="flex items-center gap-5 pb-6 border-b border-gray-100">
          {user.facePhoto ? (
            <img
              src={user.facePhoto}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-orange-500 text-white text-xl font-bold flex items-center justify-center">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[#1C2A3A] text-base font-semibold truncate">
              {user.name || "—"}
            </div>
            {displayJobTitle && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                <BadgeCheck className="w-3.5 h-3.5 text-orange-500" />
                <span className="capitalize">{displayJobTitle}</span>
                {user.companyName && (
                  <>
                    <span className="text-gray-300">·</span>
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{user.companyName}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <dl className="divide-y divide-gray-100">
          {/* Name — editable */}
          <DetailRow
            icon={<BadgeCheck className="w-4 h-4" />}
            label="Name"
            editing={editing}
            value={user.name}
            inputValue={form.name}
            onChange={(v) => setForm(f => ({ ...f, name: v }))}
            placeholder="Your full name"
            required
          />
          {/* Email — locked */}
          <DetailRow
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            value={user.email}
            locked
            lockedHint="Email is your account ID and can't be changed."
          />
          {/* Phone — editable */}
          <DetailRow
            icon={<Phone className="w-4 h-4" />}
            label="Phone"
            editing={editing}
            value={user.phone}
            inputValue={form.phone}
            onChange={(v) => setForm(f => ({ ...f, phone: v }))}
            placeholder="Not set"
            inputType="tel"
          />
          {/* Job title — locked, set by admin */}
          <DetailRow
            icon={<Briefcase className="w-4 h-4" />}
            label="Job title"
            value={displayJobTitle}
            placeholder="Not set"
            locked
            lockedHint="Assigned by your administrator."
          />
          {/* Location — editable */}
          <DetailRow
            icon={<MapPin className="w-4 h-4" />}
            label="Location"
            editing={editing}
            value={user.location}
            inputValue={form.location}
            onChange={(v) => setForm(f => ({ ...f, location: v }))}
            placeholder="Not set"
          />
        </dl>
      </Section>

      {/* ── Sign-in methods ─────────────────────────────────────── */}
      <Section
        title="Sign-in methods"
        description="Choose how you want to sign in to your account."
        rightHeader={
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-1.5 h-1.5 rounded-full ${enabledCount > 0 ? "bg-emerald-500" : "bg-gray-300"}`} />
            {enabledCount} of 2 enabled
          </span>
        }
      >
        <ul className="divide-y divide-gray-100 -mx-6 sm:-mx-7">
          {/* Google */}
          <MethodRow
            icon={<GoogleIcon />}
            title="Google"
            subtitle={user.googleEnabled
              ? <>Linked to <span className="text-[#1C2A3A] font-medium">{user.googleEmail}</span></>
              : "Sign in with one click using your Google account."}
            enabled={!!user.googleEnabled}
            warning={!GOOGLE_CLIENT_ID
              ? "Google Sign-In isn't configured. Ask your administrator to add GOOGLE_CLIENT_ID."
              : undefined}
            action={user.googleEnabled ? (
              <button
                onClick={unlinkGoogle}
                disabled={busy === "google"}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
              >
                {busy === "google" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={startGoogleConnect}
                disabled={busy === "google" || !GOOGLE_CLIENT_ID || !gisReady}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#1C2A3A] text-white hover:bg-[#2A3D54] transition disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
              >
                {busy === "google" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
              </button>
            )}
          />

          {/* Face Lock */}
          <MethodRow
            icon={
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                <ScanFace className="w-5 h-5" />
              </div>
            }
            title="Face Lock"
            subtitle={user.faceEnabled
              ? "You can sign in instantly with your face from the login screen."
              : "Set up Face Lock to sign in with a quick face scan."}
            enabled={user.faceEnabled}
            action={user.faceEnabled ? (
              <button
                onClick={disableFace}
                disabled={busy === "face"}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
              >
                {busy === "face" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Disable"}
              </button>
            ) : (
              <button
                onClick={() => setEnroll(true)}
                disabled={busy === "face"}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
              >
                Set up
              </button>
            )}
          />
        </ul>
      </Section>

      {showEnroll && (
        <FaceEnrollModal
          onClose={() => setEnroll(false)}
          onSuccess={(u) => {
            setEnroll(false);
            const merged = updateUser(u);
            if (merged) setUser(merged);
            flash("ok", "Face Lock enabled.");
          }}
        />
      )}
    </div>
  );
}

function Section({
  title, description, rightHeader, children,
}: {
  title: string;
  description?: string;
  rightHeader?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 sm:px-7 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-gray-100">
        <div>
          <h2 className="text-[#1C2A3A] text-base font-semibold">{title}</h2>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {rightHeader}
      </div>
      <div className="px-6 sm:px-7 py-5">{children}</div>
    </section>
  );
}

function DetailRow({
  icon, label, value, placeholder, editing, inputValue, onChange, inputType, required, locked, lockedHint,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  placeholder?: string;
  editing?: boolean;
  inputValue?: string;
  onChange?: (v: string) => void;
  inputType?: string;
  required?: boolean;
  locked?: boolean;
  lockedHint?: string;
}) {
  const isSet = !!value;
  const isEditable = editing && !locked && onChange;

  return (
    <div className="flex items-start sm:items-center gap-4 py-3">
      <div className="w-8 text-gray-400 flex-shrink-0 flex items-center justify-center pt-1.5 sm:pt-0">{icon}</div>
      <div className="text-xs text-gray-500 w-24 flex-shrink-0 pt-1.5 sm:pt-0 inline-flex items-center gap-1">
        {label}
        {required && isEditable && <span className="text-orange-500">*</span>}
      </div>
      <div className="flex-1 min-w-0">
        {isEditable ? (
          <input
            type={inputType ?? "text"}
            value={inputValue ?? ""}
            onChange={(e) => onChange!(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition text-[#1C2A3A]"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-sm truncate ${isSet ? "text-[#1C2A3A] font-medium" : "text-gray-400"}`}>
              {isSet ? value : (placeholder ?? "—")}
            </span>
            {locked && editing && (
              <span title={lockedHint} className="text-gray-300 inline-flex">
                <Lock className="w-3 h-3" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MethodRow({
  icon, title, subtitle, enabled, action, warning,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  enabled: boolean;
  action: React.ReactNode;
  warning?: string;
}) {
  return (
    <li className="px-6 sm:px-7 py-4 flex items-start gap-4">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1C2A3A]">{title}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
            enabled ? "text-emerald-600" : "text-gray-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-gray-300"}`} />
            {enabled ? "Enabled" : "Off"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{subtitle}</p>
        {warning && (
          <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 inline-flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        )}
      </div>
      <div className="flex-shrink-0">{action}</div>
    </li>
  );
}

function GoogleIcon() {
  return (
    <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
      <svg viewBox="0 0 48 48" className="w-6 h-6">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.3-.1-2.4-.4-3.5z"/>
      </svg>
    </div>
  );
}
