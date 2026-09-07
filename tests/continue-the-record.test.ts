import { describe, expect, it } from "vitest";
import {
  CONTINUATION_LABELS,
  continueTheRecord,
  type ContinuationCandidate,
} from "@/lib/continue-the-record";

/**
 * VA-50 — an evidence-aware continuation, not a "you may also like" carousel.
 *
 * Every rung requires a shared field rather than a string resemblance. That is
 * the whole design: the live desk carries seven near-duplicate title pairs, so
 * anything matching on words would recommend a record's own twin.
 */

const base = (over: Partial<ContinuationCandidate> & { publicId: string }): ContinuationCandidate => ({
  title: `Record ${over.publicId}`,
  summary: null,
  section: "news",
  publishedAt: "2026-09-01T00:00:00Z",
  ...over,
});

const current = base({
  publicId: "current",
  title: "Strike near the northern border",
  section: "news",
  editorialTopic: "Lebanon security",
  primaryActor: "Hezbollah",
  topicTags: ["lebanon", "escalation"],
  canonicalStoryId: "northern-border",
});

describe("the ladder picks the strongest shared field", () => {
  it("puts an investigation about the same thing at the top", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "desk", section: "news" }),
      base({ publicId: "probe", section: "influence_investigation", primaryActor: "Hezbollah" }),
    ]);
    expect(out[0]).toMatchObject({ publicId: "probe", reason: "investigation" });
  });

  it("does not promote an investigation about something else", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "unrelated", section: "influence_investigation", primaryActor: "Someone else" }),
    ]);
    expect(out).toEqual([]);
  });

  it("prefers a shared actor over a shared topic", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "topical", editorialTopic: "Lebanon security" }),
      base({ publicId: "actorly", primaryActor: "Hezbollah" }),
    ]);
    expect(out.map((row) => row.reason)).toEqual(["actor", "topic"]);
  });

  it("counts a shared topic tag as a topic match", () => {
    const out = continueTheRecord(current, [base({ publicId: "tagged", topicTags: ["ESCALATION"] })]);
    expect(out[0]).toMatchObject({ publicId: "tagged", reason: "topic" });
  });

  it("orders newest first inside one rung", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "older", primaryActor: "Hezbollah", publishedAt: "2026-08-01T00:00:00Z" }),
      base({ publicId: "newer", primaryActor: "Hezbollah", publishedAt: "2026-09-05T00:00:00Z" }),
    ]);
    expect(out.map((row) => row.publicId)).toEqual(["newer", "older"]);
  });
});

describe("it refuses the things that make filler", () => {
  it("never links a record to itself", () => {
    expect(continueTheRecord(current, [{ ...current }])).toEqual([]);
  });

  it("excludes anything sharing the canonical story, because that is this record", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "same-story", canonicalStoryId: "northern-border", primaryActor: "Hezbollah" }),
    ]);
    expect(out).toEqual([]);
  });

  it("excludes an unmerged duplicate that repeats the title", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "twin", title: "Strike near the northern border", primaryActor: "Hezbollah" }),
    ]);
    expect(out).toEqual([]);
  });

  it("keeps only the first of two candidates with the same title", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "one", title: "A repeated headline", primaryActor: "Hezbollah" }),
      base({ publicId: "two", title: "A repeated headline", primaryActor: "Hezbollah" }),
    ]);
    expect(out.map((row) => row.publicId)).toEqual(["one"]);
  });

  it("returns nothing when the only thing in common is the desk", () => {
    // One "also on this desk" row is a leftover; the hub link says it better.
    expect(continueTheRecord(current, [base({ publicId: "sibling", section: "news" })])).toEqual([]);
  });

  it("keeps desk rows once there is real company", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "sibling", section: "news" }),
      base({ publicId: "actorly", primaryActor: "Hezbollah" }),
    ]);
    expect(out.map((row) => row.reason)).toEqual(["actor", "section"]);
  });

  it("matches on fields, never on word overlap", () => {
    const out = continueTheRecord(current, [
      base({ publicId: "wordy", title: "Strike near the southern border", section: "people" }),
    ]);
    expect(out).toEqual([]);
  });

  it("returns nothing rather than something weak when there is no pool", () => {
    expect(continueTheRecord(current, [])).toEqual([]);
  });
});

describe("the shape the page renders", () => {
  it("caps the list", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      base({ publicId: `p${i}`, primaryActor: "Hezbollah" }));
    expect(continueTheRecord(current, many)).toHaveLength(4);
    expect(continueTheRecord(current, many, { max: 2 })).toHaveLength(2);
  });

  it("gives every rung a reader-facing label", () => {
    for (const reason of ["investigation", "actor", "topic", "section"] as const) {
      expect(CONTINUATION_LABELS[reason]).toMatch(/\w/);
    }
  });
});

describe("a cross-desk destination names its desk", () => {
  it("prefixes the hub when the destination sits on another desk", async () => {
    const { continuationEyebrow } = await import("@/app/articles/[publicId]/page");
    // A claim assessment under a news article must say where it comes from,
    // or it is read as more reporting.
    expect(continuationEyebrow("narrative_watch", "topic", "News & Analysis"))
      .toBe("Fake Resistance · More on this topic");
  });

  it("does not prefix a row already on this desk", async () => {
    const { continuationEyebrow } = await import("@/app/articles/[publicId]/page");
    expect(continuationEyebrow("news", "actor", "News & Analysis")).toBe("More on this actor");
  });
});

describe("the pool never decides whether the article renders", () => {
  it("gives up on a read that never settles", async () => {
    const { continuationPool } = await import("@/lib/continue-the-record");
    const started = Date.now();
    const rows = await continuationPool(["news"], () => new Promise(() => {}), { timeoutMs: 30 });
    expect(rows).toEqual([]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("treats a rejection as an empty desk", async () => {
    const { continuationPool } = await import("@/lib/continue-the-record");
    expect(await continuationPool(["news"], async () => { throw new Error("desk down"); })).toEqual([]);
  });

  it("discards a result that is not a list rather than trusting it", async () => {
    const { continuationPool } = await import("@/lib/continue-the-record");
    expect(await continuationPool(["news"], async () => undefined)).toEqual([]);
    expect(await continuationPool(["news"], async () => ({ rows: 1 }))).toEqual([]);
  });

  it("flattens the desks that did answer", async () => {
    const { continuationPool } = await import("@/lib/continue-the-record");
    const rows = await continuationPool(["a", "b"], async (s) =>
      s === "a" ? [{ publicId: "one" }] : [{ publicId: "two" }]);
    expect(rows.map((r) => r.publicId)).toEqual(["one", "two"]);
  });
});
