import type { HomepageEdition } from "@/server/contracts/homepage";
import { HomeNewsSection } from "./HomeNewsSection";
import { HomeNarrativesSection } from "./HomeNarrativesSection";
import { HomeArchiveSection } from "./HomeArchiveSection";
import { HomeHeroesSection } from "./HomeHeroesSection";
import { HomeHistorySection } from "./HomeHistorySection";
import { HomeSystemSection } from "./HomeSystemSection";
import styles from "./homepage-journey.module.css";

/**
 * The edition below the cover. Its index is one tight editorial masthead —
 * the desk's line, the edition date and six destinations named exactly as
 * they are named on the site — so a phone reaches the first story within a
 * screen of the lion rather than after several of orientation.
 */
export function HomepageJourney({ edition }: { edition: HomepageEdition }) {
  return (
    <div className={styles.journey}>
      <header className={styles.edition}>
        <p className={styles.editionLine}>One desk. A wider record.</p>
        <span className={styles.editionDate}>
          {edition.localPreview ? "Local preview · " : ""}
          {edition.editionDate
            ? `Edition ${edition.editionDate}`
            : "Edition unavailable"}
          {edition.state === "previous-edition" ? " · Previous edition" : ""}
        </span>
        <nav className={styles.contents} aria-label="In this edition">
          <span aria-hidden="true">In this edition</span>
          <a href="#home-news">News & Analysis</a>
          <a href="#home-narratives">Fake Resistance</a>
          <a href="#home-archive">October 7</a>
          <a href="#home-heroes">Our Heroes</a>
          <a href="#home-history">Israel’s Story</a>
          <a href="#home-system">Behind the desk</a>
        </nav>
      </header>
      <HomeNewsSection section={edition.news} />
      <HomeNarrativesSection section={edition.fakeResistance} />
      <HomeArchiveSection section={edition.october7} />
      <HomeHeroesSection section={edition.heroes} />
      <HomeHistorySection section={edition.israelsStory} />
      <HomeSystemSection />
    </div>
  );
}
