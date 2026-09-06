import type { HomepageEdition } from "@/server/contracts/homepage";
import { HomeNewsSection } from "./HomeNewsSection";
import { HomeNarrativesSection } from "./HomeNarrativesSection";
import { HomeArchiveSection } from "./HomeArchiveSection";
import { HomeHeroesSection } from "./HomeHeroesSection";
import { HomeHistorySection } from "./HomeHistorySection";
import { HomeSystemSection } from "./HomeSystemSection";
import styles from "./homepage-journey.module.css";
export function HomepageJourney({ edition }: { edition: HomepageEdition }) {
  return (
    <div className={styles.journey}>
      <div className={styles.edition}>
        <p>One desk. A wider record.</p>
        <span>
          {edition.localPreview ? "Local preview · " : ""}
          {edition.editionDate
            ? `Edition ${edition.editionDate}`
            : "Edition unavailable"}
          {edition.state === "previous-edition" ? " · Previous edition" : ""}
        </span>
      </div>
      <nav className={styles.contents} aria-label="On this page">
        <span>In this edition</span>
        <a href="#home-news">News & analysis</a>
        <a href="#home-narratives">Investigations</a>
        <a href="#home-archive">October 7</a>
        <a href="#home-heroes">Our heroes</a>
        <a href="#home-history">Israel’s story</a>
        <a href="#home-system">Behind the desk</a>
      </nav>
      <HomeNewsSection section={edition.news} />
      <HomeNarrativesSection section={edition.fakeResistance} />
      <HomeArchiveSection section={edition.october7} />
      <HomeHeroesSection section={edition.heroes} />
      <HomeHistorySection section={edition.israelsStory} />
      <HomeSystemSection />
    </div>
  );
}
