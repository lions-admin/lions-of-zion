import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import { PUBLICATION_SECTIONS, type PublicationSection } from "@/server/contracts/enums";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import {
  INVESTIGATION_EXPLORER_SECTIONS,
  publicationSupportsInvestigationExplorer,
} from "@/lib/publication-routing";

/* The page module reaches the database through `lib/publications`. The two
   predicates under test are pure; the render assertions below drive the whole
   page, so the projection is served from this holder instead. */
const { served } = vi.hoisted(() => ({ served: { record: null as unknown } }));
vi.mock("@/lib/publications", () => ({
  getPublicPublication: vi.fn(async () => served.record),
  isMissingPublication: () => false,
}));

const pageModule = await import("@/app/articles/[publicId]/page");
const { citesAbsoluteUrl, publicSourceState } = pageModule;
const ArticlePage = pageModule.default;

function publication(overrides: Partial<PublicPublicationDetail> = {}): PublicPublicationDetail {
  return {
    publicId: "israel-ministry-of-defense-recent-announcements--m781m",
    canonicalStoryId: null,
    kind: "brief",
    section: "daily_brief",
    title: "Ministry of Defense announcements",
    summary: "A routine announcement round-up.",
    body: "The ministry published three announcements on Sunday.",
    language: "en",
    publishedAt: "2026-09-06T07:00:00.000Z",
    updatedAt: "2026-09-06T07:00:00.000Z",
    autoPublishedAt: null,
    editorialTopic: null,
    topicTags: [],
    primaryActor: null,
    arena: null,
    featuredIsraelStory: false,
    narrativeWatchDetails: null,
    media: null,
    sources: [],
    narratives: [],
    passages: [],
    relatedArticles: [],
    corrections: [],
    ...overrides,
  } as PublicPublicationDetail;
}

const NARRATIVE_DETAILS: NonNullable<PublicPublicationDetail["narrativeWatchDetails"]> = {
  exactClaim: "A claim that the strike hit a hospital.",
  propagators: ["An account with 40,000 followers"],
  arenas: ["social_platforms"],
  trendDirection: "rising",
  israeliPosition: null,
  securityContext: null,
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [],
  verificationState: "refuted",
  knownUnknowns: [],
  evidenceBasis: "sourced",
};

async function render(record: PublicPublicationDetail): Promise<string> {
  served.record = record;
  const stream = await renderToReadableStream(
    await ArticlePage({ params: Promise.resolve({ publicId: record.publicId }) }),
  );
  await stream.allReady;
  return await new Response(stream).text();
}

/** Written out on purpose: the test states the editorial rule, the module
 *  derives it, and the two are compared. Both agreeing by construction would
 *  prove nothing. */
const EXPLORER_ALLOWED: PublicationSection[] = [
  "narrative_watch",
  "influence_investigation",
  "antisemitism",
];

describe("investigation explorer gate (VA-03)", () => {
  it("maps every section in the contract to allow or deny", () => {
    const decided = PUBLICATION_SECTIONS.map((section) => [
      section,
      publicationSupportsInvestigationExplorer(section),
    ] as const);
    expect(decided).toHaveLength(PUBLICATION_SECTIONS.length);
    for (const [, allowed] of decided) expect(typeof allowed).toBe("boolean");
    const allowed = decided.filter(([, verdict]) => verdict).map(([section]) => section);
    expect([...allowed].sort()).toEqual([...EXPLORER_ALLOWED].sort());
  });

  it("permits the Fake Resistance desk and denies news, briefs and People", () => {
    for (const section of EXPLORER_ALLOWED) {
      expect(publicationSupportsInvestigationExplorer(section)).toBe(true);
    }
    for (const section of PUBLICATION_SECTIONS) {
      if ((EXPLORER_ALLOWED as string[]).includes(section)) continue;
      expect(publicationSupportsInvestigationExplorer(section)).toBe(false);
    }
    for (const section of ["daily_brief", "israel_update", "news", "history_context", "people"]) {
      expect(publicationSupportsInvestigationExplorer(section)).toBe(false);
    }
  });

  it("falls to deny for an unknown, empty or absent section", () => {
    expect(publicationSupportsInvestigationExplorer("war_update")).toBe(false);
    expect(publicationSupportsInvestigationExplorer("investigation")).toBe(false);
    expect(publicationSupportsInvestigationExplorer("")).toBe(false);
    expect(publicationSupportsInvestigationExplorer(null)).toBe(false);
    expect(publicationSupportsInvestigationExplorer(undefined)).toBe(false);
    expect(publicationSupportsInvestigationExplorer("toString")).toBe(false);
  });

  it("gives a routine announcement no seven-stage explorer, and keeps the rest of the page", async () => {
    const markup = await render(
      publication({
        sources: [{ title: "Ministry release", publisher: "gov.il", url: "https://www.gov.il/x", publishedAt: null }],
        passages: [{ position: 1, text: "The ministry published three announcements.", claim: null, sources: [] }],
      }),
    );
    expect(markup).not.toContain("evidence-explorer-title");
    expect(markup).not.toContain("Observed spread");
    expect(markup).toContain("Public sources");
    expect(markup).toContain("Ministry release");
    expect(markup).toContain("The ministry published three announcements.");
  });

  it("keeps the explorer on a genuine narrative-watch investigation", async () => {
    const markup = await render(
      publication({
        section: "narrative_watch",
        kind: "news_update",
        narrativeWatchDetails: NARRATIVE_DETAILS,
        sources: [{ title: "Verified footage", publisher: "Reuters", url: "https://reuters.example/a", publishedAt: null }],
      }),
    );
    expect(markup).toContain("evidence-explorer-title");
    expect(markup).toContain("Observed spread");
  });

  it("publishes the allow-list as a derived list, not a hand-written one", () => {
    expect([...INVESTIGATION_EXPLORER_SECTIONS].sort()).toEqual([...EXPLORER_ALLOWED].sort());
    for (const section of INVESTIGATION_EXPLORER_SECTIONS) {
      expect(PUBLICATION_SECTIONS).toContain(section);
    }
  });
});

