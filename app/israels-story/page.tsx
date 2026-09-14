import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionPage } from "@/components/sections/SectionPage";
import { PublicationMeta, Timeline } from "@/components/content";
import { homepageMedia } from "@/lib/content/homepage-media";
import { getIsraelsStoryEdition } from "@/lib/content/israels-story";
import type { StoryChapter } from "@/lib/content/israels-story";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

const TAGLINE =
  "The long arc: history, identity, and the context the noise leaves out.";

export const metadata: Metadata = pageMetadata({
  title: "Israel’s Story",
  description: TAGLINE,
  path: "/israels-story",
});

/** I–XX is far more than this page will ever need; a book's chapter marks
 *  don't count in Arabic numerals, and this page is built to read as one. */
const ROMAN_NUMERALS: [number, string][] = [
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(value: number): string {
  let remaining = value;
  let result = "";
  for (const [amount, numeral] of ROMAN_NUMERALS) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}

/** Layout only — cycles the three editorial compositions so consecutive
 *  chapters do not share a template. Not a historical grouping. */
const RHYTHMS = ["lede", "spine", "record"] as const;
type ChapterRhythm = (typeof RHYTHMS)[number];

function chapterRhythm(index: number): ChapterRhythm {
  return RHYTHMS[index % RHYTHMS.length];
}

/**
 * A chapter's own years, read off the entries it already carries.
 *
 * Nothing new is authored here and nothing is inferred: `datetime` on a
 * `TimelineEntry` is an ISO date that was cited when the entry was written,
 * so the first and last year of a chapter are facts the file already holds.
 * That is what makes an era map possible without adding an era field for an
 * editor to get wrong, and without this page ever stating a date that is not
 * already under a source below it.
 */
type ChapterSpan = { from: number; to: number; entries: number };

function chapterSpan(chapter: StoryChapter): ChapterSpan {
  const years = chapter.timeline
    .map((entry) => Number.parseInt(entry.datetime.slice(0, 4), 10))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  return {
    from: years[0],
    to: years[years.length - 1],
    entries: chapter.timeline.length,
  };
}

function spanLabel(span: ChapterSpan): string {
  return span.from === span.to ? String(span.from) : `${span.from}–${span.to}`;
}

/**
 * The era map: seven chapters placed on the arc they cover.
 *
 * This list used to be seven titles in a row, which told a reader the page
 * had seven chapters and nothing else. The bar beside each title is the
 * chapter's own span drawn against the whole edition's span, so before
 * reading a word a reader sees the shape of it: three chapters inside
 * twenty-six years, a cluster in the nineties, a twenty-six-year gap, and
 * 2020 at the far end. Every number in it comes from `chapterSpan` — an ISO
 * date already cited on an entry below — so the map cannot claim a date the
 * page does not source.
 *
 * A bar is never thinner than `MIN_BAR`: a single-day chapter would
 * otherwise be a mark too small to see or to read a position from.
 */
const MIN_BAR = 3;

function EraMap({ chapters }: { chapters: StoryChapter[] }) {
  const spans = chapters.map(chapterSpan);
  const first = Math.min(...spans.map((span) => span.from));
  const last = Math.max(...spans.map((span) => span.to));
  const arc = Math.max(last - first, 1);
  const entries = spans.reduce((total, span) => total + span.entries, 0);

  return (
    <nav className={styles.eraIndex} aria-label="Eras">
      <p className={styles.eraSummary}>
        <span className={styles.eraKicker}>Eras</span>
        <span className={styles.eraArc}>
          {first}–{last}
        </span>
        <span className={styles.eraTotals}>
          {chapters.length} chapters · {entries} dated entries
        </span>
      </p>
      <ol className={styles.eraList}>
        {chapters.map((chapter, index) => {
          const span = spans[index];
          const offset = ((span.from - first) / arc) * 100;
          const width = Math.max(((span.to - span.from) / arc) * 100, MIN_BAR);
          return (
            <li key={chapter.id}>
              <Link href={`#${chapter.id}`}>
                <span className={styles.eraNumeral} aria-hidden="true">
                  {toRoman(index + 1)}
                </span>
                <span className={styles.eraTitle}>{chapter.title}</span>
                {/* The flag reaches the map, not only the chapter. A
                    reader choosing where to start should know which era is
                    disputed before they land in it — and it is a word, not
                    a colour, for the same reason it is a word below. */}
                {chapter.contested === true ? (
                  <span className={styles.eraFlag}>Contested</span>
                ) : null}
                {/* The bar is drawn, so it is hidden from the reading order;
                    the span it draws is written out beside it in words. */}
                <span className={styles.eraTrack} aria-hidden="true">
                  <span
                    className={styles.eraBar}
                    style={{
                      insetInlineStart: `${offset}%`,
                      inlineSize: `${Math.min(width, 100 - offset)}%`,
                    }}
                  />
                </span>
                <span className={styles.eraSpan}>
                  {spanLabel(span)}
                  <span className={styles.eraEntries}>
                    {" "}
                    · {span.entries} {span.entries === 1 ? "entry" : "entries"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A chapter's archival picture.
 *
 * Keyed `chapter:<id>` in the same registry the homepage reads, with the
 * chapter's own `mediaRef` winning — the field existed on `StoryChapter` and
 * was read by nothing, while all seven chapters were already mapped to a
 * cleared asset. None of these is evidence and none is presented as such:
 * they are `archival-context`, they carry their credit, and the timeline
 * beneath them is where the sourcing lives.
 *
 * `alt` empties when the caption says the same thing, because the caption is
 * rendered and a `<figure>` already ties the two together — otherwise a
 * screen reader hears the sentence twice.
 */
function ChapterFigure({ chapter }: { chapter: StoryChapter }) {
  const media = homepageMedia(`chapter:${chapter.id}`, chapter.mediaRef);
  if (!media) return null;
  const caption = media.caption ?? null;
  return (
    <figure className={styles.chapterFigure}>
      <span className={styles.chapterFrame}>
        <Image
          src={media.src}
          alt={caption === media.alt ? "" : media.alt}
          width={media.width}
          height={media.height}
          loading="lazy"
          sizes="(max-width: 45rem) 100vw, (max-width: 76rem) 50vw, 700px"
          style={{
            objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%`,
          }}
        />
      </span>
      <figcaption className={styles.chapterCaption}>
        {media.disclosure ? (
          <span className={styles.chapterDisclosure}>{media.disclosure}</span>
        ) : null}
        {caption ? <span className={styles.chapterCaptionText}>{caption}</span> : null}
        <span className={styles.chapterCredit}>{media.credit}</span>
      </figcaption>
    </figure>
  );
}

export default async function Page() {
  const edition = await getIsraelsStoryEdition();
  const total = edition.chapters.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Israel’s Story",
    description: TAGLINE,
    url: `${SITE_URL}/israels-story`,
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
    hasPart: edition.chapters.map((chapter) => ({
      "@type": "Article",
      headline: chapter.title,
      description: chapter.intro,
      url: `${SITE_URL}/israels-story#${chapter.id}`,
    })),
  };

  return (
    <SectionPage id="israels-story" title="Israel’s Story" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* The era map stays at every width, unlike the flat list it replaced.
          `SectionToc`'s rail lists the same seven titles above 1220px and
          that is why the old list hid there — but the rail is a list of
          headings and this is a dated map of the arc, so the two are no
          longer the same thing said twice. It is also the whole of the
          no-JavaScript contents, which the rail is not. */}
      <EraMap chapters={edition.chapters} />

      {edition.chapters.map((chapter, index) => {
        /* The flag travels with the content, not with a string literal in
           the renderer — see `contested` on `StoryChapter`. */
        const flagged = chapter.contested === true;
        const rhythm = chapterRhythm(index);
        const span = chapterSpan(chapter);
        return (
          <article
            key={chapter.id}
            id={chapter.id}
            className={styles.chapter}
            data-rhythm={rhythm}
          >
            <header className={styles.chapterHead}>
              <span className={styles.chapterNumeral} aria-hidden="true">
                {toRoman(index + 1)}
              </span>
              <div>
                <p className={styles.chapterProgress}>
                  Chapter {toRoman(index + 1)} of {toRoman(total)}
                  <span className={styles.chapterSpan}>
                    {span.entries} dated{" "}
                    {span.entries === 1 ? "entry" : "entries"}
                  </span>
                </p>
                <h2 className={styles.chapterTitle}>{chapter.title}</h2>
              </div>
            </header>

            <div className={styles.chapterBody}>
              <ChapterFigure chapter={chapter} />
              {/* The contested flag was an ember rule and an ember wash and
                  nothing else — colour as the sole cue, which the token
                  contract rules out and which reaches nobody reading in
                  monochrome, in high contrast, or in print. The word does the
                  work now; the ramp only agrees with it. */}
              <p
                className={
                  flagged
                    ? `${styles.chapterIntro} ${styles.chapterIntroFlagged}`
                    : styles.chapterIntro
                }
              >
                {flagged ? (
                  <span className={styles.chapterIntroLabel}>Contested —</span>
                ) : null}
                {flagged ? " " : null}
                {chapter.intro}
              </p>

              {/* No chapter source list. `chapter.sources` is the union of the
                  sources its own entries already cite, so rendering it here
                  printed every citation on this page twice — invisible while
                  both sat in the column, obvious once each entry's sources moved
                  out to the margin beside it. The field stays in
                  `lib/content/israels-story.ts`; only the second rendering of it
                  is gone.

                  Motion lives on the dated entries (see `.eraTimeline`), not on
                  this chapter chrome. */}
              <div className={styles.eraTimeline}>
                <Timeline variant="history" entries={chapter.timeline} />
              </div>
            </div>
          </article>
        );
      })}

      <section className={styles.gapNote}>
        <h2 id="what-this-edition-does-not-yet-cover">
          What this edition does not yet cover
        </h2>
        <p>
          This is a working edition, chapters added one at a time as each
          could be sourced and checked properly — not the whole story yet.
          Every historical claim above is built to be checked — the dates
          and sources are cited inline. One chapter remains a known,
          honest gap: the ancient and biblical period, which needs more
          careful sourcing than any session so far has had time for — a
          next step, not an omission to gloss over.
        </p>
      </section>

      {/* A colophon, not a masthead: the fields exist and were reaching no
          reader, while the other three editorial destinations rendered the
          same two through `PublicationMeta`. At the foot, where a reader who
          has read the page is the one asking who checked it. */}
      <PublicationMeta
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
      />
    </SectionPage>
  );
}
