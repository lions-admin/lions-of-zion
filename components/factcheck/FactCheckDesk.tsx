import Link from "next/link";
import { StatusState } from "@/components/ui/StatusState";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { ClaimEntry } from "./ClaimEntry";
import styles from "./fact-check.module.css";

export const FACT_CHECK_PATH = "/fact-check";

export interface FactCheckDeskProps {
  /** Narrative Watch records, newest first. */
  records: PublicPublication[];
  /** Full records by `publicId`, for the rows deep enough in the page to warrant the read. */
  details: Map<string, PublicPublicationDetail>;
  unavailable: boolean;
}

export function FactCheckDesk({ records, details, unavailable }: FactCheckDeskProps) {
  return (
    <div className={styles.desk}>
      {unavailable ? (
        <StatusState
          eyebrow="DESK STATUS"
          title="The published record could not be read."
          description="This is a fault on our side, not an empty desk. Published checks are unaffected and return when the read succeeds."
          actionText="Try again"
          actionHref={FACT_CHECK_PATH}
        />
      ) : records.length === 0 ? (
        <StatusState
          eyebrow="DESK STATUS"
          title="No claim has been checked and published yet."
          description="A check appears here only once it has cleared the evidence and quality gates. This page never carries a worked example invented to fill it."
          actionText="How a claim is checked"
          actionHref="/information-war#system"
        />
      ) : (
        <ol className={styles.entries}>
          {records.map((record, index) => (
            <ClaimEntry
              key={record.publicId}
              record={record}
              detail={details.get(record.publicId)}
              /* The newest check opens on arrival: it is what a reader who
                 followed a link here came for, and one open row is the page
                 showing its work rather than asking to be clicked. */
              open={index === 0}
              /* `--stagger` caps a sequence at four steps. */
              index={Math.min(index, 3)}
            />
          ))}
        </ol>
      )}

      <FactCheckLimits />
    </div>
  );
}

/**
 * What this page cannot show you.
 *
 * The interesting half of the assessment model is staff-only and has no public
 * projection: the ten confidence dimensions in `server/modules/assessments/`,
 * the evidence-link table, the reviewer identities, the internal analysis field
 * that the importer deliberately never publishes. The design pressure is to
 * invent a UI for that data anyway — a confidence dial, a five-bar meter, an
 * evidence graph — and every one of those would be a picture of numbers this
 * page does not have.
 *
 * So the boundary is stated instead, in the reader's language, as part of the
 * page rather than as a disclaimer under it. Naming what is withheld is the
 * cheapest trust this desk can buy, and it is the same standard it applies to
 * everyone else.
 */
function FactCheckLimits() {
  return (
    <section className={styles.limits} aria-labelledby="fact-check-limits">
      <h2 className={styles.limitsHeading} id="fact-check-limits">
        What this page does not show
      </h2>
      <ul className={styles.limitsList}>
        <li>
          <strong>The confidence breakdown.</strong> Each assessment is scored
          across ten separate dimensions &mdash; source independence, media
          provenance, temporal and geographic consistency, translation certainty
          and six more. Only the single summary reaches the public record, so
          only the summary appears here.
        </li>
        <li>
          <strong>The evidence records themselves.</strong> Supporting and
          contradicting material is linked to each claim in a table that is not
          public. Where a record holds such material, this page says how much and
          does not show it.
        </li>
        <li>
          <strong>Who reviewed it.</strong> Every published assessment has passed
          a second person. Their identity is not part of the public record.
        </li>
      </ul>
      <p className={styles.limitsNote}>
        The chain that <em>is</em> public runs from each statement to the sources
        it cites, and that is what the ladders above draw. The rules those checks
        run under are set out in the{" "}
        <Link href="/methodology">methodology</Link>, and every correction we have
        made is in the <Link href="/corrections">corrections log</Link>.
      </p>
    </section>
  );
}
