import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { CorrectionHistory, type Correction } from "@/components/content";
import { StatusState } from "@/components/ui";
import { getCorrectionsLog } from "@/lib/content/corrections";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "The policy for handling errors, and the public record of every correction made.";
const PAGE_URL = `${SITE_URL}/corrections`;

export const metadata: Metadata = {
  title: "Corrections",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Corrections — LIONS OF ZION", description: TAGLINE },
};

/* A policy page, not an article — WebPage is the correct real schema.org
   type here. */
const CORRECTIONS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Corrections",
  url: PAGE_URL,
  description: TAGLINE,
  isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
};

/**
 * Three states, and the whole point of CORR-001 is that they are three.
 *
 * A public ledger that has recorded nothing and a ledger that failed to load
 * look identical unless someone makes them different, and the failure is the
 * one a reader must not mistake for a clean record — "no corrections" is a
 * claim about this organisation's accuracy, and it must never be made by a
 * broken fetch.
 */
type LedgerState =
  | { kind: "ready"; entries: Correction[] }
  | { kind: "unavailable" };

/**
 * `getCorrectionsLog()` cannot throw today — it returns a constant empty
 * array. The catch is not defensive clutter: it is the seam the page is
 * *designed against*, so the day the log is backed by the publications module
 * the failure state already exists, is already styled, and is already
 * distinct from the empty one. Building it later means shipping the wrong
 * state first.
 */
async function readLedger(): Promise<LedgerState> {
  try {
    const log = await getCorrectionsLog();
    return {
      kind: "ready",
      entries: log.map((entry) => ({
        date: entry.date,
        note: entry.note,
        version: entry.version,
        /* "When data permits", and not one step further. `page` is the human
           label for the corrected record; `slug` is whatever the seam ends up
           storing, and the seam is empty, so its shape is not yet decided.
           A row is only linked when the slug is already a site-relative path
           — anything else would mean this page inventing a route prefix on
           the log's behalf, and a "corrected record" link that resolves to
           nothing costs a ledger more credibility than a plain context line
           saves it. Everything else degrades to context. */
        href: entry.slug.startsWith("/") ? entry.slug : undefined,
        context: entry.page || undefined,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export default async function Page() {
  const ledger = await readLedger();
  const count = ledger.kind === "ready" ? ledger.entries.length : null;

  return (
    <DocPage routeId="corrections" title="Corrections" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(CORRECTIONS_JSON_LD) }}
      />
      <SectionBlock heading="Policy">
        <p>
          A network that verifies will still sometimes be wrong. When that
          happens, the correction is made as loud as the original claim: the
          item is amended in place, marked as corrected, and the change is
          announced through the same channels that carried the error.
          Corrected items are never quietly deleted — the record of the
          correction is part of the record. Full sourcing standards are on
          the <Link href="/methodology">Methodology</Link> page.
        </p>
      </SectionBlock>

      <SectionBlock heading="Correction log">
        <p>
          Every correction issued across the site appears here, dated, with
          what changed and — where the record is reachable — a link to it. If
          you have found something that belongs here,{" "}
          <Link href="/support-us#report">report the claim</Link> and it will
          be checked.
        </p>

        <div className={styles.ledger}>
          <div className={styles.ledgerHead}>
            <span className={styles.ledgerKicker}>Public ledger</span>
            <span className={styles.ledgerCount}>
              {count === null
                ? "Entries unavailable"
                : count === 1
                  ? "1 entry"
                  : `${count} entries`}
            </span>
          </div>

          {ledger.kind === "unavailable" ? (
            /* `status="error"` puts this on `role="alert"` and the danger
               ramp, and the sentence says outright that the absence of
               entries below is not a claim about the record. */
            <StatusState
              className={styles.ledgerState}
              status="error"
              eyebrow="Ledger unavailable"
              title="The correction log could not be loaded"
              description="This is a failure to read the log, not a statement that no corrections exist. Reload the page; if it keeps failing, report it and it will be looked at."
              actionText="Report the problem"
              actionHref="/support-us#report"
            />
          ) : count === 0 ? (
            /* Not the same thing, and not styled as though it were: a real
               record with nothing in it. `/methodology` says the same under
               Limitations, so an empty log is never read as a boast. */
            <StatusState
              className={styles.ledgerState}
              status="empty"
              eyebrow="Ledger loaded"
              title="No corrections recorded"
              description="The ledger loaded and holds nothing: no published item has needed a correction yet. That is a real record with nothing in it, not a placeholder — and not evidence that the standard has been tested."
              actionText="Read what this standard cannot do"
              actionHref="/methodology#limitations"
            />
          ) : (
            <CorrectionHistory corrections={ledger.entries} />
          )}
        </div>
      </SectionBlock>
    </DocPage>
  );
}
