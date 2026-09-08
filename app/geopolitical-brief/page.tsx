import type { Metadata } from "next";
import { LiveBriefHub } from "@/components/briefs/LiveBriefHub";
import { SITE_URL } from "@/lib/site-config";
import { pageMetadata } from "@/lib/page-metadata";

/* The hub's lede (docs/audits/2026-09-08-copy-table.md, UX-02), so the page
   description and the page say the same thing. "War updates" went with the
   `war_update` section on 2026-09-05. */
const TAGLINE =
  "What happened today in Israel and the region — every line with its source, so you can check it before you repeat it.";
const PAGE_URL = `${SITE_URL}/geopolitical-brief`;

export const metadata: Metadata = pageMetadata({
  title: "News & Analysis",
  description: TAGLINE,
  path: "/geopolitical-brief",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "News & Analysis",
  description: TAGLINE,
  publisher: { "@type": "Organization", name: "Lions of Zion" },
  url: PAGE_URL,
  about: [
    { "@type": "Thing", name: "Current news" },
    { "@type": "Thing", name: "Analysis and daily briefings" },
  ],
};

/*
 * `searchParams` is awaited here and not deeper on purpose: it is a
 * request-time value that is already settled, and there is no Suspense
 * boundary above this component for it to open a hole in. The shell itself is
 * synchronous — `LiveBriefHub` is not an async component, and the projection
 * read sits behind an inner boundary inside it — which is what keeps the
 * masthead, the h1 and the standfirst in the initial HTML for a reader with
 * JavaScript off. A segment-root `loading.tsx` here would put all of that back
 * behind a fallback only the client can resolve.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const one = (key: string) => typeof raw[key] === "string" ? raw[key] : undefined;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LiveBriefHub filters={{ date: one("date"), actor: one("actor"), topicLabel: one("topicLabel"), arena: one("arena") }} />
    </>
  );
}
