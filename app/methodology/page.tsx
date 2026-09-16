import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { SITE_URL } from "@/lib/site-config";
import { PUBLICATION_PROVENANCE } from "@/server/contracts/publication";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./page.module.css";
import { Icon, type IconName } from "@/components/ui/Icon";

const TAGLINE = "How Lions of Zion separates sources, claims, evidence, assessment and uncertainty — across human and machine-authored work.";
const PAGE_URL = `${SITE_URL}/methodology`;

/* The date this standard was last read through and confirmed. A policy page
   without one asks a reader to trust a document of unknown age; the three
   trust pages each carry the field and print it in the same place. */
const LAST_REVIEWED = "2026-09-16";
const LAST_REVIEWED_LABEL = "16 September 2026";

/* METHOD-001: the standard in one paragraph, then a contents of the standard
   itself — the rule's name links to the section that holds it in full, and the
   sentence beside it is what a reader gets if they never follow the link. The
   contents rail is navigation; this is substance, which is why both exist. */
const GLANCE: { term: string; href: string; gist: string }[] = [
  { term: "Source, claim, evidence, assessment", href: "#source-claim-evidence-assessment",
    gist: "Five different things, kept apart by name: the material, the assertion, what supports or contradicts it, our reading of it, and what the record does not settle." },
  { term: "Source families", href: "#source-families",
    gist: "Repetition is not corroboration. Five copies of one original account remain one source family for that fact." },
  { term: "Labels and language", href: "#labels-and-language",
    gist: "Established fact, attributed claim, allegation, inference and editorial conclusion are named as what they are. Contested material stays contested." },
  { term: "How AI is used", href: "#ai-assistance",
    gist: "AI scans, compares, organizes, drafts and operates authorized workflows. Model output is derived editorial material and never documentary evidence." },
  { term: "Human governance", href: "#human-governance",
    gist: "People set the mission, the standards, the permissions, the escalation paths and the corrections policy — not a manual approval of every sentence." },
  { term: "Publication provenance", href: "#publication-provenance",
    gist: "Two disclosed editorial paths, machine-authored and human. The authorship line on a record says which one produced it." },
  { term: "Changes to the record", href: "#changes-to-the-record",
    gist: "Correction, update, revision, added context, source update and technical migration are distinct, and a correction is never dressed as an update." },
];

/* METHOD-002: the relationship between the stages, drawn once and written in
   full. There is no animation and nothing arrives — a standard is not an
   event — so it reads identically with scripting off and under reduced
   motion.

   The drawn route is the **human-assessed claim**, and the diagram says so in
   the sentence above it, because the gate on stage four is real for that path
   and does not exist on the machine-authored one. Drawing one pipeline with a
   human gate in the middle of it would claim a person approves every record
   before it publishes, which is not the operating model and is the exact
   sentence `tests/publication-provenance-copy.test.ts` was written to keep
   off this page. The gate carries `data-gate`, a written label naming the
   path it belongs to, and a panel of its own, so the difference is structural
   and not only a colour. */
const PROCESS: { name: string; icon: IconName; note: string; gate?: string }[] = [
  { name: "Collect", icon: "intake",
    note: "Configured sources and research bring public material in. Collection records what was retrieved; it establishes nothing about whether the claim inside it is true." },
  { name: "Preserve provenance", icon: "evidence",
    note: "Every piece of material keeps its origin, its URL and its source family, so a later reader can tell one account from five copies of it." },
  { name: "Assess", icon: "assessment",
    note: "Evidence becomes an assessment with its confidence dimensions and its known gaps stated. An assessment is not automatically an article." },
  { name: "Human review", icon: "review", gate: "Gate — human assessments only",
    note: "A human-written assessed claim is reviewed by a second person, never its author, and no model can stand in for that second reader. A machine-authored editorial run does not pass through this stage: it takes the separate disclosed path described above, governed by recorded provenance and server-enforced publishing rules." },
  { name: "Publish", icon: "publish",
    note: "Publication happens through the controlled production path, with the provenance appropriate to the route it came down. Publication is not a guarantee of certainty." },
  { name: "Correct", icon: "correction",
    note: "The record stays versioned and correctable. Errors, withdrawals and significant revisions remain part of the public record rather than being erased from it." },
];

