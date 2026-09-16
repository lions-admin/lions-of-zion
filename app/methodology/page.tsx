import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SITE_URL } from "@/lib/site-config";
import { PUBLICATION_PROVENANCE } from "@/server/contracts/publication";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./page.module.css";

const TAGLINE = "How Lions of Zion separates sources, claims, evidence, assessment and uncertainty — across human and machine-authored work.";
const PAGE_URL = `${SITE_URL}/methodology`;

export const metadata: Metadata = pageMetadata({ title: "Methodology", description: TAGLINE, path: "/methodology" });

const METHODOLOGY_JSON_LD = { "@context": "https://schema.org", "@type": "WebPage", name: "Methodology", url: PAGE_URL, description: TAGLINE, isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL } };

/* The "last reviewed" line is a content constant because there is no CMS
   field for it — trust pages are source files, so the date a person last
   read the page end to end lives here, next to the prose it vouches for.
   Bump it when the wording of a rule changes, not on every code touch. */
const LAST_REVIEWED = "2026-09-17";

/* METHOD-001: the standard in one paragraph, then a contents of itself.
   Every row links to the section that holds the rule in full. */
const GLANCE: { href: string; term: string; def: string }[] = [
  { href: "#the-standard", term: "The standard", def: "Scale does not change what counts as evidence." },
  { href: "#source-claim-evidence-assessment", term: "Categories", def: "Source, claim, evidence, assessment and uncertainty stay separate." },
  { href: "#source-families", term: "Source families", def: "Repetition is not corroboration." },
  { href: "#labels-and-language", term: "Language", def: "The words of a publication say what kind of thing it is." },
  { href: "#ai-assistance", term: "How AI is used", def: "What the systems may do, and what their output never becomes." },
  { href: "#human-governance", term: "Human governance", def: "Who sets the rules, and where a person decides." },
  { href: "#publication-provenance", term: "Publication provenance", def: "The two disclosed paths, and what each one tells the reader." },
  { href: "#changes-to-the-record", term: "Changes to the record", def: "What kind of change was made, named per change." },
  { href: "#corrections", term: "Corrections", def: "The correction mechanism, and where to report an error." },
];

/* METHOD-002: the process as a static relationship diagram — an ordered list
   with a drawn track, a numeral, a stage name, and, on the one stage nothing
   automated can pass, a written gate label and a panel of its own. The gate
   is scoped to what it actually is (the rules people set and the escalation
   that runs through them), not to a claim that a person approves every
   publication — see `tests/publication-provenance-copy.test.ts`. */
const PROCESS: { name: string; icon: IconName; note: string; gate?: string }[] = [
  { name: "Collect", icon: "intake", note: "Configured sources bring public material in. Collection records what was retrieved; it never composes or publishes a record on its own." },
  { name: "Preserve provenance", icon: "evidence", note: "Origin, source family and provenance travel with the material, so copies of one account stay one source family." },
  { name: "Assess", icon: "assessment", note: "Human investigations and authorized machine-authored runs turn evidence into reporting and assessments with the uncertainty kept visible." },
  { name: "Apply publishing rules", icon: "publish", note: "Server-enforced gates apply publishing rules per provenance path before anything reaches the public record." },
  { name: "Human governance", icon: "review", gate: "Gate — human governance", note: "People define the mission, standards, permissions, escalation paths, corrections policy and safety boundaries. Sensitive or consequential work is escalated for human editorial review. Nothing automated sets these rules." },
];

