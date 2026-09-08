import type { Metadata } from "next";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";
import { SITE_URL } from "@/lib/site-config";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "How it works";
const HEADLINE = "This is an information war";
const DESCRIPTION =
  "See how Lions of Zion uses AI-scale research, OSINT, source provenance and human governance to investigate claims, trace narrative manipulation and publish a correctable public record.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/information-war",
});

export default function InformationWarPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: TITLE,
    headline: HEADLINE,
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
