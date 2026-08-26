import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { CorrectionHistory } from "@/components/content";
import { getCorrectionsLog } from "@/lib/content/corrections";
import { SITE_URL } from "@/lib/site-config";

const TAGLINE =
  "The policy for handling errors, and the public record of every correction made.";
const PAGE_URL = `${SITE_URL}/corrections`;

export const metadata: Metadata = {
  title: "Corrections",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Corrections — LIONS OF ZION", description: TAGLINE },
};

/* A policy page, not an article — WebPage is the correct real schema.org
   type here. */
const CORRECTIONS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Corrections",
  url: PAGE_URL,
  description: TAGLINE,
  isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
};

export default async function Page() {
  const log = await getCorrectionsLog();

  return (
    <DocPage routeId="corrections" title="Corrections" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(CORRECTIONS_JSON_LD) }}
      />
      <SectionBlock heading="Policy">
        <p>
          A network that verifies will still sometimes be wrong. When that
          happens, the correction is made as loud as the original claim: the
          item is amended in place, marked as corrected, and the change is
          announced through the same channels that carried the error.
          Corrected items are never quietly deleted — the record of the
          correction is part of the record. Full sourcing standards are on
          the <Link href="/methodology">Methodology</Link> page.
        </p>
      </SectionBlock>

      <SectionBlock heading="Correction log">
        {/* The copy promises only what `CorrectionHistory` can actually
            render — a date, an optional version and what changed. It used to
            promise "the page it applied to" as well; `CorrectionsLogEntry`
            carries `page` and `slug` for the day the log fills, but nothing
            renders them, and a page should not describe a column it cannot
            print. The empty state's own wording is left alone: "None
            recorded" is shared with the Geopolitical Brief and is a
            documented decision, so the context for it is said here instead. */}
        <p>
          Every correction issued across the site appears here, dated, with
          what changed. The log is empty because nothing has needed one yet —
          it is a real record with nothing in it, not a placeholder. If you
          have found something that belongs here,{" "}
          <Link href="/support-us#report">report the claim</Link> and it will
          be checked.
        </p>
        <CorrectionHistory corrections={log} />
      </SectionBlock>
    </DocPage>
  );
}
