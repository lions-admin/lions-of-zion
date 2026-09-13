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
