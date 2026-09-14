/**
 * SYS-002 — three structural families, one palette.
 *
 * Desk: live tools (brief, updates, fact-check, search, Ask).
 * Dossier: investigations, October 7, articles, story, heroes.
 * Institution: methodology, corrections, We Are, Support, account.
 *
 * Family changes density and measure — never colour. It set scan strength
 * too until the ambient scan backdrop was retired on 2026-09-14.
 *
 * `"war-update"` sat in `DESK` until then. `/war-update` has been a permanent
 * redirect since 2026-09-05, so no page has ever rendered with that route id
 * and the entry answered a question nobody asks.
 */
export type RouteFamily = "desk" | "dossier" | "institution";

const DESK = new Set([
  "geopolitical-brief",
  "updates",
  "fact-check",
  "search",
  "ask",
]);

const INSTITUTION = new Set([
  "methodology",
  "corrections",
  "we-are",
  "support-us",
  "account",
]);

export function routeFamily(routeId: string): RouteFamily {
  if (DESK.has(routeId)) return "desk";
  if (INSTITUTION.has(routeId)) return "institution";
  return "dossier";
}
