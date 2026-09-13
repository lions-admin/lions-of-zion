import type { HomepageEdition } from "@/server/contracts/homepage";
import { formatEditionDate } from "@/lib/format-date";
import { HOMEPAGE_BANDS } from "@/lib/homepage-bands";
import { HomeNewsSection } from "./HomeNewsSection";
import { HeroSupportStrip } from "./HeroSupportStrip";
import { HomeNarrativesSection } from "./HomeNarrativesSection";
import { HomeArchiveSection } from "./HomeArchiveSection";
import { HomePeopleSection } from "./HomePeopleSection";
import { HomeSystemSection } from "./HomeSystemSection";
import { HomeSupportSection } from "./HomeSupportSection";
import styles from "./homepage-journey.module.css";

/**
 * The edition below the cover. Its index is one tight editorial masthead —
 * the journey in one line, the edition date and six destinations named
 * exactly as they are named on the site — so a phone reaches the first story
 * within a screen of the lion rather than after several of orientation. The
 * sixth entry is the close of the edition, the ask (`HomeSupportSection`), so
 * a reader who arrived to give is one tap from it.
 *
 * The slim support rail sits at the close of the first band, after the news
 * and before the narratives. It used to be on the cover, under the edition
 * rail, which put an ask on the screen before any reporting had been read —
 * the pattern the 2026-09-07 ruling ("after the reader has seen what it pays
 * for") was written against. Here the reader has met the lead and its
 * companion first (UX-13, as amended by the owner: moved, not removed).
 */
export function HomepageJourney({ edition }: { edition: HomepageEdition }) {
  return (
    <div className={styles.journey}>
      <header className={styles.edition}>
        <p className={styles.editionLine}>What happened. What is being said about it. How to check.</p>
        {/* The same words as the cover's edition rail (`app/page.tsx`), from
            the same formatter: this line printed the raw `2026-09-12` while
            the cover said "Sat 12 Sept" until 2026-09-12. */}
        <span className={styles.editionDate}>
          {edition.editionDate
            ? `Edition · ${formatEditionDate(edition.editionDate)}`
            : "Edition unavailable"}
          {edition.state === "previous-edition" ? " · Previous edition" : ""}
        </span>
        <nav className={styles.contents} aria-label="In this edition">
          {HOMEPAGE_BANDS.map((band) => (
            <a key={band.id} href={band.anchor}>{band.label}</a>
          ))}
        </nav>
      </header>
      <HomeNewsSection section={edition.news} />
      <HeroSupportStrip />
      <HomeNarrativesSection section={edition.fakeResistance} />
      <HomeArchiveSection section={edition.october7} />
      <HomePeopleSection people={edition.people} heroes={edition.heroes} history={edition.israelsStory} />
      <HomeSystemSection />
      <HomeSupportSection />
    </div>
  );
}
