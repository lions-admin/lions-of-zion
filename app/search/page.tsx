import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SearchPageView } from "@/components/search";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { SITE_URL } from "@/lib/site-config";
import styles from "@/components/search/search.module.css";

const TAGLINE = "Query the published corpus — briefs, analyses and updates, and the claims behind them.";

export const metadata: Metadata = {
  title: "Search",
  description: TAGLINE,
  alternates: { canonical: `${SITE_URL}/search` },
  openGraph: { title: "Search — LIONS OF ZION", description: TAGLINE },
};

/* The query arrives as a prop rather than through `useSearchParams()`, which
   would put this page behind a Suspense boundary during prerender — the exact
   mechanism that broke the site's no-JavaScript render once already. */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchRoute({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const initialQuery = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <DocPage routeId="search" title="Search" tagline={TAGLINE}>
      <SearchPageView initialQuery={initialQuery.slice(0, 500)} />

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
