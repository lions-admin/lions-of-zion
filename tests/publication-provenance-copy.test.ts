import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLICATION_PROVENANCE, publicationProvenance } from "@/server/contracts/publication";

/**
 * VA-47 — the public trust pages may not contradict live publication metadata.
 *
 * The site promised, on `/we-are` and in the Methodology assessment process,
 * that a second non-author human reviewer approved everything before it could
 * publish. The article page meanwhile marked machine-published records with a
 * bare "Automatically published daily edition". Both statements were true of
 * one pathway each and written as though true of all of them.
 *
 * These pin the derivation and the copy. The source-string assertions are
 * deliberate and follow the precedent in `tests/site-navigation.test.ts`: they
 * assert the *mechanism* — that the pages read the shared constant and that the
 * retired absolute claims are gone — rather than any particular wording, so the
 * copy can be rewritten without breaking the suite.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("provenance is derived, never chosen", () => {
  it("reads a machine-published record from its auto-publication marker", () => {
    expect(publicationProvenance({ autoPublishedAt: "2026-09-07T04:00:00.000Z" })).toBe("machine");
  });

  it("reads a human-reviewed record when the marker is absent", () => {
    expect(publicationProvenance({ autoPublishedAt: null })).toBe("human");
  });

  it("never invents a third class", () => {
    expect(Object.keys(PUBLICATION_PROVENANCE).sort()).toEqual(["human", "machine"]);
  });

  it("gives each class a label and a longer detail", () => {
    for (const kind of ["machine", "human"] as const) {
      expect(PUBLICATION_PROVENANCE[kind].label.length).toBeGreaterThan(10);
      expect(PUBLICATION_PROVENANCE[kind].detail.length).toBeGreaterThan(40);
    }
  });

  it("does not claim a person approved a machine-published record", () => {
    const machine = `${PUBLICATION_PROVENANCE.machine.label} ${PUBLICATION_PROVENANCE.machine.detail}`;
    expect(machine).toMatch(/no person approves|without human|does not/i);
    expect(machine).not.toMatch(/reviewed by a second|approved by a second/i);
  });
});

describe("the article page states authorship from the shared constant", () => {
  const page = read("app/articles/[publicId]/page.tsx");

  it("derives the line rather than hardcoding one", () => {
    expect(page).toMatch(/PUBLICATION_PROVENANCE\[publicationProvenance\(article\)\]\.label/);
  });

  it("no longer renders the bare edition string that started this", () => {
    expect(page).not.toContain("Automatically published daily edition");
  });
});

describe("the trust pages describe both pathways, not one", () => {
  const weAre = read("app/we-are/page.tsx");
  const methodology = read("app/methodology/page.tsx");

  it("drops the absolute claim that every publication needs a second reviewer", () => {
    // The retired sentence, verbatim. Its absence is the assertion.
    expect(weAre).not.toContain("The second, non-author reviewer every assessment requires before it can publish.");
  });

  it("says on We Are that most records take the other route", () => {
    expect(weAre).toMatch(/published by the editorial system itself/i);
  });

  it("scopes the Methodology human-review gate to the human path", () => {
    expect(methodology).toMatch(/Gate — human path only/);
    expect(methodology).not.toContain('gate: "Gate — human only"');
  });

  it("renders the two pathways on Methodology from the shared constant", () => {
    expect(methodology).toMatch(/PUBLICATION_PROVENANCE\[kind\]\.label/);
    expect(methodology).toMatch(/PUBLICATION_PROVENANCE\[kind\]\.detail/);
    expect(methodology).toMatch(/heading="Two ways a record publishes"/);
  });
});

describe("the funding disclosure is specific rather than deferred", () => {
  const weAre = read("app/we-are/page.tsx");

  it("no longer says funding is unpublished", () => {
    expect(weAre).not.toContain("Not yet published in full");
  });

  it("names the funding model and the absence of a backer", () => {
    expect(weAre).toMatch(/privately funded independent initiative/i);
    expect(weAre).toMatch(/no institutional, governmental, party or corporate/i);
  });
});