export default function Page() {
  /* VA-59: trust surfaces state the rules; the scan stays silent behind them. */
  return (
    <DocPage
      routeId="methodology"
      title="Methodology"
      tagline={TAGLINE}
      rails="toc"
      dateline={<p className={styles.lastReviewed}>Last reviewed {LAST_REVIEWED}</p>}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(METHODOLOGY_JSON_LD) }} />

      {/* METHOD-001 — the standard in one paragraph, scannable before anything else. */}
      <div className={styles.summary}>
        <p className={styles.summaryText}>
          Every record states what kind of thing it is — source, claim,
          evidence, assessment or uncertainty — and the method below is what
          keeps those categories visible when a story is moving quickly.
        </p>
      </div>

      {/* A glance index: the rules by name, the sentence beside each one, and
          a link to where the rule lives in full. */}
      <p className={styles.glanceKicker}>The standard at a glance</p>
      <dl className={styles.glance}>
        {GLANCE.map((row) => (
          <div key={row.href} className={styles.glanceRow}>
            <dt className={styles.glanceTerm}><a href={row.href}>{row.term}</a></dt>
            <dd className={styles.glanceDef}>{row.def}</dd>
          </div>
        ))}
      </dl>

      {/* METHOD-002 — the process, drawn as a gated diagram. Static by design:
          the pipeline is a standard, not an event, so nothing about it arrives
          and it reads identically with scripting off and under reduced motion. */}
      <SectionBlock heading="How a record is made" id="how-a-record-is-made">
        <ol className={styles.process}>
          {PROCESS.map((stage, index) => (
            <li key={stage.name} className={styles.stage} data-gate={stage.gate ? "" : undefined}>
              <span className={styles.stageNode} aria-hidden="true"><Icon name={stage.icon} size={18} strokeWidth={1.5} /></span>
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

      <SectionBlock heading="The standard" id="the-standard"><p>Lions of Zion uses AI, OSINT and editorial research to operate at scale, but scale does not change what counts as evidence. A source is not a claim, a claim is not evidence, evidence is not an assessment, and an assessment is not certainty. The method is designed to keep those categories visible even when a story is moving quickly.</p><p>Technology increases our reach. Standards determine what deserves publication. Human governance defines the boundaries.</p></SectionBlock>
      <SectionBlock heading="Source, claim, evidence, assessment" id="source-claim-evidence-assessment"><dl><div><dt><strong>Source</strong></dt><dd>The original material or reporting that actually says, shows or records something.</dd></div><div><dt><strong>Claim</strong></dt><dd>An assertion attributed to a source, a person, an institution or the public information environment.</dd></div><div><dt><strong>Evidence</strong></dt><dd>Material that genuinely supports, contradicts or constrains a claim.</dd></div><div><dt><strong>Assessment</strong></dt><dd>Lions of Zion&apos;s evidence-based interpretation of what the available record supports.</dd></div><div><dt><strong>Uncertainty</strong></dt><dd>What the reviewed material does not establish, including missing evidence, unresolved contradictions and limits in provenance.</dd></div></dl></SectionBlock>
      <SectionBlock heading="Source families and corroboration" id="source-families"><p>Repetition is not corroboration. Five articles, posts or clips that all trace back to one original account remain one source family for that fact. We preserve source lineage wherever possible and treat independent origin as a different question from the number of copies or headlines repeating the same material.</p><p>Primary material is preferred where it can be reached. Secondary reporting and fact-checking can be valuable, but a citation has to support the specific sentence beside it, not merely discuss the same subject.</p></SectionBlock>
      <SectionBlock heading="Facts, allegations and analysis" id="labels-and-language"><p>The language of a publication should tell readers what kind of thing they are looking at. We distinguish established fact, attributed or official claim, allegation, inference, analysis and editorial conclusion. Contested material stays contested when the evidence does not settle it. Unsupported means the reviewed record does not support the assertion; it does not mean an algorithm has omnisciently proved a universal negative.</p><p>Confidence and uncertainty should be explicit. A real post does not prove the event described in it happened. A real association does not prove operational coordination. Similar wording or simultaneous posting does not by itself prove common direction or malicious intent.</p></SectionBlock>
      <SectionBlock heading="How AI is used" id="ai-assistance"><p>AI systems can help scan large information environments, compare sources, surface inconsistencies, retrieve historical context, organize evidence, monitor developing stories, identify narrative patterns, assist drafting and operate structured editorial workflows. Authorized machine-authored runs can also create or update canonical publications and publish through the controlled production pipeline.</p><p>Those capabilities do not make model output evidence. AI-generated reasoning, summaries and illustrations remain derived editorial material. Documentary claims still depend on inspectable sources and provenance.</p></SectionBlock>
      <SectionBlock heading="Human governance" id="human-governance"><p>Lions of Zion is AI-powered and human-governed. People define the mission, editorial policy, source standards, provenance rules, publishing permissions, escalation paths, corrections policy, verification requirements and safety boundaries. Humans also review sensitive or consequential work where the operating rules require editorial escalation.</p><p>Human governance is not the same thing as claiming that a person manually approves every sentence before publication. The site has more than one publication path, and each path should be described as it actually operates.</p></SectionBlock>
      <SectionBlock heading="Publication provenance" id="publication-provenance"><p>Editorial publications use two disclosed provenance paths. The authorship line on a publication tells readers which one produced the record.</p><dl>{(["machine", "human"] as const).map((kind) => <div key={kind}><dt><strong>{PUBLICATION_PROVENANCE[kind].label}</strong></dt><dd>{PUBLICATION_PROVENANCE[kind].detail}</dd></div>)}</dl><p>Imported and archive records are separate from those editorial bylines. They retain the provenance of the underlying material. Hosting, translating, indexing or machine-processing an archive item does not mean Lions independently re-verified every statement inside it.</p></SectionBlock>
      <SectionBlock heading="Information-war research" id="information-war-research"><p>Investigations can trace claim origin, source lineage, narrative evolution, timing, amplification, image or video provenance and source-family relationships. These signals can reveal patterns worth investigating; they do not automatically establish coordination, intent or authorship.</p><p>Where synthetic or manipulated media is suspected, the publication should distinguish what can be established about the file from what remains a forensic hypothesis. An illustrated visual is never treated as evidence of the event it explains.</p></SectionBlock>
      <SectionBlock heading="Operational and civilian reporting" id="operational-reporting"><p>Reporting involving military activity, public safety or civilians is held to the same evidence discipline with additional care for timing, operational security, casualty uncertainty and the distinction between official statements and independently established facts. We do not turn a military claim into a neutral finding merely by repeating it.</p></SectionBlock>
      <SectionBlock heading="Changes to the record" id="changes-to-the-record"><ul><li><strong>Correction.</strong> Fixes a material factual or contextual error and should be transparent.</li><li><strong>Update.</strong> Adds information that emerged after publication without implying the earlier record was wrong.</li><li><strong>Developing-story revision.</strong> Updates the current canonical account while preserving version history.</li><li><strong>Added context.</strong> Improves understanding without changing the underlying finding.</li><li><strong>Source update.</strong> Adds, replaces or clarifies sourcing; if it changes the conclusion, that change also belongs in the correction record.</li><li><strong>Technical migration.</strong> Moves or reformats material without pretending it was newly verified.</li></ul></SectionBlock>
      <SectionBlock heading="Corrections and accountability" id="corrections"><p>Automated assistance does not reduce responsibility; it raises the importance of a transparent correction mechanism. When evidence changes, uncertainty and conclusions can change with it. Material errors should be corrected, significant changes should be visible and useful historical context should be preserved rather than silently erased.</p><nav aria-label="Read next"><ul className={styles.readNext}><li><Link href="/corrections">Corrections — the sitewide policy and the public ledger →</Link></li><li><Link href="/information-war">How it works — the system map and the information-war workflow →</Link></li></ul></nav></SectionBlock>
    </DocPage>
  );
}
