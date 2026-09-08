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
import narrativeStyles from "./HomeNarrativesSection.module.css";
import { FAKE_RESISTANCE_GRAMMAR, FAKE_RESISTANCE_INTRO } from "@/lib/fake-resistance-grammar";

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
        {FAKE_RESISTANCE_INTRO}
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
          /* VA-52. These were nested ternaries here, so the words that
             distinguish a claim from an incident from an investigation lived in
             the component that happened to draw them. They are one map now, and
             the reason each type gets its own vocabulary is written down beside
             it: a documented incident must never read as a disputed claim. */
          const grammar = FAKE_RESISTANCE_GRAMMAR[item.kind];
          const statusMeaning =
            item.kind === "watch" ? status?.meaning : grammar.meaning;
          const kicker = grammar.kicker;
          const heading = item.kind === "watch" ? item.claim : item.title;
          return (
            <article
              key={item.key}
              className={`${styles.investigation} ${hasMedia ? "" : narrativeStyles.textLed}`}
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
              <div className={`${styles.dossier} ${narrativeStyles.dossierBody}`}>
                <p className={styles.kicker}>{kicker}</p>
                <h3>
                  <a href={item.href}>{heading}</a>
                </h3>
                {item.kind === "case" && distinctQuestion && (
                  <div className={narrativeStyles.researchQuestion}>
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
                {item.kind !== "article" && item.finding && (
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
                {/* VA-63. The verb came from the card's own shape, so the same
                    kind of record invited the reader differently depending on
                    which component drew it. `cta` is derived from the record's
                    section in `lib/publication-routing.ts` and carried on the
                    preview.

                    The fallback still distinguishes by kind rather than
                    collapsing to one verb: a snapshot serialized before the
                    field existed carries no `cta`, and turning every
                    investigation into one verb would lose exactly the
                    distinction this task exists to make. The words are the
                    UX-05 verb table's: an investigation is opened, a claim
                    record shows its evidence, ordinary reporting filed here
                    (antisemitism coverage) is read as a story.

                    One honest exception, decided here because the routing
                    cannot see it: an analysis that cites nothing has no
                    evidence to see, so it is read as an assessment. The basis
                    is read `=== "analysis"` — a row predating the field
                    carries none, and an absent value is the sourced side. */}
                <JourneyLink href={item.href}>
                  {item.kind === "watch" && item.basis === "analysis"
                    ? "Read the assessment"
                    : item.cta
                      ?? (item.kind === "case"
                        ? "Open the investigation"
                        : item.kind === "watch"
                          ? "See the evidence"
                          : "Read the story")}
                </JourneyLink>
              </div>
            </article>
          );
        })}
      </div>
      <SectionState section={section} />
      {/* UX-05. One form for going to the whole section: "All of <Section>"
          with the journey arrow. (VA-63 had settled on "View all"; the verb
          table replaces it everywhere at once.) */}
      <SectionAction href="/fake-resistance">All of Fake Resistance</SectionAction>
    </section>
  );
}
