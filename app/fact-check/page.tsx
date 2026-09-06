import { Suspense } from "react";
import type { Metadata } from "next";
import { DocPage } from "@/components/sections/DocPage";
import { FactCheckDesk } from "@/components/factcheck";
import { SkeletonDesk } from "@/components/ui/Skeleton";
import {
  getPublicPublication,
  isMissingPublication,
  listBriefingPublications,
} from "@/lib/publications";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { SITE_URL } from "@/lib/site-config";
import { publicationHubCrumb } from "@/lib/publication-routing";

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
 * claim and verdict and links to the record instead of hiding either. A
 * `?claim=` match past this budget is fetched as well, so an addressable open
 * state can still restore after back navigation.
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

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(raw: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/*
 * The shell is rendered synchronously; only the desk streams.
 *
 * `app/fact-check/loading.tsx` used to sit at the segment root, which put the
 * whole segment — and therefore the `EditorialShell` chrome this site mounts
 * inside each page rather than in `app/layout.tsx` — behind a Suspense
 * boundary only client JavaScript could resolve. With scripting off the route
 * rendered its title and nothing else. The boundary is inside the shell now.
 *
 * This component must stay synchronous, so `searchParams` travels down as the
 * promise instead of being awaited here.
 */
export default function FactCheckPage({ searchParams }: { searchParams: Search }) {
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
      breadcrumb={[publicationHubCrumb("news")]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* `inline`: the shell above already paid for the header offset and the
          measure, and the standalone family geometry would count both twice. */}
      <Suspense fallback={<SkeletonDesk inline label="Loading the checked claims" />}>
        <FactCheckRecords searchParams={searchParams} />
      </Suspense>
    </DocPage>
  );
}

/** The async region: the list read, plus the detail reads inside the budget. */
async function FactCheckRecords({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const openClaimId = one(raw, "claim");

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

  const budget = records.slice(0, DETAIL_BUDGET);
  const addressed =
    openClaimId && !budget.some((record) => record.publicId === openClaimId)
      ? records.find((record) => record.publicId === openClaimId)
      : undefined;
  const toFetch = addressed ? [...budget, addressed] : budget;

  /* A record that vanished between the list read and the detail read is not an
     error for the page: the row keeps its claim and verdict from the list and
     falls back to the link. Anything else is rethrown rather than swallowed. */
  const detailed = await Promise.all(
    toFetch.map(async (record) => {
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

  return (
    <FactCheckDesk
      records={records}
      details={details}
      unavailable={unavailable}
      openClaimId={openClaimId}
    />
  );
}
