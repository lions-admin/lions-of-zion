import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import {
  ClaimRecordPair,
  PublicationMeta,
  SourceList,
  VerificationBadge,
} from "@/components/content";
import { getFakeResistanceEdition } from "@/lib/content/fake-resistance";
import type { AssessmentValue } from "@/server/contracts/enums";
import styles from "./page.module.css";

/** Same wording VerificationBadge uses, so the stamp and the accessible
 *  badge underneath it never disagree. */
const STAMP_LABEL: Record<AssessmentValue, string> = {
  verified: "Verified",
  false: "False",
  misleading: "Misleading",
  manipulated: "Manipulated",
  out_of_context: "Out of context",
  contested: "Contested",
  unsupported: "Unsupported",
  unverified: "Unverified",
  satire: "Satire",
};

/** Exhibit letters, not sequence numbers — these three cases aren't steps in
 *  a process, they're separate items pulled into evidence. */
const exhibitLetter = (index: number) => String.fromCharCode(65 + index);

const TAGLINE =
  "Inside the influence machine: how manufactured outrage is built and amplified.";

export const metadata: Metadata = {
  title: "Fake Resistance",
  description: TAGLINE,
  openGraph: { title: "Fake Resistance — LIONS OF ZION", description: TAGLINE },
};

export default async function Page() {
  const edition = await getFakeResistanceEdition();

  return (
    <SectionPage
      id="fake-resistance"
      accent="ember"
      title="Fake Resistance"
      tagline={TAGLINE}
      surface="quiet"
    >
      <SectionBlock heading="The machine">
        <p>
          Manufactured outrage has a supply chain. A claim is seeded by a small
          set of originating accounts, picked up by amplifier networks that
          exist to move volume, laundered through accounts that look organic,
          and finally carried by real people who believe they found it
          themselves. Recycled imagery — footage from other conflicts, other
          years, other continents — is the raw material. This section maps
          that chain, link by link, in the campaigns that target Israel.
        </p>
      </SectionBlock>

      <SectionBlock heading="The tells">
        <p>
          A manufactured wave looks spontaneous from inside and mechanical
          from above. The recurring signatures:
        </p>
        <ul>
          <li>
            Identical or near-identical phrasing across accounts with no
            connection to each other.
          </li>
          <li>
            Synchronized timing — a claim erupting everywhere at once, rather
            than spreading outward from a source.
          </li>
          <li>
            Amplifier accounts created in the same narrow window, with thin
            histories and borrowed profile material.
          </li>
          <li>
            Imagery that reverse-image search traces to a different time and
            place.
          </li>
        </ul>
        <p>
          None of these alone is proof. Together, and documented, they are a
          pattern — and patterns can be shown.
        </p>
      </SectionBlock>

      <PublicationMeta
        edition={edition.edition}
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
        sourceCount={edition.sourceCount}
      />

      <SectionBlock heading="Case files">
        <p>
          Each documented campaign gets a file with the same structure: the
          claim as it spread, its point of origin, the amplification pattern,
          and the evidence that unmade it. The case files exist so that the
          next wave can be recognized from the last one — the machine changes
          its content far more often than it changes its method.
        </p>

        {edition.cases.map((c, i) => (
          <article key={c.id} id={c.id} className={styles.caseFile}>
            <span
              className={styles.stamp}
              data-tone={
                c.verdict === "verified"
                  ? "gold"
                  : c.verdict === "false" ||
                      c.verdict === "manipulated" ||
                      c.verdict === "misleading"
                    ? "ember"
                    : "muted"
              }
              aria-hidden="true"
            >
              {STAMP_LABEL[c.verdict]}
            </span>

            <div className={styles.caseFileHeader}>
              <span className={styles.exhibitTag}>Exhibit {exhibitLetter(i)}</span>
              <time dateTime={c.datetime}>{c.dateLabel}</time>
              <VerificationBadge assessment={c.verdict} />
            </div>
            <h3>{c.title}</h3>
            <ClaimRecordPair
              claim={c.claim}
              record={c.record}
              claimLabel="As it spread"
              recordLabel="What the record shows"
            />
            <ol className={styles.caseLog}>
              <li>
                <span className={styles.caseLogLabel}>Origin</span>
                <p>{c.origin}</p>
              </li>
              <li>
                <span className={styles.caseLogLabel}>Amplification</span>
                <p>{c.amplification}</p>
              </li>
            </ol>
            <div className={styles.caseFileTells}>
              <span>Tells exhibited</span>
              <ul>
                {c.tells.map((tell) => (
                  <li key={tell}>{tell}</li>
                ))}
              </ul>
            </div>
            <SourceList sources={c.sources} />
          </article>
        ))}
      </SectionBlock>
    </SectionPage>
  );
}
