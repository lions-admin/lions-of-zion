import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import {
  Card,
  CardCta,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { SECTION_LABELS, TREND_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { isAnalysisBasis, type NarrativeWatchDetails } from "@/server/contracts/publication";
import { getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "Narratives flagged and answered in the last 24 hours, straight from source monitoring — provisional until the record catches up, not a case file.";
const PAGE_URL = `${SITE_URL}/fake-resistance/watch`;

export const metadata: Metadata = {
  title: "The daily watch",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "The daily watch — LIONS OF ZION", description: TAGLINE },
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

/** Splits the "Reported claim: " / "Analysis: " prefix `narrativeWatchTitle()`
 * wrote off the title, so it renders as a kicker rather than the headline's
 * first two words. Display-side only — mirrors the same split in
 * `components/briefs/LiveBriefHub.tsx`; neither writes a prefix. */
function splitTitle(title: string): { kicker: string | null; rest: string } {
  const match = /^(Reported claim|Analysis):\s*/.exec(title);
  if (!match) return { kicker: null, rest: title };
  return { kicker: match[1]!, rest: title.slice(match[0].length) };
}

export default async function Page() {
  /* An unreadable projection and an empty feed are different facts, and the
     empty state below says which. Letting this throw would 500 the page over
     a five-minute cache hiccup — the same reasoning as app/page.tsx's own
     `featuredPublications()` call. */
  let items: Awaited<ReturnType<typeof getNarrativeWatchFeed>> = [];
  let recordUnavailable = false;
  try {
    items = await getNarrativeWatchFeed();
  } catch (cause) {
    recordUnavailable = true;
    console.error(
      "[fake-resistance/watch] public projection unavailable",
      cause instanceof Error ? cause.message : cause,
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "The daily watch",
    description: TAGLINE,
    url: PAGE_URL,
    author: { "@type": "Organization", name: "Lions of Zion", url: SITE_URL },
    isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
  };

  return (
    <SectionPage
      id="fake-resistance"
      breadcrumb={[{ href: "/fake-resistance", label: "Fake Resistance" }]}
      accent="ember"
      surface="quiet"
      title="The daily watch"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SectionBlock heading="What this branch holds">
        <p>
          This is the live half of the investigation. Every record below
          cleared this platform&rsquo;s automated quality gate the day it was
          flagged — sourced where a narrative could be checked against real
          reporting, or marked plainly as this organisation&rsquo;s own
          analysis where it could not. No human has reviewed these yet.
        </p>
        <p>
          The other half —{" "}
          <Link href="/fake-resistance/social-media">seven networks</Link>{" "}
          and{" "}
          <Link href="/fake-resistance/official-narrative">
            three engineered claims
          </Link>
          , each verified and written up after the fact — is a different,
          higher bar on purpose. A record graduates there by being read
          closely, not by being recent.
        </p>
      </SectionBlock>

      <SectionBlock heading={`${items.length} record${items.length === 1 ? "" : "s"} tracked`}>
        {items.length === 0 ? (
          <p className={styles.empty}>
            {recordUnavailable
              ? "This feed is temporarily unavailable. It will return on its own — nothing published is lost."
              : "Nothing is being tracked right now. Check back after the next scan."}
          </p>
        ) : (
          <ul className={styles.fileIndex}>
            {items.map((item) => {
              const details = item.narrativeWatchDetails as NarrativeWatchDetails | null;
              const { kicker, rest } = splitTitle(item.title);
              const analysis = details ? isAnalysisBasis(details) : false;
              return (
                <li key={item.publicId}>
                  <Card variant="row" href={`/articles/${item.publicId}`} className={styles.fileRow}>
                    <CardHeader>
                      <CardEyebrow>{kicker ?? SECTION_LABELS[item.section]}</CardEyebrow>
                    </CardHeader>
                    <CardTitle>{rest}</CardTitle>
                    {item.summary ? <CardDescription>{item.summary}</CardDescription> : null}
                    {details ? (
                      <dl className={styles.claimRecord}>
                        <dt>Claim</dt>
                        <dd>{details.exactClaim}</dd>
                        <dt>Trend</dt>
                        <dd>{TREND_LABELS[details.trendDirection]}</dd>
                        <dt>Status</dt>
                        <dd>{VERIFICATION_STATES[details.verificationState].label}</dd>
                        {analysis ? (
                          <>
                            <dt>Basis</dt>
                            <dd>Organisation analysis, no source cited</dd>
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                    <p className={styles.fileEvidence}>
                      <span>Flagged</span>
                      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
                    </p>
                    <CardCta>Read the record</CardCta>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </SectionBlock>
    </SectionPage>
  );
}
