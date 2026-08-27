import type { Metadata } from "next";
import Link from "next/link";
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

/** The stamp's three tones follow `VerificationBadge`'s own colour families
 *  (`content.module.css`), so a case can never carry a grey stamp over an
 *  ember badge two lines below it — which is what Exhibit B did while the
 *  tone was computed from a three-value inline conditional. `satire` has no
 *  stamp tone of its own; muted is the honest place for it, since the point
 *  of the tone is whether the record refuted the claim. */
const STAMP_TONE: Record<AssessmentValue, "gold" | "ember" | "muted"> = {
  verified: "gold",
  false: "ember",
  misleading: "ember",
  manipulated: "ember",
  out_of_context: "ember",
  contested: "ember",
  unsupported: "muted",
  unverified: "muted",
  satire: "muted",
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

/** Day-level labels for the correction order. The cases' own `dateLabel` is
 *  month-level ("Oct 2023") because that is the honest resolution for when a
 *  claim was circulating; the correction has a day, and showing it is what
 *  makes the ordering visible instead of three identical rows. */
const correctionDateLabel = (datetime: string) =>
  new Date(`${datetime}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Exhibit letters, not sequence numbers — these three cases aren't steps in
 *  a process, they're separate items pulled into evidence. */
const exhibitLetter = (index: number) => String.fromCharCode(65 + index);

const TAGLINE =
  "Three worked cases of claims engineered to pass as war reporting — and the corrections that unmade them.";
const PAGE_URL = `${SITE_URL}/fake-resistance/official-narrative`;

export const metadata: Metadata = {
  title: "Official narrative engineering",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Official narrative engineering — LIONS OF ZION",
    description: TAGLINE,
  },
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
      surface="quiet"
      title="Official narrative engineering"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SectionBlock heading="Why this file exists">
        <p>
          This branch follows engineered claims into the official record — the
          material built to be mistaken for war reporting, picked up and moved
          at the speed of news, and what it took for the record to catch up.
          Each campaign below was corrected in public by a named verification
          desk, and the correction is cited on the file.
        </p>
        <p>
          The other side of the investigation — the influence networks
          themselves, mapped account by account — is a separate branch:{" "}
          <Link href="/fake-resistance/social-media">
            the social-media front
          </Link>
          .
        </p>
      </SectionBlock>

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
              data-tone={STAMP_TONE[c.verdict]}
              aria-hidden="true"
            >
              {STAMP_LABEL[c.verdict]}
            </span>

            {/* The exhibit and its sources are siblings so the case can become
                a two-track grid above 1220px and file the citation in the
                margin — `marginNote`, content.module.css. */}
            <div className={styles.caseFileMain}>
              <div className={styles.caseFileHeader}>
                <span className={styles.exhibitTag}>Exhibit {exhibitLetter(i)}</span>
                <time dateTime={c.datetime}>{c.dateLabel}</time>
                <VerificationBadge assessment={c.verdict} />
              </div>
              <h3 className={styles.caseTitle}>{c.title}</h3>
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
                <span className={styles.caseFileTellsLabel}>Tells exhibited</span>
                <ul>
                  {c.tells.map((tell) => (
                    <li key={tell}>{tell}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={styles.caseFileSources}>
              <SourceList sources={c.sources} />
            </div>
          </article>
        ))}
      </SectionBlock>

      {/* This block used to be headed "Claim propagation" and read the three
          dates as "the same synchronized-timing signature … visible across
          cases" — a coordination pattern inferred from three self-selected
          fact-check publication dates, which is the pattern-from-noise move
          this page spends the rest of its length teaching readers to
          distrust. The dates are what they always were; only the claim made
          about them is gone. The device was also inert: all three entries
          printed the same "Oct 2023" label, so the timeline showed three
          identical rows sorted by a value the reader never saw. Day-level
          labels come from the same `datetime` the sort uses, which is the
          cited fact-check's publication date — provably so for Exhibits A and
          C, whose source URLs carry it. */}
      <SectionBlock heading="Order of correction">
        <p>
          The three files above, in the order each was corrected. The date is
          the publication date of the fact-check cited on that file — the
          record catching up, not the claim spreading. Three corrections
          landing inside one week is what a heavy week of fact-checking looks
          like; on its own it is not evidence that the three campaigns were
          run together, and this page does not claim it is.
        </p>
        <Timeline
          variant="spread"
          entries={[...edition.cases]
            .sort((a, b) => a.datetime.localeCompare(b.datetime))
            .map((c) => ({
              id: `${c.id}-spread`,
              datetime: c.datetime,
              dateLabel: correctionDateLabel(c.datetime),
              title: c.title,
              body: `Exhibit ${exhibitLetter(edition.cases.indexOf(c))} — flagged and corrected by the source cited below.`,
              assessment: c.verdict,
              sources: c.sources,
            }))}
        />
      </SectionBlock>

      <PublicationMeta
        edition={edition.edition}
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
        sourceCount={edition.sourceCount}
      />
    </SectionPage>
  );
}
