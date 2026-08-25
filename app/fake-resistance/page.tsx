import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import {
  ClaimRecordPair,
  PublicationMeta,
  SourceList,
  Timeline,
  VerificationBadge,
} from "@/components/content";
import { getFakeResistanceEdition } from "@/lib/content/fake-resistance";
import { SITE_URL } from "@/lib/site-config";
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

/** schema.org/ClaimReview's reviewRating is a 1–5 scale, not this site's own
 *  9-value vocabulary — this is the one honest translation between them,
 *  used only for the JSON-LD, never for on-page display. */
const CLAIM_REVIEW_RATING: Record<AssessmentValue, { ratingValue: number; alternateName: string }> = {
  verified: { ratingValue: 5, alternateName: "True" },
  false: { ratingValue: 1, alternateName: "False" },
  manipulated: { ratingValue: 1, alternateName: "False" },
  misleading: { ratingValue: 2, alternateName: "Mostly False" },
  out_of_context: { ratingValue: 2, alternateName: "Misleading" },
  unsupported: { ratingValue: 2, alternateName: "Unsupported" },
  contested: { ratingValue: 3, alternateName: "Disputed" },
  unverified: { ratingValue: 3, alternateName: "Unverified" },
  satire: { ratingValue: 3, alternateName: "Satire" },
};

/** Exhibit letters, not sequence numbers — these three cases aren't steps in
 *  a process, they're separate items pulled into evidence. */
const exhibitLetter = (index: number) => String.fromCharCode(65 + index);

const TAGLINE =
  "Inside the influence machine: how manufactured outrage is built and amplified.";
const PAGE_URL = `${SITE_URL}/fake-resistance`;

export const metadata: Metadata = {
  title: "Fake Resistance",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Fake Resistance — LIONS OF ZION", description: TAGLINE },
};

export default async function Page() {
  const edition = await getFakeResistanceEdition();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": edition.cases.map((c) => ({
      "@type": "ClaimReview",
      url: `${PAGE_URL}#${c.id}`,
      datePublished: c.datetime,
      claimReviewed: c.claim,
      itemReviewed: {
        "@type": "Claim",
        // No `author` — these claims spread through anonymous/unattributed
        // accounts; asserting a claimant identity we don't have would be
        // exactly the kind of invented fact this dataset avoids.
        datePublished: c.datetime,
        appearance: c.sources.map((s) => s.url).filter(Boolean),
      },
      author: {
        "@type": "Organization",
        name: "Lions of Zion",
        url: SITE_URL,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: CLAIM_REVIEW_RATING[c.verdict].ratingValue,
        bestRating: 5,
        worstRating: 1,
        alternateName: CLAIM_REVIEW_RATING[c.verdict].alternateName,
      },
    })),
  };

  return (
    <SectionPage
      id="fake-resistance"
      accent="ember"
      title="Fake Resistance"
      tagline={TAGLINE}
      surface="quiet"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

      <SectionBlock heading="Claim propagation">
        <p>
          Three separate campaigns, flagged within four days of each other —
          the same synchronized-timing signature “The tells” describes above,
          visible across cases rather than within one.
        </p>
        <Timeline
          variant="spread"
          entries={[...edition.cases]
            .sort((a, b) => a.datetime.localeCompare(b.datetime))
            .map((c) => ({
              id: `${c.id}-spread`,
              datetime: c.datetime,
              dateLabel: c.dateLabel,
              title: c.title,
              body: `Exhibit ${exhibitLetter(edition.cases.indexOf(c))} — flagged and corrected by the source cited below.`,
              assessment: c.verdict,
              sources: c.sources,
            }))}
        />
      </SectionBlock>
    </SectionPage>
  );
}
