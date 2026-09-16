import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToReadableStream } from "react-dom/server";
import { createElement, type ReactElement } from "react";
import {
  ArchiveFullIndex,
  ArchiveIndex,
  type ArchiveListEntry,
} from "@/components/archive";
import {
  type ArchiveIndexEntry,
  type ArchiveRecord,
  type ArchiveVersion,
  getManifest,
  manifestLanguages,
} from "@/lib/content/archive";
import { DOCUMENTATION_PACKAGE } from "@/lib/content/documentation";
import { TESTIMONIES_PACKAGE } from "@/lib/content/testimonies";

const ROOT = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(ROOT, relativePath), "utf8");

/**
 * The archive index's two scale properties, and the one manifest field whose
 * shape the type system could not check.
 *
 * PERF-004 and the no-JavaScript invariant pull in opposite directions here:
 * paging is what keeps a phone from laying out 335 rich rows, and paging needs
 * a client, so the same page must also ship every record as plain links for a
 * reader who has none. Both halves are asserted below against real rendered
 * markup, because "the component pages" and "the archive stays complete" are
 * the kind of claims that survive a refactor as comments long after they have
 * stopped being true.
 */

async function render(node: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

/** `PAGE_SIZE` in `ArchiveIndex`. Restated so a change to it fails here. */
const PAGE_SIZE = 24;
const TOTAL = 335;

const entry = (i: number): ArchiveIndexEntry => ({
  id: `record-${i}`,
  title: `Record ${i}`,
  category: i % 2 === 0 ? "nova" : "homes",
  date: "2023-10-07",
  cover: null,
  languages: ["en"],
  defaultLanguage: "en",
  witness: null,
  excerpt: null,
});

const entries = Array.from({ length: TOTAL }, (_, i) => entry(i));

/* The index route resolves covers server-side before handing rows over — the
   media registry never reaches the client. None of these fixtures has one,
   which is also the row's empty-plate state. */
const listRows: ArchiveListEntry[] = entries.map((e) => ({
  ...e,
  thumb: null,
  thumbWidth: null,
  thumbHeight: null,
  thumbSrcSet: "",
}));

describe("the archive index does not render the whole archive (PERF-004)", () => {
  it("puts one page of rows in the document, not all 335", async () => {
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "documentation",
        records: listRows,
        basePath: "/october-7/documentation",
        uncategorised: "uncategorized",
        facets: [
          { value: "nova", label: "The Nova Party Massacre", count: 168 },
          { value: "homes", label: "Murdered in Their Homes", count: 167 },
        ],
        facetLegend: "Category",
        searchLabel: "Documentation",
        searchHint: "Filter by description, place or category",
      }),
    );

    const rows = markup.match(/href="\/october-7\/documentation\/[^"]+"/g) ?? [];
    expect(rows).toHaveLength(PAGE_SIZE);

    /* The count a reader is shown is the archive's, not the page's — a pager
       that says "24 records" is a pager that has hidden 311 of them. */
    expect(markup).toContain(`of ${TOTAL}`);
  });

  /* The index's own sentence promises no film or photograph is shown until
     the reader asks. The documentation rows used to answer that with 24
     ungated cover frames of the attack; the rows now carry no plate at all —
     exhibit number, filing line, caption. Asserted against rows that DO have
     covers resolved, so the assertion fails the day someone reintroduces the
     thumb rather than passing for a dataset without one. */
  it("paints no cover frame on a documentation row, even when one is resolved", async () => {
    const withThumbs: ArchiveListEntry[] = listRows.map((row) => ({
      ...row,
      thumb: "/archive/hamas-massacre/web/images/ab/x-w480.webp",
      thumbWidth: 480,
      thumbHeight: 480,
      thumbSrcSet: "/archive/hamas-massacre/web/images/ab/x-w480.webp 480w",
    }));
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "documentation",
        records: withThumbs,
        basePath: "/october-7/documentation",
        facets: [
          { value: "nova", label: "The Nova Party Massacre", count: 168 },
          { value: "homes", label: "Murdered in Their Homes", count: 167 },
        ],
        facetLegend: "Category",
        searchLabel: "Documentation",
        searchHint: "Filter",
      }),
    );

    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("x-w480.webp");
  });

  /* And the testimony rows keep theirs — the plate identifies the account,
     and this archive is not gated by row. */
  it("still paints a plate on a testimony row", async () => {
    const testimonyRows: ArchiveListEntry[] = entries.map((e) => ({
      ...e,
      category: null,
      witness: "Noam G.'s story",
      excerpt: "Saturday, October 7th, 2023 06:00 …",
      thumb: "/archive/october7/web/images/ab/x-w480.webp",
      thumbWidth: 480,
      thumbHeight: 480,
      thumbSrcSet: "",
    }));
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "testimony",
        records: testimonyRows,
        basePath: "/october-7/testimonies",
        facets: [],
        facetLegend: "Language",
        searchLabel: "Testimonies",
        searchHint: "Filter",
      }),
    );

    expect(markup).toContain("<img");
  });

  it("marks the controls and the pager as needing a client", async () => {
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "documentation",
        records: listRows,
        basePath: "/october-7/documentation",
        facets: [
          { value: "nova", label: "The Nova Party Massacre", count: 168 },
          { value: "homes", label: "Murdered in Their Homes", count: 167 },
        ],
        facetLegend: "Category",
        searchLabel: "Documentation",
        searchHint: "Filter",
      }),
    );

    /* Two regions: the filter controls and the pager. Both are inert with
       scripting off — the pager worse than inert, because `?page=2` is served
       by the same prerendered file as page 1 — and `ArchiveFullIndex` hides
       exactly these from inside its own `<noscript>`. */
    expect(markup.match(/data-needs-js=""/g) ?? []).toHaveLength(2);
  });

  it("states the results as a named region, labelled by its own heading", async () => {
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "documentation",
        records: listRows,
        basePath: "/october-7/documentation",
        facets: [],
        facetLegend: "Category",
        searchLabel: "Documentation",
        searchHint: "Filter",
      }),
    );

    expect(markup).toMatch(/role="region"/);
    expect(markup).toMatch(/aria-labelledby="[^"]+-results-heading"/);
    expect(markup).toMatch(/<h2[^>]*>Documentation(<!-- -->)? results<\/h2>/);
  });

  it("exposes the exhibit number to assistive technology, not as decoration", async () => {
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "documentation",
        records: listRows,
        basePath: "/october-7/documentation",
        facets: [],
        facetLegend: "Category",
        searchLabel: "Documentation",
        searchHint: "Filter",
      }),
    );

    /* The visible form is padded zeros; what a screen reader is told is the
       exhibit's number, in words, as the row's first fact. */
    expect(markup).toContain("Exhibit 1.");
    expect(markup).not.toMatch(/class="[^"]*exhibitNum[^"]*"[^>]*aria-hidden="true"/);
  });

  it("expresses every page as a real URL, so a window can be linked to", async () => {
    const markup = await render(
      createElement(ArchiveIndex, {
        variant: "documentation",
        records: listRows,
        basePath: "/october-7/documentation",
        facets: [],
        facetLegend: "Category",
        searchLabel: "Documentation",
        searchHint: "Filter",
      }),
    );
    expect(markup).toContain('href="/october-7/documentation?page=2"');
    expect(markup).toContain(
      `href="/october-7/documentation?page=${Math.ceil(TOTAL / PAGE_SIZE)}"`,
    );
  });
});

