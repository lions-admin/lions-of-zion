/**
 * The News & Analysis desk: what a reader without JavaScript gets, and what
 * counts as one story.
 *
 * Two defects are pinned here.
 *
 * **VA-42.** `/geopolitical-brief` served a reader with scripting off 2,871
 * characters of navigation chrome and zero article links, measured on
 * Production on 2026-09-07. `LiveBriefEdition` sat inside a `<Suspense>`, and
 * React streams a boundary's contents into `<div hidden id="S:…">` that only
 * client script reveals. The boundary is gone; these tests are what stops it
 * coming back.
 *
 * **VA-19 / VA-04.** One story was presented as several editorial decisions —
 * VA-04 measured the same record occupying the lead *and* the archive on one
 * page. The archive's identity is now the story rather than the row, keyed on
 * an exact shared `canonicalStoryId` and on nothing else. The null case is the
 * one that breaks: a record with no canonical id must always stand alone, and
 * two such records must never be grouped with each other.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToReadableStream } from "react-dom/server";
import type { ReactNode } from "react";
import type { PublicPublication } from "@/server/contracts/publication";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/publications", () => ({ listBriefingPublications: read }));
/* The shell and the filter form are mocked so that any streaming hole left in
   the output belongs to the edition — which is the thing under test — rather
   than to a component another desk owns. */
vi.mock("@/components/site/EditorialShell", () => ({
  EditorialShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/briefs/BriefFilters", () => ({
  BriefFilters: () => <form aria-label="Filter archive" />,
}));

import {
  LiveBriefHub,
  LiveBriefEdition,
  groupByCanonicalStory,
  hasPublishedUpdate,
  emptyArchiveState,
  collapseExactDuplicates,
} from "@/components/briefs/LiveBriefHub";

function story(overrides: Partial<PublicPublication> & { publicId: string }): PublicPublication {
  return {
    canonicalStoryId: null,
    kind: "brief",
    section: "israel_update",
    title: overrides.publicId,
    summary: "Published context.",
    body: "Body",
    language: "en",
    publishedAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    autoPublishedAt: null,
    editorialTopic: null,
    primaryActor: null,
    arena: null,
    featuredIsraelStory: false,
    narrativeWatchDetails: null,
    media: null,
    topicTags: [],
    ...overrides,
  } as PublicPublication;
}

/** A run of stories, newest first, as the desk's read returns them. */
function feed(count: number, section: PublicPublication["section"] = "israel_update"): PublicPublication[] {
  return Array.from({ length: count }, (_, i) =>
    story({
      publicId: `story-${String(i).padStart(2, "0")}`,
      title: `Story ${i}`,
      section,
      publishedAt: new Date(Date.UTC(2026, 8, 5, 23 - i)).toISOString(),
    }),
  );
}

async function html(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node as React.ReactElement, { onError: () => {} });
  await stream.allReady;
  return new Response(stream).text();
}

const articleLinks = (output: string) => output.match(/href="\/articles\/[^"]+"/g) ?? [];
const occurrences = (output: string, publicId: string) =>
  (output.match(new RegExp(`href="/articles/${publicId}"`, "g")) ?? []).length;

beforeEach(() => {
  read.mockReset();
});

/* ── VA-42: the records reach a reader with no JavaScript ─────────────────── */

