import type { Metadata } from "next";
import { LiveBriefHub } from "@/components/briefs/LiveBriefHub";
import { SITE_URL } from "@/lib/site-config";

const TAGLINE =
  "News, war updates and analysis on Israel and regional developments, with source context and daily briefings.";
const PAGE_URL = `${SITE_URL}/geopolitical-brief`;

export const metadata: Metadata = {
  title: "News & Analysis",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "News & Analysis — LIONS OF ZION",
    description: TAGLINE,
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "News & Analysis",
  description: TAGLINE,
  publisher: { "@type": "Organization", name: "Lions of Zion" },
  url: PAGE_URL,
  about: [
    { "@type": "Thing", name: "Current news" },
    { "@type": "Thing", name: "War updates and analysis" },
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
