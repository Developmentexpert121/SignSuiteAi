import { useEffect, useState, useSyncExternalStore } from "react";

export type PlanKey = "installiq" | "signsalesiq" | "signtakeoffiq" | "fullsuite";

// Custom DOM event fired whenever the locally-cached active-plans list
// changes (purchase succeeds, server reconcile runs, plan cleared on
// logout, etc.). Any UI that displays "Active Plan" state should
// subscribe to this event so the dashboard updates immediately after a
// purchase — no page refresh needed.
export const ACTIVE_PLANS_CHANGED_EVENT = "ssiq:active-plans-changed";

function broadcastActivePlansChanged(): void {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(ACTIVE_PLANS_CHANGED_EVENT)); } catch { /* ignore */ }
}
export type BillingPeriod = "monthly" | "annual";

export interface ActivePlan {
  planKey: PlanKey;
  billingPeriod: BillingPeriod;
  startDate: number;
}

const ACTIVE_PLANS_KEY      = "ssiq_active_plans";   // new: array of ActivePlan
const LEGACY_ACTIVE_PLAN_KEY = "ssiq_active_plan";   // legacy single-plan key
const PENDING_ACTIVATION_KEY = "ssiq_pending_activation";

export const PLAN_TIERS: Record<PlanKey, number> = {
  installiq:     1,
  signsalesiq:   2,
  signtakeoffiq: 3,
  fullsuite:     4,
};

export const PLAN_LABELS: Record<PlanKey, string> = {
  installiq:     "InstalliQ.ai",
  signsalesiq:   "SignSalesIQ",
  signtakeoffiq: "SignTakeoffIQ",
  fullsuite:     "Full Suite",
};

// Map a plan key to the set of product app keys it grants access to.
const PLAN_TO_PRODUCTS: Record<PlanKey, string[]> = {
  installiq:     ["installiq"],
  signsalesiq:   ["signsalesiq"],
  signtakeoffiq: ["signtakeoffiq"],
  fullsuite:     ["installiq", "signsalesiq", "signtakeoffiq"],
};

export const PLAN_DURATIONS_MS: Record<BillingPeriod, number> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  annual:  365 * 24 * 60 * 60 * 1000,
};

// ─── Multi-plan storage ───────────────────────────────────────────────────────