describe("the archive stays complete with scripting off", () => {
  it("lists every record inside <noscript>, and hides what needs a client", async () => {
    const markup = await render(
      createElement(ArchiveFullIndex, {
        entries,
        basePath: "/october-7/documentation",
        categorised: true,
        uncategorised: "uncategorized",
        heading: "Every record",
      }),
    );

    expect(markup.startsWith("<noscript>")).toBe(true);
    const links = markup.match(/href="\/october-7\/documentation\/[^"]+"/g) ?? [];
    expect(links).toHaveLength(TOTAL);

    /* The style is the half that makes the note above the list true: without
       it a no-JS reader still met a dead search box, dead category buttons and
       a pager whose links resolve to the page they are already on. */
    expect(markup).toContain("[data-needs-js]{display:none!important}");
  });
});

describe("a package manifest's language field (the shape the type could not check)", () => {
  it.each([TESTIMONIES_PACKAGE, DOCUMENTATION_PACKAGE])(
    "%s: reads back as a non-empty list of codes",
    async (pkg) => {
      const manifest = await getManifest(pkg);
      const languages = manifestLanguages(manifest);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain(manifest.defaultLanguage);
      expect([...languages].sort()).toEqual(languages);
    },
  );

  it("october7 writes a count map, which is why `.length` was the wrong read", async () => {
    /* This is the regression itself, pinned. `ArchiveManifest.languages` was
       declared `string[]`, `readPackageFile` casts unvalidated JSON, and this
       package writes an object — so `manifest.languages.length` evaluated to
       `undefined`. `/october-7` shipped an empty <dd> under "Languages" and
       `/october-7/testimonies` silently dropped the sentence naming how many
       languages the archive holds. Both now read through the helper. */
    const manifest = await getManifest(TESTIMONIES_PACKAGE);
    expect(Array.isArray(manifest.languages)).toBe(false);
    expect(manifestLanguages(manifest).length).toBeGreaterThan(1);
  });

  it("hamas-massacre writes a plain array, and the helper takes both", async () => {
    const manifest = await getManifest(DOCUMENTATION_PACKAGE);
    expect(Array.isArray(manifest.languages)).toBe(true);
    expect(manifestLanguages(manifest)).toEqual(["en", "es"]);
  });
});

