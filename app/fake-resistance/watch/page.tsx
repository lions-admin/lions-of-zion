import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { NarrativeRecord } from "@/components/briefs/NarrativeRecord";
import { getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "Published narrative monitoring, claims circulating on X and research into incitement — with source context and assessment status.";
const PAGE_URL = `${SITE_URL}/fake-resistance/watch`;

export const metadata: Metadata = {
  title: "Narrative monitoring archive",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "The daily watch — LIONS OF ZION", description: TAGLINE },
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
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
    name: "Narrative monitoring archive",
    description: TAGLINE,
    url: PAGE_URL,
    author: { "@type": "Organization", name: "Lions of Zion", url: SITE_URL },
    isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
  };

  return (
    <SectionPage
      id="fake-resistance"
      breadcrumb={[{ href: "/fake-resistance", label: "Narratives & fact checks" }]}
      accent="ember"
      surface="quiet"
      register="silent"
      title="Narrative monitoring archive"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p id="monitoring-archive">Published monitoring, grouped by publication date — not a live scan log. Assessment status is shown before every claim.</p>
      <p><Link href="/fake-resistance">Return to the narrative desk</Link> · <Link href="/geopolitical-brief">Read the news</Link></p>
      {recordUnavailable ? <p className={styles.empty} role="alert">The published monitoring feed could not be loaded. Please try again later.</p>
        : !items.length ? <p className={styles.empty}>No published monitoring records are available.</p>
        : [...new Set(items.map((item) => dayKey(item.publishedAt)))].sort().reverse().map((day) => (
          <SectionBlock key={day} heading={formatDate(items.find((item) => dayKey(item.publishedAt) === day)!.publishedAt)}>
            {items.filter((item) => dayKey(item.publishedAt) === day).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map((item) => <NarrativeRecord key={item.publicId} item={item} />)}
          </SectionBlock>
        ))}
      <p className={styles.empty}>Showing up to 25 recent published monitoring records. <Link href="/fake-resistance/social-media">Explore the research archive</Link> for longer investigations.</p>
    </SectionPage>
  );
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
