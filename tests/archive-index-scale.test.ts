import { describe, expect, it } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import { createElement, type ReactElement } from "react";
import {
  ArchiveFullIndex,
  ArchiveIndex,
  type ArchiveListEntry,
} from "@/components/archive";
import {
  type ArchiveIndexEntry,
  getManifest,
  manifestLanguages,
} from "@/lib/content/archive";
import { DOCUMENTATION_PACKAGE } from "@/lib/content/documentation";
import { TESTIMONIES_PACKAGE } from "@/lib/content/testimonies";

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
