import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SearchPageView } from "@/components/search";
import { entityTypeSchema, type EntityType } from "@/server/contracts/enums";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import styles from "@/components/search/search.module.css";
import { pageMetadata } from "@/lib/page-metadata";

const TAGLINE =
  "Search everything published here — stories, investigations, claims and the sources behind them.";

export const metadata: Metadata = pageMetadata({
  title: "Search",
  description: TAGLINE,
  path: "/search",
});

/* The query arrives as a prop rather than through `useSearchParams()`, which
   would put this page behind a Suspense boundary during prerender — the exact
   mechanism that broke the site's no-JavaScript render once already. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[]; page?: string | string[] }>;
};

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * The kind filter, validated here rather than in the panel.
 *
 * This is a server component, so importing the entity-type enum costs the
 * client bundle nothing. Validating it in `useSearch` instead would mean a
 * *value* import of `server/contracts/enums` from a module that `SiteHeader`
 * reaches on every route — 62.7 kB gzip of Zod on thirty pages, measured once
 * already (see the note at the top of `components/search/vocabulary.ts`).
 *
 * An unknown `?type=` falls to null rather than 404ing. A stale or mistyped
 * link is a reader who gets the unfiltered answer to their query, which is the
 * answer they were looking for with one facet too few.
 */
function parseEntityType(value: string | string[] | undefined): EntityType | null {
  const parsed = entityTypeSchema.safeParse(first(value));
  return parsed.success ? parsed.data : null;
}

/** 1-based in the URL, 0-based in the panel. Anything unparseable is page one:
 *  the alternative is an empty result set with no visible cause. */
function parsePage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isFinite(parsed) && parsed > 1 ? Math.min(parsed, 50) - 1 : 0;
}

export default async function SearchRoute({ searchParams }: Props) {
  const params = await searchParams;
  const initialQuery = first(params.q);

  return (
    <DocPage routeId="search" title="Search" tagline={TAGLINE}>
      <SearchPageView
        initialQuery={initialQuery.slice(0, 500)}
        initialEntityType={parseEntityType(params.type)}
        initialPage={parsePage(params.page)}
      />

      {/* Search runs in the browser against a rate-limited public endpoint.
          Serving it from the server instead would put an unmetered second door
          on the same query. The FieldShell above is still in this page so a
          no-JS reader sees the labelled control; this block explains why it
          will not query, and hands over the index the page can offer. */}
      <noscript>
        <div className={styles.noScript}>
          <p>
            Search runs in your browser and needs JavaScript. The field above
            will not query the index until then. Every published file is still
            reachable from the index below.
          </p>
          <ul className={styles.noScriptIndex}>
            {SITE_NAVIGATION.map((item) => (
              <li key={item.id}>
                <Link href={item.href}>{item.displayName}</Link> — {item.description}
              </li>
            ))}
            <li>
              <Link href="/methodology">Methodology</Link> — how evidence is sourced and assessed.
            </li>
            <li>
              <Link href="/corrections">Corrections</Link> — the public record of amendments.
            </li>
          </ul>
        </div>
      </noscript>
    </DocPage>
  );
}
