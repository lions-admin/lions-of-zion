import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicPublication } from "@/server/contracts/publication";

/**
 * VA-48.7 — one publication, one place on `/geopolitical-brief`.
 *
 * VA-04 measured the defect: a single record occupied three places on one page
 * — the lead, a timeline row and an archive row — so a reader met the same
 * reporting twice and could not tell whether that was one decision or two.
 * `LiveBriefEdition` fixed it by making the unfiltered archive the *remainder*:
 * what the edition above has not already presented.
 *
 * The filtered archive deliberately does not do that, and this file pins that
 * half too. A filtered archive is the complete answer to a query; hiding a
 * match merely because that record also leads the page would make a filter on
 * the lead's own actor return nothing, which is a bug and not tidiness. See the
 * comment above `shownAbove` in `components/briefs/LiveBriefHub.tsx`. These are
 * characterization tests of correct behaviour — if one fails, the component
 * regressed.
 */

const records: PublicPublication[] = [];

vi.mock("@/lib/publications", () => ({
  listBriefingPublications: vi.fn(async (query = "") => {
    const params = new URLSearchParams(query);
    const section = params.get("section");
    const actor = params.get("actor");
    return records.filter(
      (record) => record.section === section && (!actor || record.primaryActor === actor),
    );
  }),
}));

const { LiveBriefEdition } = await import("@/components/briefs/LiveBriefHub");

/** Newest first, so index 0 is the lead the page presents at the top. */
function publication(index: number, overrides: Partial<PublicPublication> = {}): PublicPublication {
  const publishedAt = `2026-09-${String(20 - index).padStart(2, "0")}T09:00:00.000Z`;
  return {
    publicId: `story-${String(index).padStart(2, "0")}`,
    canonicalStoryId: null,
    kind: "brief",
    section: "israel_update",
    /* Zero-padded so no title is a substring of another one: an occurrence
       count is the whole measurement here. */
    title: `Dispatch ${String(index).padStart(2, "0")}`,
    summary: null,
    body: "The account as filed.",
    language: "en",
    publishedAt,
    updatedAt: publishedAt,
    autoPublishedAt: null,
    editorialTopic: null,
    topicTags: [],
    primaryActor: "Northern Command",
    arena: null,
    featuredIsraelStory: false,
    narrativeWatchDetails: null,
    media: null,
    mediaDisposition: "text_led",
    ...overrides,
  };
}

/**
 * Fourteen story records plus a daily briefing. The edition presents eleven —
 * lead, four in the sidebar, six under "Earlier updates" — which leaves three
 * for the unfiltered archive and makes the exclusion observable rather than
 * vacuous.
 */
function seed() {
  records.length = 0;
  for (let index = 0; index < 14; index += 1) records.push(publication(index));
  records.push(publication(14, {
    publicId: "briefing-of-the-day",
    section: "daily_brief",
    title: "The daily briefing itself",
  }));
}

const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

async function render(filters: Parameters<typeof LiveBriefEdition>[0]["filters"]) {
  seed();
  return renderToStaticMarkup(await LiveBriefEdition({ filters }));
}

/** Everything from the archive `<details>` onwards. */
function archiveSlice(html: string): string {
  const at = html.indexOf('id="news-archive"');
  expect(at).toBeGreaterThan(-1);
  return html.slice(at);
}

describe("the news desk renders one publication in exactly one place", () => {
  it("does not repeat any record when no filter is set", async () => {
    const html = await render({});

    for (const record of records) {
      expect(
        occurrences(html, record.title),
        `${record.title} is rendered more than once`,
      ).toBe(1);
    }
  });

  it("keeps the lead out of the unfiltered archive and still lists the remainder", async () => {
    const html = await render({});
    const archive = archiveSlice(html);

    /* The eleven the edition presented are absent from the archive; the three
       it did not are present, so the exclusion is a remainder and not a purge. */
    for (const record of records.slice(0, 11)) expect(archive).not.toContain(record.title);
    for (const record of records.slice(11, 14)) expect(archive).toContain(record.title);
    expect(archive).not.toContain("The daily briefing itself");
    expect(archive).toContain("Reporting already presented above is not repeated here.");
  });

  it("still shows a match in the filtered archive when that record also leads the page", async () => {
    /* One actor, carried by the lead and by one record deep in the archive. A
       filtered archive that excluded what the edition shows would answer this
       query with a single row and silently drop the lead — the record the
       reader is most likely to have been filtering for. */
    seed();
    records[0] = publication(0, { primaryActor: "Ministry of Defence" });
    records[12] = publication(12, { primaryActor: "Ministry of Defence" });

    const html = renderToStaticMarkup(
      await LiveBriefEdition({ filters: { actor: "Ministry of Defence" } }),
    );
    const archive = archiveSlice(html);

    expect(archive).toContain("Dispatch 00");
    expect(archive).toContain("Dispatch 12");
    /* Twice on the page in total: once as the lead, once as the answer to the
       filter. That is deliberate, and §1b of the VA-48 plan says so. */
    expect(occurrences(html, "Dispatch 00")).toBe(2);
    expect(archive).toContain("Every matching record is listed here, including any also shown above.");
  });
});
