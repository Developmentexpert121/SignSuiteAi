import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import {
  Building2, Users, Shield, LayoutDashboard, Package,
  CreditCard, ChevronRight, Check, X, Plus, Search,
  RefreshCw, ExternalLink, Save, Edit2, ArrowLeft,
  LogOut, Mail, Phone, MapPin, UserPlus, Eye, EyeOff, Send,
  Trash2, Archive, ArchiveRestore, AlertTriangle, Home, Settings,
  Key, Download, ArrowUpDown, KeyRound, Receipt, Calendar,
  ChevronLeft, ChevronDown, FileText, Clock, Wrench, Gift,
} from "lucide-react";
import AccountSettings from "./AccountSettings";
import { getUser, saveUser, logout, type AuthUser } from "@/lib/auth";
import { useLocation } from "wouter";
import installiQLogo from "@assets/InstalliQ_Logo_nobg.png";
import signSalesLogo from "@assets/SignSalesIQ_Logo_nobg.png";
import signTakeoffLogo from "@assets/SignTakeoffIQ_Logo_nobg.png";
import { PageBuilder, type PageContent } from "./PageBuilder";

const APP_KEYS = ["installiq", "signsalesiq", "signtakeoffiq"] as const;
const APP_LABELS: Record<string, string> = {
  installiq:      "InstalliQ",
  signsalesiq:    "SignSalesIQ",
  signtakeoffiq:  "SignTakeoffIQ",
};
const PRODUCT_LOGOS: Record<string, string> = {
  installiq:      installiQLogo,
  signsalesiq:    signSalesLogo,
  signtakeoffiq:  signTakeoffLogo,
};
const PRODUCT_LAUNCH_URLS: Record<string, string> = {
  installiq:      "https://www.installiq.ai/",
  signsalesiq:    "https://www.signsalesiq.ai/",
  signtakeoffiq:  "",
};

