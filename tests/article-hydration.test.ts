import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { PublicPublicationDetail } from "@/server/contracts/publication";

/* VA-43. React #418 on `/articles/israel-launches-fresh-attacks-across-
   southern-le-86i2j`: the article page is a Server Component, but
   `InvestigationExplorer` is `'use client'`, so its markup is produced twice —
   once in the server's process (UTC on Vercel) and once in the reader's
   browser (Asia/Jerusalem for this site's audience). Any formatter that reads
   the ambient zone therefore diverges across hydration.

   The suite proves determinism the only way that means anything here: render
   the real page twice under two different `process.env.TZ` values and require
   byte-identical markup. A formatter that regains an ambient zone fails this
   without anyone having to guess which string it broke. */

const { served } = vi.hoisted(() => ({ served: { record: null as unknown } }));
vi.mock("@/lib/publications", () => ({
  /* The article page reads its desk to build "Continue the record" (VA-50).
     An empty pool is the honest fixture here: these suites are about the
     record itself, and an empty result renders the hub link alone. */
  listBriefingPublications: async () => [],
  getPublicPublication: vi.fn(async () => served.record),
  isMissingPublication: () => false,
}));

const ArticlePage = (await import("@/app/articles/[publicId]/page")).default;

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** The live record VA-04 reported, reduced to the fields that decide markup.
 *  Its one source is stamped 21:05 UTC on 31 August — 00:05 on 1 September in
 *  Asia/Jerusalem. The date therefore *changes* between the two zones, which
 *  is what made this reproducible at all rather than a latent bug. */
function reportedRecord(
  overrides: Partial<PublicPublicationDetail> = {},
): PublicPublicationDetail {
  return {
    publicId: "israel-launches-fresh-attacks-across-southern-le-86i2j",
    canonicalStoryId: null,
    kind: "news_update",
    section: "narrative_watch",
    title: "Israel launches fresh attacks across southern Lebanon",
    summary: "Middle East Eye reports heavy strikes across southern Lebanon.",
    body: "The agency reported strikes across several Nabatieh-district villages.",
    language: "en",
    publishedAt: "2026-09-01T10:30:39.453Z",
    updatedAt: "2026-09-01T10:30:38.782Z",
    autoPublishedAt: "2026-09-01T10:30:39.453Z",
    editorialTopic: "conflict_reporting",
    topicTags: [],
    primaryActor: "israel_as_reported",
    arena: "regional_media",
    featuredIsraelStory: false,
    narrativeWatchDetails: {
      exactClaim: "That Israel used white phosphorus munitions in Nabatieh-district villages.",
      propagators: ["Middle East Eye", "Lebanon's National News Agency (as cited)"],
      arenas: ["regional media", "Lebanese state media"],
      trendDirection: "unclear",
      israeliPosition: null,
      securityContext: null,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      /* The live record's own values, so the fixture exercises the branches
         VA-04 actually loaded rather than a nearby shape. */
      verificationState: "unresolved",
      knownUnknowns: ["Independent confirmation of strikes and munition type"],
      evidenceBasis: "sourced",
    },
    media: null,
    sources: [
      {
        title: "Israel launches fresh attacks across southern Lebanon",
        publisher: "Middle East Eye",
        url: "https://www.middleeasteye.net/news/example",
        /* 21:05 UTC — the previous calendar day in UTC, the next one in
           Asia/Jerusalem. This exact stamp is what VA-04 hit. */
        publishedAt: "2026-08-31T21:05:32.000Z",
      },
    ],
    narratives: [],
    passages: [],
    relatedArticles: [],
    corrections: [],
    ...overrides,
  } as PublicPublicationDetail;
}

async function render(record: PublicPublicationDetail): Promise<string> {
  served.record = record;
  const stream = await renderToReadableStream(
    await ArticlePage({ params: Promise.resolve({ publicId: record.publicId }) }),
  );
  await stream.allReady;
  return await new Response(stream).text();
}

/** Render the same record under a named zone. `Intl` caches a resolved default
 *  per process, so the cache is dropped between passes — without this the
 *  second render silently reuses the first zone and the test passes for the
 *  wrong reason. */
async function renderUnder(tz: string, record: PublicPublicationDetail): Promise<string> {
  process.env.TZ = tz;
  return await render(record);
}