export const metadata: Metadata = pageMetadata({ title: "Methodology", description: TAGLINE, path: "/methodology" });

const METHODOLOGY_JSON_LD = { "@context": "https://schema.org", "@type": "WebPage", name: "Methodology", url: PAGE_URL, description: TAGLINE, isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL } };

export default function Page() {
  /* VA-59: trust surfaces state the rules; the scan stays silent behind them. */
  return (
    <DocPage routeId="methodology" title="Methodology" tagline={TAGLINE} rails="toc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(METHODOLOGY_JSON_LD) }} />

      <div className={styles.summary}>
        <p className={styles.summaryText}>A source is not a claim, a claim is not evidence, evidence is not an assessment, and an assessment is not certainty. Everything below is how those five are kept apart while the work runs at machine speed.</p>
      </div>

      <span className={styles.glanceKicker}>The standard at a glance</span>
      <dl className={styles.glance}>
        {GLANCE.map((rule) => (
          <div key={rule.href} className={styles.glanceRow}>
            <dt className={styles.glanceTerm}><Link href={rule.href}>{rule.term}</Link></dt>
            <dd className={styles.glanceDef}>{rule.gist}</dd>
          </div>
        ))}
      </dl>

      <SectionBlock heading="The standard" id="the-standard"><p>Lions of Zion uses AI, OSINT and editorial research to operate at scale, but scale does not change what counts as evidence. A source is not a claim, a claim is not evidence, evidence is not an assessment, and an assessment is not certainty. The method is designed to keep those categories visible even when a story is moving quickly.</p><p>Technology increases our reach. Standards determine what deserves publication. Human governance defines the boundaries.</p></SectionBlock>
      <SectionBlock heading="Source, claim, evidence, assessment" id="source-claim-evidence-assessment"><dl><div><dt><strong>Source</strong></dt><dd>The original material or reporting that actually says, shows or records something.</dd></div><div><dt><strong>Claim</strong></dt><dd>An assertion attributed to a source, a person, an institution or the public information environment.</dd></div><div><dt><strong>Evidence</strong></dt><dd>Material that genuinely supports, contradicts or constrains a claim.</dd></div><div><dt><strong>Assessment</strong></dt><dd>Lions of Zion&apos;s evidence-based interpretation of what the available record supports.</dd></div><div><dt><strong>Uncertainty</strong></dt><dd>What the reviewed material does not establish, including missing evidence, unresolved contradictions and limits in provenance.</dd></div></dl></SectionBlock>
      <SectionBlock heading="Source families and corroboration" id="source-families"><p>Repetition is not corroboration. Five articles, posts or clips that all trace back to one original account remain one source family for that fact. We preserve source lineage wherever possible and treat independent origin as a different question from the number of copies or headlines repeating the same material.</p><p>Primary material is preferred where it can be reached. Secondary reporting and fact-checking can be valuable, but a citation has to support the specific sentence beside it, not merely discuss the same subject.</p></SectionBlock>
      <SectionBlock heading="Facts, allegations and analysis" id="labels-and-language"><p>The language of a publication should tell readers what kind of thing they are looking at. We distinguish established fact, attributed or official claim, allegation, inference, analysis and editorial conclusion. Contested material stays contested when the evidence does not settle it. Unsupported means the reviewed record does not support the assertion; it does not mean an algorithm has omnisciently proved a universal negative.</p><p>Confidence and uncertainty should be explicit. A real post does not prove the event described in it happened. A real association does not prove operational coordination. Similar wording or simultaneous posting does not by itself prove common direction or malicious intent.</p></SectionBlock>
      <SectionBlock heading="How AI is used" id="ai-assistance"><p>AI systems can help scan large information environments, compare sources, surface inconsistencies, retrieve historical context, organize evidence, monitor developing stories, identify narrative patterns, assist drafting and operate structured editorial workflows. Authorized machine-authored runs can also create or update canonical publications and publish through the controlled production pipeline.</p><p>Those capabilities do not make model output evidence. AI-generated reasoning, summaries and illustrations remain derived editorial material. Documentary claims still depend on inspectable sources and provenance.</p></SectionBlock>
      <SectionBlock heading="Human governance" id="human-governance"><p>Lions of Zion is AI-powered and human-governed. People define the mission, editorial policy, source standards, provenance rules, publishing permissions, escalation paths, corrections policy, verification requirements and safety boundaries. Humans also review sensitive or consequential work where the operating rules require editorial escalation.</p><p>Human governance is not the same thing as claiming that a person manually approves every sentence before publication. The site has more than one publication path, and each path should be described as it actually operates.</p>
        <p>The route below is the <strong>human-assessed claim</strong>, drawn end to end. It is the path with a review gate in it; the machine-authored editorial route is described under Publication provenance and does not pass through that gate.</p>
        <ol className={styles.process}>
          {PROCESS.map((stage, index) => (
            <li key={stage.name} className={styles.stage} data-gate={stage.gate ? "" : undefined}>
              <span className={styles.stageNode} aria-hidden="true"><Icon name={stage.icon} size={18} /></span>
              <div className={styles.stageBody}>
                <div className={styles.stageHead}>
                  <span className={styles.stageNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <h3 className={styles.stageName}>{stage.name}</h3>
                  {stage.gate ? <span className={styles.stageGate}>{stage.gate}</span> : null}
                </div>
                <p className={styles.stageNote}>{stage.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionBlock>
      <SectionBlock heading="Publication provenance" id="publication-provenance"><p>Editorial publications use two disclosed provenance paths. The authorship line on a publication tells readers which one produced the record.</p><dl>{(["machine", "human"] as const).map((kind) => <div key={kind}><dt><strong>{PUBLICATION_PROVENANCE[kind].label}</strong></dt><dd>{PUBLICATION_PROVENANCE[kind].detail}</dd></div>)}</dl><p>Imported and archive records are separate from those editorial bylines. They retain the provenance of the underlying material. Hosting, translating, indexing or machine-processing an archive item does not mean Lions independently re-verified every statement inside it.</p></SectionBlock>
      <SectionBlock heading="Information-war research" id="information-war-research"><p>Investigations can trace claim origin, source lineage, narrative evolution, timing, amplification, image or video provenance and source-family relationships. These signals can reveal patterns worth investigating; they do not automatically establish coordination, intent or authorship.</p><p>Where synthetic or manipulated media is suspected, the publication should distinguish what can be established about the file from what remains a forensic hypothesis. An illustrated visual is never treated as evidence of the event it explains.</p></SectionBlock>
      <SectionBlock heading="Operational and civilian reporting" id="operational-reporting"><p>Reporting involving military activity, public safety or civilians is held to the same evidence discipline with additional care for timing, operational security, casualty uncertainty and the distinction between official statements and independently established facts. We do not turn a military claim into a neutral finding merely by repeating it.</p></SectionBlock>
      <SectionBlock heading="Changes to the record" id="changes-to-the-record"><ul><li><strong>Correction.</strong> Fixes a material factual or contextual error and should be transparent.</li><li><strong>Update.</strong> Adds information that emerged after publication without implying the earlier record was wrong.</li><li><strong>Developing-story revision.</strong> Updates the current canonical account while preserving version history.</li><li><strong>Added context.</strong> Improves understanding without changing the underlying finding.</li><li><strong>Source update.</strong> Adds, replaces or clarifies sourcing; if it changes the conclusion, that change also belongs in the correction record.</li><li><strong>Technical migration.</strong> Moves or reformats material without pretending it was newly verified.</li></ul></SectionBlock>
      <SectionBlock heading="Corrections and accountability" id="corrections"><p>Automated assistance does not reduce responsibility; it raises the importance of a transparent correction mechanism. When evidence changes, uncertainty and conclusions can change with it. Material errors should be corrected, significant changes should be visible and useful historical context should be preserved rather than silently erased.</p><nav aria-label="Read next"><ul className={styles.readNext}><li><Link href="/corrections">Corrections — the sitewide policy and the public ledger <Icon name="arrow-right" inline className="arrow" /></Link></li><li><Link href="/information-war">How it works — the system map and the information-war workflow <Icon name="arrow-right" inline className="arrow" /></Link></li></ul></nav></SectionBlock>

      <p className={styles.colophon}>
        Last reviewed <time className={styles.colophonDate} dateTime={LAST_REVIEWED}>{LAST_REVIEWED_LABEL}</time>. This standard is reviewed when the publication routes change and whenever a correction shows a rule needed one.
      </p>
    </DocPage>
  );
}
