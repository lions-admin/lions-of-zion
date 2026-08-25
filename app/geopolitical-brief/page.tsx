import type { Metadata } from "next";
import { GeopoliticalBrief } from "@/components/briefs/GeopoliticalBrief";
import { geopoliticalReferenceBrief as brief } from "@/components/briefs/geopolitical-reference";
import { SITE_URL } from "@/lib/site-config";

const TAGLINE =
  "The daily strategic picture: verified developments, their context, and what they change.";
const PAGE_URL = `${SITE_URL}/geopolitical-brief`;

export const metadata: Metadata = {
  title: "Geopolitical Brief",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Geopolitical Brief — LIONS OF ZION",
    description: TAGLINE,
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: brief.headline,
  description: TAGLINE,
  datePublished: brief.publishedAt,
  author: { "@type": "Organization", name: "Lions of Zion" },
  publisher: { "@type": "Organization", name: "Lions of Zion" },
  url: PAGE_URL,
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GeopoliticalBrief />
    </>
  );
}
