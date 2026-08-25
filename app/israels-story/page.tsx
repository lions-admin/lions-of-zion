import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { SourceList, Timeline } from "@/components/content";
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
      <nav className={styles.contents} aria-label="Chapters">
        <span className={styles.contentsKicker}>Contents</span>
        <ol className={styles.contentsList}>
          {edition.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <Link href={`#${chapter.id}`}>
                <span className={styles.contentsNumeral} aria-hidden="true">
                  {toRoman(index + 1)}
                </span>
                <span className={styles.contentsTitle}>{chapter.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {edition.chapters.map((chapter, index) => {
        const flagged = chapter.id === "oslo-accords";
        return (
          <article key={chapter.id} id={chapter.id} className={styles.chapter}>
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

            <p
              className={
                flagged
                  ? `${styles.chapterIntro} ${styles.chapterIntroFlagged}`
                  : styles.chapterIntro
              }
            >
              {chapter.intro}
            </p>

            <Timeline variant="history" entries={chapter.timeline} />
            <SourceList sources={chapter.sources} />
          </article>
        );
      })}

      <SectionBlock heading="Sources and further reading">
        <p>
          This is a working edition, chapters added one at a time as each
          could be sourced and checked properly — not the whole story yet.
          Every historical claim above is built to be checked — the dates
          and sources are cited inline. One chapter remains a known,
          honest gap: the ancient and biblical period, which needs more
          careful sourcing than any session so far has had time for — a
          next step, not an omission to gloss over.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
