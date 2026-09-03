/**
 * `/updates` and `/fact-check` — the two reading surfaces over the published
 * record.
 *
 * These assert the honesty properties as tests rather than as comments, because
 * comments do not fail. The reads behind both pages go through
 * `unstable_cache(..., { revalidate: 300 })`, so the feed is up to five minutes
 * stale, and the pressure on a page called "Updates" is to imply otherwise. The
 * first test here is a tripwire on exactly that: a pulsing "LIVE", a relative
 * stamp, a "just now" — any of them fails the build.
 *
 * Content assertions render the components directly rather than the routes.
 * `DocPage` mounts `ScanBackdrop`, whose corpus genuinely contains strings like
 * "LIVE HASHTAG: #GazaUnderAttack" — real monitored material, and nothing to do
 * with these pages. Matching against the whole route would either fail on the
 * backdrop or force the tripwire to be loosened until it caught nothing. Route
 * tests below cover the wiring the components cannot: query building, the
 * cursor, and the two failure states.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import { UpdateFeed } from "@/components/live";
import { FactCheckDesk } from "@/components/factcheck";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";

const details = {
  exactClaim: "A hospital in the north was struck by an Israeli airstrike on Tuesday.",
  propagators: ["An account with 400,000 followers", "Two regional outlets"],
  arenas: ["X", "Telegram"],
  trendDirection: "rising",
  israeliPosition: "The IDF states the strike targeted a launch site 300 metres away.",
  securityContext: "Launches from the district were recorded the same morning.",
  supportingEvidenceIds: ["11111111-1111-4111-8111-111111111111"],
  contradictingEvidenceIds: [
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ],
  verificationState: "misleading",
  knownUnknowns: ["The exact time of the strike is not established."],
  evidenceBasis: "sourced",
} as const;

const watch = {
  publicId: "narrative-watch-hospital",
  kind: "analysis",
  section: "narrative_watch",
  title: "Reported claim: a hospital was struck",
  summary: "The footage is real and predates the strike it is offered as evidence of.",
  body: "Body.",
  language: "en",
  publishedAt: "2026-09-02T11:20:00.000Z",
  updatedAt: "2026-09-02T11:20:00.000Z",
  /* Machine-published: the trigger in migration 0031 requires all twelve named
     quality checks to have passed before this column may be set. */
  autoPublishedAt: "2026-09-02T11:20:00.000Z",
  editorialTopic: null,
  primaryActor: null,
  arena: "X",
  featuredIsraelStory: false,
  narrativeWatchDetails: details,
} as unknown as PublicPublication;

const brief = {
  ...watch,
  publicId: "daily-brief-2026-09-01",
  kind: "brief",
  section: "daily_brief",
  title: "Daily Brief",
  summary: "The regional picture.",
  publishedAt: "2026-09-01T05:00:00.000Z",
  updatedAt: "2026-09-01T06:30:00.000Z",
  /* Editor-published: `approved_by` must be a human who is not the author. */
  autoPublishedAt: null,
  arena: null,
  narrativeWatchDetails: null,
} as unknown as PublicPublication;

const detail = {
  ...watch,
  sources: [],
  narratives: [],
  relatedArticles: [],
  corrections: [
    { version: 2, changedAt: "2026-09-02T14:00:00.000Z", summary: "Corrected the district name." },
  ],
  passages: [
    {
      position: 1,
      text: "The footage circulating with the claim was published eleven months earlier.",
      claim: {
        publicId: "claim-1",
        title: "The footage is contemporaneous",
        assessment: "out_of_context",
      },
      sources: [{ title: "Original upload", publisher: "Reuters", url: "https://example.org/a" }],
    },
    { position: 2, text: "No independent record of a strike has been located.", claim: null, sources: [] },
  ],
} as unknown as PublicPublicationDetail;

const listBriefingPublications = vi.fn();
const getPublicPublication = vi.fn();

vi.mock("@/lib/publications", () => ({
  listBriefingPublications: (...args: unknown[]) => listBriefingPublications(...args),
  getPublicPublication: (...args: unknown[]) => getPublicPublication(...args),
  isMissingPublication: () => false,
}));

