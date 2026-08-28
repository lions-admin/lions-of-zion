import type { Metadata } from "next";
import { LiveBriefHub } from "@/components/briefs/LiveBriefHub";
import { SITE_URL } from "@/lib/site-config";

const TAGLINE =
  "The Daily Brief: current news, analysis, and source-linked narrative watch on Israel and the war.";
const PAGE_URL = `${SITE_URL}/geopolitical-brief`;

export const metadata: Metadata = {
  title: "The Daily Brief",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "The Daily Brief — LIONS OF ZION",
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
  about: [
    { "@type": "Thing", name: "Current news" },
    { "@type": "Thing", name: "Narrative watch" },
  ],
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
