import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

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

/*
 * Anchors are declared rather than slugified from the headings.
 *
 * `SectionBlock` derives an id from the heading when none is given, which is
 * right for a page nothing links into. This one links into itself: the
 * contents at the top of the page points at every section below it, so the
 * anchors have to survive an editor rewording a heading. Short, stable, and
 * the same strings the contents uses.
 */
const SECTION = {
  standard: "the-standard",
  scope: "scope",
  sources: "sources",
  archiving: "archiving",
  labels: "labels",
  process: "process",
  operational: "operational-reporting",
  civilian: "civilian-reporting",
  influence: "influence-network-research",
  limitations: "limitations",
  corrections: "corrections",
} as const;

/**
 * The standard in one screen: what each rule is called, where it is stated in
 * full, and what a reader gets if they never follow the link.
 *
 * This is the answer to "how was this assessed?" — the acceptance METHOD-001
 * asks for — and it is navigation as well as summary, which is why the rule
 * name is the link rather than a trailing "read more".
 *
 * Each term is the heading of the section it links to, character for
 * character. A contents entry that renames its destination makes a reader
 * check whether they landed where they meant to, which is exactly the cost a
 * contents exists to remove. Three headings changed to meet this list rather
 * than the other way round — "What counts as a source", "How claims are
 * labeled" and "From source to published" now carry the names a standard
 * gives those rules. Not a sentence of their prose moved.
 *
 * Six of the eleven sections are here, not all eleven: this is the standard,
 * and the four desk-specific sections are rules a particular desk adds on top
 * of it. The contents rail lists every section; this lists the ones a reader
 * asking "how was this assessed?" is actually asking about.
 */
const GLANCE: { term: string; href: string; definition: string }[] = [
  {
    term: "Scope",
    href: `#${SECTION.scope}`,
    definition:
      "What this standard governs — and the one boundary worth stating plainly: it is not how the pages you are reading were published.",
  },
  {
    term: "Evidence classes",
    href: `#${SECTION.sources}`,
    definition:
      "Three source tiers, primary preferred. Every source is fetched and read in the session that cites it, and a citation must cover the claim it sits beside, not merely its subject.",
  },
  {
    term: "Labeling rules",
    href: `#${SECTION.labels}`,
    definition:
      "Nine labels, one per assessed claim, shown beside the claim and carried wherever it is shared. Confidence — high, medium or limited — is stated, never implied.",
  },
  {
    term: "Publication process",
    href: `#${SECTION.process}`,
    definition:
      "Five stages from fetched source to searchable record. One is a gate: a second person who did not write the assessment must approve it, and no automated identity can hold that capability.",
  },
  {
    term: "Limitations",
    href: `#${SECTION.limitations}`,
    definition:
      "Where this site is below its own standard, or has no process yet, it is written down here rather than left for a reader to discover.",
  },
  {
    term: "Corrections",
    href: `#${SECTION.corrections}`,
    definition:
      "An error is amended in place, marked as corrected, and announced through the channels that carried it. Nothing is quietly deleted.",
  },
];

/**
 * The publication process as a static relationship diagram (METHOD-002).
 *
 * Every step and every gate is text: the numeral, the stage name, the written
 * gate label and the rule underneath it are all in the markup, and the drawn
 * track and the diamond are decoration a reader can lose entirely without
 * losing a single step. Nothing here animates, so the diagram is the same
 * under reduced motion, in print, and with scripting off.
 *
 * The five stages are the five on the We Are page, in the same order and with
 * the same one gate. That is deliberate: two pages describing one pipeline
 * differently is how a reader learns not to trust either.
 */
