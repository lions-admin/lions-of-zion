import type { HomepageEdition } from "@/server/contracts/homepage";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import { ResearchText } from "@/components/content/ResearchText";
import {
  HomeMedia,
  HomeTime,
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

/**
 * Fake Resistance, as it is named everywhere else on the site. Each record is
 * a dossier that reads status → claim → finding → sources, and says each
 * thing once: an unresolved record's status already says no finding has been
 * reached, so it carries no finding block repeating that.
 */
export function HomeNarrativesSection({
  section,
}: {
  section: HomepageEdition["fakeResistance"];
}) {
  return (
    <section
      id="home-narratives"
      className={`${styles.section} ${styles.editorial} ${styles.investigations}`}
      aria-labelledby="home-narratives-title"
      data-home-section="fakeResistance"
    >
      <SectionHeading
        id="home-narratives-title"
        kicker="Narratives & fact checks"
        title="Fake Resistance"
      />
      <p className={styles.sectionIntro}>
        What circulates is not always what the evidence establishes. Read the
        status before the claim.
      </p>
      <div className={styles.narrativeSpread}>
        {section.items.map((item, index) => {
          const status =
            item.kind === "watch"
              ? VERIFICATION_STATES[
                  item.verification as keyof typeof VERIFICATION_STATES
                ]
              : null;
          return (
            <article
              key={item.key}
              className={styles.investigation}
              data-home-record={item.key}
              data-rank={rankOf(index)}
              data-kind={item.kind}
            >
              <header className={styles.dossierStatus}>
                <p className={styles.verdict} data-tone={status?.tone ?? "neutral"}>
                  <span className={styles.verdictLabel}>{status?.label ?? "Research case"}</span>
                  <span className={styles.verdictMeaning}>
                    {status?.meaning ?? "Findings carry their own confidence and limitations."}
                  </span>
                </p>
                <HomeTime date={item.date} includeTime />
              </header>
              <div className={styles.dossierCover}>
                <HomeMedia media={item.media} />
              </div>
              <div className={styles.dossier}>
                <p className={styles.kicker}>
                  {item.kind === "watch"
                    ? "Claim in circulation"
                    : "Research question"}
                </p>
                <h3>
                  <a href={item.href}>
                    {item.kind === "watch" ? item.claim : item.title}
                  </a>
                </h3>
                {item.kind === "case" && (
                  <p className={styles.summary}>
                    <PreviewText
                      text={item.question}
                      budget={PREVIEW_BUDGET[rankOf(index)]}
                    />
                  </p>
                )}
                {item.finding && (
                  <div className={styles.finding}>
                    <span>
                      {item.kind === "watch" ? "Finding" : "From the research"}
                    </span>
                    <p>
                      <ResearchText>{item.finding}</ResearchText>
                    </p>
                  </div>
                )}
                {item.kind === "case" ? (
                  <p className={styles.sources}>
                    {item.sourceCount} sources in the case · source count is
                    not a verdict
                  </p>
                ) : item.basis === "analysis" ? (
                  <p className={styles.sources}>
                    Lions of Zion editorial analysis · No source-backed finding
                    is implied.
                  </p>
                ) : item.sources.length ? (
                  <HomeSources sources={item.sources} />
                ) : (
                  <p className={styles.sources}>
                    No source link is available in this preview.
                  </p>
                )}
                <JourneyLink href={item.href}>
                  {item.kind === "case"
                    ? "Read the investigation"
                    : item.basis === "analysis"
                      ? "Read the analysis"
                      : "Read the assessment"}
                </JourneyLink>
              </div>
            </article>
          );
        })}
      </div>
      <SectionState section={section} />
      <SectionAction href="/fake-resistance">Explore Fake Resistance</SectionAction>
    </section>
  );
}
