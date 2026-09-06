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

/** A record whose excerpt is only its own title again is not printed twice. */
const sameText = (a: string, b: string) =>
  a.trim().replace(/[.\s]+$/, "").toLowerCase() ===
  b.trim().replace(/[.\s]+$/, "").toLowerCase();

export function HomeArchiveSection({
  section,
}: {
  section: HomepageEdition["october7"];
}) {
  return (
    <section
      id="home-archive"
      className={`${styles.section} ${styles.editorial} ${styles.archive}`}
      aria-labelledby="home-archive-title"
      data-home-section="october7"
    >
      <SectionHeading
        id="home-archive-title"
        kicker="October 7, 2023"
        title="The record remains."
      />
      <div className={styles.archiveSpread}>
        {section.items.map((item, index) => (
          <article
            key={item.key}
            data-kind={item.kind}
            data-home-record={item.key}
            data-rank={rankOf(index)}
          >
            <HomeMedia media={item.media} />
            <p className={styles.kicker}>
              {item.kind === "testimony"
                ? "First-person testimony"
                : "Preserved documentation"}
            </p>
            {item.witness && <p className={styles.witness}>{item.witness}</p>}
            <h3>{item.title}</h3>
            {!sameText(item.summary, item.title) && (
              <p className={styles.summary}>
                <PreviewText
                  text={item.summary}
                  budget={PREVIEW_BUDGET[rankOf(index)]}
                />
              </p>
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
      <SectionAction href="/october-7">Explore the October 7 Archive</SectionAction>
    </section>
  );
}