describe("article render is timezone-independent (VA-43)", () => {
  it("the ambient zone actually differs, so the comparison below has teeth", () => {
    const stamp = new Date("2026-08-31T21:05:32.000Z");
    expect(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(stamp)).toBe(
      "Aug 31, 2026",
    );
    expect(
      new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Jerusalem" }).format(stamp),
    ).toBe("Sep 1, 2026");
  });

  it("renders byte-identical markup under UTC and Asia/Jerusalem", async () => {
    const record = reportedRecord();
    const utc = await renderUnder("UTC", record);
    const jerusalem = await renderUnder("Asia/Jerusalem", record);
    const honolulu = await renderUnder("Pacific/Honolulu", record);
    expect(jerusalem).toBe(utc);
    expect(honolulu).toBe(utc);
  });

  it("dates the explorer's source the same way the source stack does", async () => {
    const markup = await renderUnder("Asia/Jerusalem", reportedRecord());
    expect(markup).toContain("evidence-explorer-title");

    /* One source, one date. The explorer used to say "Sep 1, 2026" while
       "Public sources" a few centimetres below said "Aug 31, 2026". Scoped to
       the byline spans on purpose: the article's *own* `publishedAt` is
       deliberately shown in Asia/Jerusalem and does read "Sep 1, 2026", so a
       whole-document search for that string would fail for the wrong reason. */
    const bylines = [
      ...markup.matchAll(/Middle East Eye(?:<!-- -->)? · ([A-Z][a-z]{2} \d{1,2}, \d{4})/g),
    ].map((match) => match[1]!);
    /* Two explorer stages carry the source list (Origin and Evidence) and the
       "Public sources" stack carries it once. A zero here would mean the
       markup shape moved and the assertion stopped testing anything. */
    expect(bylines).toHaveLength(3);
    expect(new Set(bylines)).toEqual(new Set(["Aug 31, 2026"]));
  });

  it("stays deterministic for a source with no date, and for a record with none", async () => {
    const undated = reportedRecord({
      sources: [
        {
          title: "Israel launches fresh attacks across southern Lebanon",
          publisher: "Middle East Eye",
          url: "https://www.middleeasteye.net/news/example",
          publishedAt: null,
        },
      ],
    } as Partial<PublicPublicationDetail>);
    expect(await renderUnder("Asia/Jerusalem", undated)).toBe(await renderUnder("UTC", undated));

    const sourceless = reportedRecord({ sources: [] });
    expect(await renderUnder("Asia/Jerusalem", sourceless)).toBe(await renderUnder("UTC", sourceless));
  });

  it("keeps a routine article without an explorer deterministic too", async () => {
    const routine = reportedRecord({
      section: "news",
      kind: "brief",
      narrativeWatchDetails: null,
      title: "Ministry of Defense announcements",
    });
    expect(await renderUnder("Asia/Jerusalem", routine)).toBe(await renderUnder("UTC", routine));
  });
});

describe("article markup nests legally (VA-43)", () => {
  /** A `<p>` the browser's parser would silently close early is the other
   *  classic #418: the client's DOM no longer matches the string the server
   *  sent. Scan the rendered `<p>` runs for anything the HTML parser treats as
   *  an implicit close. */
  function paragraphsContainingBlockElements(markup: string): string[] {
    const found: string[] = [];
    for (const match of markup.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
      if (/<(?:div|p|ul|ol|li|section|figure|figcaption|h[1-6]|details|summary|dl|dt|dd|table|main|article|header|footer|nav|blockquote|form|hr|pre)\b/i.test(match[1]!)) {
        found.push(match[0].slice(0, 200));
      }
    }
    return found;
  }

  it("puts no block-level element inside a paragraph", async () => {
    expect(paragraphsContainingBlockElements(await render(reportedRecord()))).toEqual([]);
  });

  it("puts no block-level element inside a paragraph of a passage-driven article", async () => {
    const withPassages = reportedRecord({
      passages: [
        {
          position: 1,
          text: "The agency reported strikes across several villages.",
          claim: {
            publicId: "claim-1",
            title: "That white phosphorus was used",
            assessment: "contested",
          },
          sources: [
            {
              title: "Israel launches fresh attacks across southern Lebanon",
              publisher: "Middle East Eye",
              url: "https://www.middleeasteye.net/news/example",
            },
          ],
        },
      ],
    } as Partial<PublicPublicationDetail>);
    expect(paragraphsContainingBlockElements(await render(withPassages))).toEqual([]);
  });
});
