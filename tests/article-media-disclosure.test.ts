import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import type { EditorialMedia, EditorialMediaRole } from "@/server/contracts/editorial-media";
import { INVESTIGATION_EXPLORER_SECTIONS } from "@/lib/publication-routing";
import {
  ROLE_DISCLOSURE,
  isManufacturedMedia,
  mediaDisclosure,
} from "@/components/content/MediaBlock";

/* Same seam as `tests/article-source-state.test.ts`: the page module reaches
   the database through `lib/publications`, so the projection is served from a
   hoisted holder and the whole server component is rendered for real. There is
   no jsdom here — the assertions read the emitted markup, which is exactly the
   thing that has to be right: a disclosure that only exists after hydration is
   not a disclosure. */
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

/* `next/image` rewrites `src` into a `/_next/image?url=…` query, so document
   order is asserted with `alt`, which reaches the markup verbatim. */
const ILLUSTRATION_ALT = "An abstract illustration of a broadcast tower.";
const PHOTOGRAPH_ALT = "A photograph of the damaged building, taken on the day.";

/** Long enough that a caption row trying to fit it on one line cannot. */
const LONG_CREDIT =
  "Composite illustration produced in-house by the Lions of Zion editorial desk " +
  "from reference material licensed under Creative Commons Attribution 4.0 " +
  "International, with additional treatment by the visual research unit, " +
  "reviewed by the standards editor on publication day";

function media(overrides: Partial<EditorialMedia> = {}): EditorialMedia {
  return {
    id: "asset-1",
    src: "/media/illustration.png",
    width: 1600,
    height: 1000,
    alt: ILLUSTRATION_ALT,
    credit: "Lions of Zion editorial desk",
    sourceUrl: "https://example.org/source",
    caption: "A stylised broadcast tower.",
    role: "editorial-illustration",
    focalPoint: { x: 62, y: 38 },
    sensitivity: "safe",
    rights: {
      status: "cleared",
      basis: "Produced in-house",
      reference: "internal:desk",
      clearedAt: "2026-09-01",
      surfaces: ["homepage", "article"],
    },
    ...overrides,
  } as EditorialMedia;
}

