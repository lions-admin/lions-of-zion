/** localStorage / sessionStorage keys for measurement ids. */
export const VISITOR_KEY = "lz_measure_visitor";
export const VISIT_KEY = "lz_measure_visit";

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function readOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const id = newId("v");
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return newId("v");
  }
}

export function readOrCreateVisitId(): string {
  try {
    const existing = sessionStorage.getItem(VISIT_KEY);
    if (existing && existing.length >= 8) return existing;
    const id = newId("s");
    sessionStorage.setItem(VISIT_KEY, id);
    return id;
  } catch {
    return newId("s");
  }
}

/**
 * The ids of the collector that is actually running, or null.
 *
 * Set by `startCollector` and cleared by its `stop`, so it is null whenever
 * the collector declined to start — DNT/GPC, the admin surface — and holds the
 * in-memory ids when storage is blocked. Read-only for everyone else: nothing
 * outside the collector may mint a measurement id.
 */
let active: { visitId: string; visitorId: string } | null = null;

export function setActiveIds(ids: { visitId: string; visitorId: string } | null): void {
  active = ids;
}

export function activeIds(): { visitId: string; visitorId: string } | null {
  return active;
}
