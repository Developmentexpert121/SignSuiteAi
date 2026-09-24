const PENDING_KEY = "ssiq_pending_checkout";

export type PlanKey = "installiq" | "signsalesiq" | "signtakeoffiq" | "fullsuite";

export interface PendingCheckout {
  planKey: PlanKey;
  isAnnual: boolean;
}

export function savePendingCheckout(data: PendingCheckout): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
}

export function getPendingCheckout(): PendingCheckout | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as PendingCheckout; } catch { return null; }
}

export function clearPendingCheckout(): void {
  sessionStorage.removeItem(PENDING_KEY);
}
