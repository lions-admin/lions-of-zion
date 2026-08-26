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
      <SectionBlock heading="What counts as a source">
        <p>
          A source is something a reader can go and check. Sources rank in
          three tiers, and every citation on this site names its tier by
          naming the publication it came from.
        </p>
        <ul>
          <li>
            <strong>Primary.</strong> The record itself — a treaty text, a
            government statement, a court filing, a ministry release, an
            original photograph or video with known provenance. Preferred
            wherever a primary source exists and can be reached.
          </li>
          <li>
            <strong>Secondary.</strong> Named reporting and named
            fact-checking that cites its own evidence. Used where a claim is
            about what was reported, or where the primary record is not
            publicly reachable.
          </li>
          <li>
            <strong>Tertiary.</strong> Reference works that summarise
            others&rsquo; sourcing. Used as a route to the primary documents
            they cite, never as the last word on a contested point.
          </li>
        </ul>
        <p>
          Two rules apply at every tier. A source must be fetched and read in
          the session that cites it — nothing is cited from memory. And a
          citation must cover the specific claim it sits beside, not merely
          the subject the claim is about; a source that covers the topic but
          not the sentence is a mis-citation, and it is treated as an error
          to correct, not as sourcing.
        </p>
        <p>
          Where this site is below that standard, the citation says so rather
          than this page saying it for them. Israel&rsquo;s Story is a working
          edition whose chapters are largely sourced to a reference work
          rather than to the primary documents that work itself cites; the
          citation beside each claim names it, and a reader can see the tier
          without being told.
        </p>
      </SectionBlock>

      <SectionBlock heading="Archiving">
        <p>
          A link that dies takes the evidence with it, and material of this
          kind is deleted more often than most. Where a source is likely to
          move or be taken down — a social post, a fact-check of one, a page
          on a site under pressure — an archive snapshot is captured at the
          time of citation and published beside the live link, so that the
          record outlives the link. The Fake Resistance case files carry those
          snapshots today; pages citing stable publications of record do not.
          An archive link is never a substitute for the primary record where
          one exists — it is insurance on the record that was actually used.
        </p>
      </SectionBlock>

      <SectionBlock heading="How claims are labeled">
        <p>
          Every assessed item on this site carries one of nine labels. The
          label is shown next to the claim it describes and travels with the
          item wherever it is shared. No assessed claim appears without one.
          Each label states what the evidence has to show before it can be
          applied:
        </p>
        <ul>
          <li>
            <strong>Verified</strong> — supported by the evidence on record.
          </li>
          <li>
            <strong>False</strong> — the claim is contradicted by the
            evidence.
          </li>
          <li>
            <strong>Misleading</strong> — built on real elements arranged to
            create a false impression.
          </li>
          <li>
            <strong>Manipulated</strong> — the underlying media or record has
            been altered.
          </li>
          <li>
            <strong>Out of context</strong> — genuine material presented
            outside its real time, place, or meaning.
          </li>
          <li>
            <strong>Contested</strong> — credible sources disagree and the
            record does not yet settle it.
          </li>
          <li>
            <strong>Unsupported</strong> — we searched and found no evidence
            for the claim.
          </li>
          <li>
            <strong>Unverified</strong> — not yet assessed against the
            evidence.
          </li>
          <li>
            <strong>Satire</strong> — not a factual claim; presented as satire
            or parody.
          </li>
        </ul>
        <p>
          A label may carry one of three confidence levels — high, medium or
          limited — describing how much weight the evidence behind it can
          take. Confidence is stated, never implied by the label alone, and a
          grade is never revised upward without new evidence.
        </p>
      </SectionBlock>

      <SectionBlock heading="From source to published">
        <p>
          Nothing reaches the public record by one person&rsquo;s judgement. A
          source is fetched and the fetch itself is logged, successes and
          failures alike. A claim is then linked to evidence carrying its own
          type and strength, and that evidence counts toward an assessment
          only once it is confirmed, not the moment it is attached. Confidence
          is scored across separate dimensions rather than collapsed into one
          number that hides how it was reached. A second person who did not
          write the assessment must then approve it — a capability no
          automated identity can hold, refused structurally rather than by
          policy. Only what clears that review becomes part of the public,
          searchable record, and it carries its sources with it. The same
          pipeline, stage by stage, is on the{" "}
          <Link href="/we-are">We Are</Link> page.
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

      {/* One sentence, not five. Four of the five here were the same
          sentences `/corrections` already carries, and the two pages deferred
          to each other in a closed loop — this page pointed there for the
          policy while that page pointed back here for the sourcing standard.
          The standard is now above; the policy stays where it lives. */}
      <SectionBlock heading="Corrections">
        <p>
          A network that verifies will still sometimes be wrong. The policy
          for what happens then, and the public log of every correction
          issued, are on the{" "}
          <Link href="/corrections">Corrections</Link> page.
        </p>
      </SectionBlock>
    </DocPage>
  );
}
