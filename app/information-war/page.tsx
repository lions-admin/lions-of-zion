import type { Metadata } from "next";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";
import { SITE_URL } from "@/lib/site-config";
import { pageMetadata } from "@/lib/page-metadata";

/* VA-51, and a deliberate narrowing of IW-002.
 *
 * This destination answered to three names: "How it works" in the chrome,
 * "This is an information war" in the tab, and "Why this work matters" on the
 * homepage cover. A reader could not predict where any of them led, and none of
 * them was wrong — they were just three.
 *
 * The owner's ruling (2026-09-08) is that the menu label wins, so **the name**
 * is "How it works" wherever the destination is referred to: chrome, homepage,
 * browser tab, Open Graph.
 *
 * IW-002 asked that the tab and the visual heading read the same sentence. That
 * still holds for its purpose — a reader is never shown a name they did not
 * click — but it is now satisfied by the *link* and the tab agreeing rather
 * than by the tab and the `h1`. The heading stays "This is an information war."
 * because it is the page's editorial statement, set as designed type in
 * `InformationWarSystem`, and a headline is not a label. Renaming it would cost
 * the page its voice to solve a navigation problem the title already solves. */
const TITLE = "How it works";
/** The editorial heading, kept as the page's own sentence rather than its name. */
const HEADLINE = "This is an information war";
const DESCRIPTION =
  "Explore how Lions of Zion collects sources, researches claims, publishes reporting and preserves documentation — with an interactive map of the system and its limits.";

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
