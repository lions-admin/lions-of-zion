import type { HomepageEdition } from "@/server/contracts/homepage";
import {
  HomeMedia,
  HomeSources,
  HomeTime,
  JourneyLink,
  PREVIEW_BUDGET,
  PreviewText,
  SectionAction,
  SectionHeading,
  SectionState,
  rankOf,
} from "./HomeJourneyPrimitives";
import styles from "./homepage-journey.module.css";

/**
 * An editorial spread: a lead story and a quieter companion. A record without
 * cleared homepage media remains a first-class text card rather than being
 * removed from the edition.
 */
export function HomeNewsSection({
  section,
}: {
  section: HomepageEdition["news"];
}) {
  return (
    <section
      id="home-news"
      className={`${styles.section} ${styles.editorial}`}
      aria-labelledby="home-news-title"
      data-home-section="news"
    >
      <SectionHeading
        id="home-news-title"
        kicker="The present"
        title="News & Analysis"
      />
      <div className={styles.newsSpread} data-count={section.items.length}>
        {section.items.map((item, index) => (
          <article
            key={item.key}
            data-home-record={item.key}
            data-rank={rankOf(index)}
            data-has-media={item.media ? "true" : "false"}
            style={!item.media ? { gridTemplateColumns: "1fr" } : undefined}
          >
            <HomeMedia media={item.media} lead={index === 0} />
            <div className={styles.newsBody}>
            <div className={styles.byline}>
              <span>{item.category}</span>
              <HomeTime date={item.date} includeTime />
            </div>
            <h3>
              <a href={item.href}>{item.title}</a>
            </h3>
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
            <JourneyLink href={item.href}>
              {item.category === "Daily Brief"
                ? "Read the daily brief"
                : "Read the story"}
            </JourneyLink>
            </div>
          </article>
        ))}
      </div>
      <SectionState section={section} />
      <SectionAction href="/geopolitical-brief">
        View all News & Analysis
      </SectionAction>
    </section>
  );
}
