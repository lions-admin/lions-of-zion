import { describe, expect, it } from "vitest";
import { isIndexable, projectEvidence, projectItem } from "@/server/modules/search/projection";
import type { Evidence, InformationItem } from "@/server/db/schema";

/** Only the fields the projection actually reads — the rest of the row is
 *  irrelevant here by design, which is the point of keeping this pure. */
const item = (over: Partial<InformationItem> = {}) =>
  ({
    id: "11111111-1111-1111-1111-111111111111",
    title: "Border incident reported",
    canonicalText: "The war did not stay at the border.",
    summary: "A short summary.",
    language: "en",
    ...over,
  }) as InformationItem;

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
      language: "en",
    });
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
