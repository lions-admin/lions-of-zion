import type { Metadata } from "next";
import { DocPage } from "@/components/sections/DocPage";
import { UpdateFeed } from "@/components/live";
import { listBriefingPublications } from "@/lib/publications";
import { PUBLICATION_SECTIONS } from "@/server/contracts/enums";
import type { PublicationSection } from "@/server/contracts/enums";
import { encodePublicPublicationCursor } from "@/server/contracts/publication";
import type { PublicPublication } from "@/server/contracts/publication";
import { SITE_URL } from "@/lib/site-config";

const TITLE = "Updates";
const TAGLINE =
  "Everything this desk has published, newest first, with the minute and the route it was published by.";
const PAGE_URL = `${SITE_URL}/updates`;

/** One page of the record. Matches the API's default and stays well inside its
 *  1–100 band, so the cursor arithmetic below is the API's own. */
const PAGE_SIZE = 25;

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

/* The feed is a projection of live published data behind a five-minute cache,
   and a prerendered copy at the CDN would add a second, unbounded staleness on
   top of the one the page discloses. Dynamic keeps the disclosure true. */
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(raw: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asSection(value: string | undefined): PublicationSection | undefined {
  return PUBLICATION_SECTIONS.find((section) => section === value);
}

export default async function UpdatesPage({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const section = asSection(one(raw, "section"));
  const cursor = one(raw, "cursor");

  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (section) query.set("section", section);
  if (cursor) query.set("cursor", cursor);

  let entries: PublicPublication[] = [];
  let unavailable = false;
  try {
    entries = await listBriefingPublications(query.toString());
  } catch (cause) {
    /* An unreadable projection and an empty archive are different facts and
       the page says which one it is. A `.catch(() => [])` here would print
       "nothing has been published yet" over a database outage — a false
       statement about the record, produced by an error handler. */
    unavailable = true;
    console.error(
      "[updates] public projection unavailable",
      cause instanceof Error ? cause.message : cause,
    );
  }

  /* The API returns `nextCursor` only when the page came back exactly full,
     because a short page is the last page. This mirrors that rule rather than
     inventing a second one: `app/api/v1/published-publications/route.ts` and
     `app/sitemap.ts` both compute it this way. */
  const last = entries.at(-1);
  const nextCursor =
    entries.length === PAGE_SIZE && last ? encodePublicPublicationCursor(last) : undefined;

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
      routeId="updates"
      title={TITLE}
      tagline={TAGLINE}
      rails="toc"
      breadcrumb={[{ href: "/geopolitical-brief", label: "The Daily Brief" }]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UpdateFeed
        entries={entries}
        section={section}
        paged={cursor !== undefined}
        nextCursor={nextCursor}
        unavailable={unavailable}
      />
    </DocPage>
  );
}