describe("the filter's hint stays true to what it searches", () => {
  /* The testimonies filter used to hint "words in the account" while
     searching only title, witness and excerpt — a promise the archive held
     no index for. Making the promise true would have meant shipping all 179
     default-language accounts to the browser (1.39 MB, 446 kB gzipped —
     measured) on a page whose rows are already whole pages in their own
     right, so the honest half was taken instead: the hint and the no-match
     copy name what is actually searched. These pin both halves of that
     decision — the hint no longer promises the body text, and the filter
     still searches every field the row actually carries. */
  it("no longer promises words from the account body", () => {
    const page = read("app/october-7/testimonies/page.tsx");
    expect(page).not.toMatch(/words in the account/);
    expect(page).toMatch(/the account's opening words/);
  });

  it("searches exactly the fields the hint names", () => {
    const index = read("components/archive/ArchiveIndex.tsx");
    /* Title, witness, filing label and excerpt — the row's own fields. */
    expect(index).toContain("displayTitle(entry.title ?? entry.id)");
    expect(index).toContain("displayWitness(entry.witness)");
    expect(index).toContain("entry.excerpt ?? ''");
    /* The filtering reads the committed query, not the keystroke: the
       summary announces once, on the 300ms timer, never per character. */
    expect(index).toMatch(/const committed = urlQuery\.trim\(\)/);
    expect(index).not.toMatch(/fold\(draft\.trim\(\)\)/);
  });
});

describe("a media share never fetches its original unasked", () => {
  /* The control used to prefetch the full original on intersection — on this
     archive that is a graphic film or photograph pulled behind a still-covered
     gate, on a connection that may have asked to be spared, for a reader who
     never pressed anything. The prefetch now starts only on a gesture of the
     control itself, and two more guards refuse it in their own case. */
  it("fetches on pointerdown or focus of the control, never on scroll into view", () => {
    const source = read("components/archive/XMediaPostButton.tsx");
    expect(source).not.toContain("IntersectionObserver");
    expect(source).toContain("onPointerDown={prefetchAhead}");
    expect(source).toContain("onFocus={prefetchAhead}");
  });

  it("refuses while the gate is covered and on a saveData connection", () => {
    const source = read("components/archive/XMediaPostButton.tsx");
    expect(source).toContain("gateCovered()");
    expect(source).toContain("saveData()");
    expect(source).toMatch(/\[data-gate-media/);
  });
});

describe("a record closes with where it sits", () => {
  /* OCT-004's order now ends with the archive named and counted, one way
     back, and then the neighbours — a record that closed on two social
     buttons left a reader with no sense of the holding they had just been
     inside. The count must be the archive's real one, read from the same
     cached index the rows are ordered by, not a constant that drifts. */
  const record: ArchiveRecord = {
    canonical_story_id: "08-10-was-the-last-time-he-answered",
    default_language: "en",
    available_languages: ["en"],
    witness_name: null,
    category_id: null,
    publication_date: "2023-10-25",
    cover_media_id: null,
    translation_status: "ok",
    versions: {
      en: {
        story_id: "08-10-was-the-last-time-he-answered",
        locale: "en",
        direction: "ltr",
        status: "published",
        title: "08:10 was the last time he answered",
        excerpt: "Saturday, October 7th, 2023 06:00 …",
        full_text: "Saturday, October 7th, 2023 06:00 …",
        content_blocks: [
          { type: "paragraph", position: 0, text: "Saturday, October 7th, 2023 06:00 …" },
        ],
        cover_status: "missing-in-source",
      },
    },
  };

  const version: ArchiveVersion = record.versions.en;
  const media = new Map();

  it("names the archive and counts it, and offers the way back", async () => {
    const { ArchiveRecord } = await import("@/components/archive/ArchiveRecord");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(
      createElement(ArchiveRecord, {
        pkg: TESTIMONIES_PACKAGE,
        variant: "testimony",
        record,
        version,
        media,
        basePath: "/october-7/testimonies/x",
        sourceLabel: "October7.org",
        shareUrl: "https://lionsofzion.io/october-7/testimonies/x",
        sensitivity: { gate: "none", category: "", note: "" },
        heldTotal: 179,
        previous: null,
        next: null,
      }),
    );

    /* React's server render interleaves comment markers between dynamic and
       static text, so the sentence is asserted in its stable parts. */
    expect(markup).toContain("One of");
    expect(markup).toContain("179");
    expect(markup).toContain("accounts held here.");
    expect(markup).toContain("Back to all");
    expect(markup).toContain("testimonies");
    expect(markup).toContain('href="/october-7/testimonies"');
  });

  it("closes with one share path, and the way on after it", async () => {
    const { ArchiveRecord } = await import("@/components/archive/ArchiveRecord");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(
      createElement(ArchiveRecord, {
        pkg: TESTIMONIES_PACKAGE,
        variant: "testimony",
        record,
        version,
        media,
        basePath: "/october-7/testimonies/x",
        sourceLabel: "October7.org",
        shareUrl: "https://lionsofzion.io/october-7/testimonies/x",
        sensitivity: { gate: "none", category: "", note: "" },
        heldTotal: 179,
        previous: null,
        next: null,
      }),
    );

    /* The server render has no navigator, so the one path without media is
       the copy — and exactly one control closes the record. Facebook is gone:
       the archive's sentence offers one act, not a row of buttons. */
    expect(markup).toContain("Copy caption");
    expect(markup).not.toContain("Share on Facebook");
    expect(markup).not.toContain("Share record…");
    /* The multi-sentence share status no longer runs in the mono face. */
    expect(read("components/archive/archive.module.css")).not.toMatch(
      /\.shareStatus\s*{[^}]*dataValue/,
    );
  });
});
