import { describe, expect, it, vi } from "vitest";
import type { SearchHit } from "@/server/contracts/search";

/**
 * What a reader is told about their answer, and how they get through it.
 *
 * Measured on Production 2026-09-08 and again locally 2026-09-14: `/search?q=October+7`
 * rendered 26 result labels, of which 19 were unopenable, under a line reading
 * "25 results" — a count that described the response rather than the reader's
 * situation, above a list with no way past its own bottom. Three things are
 * under test here and none of them is retrieval:
 *
 *   * the count is taken over the set the reader can actually reach;
 *   * that set is paged, and the page is a window the server agrees to rather
 *     than a slice the client assumed;
 *   * the kind filter is offered from the facets of the *unfiltered* set, so a
 *     chip never leads to an empty list and never deletes the chip that would
 *     bring the reader back.
 *
 * Stubbed at the repo, as `search-reader-audience.test.ts` is and for the same
 * reason: the rules live in the service, and a stub can state the exact row
 * shapes that caused the incident. `tests/search.test.ts` covers the SQL.
 */

const stub = vi.hoisted(() => ({ hits: [] as unknown[] }));
vi.mock("@/server/modules/search/repo", () => ({
  searchRepo: () => ({
    hasSemanticArm: async () => false,
    search: async (_q: string, _e: number[] | null, limit: number) => stub.hits.slice(0, limit),
  }),
}));

const { searchService } = await import("@/server/modules/search/service");

const hit = (
  publicId: string,
  href: string | null,
  entityType: SearchHit["entityType"] = "brief",
  summary: string | null = null,
): SearchHit =>
  ({
    documentId: crypto.randomUUID(),
    entityType,
    entityId: crypto.randomUUID(),
    publicId,
    href,
    title: publicId,
    summary,
    score: href ? 0.9 : 0.016,
  }) as SearchHit;

const article = (n: number, entityType: SearchHit["entityType"] = "brief") =>
  hit(`record-${entityType}-${n}`, `/articles/record-${entityType}-${n}`, entityType);

function serviceReturning(hits: SearchHit[]) {
  stub.hits = hits;
  return searchService({}, {});
}

