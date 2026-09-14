import { describe, expect, it } from "vitest";
import {
  destinationFor,
  isIndexable,
  projectEvidence,
  projectItem,
  projectPublication,
} from "@/server/modules/search/projection";
import type { Evidence, InformationItem } from "@/server/db/schema";

/** Only the fields the projection actually reads — the rest of the row is
 *  irrelevant here by design, which is the point of keeping this pure. */
const item = (over: Partial<InformationItem> = {}) =>
  ({
    id: "11111111-1111-1111-1111-111111111111",
    publicId: "border-incident-reported-a1b2c",
    title: "Border incident reported",
    canonicalText: "The war did not stay at the border.",
    summary: "A short summary.",
    language: "en",
    ...over,
  }) as InformationItem;

const publicationRow = (over: Record<string, unknown> = {}) => ({
  id: "33333333-3333-3333-3333-333333333333",
  publicId: "what-we-know-about-the-border-incident-x9y8z",
  briefingRunId: "44444444-4444-4444-4444-444444444444",
  kind: "brief" as const,
  title: "What we know about the border incident",
  summary: "The standfirst.",
  body: "The reporting so far.",
  language: "en",
  ...over,
});

const evidenceRow = (over: Partial<Evidence> = {}) =>
  ({
    id: "22222222-2222-2222-2222-222222222222",
    title: "Wire report",
    excerpt: "The agency reported the incident.",
    language: "en",
    dataClass: "public",
    ...over,
  }) as Evidence;

describe("projectItem", () => {
  it("leads with the claim as made, then the summary", () => {
    expect(projectItem(item())).toEqual({
      entityType: "information_item",
      entityId: "11111111-1111-1111-1111-111111111111",
      title: "Border incident reported",
      body: "The war did not stay at the border.\nA short summary.",
      summary: "A short summary.",
      language: "en",
      publicId: "border-incident-reported-a1b2c",
      href: null,
    });
  });

  it("stores the summary separately from the body, so a result can be read", () => {
    /* The body is the matcher's copy — the claim and the summary joined, which
       is what a reader pastes into the box. `summary` is the display copy, and
       it is the same sentence the record shows everywhere else on the site.
       `SearchResults` printed the destination *path* in that slot until
       2026-09-14. */
    const projected = projectItem(item());
    expect(projected.summary).toBe("A short summary.");
    expect(projected.summary).not.toMatch(/^\//);
  });

  it("offers no summary rather than an empty one when the record has none", () => {
    expect(projectItem(item({ summary: null })).summary).toBeNull();
  });

  it("keeps the item's public id but offers no destination, because it has none", () => {
    /* There is no `/items/[publicId]` route. Storing the id anyway is what
       makes that route a backfill rather than a schema change; inventing a
       href for it now would manufacture 404s in a search result list. */
    const projected = projectItem(item());
    expect(projected.publicId).toBe("border-incident-reported-a1b2c");
    expect(projected.href).toBeNull();
  });

  it("drops a missing summary rather than leaving a blank line", () => {
    expect(projectItem(item({ summary: null })).body).toBe("The war did not stay at the border.");
  });

  it("drops a whitespace-only summary too", () => {
    expect(projectItem(item({ summary: "   " })).body).toBe("The war did not stay at the border.");
  });

  it("indexes no status or verdict vocabulary", () => {
    /* A search for "verified" must not return every verified item ahead of an
       article about verification. */
    const projected = projectItem(item({ status: "published", assessment: "verified" } as never));
    expect(projected.body).not.toMatch(/published|verified/);
    expect(projected.title).not.toMatch(/published|verified/);
  });
});

describe("projectEvidence", () => {
  it("projects title and excerpt", () => {
    expect(projectEvidence(evidenceRow())).toMatchObject({
      entityType: "evidence",
      title: "Wire report",
      body: "The agency reported the incident.",
    });
  });

  it("tolerates evidence with no excerpt", () => {
    expect(projectEvidence(evidenceRow({ excerpt: null })).body).toBe("");
  });

  it("offers neither a public id nor a destination — evidence is reached through its item", () => {
    expect(projectEvidence(evidenceRow())).toMatchObject({ publicId: null, href: null });
  });

  it("offers no summary — the excerpt is evidence's substance, not a description of it", () => {
    /* Repeating the excerpt as a standfirst would present a quotation as the
       desk's own account of it. Moot for a reader, who is never shown evidence
       at all, and not moot for the staff surfaces that reuse this projection. */
    expect(projectEvidence(evidenceRow()).summary).toBeNull();
  });
});

describe("the destination a hit resolves to", () => {
  it("sends a briefing publication to its article", () => {
    expect(projectPublication(publicationRow())).toMatchObject({
      publicId: "what-we-know-about-the-border-incident-x9y8z",
      href: "/articles/what-we-know-about-the-border-incident-x9y8z",
    });
  });

  it("refuses a href to a publication that has no briefing run", () => {
    /* `/articles/[publicId]` is briefing-only — `getBriefingPublicDetail()`
       404s the historic site-reference publications that share the table.
       `app/sitemap.ts` keeps them out by hand for the same reason. */
    const projected = projectPublication(publicationRow({ briefingRunId: null }));
    expect(projected.publicId).toBe("what-we-know-about-the-border-incident-x9y8z");
    expect(projected.href).toBeNull();
  });

  it("carries the publication's standfirst for display, and still matches on it", () => {
    /* The two are not redundant. `body` is what the tsvectors index — the
       summary joined to the article, because a reader searches the words of
       both. `summary` is what a result row *shows*, and it is the same
       sentence the record shows on its own page. */
    const projected = projectPublication(publicationRow());
    expect(projected.summary).toBe("The standfirst.");
    expect(projected.body).toBe("The standfirst.\nThe reporting so far.");
  });

  it("resolves every publication kind the same way", () => {
    for (const kind of ["news_update", "brief", "geopolitical_analysis", "scenario"] as const) {
      expect(destinationFor(kind, { publicId: "p-1", briefingRunId: "r-1" }).href).toBe("/articles/p-1");
    }
  });

  it("never invents a href from an entity type that has no page", () => {
    for (const kind of ["information_item", "evidence", "narrative", "actor"] as const) {
      expect(destinationFor(kind, { publicId: "p-1", briefingRunId: "r-1" }).href).toBeNull();
    }
  });
});

describe("isIndexable", () => {
  it("refuses restricted and secret material", () => {
    expect(isIndexable({ dataClass: "restricted" })).toBe(false);
    expect(isIndexable({ dataClass: "secret" })).toBe(false);
  });

  it("allows everything else, including an absent classification", () => {
    for (const dataClass of ["public", "internal", "confidential"]) {
      expect(isIndexable({ dataClass })).toBe(true);
    }
    expect(isIndexable({})).toBe(true);
  });
});