function publication(overrides: Partial<PublicPublicationDetail> = {}): PublicPublicationDetail {
  return {
    publicId: "a-claim-about-a-strike--x91kd",
    canonicalStoryId: null,
    kind: "brief",
    section: "daily_brief",
    title: "A headline that must be read before the picture",
    summary: "One paragraph of summary.",
    body: "The record's body text.",
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

/**
 * The whole point of VA-13, expressed as a string operation.
 *
 * `<details>` is the only collapsing container on the page, so "outside any
 * collapsed container" means: the disclosure appears in the markup, and it
 * does not appear between any `<details` and its matching `</details>`. The
 * check strips every details element and then looks again — if the line
 * survives the strip it was never inside one.
 */
function markupOutsideDetails(markup: string): string {
  return markup.replace(/<details\b[\s\S]*?<\/details>/g, "");
}

describe("VA-13 — media role predicates", () => {
  it("treats only the two manufactured roles as manufactured", () => {
    const roles: EditorialMediaRole[] = [
      "documentation",
      "portrait",
      "archival-context",
      "editorial-illustration",
      "safe-cover",
    ];
    const manufactured = roles.filter(isManufacturedMedia);
    expect(manufactured).toEqual(["editorial-illustration", "safe-cover"]);
  });

  it("gives every manufactured role a disclosure even when the record states none", () => {
    expect(mediaDisclosure({ role: "editorial-illustration" })).toBe(
      ROLE_DISCLOSURE["editorial-illustration"],
    );
    expect(mediaDisclosure({ role: "safe-cover" })).toBe(ROLE_DISCLOSURE["safe-cover"]);
    expect(mediaDisclosure({ role: "editorial-illustration" })).toBeTruthy();
    expect(mediaDisclosure({ role: "safe-cover" })).toBeTruthy();
  });

  it("prefers the record's own wording over the role default", () => {
    expect(
      mediaDisclosure({ role: "editorial-illustration", disclosure: "Context image — not incident documentation" }),
    ).toBe("Context image — not incident documentation");
  });

  it("invents no disclosure for a photograph that states none", () => {
    expect(mediaDisclosure({ role: "documentation" })).toBeUndefined();
    expect(mediaDisclosure({ role: "portrait" })).toBeUndefined();
    expect(mediaDisclosure({ role: "archival-context" })).toBeUndefined();
  });
});

describe("VA-13 — the disclosure is never collapsed", () => {
  it("renders an editorial illustration's disclosure outside any collapsed container", async () => {
    const markup = await render(
      publication({ section: "narrative_watch", narrativeWatchDetails: NARRATIVE_DETAILS, media: media() }),
    );
    const disclosure = ROLE_DISCLOSURE["editorial-illustration"]!;
    expect(markup).toContain(disclosure);
    expect(markup).toContain("<details");
    expect(markupOutsideDetails(markup)).toContain(disclosure);
  });

  it("keeps the disclosure visible when the credit string is very long", async () => {
    const markup = await render(
      publication({
        section: "narrative_watch",
        narrativeWatchDetails: NARRATIVE_DETAILS,
        media: media({ credit: LONG_CREDIT }),
      }),
    );
    const disclosure = ROLE_DISCLOSURE["editorial-illustration"]!;
    expect(markupOutsideDetails(markup)).toContain(disclosure);
    /* …and the long credit is the thing that moved, not the disclosure. */
    expect(markup).toContain(LONG_CREDIT);
    expect(markupOutsideDetails(markup)).not.toContain(LONG_CREDIT);
  });

  it("keeps a safe cover's disclosure outside the control too", async () => {
    const markup = await render(
      publication({
        section: "antisemitism",
        media: media({ role: "safe-cover", disclosure: undefined }),
      }),
    );
    expect(markupOutsideDetails(markup)).toContain(ROLE_DISCLOSURE["safe-cover"]!);
  });

  it("moves the credit, the image source and the rights state one press away", async () => {
    const markup = await render(
      publication({ section: "narrative_watch", narrativeWatchDetails: NARRATIVE_DETAILS, media: media() }),
    );
    expect(markup).toContain("Image credit and provenance");
    expect(markup).toContain("Lions of Zion editorial desk");
    expect(markup).toContain("https://example.org/source");
    expect(markup).toContain("Rights cleared");
    const visible = markupOutsideDetails(markup);
    expect(visible).not.toContain("Lions of Zion editorial desk");
    expect(visible).not.toContain("Rights cleared");
  });

  it("keeps the stored focal point driving object-position", async () => {
    const markup = await render(publication({ section: "news", media: media({ role: "documentation" }) }));
    expect(markup).toMatch(/object-position:\s*62%\s*38%/);
  });

  it("never reduces a caption to nothing but the collapsed control", async () => {
    /* A photograph whose record states neither a disclosure nor a caption has
       only its credit. Collapsing that would leave the words "Image credit and
       provenance" standing alone under a picture — an attribution taken away
       rather than tidied. It stays inline instead. */
    const markup = await render(
      publication({
        section: "news",
        media: media({ role: "documentation", caption: undefined, disclosure: undefined }),
      }),
    );
    expect(markup).toContain("Lions of Zion editorial desk");
    expect(markup).not.toContain("Image credit and provenance");
    expect(markupOutsideDetails(markup)).toContain("Lions of Zion editorial desk");
  });

  it("renders the text-led fallback rather than an empty frame when media is absent", async () => {
    const markup = await render(publication({ section: "news", media: null }));
    expect(markup).toContain("A headline that must be read before the picture");
    expect(markup).not.toContain("Image credit and provenance");
  });
});

describe("VA-13 — status and headline precede a made picture on a claim page", () => {
  it("puts the verdict and the exact claim above an editorial illustration", async () => {
    const markup = await render(
      publication({
        section: "narrative_watch",
        narrativeWatchDetails: NARRATIVE_DETAILS,
        media: media(),
      }),
    );
    const headline = markup.indexOf("A headline that must be read before the picture");
    const verdict = markup.indexOf("Refuted");
    const claim = markup.indexOf("A claim that the strike hit a hospital.");
    const image = markup.indexOf(ILLUSTRATION_ALT);
    expect(headline).toBeGreaterThan(-1);
    expect(verdict).toBeGreaterThan(-1);
    expect(image).toBeGreaterThan(-1);
    expect(headline).toBeLessThan(image);
    expect(verdict).toBeLessThan(image);
    expect(claim).toBeLessThan(image);
  });

  it("does not reorder a documentary photograph on the same claim page", async () => {
    const markup = await render(
      publication({
        section: "narrative_watch",
        narrativeWatchDetails: NARRATIVE_DETAILS,
        media: media({ role: "documentation", alt: PHOTOGRAPH_ALT, disclosure: undefined }),
      }),
    );
    const headline = markup.indexOf("A headline that must be read before the picture");
    const verdict = markup.indexOf("Refuted");
    const image = markup.indexOf(PHOTOGRAPH_ALT);
    /* The headline still leads — it always did — but the photograph keeps its
       place directly beneath it, above the publication facts. */
    expect(headline).toBeLessThan(image);
    expect(image).toBeLessThan(verdict);
  });

  it("does not reorder an illustration on a news record, which is not a claim page", async () => {
    const markup = await render(publication({ section: "news", media: media() }));
    const image = markup.indexOf(ILLUSTRATION_ALT);
    const facts = markup.indexOf("Publication facts");
    expect(image).toBeGreaterThan(-1);
    expect(image).toBeLessThan(facts);
    /* …and it still discloses itself, visibly, wherever it sits. */
    expect(markupOutsideDetails(markup)).toContain(ROLE_DISCLOSURE["editorial-illustration"]!);
  });

  it("reorders for every claim-page section the routing map derives, and no other", async () => {
    for (const section of INVESTIGATION_EXPLORER_SECTIONS) {
      const markup = await render(publication({ section, media: media() }));
      const image = markup.indexOf(ILLUSTRATION_ALT);
      const facts = markup.indexOf("Publication facts");
      expect(image, `${section} should defer its illustration`).toBeGreaterThan(facts);
    }
    for (const section of ["daily_brief", "israel_update", "news", "people", "innovation"] as const) {
      const markup = await render(publication({ section, media: media() }));
      const image = markup.indexOf(ILLUSTRATION_ALT);
      const facts = markup.indexOf("Publication facts");
      expect(image, `${section} should keep its illustration in place`).toBeLessThan(facts);
    }
  });
});
