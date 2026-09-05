import type { Metadata } from "next";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";
import { SITE_URL } from "@/lib/site-config";

/* Sentence case, matching the page's own heading — the browser tab, the
   accessible name and the visual heading all read the same sentence
   (IW-002). The trailing period stays on the heading, not the title: a
   `<title>` is a name, not a sentence. */
const TITLE = "This is an information war";
const DESCRIPTION =
  "Explore how Lions of Zion collects sources, researches claims, publishes reporting and preserves documentation — with an interactive map of the system and its limits.";

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
