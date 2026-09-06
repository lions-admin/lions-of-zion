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

/** Historical plates: an era rule, the photograph, the chapter. */
export function HomeHistorySection({
  section,
}: {
  section: HomepageEdition["israelsStory"];
}) {
  return (
    <section
      id="home-history"
      className={`${styles.section} ${styles.editorial} ${styles.history}`}
      aria-labelledby="home-history-title"
      data-home-section="israelsStory"
    >
      <SectionHeading
        id="home-history-title"
        kicker="Beyond the current headline"
        title="Israel’s Story"
      />
      <div className={styles.historySpread}>
        {section.items.map((item, index) => (
          <article
            key={item.key}
            data-home-record={item.key}
            data-rank={rankOf(index)}
          >
            <p className={styles.era}>{item.era}</p>
            <HomeMedia media={item.media} />
            <h3>{item.title}</h3>
            {item.contested && (
              <p className={styles.verdict} data-tone="warn">
                <span className={styles.verdictLabel}>Contested</span>
                <span className={styles.verdictMeaning}>
                  The chapter records disagreement; it does not settle it.
                </span>
              </p>
            )}
            <p className={styles.summary}>
              <PreviewText
                text={item.summary}
                budget={PREVIEW_BUDGET[rankOf(index)]}
              />
            </p>
            {item.whyItMatters && (
              <p className={styles.context}>
                <span className={styles.contextLabel}>Why it matters</span>{" "}
                <PreviewText
                  text={item.whyItMatters}
                  budget={PREVIEW_BUDGET.context}
                />
              </p>
            )}
            <HomeSources sources={item.sources} />
            <JourneyLink href={item.href}>Read the chapter</JourneyLink>
          </article>
        ))}
      </div>
      <SectionState section={section} />
      <SectionAction href="/israels-story">Explore Israel’s Story</SectionAction>
    </section>
  );
}