describe("the count a reader is shown", () => {
  it("counts the whole answer, not the page", async () => {
    const service = serviceReturning(Array.from({ length: 34 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.hits).toHaveLength(10);
    expect(result.total).toBe(34);
  });

  it("counts only what the reader can open", async () => {
    /* The defect exactly: ten openable records among forty dead evidence rows
       announced itself as fifty. */
    const service = serviceReturning([
      ...Array.from({ length: 10 }, (_, i) => article(i)),
      ...Array.from({ length: 40 }, (_, i) => hit(`ev-${i}`, null, "evidence")),
    ]);
    const result = await service.search({ q: "October 7", limit: 10 }, "reader");
    expect(result.total).toBe(10);
    expect(result.hits.every((h) => h.href !== null)).toBe(true);
  });

  it("does not claim a total it only reached the ceiling of", async () => {
    /* Retrieval has a candidate ceiling. A ceiling printed as a count is the
       same invented number as showing the RRF score as a confidence, so it is
       reported as a floor instead and the panel says "at least". */
    const service = serviceReturning(Array.from({ length: 400 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.totalIsFloor).toBe(true);
  });

  it("states a small answer as a total, not a floor", async () => {
    const service = serviceReturning(Array.from({ length: 7 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.total).toBe(7);
    expect(result.totalIsFloor).toBe(false);
  });
});

describe("paging", () => {
  it("returns the second page, and says which window it is", async () => {
    const service = serviceReturning(Array.from({ length: 34 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10, offset: 10 }, "reader");
    expect(result.offset).toBe(10);
    expect(result.limit).toBe(10);
    expect(result.hits.map((h) => h.publicId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `record-brief-${i + 10}`),
    );
  });

  it("returns a short last page rather than padding it", async () => {
    const service = serviceReturning(Array.from({ length: 34 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10, offset: 30 }, "reader");
    expect(result.hits).toHaveLength(4);
    expect(result.total).toBe(34);
  });

  it("pages past the end without throwing, and still reports the real total", async () => {
    const service = serviceReturning(Array.from({ length: 12 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10, offset: 200 }, "reader");
    expect(result.hits).toEqual([]);
    expect(result.total).toBe(12);
  });

  it("pages the *filtered* set, so dead rows cannot make a page come back short", async () => {
    /* Interleaved, as retrieval actually returns them — RRF puts the dead rows
       at the bottom of a good result set and throughout a weak one. A naive
       `LIMIT 10 OFFSET 10` in SQL would have handed back whatever survived
       filtering inside that window. */
    const live = Array.from({ length: 25 }, (_, i) => article(i));
    const dead = Array.from({ length: 25 }, (_, i) => hit(`ev-${i}`, null, "evidence"));
    const interleaved = live.flatMap((row, i) => [row, dead[i]!]);
    const service = serviceReturning(interleaved);

    const second = await service.search({ q: "q", limit: 10, offset: 10 }, "reader");
    expect(second.hits).toHaveLength(10);
    expect(second.hits.map((h) => h.publicId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `record-brief-${i + 10}`),
    );
  });

  it("treats an absent offset as the first page, so an unchanged caller loses nothing", async () => {
    /* `offset` is deliberately undefaulted on the schema: `SearchQuery` is the
       inferred output type, and a default would make the field required in it
       and break `chat/index.ts`, which builds the object by hand. */
    const service = serviceReturning(Array.from({ length: 12 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.offset).toBe(0);
    expect(result.hits[0]!.publicId).toBe("record-brief-0");
  });
});

describe("the kind filter", () => {
  it("counts each kind over the whole reachable set", async () => {
    const service = serviceReturning([
      ...Array.from({ length: 9 }, (_, i) => article(i, "geopolitical_analysis")),
      ...Array.from({ length: 2 }, (_, i) => article(i, "brief")),
    ]);
    const result = await service.search({ q: "October 7", limit: 10 }, "reader");
    expect(result.facets).toEqual([
      { entityType: "geopolitical_analysis", count: 9 },
      { entityType: "brief", count: 2 },
    ]);
  });

  it("counts no kind the reader cannot reach, so no chip leads to an empty list", async () => {
    const service = serviceReturning([
      article(1, "brief"),
      hit("ev-1", null, "evidence"),
      hit("item-1", null, "information_item"),
    ]);
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.facets).toEqual([{ entityType: "brief", count: 1 }]);
  });

  it("narrows the results and the total when a kind is selected", async () => {
    const service = serviceReturning([
      ...Array.from({ length: 9 }, (_, i) => article(i, "geopolitical_analysis")),
      ...Array.from({ length: 2 }, (_, i) => article(i, "brief")),
    ]);
    const result = await service.search({ q: "q", entityType: "brief", limit: 10 }, "reader");
    expect(result.total).toBe(2);
    expect(result.hits.every((h) => h.entityType === "brief")).toBe(true);
  });

  it("keeps the facets whole while a filter is on — the way back must stay visible", async () => {
    /* Counted before the filter narrows anything. If selecting "Briefs" left
       `facets` describing only briefs, the row of chips would collapse to the
       one already chosen and the reader would have no control to undo it. */
    const service = serviceReturning([
      ...Array.from({ length: 9 }, (_, i) => article(i, "geopolitical_analysis")),
      ...Array.from({ length: 2 }, (_, i) => article(i, "brief")),
    ]);
    const result = await service.search({ q: "q", entityType: "brief", limit: 10 }, "reader");
    expect(result.facets).toEqual([
      { entityType: "geopolitical_analysis", count: 9 },
      { entityType: "brief", count: 2 },
    ]);
  });

  it("pages within the filtered set", async () => {
    const service = serviceReturning([
      ...Array.from({ length: 25 }, (_, i) => article(i, "geopolitical_analysis")),
      ...Array.from({ length: 25 }, (_, i) => article(i, "brief")),
    ]);
    const result = await service.search(
      { q: "q", entityType: "brief", limit: 10, offset: 20 },
      "reader",
    );
    expect(result.total).toBe(25);
    expect(result.hits).toHaveLength(5);
    expect(result.hits.every((h) => h.entityType === "brief")).toBe(true);
  });
});

describe("the summary a result carries", () => {
  it("reaches the reader, so the row has something to say under its title", async () => {
    const service = serviceReturning([
      hit("rec-1", "/articles/rec-1", "brief", "What the desk established, in one sentence."),
    ]);
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.hits[0]!.summary).toBe("What the desk established, in one sentence.");
  });

  it("is null rather than a path when the record has none", async () => {
    /* The component renders nothing for null. What it must never do again is
       what it did until 2026-09-14: print the destination path in the slot
       where prose belongs. */
    const service = serviceReturning([hit("rec-1", "/articles/rec-1", "brief", null)]);
    const result = await service.search({ q: "q", limit: 10 }, "reader");
    expect(result.hits[0]!.summary).toBeNull();
    expect(result.hits[0]!.summary).not.toBe(result.hits[0]!.href);
  });
});

describe("the internal audience", () => {
  it("still receives unaddressable rows, because chat cites by documentId", async () => {
    const service = serviceReturning([
      hit("ev-1", null, "evidence"),
      hit("item-1", null, "information_item"),
    ]);
    const result = await service.search({ q: "q", limit: 25 }, "internal");
    expect(result.hits).toHaveLength(2);
  });

  it("is given the paging fields too, describing the one page it asked for", async () => {
    const service = serviceReturning(Array.from({ length: 40 }, (_, i) => article(i)));
    const result = await service.search({ q: "q", limit: 25 }, "internal");
    expect(result.hits).toHaveLength(25);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(25);
    /* It asked for 25 and got 25, so there may well be more — said as a floor
       rather than as a count it has no way to know. */
    expect(result.totalIsFloor).toBe(true);
  });
});
