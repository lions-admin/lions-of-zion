import type { Metadata } from "next";
import Link from "next/link";
import { SectionPage } from "@/components/sections/SectionPage";
import { PublicationMeta, Timeline } from "@/components/content";
import { getIsraelsStoryEdition } from "@/lib/content/israels-story";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "The long arc: history, identity, and the context the noise leaves out.";

export const metadata: Metadata = {
  title: "Israel’s Story",
  description: TAGLINE,
  openGraph: { title: "Israel’s Story — LIONS OF ZION", description: TAGLINE },
  alternates: { canonical: `${SITE_URL}/israels-story` },
};

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
    <SectionPage id="israels-story" surface="quiet" title="Israel’s Story" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* In-page era index: compact, roman, hash-anchored. SectionToc's
          desktop rail and mobile sheet are extra; this list is the no-JS
          contents and the mobile linear map. */}
      <nav className={styles.eraIndex} aria-label="Eras">
        <span className={styles.eraKicker}>Eras</span>
        <ol className={styles.eraList}>
          {edition.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <Link href={`#${chapter.id}`}>
                <span className={styles.eraNumeral} aria-hidden="true">
                  {toRoman(index + 1)}
                </span>
                <span className={styles.eraTitle}>{chapter.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {edition.chapters.map((chapter, index) => {
        /* The flag travels with the content, not with a string literal in
           the renderer — see `contested` on `StoryChapter`. */
        const flagged = chapter.contested === true;
        const rhythm = chapterRhythm(index);
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
                </p>
                <h2 className={styles.chapterTitle}>{chapter.title}</h2>
              </div>
            </header>

            <div className={styles.chapterBody}>
              <p
                className={
                  flagged
                    ? `${styles.chapterIntro} ${styles.chapterIntroFlagged}`
                    : styles.chapterIntro
                }
              >
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
