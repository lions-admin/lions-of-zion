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
  "Published narrative monitoring, claims circulating on X and research into incitement — with source context and assessment status.";
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

      <SectionBlock heading="Read the claim. Check the source.">
        <p>This is the published monitoring record, not a live scanner. Follow source-linked claims, including material circulating on X, and research into narratives and incitement. Dates show when records were published, not when a scan last ran.</p>
        <p>Each record carries its assessment status. Sourced reporting and the organisation’s own analysis are distinct; a claim under review is not a settled finding. For deeper research, explore <Link href="/fake-resistance/social-media">influence networks</Link> and <Link href="/fake-resistance/official-narrative">documented narrative investigations</Link>.</p>
      </SectionBlock>

      <SectionBlock heading={`${items.length} published record${items.length === 1 ? "" : "s"}`}>
        {items.length === 0 ? (
          <p className={styles.empty}>
            {recordUnavailable
              ? "The published monitoring feed could not be loaded. Please try again later."
              : "No published monitoring records were returned for this read."}
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
                      <span>Published</span>
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
