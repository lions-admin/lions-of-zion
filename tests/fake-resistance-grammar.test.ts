import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAKE_RESISTANCE_GRAMMAR,
  FAKE_RESISTANCE_INTRO,
  type FakeResistanceKind,
} from "@/lib/fake-resistance-grammar";

/**
 * VA-52 — three objects, three vocabularies, one place.
 *
 * The desk publishes a disputed claim, a documented incident and an
 * influence-network investigation. They had the right labels and no stated
 * grammar: the words lived in nested ternaries inside the card that drew them,
 * so nothing stopped the next surface from choosing differently.
 *
 * The harm is one-directional and these tests are shaped around it: **a
 * documented incident must never read as a disputed claim.** A claim can be
 * refuted; an incident that happened cannot.
 */

const KINDS: FakeResistanceKind[] = ["watch", "case", "article"];

describe("each type says what it is", () => {
  it("covers exactly the three the desk publishes", () => {
    expect(Object.keys(FAKE_RESISTANCE_GRAMMAR).sort()).toEqual(["article", "case", "watch"]);
  });

  it.each(KINDS)("%s has a kicker, a meaning and a source note", (kind) => {
    const g = FAKE_RESISTANCE_GRAMMAR[kind];
    expect(g.kicker.length).toBeGreaterThan(3);
    expect(g.meaning.length).toBeGreaterThan(10);
    expect(g.sourceNote.length).toBeGreaterThan(10);
  });

  it("gives no two types the same kicker", () => {
    const kickers = KINDS.map((k) => FAKE_RESISTANCE_GRAMMAR[k].kicker);
    expect(new Set(kickers).size).toBe(3);
  });
});

describe("a documented incident is not a claim", () => {
  const incident = FAKE_RESISTANCE_GRAMMAR.article;

  it("is introduced as an event, not as something in circulation", () => {
    expect(incident.kicker).toBe("Documented incident");
    expect(incident.kicker).not.toMatch(/claim/i);
  });

  it("says outright that it is not under assessment", () => {
    expect(incident.meaning).toMatch(/not a claim under assessment/i);
  });

  it("never borrows the verification vocabulary a claim assessment uses", () => {
    const words = `${incident.kicker} ${incident.meaning} ${incident.sourceNote}`;
    for (const verdict of ["refuted", "misleading", "unsupported", "disputed", "unverified"]) {
      expect(words.toLowerCase()).not.toContain(verdict);
    }
  });

  it("keeps the claim vocabulary on the claim type, where it belongs", () => {
    expect(FAKE_RESISTANCE_GRAMMAR.watch.kicker).toMatch(/claim/i);
  });
});

describe("the desk's standfirst covers all three", () => {
  it("names each kind rather than describing only claims", () => {
    // It used to read "What circulates is not always what the evidence
    // establishes" — true of one of the three, printed above all of them.
    expect(FAKE_RESISTANCE_INTRO).toMatch(/claims in circulation/i);
    expect(FAKE_RESISTANCE_INTRO).toMatch(/documented incidents/i);
    expect(FAKE_RESISTANCE_INTRO).toMatch(/influence investigations/i);
  });
});

describe("the card reads the grammar instead of choosing", () => {
  const card = readFileSync(
    join(process.cwd(), "components/home/HomeNarrativesSection.tsx"),
    "utf8",
  );

  it("takes its kicker and meaning from the map", () => {
    expect(card).toContain("FAKE_RESISTANCE_GRAMMAR[item.kind]");
    expect(card).toContain("grammar.kicker");
  });

  it("no longer carries the retired inline wording", () => {
    const markup = card.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(markup).not.toContain("Editorial reporting filed to the Fake Resistance desk.");
    expect(markup).not.toContain("What circulates is not always what the evidence establishes");
  });
});
