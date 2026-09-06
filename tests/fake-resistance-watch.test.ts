/**
 * `/fake-resistance/watch` — the one dynamic branch under `/fake-resistance`.
 *
 * Every sibling page under this section prerenders from a static, hand-
 * reviewed array (see `tests/fake-resistance-research.test.ts`'s own header
 * comment on why that material gets its own test file). This page is the
 * deliberate exception: it reads live `narrative_watch` publications through
 * `lib/publications.ts`, same as `/updates` and `/fact-check`
 * (`tests/live-surfaces.test.ts`), and it must be honest about the
 * difference — a same-day machine finding rendered with the same weight as a
 * reviewed case file would be exactly the kind of upgrade this desk does not
 * do. These tests hold that seam, and the two failure states `app/page.tsx`'s
 * own `featuredPublications()` call already established the pattern for: an
 * unreadable projection must never 500 the page, and must never be
 * indistinguishable from a genuinely empty feed.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { PublicPublication } from "@/server/contracts/publication";

const sourcedDetails = {
  exactClaim: "Israel's government has approved a plan for the mass forced expulsion of Gaza's population.",
  propagators: ["A verified account with a large following"],
  arenas: ["X"],
  trendDirection: "rising",
  israeliPosition: "No such plan has been approved; officials describe voluntary emigration only.",
  securityContext: "Circulating amid active fighting in the north.",
  supportingEvidenceIds: ["11111111-1111-4111-8111-111111111111"],
  contradictingEvidenceIds: ["22222222-2222-4222-8222-222222222222"],
  verificationState: "unresolved",
  knownUnknowns: ["No primary government document has been located."],
  evidenceBasis: "sourced",
} as const;

const sourcedWatch = {
  publicId: "narrative-watch-expulsion",
  kind: "analysis",
  section: "narrative_watch",
  title: "Reported claim: Israeli government plans mass forced expulsion from Gaza",
  summary: "Circulating claims are not corroborated by any located primary document.",
  body: "Body.",
  language: "en",
  publishedAt: "2026-09-03T09:00:00.000Z",
  updatedAt: "2026-09-03T09:00:00.000Z",
  autoPublishedAt: "2026-09-03T09:00:00.000Z",
  editorialTopic: "Information warfare",
  primaryActor: null,
  arena: "X",
  featuredIsraelStory: false,
  narrativeWatchDetails: sourcedDetails,
} as unknown as PublicPublication;

const analysisWatch = {
  ...sourcedWatch,
  publicId: "narrative-watch-analysis",
  title: "Analysis: claim that Israel targets journalists as policy",
  narrativeWatchDetails: {
    ...sourcedDetails,
    evidenceBasis: "analysis",
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
  },
} as unknown as PublicPublication;

const listBriefingPublications = vi.fn();

vi.mock("@/lib/publications", () => ({
  listBriefingPublications: (...args: unknown[]) => listBriefingPublications(...args),
}));

const { getNarrativeWatchFeed } = await import("@/lib/content/fake-resistance-watch");
const { default: WatchPage } = await import("@/app/fake-resistance/watch/page");
const { default: HubPage } = await import("@/app/fake-resistance/page");

async function render(node: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

describe("getNarrativeWatchFeed", () => {
  it("queries exactly the narrative_watch section with a bounded limit", async () => {
    listBriefingPublications.mockResolvedValue([]);
    await getNarrativeWatchFeed();
    expect(listBriefingPublications).toHaveBeenCalledWith("?section=narrative_watch&limit=25");
  });
});

describe("/fake-resistance/watch", () => {
  it("renders a sourced record's claim, trend, and status, without an evidence-basis line", async () => {
    listBriefingPublications.mockResolvedValue([sourcedWatch]);
    const markup = await render(await WatchPage());
    expect(markup).toContain("Israeli government plans mass forced expulsion from Gaza");
    expect(markup).toContain("Unresolved"); // VERIFICATION_STATES.unresolved.label
    expect(markup).toContain("Being tracked; no finding has been reached."); // its meaning
    /* The record's own hierarchy, and the reason this file exists: the
       assessment status is emitted before the claim it qualifies, so a
       circulating allegation is never read as a finding. Positional, not just
       present — `NarrativeRecord` puts the status block above the headline. */
    expect(markup.indexOf("Unresolved")).toBeLessThan(
      markup.indexOf("Israeli government plans mass forced expulsion from Gaza"),
    );
    expect(markup).toContain("Claim in circulation");
    expect(markup).not.toContain("no source cited");
  });

  it("marks an unsourced analysis record as the organisation's own analysis", async () => {
    listBriefingPublications.mockResolvedValue([analysisWatch]);
    const markup = await render(await WatchPage());
    expect(markup).toContain("Analysis");
    /* The disclosure itself is the invariant; its wording lives in
       `NarrativeRecord`. An unsourced record must never render without it. */
    expect(markup).toContain("Organisation analysis");
    expect(markup).toContain("no source cited");
  });

  it("shows a genuinely-empty state distinctly from an unavailable one", async () => {
    listBriefingPublications.mockResolvedValue([]);
    const markup = await render(await WatchPage());
    /* The empty read and the failed read are the two halves of one
       conditional in `watch/page.tsx`, and the whole point is that a reader
       can tell them apart. Asserted on the distinguishing clause rather than
       the full sentence, so a copy edit does not turn a real guard red. */
    expect(markup).toContain("No published monitoring records are available");
    expect(markup).not.toContain("could not be loaded");
  });

  /* The tripwire `tests/live-surfaces.test.ts` already established for
     `/updates`: an unreadable projection must render, not 500 — and the
     reader must be told it is unavailable, not shown an empty feed that
     looks the same as a quiet day. */
  it("degrades to an unavailable message rather than throwing when the read fails", async () => {
    listBriefingPublications.mockRejectedValue(new Error("no database"));
    const markup = await render(await WatchPage());
    /* The failed read renders watch/page.tsx:97 — "The published monitoring
       feed could not be loaded. Please try again later." — not the empty
       string (watch/page.tsx:98). */
    expect(markup).toContain("The published monitoring feed could not be loaded");
    expect(markup).not.toContain("No published monitoring records were returned for this read");
  });
});

describe("/fake-resistance hub — the live branch card", () => {
  it("shows the live count without touching the static case-file archive", async () => {
    listBriefingPublications.mockResolvedValue([sourcedWatch, analysisWatch]);
    const markup = await render(await HubPage());
    /* The hub states the live count in its masthead facts and links onward to
       the archive. It must read the live projection, never the hand-reviewed
       case files — conflating the two is the upgrade this desk does not do. */
    expect(markup).toContain("On the watch");
    expect(markup).toMatch(/On the watch<\/dt><dd>2</);
    expect(markup).toContain("/fake-resistance/watch");
    expect(markup).toContain("Published monitoring. Not a live scan.");
  });

  it("degrades to an unavailable count rather than 500ing the whole hub", async () => {
    listBriefingPublications.mockRejectedValue(new Error("no database"));
    const markup = await render(await HubPage());
    /* The hub must render rather than 500, and — the part that is easy to
       lose in a redesign — it must not print a count it does not have. Both
       reads settle to `[]` on failure, so an unguarded `items.length` would
       state "0" as fact beside a body that says the feed is unavailable. */
    expect(markup).toContain("Monitoring is temporarily unavailable");
    expect(markup).toMatch(/On the watch<\/dt><dd>Unavailable</);
    expect(markup).not.toMatch(/On the watch<\/dt><dd>0</);
  });
});
