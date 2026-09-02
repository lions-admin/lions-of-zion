import type { Metadata } from "next";
import { DocPage } from "@/components/sections/DocPage";
import { FactCheckDesk } from "@/components/factcheck";
import {
  getPublicPublication,
  isMissingPublication,
  listBriefingPublications,
} from "@/lib/publications";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { SITE_URL } from "@/lib/site-config";

const TITLE = "Fact check";
const TAGLINE =
  "Claims in circulation, what the evidence says, and where each statement's sources come from.";
const PAGE_URL = `${SITE_URL}/fact-check`;

/** How many checks the desk carries. */
const PAGE_SIZE = 20;

/**
 * How many of those are expanded in place.
 *
 * Each expansion is a second cached read for the full record, so this is the
 * one number on the page that trades completeness for cost. Eight covers the
 * desk's realistic daily output several times over; anything past it keeps its
 * claim and verdict and links to the record instead of hiding either.
 */
const DETAIL_BUDGET = 8;

export const metadata: Metadata = {
  title: TITLE,
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `${TITLE} — LIONS OF ZION`,
    description: TAGLINE,
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function FactCheckPage() {
  let records: PublicPublication[] = [];
  let unavailable = false;
  try {
    records = await listBriefingPublications(
      `section=narrative_watch&limit=${PAGE_SIZE}`,
    );
  } catch (cause) {
    unavailable = true;
    console.error(
      "[fact-check] public projection unavailable",
      cause instanceof Error ? cause.message : cause,
    );
  }

  /* A record that vanished between the list read and the detail read is not an
     error for the page: the row keeps its claim and verdict from the list and
     falls back to the link. Anything else is rethrown rather than swallowed. */
  const detailed = await Promise.all(
    records.slice(0, DETAIL_BUDGET).map(async (record) => {
      try {
        return await getPublicPublication(record.publicId);
      } catch (cause) {
        if (isMissingPublication(cause)) return null;
        console.error(
          "[fact-check] detail unavailable",
          record.publicId,
          cause instanceof Error ? cause.message : cause,
        );
        return null;
      }
    }),
  );

  const details = new Map<string, PublicPublicationDetail>();
  for (const detail of detailed) if (detail) details.set(detail.publicId, detail);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: TAGLINE,
    url: PAGE_URL,
    publisher: { "@type": "Organization", name: "Lions of Zion" },
  };

  return (
    <DocPage
      routeId="fact-check"
      title={TITLE}
      tagline={TAGLINE}
      /* No rails, deliberately. The page carries one `h2` — "What this page
         does not show" — and `SectionToc` needs two before a contents list is
         navigation rather than noise, so `rails="toc"` here would render an
         empty rail and still widen the band the scan stays out of. `/updates`
         does take the rail, because its day groups are real sections with
         anchors and the rail becomes a date index over the feed. */
      rails="none"
      breadcrumb={[{ href: "/geopolitical-brief", label: "The Daily Brief" }]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FactCheckDesk records={records} details={details} unavailable={unavailable} />
    </DocPage>
  );
}
