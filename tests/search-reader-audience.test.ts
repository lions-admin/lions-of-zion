import { describe, expect, it, vi } from "vitest";
import type { SearchHit } from "@/server/contracts/search";

/* `searchService` builds its repo from the handle it is given, so the seam for
   a stub is the repo module rather than the argument. */
const stub = vi.hoisted(() => ({ hits: [] as unknown[] }));
vi.mock("@/server/modules/search/repo", () => ({
  searchRepo: () => ({
    hasSemanticArm: async () => false,
    search: async (_q: string, _e: number[] | null, limit: number) => stub.hits.slice(0, limit),
  }),
}));

const { searchService } = await import("@/server/modules/search/service");

/**
 * T-9 — a reader is never offered a result they cannot open.
 *
 * Measured on Production 2026-09-08: searching for a string that matches
 * nothing returned **ten** hits and the live region announced "10 results for
 * …". They were the historic site-reference publications — `site-war-update`,
 * `site-we-are`, `site-our-heroes` and friends — which share the publications
 * table, carry no `briefingRunId`, and therefore resolve to `href: null`
 * because `destinationFor` refuses to manufacture a dead link. Their
 * rank-floor scores (~0.016) meant they sat at the bottom of every result set
 * and, when nothing else matched, *were* the result set.
 *
 * Three things followed: the client's no-results state was unreachable, the
 * first row was auto-highlighted while being `aria-disabled`, and one of the
 * rows was `war_update` — a section retired on 2026-09-05 whose route is a
 * permanent redirect. They contaminated genuine result sets too.
 *
 * The plan file's §1b correction 6 recorded that these rows "do not render"
 * and closed VA-58.1 on it. They render. The component was innocent: it
 * renders what the API hands it, which is why this test sits at the service
 * and not in the panel.
 *
 * Stubbed rather than run against PGlite on purpose — the rule under test is
 * the service's filter, not retrieval, and a stub states the exact hit shapes
 * that caused the incident.
 */

const hit = (publicId: string, href: string | null): SearchHit => ({
  documentId: crypto.randomUUID(),
  entityType: "brief",
  entityId: crypto.randomUUID(),
  publicId,
  href,
  title: publicId,
  snippet: null,
  score: href ? 0.9 : 0.016,
}) as SearchHit;

/** The ten dead rows, as Production actually returned them. */
const DEAD = [
  "site-war-update", "site-we-are", "site-our-heroes", "site-support-us", "site-october-7",
  "site-methodology", "site-corrections", "site-geopolitical-brief", "site-fake-resistance",
  "site-israels-story",
].map((id) => hit(id, null));

function serviceReturning(hits: SearchHit[]) {
  stub.hits = hits;
  return searchService({}, {});
}

describe("T-9 — the reader audience never receives an unaddressable hit", () => {
  it("returns nothing for a query that only matches dead rows, so the empty state can render", async () => {
    const service = serviceReturning(DEAD);
    const result = await service.search({ q: "zzzqqxwvnothingmatchesthis", limit: 25 }, "reader");
    expect(result.hits).toEqual([]);
  });

  it("keeps the dead rows out of a result set that does have real matches", async () => {
    const real = [hit("lebanon-strike-abc12", "/articles/lebanon-strike-abc12")];
    const service = serviceReturning([...real, ...DEAD]);
    const result = await service.search({ q: "lebanon", limit: 25 }, "reader");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]!.publicId).toBe("lebanon-strike-abc12");
    expect(result.hits.every((h) => h.href !== null)).toBe(true);
  });

  it("does not return a short page merely because dead rows filled the window", async () => {
    /* The reason the service over-fetches: with the dead rows interleaved, a
       naive filter-after-limit would hand back 2 results for a limit of 5. */
    const many = Array.from({ length: 5 }, (_, i) => hit(`real-${i}`, `/articles/real-${i}`));
    const interleaved = [many[0]!, ...DEAD.slice(0, 4), ...many.slice(1)];
    const service = serviceReturning(interleaved);
    const result = await service.search({ q: "q", limit: 5 }, "reader");
    expect(result.hits).toHaveLength(5);
    expect(result.hits.map((h) => h.publicId)).toEqual(["real-0", "real-1", "real-2", "real-3", "real-4"]);
  });

  it("leaves the internal audience untouched, because chat cites by documentId not href", async () => {
    /* Ask the Desk may legitimately ground an answer in a record with no
       public page. Only a reader being offered a row they cannot click is the
       defect, so the filter is scoped by audience rather than applied
       globally. */
    const service = serviceReturning(DEAD);
    const result = await service.search({ q: "anything", limit: 25 }, "internal");
    expect(result.hits).toHaveLength(10);
  });

  it("defaults to the internal audience, so an unmarked caller loses nothing", async () => {
    const service = serviceReturning(DEAD);
    const result = await service.search({ q: "anything", limit: 25 });
    expect(result.hits).toHaveLength(10);
  });
});
