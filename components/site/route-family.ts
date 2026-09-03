/**
 * SYS-002 — three structural families, one palette.
 *
 * Desk: live tools (brief, updates, fact-check, search, Ask).
 * Dossier: investigations, October 7, articles, story, heroes.
 * Institution: methodology, corrections, We Are, Support, account.
 *
 * Family changes density, scan strength, and measure — never colour.
 */
export type RouteFamily = "desk" | "dossier" | "institution";

const DESK = new Set([
  "geopolitical-brief",
  "updates",
  "fact-check",
  "search",
  "ask",
  "war-update",
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
