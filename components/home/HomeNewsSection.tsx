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
import { homepageBand } from "@/lib/homepage-bands";
import { measureContentId } from "@/components/measurement/attrs";

const BAND = homepageBand("news");

/**
 * An editorial spread: the lead story with its picture, and a companion that
 * a phone sets as one compact row beside a thumbnail. Every field stays in the
 * document; the phone clamps what the preview shows and the record has the
 * rest.
 *
 * **The headline is the card's first element, in the DOM and on the screen.**
 * It used to be the fifth: picture, disclosure, "Credit" toggle, section
 * label, timestamp, *then* the headline. Four pieces of chrome stood between
 * a reader and the only thing that tells them whether the record is worth
 * opening, and a screen reader read all four before the story's name. The
 * order is headline → byline → picture → preview → sources → action here and
 * in every other band; `.byline` is the one metadata row the whole edition
 * uses, so the section label and the timestamp arrive together, after the
 * headline, in one 13px line.
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
            data-measure-id={`home-news-${item.key}`}
            data-measure-section="news"
            data-measure-content={measureContentId(item.key)}
            data-measure-type="publication"
            data-measure-placement={`news:${rankOf(index)}`}
            data-measure-card
          >
            {/* The edition's lead sets its headline over its own picture. A
                lead without a picture, and every companion, keeps the plain
                order: headline, byline, picture. */}
            {index === 0 && item.media ? (
              <HomeMedia
                media={item.media}
                lead
                overlay={
                  <>
                    <h3>
                      <a href={item.href}>{item.title}</a>
                    </h3>
                    <div className={styles.byline}>
                      <span>{item.category}</span>
                      <HomeTime date={item.date} updatedAt={item.updatedAt} includeTime />
                    </div>
                  </>
                }
              />
            ) : (
              <>
                <h3>
                  <a href={item.href}>{item.title}</a>
                </h3>
                <div className={styles.byline}>
                  <span>{item.category}</span>
                  <HomeTime date={item.date} updatedAt={item.updatedAt} includeTime />
                </div>
                <HomeMedia media={item.media} lead={index === 0} />
              </>
            )}
            <div className={styles.newsBody}>
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
            {/* VA-63. This compared the card's *label* to the string "Daily
                Brief" to pick a verb — a section rename would have silently
                changed what the link said. The verb is derived from the
                section now and carried on the preview. */}
            <JourneyLink href={item.href}>{item.cta ?? "Read the story"}</JourneyLink>
            </div>
          </article>
        ))}
      </div>
      <SectionState section={section} />
      {/* UX-05. The hub "everything" link is "All of <Section>" with the
          journey arrow, on every band; the words and the address come from the
          band map (`lib/homepage-bands.ts`), as the contents line's do. */}
      <SectionAction href={BAND.hubHref}>All of {BAND.label}</SectionAction>
    </section>
  );
}
