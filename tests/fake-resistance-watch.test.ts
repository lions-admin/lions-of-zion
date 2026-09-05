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
    // SSR HTML-encodes the apostrophe in "government's"/"Gaza's" — match the
    // surrounding text rather than the raw claim string.
    expect(markup).toContain("approved a plan for the mass forced expulsion");
    expect(markup).toContain("Spreading further"); // TREND_LABELS.rising
    expect(markup).toContain("Unresolved"); // VERIFICATION_STATES.unresolved.label
    expect(markup).toContain("Reported claim");
    expect(markup).not.toContain("Organisation analysis, no source cited");
  });

  it("marks an unsourced analysis record as the organisation's own analysis", async () => {
    listBriefingPublications.mockResolvedValue([analysisWatch]);
    const markup = await render(await WatchPage());
    expect(markup).toContain("Analysis");
    expect(markup).toContain("Organisation analysis, no source cited");
  });

  it("shows a genuinely-empty state distinctly from an unavailable one", async () => {
    listBriefingPublications.mockResolvedValue([]);
    const markup = await render(await WatchPage());
    /* The empty read renders watch/page.tsx:98 — "No published monitoring
       records were returned for this read." The unavailable string is the
       other half of the same conditional (watch/page.tsx:97). */
    expect(markup).toContain("No published monitoring records were returned for this read");
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
    expect(markup).toContain("The daily watch");
    /* The hub's live-count span (fake-resistance/page.tsx:146) renders
       "{watchCount} published monitoring records". React inserts a comment
       marker between the interpolated count and the literal text that follows
       it ("2<!-- --> published monitoring records"), so match the two halves
       rather than the joined string. */
    expect(markup).toMatch(/>2<!-- -->\s*published monitoring records</);
    expect(markup).toContain("/fake-resistance/watch");
  });

  it("degrades to an unavailable count rather than 500ing the whole hub", async () => {
    listBriefingPublications.mockRejectedValue(new Error("no database"));
    const markup = await render(await HubPage());
    /* On a failed read the hub leaves `watchCount` null
       (fake-resistance/page.tsx:63-71), and the branch card says so —
       "Publication count unavailable" (page.tsx:146) — instead of rendering
       a fabricated numeric count. */
    expect(markup).toContain("Publication count unavailable");
    expect(markup).not.toMatch(/>\d+<!-- -->\s*published monitoring records</);
  });
});
