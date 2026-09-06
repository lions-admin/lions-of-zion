import type { HomepageEdition } from "@/server/contracts/homepage";
import {
  HomeMedia,
  HomeSources,
  JourneyLink,
  PREVIEW_BUDGET,
  PreviewText,
  SectionAction,
  SectionHeading,
  SectionState,
  rankOf,
} from "./HomeJourneyPrimitives";
import styles from "./homepage-journey.module.css";

/** Portrait-led: the person's face, name and role first; the story beneath. */
export function HomeHeroesSection({
  section,
}: {
  section: HomepageEdition["heroes"];
}) {
  return (
    <section
      id="home-heroes"
      className={`${styles.section} ${styles.editorial} ${styles.people}`}
      aria-labelledby="home-heroes-title"
      data-home-section="heroes"
    >
      <SectionHeading
        id="home-heroes-title"
        kicker="People, not statistics"
        title="Our Heroes"
      />
      <div className={styles.peopleSpread}>
        {section.items.map((item, index) => (
          <article
            key={item.key}
            data-home-record={item.key}
            data-rank={rankOf(index)}
          >
            <HomeMedia media={item.media} portrait />
            <p className={styles.kicker}>{item.role}</p>
            <h3>{item.title}</h3>
            <p className={styles.meta}>{item.meta}</p>
            <p className={styles.summary}>
              <PreviewText
                text={item.summary}
                budget={PREVIEW_BUDGET[rankOf(index)]}
              />
            </p>
            <HomeSources sources={item.sources} />
            <JourneyLink href={item.href}>Read the full story</JourneyLink>
          </article>
        ))}
      </div>
      <SectionState section={section} />
      <SectionAction href="/our-heroes">Read Our Heroes</SectionAction>
    </section>
  );
}