export function getActivePlans(): ActivePlan[] {
  // Prefer the new multi-plan array
  const rawArr = localStorage.getItem(ACTIVE_PLANS_KEY);
  if (rawArr) {
    try {
      const parsed = JSON.parse(rawArr);
      if (Array.isArray(parsed)) return parsed as ActivePlan[];
    } catch {
      /* ignore */
    }
  }
  // Fall back to (and migrate from) the legacy single-plan key
  const rawSingle = localStorage.getItem(LEGACY_ACTIVE_PLAN_KEY);
  if (rawSingle) {
    try {
      const single = JSON.parse(rawSingle) as ActivePlan;
      if (single?.planKey) {
        const arr = [single];
        localStorage.setItem(ACTIVE_PLANS_KEY, JSON.stringify(arr));
        return arr;
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function setActivePlans(plans: ActivePlan[]): void {
  localStorage.setItem(ACTIVE_PLANS_KEY, JSON.stringify(plans));
  // Keep legacy key roughly in sync (latest plan) so any older code still works.
  if (plans.length > 0) {
    localStorage.setItem(LEGACY_ACTIVE_PLAN_KEY, JSON.stringify(plans[plans.length - 1]));
  } else {
    localStorage.removeItem(LEGACY_ACTIVE_PLAN_KEY);
  }
  // Notify any subscribed UI so the active-plan badge / dashboard banner
  // re-renders without a page refresh. Every public mutator routes
  // through setActivePlans, so this single broadcast covers all paths.
  broadcastActivePlansChanged();
}

/** Add (or refresh) a plan in the active list. Never removes existing plans. */
export function addActivePlan(plan: ActivePlan): ActivePlan[] {
  const existing = getActivePlans();
  const filtered = existing.filter(p => p.planKey !== plan.planKey);
  const next = [...filtered, plan];
  setActivePlans(next);
  return next;
}

/**
 * Replace the local active-plans cache with the canonical list of plan keys
 * the server says the user actually has. Use this when the server is the
 * source of truth (e.g. /api/admin/my-plan returns a `subscriptions` array).
 *
 * Each plan's startDate is derived from the server's current_period_end (if
 * provided) by subtracting the plan duration, so the renewal/expiry shown in
 * the UI matches the actual Stripe billing cycle for each plan independently.
 */
export function setActivePlansFromServer(
  rows: Array<{
    plan_key: string;
    current_period_end?: string | Date | null;
    billing_period?: BillingPeriod | null;
  }>,
): ActivePlan[] {
  const validKeys: PlanKey[] = ["installiq", "signsalesiq", "signtakeoffiq", "fullsuite"];
  const seen = new Set<string>();
  const next: ActivePlan[] = [];

  for (const row of rows) {
    if (!validKeys.includes(row.plan_key as PlanKey)) continue;
    if (seen.has(row.plan_key)) continue;
    seen.add(row.plan_key);

    const billingPeriod: BillingPeriod = row.billing_period ?? "monthly";
    const duration = PLAN_DURATIONS_MS[billingPeriod];
    let startDate = Date.now();
    if (row.current_period_end) {
      const end = new Date(row.current_period_end).getTime();
      if (Number.isFinite(end)) startDate = end - duration;
    }
    next.push({ planKey: row.plan_key as PlanKey, billingPeriod, startDate });
  }

  setActivePlans(next);
  return next;
}

export function clearActivePlans(): void {
  localStorage.removeItem(ACTIVE_PLANS_KEY);
  localStorage.removeItem(LEGACY_ACTIVE_PLAN_KEY);
  broadcastActivePlansChanged();
}

/**
 * React hook: returns the current active-plans list and re-renders
 * whenever it changes — whether the change happened in this tab (custom
 * event), another tab (storage event), or while the tab was hidden
 * (visibility/focus). Use this anywhere you would otherwise call
 * `useState(getActivePlans)`; it eliminates the stale-state-after-
 * -purchase bug without each component having to wire up listeners.
 */
export function useActivePlans(): ActivePlan[] {
  const [snapshot, setSnapshot] = useState<ActivePlan[]>(() => getActivePlans());

  useEffect(() => {
    const refresh = () => setSnapshot(getActivePlans());
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_PLANS_KEY || e.key === LEGACY_ACTIVE_PLAN_KEY || e.key === null) refresh();
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(ACTIVE_PLANS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    // Run once on mount in case localStorage was mutated between
    // useState's initializer and effect attachment.
    refresh();
    return () => {
      window.removeEventListener(ACTIVE_PLANS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return snapshot;
}

// Avoid the "unused import" TS warning on tree-shaken builds — the hook
// only needs useState/useEffect, but we keep useSyncExternalStore in the
// import list as a marker for the React 18 alternative implementation
// if we ever decide to switch.
void useSyncExternalStore;

/**
 * Reconcile the local active-plans list with the canonical set of product keys
 * the user has access to (returned by the server). This:
 *   • drops any local plan whose products are no longer entitled,
 *   • adds any missing plans we can infer from the entitled product list,
 *   • preserves billingPeriod / startDate metadata when possible.
 */
export function syncActivePlansFromAllowedApps(allowedApps: string[]): ActivePlan[] {
  const allowedSet = new Set(allowedApps);
  const existing = getActivePlans();

  // Keep plans whose product set is still FULLY entitled. For composite plans
  // like "fullsuite" this means every member product must still be granted;
  // otherwise the plan is no longer truly held and should drop off.
  const kept = existing.filter(p =>
    PLAN_TO_PRODUCTS[p.planKey].every(prod => allowedSet.has(prod))
  );
  const coveredProducts = new Set<string>();
  for (const p of kept) {
    for (const prod of PLAN_TO_PRODUCTS[p.planKey]) coveredProducts.add(prod);
  }

  // Never auto-collapse three individual plans into a Full Suite plan: the
  // Full Suite is only valid when the user explicitly purchased it (so it has
  // a single shared expiry). Individual plans must be tracked separately so
  // they each expire on their own billing cycle.
  const next: ActivePlan[] = [...kept];

  // Add a row for any entitled product not yet covered by an existing plan.
  for (const prod of allowedApps) {
    if (coveredProducts.has(prod)) continue;
    const planKey = (["installiq", "signsalesiq", "signtakeoffiq"] as PlanKey[]).find(
      k => PLAN_TO_PRODUCTS[k][0] === prod
    );
    if (planKey) {
      next.push({ planKey, billingPeriod: "monthly", startDate: Date.now() });
      for (const p of PLAN_TO_PRODUCTS[planKey]) coveredProducts.add(p);
    }
  }

  setActivePlans(next);
  return next;
}

// ─── Backwards-compatible single-plan helpers ────────────────────────────────
// Some older UI still expects a single ActivePlan; expose the most-recent one.

export function getActivePlan(): ActivePlan | null {
  const plans = getActivePlans();
  return plans.length > 0 ? plans[plans.length - 1] : null;
}

export function setActivePlan(plan: ActivePlan): void {
  addActivePlan(plan);
}

export function clearActivePlan(): void {
  clearActivePlans();
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export function getPlanExpiry(plan: ActivePlan): number {
  return plan.startDate + PLAN_DURATIONS_MS[plan.billingPeriod];
}

export function savePendingActivation(planKey: PlanKey, billingPeriod: BillingPeriod): void {
  sessionStorage.setItem(PENDING_ACTIVATION_KEY, JSON.stringify({ planKey, billingPeriod }));
}

export function getPendingActivation(): { planKey: PlanKey; billingPeriod: BillingPeriod } | null {
  const raw = sessionStorage.getItem(PENDING_ACTIVATION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearPendingActivation(): void {
  sessionStorage.removeItem(PENDING_ACTIVATION_KEY);
}

export type PlanAction = "choose" | "current" | "covered" | "upgrade" | "downgrade";

/**
 * Given a card on the pricing page and the user's active plans, decide what the
 * button should say.
 *   • If the user already owns this exact plan → "current".
 *   • If the user owns Full Suite and the card is an individual plan →
 *     "covered" (the product is included in their Full Suite, so the
 *     individual card should be locked/disabled — NOT marked "current",
 *     because the user did not separately purchase that plan).
 *   • If the user owns Full Suite and the card is Full Suite → "current".
 *   • Otherwise → "choose" (additive purchase, never a downgrade).
 *
 * NOTE: Owning all three individual plans is NOT the same as owning Full
 * Suite — individual plans have separate billing cycles/expiries, while
 * Full Suite has a single shared one. So the Full Suite card stays
 * available ("choose") even when the user owns the three individual plans.
 */
export function getPlanAction(
  cardKey: PlanKey,
  active: ActivePlan | ActivePlan[] | null,
): PlanAction {
  const list: ActivePlan[] = Array.isArray(active)
    ? active
    : active
      ? [active]
      : [];

  if (list.length === 0) return "choose";

  const ownedKeys = new Set(list.map(p => p.planKey));

  // Full Suite ALWAYS wins for individual product cards: even if the user
  // separately owns an individual plan (e.g. they bought InstalliQ first and
  // then upgraded to Full Suite), the individual card must be disabled and
  // labelled "Included in Full Suite" rather than "Current Plan". This matches
  // the product requirement that buying Full Suite locks the individual cards.
  if (cardKey !== "fullsuite" && ownedKeys.has("fullsuite")) return "covered";

  // Otherwise an exact match → "current" (Full Suite card when Full Suite is
  // owned, or an individual plan card when that exact plan was purchased).
  if (ownedKeys.has(cardKey)) return "current";

  return "choose";
}