const PIPELINE: { name: string; note: string; icon: IconName; gate?: string }[] = [
  {
    name: "Ingest",
    icon: "intake",
    note: "A source is fetched and the fetch itself is logged, successes and failures alike, so the record of what was checked is as permanent as the record of what was found.",
  },
  {
    name: "Evidence",
    icon: "evidence",
    note: "A claim is linked to evidence carrying its own type and strength. That evidence counts toward an assessment only once it is confirmed, not the moment it is attached.",
  },
  {
    name: "Assessment",
    icon: "assessment",
    note: "Confidence is scored across separate dimensions rather than collapsed into one number that hides how it was reached.",
  },
  {
    name: "Human review",
    icon: "review",
    gate: "Gate — human only",
    note: "A second person who did not write the assessment must approve it. That capability cannot be held by an automated identity — it is refused structurally rather than by policy.",
  },
  {
    name: "Publish and search",
    icon: "publish",
    note: "Only what clears that review becomes part of the public, searchable record, and it carries its sources with it.",
  },
];

export default function Page() {
  return (
    <DocPage routeId="methodology" title="Methodology" tagline={TAGLINE} rails="toc">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(METHODOLOGY_JSON_LD) }}
      />

      {/* First block on the page, so `sections.module.css` exempts it from the
          section entrance — this has to be readable the moment the page is,
          not on a scroll. */}
      <SectionBlock heading="The standard" id={SECTION.standard}>
        <div className={styles.summary}>
          <p className={styles.summaryText}>
            Every assessed claim on this site is traced to a source a reader
            can go and check, graded for how much weight that source can take,
            labeled with what the evidence shows, and approved by a second
            person who did not write it — before it is published, and never
            after. Where that standard is not met, the page says so.
          </p>
        </div>
        <span className={styles.glanceKicker}>The standard in full</span>
        <dl className={styles.glance}>
          {GLANCE.map((rule) => (
            <div key={rule.href} className={styles.glanceRow}>
              <dt className={styles.glanceTerm}>
                <Link href={rule.href}>{rule.term}</Link>
              </dt>
              <dd className={styles.glanceDef}>{rule.definition}</dd>
            </div>
          ))}
        </dl>
      </SectionBlock>

      <SectionBlock heading="Scope" id={SECTION.scope}>
        <p>
          This page is the standard the site holds itself to: what counts as a
          source, how a claim is labeled, what has to happen before anything is
          published, what the method cannot support, and what happens when
          something turns out to be wrong. It applies to every assessed claim,
          on every desk. Where a desk adds a rule of its own — operational
          reporting, the home front, influence-network research — that rule is
          stated in its own section below.
        </p>
        {/* Scope, stated rather than implied, and stated *before* the pipeline
            rather than after it. The pipeline below is real and its rules are
            enforced in SQL rather than by convention, but the pages a reader
            is on did not come through it: every one is edited and published
            from this repository. Read after the pipeline, the paragraph was a
            correction; read here, it is the boundary of the thing being
            described. */}
        <p>
          One boundary is worth stating plainly: that standard governs the
          assessment record the desk is building. It is not how the pages you
          are reading were published. These are edited and shipped from the
          project&rsquo;s own repository, and the archives beneath{" "}
          <Link href="/october-7">October 7</Link> are reproduced from their
          source packages as published. Where a page carries a review date and
          a reviewer, that is the editorial pass on the page itself.
        </p>
      </SectionBlock>

      <SectionBlock heading="Evidence classes" id={SECTION.sources}>
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
        {/* Where this site is below that standard now reads under
            "Limitations", with the rest of what the site cannot yet do,
            rather than as a coda to the rule it fails. */}
      </SectionBlock>

      <SectionBlock heading="Archiving" id={SECTION.archiving}>
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

      <SectionBlock heading="Labeling rules" id={SECTION.labels}>
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

      <SectionBlock heading="Publication process" id={SECTION.process}>
        <p>
          Nothing reaches the public record by one person&rsquo;s judgement.
          Five stages run between a fetched source and a searchable record,
          and one of them is a gate rather than a step:
        </p>
        <ol className={styles.process}>
          {PIPELINE.map((stage, index) => (
            <li
              key={stage.name}
              className={styles.stage}
              data-gate={stage.gate ? "" : undefined}
            >
              <span className={styles.stageNode} aria-hidden="true">
                <Icon name={stage.icon} size={18} />
              </span>
              <div className={styles.stageBody}>
                <div className={styles.stageHead}>
                  <span className={styles.stageNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className={styles.stageName}>{stage.name}</h3>
                  {stage.gate ? (
                    <span className={styles.stageGate}>{stage.gate}</span>
                  ) : null}
                </div>
                <p className={styles.stageNote}>{stage.note}</p>
              </div>
            </li>
          ))}
        </ol>
        <p>
          The same pipeline, and the reason the gate exists, are described on
          the <Link href="/we-are">We Are</Link> page. The boundary of what it
          governs is under <Link href={`#${SECTION.scope}`}>Scope</Link>.
        </p>
      </SectionBlock>

      <SectionBlock heading="Operational reporting" id={SECTION.operational}>
        <p>
          Reporting on the front draws on official statements cross-checked
          against open sources — footage, flight data, published imagery —
          and states only what that record supports. Where the fog is real,
          the reporting says so. There is no speculation about ongoing
          operations, and nothing that could endanger the people carrying
          them out.
        </p>
      </SectionBlock>

      <SectionBlock heading="Civilian reporting" id={SECTION.civilian}>
        <p>
          The war is also lived far from the line: sirens and shelters,
          evacuated communities, the families of hostages, the slow work of
          rebuilding. Reporting from the home front holds to the same
          standard as reporting from the front — named sources, stated times
          — because the civilian record is the part most often distorted, and
          the part most worth getting right.
        </p>
      </SectionBlock>

      <SectionBlock heading="Influence-network research" id={SECTION.influence}>
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

      {/* Written down rather than discovered. Every item here is a limit this
          site already states somewhere — on the page it constrains, or in the
          seam that supplies it — collected in one place so that a reader
          judging the standard does not have to visit five pages to find the
          four things it cannot yet do. Nothing is added that is not already
          true elsewhere in the repository. */}
      <SectionBlock heading="Limitations" id={SECTION.limitations}>
        <p>
          A standard is only worth the honesty of its exceptions. These are the
          places where this site is below the rules above, or has no process
          yet. Each is stated on the page it constrains as well as here.
        </p>
        <ul>
          <li>
            <strong>One edition sits a tier below its own rule.</strong>{" "}
            <Link href="/israels-story">Israel&rsquo;s Story</Link> is a
            working edition whose chapters are largely sourced to a reference
            work rather than to the primary documents that work itself cites;
            the citation beside each claim names it, and a reader can see the
            tier without being told. Its ancient and biblical period is a
            stated gap, not an omission glossed over.
          </li>
          <li>
            <strong>One process does not exist yet.</strong> There is no
            family-consent workflow, so{" "}
            <Link href="/our-heroes">Our Heroes</Link> is limited to stories
            the subject or their family has already chosen to make public, on
            the record, more than once — and carries no detail beyond what is
            cited.
          </li>
          <li>
            <strong>The correction log is empty, which proves nothing.</strong>{" "}
            Nothing has needed a correction yet. That is a real record with
            nothing in it, not evidence that the standard has been tested.
          </li>
          <li>
            <strong>Funding is not yet public.</strong> Independence is a rule
            here — no sponsor gets a say in what is published or how it is
            assessed — but a reader cannot check it against a published list
            today. <Link href="/support-us">Support Us</Link> is where
            sustaining channels will be published as they open.
          </li>
        </ul>
      </SectionBlock>

      {/* One sentence, not five. Four of the five here were the same
          sentences `/corrections` already carries, and the two pages deferred
          to each other in a closed loop — this page pointed there for the
          policy while that page pointed back here for the sourcing standard.
          The standard is now above; the policy stays where it lives. */}
      <SectionBlock heading="Corrections" id={SECTION.corrections}>
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
