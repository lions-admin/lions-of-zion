import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { StatusState } from "@/components/ui/StatusState";
import { SITE_URL } from "@/lib/site-config";
import { listBriefingPublications } from "@/lib/publications";
import styles from "./page.module.css";

const TAGLINE =
  "Live, source-linked updates on Israel's war and regional security.";

export const metadata: Metadata = {
  title: "War Update",
  description: TAGLINE,
  alternates: { canonical: `${SITE_URL}/war-update` },
  openGraph: {
    title: "War Update — LIONS OF ZION",
    description: TAGLINE,
    type: "website",
  },
};

export default async function Page() {
  let publishedUpdates: Awaited<ReturnType<typeof listBriefingPublications>> = [];
  let unavailable = false;
  try {
    publishedUpdates = await listBriefingPublications("?section=war_update&limit=12");
  } catch {
    unavailable = true;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "War Update",
    description: TAGLINE,
    publisher: { "@type": "Organization", name: "Lions of Zion" },
    url: `${SITE_URL}/war-update`,
  };

  return (
    <SectionPage id="war-update" title="War Update" tagline={TAGLINE} surface="quiet">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {unavailable ? (
        <StatusState
          status="error"
          eyebrow="SERVICE STATUS"
          title="War updates are temporarily unavailable."
          description="The published record is intact. This page could not read it just now."
          actionText="Read the Daily Brief"
          actionHref="/geopolitical-brief"
        />
      ) : publishedUpdates.length ? (
        <SectionBlock heading="Latest published updates">
          <ol className={styles.publishedUpdates}>
            {publishedUpdates.map((update) => (
              <li key={update.publicId}>
                <Link href={`/articles/${update.publicId}`}>
                  <time dateTime={update.publishedAt}>{formatDate(update.publishedAt)}</time>
                  <strong>{update.title}</strong>
                  {update.summary ? <span>{update.summary}</span> : null}
                </Link>
              </li>
            ))}
          </ol>
        </SectionBlock>
      ) : (
        <StatusState
          status="empty"
          eyebrow="LIVE WAR DESK"
          title="No verified war update has been published yet."
          description="This page carries only source-linked updates that have completed the briefing pipeline. It will not display sample or historical placeholder material."
          actionText="Read the Daily Brief"
          actionHref="/geopolitical-brief"
        />
      )}
    </SectionPage>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}