function authHeaders(user: AuthUser) {
  return { "Content-Type": "application/json", "X-User-Id": String(user.id) };
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Stats        { companies: number; users: number; appGrants?: number; }
interface Company      { id: number; business_name: string; business_email: string | null; contact_number: string | null; user_count: number; admin_name: string | null; admin_email: string | null; }
interface UserCompanyRef { id: number; name: string; relationship: "admin" | "member"; is_primary: boolean; plan_key: string | null; plan_name: string | null; }
interface AdminUser    { id: number; name: string; username: string; email: string; phone: string | null; job_title: string | null; location: string | null; role: string; company_id: number | null; company_name: string | null; plan_key: string | null; plan_name: string | null; apps: string[]; companies?: UserCompanyRef[]; created_at: string; }
interface AdminSubscription {
  plan_key: string;
  display_name: string;
  status: string;                       // active | trialing | past_due | pending | canceled | …
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  amount_cents: number | null;
  currency: string | null;
  billing_period: string | null;        // 'month' | 'year' | null
}
interface AdminRow     { id: number; name: string; username: string; email: string | null; phone: string | null; location: string | null; role: string; company_id: number | null; company_name: string | null; active_plan_key: string | null; subscriptions: AdminSubscription[] | null; granted_apps?: string[]; temp_password: string | null; welcome_sent_at: string | null; created_at: string; }
interface ProductConfig{ id: number; product_key: string; display_name: string; category: string; description: string; logo_url: string; redirect_url: string; monthly_price: number; discount_price: number; is_active: boolean; coming_soon: boolean; under_maintenance: boolean; sort_order: number; page_content?: PageContent; }
interface PlanConfig   { id: number; plan_key: string; display_name: string; category: string; monthly_price: number; annual_price: number; description: string; features: string[]; is_active: boolean; coming_soon: boolean; sort_order: number; }

// ── Light-mode stat card ───────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color ?? "rgba(232,147,44,0.10)" }}>
        <Icon className="w-5 h-5 text-orange-500" />
      </div>
      <div>
        <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">{label}</p>
        <p className="text-[#1C2A3A] text-2xl font-bold">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

// ── App toggle pill ────────────────────────────────────────────────────────────
function AppToggle({ appKey, active, onToggle, disabled, locked }: {
  appKey: string; active: boolean; onToggle: () => void; disabled?: boolean; locked?: boolean;
}) {
  if (locked) {
    return (
      <span
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed select-none"
        title="Not included in your current plan"
      >
        <X className="w-3 h-3" />
        {APP_LABELS[appKey]}
      </span>
    );
  }
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? "bg-orange-50 border-orange-300 text-orange-600 hover:bg-orange-100"
          : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {active ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
      {APP_LABELS[appKey]}
    </button>
  );
}

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: "bg-purple-50 text-purple-600 border-purple-200",
    admin:       "bg-blue-50 text-blue-600 border-blue-200",
    user:        "bg-gray-50 text-gray-500 border-gray-200",
  };
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    admin:       "Admin",
    user:        "User",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors[role] ?? colors.user}`}>
      {labels[role] ?? role}
    </span>
  );
}

// ── Light field editor ─────────────────────────────────────────────────────────
function Field({
  label, value, onChange, multiline = false, type = "text", step, min,
}: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; step?: string | number; min?: string | number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[#1C2A3A] text-sm resize-none focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      ) : (
        <input
          type={type}
          step={step}
          min={min}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      )}
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ u, toggling, toggleApp, allowedApps }: {
  u: AdminUser;
  toggling: Record<string, boolean>;
  toggleApp: (id: number, key: string, apps: string[]) => void;
  allowedApps: string[];
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-[#1C2A3A] font-medium text-sm">{u.name}</p>
            <RoleBadge role={u.role} />
            {u.role !== "super_admin" && (
              u.plan_key ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium">
                  <Check className="w-2.5 h-2.5" />
                  {u.plan_name || u.plan_key} plan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500 font-medium">
                  <X className="w-2.5 h-2.5" />
                  No plan
                </span>
              )
            )}
          </div>
          <p className="text-gray-400 text-xs">{u.email}</p>
        </div>
        {u.role !== "super_admin" && (
          <div className="flex flex-wrap gap-2">
            {APP_KEYS.map(appKey => (
              <AppToggle
                key={appKey}
                appKey={appKey}
                active={u.apps.includes(appKey)}
                disabled={toggling[`${u.id}-${appKey}`]}
                locked={allowedApps.length > 0 && !allowedApps.includes(appKey)}
                onToggle={() => toggleApp(u.id, appKey, u.apps)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SSO launcher (shared with Dashboard) ──────────────────────────────────────
async function launchProduct(appKey: string, fallbackHref: string | undefined, userId: number | undefined) {
  if (!userId) return;
  try {
    const res = await fetch("/api/sso/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": String(userId) },
      body: JSON.stringify({ appKey }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body && body.error) || `Could not launch (HTTP ${res.status}).`;
      alert(`${msg}\n\nFalling back to ${fallbackHref || "the product page"}.`);
      if (fallbackHref) window.open(fallbackHref, "_blank", "noopener,noreferrer");
      return;
    }
    const { redirectUrl } = await res.json();
    if (redirectUrl) {
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
    } else if (fallbackHref) {
      window.open(fallbackHref, "_blank", "noopener,noreferrer");
    }
  } catch {
    alert("Could not reach the sign-in service. Try again in a moment.");
    if (fallbackHref) window.open(fallbackHref, "_blank", "noopener,noreferrer");
  }
}

// ─── Main AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel() {
  const userRef  = useRef<AuthUser>(getUser()!);
  const user     = userRef.current;
  const [, navigate] = useLocation();
  const isSuperAdmin = user.role === "super_admin";
  const userId   = user.id;
  // Products the admin's plan allows them to grant to users (reactive state)
  const [allowedApps, setAllowedApps] = useState<string[]>(
    isSuperAdmin ? [...APP_KEYS] : (user.allowedApps ?? [])
  );
  // The logged-in (non-super) admin's own active subscriptions, fetched from
  // /api/admin/my-plan. Used to render their plan badges and to unlock the
  // per-user "Access" controls in the users tab (groupHasActivePlan).
  const [mySubscriptions, setMySubscriptions] = useState<AdminSubscription[]>([]);

  type Tab = "overview" | "companies" | "users" | "products" | "plans" | "payments" | "settings";
  const [tab, setTab] = useState<Tab>("overview");

  // ── Data ──
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  // Expandable Companies tab — per-company users cache so each card can show
  // its admin + the full list of users inline without leaving the tab.
  const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
  const [companyUsersCache, setCompanyUsersCache] = useState<Record<number, AdminUser[]>>({});
  const [companyUsersLoading, setCompanyUsersLoading] = useState<Record<number, boolean>>({});
  const [companyUsersError, setCompanyUsersError] = useState<Record<number, string | null>>({});
  const [users,     setUsers]     = useState<AdminUser[]>([]);
  const [admins,    setAdmins]    = useState<AdminRow[]>([]);
  const [archivedAdmins, setArchivedAdmins] = useState<AdminRow[]>([]);
  const [adminView, setAdminView] = useState<"active" | "archived">("active");
  const [adminBusy, setAdminBusy] = useState<Record<number, "delete" | "restore" | "permanent" | null>>({});
  const [confirmAction, setConfirmAction] = useState<{ kind: "soft" | "permanent"; admin: AdminRow } | null>(null);
  const [products,  setProducts]  = useState<ProductConfig[]>([]);
  const [plans,     setPlans]     = useState<PlanConfig[]>([]);

  // ── Payments tab (Super Admin: Payment Transactions History) ──────────────
  interface TxnRow {
    id: number;
    transaction_id: string | null;
    subscription_id: string | null;
    customer_id: string | null;
    plan_key: string | null;
    plan_name: string | null;
    amount_cents: number | null;
    currency: string | null;
    status: string;
    billing_period: string | null;
    payment_method_brand: string | null;
    payment_method_last4: string | null;
    receipt_url: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
    archived_at: string | null;
    user_id: number;
    admin_name: string;
    admin_email: string | null;
    admin_role: string;
  }
  interface TxnStats {
    gross_active_cents: string | number;
    gross_all_cents:    string | number;
    count_active:       number;
    count_past_due:     number;
    count_canceled:     number;
    count_total:        number;
  }
  const [txns,         setTxns]         = useState<TxnRow[]>([]);
  const [txnStats,     setTxnStats]     = useState<TxnStats | null>(null);
  const [txnLoading,   setTxnLoading]   = useState(false);
  const [txnError,     setTxnError]     = useState<string | null>(null);
  const [txnSearch,    setTxnSearch]    = useState("");
  const [txnSearchInput, setTxnSearchInput] = useState("");
  const [txnStatus,    setTxnStatus]    = useState<string>("all");
  const [txnDateFrom,  setTxnDateFrom]  = useState<string>("");
  const [txnDateTo,    setTxnDateTo]    = useState<string>("");
  const [txnSortBy,    setTxnSortBy]    = useState<"date" | "amount" | "status">("date");
  const [txnSortDir,   setTxnSortDir]   = useState<"asc" | "desc">("desc");
  const [txnPage,      setTxnPage]      = useState(1);
  const [txnPageSize]                   = useState(10);
  // Archive view toggle (mirrors the Users tab archive pattern). When true,
  // the Payments tab fetches archived rows only and the per-row actions
  // become Restore + Delete Permanently instead of Archive.
  const [txnArchivedView, setTxnArchivedView] = useState(false);
  // Per-row action busy state so we can disable the buttons of the row that
  // is currently being archived/restored/deleted.
  const [txnActionBusyId, setTxnActionBusyId] = useState<number | null>(null);
  // Permanent-delete confirmation dialog target (null = closed).
  const [txnConfirmDelete, setTxnConfirmDelete] = useState<TxnRow | null>(null);
  const [txnTotal,     setTxnTotal]     = useState(0);
  const [txnTotalPages,setTxnTotalPages]= useState(1);
  const [txnDetail,    setTxnDetail]    = useState<TxnRow | null>(null);

  // ── Admin create / edit form ──
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", phone: "", location: "", companyName: "" });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [editAdminDraft, setEditAdminDraft] = useState({ name: "", email: "", username: "", phone: "", location: "" });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [editAdminError, setEditAdminError] = useState<string | null>(null);
  const [showTempPwd, setShowTempPwd] = useState<Record<number, boolean>>({});
  const [resending,   setResending]   = useState<Record<number, boolean>>({});
  const [resettingPwd, setResettingPwd] = useState<Record<number, boolean>>({});
  const [resetPwdTarget, setResetPwdTarget] = useState<
    | { id: number; name: string | null; email: string | null; kind: "admin" | "user" }
    | null
  >(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);
  const [resetPwdShow, setResetPwdShow] = useState(false);
  const [resetPwdSuccess, setResetPwdSuccess] = useState<{ email: string | null; updatedAt: string; emailSent: boolean } | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [userPage, setUserPage] = useState(1);
  const USERS_PAGE_SIZE = 10;

  // ── User create form ──
  const JOB_TITLES = [
    "Designer", "Install Manager", "Installer", "Production",
    "Project Manager", "Sales", "Sub-Contract Installer",
  ];
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "", email: "", phone: "", jobTitle: "", location: "",
    companyId: "" as string | "",
    adminId: "" as string | "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createdUserCreds, setCreatedUserCreds] = useState<
    { name: string; email: string; username: string; emailSent: boolean } | null
  >(null);

  // ── Users page UI state ──
  const [userArchivedView, setUserArchivedView] = useState(false);
  const [userSort,         setUserSort]         = useState<"newest" | "oldest" | "name">("newest");
  const [userBusy,         setUserBusy]         = useState<Record<number, "delete" | "reset" | "permanent" | null>>({});
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<ProductConfig | null>(null);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<PlanConfig | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [confirmPermDeleteUser, setConfirmPermDeleteUser] = useState<AdminUser | null>(null);
  // Bulk-select state for the archived users view
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Edit-user modal state
  const [editingUser,    setEditingUser]    = useState<AdminUser | null>(null);
  const [editUserDraft,  setEditUserDraft]  = useState({ name: "", email: "", username: "", phone: "", location: "", job_title: "" });
  const [savingUser,     setSavingUser]     = useState(false);
  const [editUserError,  setEditUserError]  = useState<string | null>(null);
  // Manage-access modal state
  const [accessUser,    setAccessUser]    = useState<AdminUser | null>(null);
  const [accessDraft,   setAccessDraft]   = useState<Set<string>>(new Set());
  const [accessSaving,  setAccessSaving]  = useState(false);
  const [accessError,   setAccessError]   = useState<string | null>(null);
  // Super-admin "free app grant" modal — grant any app to an admin at no cost.
  const [freeAppsAdmin, setFreeAppsAdmin] = useState<AdminRow | null>(null);
  const [freeAppBusy,   setFreeAppBusy]   = useState<Record<string, boolean>>({});

  // ── UI ──
  const [search,         setSearch]        = useState("");
  const [filterCompany,  setFilterCompany] = useState<number | null>(null);
  const [loading,        setLoading]       = useState(false);
  const [toggling,       setToggling]      = useState<Record<string, boolean>>({});
  const [saving,         setSaving]        = useState<Record<string, boolean>>({});

  // ── Product edit view ──
  const [editingProduct,  setEditingProduct]  = useState<ProductConfig | null>(null);
  const [productDraft,    setProductDraft]    = useState<Partial<ProductConfig>>({});
  // ── Plan edit view ──
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [planDraft,   setPlanDraft]   = useState<Partial<PlanConfig>>({});
  // ── Page-content edit view (opens PageBuilder as a modal over the dashboard
  //    so the admin doesn't lose their place by navigating to /products/:key)
  const [editingPageProduct, setEditingPageProduct] = useState<ProductConfig | null>(null);
  const [savingPageContent,  setSavingPageContent]  = useState(false);

  // Save edited page_content directly via the admin API. Mirrors the save
  // path used by ProductPage's inline editor so saves are consistent whether
  // launched from the dashboard or from the live product page.
  const savePageContent = async (content: PageContent, extras: { logo_url: string }) => {
    if (!editingPageProduct) return;
    setSavingPageContent(true);
    try {
      const body = {
        ...editingPageProduct,
        logo_url: extras.logo_url,
        page_content: content,
      };
      const res = await fetch(
        `/api/admin/products_config/${editingPageProduct.product_key}`,
        {
          method: "PUT",
          headers: authHeaders(userRef.current),
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        alert(j?.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      setEditingPageProduct(null);
      fetchProducts();
    } finally {
      setSavingPageContent(false);
    }
  };

  // ── Fetchers ──
  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/admin/stats`, { headers: authHeaders(userRef.current) });
    if (res.ok) setStats(await res.json());
  }, [userId]);

  const fetchCompanies = useCallback(async () => {
    const res = await fetch(`/api/admin/companies`, { headers: authHeaders(userRef.current) });
    if (res.ok) setCompanies(await res.json());
  }, [userId]);

  // Fetch all users belonging to one company. Cached per-company id so
  // re-expanding a card is instant (Refresh on the company header forces a
  // re-fetch).
  const fetchCompanyUsers = useCallback(async (companyId: number, force = false) => {
    if (!force && companyUsersCache[companyId]) return;
    setCompanyUsersLoading(prev => ({ ...prev, [companyId]: true }));
    setCompanyUsersError(prev => ({ ...prev, [companyId]: null }));
    try {
      const res = await fetch(`/api/admin/users?companyId=${companyId}`, {
        headers: authHeaders(userRef.current),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminUser[] = await res.json();
      setCompanyUsersCache(prev => ({ ...prev, [companyId]: data }));
    } catch (err: any) {
      setCompanyUsersError(prev => ({ ...prev, [companyId]: err?.message ?? "Failed to load users" }));
    } finally {
      setCompanyUsersLoading(prev => ({ ...prev, [companyId]: false }));
    }
  }, [companyUsersCache]);

  const toggleCompanyExpand = useCallback((companyId: number) => {
    setExpandedCompanyId(prev => {
      const next = prev === companyId ? null : companyId;
      if (next !== null) fetchCompanyUsers(next);
      return next;
    });
  }, [fetchCompanyUsers]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany)    params.set("companyId", String(filterCompany));
    if (search)           params.set("search", search);
    if (userArchivedView) params.set("archived", "1");
    const res = await fetch(`/api/admin/users?${params}`, { headers: authHeaders(userRef.current) });
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, [userId, filterCompany, search, userArchivedView]);

  const fetchProducts = useCallback(async () => {
    const res = await fetch(`/api/admin/products_config`, { headers: authHeaders(userRef.current) });
    if (res.ok) setProducts(await res.json());
  }, [userId]);

  const fetchPlans = useCallback(async () => {
    const res = await fetch(`/api/admin/plans_config`, { headers: authHeaders(userRef.current) });
    if (res.ok) setPlans(await res.json());
  }, [userId]);

  const fetchAdmins = useCallback(async () => {
    const res = await fetch(`/api/admin/admins`, { headers: authHeaders(userRef.current) });
    if (res.ok) setAdmins(await res.json());
  }, [userId]);

  const fetchArchivedAdmins = useCallback(async () => {
    const res = await fetch(`/api/admin/admins/archived`, { headers: authHeaders(userRef.current) });
    if (res.ok) setArchivedAdmins(await res.json());
  }, [userId]);

  // ── Open edit modal ──
  const openEditUser = (u: AdminUser) => {
    setEditUserError(null);
    setEditUserDraft({
      name: u.name ?? "",
      email: u.email ?? "",
      username: u.username ?? "",
      phone: u.phone ?? "",
      location: u.location ?? "",
      job_title: u.job_title ?? "",
    });
    setEditingUser(u);
  };

  // ── Manage product access for a user ────────────────────────────────────────
  const openAccessModal = (u: AdminUser) => {
    setAccessError(null);
    setAccessDraft(new Set(u.apps ?? []));
    setAccessUser(u);
  };

  const toggleAccessDraft = (appKey: string) => {
    setAccessDraft(prev => {
      const next = new Set(prev);
      if (next.has(appKey)) next.delete(appKey);
      else next.add(appKey);
      return next;
    });
  };

  const saveAccess = async () => {
    if (!accessUser) return;
    setAccessError(null);

    // Restrict to apps the admin's plan allows (super admin sees all)
    const grantable = new Set(isSuperAdmin ? APP_KEYS : allowedApps);
    const current   = new Set(accessUser.apps ?? []);
    const desired   = new Set([...accessDraft].filter(k => grantable.has(k)));

    const toGrant   = [...desired].filter(k => !current.has(k));
    const toRevoke  = [...current].filter(k => !desired.has(k));

    if (toGrant.length === 0 && toRevoke.length === 0) {
      setAccessUser(null);
      return;
    }

    setAccessSaving(true);
    try {
      const calls = [
        ...toGrant.map(appKey =>
          fetch(`/api/admin/users/${accessUser.id}/apps`, {
            method: "PATCH",
            headers: authHeaders(userRef.current),
            body: JSON.stringify({ appKey, action: "grant" }),
          })
        ),
        ...toRevoke.map(appKey =>
          fetch(`/api/admin/users/${accessUser.id}/apps`, {
            method: "PATCH",
            headers: authHeaders(userRef.current),
            body: JSON.stringify({ appKey, action: "revoke" }),
          })
        ),
      ];
      const results = await Promise.all(calls);
      const failed = results.find(r => !r.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        setAccessError(data.error || "Failed to update product access.");
        return;
      }
      setAccessUser(null);
      await fetchUsers();
      fetchStats();
    } catch (err: any) {
      setAccessError(err?.message || "Network error while updating access.");
    } finally {
      setAccessSaving(false);
    }
  };

  // ── Super-admin: grant/revoke an app to an admin for free ───────────────────
  const toggleAdminFreeApp = async (adminId: number, appKey: string, currentlyGranted: boolean) => {
    const busyKey = `${adminId}:${appKey}`;
    setFreeAppBusy(prev => ({ ...prev, [busyKey]: true }));
    try {
      const res = await fetch(`/api/admin/admins/${adminId}/app-grants`, {
        method: "PATCH",
        headers: authHeaders(userRef.current),
        body: JSON.stringify({ appKey, action: currentlyGranted ? "revoke" : "grant" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || "Failed to update app grant.");
        return;
      }
      const grantedApps: string[] = Array.isArray(data.grantedApps) ? data.grantedApps : [];
      // Update the admins list in place so checkboxes reflect the new state.
      setAdmins(prev => prev.map(a => (a.id === adminId ? { ...a, granted_apps: grantedApps } : a)));
      setFreeAppsAdmin(prev => (prev && prev.id === adminId ? { ...prev, granted_apps: grantedApps } : prev));
    } catch (err: any) {
      window.alert(err?.message || "Network error while updating app grant.");
    } finally {
      setFreeAppBusy(prev => {
        const next = { ...prev };
        delete next[busyKey];
        return next;
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setEditUserError(null);
    if (!editUserDraft.name.trim()) {
      setEditUserError("Full name is required.");
      return;
    }
    if (!editUserDraft.username.trim()) {
      setEditUserError("Username is required.");
      return;
    }
    setSavingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: authHeaders(userRef.current),
        body: JSON.stringify(editUserDraft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditUserError(data.error || "Failed to update user.");
        return;
      }
      setEditingUser(null);
      await fetchUsers();
    } finally {
      setSavingUser(false);
    }
  };

  const openEditAdmin = (a: AdminRow) => {
    setEditAdminError(null);
    setEditAdminDraft({
      name: a.name ?? "",
      email: a.email ?? "",
      username: a.username ?? "",
      phone: a.phone ?? "",
      location: a.location ?? "",
    });
    setEditingAdmin(a);
  };

  // ── Save edited admin ──
  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;
    setEditAdminError(null);
    if (!editAdminDraft.name.trim()) {
      setEditAdminError("Full name is required.");
      return;
    }
    if (!editAdminDraft.username.trim()) {
      setEditAdminError("Username is required.");
      return;
    }
    setSavingAdmin(true);
    try {
      const res = await fetch(`/api/admin/admins/${editingAdmin.id}`, {
        method: "PATCH",
        headers: authHeaders(userRef.current),
        body: JSON.stringify(editAdminDraft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditAdminError(data.error || "Failed to update admin.");
        return;
      }
      setEditingAdmin(null);
      await fetchAdmins();
    } finally {
      setSavingAdmin(false);
    }
  };

  // ── Soft delete admin ──
  const handleSoftDeleteAdmin = async (adminId: number) => {
    setAdminBusy(s => ({ ...s, [adminId]: "delete" }));
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: "DELETE",
        headers: authHeaders(userRef.current),
      });
      if (res.ok) {
        await fetchAdmins();
        if (adminView === "archived") await fetchArchivedAdmins();
        fetchStats();
      }
    } finally {
      setAdminBusy(s => ({ ...s, [adminId]: null }));
      setConfirmAction(null);
    }
  };

  // ── Restore archived admin ──
  const handleRestoreAdmin = async (adminId: number) => {
    setAdminBusy(s => ({ ...s, [adminId]: "restore" }));
    try {
      const res = await fetch(`/api/admin/admins/${adminId}/restore`, {
        method: "POST",
        headers: authHeaders(userRef.current),
      });
      if (res.ok) {
        await fetchArchivedAdmins();
        await fetchAdmins();
        fetchStats();
      }
    } finally {
      setAdminBusy(s => ({ ...s, [adminId]: null }));
    }
  };

  // ── Permanently delete admin ──
  const handlePermanentDeleteAdmin = async (adminId: number) => {
    setAdminBusy(s => ({ ...s, [adminId]: "permanent" }));
    try {
      const res = await fetch(`/api/admin/admins/${adminId}/permanent`, {
        method: "DELETE",
        headers: authHeaders(userRef.current),
      });
      if (res.ok) {
        await fetchArchivedAdmins();
        fetchStats();
      }
    } finally {
      setAdminBusy(s => ({ ...s, [adminId]: null }));
      setConfirmAction(null);
    }
  };

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (tab === "overview") fetchStats(); }, [tab, fetchStats]);
  useEffect(() => { if (isSuperAdmin) fetchCompanies(); }, [isSuperAdmin, fetchCompanies]);
  useEffect(() => { if (tab === "users")    fetchUsers();    }, [tab, fetchUsers]);
  useEffect(() => { if (tab === "users" && isSuperAdmin) fetchAdmins(); }, [tab, isSuperAdmin, fetchAdmins]);
  useEffect(() => { setUserPage(1); setExpandedUserId(null); }, [search, filterCompany, userSort, userArchivedView]);
  // Clear bulk-selection whenever the user leaves the archived view, switches
  // tab, or filters change (selected ids may no longer be visible).
  useEffect(() => { setSelectedArchivedIds(new Set()); }, [userArchivedView, tab, search, filterCompany]);
  useEffect(() => { if (tab === "products" || tab === "overview") fetchProducts(); }, [tab, fetchProducts]);
  useEffect(() => { if (tab === "plans")    fetchPlans();    }, [tab, fetchPlans]);

  // ── Payments tab fetch ────────────────────────────────────────────────────
  // Sequence-token guard: archive/restore/delete handlers fire fetchTxns()
  // in the background while the user might also toggle the archive view or
  // change a filter. Without ordering protection, an older response can land
  // last and clobber the newer state (e.g. repopulate a row we just removed,
  // or show active rows in the archive view). Each fetch claims a sequence
  // number; if it isn't the latest by the time the response arrives, we
  // discard it.
  const txnFetchSeqRef = useRef(0);
  const fetchTxns = useCallback(async () => {
    const seq = ++txnFetchSeqRef.current;
    setTxnLoading(true);
    setTxnError(null);
    try {
      const params = new URLSearchParams();
      if (txnSearch)   params.set("search",   txnSearch);
      if (txnStatus)   params.set("status",   txnStatus);
      if (txnDateFrom) params.set("dateFrom", txnDateFrom);
      if (txnDateTo)   params.set("dateTo",   txnDateTo);
      if (txnArchivedView) params.set("archived", "1");
      params.set("sortBy",   txnSortBy);
      params.set("sortDir",  txnSortDir);
      params.set("page",     String(txnPage));
      params.set("pageSize", String(txnPageSize));

      const res = await fetch(`/api/admin/transactions?${params.toString()}`, {
        headers: authHeaders(user),
      });
      if (seq !== txnFetchSeqRef.current) return; // stale — a newer fetch is in flight.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (seq !== txnFetchSeqRef.current) return; // stale post-await.
      setTxns(json.data ?? []);
      setTxnStats(json.stats ?? null);
      setTxnTotal(json.pagination?.total ?? 0);
      setTxnTotalPages(json.pagination?.totalPages ?? 1);
    } catch (err: any) {
      if (seq !== txnFetchSeqRef.current) return;
      setTxnError(err?.message ?? "Failed to load transactions");
      setTxns([]);
      setTxnStats(null);
    } finally {
      if (seq === txnFetchSeqRef.current) setTxnLoading(false);
    }
  }, [user, txnSearch, txnStatus, txnDateFrom, txnDateTo, txnSortBy, txnSortDir, txnPage, txnPageSize, txnArchivedView]);

  useEffect(() => {
    if (tab === "payments" && isSuperAdmin) fetchTxns();
  }, [tab, isSuperAdmin, fetchTxns]);

  // One-shot per session: if any of the loaded transactions still has a
  // null amount, ask the server to backfill from Stripe (the legacy success
  // flow only called /admin/activate-plan, which never wrote amount_cents).
  // After the backfill completes we refetch so the new amounts appear.
  const txnBackfillTriedRef = useRef(false);
  useEffect(() => {
    if (!isSuperAdmin || tab !== "payments") return;
    // Don't backfill while looking at archived rows — those have intentionally
    // been removed from the active list and shouldn't trigger Stripe lookups.
    if (txnArchivedView) return;
    if (txnBackfillTriedRef.current) return;
    if (!txns.length) return;
    const needsBackfill = txns.some(
      t => t.transaction_id && (t.amount_cents == null || t.payment_method_brand == null)
    );
    if (!needsBackfill) return;
    txnBackfillTriedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/transactions/backfill-amounts", {
          method: "POST",
          headers: authHeaders(userRef.current),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.updated > 0) fetchTxns();
        }
      } catch {
        /* fire-and-forget */
      }
    })();
  }, [txns, isSuperAdmin, tab, fetchTxns]);

  // ─── Payments tab: archive / restore / permanent-delete handlers ─────────
  // Each handler optimistically removes the affected row from the current
  // view so the UI updates immediately, then triggers a background refetch
  // to keep stats / pagination in sync. (The current view never shows the
  // row after the action — archived rows hide from the active list, active
  // rows hide from the archive list, and permanently-deleted rows are gone
  // from both — so a single .filter is correct in every case.)
  const archiveTxn = useCallback(async (id: number) => {
    setTxnActionBusyId(id);
    try {
      const res = await fetch(`/api/admin/transactions/${id}/archive`, {
        method: "POST",
        headers: authHeaders(userRef.current),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to archive transaction");
      } else {
        setTxns(prev => prev.filter(t => t.id !== id));
        setTxnTotal(t => Math.max(0, t - 1));
        fetchTxns();
      }
    } catch {
      alert("Failed to archive transaction");
    } finally {
      setTxnActionBusyId(null);
    }
  }, [fetchTxns]);

  const restoreTxn = useCallback(async (id: number) => {
    setTxnActionBusyId(id);
    try {
      const res = await fetch(`/api/admin/transactions/${id}/restore`, {
        method: "POST",
        headers: authHeaders(userRef.current),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to restore transaction");
      } else {
        setTxns(prev => prev.filter(t => t.id !== id));
        setTxnTotal(t => Math.max(0, t - 1));
        fetchTxns();
      }
    } catch {
      alert("Failed to restore transaction");
    } finally {
      setTxnActionBusyId(null);
    }
  }, [fetchTxns]);

  const permanentlyDeleteTxn = useCallback(async (id: number) => {
    setTxnActionBusyId(id);
    try {
      const res = await fetch(`/api/admin/transactions/${id}/permanent`, {
        method: "DELETE",
        headers: authHeaders(userRef.current),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to delete transaction");
      } else {
        setTxnConfirmDelete(null);
        setTxns(prev => prev.filter(t => t.id !== id));
        setTxnTotal(t => Math.max(0, t - 1));
        fetchTxns();
      }
    } catch {
      alert("Failed to delete transaction");
    } finally {
      setTxnActionBusyId(null);
    }
  }, [fetchTxns]);

  // Reset to page 1 whenever filters/search change so users don't land on an empty page.
  useEffect(() => {
    setTxnPage(1);
  }, [txnSearch, txnStatus, txnDateFrom, txnDateTo, txnSortBy, txnSortDir, txnArchivedView]);
  // Keep adminView in sync with the Users tab's archive toggle
  useEffect(() => {
    setAdminView(userArchivedView ? "archived" : "active");
  }, [userArchivedView]);
  // Load archived admins on demand from the Users tab
  useEffect(() => {
    if (tab === "users" && isSuperAdmin && adminView === "archived") {
      fetchArchivedAdmins();
    }
  }, [tab, isSuperAdmin, adminView, fetchArchivedAdmins]);

  // ── Create new admin ──
  const handleCreateAdmin = async () => {
    setCreateAdminError(null);
    if (!newAdmin.name.trim() || !newAdmin.email.trim()) {
      setCreateAdminError("Full name and email are required.");
      return;
    }
    setCreatingAdmin(true);
    try {
      const res = await fetch(`/api/admin/admins`, {
        method: "POST",
        headers: authHeaders(userRef.current),
        body: JSON.stringify(newAdmin),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateAdminError(data.error || "Failed to create admin.");
        return;
      }
      setNewAdmin({ name: "", email: "", phone: "", location: "", companyName: "" });
      setShowCreateAdmin(false);
      await fetchAdmins();
    } finally {
      setCreatingAdmin(false);
    }
  };

  // ── Create new user ──
  const handleCreateUser = async () => {
    setCreateUserError(null);
    if (!newUser.name.trim() || !newUser.email.trim()) {
      setCreateUserError("Full name and email are required.");
      return;
    }
    if (isSuperAdmin && !newUser.adminId) {
      setCreateUserError("Please select which admin this user belongs to.");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "POST",
        headers: authHeaders(userRef.current),
        body: JSON.stringify({
          name:      newUser.name.trim(),
          email:     newUser.email.trim(),
          phone:     newUser.phone.trim() || undefined,
          jobTitle:  newUser.jobTitle || undefined,
          location:  newUser.location.trim() || undefined,
          adminId:   isSuperAdmin && newUser.adminId ? Number(newUser.adminId) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateUserError(data.error || "Failed to create user.");
        return;
      }
      setCreatedUserCreds({
        name: newUser.name.trim(),
        email: data.email,
        username: data.username,
        emailSent: !!data.emailSent,
      });
      setNewUser({ name: "", email: "", phone: "", jobTitle: "", location: "", companyId: "", adminId: "" });
      setShowCreateUser(false);
      await fetchUsers();
      fetchStats();
    } catch {
      setCreateUserError("Network error. Please try again.");
    } finally {
      setCreatingUser(false);
    }
  };

  // ── Reset admin password (super admin) ──
  const openResetPasswordModal = (admin: AdminRow) => {
    setResetPwdTarget({ id: admin.id, name: admin.name, email: admin.email, kind: "admin" });
    setResetPwdValue("");
    setResetPwdError(null);
    setResetPwdShow(false);
    setResetPwdSuccess(null);
  };

  const openResetUserPasswordModal = (u: AdminUser) => {
    setResetPwdTarget({ id: u.id, name: u.name ?? null, email: u.email ?? null, kind: "user" });
    setResetPwdValue("");
    setResetPwdError(null);
    setResetPwdShow(false);
    setResetPwdSuccess(null);
  };

  const closeResetPasswordModal = () => {
    setResetPwdTarget(null);
    setResetPwdSuccess(null);
    setResetPwdValue("");
    setResetPwdError(null);
  };

  const submitResetAdminPassword = async () => {
    if (!resetPwdTarget) return;
    const pwd = resetPwdValue.trim();
    if (pwd.length < 6) {
      setResetPwdError("Password must be at least 6 characters.");
      return;
    }
    const target = resetPwdTarget;
    setResetPwdError(null);
    setResettingPwd(s => ({ ...s, [target.id]: true }));
    try {
      const res = await fetch(`/api/admin/users/${target.id}/reset-password`, {
        method: "POST",
        headers: { ...authHeaders(userRef.current), "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updatedAt = data.updatedAt || new Date().toISOString();
        if (target.kind === "admin") {
          setAdmins(prev => prev.map(a => a.id === target.id ? { ...a, welcome_sent_at: updatedAt } : a));
        }
        setResetPwdSuccess({
          email: target.email,
          updatedAt,
          emailSent: !!data.emailSent,
        });
      } else {
        setResetPwdError(data.error || "Could not reset password.");
      }
    } catch {
      setResetPwdError("Network error. Please try again.");
    } finally {
      setResettingPwd(s => ({ ...s, [target.id]: false }));
    }
  };

  // ── Resend welcome email ──
  const handleResendWelcome = async (adminId: number) => {
    setResending(s => ({ ...s, [adminId]: true }));
    try {
      const res = await fetch(`/api/admin/admins/${adminId}/resend-welcome`, {
        method: "POST",
        headers: authHeaders(userRef.current),
      });
      if (res.ok) {
        const sentAt = new Date().toISOString();
        setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, welcome_sent_at: sentAt } : a));
      }
    } finally {
      setResending(s => ({ ...s, [adminId]: false }));
    }
  };

  // ── Sync plan from DB on mount (non-super-admin only) ─────────────────────
  useEffect(() => {
    if (isSuperAdmin) return;

    const PLAN_TO_PRODUCTS: Record<string, string[]> = {
      installiq:     ["installiq"],
      signsalesiq:   ["signsalesiq"],
      signtakeoffiq: ["signtakeoffiq"],
      fullsuite:     ["installiq", "signsalesiq", "signtakeoffiq"],
    };

    type MyPlanResponse = {
      planKey: string | null;
      allowedApps: string[];
      subscriptions?: Array<{
        plan_key: string;
        display_name?: string;
        current_period_end?: string | null;
        status?: string;
      }>;
    };

    let cancelled = false;
    let inflight = false;
    let rerunRequested = false;

    async function syncPlan() {
      // Coalesce concurrent triggers: if a sync is already running, just
      // request one follow-up run so the very last event observed still
      // produces a fresh fetch (otherwise rapid focus/storage bursts
      // during the request window would be silently dropped).
      if (inflight) { rerunRequested = true; return; }
      inflight = true;
      try {
        const fetchMyPlan = () =>
          fetch("/api/admin/my-plan", { headers: authHeaders(userRef.current), cache: "no-store" })
            .then(r => r.ok ? r.json() as Promise<MyPlanResponse> : null)
            .catch(() => null);

        let data = await fetchMyPlan();
        if (cancelled) return;
        let serverApps = new Set<string>(data?.allowedApps ?? []);

        // If the local cache holds plans the server doesn't yet know about
        // (e.g. the user just paid and the dashboard refetch beat the
        // /activate-plan POST), push them through to catch the server up.
        const { getActivePlans, setActivePlansFromServer } = await import("@/lib/activePlan");
        const localPlans = getActivePlans();
        const missingPlans = localPlans.filter(p =>
          (PLAN_TO_PRODUCTS[p.planKey] ?? []).some(prod => !serverApps.has(prod))
        );

        if (missingPlans.length > 0) {
          await Promise.all(missingPlans.map(p =>
            fetch("/api/admin/activate-plan", {
              method: "POST",
              headers: { ...authHeaders(userRef.current), "Content-Type": "application/json" },
              body: JSON.stringify({ planKey: p.planKey }),
            }).catch(() => null)
          ));
          if (cancelled) return;
          data = await fetchMyPlan();
          serverApps = new Set<string>(data?.allowedApps ?? []);
        }

        if (cancelled) return;
        // Always reflect the server's subscription list (even when empty) so the
        // admin's own plan badges and the per-user Access controls stay accurate.
        setMySubscriptions(
          (data?.subscriptions ?? []).map(s => ({
            plan_key: s.plan_key,
            display_name: s.display_name ?? s.plan_key,
            status: s.status ?? "active",
            current_period_end: s.current_period_end ?? null,
            cancel_at_period_end: null,
            amount_cents: null,
            currency: null,
            billing_period: null,
          }))
        );
        if (data && data.allowedApps.length > 0) {
          setAllowedApps(data.allowedApps);
          saveUser({ ...userRef.current, allowedApps: data.allowedApps, planKey: data.planKey });
          try {
            setActivePlansFromServer(data.subscriptions ?? []);
          } catch { /* ignore */ }
        }
      } finally {
        inflight = false;
        if (rerunRequested && !cancelled) {
          rerunRequested = false;
          void syncPlan();
        }
      }
    }

    syncPlan();

    // Refresh the "Active Plan" banner the moment a purchase completes
    // (custom event from activePlan helpers), the user returns to this
    // tab from the Stripe checkout window (visibilitychange / focus), or
    // another tab updates the local plan cache (storage event). This is
    // what makes the dashboard update without a manual page refresh.
    const onChanged = () => { void syncPlan(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void syncPlan(); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "ssiq_active_plans" || e.key === "ssiq_active_plan") void syncPlan();
    };
    window.addEventListener("ssiq:active-plans-changed", onChanged);
    window.addEventListener("focus", onChanged);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("ssiq:active-plans-changed", onChanged);
      window.removeEventListener("focus", onChanged);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle app access ──
  const toggleApp = async (targetUserId: number, appKey: string, currentApps: string[]) => {
    const action = currentApps.includes(appKey) ? "revoke" : "grant";
    const key = `${targetUserId}-${appKey}`;
    setToggling(t => ({ ...t, [key]: true }));
    await fetch(`/api/admin/users/${targetUserId}/apps`, {
      method: "PATCH",
      headers: authHeaders(userRef.current),
      body: JSON.stringify({ appKey, action }),
    });
    setToggling(t => ({ ...t, [key]: false }));
    fetchUsers();
  };

  // ── Save product ──
  // id === 0 is the sentinel used by "+ Add Product" — switch to POST in that
  // case so we create a brand-new row instead of trying to PUT a key that
  // doesn't exist yet.
  const saveProduct = async () => {
    if (!editingProduct) return;
    const merged = { ...editingProduct, ...productDraft };
    const isNew = editingProduct.id === 0;
    if (isNew && (!merged.product_key || !/^[a-z0-9_-]+$/.test(merged.product_key))) {
      alert("Product Key is required and must be lowercase letters, digits, _ or -.");
      return;
    }
    setSaving(s => ({ ...s, [merged.product_key || "__new__"]: true }));
    const res = await fetch(
      isNew ? `/api/admin/products_config` : `/api/admin/products_config/${editingProduct.product_key}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: authHeaders(userRef.current),
        body: JSON.stringify(merged),
      }
    );
    setSaving(s => ({ ...s, [merged.product_key || "__new__"]: false }));
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as { error?: string }));
      alert(j?.error ?? `Save failed (HTTP ${res.status})`);
      return;
    }
    setEditingProduct(null);
    setProductDraft({});
    fetchProducts();
    // Creating a product auto-creates its matching plan server-side; refresh
    // the plans list so it shows up without a manual reload.
    if (isNew) fetchPlans();
  };

  // Quick inline flag toggle from the product list (no full-form edit needed).
  // The PUT route merges partial bodies, so sending a single field is safe.
  const toggleProductFlag = async (
    p: ProductConfig,
    field: "coming_soon" | "under_maintenance" | "is_active",
    value: boolean,
  ) => {
    setSaving(s => ({ ...s, [p.product_key]: true }));
    const res = await fetch(`/api/admin/products_config/${p.product_key}`, {
      method: "PUT",
      headers: authHeaders(userRef.current),
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(s => ({ ...s, [p.product_key]: false }));
    if (!res.ok) {
      alert(`Update failed (HTTP ${res.status})`);
      return;
    }
    fetchProducts();
  };

  const deleteProduct = async (key: string) => {
    setDeletingProduct(true);
    const res = await fetch(`/api/admin/products_config/${key}`, {
      method: "DELETE",
      headers: authHeaders(userRef.current),
    });
    setDeletingProduct(false);
    if (!res.ok) {
      alert(`Delete failed (HTTP ${res.status})`);
      return;
    }
    setConfirmDeleteProduct(null);
    setEditingProduct(null);
    setProductDraft({});
    fetchProducts();
  };

  // ── Save plan ──
  const savePlan = async () => {
    if (!editingPlan) return;
    const merged = { ...editingPlan, ...planDraft };
    const isNew = editingPlan.id === 0;
    if (isNew && (!merged.plan_key || !/^[a-z0-9_-]+$/.test(merged.plan_key))) {
      alert("Plan Key is required and must be lowercase letters, digits, _ or -.");
      return;
    }
    setSaving(s => ({ ...s, [merged.plan_key || "__new__"]: true }));
    const payload: Record<string, unknown> = { ...merged };
    if (payload.plan_key === "fullsuite") {
      delete payload.monthly_price;
      delete payload.annual_price;
    }
    const res = await fetch(
      isNew ? `/api/admin/plans_config` : `/api/admin/plans_config/${editingPlan.plan_key}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: authHeaders(userRef.current),
        body: JSON.stringify(payload),
      }
    );
    setSaving(s => ({ ...s, [merged.plan_key || "__new__"]: false }));
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as { error?: string }));
      alert(j?.error ?? `Save failed (HTTP ${res.status})`);
      return;
    }
    setEditingPlan(null);
    setPlanDraft({});
    fetchPlans();
  };

  const deletePlan = async (key: string) => {
    setDeletingPlan(true);
    const res = await fetch(`/api/admin/plans_config/${key}`, {
      method: "DELETE",
      headers: authHeaders(userRef.current),
    });
    setDeletingPlan(false);
    if (!res.ok) {
      alert(`Delete failed (HTTP ${res.status})`);
      return;
    }
    setConfirmDeletePlan(null);
    setEditingPlan(null);
    setPlanDraft({});
    fetchPlans();
  };

  // ── Logo upload (file → base64 → POST → returns hosted URL) ──
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const uploadLogoFile = async (file: File): Promise<string | null> => {
    setUploadingLogo(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/admin/upload-logo`, {
        method: "POST",
        headers: authHeaders(userRef.current),
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        alert(j?.error ?? `Upload failed (HTTP ${res.status})`);
        return null;
      }
      const j = (await res.json()) as { url?: string };
      return j.url ?? null;
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Open the editor in "new product" mode. id=0 is the sentinel checked by
  // saveProduct to decide POST vs PUT.
  const startNewProduct = () => {
    setEditingProduct({
      id: 0, product_key: "", display_name: "", category: "", description: "",
      logo_url: "", redirect_url: "",
      monthly_price: 14900, discount_price: 12900,
      is_active: true, coming_soon: false, under_maintenance: false, sort_order: (products.length || 0) + 1,
    });
    setProductDraft({});
  };
  const startNewPlan = () => {
    setEditingPlan({
      id: 0, plan_key: "", display_name: "", category: "",
      monthly_price: 0, annual_price: 0, description: "", features: [],
      is_active: true, coming_soon: false, sort_order: (plans.length || 0) + 1,
    });
    setPlanDraft({});
  };

  // ── Group users ──
  const groupedUsers = (() => {
    if (!isSuperAdmin || filterCompany || search) return null;
    const groups: Record<string, { companyName: string; admin: AdminUser | null; members: AdminUser[] }> = {};
    const noCompany: AdminUser[] = [];
    for (const u of users) {
      if (u.role === "super_admin") continue;
      if (!u.company_id) { noCompany.push(u); continue; }
      const gKey = String(u.company_id);
      if (!groups[gKey]) groups[gKey] = { companyName: u.company_name ?? "Unknown", admin: null, members: [] };
      if (u.role === "admin") groups[gKey].admin = u;
      else groups[gKey].members.push(u);
    }
    const superAdmins = users.filter(u => u.role === "super_admin");
    return { groups: Object.values(groups), noCompany, superAdmins };
  })();

  const priceFmt = (cents: number) => `$${Math.floor(cents / 100)}`;

  const tabs = [
    { key: "overview"  as const, label: "Overview",   icon: LayoutDashboard },
    ...(isSuperAdmin ? [
      { key: "companies" as const, label: "Companies", icon: Building2 },
    ] : []),
    { key: "users"     as const, label: "Users",      icon: Users },
    ...(isSuperAdmin ? [
      { key: "products" as const, label: "Products",  icon: Package },
      { key: "plans"    as const, label: "Plans",     icon: CreditCard },
      { key: "payments" as const, label: "Payments",  icon: Receipt },
    ] : []),
    { key: "settings"  as const, label: "Account Settings", icon: Settings },
  ];

  const userName = user.name || user.username || user.email;

  // ── Users-tab helpers ────────────────────────────────────────────────────────
  const APP_LABELS_LOCAL: Record<string,string> = APP_LABELS as any;

  // sorted/filtered user list for the Users tab table (excludes super_admins)
  const usersForTable = (() => {
    const list = users.filter(u => u.role !== "super_admin");
    // Two-pass deduplication to handle sync artifacts:
    //
    // Pass 1 — build the set of emails that already have a company-assigned
    //           account. These are the "canonical" records.
    // Pass 2 — filter the full list:
    //   (a) Within the same company, collapse duplicate email rows.
    //   (b) Across companies, drop any unassigned row whose email already
    //       appears under a real company (cross-company orphan dedup).
    // Rows with no email are never merged so no data is silently lost.
    const emailsWithCompany = new Set<string>();
    for (const u of list) {
      if (u.company_id != null && u.email) {
        emailsWithCompany.add(u.email.toLowerCase());
      }
    }
    const seenByCompanyEmail = new Set<string>();
    const deduped = list.filter(u => {
      if (!u.email) return true;
      const email = u.email.toLowerCase();
      // Drop unassigned orphans whose email is already covered by a company member
      if (u.company_id == null && emailsWithCompany.has(email)) return false;
      // Drop within-company duplicates (same company + same email)
      const key = `${u.company_id ?? ""}:${email}`;
      if (seenByCompanyEmail.has(key)) return false;
      seenByCompanyEmail.add(key);
      return true;
    });
    const sorted = [...deduped];
    if (userSort === "newest") {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (userSort === "oldest") {
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return sorted;
  })();

  // Pagination
  const usersTotalPages = Math.max(1, Math.ceil(usersForTable.length / USERS_PAGE_SIZE));
  const usersPageSafe = Math.min(userPage, usersTotalPages);
  const usersPageStart = (usersPageSafe - 1) * USERS_PAGE_SIZE;
  const usersPageEnd = Math.min(usersPageStart + USERS_PAGE_SIZE, usersForTable.length);
  const usersPageRows = usersForTable.slice(usersPageStart, usersPageEnd);

  // Owner-grouped view: each admin + their users beneath
  const OWNERS_PAGE_SIZE = 5;
  const usersByCompanyId = (() => {
    const m = new Map<number, typeof usersForTable>();
    for (const u of usersForTable) {
      // Include every company-assigned user (members AND co-admins). Only ONE
      // admin per company is shown as the owner-group header (the canonical
      // owner, see deduplicatedOwnerAdmins); any additional admins must still
      // appear as rows so they are never silently dropped. The canonical owner
      // is removed from their own group by id below (u.id !== a.id), which
      // prevents the header admin from also showing up as a row.
      if (u.company_id != null) {
        const arr = m.get(u.company_id) ?? [];
        arr.push(u);
        m.set(u.company_id, arr);
      }
    }
    return m;
  })();
  // For a regular (non-super) admin there is no fetched `admins` list (that
  // endpoint is super-admin only). The logged-in admin IS the owner of their
  // own company, so synthesize an owner row from the current user. Without it,
  // every user in their company collapses into the "Unassigned Users" orphan
  // group instead of grouping neatly under the admin.
  const selfAsOwner: AdminRow | null =
    !isSuperAdmin && user.companyId != null
      ? {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: null,
          location: null,
          role: "admin",
          company_id: user.companyId,
          company_name: user.companyName,
          active_plan_key: null,
          subscriptions: mySubscriptions,
          temp_password: null,
          welcome_sent_at: null,
          created_at: "",
        }
      : null;
  const ownerAdminsList: AdminRow[] = isSuperAdmin
    ? (userArchivedView ? archivedAdmins : admins)
    : (selfAsOwner ? [selfAsOwner] : []);
  // Deduplicate by company_id: a company may have multiple admin-role users
  // (e.g. from a data sync that created duplicate accounts for the same person).
  // Prefer the admin whose email matches business_details.admin_email so the
  // canonical owner is always shown; fall back to the first encountered.
  const deduplicatedOwnerAdmins = (() => {
    const byCompany = new Map<number, (typeof ownerAdminsList)[number]>();
    for (const a of ownerAdminsList) {
      if (a.company_id == null) continue;
      if (!byCompany.has(a.company_id)) {
        byCompany.set(a.company_id, a);
      } else {
        const company = companies.find(c => c.id === a.company_id);
        if (
          company?.admin_email &&
          a.email?.toLowerCase() === company.admin_email.toLowerCase()
        ) {
          byCompany.set(a.company_id, a);
        }
      }
    }
    return [...byCompany.values()];
  })();
  const orphanUsers = usersForTable.filter(u => u.company_id == null
    || !ownerAdminsList.some(a => a.company_id === u.company_id));
  const ownerGroupsAll: { admin: AdminRow | null; users: typeof usersForTable }[] =
    deduplicatedOwnerAdmins
      .filter(a => filterCompany === null || a.company_id === filterCompany)
      .map(a => ({
        admin: a,
        // Exclude the admin themselves from their own user list — they are
        // already shown as the owner header, so displaying them again as a
        // sub-row would create a duplicate entry for the same person.
        users: (usersByCompanyId.get(a.company_id as number) ?? []).filter(u => u.id !== a.id),
      }));
  if (filterCompany === null && orphanUsers.length > 0) {
    ownerGroupsAll.push({ admin: null, users: orphanUsers });
  }
  // When searching, hide owner groups with no matching users — BUT keep a group
  // whose owner/admin header itself matches the search term, otherwise searching
  // for an admin who has no (other) team members would make them disappear with
  // a misleading "No users found".
  const ownerMatchesSearch = (a: AdminRow | null) => {
    if (!a) return false;
    const q = search.trim().toLowerCase();
    if (!q) return false;
    return (
      (a.name ?? "").toLowerCase().includes(q) ||
      (a.email ?? "").toLowerCase().includes(q) ||
      (a.username ?? "").toLowerCase().includes(q)
    );
  };
  const ownerGroups = search.trim()
    ? ownerGroupsAll.filter(g => g.users.length > 0 || ownerMatchesSearch(g.admin))
    : ownerGroupsAll;
  const ownersTotalPages = Math.max(1, Math.ceil(ownerGroups.length / OWNERS_PAGE_SIZE));
  const ownersPageSafe = Math.min(userPage, ownersTotalPages);
  const ownersPageStart = (ownersPageSafe - 1) * OWNERS_PAGE_SIZE;
  const ownersPageEnd = Math.min(ownersPageStart + OWNERS_PAGE_SIZE, ownerGroups.length);
  const ownerGroupsPage = ownerGroups.slice(ownersPageStart, ownersPageEnd);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const m = d.toLocaleDateString("en-US", { month: "short" });
      return `${m} ${d.getDate()}, ${String(d.getFullYear()).slice(-2)}`;
    } catch { return "—"; }
  };

  const exportUsersCSV = () => {
    const headers = ["S.No.", "Full Name", "Email", "Username", "Phone", "Role", "Job Title", "Location", "Company", "Joined Date"];
    const rows = usersForTable.map((u, i) => [
      String(i + 1), u.name ?? "", u.email ?? "", u.username ?? "",
      u.phone ?? "", u.role ?? "", u.job_title ?? "", u.location ?? "",
      u.company_name ?? "", fmtDate(u.created_at),
    ]);
    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetUserPassword = async (u: AdminUser) => {
    if (!confirm(`Reset password for ${u.name}? They will need to use the new temporary password to sign in.`)) return;
    setUserBusy(s => ({ ...s, [u.id]: "reset" }));
    try {
      const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
        method: "POST", headers: authHeaders(userRef.current),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Failed to reset password"); return; }
      setCreatedUserCreds({
        name: data.name, email: data.email ?? u.email,
        username: data.username, emailSent: !!data.emailSent,
      });
    } finally {
      setUserBusy(s => ({ ...s, [u.id]: null }));
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    const u = confirmDeleteUser;
    setUserBusy(s => ({ ...s, [u.id]: "delete" }));
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE", headers: authHeaders(userRef.current),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to archive user");
        return;
      }
      setConfirmDeleteUser(null);
      await fetchUsers();
      fetchStats();
    } finally {
      setUserBusy(s => ({ ...s, [u.id]: null }));
    }
  };

  const handleRestoreUser = async (u: AdminUser) => {
    setUserBusy(s => ({ ...s, [u.id]: "delete" }));
    try {
      const res = await fetch(`/api/admin/users/${u.id}/restore`, {
        method: "POST", headers: authHeaders(userRef.current),
      });
      if (res.ok) {
        await fetchUsers();
        fetchStats();
        // If the restored user was an admin, also refresh the archivedAdmins
        // cache so the owner-grouping in the archived view stays in sync.
        if (isSuperAdmin && (u.role === "admin" || u.role === "super_admin")) {
          await fetchArchivedAdmins();
        }
      }
    } finally {
      setUserBusy(s => ({ ...s, [u.id]: null }));
    }
  };

  // Bulk permanent-delete of selected archived users (super admin only).
  const handleBulkPermanentDelete = async () => {
    const ids = Array.from(selectedArchivedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id =>
          fetch(`/api/admin/users/${id}/permanent`, {
            method: "DELETE",
            headers: authHeaders(userRef.current),
          }).then(async r => {
            if (!r.ok) {
              const d = await r.json().catch(() => ({}));
              throw new Error(d.error || `Failed (${r.status})`);
            }
            return id;
          })
        )
      );
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed > 0) {
        alert(`${ids.length - failed} of ${ids.length} deleted. ${failed} failed.`);
      }
      setConfirmBulkDeleteOpen(false);
      setSelectedArchivedIds(new Set());
      // Invalidate the per-company cache so the expanded company group in the
      // archive view drops the just-deleted rows. Force-refetch whichever
      // company is currently expanded so the user sees the change immediately.
      setCompanyUsersCache({});
      if (expandedCompanyId !== null) {
        await fetchCompanyUsers(expandedCompanyId, true);
      }
      await fetchUsers();
      fetchStats();
      await fetchArchivedAdmins();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Permanently delete an already-archived user (super admin only, hard delete).
  const handlePermanentDeleteUser = async () => {
    if (!confirmPermDeleteUser) return;
    const u = confirmPermDeleteUser;
    setUserBusy(s => ({ ...s, [u.id]: "permanent" }));
    try {
      const res = await fetch(`/api/admin/users/${u.id}/permanent`, {
        method: "DELETE", headers: authHeaders(userRef.current),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to permanently delete user");
        return;
      }
      setConfirmPermDeleteUser(null);
      // Invalidate the per-company cache so the expanded company group in the
      // archive view drops the just-deleted row. Force-refetch whichever
      // company is currently expanded so the user sees the change immediately.
      setCompanyUsersCache({});
      if (expandedCompanyId !== null) {
        await fetchCompanyUsers(expandedCompanyId, true);
      }
      await fetchUsers();
      fetchStats();
      // If the deleted user was an admin, also refresh archivedAdmins so the
      // owner header in archived view doesn't show a now-deleted admin.
      if (u.role === "admin" || u.role === "super_admin") {
        await fetchArchivedAdmins();
      }
    } finally {
      setUserBusy(s => ({ ...s, [u.id]: null }));
    }
  };

  // Initials for avatar bubble
  const initialsOf = (n: string | null) =>
    (n || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("") || "?";

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ═══ Page Builder modal — opens over the dashboard so editing the
            product page never navigates the admin away from their context.
            PageBuilder's fullscreen mode (no `inline` prop) already renders
            as a fixed overlay covering the viewport. */}
      {editingPageProduct && (
        <PageBuilder
          productName={editingPageProduct.display_name}
          initialContent={editingPageProduct.page_content as PageContent | null}
          initialLogoUrl={editingPageProduct.logo_url ?? ""}
          saving={savingPageContent}
          restrictSections={!!editingPageProduct.page_content?.sections?.length}
          onSave={savePageContent}
          onClose={() => setEditingPageProduct(null)}
        />
      )}

      {/* ═══ Dark Sidebar ═══════════════════════════════════════════════ */}
      <aside
        className="w-64 flex-shrink-0 flex-col hidden md:flex shadow-xl"
        style={{
          background: "linear-gradient(180deg, #1C2A3A 0%, #16222F 100%)",
        }}
      >

        {/* User info */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-orange-400/40"
              style={{ background: "linear-gradient(135deg, #E8932C 0%, #D97706 100%)" }}
            >
              <span className="text-white text-base font-bold">
                {(userName[0] ?? "A").toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">{userName}</p>
              <p className="text-orange-300/90 text-[10px] uppercase tracking-widest font-semibold mt-0.5">
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 pt-5 pb-3 space-y-1 overflow-y-auto">
          <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] px-3 mb-3 font-semibold">
            Navigation
          </p>
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { setTab(key); setEditingProduct(null); setEditingPlan(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left relative group ${
                  active
                    ? "text-white shadow-sm"
                    : "text-white/70 hover:text-white hover:bg-white/[0.06]"
                }`}
                style={
                  active
                    ? { background: "linear-gradient(90deg, rgba(232,147,44,0.18) 0%, rgba(232,147,44,0.06) 100%)" }
                    : {}
                }
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                    style={{ background: "#E8932C" }}
                  />
                )}
                <Icon
                  className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                    active ? "text-orange-400" : "text-white/60 group-hover:text-white/90"
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-all group"
          >
            <Home className="w-[18px] h-[18px] text-white/60 group-hover:text-orange-400 transition-colors" />
            Back to Home
          </button>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/65 hover:text-white hover:bg-red-500/10 text-sm font-medium transition-all group"
          >
            <LogOut className="w-[18px] h-[18px] group-hover:text-red-400 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ═══ Light Content Area ══════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto" style={{ background: "#f7f8fb" }}>

        {/* Mobile tab bar */}
        <div className="md:hidden flex gap-2 px-4 pt-4 pb-3 bg-white border-b border-gray-100 overflow-x-auto sticky top-0 z-10">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                tab === key
                  ? "bg-orange-50 text-orange-600 border-orange-300"
                  : "text-gray-400 border-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 w-full max-w-[1600px] mx-auto">

          {/* ── Overview ── */}
          {tab === "overview" && (
            <div>
              <div className="mb-8">
                <h1 className="text-[#1C2A3A] text-2xl font-bold mb-1">Overview</h1>
                <p className="text-gray-400 text-sm">
                  {isSuperAdmin ? "Platform-wide summary and quick-launch" : `Managing ${user.companyName ?? "your company"}`}
                </p>
              </div>

              {/* Stats */}
              {stats ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
                  <StatCard label="Companies"        value={stats.companies} icon={Building2} />
                  <StatCard label="Total Users"      value={stats.users}     icon={Users} />
                  {isSuperAdmin && stats.appGrants !== undefined && (
                    <StatCard label="Active App Grants" value={stats.appGrants} icon={Shield} />
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm mb-10">Loading…</div>
              )}

              {/* Plan notice for non-super admins */}
              {!isSuperAdmin && (
                <div className="mb-8 px-4 py-3 rounded-xl border flex items-start gap-3"
                  style={{ background: "#fff8f0", borderColor: "rgba(232,147,44,0.25)" }}>
                  <Package className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#E8932C" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#E8932C" }}>
                      {allowedApps.length > 0
                        ? `Your plan includes: ${allowedApps.map(k => APP_LABELS[k]).join(", ")}`
                        : "No active plan — please purchase a plan to grant product access."}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Users can only be granted access to products included in your current plan.</p>
                  </div>
                </div>
              )}

              {/* Quick launch */}
              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium mb-4">Quick Launch</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(products.filter(p => p.is_active).length > 0
                    ? products.filter(p => p.is_active)
                    : APP_KEYS.map(k => ({
                        product_key: k,
                        display_name: APP_LABELS[k],
                        logo_url: PRODUCT_LOGOS[k],
                        redirect_url: PRODUCT_LAUNCH_URLS[k],
                      } as any))
                  ).map((p: any) => {
                    const key = p.product_key;
                    const url = p.redirect_url || PRODUCT_LAUNCH_URLS[key];
                    const label = p.display_name || APP_LABELS[key] || key;
                    const logo = p.logo_url || PRODUCT_LOGOS[key] || "";
                    const comingSoon = !!p.coming_soon;
                    const inPlan = isSuperAdmin || allowedApps.includes(key);
                    const canLaunch = inPlan && !comingSoon;
                    return (
                      <button
                        key={key}
                        onClick={() => canLaunch && launchProduct(key, url, user.id)}
                        disabled={!canLaunch}
                        className={`group flex flex-col items-center gap-3 rounded-xl p-6 transition-all shadow-sm ${
                          canLaunch
                            ? "bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5"
                            : "bg-gray-50 border border-gray-100 opacity-40 cursor-not-allowed"
                        }`}
                      >
                        {logo
                          ? <img src={logo} alt={label} className={`h-10 object-contain ${!canLaunch ? "grayscale" : ""}`} />
                          : <div className="h-10 flex items-center text-gray-700 font-semibold">{label}</div>}
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs group-hover:text-orange-500 transition-colors">
                          {!inPlan
                            ? <span className="text-gray-300">Not in plan</span>
                            : comingSoon
                              ? <span className="text-gray-300">Coming soon</span>
                              : <><ExternalLink className="w-3 h-3" /> Launch</>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Companies ── */}
          {tab === "companies" && isSuperAdmin && (() => {
            // Tiny helper for avatar initials.
            const initials = (name: string | null) =>
              (name ?? "—")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(p => p[0]!.toUpperCase())
                .join("") || "—";
            return (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h1 className="text-[#1C2A3A] text-2xl font-bold mb-1">Companies</h1>
                    <p className="text-gray-400 text-sm">
                      {companies.length} companies registered · click any card to see its admin and users
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Drop the per-company users cache so any currently-expanded card
                      // (or future expansions) re-fetches fresh data after this Refresh.
                      setCompanyUsersCache({});
                      setCompanyUsersError({});
                      fetchCompanies();
                      if (expandedCompanyId !== null) fetchCompanyUsers(expandedCompanyId, true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                {companies.length === 0 && (
                  <div className="bg-white border border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-400 text-sm">
                    <Building2 className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                    No companies registered yet.
                  </div>
                )}

                <div className="space-y-3">
                  {companies.map(c => {
                    const expanded = expandedCompanyId === c.id;
                    const cuLoading = !!companyUsersLoading[c.id];
                    const cuError   = companyUsersError[c.id];
                    const cuData    = companyUsersCache[c.id];
                    // The Administrator block represents the canonical company owner
                    // (business_details.admin_id, surfaced as c.admin_email). Match by
                    // email first; if that fails (e.g. the owner record was deleted but
                    // the FK is stale), fall back to ANY admin-role user. The remaining
                    // admins are NOT dropped — they appear in the users grid alongside
                    // the regular users so multi-admin companies don't silently lose rows.
                    const adminMember =
                      (c.admin_email
                        ? cuData?.find(u => u.email?.toLowerCase() === c.admin_email!.toLowerCase())
                        : undefined)
                      ?? cuData?.find(u => u.role === "admin" || u.role === "super_admin");
                    const memberUsers = cuData?.filter(u => u.id !== adminMember?.id) ?? [];
                    return (
                      <div
                        key={c.id}
                        className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${
                          expanded ? "border-orange-200" : "border-gray-100 hover:border-orange-200"
                        }`}
                      >
                        {/* Card header — clickable to toggle expand */}
                        <button
                          type="button"
                          onClick={() => toggleCompanyExpand(c.id)}
                          className="w-full text-left px-5 py-4 flex items-center gap-4 group"
                          aria-expanded={expanded}
                          aria-controls={`company-${c.id}-panel`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[#1C2A3A] font-semibold truncate">{c.business_name}</p>
                            <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-0.5">
                              {c.business_email && (
                                <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                                  <Mail className="w-3 h-3 text-gray-300" />{c.business_email}
                                </span>
                              )}
                              {c.contact_number && (
                                <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                                  <Phone className="w-3 h-3 text-gray-300" />{c.contact_number}
                                </span>
                              )}
                              {c.admin_name ? (
                                <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                                  <Shield className="w-3 h-3 text-gray-300" />Admin: <span className="text-gray-700 font-medium">{c.admin_name}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                                  <AlertTriangle className="w-3 h-3" />No admin assigned
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-[#1C2A3A] text-base font-bold leading-tight">{c.user_count}</p>
                              <p className="text-gray-400 text-[10px] uppercase tracking-widest">users</p>
                            </div>
                            <ChevronDown
                              className={`w-5 h-5 text-gray-300 group-hover:text-orange-400 transition-transform ${expanded ? "rotate-180 text-orange-400" : ""}`}
                            />
                          </div>
                        </button>

                        {/* Expanded panel: admin + users */}
                        {expanded && (
                          <div id={`company-${c.id}-panel`} className="px-5 pb-5 pt-0 border-t border-gray-100 bg-gray-50/40">
                            {/* Action row */}
                            <div className="flex items-center justify-between gap-2 pt-3 pb-3">
                              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Organization</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); fetchCompanyUsers(c.id, true); }}
                                  disabled={cuLoading}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-white transition-all disabled:opacity-50"
                                  title="Reload this company's users"
                                >
                                  <RefreshCw className={`w-3 h-3 ${cuLoading ? "animate-spin" : ""}`} /> Refresh
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setFilterCompany(c.id); setTab("users"); }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-white transition-all"
                                  title="Open in Users tab to manage"
                                >
                                  Manage in Users <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Administrator block */}
                            <div className="bg-white border border-orange-100 rounded-xl px-4 py-3 mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {initials(adminMember?.name ?? c.admin_name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[#1C2A3A] font-semibold text-sm truncate">
                                      {adminMember?.name ?? c.admin_name ?? "Unassigned"}
                                    </p>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 text-[10px] font-semibold uppercase tracking-wider">
                                      <Shield className="w-2.5 h-2.5" />
                                      {adminMember?.role === "super_admin" ? "Super Admin" : "Admin"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-0.5 text-xs text-gray-500">
                                    {(adminMember?.email ?? c.admin_email) && (
                                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3 text-gray-300" />{adminMember?.email ?? c.admin_email}</span>
                                    )}
                                    {adminMember?.phone && (
                                      <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-gray-300" />{adminMember.phone}</span>
                                    )}
                                    {adminMember?.plan_name && (
                                      <span className="inline-flex items-center gap-1"><Package className="w-3 h-3 text-gray-300" />{adminMember.plan_name}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Users grid */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                  Users {cuData ? `(${memberUsers.length})` : ""}
                                </p>
                              </div>

                              {cuLoading && !cuData && (
                                <div className="bg-white border border-gray-100 rounded-xl py-8 text-center text-gray-400 text-xs">
                                  Loading users…
                                </div>
                              )}

                              {!cuLoading && cuError && (
                                <div className="bg-white border border-red-100 rounded-xl py-6 text-center text-red-500 text-xs">
                                  Failed to load: {cuError}
                                </div>
                              )}

                              {!cuLoading && !cuError && cuData && memberUsers.length === 0 && (
                                <div className="bg-white border border-dashed border-gray-200 rounded-xl py-6 text-center text-gray-400 text-xs">
                                  <Users className="w-5 h-5 mx-auto mb-1.5 text-gray-300" />
                                  No users under this admin yet.
                                </div>
                              )}

                              {!cuError && memberUsers.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {memberUsers.map(u => (
                                    <div
                                      key={u.id}
                                      className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 flex items-start gap-3"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                                        {initials(u.name)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-[#1C2A3A] font-medium text-sm truncate">{u.name}</p>
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-medium capitalize">
                                            {u.role.replace(/_/g, " ")}
                                          </span>
                                        </div>
                                        <div className="text-gray-500 text-[11px] truncate" title={u.email}>{u.email}</div>
                                        <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-gray-400 text-[11px] mt-0.5">
                                          {u.phone && <span className="inline-flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{u.phone}</span>}
                                          {u.job_title && <span className="italic">{u.job_title}</span>}
                                        </div>
                                        {u.apps && u.apps.length > 0 && (
                                          <div className="flex items-center gap-1 flex-wrap mt-1">
                                            {u.apps.map(app => (
                                              <span key={app} className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[10px] font-medium">
                                                {app}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* ── Users ── */}
          {tab === "users" && (
            <div>
              {/* Page header — matches reference */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  {userArchivedView && (
                    <button
                      onClick={() => setUserArchivedView(false)}
                      className="w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center flex-shrink-0 transition-all"
                      title="Back to active users"
                      aria-label="Back to active users"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-[#1C2A3A] text-xl sm:text-2xl font-bold leading-tight">
                      {userArchivedView ? "Archived Users" : "User Management"}
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      {userArchivedView ? "Restore or permanently delete archived users" : "Manage your users"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setUserArchivedView(v => !v)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      userArchivedView
                        ? "bg-orange-50 border-orange-300 text-orange-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    title={userArchivedView ? "Showing archived users" : "Show archived users"}
                  >
                    {userArchivedView ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    {userArchivedView ? "Active" : "Archive"}
                  </button>
                  <button
                    onClick={exportUsersCSV}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export All Data</span>
                    <span className="sm:hidden">Export</span>
                  </button>
                  {isSuperAdmin && !userArchivedView && (
                    <button
                      onClick={() => { setShowCreateAdmin(true); setCreateAdminError(null); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 hover:shadow-md"
                      style={{ background: "linear-gradient(135deg, #E8932C 0%, #d97e1f 100%)" }}
                      title="Create a new admin"
                    >
                      <Shield className="w-4 h-4" />
                      Add Admin
                    </button>
                  )}
                  {!userArchivedView && (
                    <button
                      onClick={() => { setShowCreateUser(true); setCreateUserError(null); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 hover:shadow-md"
                      style={{ background: "linear-gradient(135deg, #E8932C 0%, #d97e1f 100%)" }}
                    >
                      <Plus className="w-4 h-4" />
                      Add User
                    </button>
                  )}
                </div>
              </div>

              {/* Success card — invitation sent */}
              {createdUserCreds && (
                <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                        <Check className="w-4 h-4" />
                        User <strong>{createdUserCreds.name}</strong> created
                      </div>
                      <p className="mt-1 text-sm text-emerald-700">
                        {createdUserCreds.emailSent
                          ? "An invitation email was sent. They can click the link to set their own password and sign in."
                          : "Email delivery is not configured — please ask them to use \"Forgot password\" on the sign-in page to set their password."}
                      </p>
                      <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                        <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Email</div>
                          <div className="font-mono text-gray-900">{createdUserCreds.email}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Username</div>
                          <div className="font-mono text-gray-900">{createdUserCreds.username}</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setCreatedUserCreds(null)} className="p-1 rounded text-emerald-700 hover:bg-emerald-100">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Create user modal */}
              {showCreateUser && (
                <div
                  className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
                  onClick={() => setShowCreateUser(false)}
                >
                  <div
                    className="bg-white shadow-2xl w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[88vh]"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Sticky header */}
                    <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-[#1C2A3A]">Add New User</h2>
                        <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
                          We'll email an invitation link so they can set their own password.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowCreateUser(false)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 flex-shrink-0"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Scrollable body */}
                    <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                      {isSuperAdmin && (
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
                            Admin <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={newUser.adminId}
                            onChange={e => setNewUser(s => ({ ...s, adminId: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          >
                            <option value="">Select an admin</option>
                            {admins
                              .filter(a => a.company_id != null)
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name}{a.company_name ? ` — ${a.company_name}` : ""}
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-[11px] text-gray-500">
                            The new user will be created under the selected admin's company.
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newUser.name}
                          onChange={e => setNewUser(s => ({ ...s, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="e.g., John Doe"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="user@company.com"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Phone</label>
                          <input
                            type="tel"
                            value={newUser.phone}
                            onChange={e => setNewUser(s => ({ ...s, phone: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                            placeholder="(555) 123-4567"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Role</label>
                          <input
                            type="text"
                            value="User"
                            disabled
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Job Title</label>
                          <select
                            value={newUser.jobTitle}
                            onChange={e => setNewUser(s => ({ ...s, jobTitle: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          >
                            <option value="">Select a job title</option>
                            {JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Location</label>
                          <input
                            type="text"
                            value={newUser.location}
                            onChange={e => setNewUser(s => ({ ...s, location: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                            placeholder="City, State"
                          />
                        </div>
                      </div>

                      {createUserError && (
                        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                          {createUserError}
                        </div>
                      )}
                    </div>

                    {/* Sticky footer */}
                    <div className="px-5 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 bg-gray-50/70 rounded-b-2xl flex-shrink-0">
                      <button
                        onClick={() => setShowCreateUser(false)}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-gray-700 hover:bg-gray-200/60 text-sm font-medium transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateUser}
                        disabled={creatingUser}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #E8932C 0%, #d97e1f 100%)" }}
                      >
                        {creatingUser ? "Creating…" : (<><Check className="w-4 h-4" /> Create User</>)}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan access notice for admins — only shown when no plan is active */}
              {!isSuperAdmin && allowedApps.length === 0 && (
                <div className="mb-5 px-4 py-3 rounded-xl border flex items-start gap-3"
                  style={{ background: "#fff8f0", borderColor: "rgba(232,147,44,0.25)" }}>
                  <Package className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#E8932C" }} />
                  <p className="text-sm" style={{ color: "#92400e" }}>
                    No active plan — purchase a plan to enable product access for your users.
                  </p>
                </div>
              )}

              {/* Inline "Users" tab pill */}
              <div className="border-b border-gray-200 mb-4">
                <div className="inline-flex items-center gap-2 pb-2 border-b-2 -mb-px"
                  style={{ borderColor: "#E8932C" }}>
                  <Users className="w-4 h-4" style={{ color: "#E8932C" }} />
                  <span className="text-sm font-semibold" style={{ color: "#E8932C" }}>Users</span>
                  {isSuperAdmin && filterCompany !== null && (() => {
                    const sel = admins.find(a => a.company_id === filterCompany);
                    return sel ? (
                      <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-medium">
                        Owner: {sel.name}
                        <button
                          onClick={(e) => { e.stopPropagation(); setFilterCompany(null); }}
                          className="ml-0.5 hover:text-orange-900"
                          title="Clear owner filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Search + filter + sort row */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="ssiq-user-search"
                    autoComplete="off"
                    placeholder="Search by name, email, or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchUsers()}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm placeholder:text-gray-400 focus:outline-none focus:border-orange-400 shadow-sm"
                  />
                </div>
                {isSuperAdmin && (
                  <select
                    value={filterCompany ?? ""}
                    onChange={e => { setFilterCompany(e.target.value ? Number(e.target.value) : null); }}
                    className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400 shadow-sm min-w-[160px]"
                  >
                    <option value="">All Owners</option>
                    {ownerAdminsList.filter(a => a.company_id != null).map(a => (
                      <option key={a.id} value={a.company_id as number}>{a.name}</option>
                    ))}
                  </select>
                )}
                <div className="relative">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  <select
                    value={userSort}
                    onChange={e => setUserSort(e.target.value as "newest" | "oldest" | "name")}
                    className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400 shadow-sm appearance-none cursor-pointer min-w-[160px]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </div>
              </div>

              {/* Plan-access notice for admins — only when no plan is active */}
              {!isSuperAdmin && allowedApps.length === 0 && (
                <div className="mb-4 px-4 py-2.5 rounded-lg border flex items-start gap-2 text-xs sm:text-sm"
                  style={{ background: "#fff8f0", borderColor: "rgba(232,147,44,0.25)", color: "#92400e" }}>
                  <Package className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#E8932C" }} />
                  <span>No active plan — purchase a plan to enable product access for your users.</span>
                </div>
              )}

              {/* Bulk-select action bar — only in archived view (super admin) */}
              {userArchivedView && isSuperAdmin && (() => {
                const visibleIds = ownerGroupsPage.flatMap(g => g.users.map(u => u.id));
                const visibleCount = visibleIds.length;
                const selectedVisibleCount = visibleIds.filter(id => selectedArchivedIds.has(id)).length;
                const allVisibleSelected = visibleCount > 0 && selectedVisibleCount === visibleCount;
                const toggleAllVisible = () => {
                  setSelectedArchivedIds(prev => {
                    const next = new Set(prev);
                    if (allVisibleSelected) {
                      visibleIds.forEach(id => next.delete(id));
                    } else {
                      visibleIds.forEach(id => next.add(id));
                    }
                    return next;
                  });
                };
                return (
                  <div className="mb-3 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={el => { if (el) el.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected; }}
                          onChange={toggleAllVisible}
                          disabled={visibleCount === 0}
                          className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                        />
                        <span className="text-sm font-medium text-[#1C2A3A]">
                          {selectedArchivedIds.size > 0
                            ? `${selectedArchivedIds.size} selected`
                            : "Select"}
                        </span>
                      </label>
                      {selectedArchivedIds.size > 0 && (
                        <button
                          onClick={() => setSelectedArchivedIds(new Set())}
                          className="text-xs text-gray-500 hover:text-[#1C2A3A] underline-offset-2 hover:underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmBulkDeleteOpen(true)}
                        disabled={selectedArchivedIds.size === 0 || bulkDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: "#dc2626" }}
                        title="Permanently delete selected archived users"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Selected
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Owners + their Users — grouped list */}
              <div className="space-y-4">
                {loading ? (
                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-6 py-16 text-center text-gray-400 text-sm">
                    Loading users…
                  </div>
                ) : ownerGroupsPage.length === 0 ? (
                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-6 py-16 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm font-medium">
                      {userArchivedView ? "No archived users" : "No users found"}
                    </p>
                    {!userArchivedView && search.trim() === "" && (
                      <p className="text-gray-400 text-xs mt-1">No owners or users to display.</p>
                    )}
                  </div>
                ) : (
                  ownerGroupsPage.map((group, gIdx) => {
                    const a = group.admin;
                    const isUnassigned = a === null;
                    // True when the owner has at least one active or trialing subscription.
                    // Super admins bypass this check and always see the Access button.
                    const groupHasActivePlan = a != null && (a.subscriptions ?? []).some(
                      s => ["active", "trialing"].includes((s.status || "").toLowerCase())
                    );
                    const ownerInitials = isUnassigned
                      ? "?"
                      : (a!.name || "A").split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "A";
                    return (
                      <div key={isUnassigned ? `unassigned-${gIdx}` : a!.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        {/* Owner / admin header — line 1: data, line 2: data + actions */}
                        {isUnassigned ? (
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">?</div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#1C2A3A]">Unassigned Users</p>
                              <p className="text-[11px] text-gray-500">Users with no associated owner ({group.users.length})</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gradient-to-r from-orange-50 to-orange-50/30 border-b-2 border-orange-200">
                            {/* Line 1: identity & data */}
                            <div className="px-4 py-3 flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-sm font-bold flex-shrink-0">
                                {ownerInitials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base font-bold text-[#1C2A3A]">{a!.name || "—"}</span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-orange-300 text-[10px] font-semibold text-orange-700 uppercase tracking-wide">
                                    <Shield className="w-3 h-3" /> Owner
                                  </span>
                                  <span className="text-[11px] text-gray-500 font-medium">
                                    {group.users.length} user{group.users.length === 1 ? "" : "s"}
                                  </span>
                                </div>
                                {/* Line 2: data continuation */}
                                <div className="mt-1 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-xs text-gray-600">
                                  <span className="inline-flex items-center gap-1 truncate max-w-[260px]" title={a!.email ?? undefined}>
                                    <Mail className="w-3 h-3 text-gray-400" /> {a!.email ?? "—"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-gray-500" title={a!.username ?? undefined}>
                                    @{a!.username}
                                  </span>
                                  {a!.phone && (
                                    <span className="inline-flex items-center gap-1 text-gray-500">
                                      <Phone className="w-3 h-3 text-gray-400" /> {a!.phone}
                                    </span>
                                  )}
                                  {a!.location && (
                                    <span className="inline-flex items-center gap-1 text-gray-500">
                                      <MapPin className="w-3 h-3 text-gray-400" /> {a!.location}
                                    </span>
                                  )}
                                  {a!.company_name && (
                                    <span className="inline-flex items-center gap-1 text-gray-500 truncate max-w-[200px]" title={a!.company_name ?? undefined}>
                                      <Building2 className="w-3 h-3 text-gray-400" /> {a!.company_name}
                                    </span>
                                  )}
                                  <span className="text-gray-400">Joined {fmtDate(a!.created_at)}</span>
                                </div>
                                {/* Line 3: purchased plan badges */}
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                    <CreditCard className="w-3 h-3" /> Plans
                                  </span>
                                  {(a!.subscriptions ?? []).length === 0 && (a!.granted_apps ?? []).length === 0 ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[11px] font-medium text-gray-500">
                                      No active plan
                                    </span>
                                  ) : (
                                    (a!.subscriptions ?? []).map((s, i) => {
                                      const status = (s.status || "").toLowerCase();
                                      const palette =
                                        status === "active"   ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                                        status === "trialing" ? "bg-blue-50 border-blue-300 text-blue-700" :
                                        status === "past_due" ? "bg-amber-50 border-amber-300 text-amber-700" :
                                        status === "pending"  ? "bg-gray-50 border-gray-300 text-gray-600" :
                                        status === "canceled" || status === "cancelled"
                                                              ? "bg-gray-100 border-gray-300 text-gray-500 line-through" :
                                                                "bg-gray-100 border-gray-300 text-gray-600";
                                      const renews = s.current_period_end
                                        ? `${s.cancel_at_period_end ? "Ends" : "Renews"} ${fmtDate(s.current_period_end)}`
                                        : "";
                                      const price = s.amount_cents != null
                                        ? `${(s.amount_cents / 100).toLocaleString(undefined, { style: "currency", currency: (s.currency || "usd").toUpperCase() })}${s.billing_period ? `/${s.billing_period}` : ""}`
                                        : "";
                                      const tip = [s.display_name, status, price, renews].filter(Boolean).join(" • ");
                                      return (
                                        <span
                                          key={`${s.plan_key}-${i}`}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${palette}`}
                                          title={tip}
                                        >
                                          {s.display_name}
                                          <span className="opacity-70 font-normal">· {status}</span>
                                        </span>
                                      );
                                    })
                                  )}
                                  {/* Super-admin free app grants — shown alongside paid plans */}
                                  {(a!.granted_apps ?? []).map((appKey) => (
                                    <span
                                      key={`grant-${appKey}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-300 bg-violet-50 text-[11px] font-semibold text-violet-700"
                                      title={`${APP_LABELS[appKey] ?? appKey} • granted free by super admin`}
                                    >
                                      {APP_LABELS[appKey] ?? appKey}
                                      <span className="opacity-70 font-normal">· free</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {/* Actions inline on right — owner management (super admin only) */}
                              {isSuperAdmin && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {userArchivedView ? (
                                  <>
                                    <button
                                      onClick={() => handleRestoreAdmin(a!.id)}
                                      disabled={!!adminBusy[a!.id]}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 border border-emerald-300 bg-white text-xs font-medium transition-all disabled:opacity-40"
                                      title="Restore"
                                    >
                                      <ArchiveRestore className="w-3.5 h-3.5" />
                                      {adminBusy[a!.id] === "restore" ? "Restoring…" : "Restore"}
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({ kind: "permanent", admin: a! })}
                                      disabled={!!adminBusy[a!.id]}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                                      style={{ background: "#dc2626" }}
                                      title="Delete forever"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {adminBusy[a!.id] === "permanent" ? "Deleting…" : "Delete"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => openResetPasswordModal(a!)}
                                      disabled={!!resettingPwd[a!.id]}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-orange-700 hover:bg-orange-100 border border-orange-300 bg-white text-xs font-medium transition-all disabled:opacity-40"
                                      title="Reset password"
                                    >
                                      <KeyRound className={`w-3.5 h-3.5 ${resettingPwd[a!.id] ? "animate-pulse" : ""}`} /> Reset
                                    </button>
                                    <button
                                      onClick={() => openEditAdmin(a!)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 border border-blue-300 bg-white text-xs font-medium transition-all"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button
                                      onClick={() => setFreeAppsAdmin(a!)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 border border-emerald-300 bg-white text-xs font-medium transition-all"
                                      title="Grant apps for free"
                                    >
                                      <Gift className="w-3.5 h-3.5" /> Free Apps
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({ kind: "soft", admin: a! })}
                                      disabled={!!adminBusy[a!.id]}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-700 hover:bg-red-50 border border-red-300 bg-white text-xs font-medium transition-all disabled:opacity-40"
                                      title="Archive"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Archive
                                    </button>
                                  </>
                                )}
                              </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Users belonging to this owner */}
                        {group.users.length === 0 ? (
                          <div className="px-6 py-5 text-center text-xs text-gray-400 italic">
                            No users under this owner yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {group.users.map((u, uIdx) => (
                              <div key={u.id} className="px-4 py-2.5 hover:bg-orange-50/30 transition-colors flex items-start gap-3">
                                {userArchivedView && isSuperAdmin && (
                                  <input
                                    type="checkbox"
                                    checked={selectedArchivedIds.has(u.id)}
                                    onChange={() => {
                                      setSelectedArchivedIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(u.id)) next.delete(u.id);
                                        else next.add(u.id);
                                        return next;
                                      });
                                    }}
                                    className="mt-1.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 flex-shrink-0"
                                    aria-label={`Select ${u.name ?? u.email ?? "user"}`}
                                  />
                                )}
                                <span className="text-[11px] text-gray-400 tabular-nums w-6 pt-1 flex-shrink-0 text-right">{uIdx + 1}</span>
                                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 text-[11px] font-semibold flex-shrink-0 mt-0.5">
                                  {initialsOf(u.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  {/* Line 1: name + role + key data */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-[#1C2A3A] truncate max-w-[180px]" title={u.name}>{u.name || "—"}</span>
                                    <RoleBadge role={u.role} />
                                    <span className="text-xs text-gray-500 truncate max-w-[200px]" title={u.email}>{u.email}</span>
                                    <span className="text-xs text-gray-400 hidden lg:inline truncate max-w-[140px]" title={u.username}>@{u.username}</span>
                                  </div>
                                  {/* Line 2: secondary data */}
                                  <div className="mt-0.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-gray-500">
                                    {u.phone && (
                                      <span className="inline-flex items-center gap-1">
                                        <Phone className="w-2.5 h-2.5 text-gray-400" /> {u.phone}
                                      </span>
                                    )}
                                    {u.job_title && (
                                      <span className="text-gray-500">{u.job_title}</span>
                                    )}
                                    {u.location && (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5 text-gray-400" /> {u.location}
                                      </span>
                                    )}
                                    <span className="text-gray-400">Joined {fmtDate(u.created_at)}</span>
                                    {u.apps && u.apps.length > 0 && (
                                      <span className="inline-flex items-center gap-1 text-orange-600">
                                        <Package className="w-2.5 h-2.5" /> {u.apps.length} app{u.apps.length === 1 ? "" : "s"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Actions inline on right */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {userArchivedView ? (
                                    <>
                                      <button
                                        onClick={() => handleRestoreUser(u)}
                                        disabled={!!userBusy[u.id]}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 border border-emerald-300 bg-white text-[11px] font-medium transition-all disabled:opacity-40"
                                        title="Restore"
                                      >
                                        <ArchiveRestore className="w-3 h-3" /> Restore
                                      </button>
                                      {isSuperAdmin && (
                                        <button
                                          onClick={() => setConfirmPermDeleteUser(u)}
                                          disabled={!!userBusy[u.id]}
                                          className="flex items-center gap-1 px-2 py-1 rounded-md text-red-700 hover:bg-red-50 border border-red-300 bg-white text-[11px] font-medium transition-all disabled:opacity-40"
                                          title="Permanently delete this user"
                                          aria-label="Permanently delete user"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          {userBusy[u.id] === "permanent" ? "Deleting…" : "Permanently Delete"}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {(isSuperAdmin || groupHasActivePlan) && (
                                        <button
                                          onClick={() => openAccessModal(u)}
                                          className="flex items-center gap-1 px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 border border-emerald-300 bg-white text-[11px] font-medium transition-all"
                                          title="Manage product access"
                                        >
                                          <Package className="w-3 h-3" /> Access
                                          {u.apps && u.apps.length > 0 && (
                                            <span className="ml-0.5 px-1.5 py-px rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold tabular-nums">
                                              {u.apps.length}
                                            </span>
                                          )}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => openResetUserPasswordModal(u)}
                                        disabled={!!resettingPwd[u.id]}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-orange-700 hover:bg-orange-50 border border-orange-300 bg-white text-[11px] font-medium transition-all disabled:opacity-40"
                                        title="Reset password"
                                      >
                                        <Key className="w-3 h-3" /> Reset
                                      </button>
                                      <button
                                        onClick={() => openEditUser(u)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-blue-700 hover:bg-blue-50 border border-blue-300 bg-white text-[11px] font-medium transition-all"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-3 h-3" /> Edit
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteUser(u)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-red-700 hover:bg-red-50 border border-red-300 bg-white text-[11px] font-medium transition-all"
                                        title="Archive"
                                      >
                                        <Trash2 className="w-3 h-3" /> Archive
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>


              {/* Footer: count + pagination (over owner groups) */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    {ownerGroups.length === 0
                      ? "0 owners"
                      : `Owners ${ownersPageStart + 1}–${ownersPageEnd} of ${ownerGroups.length} · ${usersForTable.length} ${userArchivedView ? "archived " : ""}user${usersForTable.length === 1 ? "" : "s"}`}
                  </span>
                  <button
                    onClick={fetchUsers}
                    className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                {ownersTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      disabled={ownersPageSafe === 1}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-gray-600 hover:text-[#1C2A3A] hover:bg-gray-100 border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Prev
                    </button>
                    {Array.from({ length: ownersTotalPages }, (_, k) => k + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setUserPage(p)}
                        className={`min-w-[28px] px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          p === ownersPageSafe
                            ? "text-white shadow-sm"
                            : "text-gray-600 hover:text-[#1C2A3A] hover:bg-gray-100 border border-gray-200"
                        }`}
                        style={p === ownersPageSafe ? { background: "#E8932C" } : undefined}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setUserPage(p => Math.min(ownersTotalPages, p + 1))}
                      disabled={ownersPageSafe === ownersTotalPages}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-gray-600 hover:text-[#1C2A3A] hover:bg-gray-100 border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Delete confirmation modal */}
              {confirmDeleteUser && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDeleteUser(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#1C2A3A]">Archive user?</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          <strong>{confirmDeleteUser.name}</strong> will lose access immediately. You can restore them later from the Archive view.
                        </p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50/70 rounded-b-2xl">
                      <button
                        onClick={() => setConfirmDeleteUser(null)}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200/60 text-sm font-medium transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteUser}
                        disabled={userBusy[confirmDeleteUser.id] === "delete"}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {userBusy[confirmDeleteUser.id] === "delete" ? "Archiving…" : "Archive User"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk permanent-delete confirmation modal */}
              {confirmBulkDeleteOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                  onClick={() => !bulkDeleting && setConfirmBulkDeleteOpen(false)}
                >
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#1C2A3A]">
                          Delete {selectedArchivedIds.size} {selectedArchivedIds.size === 1 ? "user" : "users"} permanently?
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          This will <strong>permanently delete</strong> the selected archived
                          {selectedArchivedIds.size === 1 ? " user" : " users"} and all of their access records. This cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50/70 rounded-b-2xl">
                      <button
                        onClick={() => setConfirmBulkDeleteOpen(false)}
                        disabled={bulkDeleting}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200/60 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkPermanentDelete}
                        disabled={bulkDeleting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {bulkDeleting ? "Deleting…" : `Delete ${selectedArchivedIds.size} permanently`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Permanent-delete confirmation modal */}
              {confirmPermDeleteUser && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmPermDeleteUser(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#1C2A3A]">Delete user permanently?</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          This will <strong>permanently delete</strong>{" "}
                          <strong>{confirmPermDeleteUser.name}</strong> ({confirmPermDeleteUser.email ?? "no email"}) and all of their access records. This cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50/70 rounded-b-2xl">
                      <button
                        onClick={() => setConfirmPermDeleteUser(null)}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200/60 text-sm font-medium transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePermanentDeleteUser}
                        disabled={userBusy[confirmPermDeleteUser.id] === "permanent"}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {userBusy[confirmPermDeleteUser.id] === "permanent" ? "Deleting…" : "Delete permanently"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Products ── */}
          {tab === "products" && (
            <div>
              {/* Product EDIT view */}
              {editingProduct ? (() => {
                // Resolve the logo to display in the header preview. Prefer the
                // currently-typed override, fall back to any DB-saved logo_url,
                // and finally to the bundled asset for legacy product keys.
                const isNewProduct = editingProduct.id === 0;
                const draftLogo = String(productDraft.logo_url ?? editingProduct.logo_url ?? "");
                const headerLogoSrc = draftLogo || PRODUCT_LOGOS[editingProduct.product_key] || "";
                const draftActive = (productDraft.is_active ?? editingProduct.is_active) !== false;
                const draftComingSoon = !!(productDraft.coming_soon ?? editingProduct.coming_soon);
                const draftMaintenance = !!(productDraft.under_maintenance ?? editingProduct.under_maintenance);
                return (
                <div>
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-8">
                    <button
                      onClick={() => { setEditingProduct(null); setProductDraft({}); }}
                      className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Products
                    </button>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Product identity header */}
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-4"
                      style={{ background: "#f7f8fb" }}>
                      <div className="w-16 h-16 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm overflow-hidden">
                        {headerLogoSrc ? (
                          <img
                            src={headerLogoSrc}
                            alt={editingProduct.display_name}
                            className="h-10 w-auto object-contain"
                          />
                        ) : (
                          <Package className="w-7 h-7 text-gray-300" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-[#1C2A3A] text-xl font-bold">
                          {isNewProduct ? "New Product" : editingProduct.display_name}
                        </h2>
                        <p className="text-gray-400 text-sm">
                          {isNewProduct ? "Create a new product visible on the public site" : editingProduct.category}
                        </p>
                      </div>
                    </div>

                    {/* Edit form */}
                    <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                      {isNewProduct && (
                        <div className="md:col-span-2">
                          <Field
                            label="Product Key (lowercase, no spaces — used in URLs)"
                            value={String(productDraft.product_key ?? editingProduct.product_key)}
                            onChange={v => setProductDraft(d => ({ ...d, product_key: v.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                          />
                        </div>
                      )}
                      <Field label="Display Name" value={String(productDraft.display_name ?? editingProduct.display_name)}
                        onChange={v => setProductDraft(d => ({ ...d, display_name: v }))} />
                      <Field label="Category" value={String(productDraft.category ?? editingProduct.category)}
                        onChange={v => setProductDraft(d => ({ ...d, category: v }))} />
                      <Field label="Monthly Price (USD)"
                        value={String(((productDraft.monthly_price  ?? editingProduct.monthly_price)  / 100).toFixed(2))}
                        onChange={v => setProductDraft(d => ({ ...d, monthly_price:  Math.round(parseFloat(v || "0") * 100) || 0 }))} />
                      <Field label="Discount Price (USD)"
                        value={String(((productDraft.discount_price ?? editingProduct.discount_price) / 100).toFixed(2))}
                        onChange={v => setProductDraft(d => ({ ...d, discount_price: Math.round(parseFloat(v || "0") * 100) || 0 }))} />
                      <Field label="Redirect URL" value={String(productDraft.redirect_url ?? editingProduct.redirect_url)}
                        onChange={v => setProductDraft(d => ({ ...d, redirect_url: v }))} />
                      <Field label="Sort Order" value={String(productDraft.sort_order ?? editingProduct.sort_order ?? 0)}
                        onChange={v => setProductDraft(d => ({ ...d, sort_order: Number(v) || 0 }))} />

                      {/* Logo: either upload from device OR paste a URL. */}
                      <div className="md:col-span-2">
                        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-1.5">
                          Logo (upload from device or paste URL)
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {draftLogo
                              ? <img src={draftLogo} alt="" className="h-10 w-auto object-contain" />
                              : <Package className="w-6 h-6 text-gray-300" />}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async e => {
                              const f = e.target.files?.[0];
                              e.target.value = ""; // allow re-selecting the same file
                              if (!f) return;
                              const url = await uploadLogoFile(f);
                              if (url) setProductDraft(d => ({ ...d, logo_url: url }));
                            }}
                            disabled={uploadingLogo}
                            className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-orange-50 file:text-orange-600 file:text-xs file:font-medium hover:file:bg-orange-100"
                          />
                          {uploadingLogo && <span className="text-xs text-gray-400">Uploading…</span>}
                        </div>
                        <input
                          type="text"
                          value={draftLogo}
                          onChange={e => setProductDraft(d => ({ ...d, logo_url: e.target.value }))}
                          placeholder="…or paste an image URL (https://…)"
                          className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium">Description</label>
                          <textarea
                            value={String(productDraft.description ?? editingProduct.description)}
                            onChange={e => setProductDraft(d => ({ ...d, description: e.target.value }))}
                            rows={5}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[#1C2A3A] text-sm resize-none focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                          />
                          <p className="text-gray-400 text-[11px] leading-relaxed">
                            The first line is shown as the product description. Each additional line appears as a separate feature bullet on the product card.
                          </p>
                        </div>
                      </div>

                      {/* Status toggles */}
                      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-all">
                          <div>
                            <div className="text-[#1C2A3A] text-sm font-medium">Enabled (visible on website)</div>
                            <div className="text-gray-400 text-xs mt-0.5">Disable to hide this product from public pages</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={draftActive}
                            onChange={e => setProductDraft(d => ({ ...d, is_active: e.target.checked }))}
                            className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-all">
                          <div>
                            <div className="text-[#1C2A3A] text-sm font-medium">Coming Soon</div>
                            <div className="text-gray-400 text-xs mt-0.5">Hide pricing and show "Coming Soon" CTA on website</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={draftComingSoon}
                            onChange={e => setProductDraft(d => ({ ...d, coming_soon: e.target.checked }))}
                            className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-all">
                          <div>
                            <div className="text-[#1C2A3A] text-sm font-medium">Under Maintenance</div>
                            <div className="text-gray-400 text-xs mt-0.5">Temporarily block launching and show a maintenance notice</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={draftMaintenance}
                            onChange={e => setProductDraft(d => ({ ...d, under_maintenance: e.target.checked }))}
                            className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
                      <div>
                        {!isNewProduct && (
                          <button
                            onClick={() => setConfirmDeleteProduct(editingProduct)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-red-600 hover:text-white hover:bg-red-500 text-sm border border-red-200 bg-white transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Product
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setEditingProduct(null); setProductDraft({}); }}
                          className="px-5 py-2 rounded-lg text-gray-500 hover:text-gray-700 text-sm border border-gray-200 bg-white hover:bg-gray-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveProduct}
                          disabled={saving[editingProduct.product_key || "__new__"]}
                          className="flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                          style={{ background: "#E8932C" }}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {saving[editingProduct.product_key || "__new__"]
                            ? "Saving…"
                            : isNewProduct ? "Create Product" : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })() : null}

              {!editingProduct && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h1 className="text-[#1C2A3A] text-2xl font-bold mb-1">Products</h1>
                      <p className="text-gray-400 text-sm">Platform products visible to users on the dashboard</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={startNewProduct}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-all"
                        style={{ background: "#E8932C" }}
                      >
                        <Plus className="w-4 h-4" /> Add Product
                      </button>
                      <button onClick={fetchProducts} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {products.map(p => {
                      const rowLogo = p.logo_url || PRODUCT_LOGOS[p.product_key] || "";
                      return (
                      <div key={p.product_key}
                        className="bg-white border border-gray-100 rounded-xl shadow-sm hover:border-orange-200 hover:shadow-md transition-all overflow-hidden">
                        <div className="flex items-center gap-5 px-6 py-5">
                          {/* Logo */}
                          <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {rowLogo
                              ? <img src={rowLogo} alt={p.display_name} className="h-9 w-auto object-contain max-w-[52px]" />
                              : <Package className="w-6 h-6 text-gray-300" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <h3 className="text-[#1C2A3A] font-semibold text-base">{p.display_name}</h3>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                {p.category}
                              </span>
                              {!p.is_active && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                  Disabled
                                </span>
                              )}
                              {p.coming_soon && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                  Coming Soon
                                </span>
                              )}
                              {p.under_maintenance && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                                  Under Maintenance
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed">{p.description}</p>
                            {p.redirect_url && (
                              <a
                                href={p.redirect_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-gray-400 hover:text-orange-500 text-xs mt-1.5 transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                                {p.redirect_url}
                              </a>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {p.coming_soon ? (
                              <button
                                onClick={() => toggleProductFlag(p, "coming_soon", false)}
                                disabled={saving[p.product_key]}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-all disabled:opacity-50"
                                title="Make this product available now (turn off Coming Soon)"
                              >
                                <Check className="w-3.5 h-3.5" /> Make Available
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleProductFlag(p, "coming_soon", true)}
                                disabled={saving[p.product_key]}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-50"
                                title="Mark this product as Coming Soon"
                              >
                                <Clock className="w-3.5 h-3.5" /> Coming Soon
                              </button>
                            )}
                            {p.under_maintenance ? (
                              <button
                                onClick={() => toggleProductFlag(p, "under_maintenance", false)}
                                disabled={saving[p.product_key]}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-all disabled:opacity-50"
                                title="End maintenance and re-enable launching"
                              >
                                <Check className="w-3.5 h-3.5" /> End Maintenance
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleProductFlag(p, "under_maintenance", true)}
                                disabled={saving[p.product_key]}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                                title="Put this product under maintenance"
                              >
                                <Wrench className="w-3.5 h-3.5" /> Maintenance
                              </button>
                            )}
                            {p.redirect_url && (
                              <a
                                href={p.redirect_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => setEditingPageProduct(p)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                              title="Edit the product page content without leaving the dashboard"
                            >
                              <FileText className="w-3.5 h-3.5" /> Edit Page
                            </button>
                            <button
                              onClick={() => { setEditingProduct(p); setProductDraft({}); }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    {!products.length && (
                      <div className="text-center py-16 text-gray-400 text-sm">Loading products…</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Plans ── */}
          {tab === "plans" && (
            <div>
              {editingPlan ? (() => {
                const isNewPlan = editingPlan.id === 0;
                const draftActive = (planDraft.is_active ?? editingPlan.is_active) !== false;
                const draftComingSoon = !!(planDraft.coming_soon ?? editingPlan.coming_soon);
                return (
                <div>
                  <div className="flex items-center gap-4 mb-8">
                    <button
                      onClick={() => { setEditingPlan(null); setPlanDraft({}); }}
                      className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Plans
                    </button>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100" style={{ background: "#f7f8fb" }}>
                      <h2 className="text-[#1C2A3A] text-xl font-bold">
                        {isNewPlan ? "New Plan" : editingPlan.display_name}
                      </h2>
                      <p className="text-gray-400 text-sm">
                        {isNewPlan
                          ? "Create a new plan visible on the Pricing page"
                          : `${editingPlan.category} · ${priceFmt(editingPlan.monthly_price)}/mo`}
                      </p>
                    </div>

                    <div className="px-8 py-6 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {isNewPlan && (
                          <div className="md:col-span-2">
                            <Field
                              label="Plan Key (lowercase, no spaces — used by checkout)"
                              value={String(planDraft.plan_key ?? editingPlan.plan_key)}
                              onChange={v => setPlanDraft(d => ({ ...d, plan_key: v.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                            />
                          </div>
                        )}
                        <Field label="Display Name" value={String(planDraft.display_name ?? editingPlan.display_name)}
                          onChange={v => setPlanDraft(d => ({ ...d, display_name: v }))} />
                        <Field label="Category" value={String(planDraft.category ?? editingPlan.category)}
                          onChange={v => setPlanDraft(d => ({ ...d, category: v }))} />
                        {(() => {
                          // Compute the live Full Suite total preview using the same formula as runtime:
                          // sum of monthly_price for all active, non-coming-soon, non-fullsuite plans,
                          // substituting draft values for the plan currently being edited.
                          const fullSuitePreviewCents = plans
                            .filter(p => p.plan_key !== "fullsuite")
                            .reduce((sum, p) => {
                              if (p.plan_key === editingPlan.plan_key) {
                                const active = planDraft.is_active !== undefined ? planDraft.is_active : editingPlan.is_active;
                                const comingSoon = planDraft.coming_soon !== undefined ? planDraft.coming_soon : editingPlan.coming_soon;
                                if (!active || comingSoon) return sum;
                                return sum + (planDraft.monthly_price !== undefined ? planDraft.monthly_price : editingPlan.monthly_price);
                              }
                              if (!p.is_active || p.coming_soon) return sum;
                              return sum + p.monthly_price;
                            }, 0);

                          return editingPlan.plan_key === "fullsuite" ? (
                            <div className="md:col-span-2 space-y-3">
                              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm">
                                <span className="font-semibold">Price fields are not editable for Full Suite.</span>{" "}
                                The price displayed publicly is automatically calculated as the sum of all active (non-coming-soon) plan prices. Any value stored here is ignored on the public site.
                              </div>
                              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                                <div>
                                  <div className="text-blue-800 text-xs font-semibold uppercase tracking-widest mb-0.5">Current Full Suite Total (live preview)</div>
                                  <div className="text-blue-500 text-xs">Sum of all active, non-coming-soon plan prices</div>
                                </div>
                                <div className="text-blue-900 text-xl font-bold">{priceFmt(fullSuitePreviewCents)}<span className="text-blue-500 text-sm font-normal">/mo</span></div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Field label="Monthly Price (USD)" type="number" step="0.01" min="0"
                                value={((planDraft.monthly_price ?? editingPlan.monthly_price) / 100).toFixed(2)}
                                onChange={v => setPlanDraft(d => ({ ...d, monthly_price: Math.round(parseFloat(v || "0") * 100) || 0 }))} />
                              <Field label="Discount Price (USD)" type="number" step="0.01" min="0"
                                value={((planDraft.annual_price ?? editingPlan.annual_price) / 100).toFixed(2)}
                                onChange={v => setPlanDraft(d => ({ ...d, annual_price: Math.round(parseFloat(v || "0") * 100) || 0 }))} />
                              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                                <div>
                                  <div className="text-blue-800 text-xs font-semibold uppercase tracking-widest mb-0.5">Full Suite Total (live preview)</div>
                                  <div className="text-blue-500 text-xs">If you save this price, the public Full Suite price becomes</div>
                                </div>
                                <div className="text-blue-900 text-xl font-bold">{priceFmt(fullSuitePreviewCents)}<span className="text-blue-500 text-sm font-normal">/mo</span></div>
                              </div>
                            </>
                          );
                        })()}
                        <Field label="Sort Order" value={String(planDraft.sort_order ?? editingPlan.sort_order ?? 0)}
                          onChange={v => setPlanDraft(d => ({ ...d, sort_order: Number(v) || 0 }))} />
                        <div className="md:col-span-2">
                          <Field label="Description" value={String(planDraft.description ?? editingPlan.description)}
                            onChange={v => setPlanDraft(d => ({ ...d, description: v }))} multiline />
                        </div>
                      </div>
                      <div>
                        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-medium block mb-1.5">
                          Features (one per line — appears on website immediately after Save)
                        </label>
                        <textarea
                          value={(Array.isArray(planDraft.features ?? editingPlan.features)
                            ? (planDraft.features ?? editingPlan.features) as string[]
                            : []).join("\n")}
                          onChange={e => setPlanDraft(d => ({ ...d, features: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) }))}
                          rows={6}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[#1C2A3A] text-sm resize-none focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        />
                      </div>

                      {/* Status toggles */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-all">
                          <div>
                            <div className="text-[#1C2A3A] text-sm font-medium">Enabled (visible on Pricing page)</div>
                            <div className="text-gray-400 text-xs mt-0.5">Disable to hide this plan from public pricing</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={draftActive}
                            onChange={e => setPlanDraft(d => ({ ...d, is_active: e.target.checked }))}
                            className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-all">
                          <div>
                            <div className="text-[#1C2A3A] text-sm font-medium">Coming Soon</div>
                            <div className="text-gray-400 text-xs mt-0.5">Hide pricing and show "Coming Soon" CTA on Pricing page</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={draftComingSoon}
                            onChange={e => setPlanDraft(d => ({ ...d, coming_soon: e.target.checked }))}
                            className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
                      <div>
                        {!isNewPlan && (
                          <button
                            onClick={() => setConfirmDeletePlan(editingPlan)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-red-600 hover:text-white hover:bg-red-500 text-sm border border-red-200 bg-white transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Plan
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setEditingPlan(null); setPlanDraft({}); }}
                          className="px-5 py-2 rounded-lg text-gray-500 text-sm border border-gray-200 bg-white hover:bg-gray-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={savePlan}
                          disabled={saving[editingPlan.plan_key || "__new__"]}
                          className="flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                          style={{ background: "#E8932C" }}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {saving[editingPlan.plan_key || "__new__"]
                            ? "Saving…"
                            : isNewPlan ? "Create Plan" : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })() : (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h1 className="text-[#1C2A3A] text-2xl font-bold mb-1">Plans</h1>
                      <p className="text-gray-400 text-sm">Manage pricing plans and feature listings</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={startNewPlan}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-all"
                        style={{ background: "#E8932C" }}
                      >
                        <Plus className="w-4 h-4" /> Add Plan
                      </button>
                      <button onClick={fetchPlans} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {plans.map(p => {
                      const featuresArr: string[] = Array.isArray(p.features) ? p.features : [];
                      return (
                        <div key={p.plan_key}
                          className="bg-white border border-gray-100 rounded-xl shadow-sm hover:border-orange-200 hover:shadow-md transition-all overflow-hidden">
                          <div className="px-6 py-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-[#1C2A3A] font-semibold text-base">{p.display_name}</h3>
                                  {!p.is_active && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                      Disabled
                                    </span>
                                  )}
                                  {p.coming_soon && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                      Coming Soon
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-400 text-xs mt-0.5">
                                  {p.category} · <span className="font-medium text-orange-500">{priceFmt(p.monthly_price)}/mo</span>
                                </p>
                              </div>
                              <button
                                onClick={() => { setEditingPlan(p); setPlanDraft({}); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all flex-shrink-0"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                              </button>
                            </div>
                            {p.description && (
                              <p className="text-gray-500 text-sm mb-3">{p.description}</p>
                            )}
                            {featuresArr.length > 0 && (
                              <div className="flex flex-wrap gap-x-5 gap-y-1">
                                {featuresArr.map((f, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-gray-400 text-xs">
                                    <Check className="w-3 h-3 text-orange-400" />{f}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!plans.length && <p className="text-gray-400 text-sm text-center py-10">Loading plans…</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Payments (Super Admin: Payment Transactions History) ── */}
          {tab === "payments" && isSuperAdmin && (() => {
            // Local helpers, scoped to the Payments tab so they don't pollute
            // the rest of the AdminPanel namespace.
            const fmtMoney = (cents: number | null | undefined, ccy: string | null | undefined) => {
              if (cents == null) return "—";
              const c = (Number(cents) / 100);
              const code = (ccy ?? "usd").toUpperCase();
              try {
                return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(c);
              } catch {
                return `$${c.toFixed(2)} ${code}`;
              }
            };
            const fmtDate = (iso: string | null | undefined) => {
              if (!iso) return "—";
              const d = new Date(iso);
              if (isNaN(d.getTime())) return "—";
              return d.toLocaleString("en-US", {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              });
            };
            const fmtDateOnly = (iso: string | null | undefined) => {
              if (!iso) return "—";
              const d = new Date(iso);
              if (isNaN(d.getTime())) return "—";
              return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            };
            const STATUS_STYLES: Record<string, string> = {
              active:     "bg-green-50 text-green-700 border-green-200",
              trialing:   "bg-blue-50 text-blue-700 border-blue-200",
              past_due:   "bg-amber-50 text-amber-700 border-amber-200",
              canceled:   "bg-gray-100 text-gray-600 border-gray-200",
              cancelled:  "bg-gray-100 text-gray-600 border-gray-200",
              incomplete: "bg-orange-50 text-orange-700 border-orange-200",
              unpaid:     "bg-red-50 text-red-700 border-red-200",
              pending:    "bg-gray-50 text-gray-500 border-gray-200",
            };
            const StatusBadge = ({ status }: { status: string }) => {
              const cls = STATUS_STYLES[status?.toLowerCase()] ?? "bg-gray-50 text-gray-600 border-gray-200";
              const label = (status ?? "—").replace(/_/g, " ");
              return (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${cls}`}>
                  {label}
                </span>
              );
            };
            const MethodCell = ({ brand, last4 }: { brand: string | null; last4: string | null }) => {
              const display = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Card";
              return (
                <span className="inline-flex items-center gap-2 text-gray-700 text-sm">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  <span>{display}</span>
                  {last4 && <span className="text-gray-400">•••• {last4}</span>}
                </span>
              );
            };
            const SortHeader = ({ col, label }: { col: "date" | "amount" | "status"; label: string }) => {
              const active = txnSortBy === col;
              return (
                <button
                  onClick={() => {
                    if (active) {
                      setTxnSortDir(d => (d === "asc" ? "desc" : "asc"));
                    } else {
                      setTxnSortBy(col);
                      setTxnSortDir("desc");
                    }
                  }}
                  className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold transition-colors ${
                    active ? "text-orange-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {label}
                  <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-50"}`} />
                </button>
              );
            };
            const clearFilters = () => {
              setTxnSearch(""); setTxnSearchInput("");
              setTxnStatus("all");
              setTxnDateFrom(""); setTxnDateTo("");
              setTxnSortBy("date"); setTxnSortDir("desc");
            };
            const hasFilters =
              !!txnSearch || txnStatus !== "all" ||
              !!txnDateFrom || !!txnDateTo;

            const grossActive = Number(txnStats?.gross_active_cents ?? 0);
            const grossAll    = Number(txnStats?.gross_all_cents ?? 0);

            return (
              <div>
                {/* Compact toolbar: title + KPI strip + actions, all on one row when wide. */}
                <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <h1 className="text-[#1C2A3A] text-xl font-bold leading-tight">
                        {txnArchivedView ? "Archived Transactions" : "Payment Transactions"}
                      </h1>
                      <p className="text-gray-400 text-xs">
                        {txnArchivedView
                          ? "Soft-deleted — restore or delete permanently"
                          : "All admin plan purchases"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTxnArchivedView(v => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        txnArchivedView
                          ? "border-orange-300 bg-orange-50 text-orange-600"
                          : "border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50"
                      }`}
                      title={txnArchivedView ? "Showing archived transactions" : "Show archived transactions"}
                    >
                      {txnArchivedView ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      {txnArchivedView ? "Active" : "Archive"}
                    </button>
                    <button
                      onClick={fetchTxns}
                      disabled={txnLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${txnLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Compact KPI strip — 4 metrics in a single horizontal card to save vertical real-estate. */}
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm mb-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                  <div className="px-4 py-2.5">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Active Revenue</p>
                    <p className="text-[#1C2A3A] text-base font-bold leading-tight">{fmtMoney(grossActive, "usd")}</p>
                    <p className="text-gray-400 text-[11px]">{txnStats?.count_active ?? 0} active subs</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Gross (filtered)</p>
                    <p className="text-[#1C2A3A] text-base font-bold leading-tight">{fmtMoney(grossAll, "usd")}</p>
                    <p className="text-gray-400 text-[11px]">{txnStats?.count_total ?? 0} transactions</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Past Due</p>
                    <p className="text-[#1C2A3A] text-base font-bold leading-tight">{txnStats?.count_past_due ?? 0}</p>
                    <p className="text-gray-400 text-[11px]">need attention</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Canceled</p>
                    <p className="text-[#1C2A3A] text-base font-bold leading-tight">{txnStats?.count_canceled ?? 0}</p>
                    <p className="text-gray-400 text-[11px]">total canceled</p>
                  </div>
                </div>

                {/* Single-row inline filters — labels live as placeholders to save height. */}
                <div className="bg-white border border-gray-100 rounded-xl p-2.5 mb-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <form
                      onSubmit={e => { e.preventDefault(); setTxnSearch(txnSearchInput.trim()); }}
                      className="flex-1 min-w-[200px]"
                    >
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={txnSearchInput}
                          onChange={e => setTxnSearchInput(e.target.value)}
                          onBlur={() => setTxnSearch(txnSearchInput.trim())}
                          placeholder="Search admin name, email, txn id, plan…"
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </div>
                    </form>

                    <select
                      value={txnStatus}
                      onChange={e => setTxnStatus(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 min-w-[120px]"
                      title="Filter by status"
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="trialing">Trialing</option>
                      <option value="past_due">Past due</option>
                      <option value="canceled">Canceled</option>
                      <option value="incomplete">Incomplete</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="pending">Pending</option>
                    </select>

                    <div className="relative">
                      <input
                        type="date"
                        value={txnDateFrom}
                        onChange={e => setTxnDateFrom(e.target.value)}
                        className="pl-2.5 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        title="From date"
                      />
                    </div>
                    <span className="text-gray-300 text-xs">→</span>
                    <div className="relative">
                      <input
                        type="date"
                        value={txnDateTo}
                        onChange={e => setTxnDateTo(e.target.value)}
                        className="pl-2.5 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        title="To date"
                      />
                    </div>

                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-orange-600 underline-offset-2 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Table — compact (px-3 py-2) so the full page fits without scrolling. */}
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-gray-400">Transaction</th>
                          <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-gray-400">Admin</th>
                          <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-gray-400">Plan</th>
                          <th className="px-3 py-2"><SortHeader col="amount" label="Amount" /></th>
                          <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-gray-400">Method</th>
                          <th className="px-3 py-2"><SortHeader col="date"   label="Date"   /></th>
                          <th className="px-3 py-2"><SortHeader col="status" label="Status" /></th>
                          <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase tracking-wider text-gray-400"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {txnLoading && txns.length === 0 && (
                          <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400 text-xs">Loading transactions…</td></tr>
                        )}
                        {!txnLoading && txnError && (
                          <tr><td colSpan={8} className="px-3 py-10 text-center text-red-500 text-xs">
                            Failed to load: {txnError}
                          </td></tr>
                        )}
                        {!txnLoading && !txnError && txns.length === 0 && (
                          <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-400 text-xs">
                            <Receipt className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                            No transactions match your filters.
                          </td></tr>
                        )}
                        {txns.map(t => (
                          <tr key={t.id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="px-3 py-2">
                              <div className="font-mono text-[11px] text-gray-700 truncate max-w-[160px]" title={t.transaction_id ?? ""}>
                                {t.transaction_id ?? "—"}
                              </div>
                              <div className="text-[10px] text-gray-400">id #{t.id}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-[#1C2A3A] font-medium leading-tight">{t.admin_name}</div>
                              <div className="text-gray-400 text-[11px] truncate max-w-[180px]" title={t.admin_email ?? ""}>{t.admin_email ?? "—"}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-gray-700 leading-tight">{t.plan_name ?? t.plan_key ?? "—"}</div>
                              {t.billing_period && (
                                <div className="text-gray-400 text-[11px] capitalize">{t.billing_period}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-[#1C2A3A] font-semibold whitespace-nowrap">
                              {fmtMoney(t.amount_cents, t.currency)}
                            </td>
                            <td className="px-3 py-2">
                              <MethodCell brand={t.payment_method_brand} last4={t.payment_method_last4} />
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                            <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {/* Icon-only action buttons keep every row to a single line. */}
                              <div className="inline-flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => setTxnDetail(t)}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all"
                                  title="View details"
                                  aria-label="View details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {txnArchivedView ? (
                                  <>
                                    <button
                                      onClick={() => restoreTxn(t.id)}
                                      disabled={txnActionBusyId === t.id}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all disabled:opacity-50"
                                      title="Restore transaction"
                                      aria-label="Restore transaction"
                                    >
                                      <ArchiveRestore className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setTxnConfirmDelete(t)}
                                      disabled={txnActionBusyId === t.id}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50 transition-all disabled:opacity-50"
                                      title="Delete permanently"
                                      aria-label="Delete permanently"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => archiveTxn(t.id)}
                                    disabled={txnActionBusyId === t.id}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                                    title="Delete transaction (moves to Archive)"
                                    aria-label="Delete transaction"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination — compact bar */}
                  {txnTotal > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/50 text-[11px] text-gray-500">
                      <div>
                        Showing <span className="font-semibold text-gray-700">{(txnPage - 1) * txnPageSize + 1}</span>–
                        <span className="font-semibold text-gray-700">{Math.min(txnPage * txnPageSize, txnTotal)}</span> of{" "}
                        <span className="font-semibold text-gray-700">{txnTotal}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                          disabled={txnPage <= 1 || txnLoading}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-all"
                        >
                          <ChevronLeft className="w-3 h-3" /> Prev
                        </button>
                        <span className="px-1.5">Page {txnPage} / {txnTotalPages}</span>
                        <button
                          onClick={() => setTxnPage(p => Math.min(txnTotalPages, p + 1))}
                          disabled={txnPage >= txnTotalPages || txnLoading}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-all"
                        >
                          Next <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail modal */}
                {txnDetail && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => setTxnDetail(null)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
                        <div>
                          <h3 className="text-[#1C2A3A] text-lg font-bold">Transaction Details</h3>
                          <p className="text-gray-400 text-xs mt-0.5 font-mono">{txnDetail.transaction_id ?? `id #${txnDetail.id}`}</p>
                        </div>
                        <button
                          onClick={() => setTxnDetail(null)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          aria-label="Dismiss transaction details"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="px-6 py-5 space-y-5">
                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Admin</p>
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <div className="text-[#1C2A3A] font-semibold">{txnDetail.admin_name}</div>
                            <div className="text-gray-500 text-sm">{txnDetail.admin_email ?? "—"}</div>
                            <div className="text-gray-400 text-xs mt-1 capitalize">{txnDetail.admin_role.replace(/_/g, " ")}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Plan</p>
                            <p className="text-[#1C2A3A] font-medium">{txnDetail.plan_name ?? txnDetail.plan_key ?? "—"}</p>
                            {txnDetail.billing_period && (
                              <p className="text-gray-400 text-xs capitalize mt-0.5">{txnDetail.billing_period} billing</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Amount</p>
                            <p className="text-[#1C2A3A] font-bold text-lg">{fmtMoney(txnDetail.amount_cents, txnDetail.currency)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Status</p>
                            <StatusBadge status={txnDetail.status} />
                            {txnDetail.cancel_at_period_end && (
                              <p className="text-amber-600 text-xs mt-1">Cancels at period end</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Payment Method</p>
                            <MethodCell brand={txnDetail.payment_method_brand} last4={txnDetail.payment_method_last4} />
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Created</p>
                            <p className="text-gray-700 text-sm">{fmtDate(txnDetail.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Current period</p>
                            <p className="text-gray-700 text-sm">
                              {fmtDateOnly(txnDetail.current_period_start)} → {fmtDateOnly(txnDetail.current_period_end)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Stripe references</p>
                          <div className="bg-gray-50 rounded-lg px-4 py-3 font-mono text-xs space-y-1.5 text-gray-600 break-all">
                            <div><span className="text-gray-400">session: </span>{txnDetail.transaction_id ?? "—"}</div>
                            <div><span className="text-gray-400">subscription: </span>{txnDetail.subscription_id ?? "—"}</div>
                            <div><span className="text-gray-400">customer: </span>{txnDetail.customer_id ?? "—"}</div>
                          </div>
                        </div>

                        {txnDetail.receipt_url && (
                          <a
                            href={txnDetail.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all"
                          >
                            <FileText className="w-4 h-4" /> View Stripe receipt <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                        <button
                          onClick={() => setTxnDetail(null)}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-white transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Permanent-delete confirmation dialog (Archive view only). */}
                {txnConfirmDelete && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => txnActionBusyId == null && setTxnConfirmDelete(null)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-[#1C2A3A] text-lg font-bold">Delete this transaction permanently?</h3>
                          <p className="text-gray-500 text-sm mt-1">
                            This will remove the record from the database. It cannot be undone.
                          </p>
                        </div>
                      </div>
                      <div className="px-6 py-4 text-sm space-y-1.5 bg-gray-50/50">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Transaction</span>
                          <span className="font-mono text-xs text-gray-700 truncate">{txnConfirmDelete.transaction_id ?? `id #${txnConfirmDelete.id}`}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Admin</span>
                          <span className="text-gray-700">{txnConfirmDelete.admin_name}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Plan</span>
                          <span className="text-gray-700">{txnConfirmDelete.plan_name ?? txnConfirmDelete.plan_key ?? "—"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Amount</span>
                          <span className="text-gray-700 font-semibold">{fmtMoney(txnConfirmDelete.amount_cents, txnConfirmDelete.currency)}</span>
                        </div>
                      </div>
                      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                        <button
                          onClick={() => setTxnConfirmDelete(null)}
                          disabled={txnActionBusyId === txnConfirmDelete.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => permanentlyDeleteTxn(txnConfirmDelete.id)}
                          disabled={txnActionBusyId === txnConfirmDelete.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {txnActionBusyId === txnConfirmDelete.id ? "Deleting…" : "Delete permanently"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Account Settings ── */}
          {tab === "settings" && (
            <AccountSettings />
          )}
              {/* Reset password modal */}
              {resetPwdTarget && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                  onClick={() => !resettingPwd[resetPwdTarget.id] && closeResetPasswordModal()}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!resetPwdSuccess ? (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <h2 className="text-[#1C2A3A] font-semibold flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-blue-500" />
                            Reset password
                          </h2>
                          <button
                            onClick={closeResetPasswordModal}
                            disabled={resettingPwd[resetPwdTarget.id]}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40"
                            aria-label="Close"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                          Set a new password for <span className="font-medium text-[#1C2A3A]">{resetPwdTarget.name || resetPwdTarget.email}</span>.
                          We'll email the new password to {resetPwdTarget.email ?? "the user"} when you click Update.
                        </p>

                        <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
                        <div className="relative mb-2">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type={resetPwdShow ? "text" : "password"}
                            name="ssiq-admin-new-password"
                            autoComplete="new-password"
                            autoFocus
                            value={resetPwdValue}
                            onChange={(e) => { setResetPwdValue(e.target.value); setResetPwdError(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !resettingPwd[resetPwdTarget.id]) submitResetAdminPassword();
                            }}
                            placeholder="At least 6 characters"
                            className="w-full pl-9 pr-10 py-2 rounded-lg border border-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                            disabled={resettingPwd[resetPwdTarget.id]}
                          />
                          <button
                            type="button"
                            onClick={() => setResetPwdShow(s => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700"
                            tabIndex={-1}
                          >
                            {resetPwdShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {resetPwdError && (
                          <p className="text-xs text-red-500 mb-2">{resetPwdError}</p>
                        )}

                        <div className="flex items-center justify-end gap-2 mt-4">
                          <button
                            type="button"
                            onClick={closeResetPasswordModal}
                            disabled={resettingPwd[resetPwdTarget.id]}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-gray-200 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitResetAdminPassword}
                            disabled={resettingPwd[resetPwdTarget.id]}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                            style={{ background: "#E8932C" }}
                          >
                            {resettingPwd[resetPwdTarget.id] ? "Updating…" : "Update"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                          <Check className="w-7 h-7 text-green-600" strokeWidth={3} />
                        </div>
                        <h2 className="text-[#1C2A3A] font-semibold text-base mb-1">Password updated</h2>
                        <p className="text-xs text-gray-500 mb-4">
                          {resetPwdSuccess.emailSent && resetPwdSuccess.email
                            ? <>A confirmation has been emailed to <span className="font-medium text-[#1C2A3A]">{resetPwdSuccess.email}</span> with the new password.</>
                            : "The password was updated, but the confirmation email could not be sent. Please share the new password manually."}
                        </p>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left mb-4">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-500">User</span>
                            <span className="font-medium text-[#1C2A3A]">{resetPwdTarget.name || resetPwdTarget.email}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-500">Email</span>
                            <span className="font-medium text-[#1C2A3A]">{resetPwdSuccess.email ?? "—"}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Updated at</span>
                            <span className="font-medium text-[#1C2A3A]">
                              {new Date(resetPwdSuccess.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={closeResetPasswordModal}
                          className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90"
                          style={{ background: "#E8932C" }}
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit admin modal */}
              {editingUser && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                  onClick={() => !savingUser && setEditingUser(null)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-[#1C2A3A] font-semibold flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-orange-400" />
                        Edit User
                      </h2>
                      <button
                        onClick={() => setEditingUser(null)}
                        disabled={savingUser}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editUserDraft.name}
                          onChange={e => setEditUserDraft(s => ({ ...s, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="Jane Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Email <span className="text-gray-400 normal-case tracking-normal">(read-only)</span>
                        </label>
                        <input
                          type="email"
                          value={editUserDraft.email}
                          disabled
                          readOnly
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                          placeholder="jane@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={editUserDraft.phone}
                          onChange={e => setEditUserDraft(s => ({ ...s, phone: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Username
                        </label>
                        <input
                          type="text"
                          value={editUserDraft.username}
                          onChange={e => setEditUserDraft(s => ({ ...s, username: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="jdoe"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Job Title
                        </label>
                        <input
                          type="text"
                          value={editUserDraft.job_title}
                          onChange={e => setEditUserDraft(s => ({ ...s, job_title: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="Production Manager"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Role <span className="text-gray-400 normal-case tracking-normal">(read-only)</span>
                        </label>
                        <input
                          type="text"
                          value={editingUser.role === "admin" ? "Admin" : editingUser.role === "super_admin" ? "Super Admin" : "User"}
                          disabled
                          readOnly
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Location
                        </label>
                        <input
                          type="text"
                          value={editUserDraft.location}
                          onChange={e => setEditUserDraft(s => ({ ...s, location: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="City, State"
                        />
                      </div>
                    </div>

                    {/* Companies associated with this user */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Companies
                        <span className="text-[10px] text-gray-400 normal-case tracking-normal">
                          ({editingUser.companies?.length ?? 0})
                        </span>
                      </p>
                      {editingUser.companies && editingUser.companies.length > 0 ? (
                        <div className="space-y-1.5">
                          {editingUser.companies.map(c => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="text-sm text-[#1C2A3A] font-medium truncate" title={c.name}>
                                  {c.name}
                                </span>
                                {c.is_primary && (
                                  <span className="text-[10px] uppercase tracking-wider text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium shrink-0">
                                    Primary
                                  </span>
                                )}
                                {c.plan_name && (
                                  <span className="text-[10px] text-gray-500 truncate hidden sm:inline" title={c.plan_name}>
                                    · {c.plan_name}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded shrink-0 ${
                                  c.relationship === "admin"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {c.relationship === "admin" ? "Admin" : "Member"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic px-3 py-2">
                          No company associations.
                        </p>
                      )}
                    </div>

                    {editUserError && (
                      <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                        {editUserError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 mt-6">
                      <button
                        onClick={() => setEditingUser(null)}
                        disabled={savingUser}
                        className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateUser}
                        disabled={savingUser}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #E8932C 0%, #d97e1f 100%)" }}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingUser ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingAdmin && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                  onClick={() => !savingAdmin && setEditingAdmin(null)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-[#1C2A3A] font-semibold flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-orange-400" />
                        Edit Admin
                      </h2>
                      <button
                        onClick={() => setEditingAdmin(null)}
                        disabled={savingAdmin}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editAdminDraft.name}
                          onChange={e => setEditAdminDraft(s => ({ ...s, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="Jane Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Email <span className="text-gray-400 normal-case tracking-normal">(read-only)</span>
                        </label>
                        <input
                          type="email"
                          value={editAdminDraft.email}
                          disabled
                          readOnly
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                          placeholder="jane@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={editAdminDraft.phone}
                          onChange={e => setEditAdminDraft(s => ({ ...s, phone: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Username
                        </label>
                        <input
                          type="text"
                          value={editAdminDraft.username}
                          onChange={e => setEditAdminDraft(s => ({ ...s, username: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="jdoe"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Role <span className="text-gray-400 normal-case tracking-normal">(read-only)</span>
                        </label>
                        <input
                          type="text"
                          value="Admin"
                          disabled
                          readOnly
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">
                          Location
                        </label>
                        <input
                          type="text"
                          value={editAdminDraft.location}
                          onChange={e => setEditAdminDraft(s => ({ ...s, location: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[#1C2A3A] text-sm focus:outline-none focus:border-orange-400"
                          placeholder="City, State"
                        />
                      </div>
                    </div>

                    {editAdminError && (
                      <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                        {editAdminError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 mt-6">
                      <button
                        onClick={() => setEditingAdmin(null)}
                        disabled={savingAdmin}
                        className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateAdmin}
                        disabled={savingAdmin}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #E8932C 0%, #d97e1f 100%)" }}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingAdmin ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm dialog */}
              {confirmAction && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                  onClick={() => !adminBusy[confirmAction.admin.id] && setConfirmAction(null)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                        confirmAction.kind === "permanent" ? "bg-red-100" : "bg-amber-100"
                      }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                          confirmAction.kind === "permanent" ? "text-red-600" : "text-amber-600"
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[#1C2A3A] text-lg font-semibold mb-1">
                          {confirmAction.kind === "permanent" ? "Delete admin permanently?" : "Move admin to archive?"}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {confirmAction.kind === "permanent" ? (
                            <>
                              This will <strong>permanently delete</strong>{" "}
                              <span className="text-[#1C2A3A] font-medium">{confirmAction.admin.name}</span>{" "}
                              ({confirmAction.admin.email ?? "no email"}) and all related access records. This action cannot be undone.
                            </>
                          ) : (
                            <>
                              <span className="text-[#1C2A3A] font-medium">{confirmAction.admin.name}</span>{" "}
                              ({confirmAction.admin.email ?? "no email"}) will be moved to the archive. They will lose access immediately, but you can restore or permanently delete them later.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => setConfirmAction(null)}
                        disabled={!!adminBusy[confirmAction.admin.id]}
                        className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (confirmAction.kind === "permanent") handlePermanentDeleteAdmin(confirmAction.admin.id);
                          else handleSoftDeleteAdmin(confirmAction.admin.id);
                        }}
                        disabled={!!adminBusy[confirmAction.admin.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: confirmAction.kind === "permanent" ? "#dc2626" : "#E8932C" }}
                      >
                        {confirmAction.kind === "permanent" ? <Trash2 className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        {adminBusy[confirmAction.admin.id]
                          ? (confirmAction.kind === "permanent" ? "Deleting…" : "Archiving…")
                          : (confirmAction.kind === "permanent" ? "Delete forever" : "Move to archive")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Create admin modal (super admin only) */}
              {showCreateAdmin && isSuperAdmin && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                  onClick={() => !creatingAdmin && setShowCreateAdmin(false)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-[#1C2A3A] font-semibold flex items-center gap-2">
                        <Shield className="w-4 h-4 text-orange-500" />
                        Add a new admin
                      </h2>
                      <button
                        onClick={() => setShowCreateAdmin(false)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Close"
                        disabled={creatingAdmin}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full name *</label>
                        <input
                          type="text"
                          value={newAdmin.name}
                          onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                          placeholder="Jane Doe"
                          disabled={creatingAdmin}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email *</label>
                        <input
                          type="email"
                          value={newAdmin.email}
                          onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                          placeholder="jane@company.com"
                          disabled={creatingAdmin}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone</label>
                        <input
                          type="text"
                          value={newAdmin.phone}
                          onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                          placeholder="+1 555 123 4567"
                          disabled={creatingAdmin}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Location</label>
                        <input
                          type="text"
                          value={newAdmin.location}
                          onChange={(e) => setNewAdmin({ ...newAdmin, location: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                          placeholder="City, Country"
                          disabled={creatingAdmin}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company Name</label>
                        <input
                          type="text"
                          value={newAdmin.companyName}
                          onChange={(e) => setNewAdmin({ ...newAdmin, companyName: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                          placeholder="Acme Corp"
                          disabled={creatingAdmin}
                        />
                      </div>
                    </div>
                    {createAdminError && (
                      <p className="mt-3 text-sm text-red-600">{createAdminError}</p>
                    )}
                    <p className="mt-4 text-xs text-gray-500">
                      A temporary password will be generated and emailed to the new admin.
                    </p>
                    <div className="mt-5 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setShowCreateAdmin(false)}
                        disabled={creatingAdmin}
                        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateAdmin}
                        disabled={creatingAdmin}
                        className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #E8932C 0%, #d97e1f 100%)" }}
                      >
                        {creatingAdmin ? "Creating…" : "Create admin"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Manage Product Access modal ───────────────────────────────── */}
              {accessUser && (() => {
                // Apps flagged "coming soon" (or not yet active) can't be launched,
                // so we never offer them when granting access.
                const comingSoonKeys = new Set(
                  products.filter(p => p.coming_soon || !p.is_active).map(p => p.product_key),
                );
                const visibleApps = APP_KEYS.filter(k => !comingSoonKeys.has(k));
                const grantable = (isSuperAdmin ? [...APP_KEYS] : allowedApps)
                  .filter(k => !comingSoonKeys.has(k));
                const hasNoPlan = !isSuperAdmin && grantable.length === 0;
                const selectedCount = [...accessDraft].filter(k => grantable.includes(k)).length;
                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                    onClick={() => !accessSaving && setAccessUser(null)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[#1C2A3A] font-semibold text-base">Manage Product Access</p>
                          <p className="text-xs text-gray-500 truncate">
                            {accessUser.name} · {accessUser.email}
                          </p>
                        </div>
                        <button
                          onClick={() => !accessSaving && setAccessUser(null)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Body */}
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            Select the products this user can access. Granted products will appear as clickable buttons on their dashboard.
                          </p>
                        </div>

                        {hasNoPlan ? (
                          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>Your company has no active plan. Purchase a plan first to grant product access to users.</span>
                          </div>
                        ) : (
                          <>
                            {/* Quick actions */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                <span className="font-semibold text-emerald-700">{selectedCount}</span> of {grantable.length} selected
                              </span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setAccessDraft(new Set(grantable))}
                                  disabled={accessSaving}
                                  className="px-2 py-1 rounded text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 disabled:opacity-40"
                                >
                                  Select all
                                </button>
                                <button
                                  onClick={() => setAccessDraft(new Set())}
                                  disabled={accessSaving}
                                  className="px-2 py-1 rounded text-[11px] font-medium text-gray-600 hover:bg-gray-50 border border-gray-200 disabled:opacity-40"
                                >
                                  Clear all
                                </button>
                              </div>
                            </div>

                            {/* Product checkbox rows */}
                            <div className="space-y-2">
                              {visibleApps.map(appKey => {
                                const inPlan  = grantable.includes(appKey);
                                const checked = accessDraft.has(appKey) && inPlan;
                                return (
                                  <label
                                    key={appKey}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                                      !inPlan
                                        ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                                        : checked
                                          ? "bg-emerald-50 border-emerald-300 cursor-pointer"
                                          : "bg-white border-gray-200 hover:border-emerald-200 cursor-pointer"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!inPlan || accessSaving}
                                      onChange={() => inPlan && toggleAccessDraft(appKey)}
                                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                                    />
                                    <img
                                      src={PRODUCT_LOGOS[appKey]}
                                      alt={APP_LABELS[appKey]}
                                      className={`h-7 object-contain ${!inPlan ? "grayscale" : ""}`}
                                    />
                                    <span className="flex-1 text-sm font-medium text-[#1C2A3A]">
                                      {APP_LABELS[appKey]}
                                    </span>
                                    {!inPlan && (
                                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                                        Not in plan
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {accessError && (
                          <p className="text-xs text-red-600">{accessError}</p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setAccessUser(null)}
                          disabled={accessSaving}
                          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveAccess}
                          disabled={accessSaving || hasNoPlan}
                          className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                          style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                        >
                          <Save className="w-4 h-4" />
                          {accessSaving ? "Saving…" : "Save access"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Super-admin: grant apps for free to an admin ──────────────── */}
              {freeAppsAdmin && isSuperAdmin && (() => {
                const granted = new Set(freeAppsAdmin.granted_apps ?? []);
                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                    onClick={() => setFreeAppsAdmin(null)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <Gift className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[#1C2A3A] font-semibold text-base">Grant Apps for Free</p>
                          <p className="text-xs text-gray-500 truncate">
                            {freeAppsAdmin.name} · {freeAppsAdmin.email}
                          </p>
                        </div>
                        <button
                          onClick={() => setFreeAppsAdmin(null)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Body */}
                      <div className="px-5 py-4 space-y-3">
                        <p className="text-xs text-gray-500">
                          Granting an app here gives this admin full access at no cost — independent of their subscription. It also expands the apps they can pass on to their own users.
                        </p>

                        <div className="space-y-2">
                          {APP_KEYS.map(appKey => {
                            const isGranted = granted.has(appKey);
                            const busy = !!freeAppBusy[`${freeAppsAdmin.id}:${appKey}`];
                            return (
                              <label
                                key={appKey}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                  isGranted
                                    ? "bg-emerald-50 border-emerald-300"
                                    : "bg-white border-gray-200 hover:border-emerald-200"
                                } ${busy ? "opacity-60" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  disabled={busy}
                                  onChange={() => toggleAdminFreeApp(freeAppsAdmin.id, appKey, isGranted)}
                                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                                />
                                <img
                                  src={PRODUCT_LOGOS[appKey]}
                                  alt={APP_LABELS[appKey]}
                                  className="h-7 object-contain"
                                />
                                <span className="flex-1 text-sm font-medium text-[#1C2A3A]">
                                  {APP_LABELS[appKey]}
                                </span>
                                {busy ? (
                                  <span className="text-[11px] font-medium text-gray-400">Saving…</span>
                                ) : isGranted ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Granted free</span>
                                ) : null}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setFreeAppsAdmin(null)}
                          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

          {/* Delete product confirmation modal */}
          {confirmDeleteProduct && (
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !deletingProduct && setConfirmDeleteProduct(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#1C2A3A]">Delete product?</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      <strong>{confirmDeleteProduct.display_name || confirmDeleteProduct.product_key}</strong> will be permanently removed, including its page content and configuration. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50/70 rounded-b-2xl">
                  <button
                    onClick={() => setConfirmDeleteProduct(null)}
                    disabled={deletingProduct}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200/60 text-sm font-medium transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteProduct(confirmDeleteProduct.product_key)}
                    disabled={deletingProduct}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingProduct ? "Deleting…" : "Delete Product"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete plan confirmation modal */}
          {confirmDeletePlan && (
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !deletingPlan && setConfirmDeletePlan(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#1C2A3A]">Delete plan?</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      <strong>{confirmDeletePlan.display_name || confirmDeletePlan.plan_key}</strong> will be permanently removed. Companies currently on this plan may lose product access. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50/70 rounded-b-2xl">
                  <button
                    onClick={() => setConfirmDeletePlan(null)}
                    disabled={deletingPlan}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200/60 text-sm font-medium transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deletePlan(confirmDeletePlan.plan_key)}
                    disabled={deletingPlan}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingPlan ? "Deleting…" : "Delete Plan"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
