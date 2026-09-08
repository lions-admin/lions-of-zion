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

export default function AskRoute() {
  return (
    <DocPage routeId="ask" title="Ask the desk" tagline={TAGLINE}>
      <AskDesk layout="page" />

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
