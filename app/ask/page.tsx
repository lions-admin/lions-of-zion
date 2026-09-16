import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { AskDesk } from "@/components/ask";
import styles from "@/components/ask/ask.module.css";
import { pageMetadata } from "@/lib/page-metadata";

const TAGLINE =
  "Ask about a claim, a video, a source. Every answer shows what it was built from — or says it found nothing.";

export const metadata: Metadata = pageMetadata({
  title: "Ask the desk",
  description: TAGLINE,
  path: "/ask",
});

/* A conversation is per-reader and held in their browser; there is nothing
   here to prerender or cache. */
export const dynamic = "force-dynamic";

type Props = {
  /* Optional, unlike `/search`'s: the route reads one parameter and the only
     caller that passes it is Next itself. Keeping it optional is what lets a
     direct render (the no-JS invariant test) call the page bare. */
  searchParams?: Promise<{ q?: string | string[] }>;
};

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/* The search empty state hands a query over here — "Ask the desk about this"
   carries the query in the URL, so the desk opens with it already in the box.
   Read by the server component and passed as a prop, the same contract
   `/search` uses: never `useSearchParams()`, which would put this page behind
   a Suspense boundary and break the no-JavaScript render. Trimmed to the
   endpoint's own cap, so a query past it seeds a truncated draft the reader
   can edit rather than a request the API must refuse. */
const QUESTION_CAP = 600;

export default async function AskRoute({ searchParams }: Props) {
  /* The search empty state hands a query over in the URL; absent or malformed
     params are an ordinary visit with nothing in the box. */
  const params = (await searchParams) ?? {};
  const initialQuestion = first(params.q).trim().slice(0, QUESTION_CAP);

  return (
    <DocPage routeId="ask" title="Ask the desk" tagline={TAGLINE}>
      <AskDesk layout="page" initialQuestion={initialQuestion || undefined} />

      <noscript>
        <div className={styles.noScript}>
          <p>
            Asking a question is a request and an answer, so it needs JavaScript. What the
            assistant reads from is what is published here, and all of it is readable directly:
          </p>
          <p>
            <Link href="/search">Search the site</Link> ·{" "}
            <Link href="/geopolitical-brief">Today&rsquo;s brief</Link> ·{" "}
            <Link href="/methodology">How evidence is assessed</Link>
          </p>
        </div>
      </noscript>
    </DocPage>
  );
}
