import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * One page's metadata, built once — VA-62.
 *
 * ## What was actually wrong
 *
 * Swept 2026-09-07: about twenty routes exported `openGraph`, and **two**
 * exported `twitter` — `app/layout.tsx` and the article route. Seven exported
 * no `openGraph` at all, among them the Fake Resistance hub itself and both
 * October 7 indexes. And `app/page.tsx`, the homepage, exported **no metadata
 * whatsoever** and inherited the site defaults.
 *
 * The visible consequence is the one the audit named: October 7 had a
 * page-specific Open Graph card while X fell back to generic site copy, so the
 * same link previewed as two different things depending on where it was
 * pasted.
 *
 * ## Why a helper rather than twenty edits
 *
 * Twenty hand-written `twitter` blocks are twenty chances to drift, and this
 * repository has already paid that bill twice this week: the People hub kept
 * its own copy of eight section labels and two had gone stale, and
 * `/fake-resistance` was spelled two ways across its own sub-pages. The same
 * failure in metadata is invisible — nothing renders it, so nobody notices
 * until a link previews wrongly somewhere else.
 *
 * So the title, the description, the canonical URL, the Open Graph card and the
 * X card are derived from one call. A page states what it is; it does not
 * restate it four times.
 *
 * The site-wide card in `app/layout.tsx` stays as the fallback for anything
 * that does not call this. That is the correct role for it — a default, not a
 * substitute for a page saying what it is.
 */
export interface PageMetadataInput {
  /** The destination's name. Also the browser tab, via the layout's template. */
  title: string;
  description: string;
  /** Path only, leading slash — `/october-7`. The canonical URL is derived. */
  path: string;
  /**
   * A page-specific social image. Omit to fall back to the site card, which is
   * the honest default: a wrong picture is worse than the general one.
   *
   * **Omitting used to mean no picture at all, not the site card.** The
   * sentence above said "inherit the site card from the root layout" and that
   * is not what Next does: `openGraph` is replaced wholesale by the deepest
   * page that defines it, not deep-merged, so a page-level block without
   * `images` *suppresses* the layout's card instead of inheriting it. Measured
   * live 2026-09-08 (T-12): `og:image` existed on exactly one page in the
   * site, `/`. The other 23 helper-built routes shipped
   * `twitter:card = summary_large_image` — a format defined by its image —
   * with no image, so every one of them previewed in X and Slack as a bare
   * title-and-text stub. The fallback below now makes the comment true.
   */
  image?: { url: string; width: number; height: number; alt: string };
  /** `article` for a record, `website` for a destination. */
  type?: "website" | "article";
  /** ISO timestamp, articles only. The one field this cannot derive. */
  publishedTime?: string;
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
}: PageMetadataInput): Metadata {
  const canonical = `${SITE_URL}${path}`;
  /* The suffix matches the layout's title template, which Next applies to the
     tab but not to Open Graph — so a card built from the bare title would read
     differently from the tab it opens. */
  const social = `${title} — LIONS OF ZION`;
  /* The site card, repeated here rather than imported from the layout: these
     are the values `app/layout.tsx` already publishes, and a page that falls
     back must fall back to the *same* picture the site advertises. If that
     file's card changes, this must change with it — which is why the alt text
     is spelled out rather than abbreviated, so a mismatch is visible in a
     diff. */
  const SITE_CARD = {
    url: "/opengraph-image.png",
    width: 1731,
    height: 909,
    alt: "LIONS OF ZION — Investigations, fact checks, and information warfare",
  } as const;
  const card = image ?? SITE_CARD;
  const images = [{ url: card.url, width: card.width, height: card.height, alt: card.alt }];

  return {
    /* T-12.c. Next's `title.template` applies to child segments, not to the
       page sharing a segment with the layout that defines it — so the homepage
       tab read "Truth Has a Signal" while its card read
       "Truth Has a Signal — LIONS OF ZION", the exact mismatch this helper
       exists to prevent, on the site's most-shared page. Derived from the path
       rather than passed as a flag: `/` is the only route this can apply to,
       and a flag is something a future page can forget to set. */
    title: path === "/" ? { absolute: social } : title,
    description,
    alternates: { canonical },
    /* Spelled per branch rather than spread: Next's `OpenGraph` is a union
       discriminated on `type`, and a spread that carries `publishedTime`
       separately loses the discriminant and stops type-checking. */
    openGraph: type === "article"
      ? {
          type: "article",
          title: social,
          description,
          url: canonical,
          ...(publishedTime ? { publishedTime } : {}),
          images,
        }
      : {
          type: "website",
          title: social,
          description,
          url: canonical,
          images,
        },
    twitter: {
      card: "summary_large_image",
      title: social,
      description,
      images: [card.url],
    },
  };
}