describe("VA-42: the news desk renders records without JavaScript", () => {
  it("puts published records in the initial HTML, not in a streaming hole", async () => {
    read.mockImplementation(async (query: string) =>
      new URLSearchParams(query).get("section") === "israel_update" ? feed(9) : [],
    );

    const output = await html(LiveBriefHub({ filters: {} }));

    /* The acceptance criterion, stated the way it was measured on Production:
       count the article links a reader can actually see. */
    expect(articleLinks(output).length).toBeGreaterThanOrEqual(9);
    /* And they are visible, not merely present. A boundary's contents are
       emitted inside `<div hidden id="S:…">` for an inline `$RC` script to
       move; with scripting off that div never opens. There must be none. */
    expect(output).not.toContain('<div hidden id="S:');
    expect(output).not.toContain("$RC");
  });

  it("renders the unavailable state itself outside any boundary", async () => {
    /* A failed read is content too. If the status only ever arrived inside a
       hole, a reader without JavaScript would be told nothing at all — which
       is what the route did before VA-42, on every outcome. */
    read.mockImplementation(async () => {
      throw new Error("unavailable");
    });

    const output = await html(LiveBriefHub({ filters: {} }));

    expect(output).toContain("News could not be loaded.");
    expect(output).not.toContain('<div hidden id="S:');
  });

  it("keeps the desk out of a Suspense boundary at the source", async () => {
    /* The cheap tripwire, in the spirit of `tests/no-js-invariant.test.ts`.
       The boundary was reintroduced once already — the file's own comment
       records that an earlier fix pulled the chrome out of it and left the
       records behind — so the shape is pinned, not just the behaviour. */
    const source = await readFile(
      path.join(process.cwd(), "components/briefs/LiveBriefHub.tsx"),
      "utf8",
    );
    /* Matched on the import and on the JSX, not on the word: the file's own
       comment explains at length why the boundary was removed, and a check
       that trips on the explanation would be deleted rather than heeded. */
    expect(source).not.toMatch(/^import\s*\{[^}]*\bSuspense\b/m);
    expect(source).not.toMatch(/<Suspense[\s/>]/);
    expect(source).toContain("export function LiveBriefHub");
    expect(source).not.toContain("export async function LiveBriefHub");
  });
});

/* ── VA-04: one record occupies one place ─────────────────────────────────── */

describe("VA-04: one record, one place on the page", () => {
  it("does not repeat edition records in the unfiltered archive", async () => {
    read.mockImplementation(async (query: string) =>
      new URLSearchParams(query).get("section") === "israel_update" ? feed(14) : [],
    );

    const output = await html(await LiveBriefEdition({ filters: {} }));

    /* The lead carries two links to one record by design — the headline and
       the "Read the story" control — and that is one placement, not two. What
       must not happen is a third link from an archive row. */
    expect(occurrences(output, "story-00")).toBe(2);
    /* A timeline entry and an "Earlier updates" row are one link each. */
    expect(occurrences(output, "story-02")).toBe(1);
    expect(occurrences(output, "story-07")).toBe(1);
    /* Everything past the eleventh is archive-only, and still reachable. */
    expect(occurrences(output, "story-12")).toBe(1);
  });

  it("still returns a record the filters match even when it also leads the page", async () => {
    /* The archive under an active filter is the answer to a query. Hiding a
       match because that record also leads the page would make a filter on the
       lead's own actor return nothing. */
    read.mockImplementation(async () => feed(3));

    const output = await html(await LiveBriefEdition({ filters: { actor: "IDF" } }));

    expect(output).toContain("Matching reports");
    expect(occurrences(output, "story-00")).toBeGreaterThanOrEqual(3);
  });

  it("says nothing further is to show rather than nothing is published", async () => {
    /* Excluding what the edition already showed creates a third reason for an
       empty archive, distinct from an empty desk and from an outage. */
    read.mockImplementation(async (query: string) =>
      new URLSearchParams(query).get("section") === "israel_update" ? feed(3) : [],
    );

    const output = await html(await LiveBriefEdition({ filters: {} }));

    expect(output).toContain("No further reports to show.");
    expect(output).not.toContain("No reports have been published yet.");
  });

  it("names the three empty-archive causes apart", () => {
    expect(emptyArchiveState(true, 12)).toMatchObject({ status: "empty", title: "No reports match these filters.", actionText: "Clear filters" });
    expect(emptyArchiveState(false, 12)).toMatchObject({ status: "empty", title: "No further reports to show." });
    expect(emptyArchiveState(false, 0)).toMatchObject({ status: "empty", title: "No reports have been published yet." });
    /* None of them is the outage. `unavailable` maps to `error` and is
       rendered before this is reached; `tests/state-causes.test.ts` owns that
       distinction and it must not leak into this one. */
    expect(emptyArchiveState(false, 0).status).not.toBe("error");
  });
});

