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
 * Fake Resistance contains three distinct editorial shapes: Narrative Watch,
 * influence investigations, and ordinary reporting filed to the desk (for
 * example antisemitism coverage). The section metadata decides which one a
 * record is; absence of Narrative Watch details never manufactures a case.
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
          const hasMedia = Boolean(item.media);
          const distinctQuestion =
            item.kind === "case" && item.question && item.question.trim() !== item.title.trim()
              ? item.question
              : undefined;
          const statusLabel =
            item.kind === "watch"
              ? status?.label
              : item.kind === "case"
                ? "Research case"
                : item.label;
          const statusMeaning =
            item.kind === "watch"
              ? status?.meaning
              : item.kind === "case"
                ? "Findings carry their own confidence and limitations."
                : "Editorial reporting filed to the Fake Resistance desk.";
          const kicker =
            item.kind === "watch"
              ? "Claim in circulation"
              : item.kind === "case"
                ? "Influence investigation"
                : item.label;
          const heading = item.kind === "watch" ? item.claim : item.title;
          return (
            <article
              key={item.key}
              className={styles.investigation}
              data-home-record={item.key}
              data-rank={rankOf(index)}
              data-kind={item.kind}
              data-has-media={hasMedia ? "true" : "false"}
            >
              <header className={styles.dossierStatus}>
                <p className={styles.verdict} data-tone={status?.tone ?? "neutral"}>
                  <span className={styles.verdictLabel}>{statusLabel}</span>
                  <span className={styles.verdictMeaning}>{statusMeaning}</span>
                </p>
                <HomeTime date={item.date} includeTime />
              </header>
              {item.media && (
                <div className={styles.dossierCover}>
                  <HomeMedia media={item.media} />
                </div>
              )}
              <div className={styles.dossier}>
                <p className={styles.kicker}>{kicker}</p>
                <h3>
                  <a href={item.href}>{heading}</a>
                </h3>
                {item.kind === "case" && distinctQuestion && (
                  <div className={styles.researchQuestion}>
                    <span>Research question</span>
                    <p className={styles.summary}>
                      <PreviewText
                        text={distinctQuestion}
                        budget={PREVIEW_BUDGET[rankOf(index)]}
                      />
                    </p>
                  </div>
                )}
                {item.kind === "article" && item.summary && (
                  <p className={styles.summary}>
                    <PreviewText
                      text={item.summary}
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
                ) : item.kind === "watch" && item.basis === "analysis" ? (
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
                    : item.kind === "watch"
                      ? item.basis === "analysis"
                        ? "Read the analysis"
                        : "Read the assessment"
                      : "Read the article"}
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