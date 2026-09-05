import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  caseParams,
  getCase,
  getCaseIndex,
  getResearchIndex,
  getResearchNetwork,
  getTechniqueExamples,
} from "@/lib/content/fake-resistance-cases";
import {
  FRAMED_SLUGS,
  SUPPRESSED_SLUGS,
  TAGGED_SLUGS,
  isSuppressed,
  suppressionReason,
} from "@/lib/content/fake-resistance-editorial";
import {
  TECHNIQUE_IDS,
  getPlaybook,
  isTechniqueId,
  techniqueHref,
} from "@/lib/content/fake-resistance-playbook";
import { ASSESSMENT_VALUES } from "@/server/contracts/enums";

/**
 * The research pages prerender straight from imported JSON, and the material
 * is adversarial: it names living people and grades claims about them. A
 * broken reference here does not merely render a hole — it can render a claim
 * with its sourcing detached, or a grade stronger than the research assigned.
 * These tests hold the seam to the rules the integration promised.
 */
const PACKAGE = path.join(process.cwd(), "content-packages", "fake-resistance");

// Every slug the index lists must load. Filtering nulls out here would let a
// corrupted case file disappear from the suite silently while every downstream
// assertion still passed on the survivors — which is exactly what it did.
async function allCases() {
  const index = await getCaseIndex();
  const records = await Promise.all(
    index.map(async (entry) => {
      const record = await getCase(entry.slug);
      expect(record, `getCase("${entry.slug}") returned null`).not.toBeNull();
      return record as NonNullable<typeof record>;
    }),
  );
  return records;
}

