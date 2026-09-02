import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { AskDesk } from "@/components/ask";
import { SITE_URL } from "@/lib/site-config";
import styles from "@/components/ask/ask.module.css";

const TAGLINE =
  "Put a question to the desk. Every answer lists what it was built from, or says that it was built from nothing.";

export const metadata: Metadata = {
  title: "Ask the desk",
  description: TAGLINE,
  alternates: { canonical: `${SITE_URL}/ask` },
  openGraph: { title: "Ask the desk — LIONS OF ZION", description: TAGLINE },
};

/* A conversation is per-reader and held in their browser; there is nothing
   here to prerender or cache. */
export const dynamic = "force-dynamic";

export default function AskRoute() {
  return (
    <DocPage routeId="ask" title="Ask the desk" tagline={TAGLINE}>
      <AskDesk />

      <noscript>
        <div className={styles.noScript}>
          <p>
            Asking a question is a request and an answer, so it needs JavaScript. What the
            assistant reads from is the published record, and all of it is readable directly:
          </p>
          <p>
            <Link href="/search">Search the corpus</Link> ·{" "}
            <Link href="/geopolitical-brief">Today&rsquo;s brief</Link> ·{" "}
            <Link href="/methodology">How evidence is assessed</Link>
          </p>
        </div>
      </noscript>
    </DocPage>
  );
}
