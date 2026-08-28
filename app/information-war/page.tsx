import type { Metadata } from "next";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";
import { SITE_URL } from "@/lib/site-config";

const TITLE = "This Is an Information War";
const DESCRIPTION =
  "How narratives become pressure, and how Lions of Zion turns public-source signals into traceable reporting.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL + "/information-war" },
  openGraph: {
    type: "website",
    title: TITLE + " — LIONS OF ZION",
    description: DESCRIPTION,
  },
};

export default function InformationWarPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: TITLE,
    description: DESCRIPTION,
    url: SITE_URL + "/information-war",
    publisher: { "@type": "Organization", name: "Lions of Zion" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <InformationWarSystem />
    </>
  );
}