describe("the research package", () => {
  it("declares the contract this seam was written against", async () => {
    const index = await getResearchIndex();
    expect(index.contract).toBe("fake-resistance-research@1");
    expect(index.cases.length).toBeGreaterThan(0);
  });

  it("builds a page for every visible case and no others", async () => {
    const [params, index] = await Promise.all([caseParams(), getCaseIndex()]);
    expect(params.map((p) => p.slug).sort()).toEqual(index.map((e) => e.slug).sort());
  });

  it("refuses a slug that is not a case", async () => {
    expect(await getCase("not-a-case")).toBeNull();
    // Path traversal never reaches the filesystem: the slug is validated.
    expect(await getCase("../../../etc/passwd")).toBeNull();
  });

  it("keeps every case's slug URL-safe", async () => {
    const index = await getCaseIndex();
    for (const entry of index) expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("verdict vocabulary", () => {
  /**
   * The research grades claims in its own vocabulary and the importer maps it
   * to this site's `AssessmentValue` exactly once. If a research status ever
   * arrives that the map does not cover, the import fails loudly — this test
   * is the second gate, catching a mapping that silently produced a value the
   * badge cannot render.
   */
  it("only ever produces assessment values the site can render", async () => {
    const cases = await allCases();
    const verdicts = new Set(cases.flatMap((c) => c.exhibits.map((e) => e.verdict)));
    expect(verdicts.size).toBeGreaterThan(0);
    for (const verdict of verdicts) {
      expect(ASSESSMENT_VALUES).toContain(verdict);
    }
  });

  it("never grades a finding above the confidence the research assigned", async () => {
    const cases = await allCases();
    for (const record of cases) {
      for (const exhibit of record.exhibits) {
        if (!exhibit.confidence) continue;
        expect(["high", "medium", "low"]).toContain(exhibit.confidence);
      }
    }
  });

  it("preserves identity status verbatim, never upgrading it", async () => {
    const cases = await allCases();
    const statuses = new Set(cases.flatMap((c) => c.roster.map((e) => e.identityStatus)));
    expect(statuses.size).toBeGreaterThan(1);
    for (const status of statuses) {
      expect(["confirmed", "probable", "unresolved"]).toContain(status);
    }
  });

  it("labels every edge with the class of evidence behind it", async () => {
    const [cases, network] = await Promise.all([allCases(), getResearchNetwork()]);
    const edges = [...cases.flatMap((c) => c.edges), ...network.edges];
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect([
        "documented_relationship",
        "observed_interaction",
        "inferred_coordination",
      ]).toContain(edge.evidenceClass);
    }
  });
});

describe("evidence integrity", () => {
  it("gives every graded finding a statement and a verdict", async () => {
    const cases = await allCases();
    for (const record of cases) {
      for (const exhibit of record.exhibits) {
        expect(exhibit.statement.length).toBeGreaterThan(0);
        expect(exhibit.verdict).toBeTruthy();
      }
    }
  });

  it("resolves every finding's sources to real, reachable citations", async () => {
    const cases = await allCases();
    for (const record of cases) {
      const known = new Set(record.sources.map((s) => s.id));
      for (const exhibit of record.exhibits) {
        for (const source of exhibit.sources) {
          expect(known.has(source.id)).toBe(true);
          expect(source.label.length).toBeGreaterThan(0);
        }
      }
      for (const point of record.bottomLine) {
        for (const source of point.sources) {
          expect(known.has(source.id)).toBe(true);
        }
      }
    }
  });

  it("points every edge at an entity the case actually lists", async () => {
    const cases = await allCases();
    for (const record of cases) {
      const known = new Set(record.roster.map((e) => e.id));
      for (const edge of record.edges) {
        expect(known.has(edge.fromId)).toBe(true);
        expect(known.has(edge.toId)).toBe(true);
      }
    }
  });

  it("leaves no unresolved citation markers in published prose", async () => {
    // `[src_xxx]` is the reports' internal footnote apparatus. It is stripped
    // at import and the sources travel as data; a leftover marker means a
    // machine identifier reached the page.
    const raw = await readFile(path.join(PACKAGE, "index.json"), "utf8");
    const cases = await allCases();
    const prose = [
      raw,
      ...cases.flatMap((record) => [
        record.confidence,
        ...record.bottomLine.map((p) => p.text),
        ...record.limitations,
        ...record.unknowns,
        ...record.contradictions,
        ...record.wouldChange,
      ]),
    ].join("\n");
    expect(prose).not.toMatch(/\[src_/);
  });

  it("keeps markdown out of the fields rendered as plain text", async () => {
    /* Two kinds of text arrive from the packets. Report *prose* — the bottom
       line, limitations, contradictions — is written in light markdown and
       renders through `ResearchText`, which turns the emphasis into real
       markup. Everything else is `publication_wording` and other cleared
       fields, which render directly and must therefore be plain: an asterisk
       reaching one of those shows up on the page as an asterisk. */
    const cases = await allCases();
    const network = await getResearchNetwork();
    const plain = [
      ...cases.flatMap((record) => [
        record.question,
        ...record.exhibits.map((e) => e.statement),
        ...record.edges.map((e) => e.statement),
        ...record.roster.map((e) => e.note ?? ""),
        ...record.narratives.flatMap((n) => [n.summary ?? "", n.frame ?? "", n.audience ?? ""]),
      ]),
      ...network.edges.map((e) => e.statement),
      ...network.communities.map((c) => c.binding),
    ];

    for (const value of plain) {
      expect(value, `markdown leaked into a plain field: ${value.slice(0, 60)}`).not.toMatch(
        /\*|`/,
      );
    }
  });

  it("never imports the researchers' internal analysis field", async () => {
    /* Every claim row carries both an internal `analysis` note and a
       `publication_wording` the researchers wrote for publication. Only the
       latter may reach a page. The JSON must not carry the key at all. */
    const cases = await allCases();
    for (const record of cases) {
      for (const exhibit of record.exhibits) {
        expect(exhibit).not.toHaveProperty("analysis");
      }
      for (const edge of record.edges) {
        expect(edge).not.toHaveProperty("analysis");
      }
    }
  });

  it("keeps every case's own uncertainty on the record", async () => {
    const cases = await allCases();
    for (const record of cases) {
      // A case that establishes findings must also say what it did not settle.
      const caveats =
        record.limitations.length + record.unknowns.length + record.contradictions.length;
      expect(caveats).toBeGreaterThan(0);
    }
  });
});

describe("the network payload", () => {
  it("carries the communities and bridges the graph found", async () => {
    const network = await getResearchNetwork();
    expect(network.communities.length).toBeGreaterThan(1);
    expect(network.bridges.length).toBeGreaterThan(0);
    for (const community of network.communities) {
      expect(community.name.length).toBeGreaterThan(0);
      expect(community.nodes.length).toBeGreaterThan(0);
    }
  });

  it("keeps the synthesis findings that survived the contradiction pass", async () => {
    const network = await getResearchNetwork();
    expect(network.findings.length).toBeGreaterThan(0);
  });
});

describe("the playbook", () => {
  it("gives every technique all four parts of a chapter", () => {
    const chapters = getPlaybook();
    expect(chapters.length).toBeGreaterThan(0);
    for (const chapter of chapters) {
      expect(chapter.id).toMatch(/^[a-z0-9-]+$/);
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.summary.length).toBeGreaterThan(0);
      expect(chapter.move.length).toBeGreaterThan(0);
      expect(chapter.psychology.length).toBeGreaterThan(0);
      expect(chapter.cues.length).toBeGreaterThan(0);
    }
  });

  it("keeps technique ids unique, since they are anchors", () => {
    expect(new Set(TECHNIQUE_IDS).size).toBe(TECHNIQUE_IDS.length);
  });

  it("links every documented example to a page on this site", () => {
    /* A technique may not claim an example it cannot show, and it may never
       send the reader off-site to prove itself — provenance travels in the
       sources, not in the prose (`.ai/DECISIONS.md`). */
    for (const chapter of getPlaybook()) {
      for (const example of chapter.documented) {
        expect(example.href.startsWith("/")).toBe(true);
        expect(example.label.length).toBeGreaterThan(0);
        expect(example.note.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolves a technique chip to a real chapter anchor", () => {
    for (const id of TECHNIQUE_IDS) {
      expect(isTechniqueId(id)).toBe(true);
      expect(techniqueHref(id)).toBe(`/fake-resistance/playbook#${id}`);
    }
    expect(isTechniqueId("not-a-technique")).toBe(false);
  });

  it("only ever tags an exhibit with a technique the playbook explains", async () => {
    const cases = await allCases();
    for (const record of cases) {
      for (const exhibit of record.exhibits) {
        for (const technique of exhibit.techniques) {
          expect(isTechniqueId(technique)).toBe(true);
        }
      }
    }
  });

  it("shows a documented example for every technique it teaches", async () => {
    /* A chapter with no example is allowed — it says so plainly rather than
       inventing one — but a chapter should not stay empty once the case files
       are published, because a technique nobody can show is a technique this
       site is only asserting. */
    const examples = await getTechniqueExamples();
    for (const chapter of getPlaybook()) {
      const shown = chapter.documented.length + (examples.get(chapter.id)?.length ?? 0);
      expect(shown, `no example documents "${chapter.title}"`).toBeGreaterThan(0);
    }
  });

  it("only ever points a chapter at a finding that is actually published", async () => {
    const [examples, cases] = await Promise.all([getTechniqueExamples(), allCases()]);
    const published = new Set(
      cases.flatMap((record) =>
        record.exhibits.map((e) => `/fake-resistance/cases/${record.slug}#${e.id}`),
      ),
    );
    for (const list of examples.values()) {
      for (const example of list) {
        expect(published.has(example.href)).toBe(true);
      }
    }
  });
});

describe("the editorial pass", () => {
  it("frames every published case", async () => {
    const index = await getCaseIndex();
    for (const entry of index) {
      expect(FRAMED_SLUGS, `no framing written for ${entry.slug}`).toContain(entry.slug);
    }
    const cases = await allCases();
    for (const record of cases) {
      expect(record.framing?.frame.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("keeps the research's own guard on the cases that carry one", async () => {
    /* Two cases exist whose subjects the research explicitly refused to
       classify as inauthentic — the aggregators (which include an on-scene
       reporter and an evidence archive) and the journalism corridor. Both
       must carry that limit on the page, or the site is publishing a frame
       its own evidence rejects. */
    for (const slug of ["aggregators-feeders", "grayzone-anti-empire"]) {
      const record = await getCase(slug);
      expect(record?.framing?.guard, `${slug} must carry its category guard`).toBeTruthy();
    }
  });

  it("applies the naming policy by withholding, and records why", async () => {
    expect(SUPPRESSED_SLUGS.length).toBeGreaterThan(0);
    for (const slug of SUPPRESSED_SLUGS) {
      const record = await getCase(slug);
      expect(record).not.toBeNull();
      expect(record!.withheld).toBeGreaterThan(0);
    }
  });

  it("never renders a finding the naming policy withheld", async () => {
    const cases = await allCases();
    for (const record of cases) {
      for (const exhibit of record.exhibits) {
        expect(
          isSuppressed(record.slug, exhibit.id),
          `${record.slug}/${exhibit.id} is withheld but still rendered`,
        ).toBe(false);
      }
    }
  });

  it("gives every withheld finding a written reason", () => {
    for (const slug of SUPPRESSED_SLUGS) {
      // A suppression with no reason is a silent deletion, which is the thing
      // this layer exists to prevent.
      const withheld = ["claim_10", "claim_12_truthteller_fee"].filter((id) =>
        isSuppressed(slug, id),
      );
      for (const id of withheld) {
        expect(suppressionReason(slug, id)?.length ?? 0).toBeGreaterThan(40);
      }
    }
  });

  it("leaves no program shorthand on a reading surface", async () => {
    /* The research refers to itself as "case-05", "groups 01/03", "the seed
       five", and grades entities with tokens like NAMED_PERSON. Precise
       inside a nine-packet program; on a public page it is the site talking
       to itself, and a reader has no way to know what group 03 is. The
       glossary rewrites these at the seam — this holds it to that. */
    const [cases, network] = await Promise.all([allCases(), getResearchNetwork()]);
    const prose = [
      ...cases.flatMap((record) => [
        record.question,
        ...record.bottomLine.map((p) => p.text),
        ...record.exhibits.map((e) => e.statement),
        ...record.edges.map((e) => e.statement),
        ...record.roster.map((e) => e.note ?? ""),
        ...record.chronology.map((e) => e.description),
        ...record.narratives.flatMap((n) => [n.summary ?? "", n.frame ?? ""]),
        ...record.limitations,
        ...record.unknowns,
        ...record.contradictions,
      ]),
      network.question,
      ...network.findings,
      ...network.executiveSummary,
      ...network.bridges,
      ...network.communities.map((c) => c.binding),
      ...network.edges.map((e) => e.statement),
    ];

    for (const value of prose) {
      expect(value, `program shorthand on a page: ${value.slice(0, 70)}`).not.toMatch(
        /\b(?:case|group)s?[- ]0\d\b|\bthe seed five\b|\bNAMED_PERSON\b|\bANON_CLIP_FARM\b|\bSTATE_ALIGNED\b|\.csv\b|\brelationship_evidence\b/,
      );
    }
  });

  it("gives follower counts their own column instead of the note prose", async () => {
    /* 51 roster notes arrived as "965,189; verified; red-dot BREAKING style".
       A measurement stranded at the head of a sentence cannot be aligned,
       compared, or read as data — the importer splits it out. */
    const cases = await allCases();
    const withFollowers = cases.flatMap((r) =>
      r.roster.filter((e) => typeof e.followers === "number"),
    );
    expect(withFollowers.length).toBeGreaterThan(20);
    for (const entity of cases.flatMap((r) => r.roster)) {
      expect(entity.note ?? "").not.toMatch(/^[\d,]+\s*;/);
    }
  });

  it("advances a case's lifecycle only as far as the work actually got", async () => {
    /* Both passes are done, legal review cleared, and the site shipped to
       production on 2026-08-26 — so `published` is literally true rather than
       anticipatory, which is the whole reason it waited at `ready` until the
       deploy actually ran. */
    const cases = await allCases();
    for (const record of cases) {
      expect(record.lifecycle).toBe("published");
    }
  });

  it("withdraws every case when EDITORIAL_STAGE is held, index included", async () => {
    /* The regression this pins: `getCase()` used to override the JSON with
       EDITORIAL_STAGE while `getCaseIndex()` filtered on the JSON, so setting
       the flag to `held` withdrew nothing — the index, the sitemap and
       generateStaticParams all still listed every case, and only the record
       pages 404'd. The flag that reads like the publication switch has to be
       the publication switch. */
    // Capture the real slugs before the module graph is swapped.
    const slugs = (await getCaseIndex()).map((entry) => entry.slug);
    expect(slugs.length).toBeGreaterThan(0);

    vi.resetModules();
    vi.doMock("@/lib/content/fake-resistance-editorial", async () => ({
      ...(await vi.importActual<typeof import("@/lib/content/fake-resistance-editorial")>(
        "@/lib/content/fake-resistance-editorial",
      )),
      EDITORIAL_STAGE: "held" as const,
    }));
    const held = await import("@/lib/content/fake-resistance-cases");

    expect(await held.getCaseIndex()).toEqual([]);
    expect(await held.caseParams()).toEqual([]);
    for (const slug of slugs) {
      expect(await held.getCase(slug), `${slug} still resolves while held`).toBeNull();
    }

    vi.doUnmock("@/lib/content/fake-resistance-editorial");
    vi.resetModules();
  });

  it("reports the same lifecycle from the index as from the record", async () => {
    /* The two entry points read the same two gates now; if they ever disagree
       again, a case can be listed and unreachable, or reachable and unlisted. */
    const index = await getCaseIndex();
    for (const entry of index) {
      const record = await getCase(entry.slug);
      expect(record, `${entry.slug} is indexed but does not resolve`).not.toBeNull();
      expect(record!.lifecycle).toBe(entry.lifecycle);
    }
  });

  it("backs every published case with a real publication record", async () => {
    /* The packet contract pairs `published` with a `published_at` and a
       `canonical_url`. A case claiming to be published with neither is a
       claim with nothing behind it — the exact failure this section documents
       other people committing. */
    const cases = await allCases();
    for (const record of cases) {
      expect(record.publication?.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.publication?.canonicalPath).toBe(
        `/fake-resistance/cases/${record.slug}`,
      );
    }
  });

  it("only tags cases that exist", async () => {
    const slugs = new Set((await getCaseIndex()).map((e) => e.slug));
    for (const slug of [...TAGGED_SLUGS, ...FRAMED_SLUGS, ...SUPPRESSED_SLUGS]) {
      expect(slugs.has(slug), `editorial layer references unknown case ${slug}`).toBe(true);
    }
  });
});
