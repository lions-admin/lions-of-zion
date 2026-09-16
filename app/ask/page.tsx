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

type Props = { searchParams: Promise<{ q?: string | string[] }> };

/**
 * `?q=` — the handover from search.
 *
 * A reader whose query matched no record is offered "Ask the desk about this",
 * and it arrives here with the words they already typed. Read from
 * `searchParams` on the server rather than through `useSearchParams()`, for
 * the reason `/search` records: that hook forces the page under a Suspense
 * boundary during prerender, which is the mechanism that broke this site's
 * no-JavaScript render once already. Capped at the 600 characters the message
 * schema accepts, so a long URL fills the box with what will actually send.
 */
export default async function AskRoute({ searchParams }: Props) {
  const params = await searchParams;
  const handover = (Array.isArray(params.q) ? params.q[0] : params.q)?.slice(0, 600);

  return (
    <DocPage routeId="ask" title="Ask the desk" tagline={TAGLINE}>
      <AskDesk layout="page" initialQuestion={handover} />

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
