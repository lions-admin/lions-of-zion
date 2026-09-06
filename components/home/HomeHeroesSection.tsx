import type { HomepageEdition } from "@/server/contracts/homepage";
import {
  HomeMedia,
  HomeSources,
  JourneyLink,
  SectionHeading,
  SectionState,
} from "./HomeJourneyPrimitives";
import styles from "./homepage-journey.module.css";
export function HomeHeroesSection({
  section,
}: {
  section: HomepageEdition["heroes"];
}) {
  return (
    <section
      id="home-heroes"
      className={styles.section}
      aria-labelledby="home-heroes-title"
      data-home-section="heroes"
    >
      <SectionHeading
        id="home-heroes-title"
        kicker="People, not statistics"
        title="Our Heroes"
        href="/our-heroes"
        action="Read Our Heroes"
      />
      <div className={styles.peopleSpread}>
        {section.items.map((item) => (
          <article key={item.key} data-home-record={item.key}>
            <HomeMedia media={item.media} portrait />
            <div>
              <p className={styles.kicker}>{item.role}</p>
              <h3>{item.title}</h3>
              <p className={styles.meta}>{item.meta}</p>
              <p className={styles.summary}>{item.summary}</p>
              <HomeSources sources={item.sources} />
              <JourneyLink href={item.href}>Read the full story</JourneyLink>
            </div>
          </article>
        ))}
      </div>
      <SectionState section={section} />
    </section>
  );
}
