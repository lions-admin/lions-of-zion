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
import { homepageBand } from "@/lib/homepage-bands";
import { measureContentId } from "@/components/measurement/attrs";

const BAND = homepageBand("october7");

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
            data-measure-id={`home-october-7-${item.key}`}
            data-measure-section="october-7"
            data-measure-content={measureContentId(item.key)}
            data-measure-type="publication"
            data-measure-card
            data-rank={rankOf(index)}
          >
            {/* The title is a link. It was the only record heading on the
                homepage that was not — a reader met an archive card whose
                headline did nothing, under which the "Source: …" citation was
                underlined, so the one thing that looked pressable was the
                citation and not the record. Both of the card's ways in now
                point at the same address: the heading, and the primary
                action below it. */}
            <h3>
              <a href={item.href}>{item.title}</a>
            </h3>
            {/* The kind and the witness are the card's byline, in the row
                every band's metadata uses — after the headline, never in
                front of it. */}
            <div className={styles.byline}>
              <span>
                {item.kind === "testimony"
                  ? "First-person testimony"
                  : "Preserved documentation"}
              </span>
              {item.witness && (
                <span className={styles.witness}>{item.witness}</span>
              )}
            </div>
            <HomeMedia media={item.media} />
            {!sameText(item.summary, item.title) && (
              <p className={styles.summary}>
                <PreviewText
                  text={item.summary}
                  budget={PREVIEW_BUDGET[rankOf(index)]}
                />
              </p>
            )}
            {/* The content note is its own labeled callout, not another line
                of body copy — so it reads as a warning, not as a continuation
                of the summary above it, and the action below it stands clear
                of both. */}
            <p className={styles.warning}>
              <span className={styles.warningLabel}>Content note</span>
              {item.warning}
            </p>
            <HomeSources sources={item.sources} />
            {/* UX-05 verb table: a testimony is read; a documented record
                behind a warning is opened with that warning named. */}
            <JourneyLink href={item.href}>
              {item.kind === "testimony"
                ? "Read the testimony"
                : "Open with a content warning"}
            </JourneyLink>
          </article>
        ))}
      </div>
      <SectionState section={section} />
      {/* UX-05. One form for going to the whole section: "All of <Section>"
          with the journey arrow. */}
      <SectionAction href={BAND.hubHref}>All of {BAND.label}</SectionAction>
    </section>
  );
}
