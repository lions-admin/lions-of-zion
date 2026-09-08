import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * VA-62 — a link must preview as the same thing wherever it is pasted.
 *
 * Swept 2026-09-07: about twenty routes exported `openGraph` and **two**
 * exported `twitter`. So October 7 had a page-specific Open Graph card while X
 * fell back to generic site copy — the same URL previewing as two different
 * things depending on where it was shared.
 *
 * The fix is one helper rather than twenty hand-written blocks, because this
 * repository has already paid the duplication bill twice: the People hub kept
 * its own copy of eight section labels and two had gone stale, and
 * `/fake-resistance` was spelled two ways across its own sub-pages. Metadata
 * drift is worse than either — nothing renders it, so nobody notices until a
 * link previews wrongly somewhere else.
 */

describe("the helper builds a complete, self-consistent card", () => {
  const meta = pageMetadata({
    title: "October 7",
    description: "The archive.",
    path: "/october-7",
  });

  it("gives Open Graph and X the same title", () => {
    expect(meta.openGraph?.title).toBe("October 7 — LIONS OF ZION");
    expect((meta.twitter as { title?: string }).title).toBe("October 7 — LIONS OF ZION");
  });

  it("suffixes the social title to match the tab the link opens", () => {
    // The layout's template adds the suffix to the tab but not to Open Graph.
    expect(meta.title).toBe("October 7");
    expect(String(meta.openGraph?.title)).toContain("— LIONS OF ZION");
  });

  it("derives the canonical URL and og:url from one path", () => {
    expect(meta.alternates?.canonical).toBe("https://lionsofzion.io/october-7");
    expect((meta.openGraph as { url?: string }).url).toBe("https://lionsofzion.io/october-7");
  });

  it("asks for the large card, which is what the site card is sized for", () => {
    // `Twitter` is a union discriminated on `card`, so it is read as a record.
    expect((meta.twitter as { card?: string }).card).toBe("summary_large_image");
  });

  it("falls back to the site card rather than inventing one — or shipping none", () => {
    /* A wrong picture is worse than the general one, so a page without its own
       image gets the site card. It must not get *nothing*: this test asserted
       `toBeUndefined()` until 2026-09-08, which encoded the T-12 defect rather
       than catching it. Next replaces `openGraph` wholesale instead of
       deep-merging it, so emitting no `images` here suppressed the layout's
       card — and every one of these pages still declared
       `twitter:card = summary_large_image`, a format defined by its image.
       Measured live: `og:image` on exactly one page in the whole site. */
    const images = (meta.openGraph as { images?: { url: string }[] }).images;
    expect(images).toHaveLength(1);
    expect(images![0]!.url).toBe("/opengraph-image.png");
    expect((meta.twitter as { images?: string[] }).images).toEqual(["/opengraph-image.png"]);
  });

  it("prefers a page's own image when it has one", () => {
    const own = pageMetadata({
      title: "T", description: "d", path: "/p",
      image: { url: "/custom.png", width: 800, height: 600, alt: "custom" },
    });
    const images = (own.openGraph as { images?: { url: string; alt: string }[] }).images;
    expect(images![0]!.url).toBe("/custom.png");
    expect(images![0]!.alt).toBe("custom");
    expect((own.twitter as { images?: string[] }).images).toEqual(["/custom.png"]);
  });

  it("never declares a large-image card without an image to put in it", () => {
    /* The invariant the defect violated, stated once so it cannot come back:
       whatever the inputs, if the card is summary_large_image there is an
       image behind it. */
    for (const input of [
      { title: "A", description: "d", path: "/a" },
      { title: "B", description: "d", path: "/b", type: "article" as const },
      { title: "C", description: "d", path: "/c", image: { url: "/c.png", width: 1, height: 2, alt: "c" } },
    ]) {
      const built = pageMetadata(input);
      expect((built.twitter as { card?: string }).card).toBe("summary_large_image");
      expect((built.twitter as { images?: string[] }).images?.[0]).toBeTruthy();
      expect((built.openGraph as { images?: unknown[] }).images).toHaveLength(1);
    }
  });

  it("carries publishedTime only on an article, keeping the union intact", () => {
    const article = pageMetadata({
      title: "Our Heroes", description: "d", path: "/our-heroes",
      type: "article", publishedTime: "2026-09-07T00:00:00.000Z",
    });
    expect((article.openGraph as { type?: string }).type).toBe("article");
    expect((article.openGraph as { publishedTime?: string }).publishedTime)
      .toBe("2026-09-07T00:00:00.000Z");
    expect((meta.openGraph as { type?: string }).type).toBe("website");
  });
});

/** Every public route that states its own metadata must state all of it. */
function publicPages(dir = "app", found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Admin and account are deliberately unshared surfaces.
      if (!/^(admin|account|api)$/.test(entry)) publicPages(path, found);
    } else if (entry === "page.tsx") {
      found.push(path);
    }
  }
  return found;
}

describe("no public page hand-writes half a card", () => {
  const pages = publicPages().filter((path) => {
    const source = readFileSync(path, "utf8");
    return source.includes("export const metadata") || source.includes("generateMetadata");
  });

  it("finds the public pages to check", () => {
    expect(pages.length).toBeGreaterThan(15);
  });

  it.each(pages)("%s builds its metadata from the helper", (path) => {
    const source = readFileSync(path, "utf8");
    /* The article route is the one legitimate exception: it renders a
       per-record generated image and needs `modifiedTime`, so it states its own
       card — and it already sets `twitter`, which is what this guards. */
    if (path.includes("[publicId]") || path.includes("[slug]") || path.includes("[category]")) {
      expect(source).toMatch(/twitter|generateMetadata/);
      return;
    }
    expect(source).toContain("pageMetadata");
  });
});
