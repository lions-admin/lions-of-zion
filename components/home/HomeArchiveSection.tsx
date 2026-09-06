import type { HomepageEdition } from "@/server/contracts/homepage";
import {
  HomeMedia,
  HomeSources,
  JourneyLink,
  SectionHeading,
  SectionState,
} from "./HomeJourneyPrimitives";
import styles from "./homepage-journey.module.css";
export function HomeArchiveSection({
  section,
}: {
  section: HomepageEdition["october7"];
}) {
  return (
    <section
      id="home-archive"
      className={`${styles.section} ${styles.archive}`}
      aria-labelledby="home-archive-title"
      data-home-section="october7"
    >
      <SectionHeading
        id="home-archive-title"
        kicker="October 7, 2023"
        title="The record remains."
        href="/october-7"
        action="Explore the October 7 Archive"
      />
      <div className={styles.archiveSpread}>
        {section.items.map((item) => (
          <article
            key={item.key}
            data-kind={item.kind}
            data-home-record={item.key}
          >
            <HomeMedia media={item.media} />
            <p className={styles.kicker}>
              {item.kind === "testimony"
                ? "First-person testimony"
                : "Preserved documentation"}
            </p>
            {item.witness && <p className={styles.witness}>{item.witness}</p>}
            <h3>{item.title}</h3>
            {item.summary !== item.title && (
              <p className={styles.summary}>{item.summary}</p>
            )}
            <p className={styles.warning}>{item.warning}</p>
            <HomeSources sources={item.sources} />
            <JourneyLink href={item.href}>
              {item.kind === "testimony"
                ? "Read the testimony"
                : "Open the record with a content warning"}
            </JourneyLink>
          </article>
        ))}
      </div>
      <SectionState section={section} />
    </section>
  );
}