const { default: UpdatesPage } = await import("@/app/updates/page");
const { default: FactCheckPage } = await import("@/app/fact-check/page");

async function render(node: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

/**
 * React splits a text node either side of an interpolated expression with an
 * empty comment, so `At most every {minutes} minutes` streams as
 * `At most every <!-- -->5<!-- --> minutes`. Sentences a reader sees as one
 * string are asserted against this, not against the raw stream.
 */
const prose = (markup: string) => markup.replaceAll("<!-- -->", "");

const feed = (props: Partial<Parameters<typeof UpdateFeed>[0]> = {}) =>
  render(
    UpdateFeed({
      entries: [watch, brief],
      paged: false,
      unavailable: false,
      ...props,
    }) as React.ReactElement,
  );

const desk = (records: PublicPublication[], map: Map<string, PublicPublicationDetail>) =>
  render(
    FactCheckDesk({ records, details: map, unavailable: false }) as React.ReactElement,
  );

function detailsIsOpen(markup: string, publicId: string): boolean {
  const id = `id="claim-${publicId}"`;
  const at = markup.indexOf(id);
  if (at < 0) return false;
  const start = markup.lastIndexOf("<details", at);
  const end = markup.indexOf(">", at);
  if (start < 0 || end < 0) return false;
  return /\sopen(?:="[^"]*")?/.test(markup.slice(start, end + 1));
}

const withDetail = (record: PublicPublicationDetail) =>
  new Map([[record.publicId, record]]);

describe("the updates feed", () => {
  it("never implies liveness it does not have", async () => {
    const markup = await feed();

    /* The five ways this page could lie. */
    expect(markup).not.toMatch(/\bLIVE\b/);
    expect(markup).not.toMatch(/just now/i);
    expect(markup).not.toMatch(/\b(seconds?|minutes?|hours?|days?) ago\b/i);
    expect(markup).not.toMatch(/real[- ]?time wire feed/i);

    /* And the true statement it makes instead. */
    expect(prose(markup)).toMatch(/not a realtime wire/i);
    expect(prose(markup)).toMatch(/At most every 5 minutes/);
  });

  it("marks whether an entry was published by the machine or by an editor", async () => {
    const markup = await feed();
    expect(markup).toContain("Published automatically");
    expect(markup).toContain("Published by an editor");
  });

  it("carries an absolute stamp and a machine-readable datetime for every entry", async () => {
    const markup = await feed();
    expect(markup).toContain(`dateTime="${watch.publishedAt}"`);
    expect(markup).toContain(`dateTime="${brief.publishedAt}"`);
    /* 11:20 UTC is 14:20 in Jerusalem. The feed states its timezone and uses
       it, rather than rendering in whatever the server happens to be set to. */
    expect(markup).toContain("14:20");
    expect(markup).toMatch(/Jerusalem/);
  });

  it("shows a revision only when the record was actually revised", async () => {
    const markup = await feed();
    /* `brief` was updated 90 minutes after publication; `watch` was not. */
    expect(markup).toContain("Revised");
    expect(markup.match(/Revised/g)).toHaveLength(1);
  });

  it("distinguishes an empty record from an unreadable one", async () => {
    const empty = await feed({ entries: [] });
    expect(empty).toContain("Nothing has been published yet");

    const broken = await feed({ entries: [], unavailable: true });
    expect(broken).toContain("could not be read");
    expect(broken).not.toContain("Nothing has been published yet");
  });

  it("groups by Jerusalem day and anchors each group", async () => {
    const markup = await feed();
    expect(markup).toContain('id="day-2026-09-02"');
    expect(markup).toContain('id="day-2026-09-01"');
  });
});

describe("the fact-check desk", () => {
  it("quotes the claim verbatim and states the verdict without upgrading it", async () => {
    const markup = await desk([watch], withDetail(detail));
    expect(markup).toContain(details.exactClaim);
    expect(markup).toContain("Misleading");
    /* `verificationState` is a six-value enum belonging to a narrative and is
       deliberately not rendered through `VerificationBadge`, which is for the
       nine-value `AssessmentValue` of an information item. A passage's own
       claim assessment does use the badge — hence "Out of context". */
    expect(markup).toContain("Out of context");
  });

  it("draws the evidence chain and marks the statement that cites nothing", async () => {
    const markup = await desk([watch], withDetail(detail));
    expect(markup).toContain("Reuters");
    expect(markup).toContain("No source is attached to this statement.");
    expect(markup).toContain('data-cited="false"');
    expect(markup).toContain('data-cited="true"');
  });

  it("counts evidence held on file without pretending to show it", async () => {
    const markup = await desk([watch], withDetail(detail));
    expect(prose(markup)).toMatch(/1 supporting evidence record is held on file/);
    expect(prose(markup)).toMatch(/2 contradicting evidence records are held on file/);
    expect(markup).toContain("not public");
    expect(markup).toContain("What this page does not show");
  });

  it("discloses an analysis record as citing nothing, all-or-nothing", async () => {
    const analysisDetails = { ...details, evidenceBasis: "analysis" };
    const record = { ...watch, narrativeWatchDetails: analysisDetails } as unknown as PublicPublication;
    const full = {
      ...detail,
      narrativeWatchDetails: analysisDetails,
      passages: [],
    } as unknown as PublicPublicationDetail;

    const markup = await desk([record], withDetail(full));
    expect(markup).toMatch(/cites no documentary source/i);
    expect(markup).toContain("Basis: our own analysis, citing no source.");
    /* A record that cites nothing must not print a column of "no source"
       failures — the absence is the disclosure, not a malfunction. */
    expect(markup).not.toContain("No source is attached to this statement.");
  });

  it("puts verdict, claim, evidence counts and rationale in the collapsed summary", async () => {
    const markup = await desk([watch], withDetail(detail));
    const summaryAt = markup.indexOf("<summary");
    const summaryEnd = markup.indexOf("</summary>");
    expect(summaryAt).toBeGreaterThan(-1);
    const collapsed = prose(markup.slice(summaryAt, summaryEnd));
    expect(collapsed).toContain("Misleading");
    expect(collapsed).toContain(details.exactClaim);
    expect(collapsed).toContain("1 supporting");
    expect(collapsed).toContain("2 contradicting");
    expect(collapsed).toContain("Real material arranged to leave a false impression.");
    expect(markup.slice(summaryAt, summaryEnd)).toContain(`dateTime="${watch.publishedAt}"`);
    expect(markup).toContain("<details");
    expect(markup).toContain('id="claim-narrative-watch-hospital"');
  });

  it("walks the evidence path in document order, labelled, without a connector as the only cue", async () => {
    const markup = await desk([watch], withDetail(detail));
    const sources = markup.indexOf("Sources");
    const contradictions = markup.indexOf("Contradictions");
    const unknowns = markup.indexOf("Unknowns");
    const assessment = markup.indexOf("Assessment");
    expect(sources).toBeGreaterThan(-1);
    expect(sources).toBeLessThan(contradictions);
    expect(contradictions).toBeLessThan(unknowns);
    expect(unknowns).toBeLessThan(assessment);
    expect(prose(markup)).toContain("Source count:");
    expect(prose(markup)).toContain("Statement 1");
    expect(markup).toContain("Cited");
    expect(markup).toContain("No source attached");
    expect(markup).toContain("Link to this check");
    expect(markup).toContain("/fact-check?claim=narrative-watch-hospital");
  });

  it("opens the addressed claim and leaves the first row closed", async () => {
    const second = { ...watch, publicId: "second-claim" } as unknown as PublicPublication;
    const secondDetail = { ...detail, publicId: "second-claim" } as unknown as PublicPublicationDetail;
    const markup = await render(
      FactCheckDesk({
        records: [watch, second],
        details: new Map([
          [watch.publicId, detail],
          [second.publicId, secondDetail],
        ]),
        unavailable: false,
        openClaimId: "second-claim",
      }) as React.ReactElement,
    );
    expect(detailsIsOpen(markup, "second-claim")).toBe(true);
    expect(detailsIsOpen(markup, watch.publicId)).toBe(false);
  });

  it("states the empty desk without inventing a worked example", async () => {
    const markup = await desk([], new Map());
    expect(markup).toContain("No claim has been checked and published yet.");
  });

  it("does not report an empty desk when the projection cannot be read", async () => {
    const markup = await render(
      FactCheckDesk({ records: [], details: new Map(), unavailable: true }) as React.ReactElement,
    );
    expect(markup).toContain("could not be read");
    expect(markup).not.toContain("No claim has been checked and published yet.");
  });
});

describe("/updates route wiring", () => {
  const updates = (search: Record<string, string> = {}) =>
    UpdatesPage({ searchParams: Promise.resolve(search) }).then(render);

  it("offers an older page only when the page came back exactly full", async () => {
    listBriefingPublications.mockResolvedValue([watch, brief]);
    expect(await updates()).not.toContain("Older entries");

    const full = Array.from({ length: 25 }, (_, index) => ({
      ...brief,
      publicId: `entry-${index}`,
      publishedAt: new Date(Date.UTC(2026, 8, 2, 12, 0, 0) - index * 3_600_000).toISOString(),
    }));
    listBriefingPublications.mockResolvedValue(full);
    const markup = await updates();
    expect(markup).toContain("Older entries");
    /* The cursor is the API's own shape: `<publishedAt ISO>|<publicId>`. */
    expect(markup).toContain(encodeURIComponent(`${full[24]!.publishedAt}|entry-24`));
  });

  it("passes the section filter through to the query and keeps it on the links", async () => {
    listBriefingPublications.mockResolvedValue([watch]);
    const markup = await updates({ section: "narrative_watch", cursor: "x|y" });
    expect(listBriefingPublications).toHaveBeenCalledWith(
      "limit=25&section=narrative_watch&cursor=x%7Cy",
    );
    expect(markup).toContain("Newest entries");
    expect(markup).toContain("/updates?section=narrative_watch");
  });

  it("ignores a section value that is not one of the four", async () => {
    listBriefingPublications.mockResolvedValue([]);
    await updates({ section: "not_a_section" });
    expect(listBriefingPublications).toHaveBeenCalledWith("limit=25");
  });

  it("reports an unreadable projection rather than an empty archive", async () => {
    listBriefingPublications.mockRejectedValue(new Error("no database"));
    const markup = await updates();
    expect(markup).toContain("could not be read");
  });
});

describe("/fact-check route wiring", () => {
  const page = (search: Record<string, string> = {}) =>
    FactCheckPage({ searchParams: Promise.resolve(search) }).then(render);

  it("opens the first check when no claim is in the query", async () => {
    listBriefingPublications.mockResolvedValue([watch]);
    getPublicPublication.mockResolvedValue(detail);
    const markup = await page();
    expect(detailsIsOpen(markup, watch.publicId)).toBe(true);
  });

  it("opens the matching claim from ?claim= and restores that after a server render", async () => {
    const second = { ...watch, publicId: "second-claim" };
    const secondDetail = { ...detail, publicId: "second-claim" };
    listBriefingPublications.mockResolvedValue([watch, second]);
    getPublicPublication.mockImplementation(async (id: string) =>
      id === "second-claim" ? secondDetail : detail,
    );
    const markup = await page({ claim: "second-claim" });
    expect(detailsIsOpen(markup, "second-claim")).toBe(true);
    expect(detailsIsOpen(markup, watch.publicId)).toBe(false);
    expect(markup).toContain('id="claim-second-claim"');
  });

  it("fetches the addressed claim even when it sits past the detail budget", async () => {
    const records = Array.from({ length: 10 }, (_, index) => ({
      ...watch,
      publicId: `claim-${index}`,
    }));
    listBriefingPublications.mockResolvedValue(records);
    getPublicPublication.mockReset();
    getPublicPublication.mockImplementation(async (id: string) => ({
      ...detail,
      publicId: id,
    }));
    await page({ claim: "claim-9" });
    const ids = getPublicPublication.mock.calls.map((call) => call[0]);
    expect(ids).toContain("claim-9");
    expect(ids).toHaveLength(9);
  });

  it("reports an unreadable projection rather than an empty desk", async () => {
    listBriefingPublications.mockRejectedValue(new Error("no database"));
    const markup = await page();
    expect(markup).toContain("could not be read");
    expect(markup).not.toContain("No claim has been checked and published yet.");
  });
});
