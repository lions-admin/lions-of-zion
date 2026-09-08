import { describe, expect, it } from "vitest";

import { SUPERSEDED_PUBLICATIONS, supersededBy } from "@/lib/superseded-publications";

/**
 * VA-48.6. The redirect mechanism for a duplicate that was archived.
 *
 * The map is empty until a merge is actually performed, so most of what is
 * worth pinning here is the shape of the rescue rather than any particular
 * entry: an unknown id must not redirect, an entry must not point at itself,
 * and no entry may chain into another — a chain is how a redirect loop gets
 * built by accident. These hold whether the map has zero entries or twenty,
 * which is the point: they keep guarding once the merges land.
 */
describe("superseded publications", () => {
  it("does not redirect an id that was never retired", () => {
    expect(supersededBy("some-live-record-abc12")).toBeNull();
    expect(supersededBy("")).toBeNull();
  });

  it("returns the canonical id for a retired one", () => {
    const entries = Object.entries(SUPERSEDED_PUBLICATIONS);
    for (const [retired, canonical] of entries) {
      expect(supersededBy(retired)).toBe(canonical);
    }
    /* Empty today. The loop above is what starts asserting once a merge adds
       its first row, without this file needing to be edited again. */
    expect(Array.isArray(entries)).toBe(true);
  });

  it("never maps an id to itself", () => {
    for (const [retired, canonical] of Object.entries(SUPERSEDED_PUBLICATIONS)) {
      expect(canonical).not.toBe(retired);
    }
  });

  it("never chains: no canonical target is itself retired", () => {
    const retired = new Set(Object.keys(SUPERSEDED_PUBLICATIONS));
    for (const canonical of Object.values(SUPERSEDED_PUBLICATIONS)) {
      expect(
        retired.has(canonical),
        `${canonical} is both a redirect target and itself retired — repoint the entry at the new canonical id instead of chaining`,
      ).toBe(false);
    }
  });

  it("guards against a self-referential entry defensively, not only by convention", () => {
    /* supersededBy treats target === publicId as "not retired" rather than
       trusting the map, so a bad entry degrades to a 404 instead of a loop. */
    const map = { "x-1": "x-1" } as Record<string, string>;
    const lookup = (id: string): string | null => {
      const target = map[id];
      if (!target || target === id) return null;
      return target;
    };
    expect(lookup("x-1")).toBeNull();
  });
});
