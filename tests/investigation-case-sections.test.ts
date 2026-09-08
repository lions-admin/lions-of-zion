import { describe, expect, it } from "vitest";
import { BASE_CASE_SECTIONS, caseSections } from "@/components/investigation/labels";
import { getCase } from "@/lib/content/fake-resistance-cases";

/**
 * VA-54.3 — the local table of contents (the below-1220px case-navigator
 * strip built by `InvestigationSectionNav`) must never omit a section the
 * page actually renders.
 *
 * `page.tsx`'s "What changed" `SectionBlock` is conditional on
 * `record.overturned.length > 0`. Before this change the strip's section list
 * was a static nine-entry array declared in the page and never grew a tenth
 * entry for it — a real, anchor-linkable section (`CaseStoryHeader`'s own
 * update marker points at `#what-changed`) with no stable, discoverable entry
 * point in the one navigation surface built for exactly that. These pin the
 * fix: the derivation is a pure function of whether the case carries an
 * overturned reading, so the strip and the page can no longer drift apart.
 */
describe("caseSections", () => {
  it("returns the nine base sections when the case carries no overturned reading", () => {
    const sections = caseSections(false);
    expect(sections).toEqual(BASE_CASE_SECTIONS);
    expect(sections.map((s) => s.id)).not.toContain("what-changed");
  });

  it("inserts \"What changed\" directly after \"Finding\" when the case does", () => {
    const sections = caseSections(true);
    expect(sections).toHaveLength(BASE_CASE_SECTIONS.length + 1);
    const findingIndex = sections.findIndex((s) => s.id === "finding");
    expect(sections[findingIndex + 1]).toEqual({ id: "what-changed", label: "What changed" });
    // Nothing else in the base list was reordered or dropped.
    expect(sections.filter((s) => s.id !== "what-changed")).toEqual(BASE_CASE_SECTIONS);
  });

  it("keeps every section id unique", () => {
    for (const hasOverturned of [false, true]) {
      const ids = caseSections(hasOverturned).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("matches the real Hinkle Machine case, which has overturned readings", async () => {
    const record = await getCase("hinkle-machine");
    expect(record).not.toBeNull();
    expect(record!.overturned.length).toBeGreaterThan(0);
    const ids = caseSections(record!.overturned.length > 0).map((s) => s.id);
    expect(ids).toContain("what-changed");
    // The section the update marker links to is exactly the one the strip offers.
    expect(ids.indexOf("what-changed")).toBe(ids.indexOf("finding") + 1);
  });

  it("omits \"What changed\" for a case with no overturned reading", async () => {
    const index = await import("@/lib/content/fake-resistance-cases").then((m) =>
      m.getCaseIndex(),
    );
    const other = index.find((entry) => entry.slug !== "hinkle-machine");
    expect(other).toBeTruthy();
    const record = await getCase(other!.slug);
    expect(record).not.toBeNull();
    if (record!.overturned.length === 0) {
      const ids = caseSections(false).map((s) => s.id);
      expect(ids).not.toContain("what-changed");
    }
  });
});
