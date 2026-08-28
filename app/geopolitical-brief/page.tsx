import type { Metadata } from "next";
import { LiveBriefHub } from "@/components/briefs/LiveBriefHub";
import { SITE_URL } from "@/lib/site-config";

const TAGLINE =
  "A daily brief with current news, analysis, and source-linked monitoring of false narratives and fake news.";
const PAGE_URL = `${SITE_URL}/geopolitical-brief`;

export const metadata: Metadata = {
  title: "Daily Brief & Updates",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Daily Brief & Updates — LIONS OF ZION",
    description: TAGLINE,
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "The Daily Brief",
  description: TAGLINE,
  publisher: { "@type": "Organization", name: "Lions of Zion" },
  url: PAGE_URL,
};

export default async function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LiveBriefHub />
    </>
  );
}