/* ── VA-19: what counts as one story ──────────────────────────────────────── */

describe("VA-19: grouping on canonicalStoryId", () => {
  it("never groups records that carry no canonical id", () => {
    /* The case most likely to break, and the reason it is written first.
       Records published before the field existed all carry null. Keyed like
       any other value they would collapse into a single "story" containing
       every legacy record on the desk. */
    const groups = groupByCanonicalStory([
      story({ publicId: "a" }),
      story({ publicId: "b" }),
      story({ publicId: "c" }),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.latest.publicId)).toEqual(["a", "b", "c"]);
    expect(groups.every((g) => g.earlier.length === 0)).toBe(true);
    expect(groups.every((g) => g.canonicalStoryId === null)).toBe(true);
  });

  it("does not group a null id with a record that has one", () => {
    const groups = groupByCanonicalStory([
      story({ publicId: "a", canonicalStoryId: "lebanon-strikes-2026-09-06" }),
      story({ publicId: "b" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("treats an empty or whitespace canonical id as no id at all", () => {
    const groups = groupByCanonicalStory([
      story({ publicId: "a", canonicalStoryId: "" }),
      story({ publicId: "b", canonicalStoryId: "   " }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.canonicalStoryId === null)).toBe(true);
  });

  it("groups only on an exact shared id, never on a similar one", () => {
    /* No fuzzy matching, ever. Two ids that differ by a suffix are two
       stories, and merging them would silently delete real reporting from a
       reader's view. */
    const groups = groupByCanonicalStory([
      story({ publicId: "a", canonicalStoryId: "west-bank-outposts-2026-09-06" }),
      story({ publicId: "b", canonicalStoryId: "west-bank-outposts-2026-09-07" }),
      story({ publicId: "c", canonicalStoryId: "west-bank-outposts" }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("puts the newest record of a shared story at its head and keeps the rest beneath", () => {
    const groups = groupByCanonicalStory([
      story({ publicId: "second", canonicalStoryId: "s", publishedAt: "2026-09-06T09:00:00.000Z" }),
      story({ publicId: "newest", canonicalStoryId: "s", publishedAt: "2026-09-07T09:00:00.000Z" }),
      story({ publicId: "oldest", canonicalStoryId: "s", publishedAt: "2026-09-05T09:00:00.000Z" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].latest.publicId).toBe("newest");
    expect(groups[0].earlier.map((r) => r.publicId)).toEqual(["second", "oldest"]);
  });

  it("keeps a newest-first list newest-first", () => {
    const groups = groupByCanonicalStory([
      story({ publicId: "a" }),
      story({ publicId: "b", canonicalStoryId: "s" }),
      story({ publicId: "c" }),
      story({ publicId: "d", canonicalStoryId: "s", publishedAt: "2026-09-01T09:00:00.000Z" }),
    ]);
    /* Group order follows first appearance, so the story sits where its newest
       member did rather than jumping to the front or the back. */
    expect(groups.map((g) => g.latest.publicId)).toEqual(["a", "b", "c"]);
  });

  it("keeps every update reachable at its own address when it is grouped", async () => {
    /* Grouping is presentation, not deletion. A record listed beneath a story
       still has its own link here, and is untouched in `/updates` and Search. */
    read.mockImplementation(async (query: string) =>
      new URLSearchParams(query).get("section") === "israel_update"
        ? [
            ...feed(11),
            story({ publicId: "thread-new", title: "Latest turn", canonicalStoryId: "thread", publishedAt: "2026-09-04T10:00:00.000Z" }),
            story({ publicId: "thread-old", title: "First report", canonicalStoryId: "thread", publishedAt: "2026-09-03T10:00:00.000Z" }),
          ]
        : [],
    );

    const output = await html(await LiveBriefEdition({ filters: {} }));

    expect(output).toContain("Earlier in this story");
    expect(occurrences(output, "thread-new")).toBe(1);
    expect(occurrences(output, "thread-old")).toBe(1);
    expect(output).toContain("First report");
  });
});

describe("VA-19: saying that a record was revised", () => {
  it("reads the creation-path timestamp skew as unrevised", () => {
    /* `recordVersion` writes `updated_at` a fraction of a second before
       `published_at` on create. Every unrevised record on Production reads
       between −1.6s and −0.1s; treating that as a revision would mark the
       whole desk "Updated". */
    expect(hasPublishedUpdate({ publishedAt: "2026-09-07T00:31:11.658Z", updatedAt: "2026-09-07T00:31:11.474Z" })).toBe(false);
    expect(hasPublishedUpdate({ publishedAt: "2026-09-05T10:00:00.000Z", updatedAt: "2026-09-05T10:00:00.000Z" })).toBe(false);
  });

  it("reads a genuine later revision as revised", () => {
    expect(hasPublishedUpdate({ publishedAt: "2026-09-06T22:45:20.148Z", updatedAt: "2026-09-07T14:06:52.279Z" })).toBe(true);
  });

  it("falls to unrevised on an unparseable timestamp", () => {
    expect(hasPublishedUpdate({ publishedAt: "not a date", updatedAt: "2026-09-07T14:06:52.279Z" })).toBe(false);
    expect(hasPublishedUpdate({ publishedAt: "2026-09-06T22:45:20.148Z", updatedAt: "nonsense" })).toBe(false);
  });

  it("states the revision on the card with a machine-readable instant", async () => {
    read.mockImplementation(async (query: string) =>
      new URLSearchParams(query).get("section") === "israel_update"
        ? [story({ publicId: "revised", title: "A developing story", publishedAt: "2026-09-06T22:45:20.148Z", updatedAt: "2026-09-07T14:06:52.279Z" })]
        : [],
    );

    const output = await html(await LiveBriefEdition({ filters: {} }));

    expect(output).toContain(">Updated<");
    expect(output.toLowerCase()).toContain('datetime="2026-09-07t14:06:52.279z"');
  });

  it("says nothing about revision on a record that was never revised", async () => {
    read.mockImplementation(async (query: string) =>
      new URLSearchParams(query).get("section") === "israel_update" ? feed(3) : [],
    );
    const output = await html(await LiveBriefEdition({ filters: {} }));
    expect(output).not.toContain(">Updated<");
  });
});

/* ── VA-12 is not retired by VA-19 ────────────────────────────────────────── */

describe("the exact-duplicate collapse survives canonical grouping", () => {
  it("collapses a pair that grouping is required to leave alone", () => {
    /* Measured on Production, 2026-09-07: the one pair the collapse removes
       carries `canonicalStoryId: null` on both records. A story filed twice as
       two unrelated rows is exactly a story whose rows were never given the
       same identity, so canonical grouping covers none of this and the two
       projections are complementary rather than successive. */
    const twins = [
      story({ publicId: "civil-defence-a", title: "Open Civil-Defence Data Initiative", summary: "Same summary.", publishedAt: "2026-09-06T10:00:00.000Z" }),
      story({ publicId: "civil-defence-b", title: "Open Civil-Defence Data Initiative", summary: "Same summary.", publishedAt: "2026-09-05T10:00:00.000Z" }),
    ];

    expect(groupByCanonicalStory(twins)).toHaveLength(2);
    expect(collapseExactDuplicates(twins)).toHaveLength(1);
    expect(collapseExactDuplicates(twins)[0].publicId).toBe("civil-defence-a");
  });

  it("still refuses to collapse on a shared headline alone", () => {
    const pair = [
      story({ publicId: "a", title: "Strike in southern Lebanon", summary: "One account." }),
      story({ publicId: "b", title: "Strike in southern Lebanon", summary: "A different account." }),
    ];
    expect(collapseExactDuplicates(pair)).toHaveLength(2);
  });
});
