import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { VerificationBadge, PublicationMeta, SourceList, CorrectionHistory } from "@/components/content";
import { getWarUpdateEdition } from "@/lib/content/war-update";
import styles from "./page.module.css";

const TAGLINE =
  "Sourced, time-stamped updates from the front and the home front.";

export const metadata: Metadata = {
  title: "War Update",
  description: TAGLINE,
  openGraph: { title: "War Update — LIONS OF ZION", description: TAGLINE },
};

/**
 * Wire-service dateline for each entry — the place named in that entry's own
 * sourced body text, nothing inferred. An entry with no stated place (e.g.
 * "the UN Security Council adopts...", with no city in the sourced copy)
 * gets no dateline place, not a guessed one — a wire report can run
 * date-only; it does not run with an invented city.
 */
const DATELINES: Record<string, string> = {
  "plan-announced": "WASHINGTON",
  "ceasefire-signed": "SHARM EL-SHEIKH",
  "ceasefire-effective": "GAZA",
  "hostages-released": "GAZA",
};

export default async function Page() {
  const edition = await getWarUpdateEdition();

  return (
    <SectionPage id="war-update" title="War Update" tagline={TAGLINE} surface="quiet">
      <SectionBlock heading="Trust">
        <p className={styles.advisory}>
          <span className={styles.advisoryLabel}>Editor’s note —</span>{" "}
          {edition.trustStrip}
        </p>
        <p>
          Full sourcing standards and the corrections policy live on the{" "}
          <Link href="/methodology">Methodology</Link> page.
        </p>
      </SectionBlock>

      <PublicationMeta
        edition={edition.edition}
        publishedAt={edition.publishedAt}
        coverageWindow={edition.coverageWindow}
        reviewedBy={edition.reviewedBy}
        sourceCount={edition.sourceCount}
      />

      <SectionBlock heading={`Documented milestones · ${edition.coverageWindow}`}>
        <ol className={styles.wire}>
          {edition.entries.map((entry) => {
            const place = DATELINES[entry.id];
            return (
              <li key={entry.id} id={entry.id} className={styles.dispatch}>
                <p className={styles.byline}>
                  {place ? <span className={styles.datelinePlace}>{place}</span> : null}
                  {place ? <span aria-hidden="true"> — </span> : null}
                  <time dateTime={entry.datetime}>{entry.dateLabel.toUpperCase()}</time>
                  {entry.category ? (
                    <span className={styles.category}>{entry.category}</span>
                  ) : null}
                  {entry.assessment ? <VerificationBadge assessment={entry.assessment} /> : null}
                </p>
                <h3 className={styles.headline}>{entry.title}</h3>
                <div className={styles.wireBody}>{entry.body}</div>
                {entry.sources?.length ? (
                  <div className={styles.dispatchSources}>
                    <SourceList sources={entry.sources} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </SectionBlock>

      <SectionBlock heading="Source stack">
        <SourceList sources={edition.sources} />
      </SectionBlock>

      <CorrectionHistory corrections={edition.corrections} />
    </SectionPage>
  );
}