describe("public source state (VA-02)", () => {
  it("suppresses the denial when the body cites an absolute URL and nothing is stored", () => {
    expect(
      publicSourceState({
        sourceCount: 0,
        isAnalysis: false,
        body: "The programme is described at https://innovationisrael.org.il/en/program in full.",
      }),
    ).toBe("pending");
  });

  it("leaves an analysis record's own disclosure untouched", () => {
    expect(
      publicSourceState({
        sourceCount: 0,
        isAnalysis: true,
        body: "Our assessment answers a claim circulated at https://example.org/post today.",
      }),
    ).toBe("analysis");
    expect(
      publicSourceState({ sourceCount: 0, isAnalysis: true, body: "No link at all in this body." }),
    ).toBe("analysis");
  });

  it("shows a stored source stack normally, cited body or not", () => {
    expect(
      publicSourceState({
        sourceCount: 2,
        isAnalysis: false,
        body: "Reported at https://www.gov.il/en/release today.",
      }),
    ).toBe("listed");
    expect(publicSourceState({ sourceCount: 1, isAnalysis: true, body: "Body." })).toBe("listed");
  });

  it("does not fire on a bare domain mentioned in prose", () => {
    expect(
      publicSourceState({
        sourceCount: 0,
        isAnalysis: false,
        body: "The claim spread on x.com and was repeated by haaretz.com and telegram channels.",
      }),
    ).toBe("unsourced");
    expect(citesAbsoluteUrl("Reported by haaretz.com on Tuesday.")).toBe(false);
    expect(citesAbsoluteUrl("See www.gov.il for the release.")).toBe(false);
    expect(citesAbsoluteUrl("Read the notice at https://www.gov.il/en/release.")).toBe(true);
    expect(citesAbsoluteUrl("Mirror: HTTP://archive.org/item")).toBe(true);
    expect(citesAbsoluteUrl("A trailing scheme with no address: https:// ")).toBe(false);
  });

  it("renders the pending state instead of a zero count beside a body citation", async () => {
    const markup = await render(
      publication({
        section: "innovation",
        body: "The programme is set out at https://innovationisrael.org.il/en/program.",
      }),
    );
    expect(markup).toContain("Sources for this record are pending verification");
    expect(markup).not.toContain("No public sources are listed for this article");
    expect(markup).not.toContain("0 sources");
  });

  it("keeps the plain statement when nothing is stored and nothing is cited", async () => {
    const markup = await render(publication({ section: "news" }));
    expect(markup).toContain("No public sources are listed for this article");
    expect(markup).not.toContain("pending verification");
  });

  it("leaves the analysis disclosure exactly as it was", async () => {
    const markup = await render(
      publication({
        section: "narrative_watch",
        kind: "news_update",
        body: "Our own reading of a claim circulated at https://example.org/post.",
        narrativeWatchDetails: { ...NARRATIVE_DETAILS, evidenceBasis: "analysis" },
      }),
    );
    expect(markup).toContain("Why this record cites no source");
    expect(markup).not.toContain("pending verification");
    expect(markup).not.toContain("No public sources are listed for this article");
  });

  it("reads a citation carried only by a rendered passage", () => {
    expect(
      publicSourceState({
        sourceCount: 0,
        isAnalysis: false,
        body: "Summary paragraph with no link.",
        passages: [{ text: "The filing is published at https://example.gov/filing/12." }],
      }),
    ).toBe("pending");
    expect(
      publicSourceState({
        sourceCount: 0,
        isAnalysis: false,
        body: "Summary paragraph with no link.",
        passages: [{ text: "No link here either." }],
      }),
    ).toBe("unsourced");
  });
});
