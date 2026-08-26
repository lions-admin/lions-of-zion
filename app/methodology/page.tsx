import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { SITE_URL } from "@/lib/site-config";

const TAGLINE =
  "How claims are sourced, labeled, and corrected across every desk.";
const PAGE_URL = `${SITE_URL}/methodology`;

export const metadata: Metadata = {
  title: "Methodology",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Methodology — LIONS OF ZION", description: TAGLINE },
};

/* A policy page, not an article — WebPage is the correct real schema.org
   type here. */
const METHODOLOGY_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Methodology",
  url: PAGE_URL,
  description: TAGLINE,
  isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
};

export default function Page() {
  return (
    <DocPage routeId="methodology" title="Methodology" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(METHODOLOGY_JSON_LD) }}
      />
      <SectionBlock heading="How claims are labeled">
        <p>
          Every assessed item on this site carries one of nine labels:{" "}
          <strong>verified</strong>, <strong>false</strong>,{" "}
          <strong>misleading</strong>, <strong>manipulated</strong>,{" "}
          <strong>out of context</strong>, <strong>contested</strong>,{" "}
          <strong>unsupported</strong>, <strong>unverified</strong>, or{" "}
          <strong>satire</strong>. The label is shown next to the claim it
          describes and travels with the item wherever it is shared. No
          assessed claim appears without one.
        </p>
      </SectionBlock>

      <SectionBlock heading="Operational reporting">
        <p>
          Reporting on the front draws on official statements cross-checked
          against open sources — footage, flight data, published imagery —
          and states only what that record supports. Where the fog is real,
          the reporting says so. There is no speculation about ongoing
          operations, and nothing that could endanger the people carrying
          them out.
        </p>
      </SectionBlock>

      <SectionBlock heading="Civilian reporting">
        <p>
          The war is also lived far from the line: sirens and shelters,
          evacuated communities, the families of hostages, the slow work of
          rebuilding. Reporting from the home front holds to the same
          standard as reporting from the front — named sources, stated times
          — because the civilian record is the part most often distorted, and
          the part most worth getting right.
        </p>
      </SectionBlock>

      <SectionBlock heading="Influence-network research">
        <p>
          The case files under{" "}
          <Link href="/fake-resistance">Fake Resistance</Link> come from a
          separate kind of work: open-source research into how claims move
          between accounts. It is worth being exact about what that method can
          and cannot support, because the same page argues that other people
          are careless with exactly these limits.
        </p>
        <ul>
          <li>
            <strong>Samples, not censuses.</strong> Posts were gathered from
            public mirrors and limited API pulls over stated windows. A
            percentage in a case file describes the sample it names, not an
            account&rsquo;s whole output.
          </li>
          <li>
            <strong>Engagement figures decay.</strong> Follower counts and view
            counts are snapshots from the moment they were retrieved, and every
            one is published with that date attached.
          </li>
          <li>
            <strong>Video was not played.</strong> Where a claim depends on
            what a video actually shows rather than on its caption, the
            research says so instead of assuming.
          </li>
          <li>
            <strong>Identity is graded, and never upgraded.</strong> An account
            whose operator was not identified stays unresolved on the page no
            matter how well documented its behaviour is.
          </li>
          <li>
            <strong>Connection is graded too.</strong> A link is marked
            documented, observed, or inferred — and inference is labelled as
            inference rather than written up as a finding.
          </li>
        </ul>
        <p>
          Findings that cut against the research&rsquo;s own starting
          assumptions are published with the rest. Where a claim is tied to a
          named living person, it is because the research graded it verified at
          high confidence <em>and</em> the same conduct is already documented
          in mainstream reporting cited in that file.
        </p>
      </SectionBlock>

      <SectionBlock heading="Corrections">
        <p>
          A network that verifies will still sometimes be wrong. When that
          happens, the correction is made as loud as the original claim: the
          item is amended in place, marked as corrected, and the change is
          announced through the same channels that carried the error.
          Corrected items are never quietly deleted — the record of the
          correction is part of the record. The full policy and public log
          are on the <Link href="/corrections">Corrections</Link> page.
        </p>
      </SectionBlock>
    </DocPage>
  );
}
