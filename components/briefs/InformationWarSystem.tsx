import Link from "next/link";
import { Suspense } from "react";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { PipelineTrace } from "./information-war/PipelineTrace";
import { RecentActivity } from "./information-war/LivePanels";
import { DailyCycle, OutputsFork } from "./information-war/StorySections";
import { HomeEvidencePipeline } from "@/components/home/HomeEvidencePipeline";
import styles from "./information-war-system.module.css";
import { Icon } from "@/components/ui/Icon";

/**
 * Behind the Desk — how the record is made.
 *
 * This was the one public page built outside the site's system: its own
 * 1320px shell, 34 hand-set type sizes, 8–12px prose, hand-rolled buttons, no
 * document trail and no contents rail. It is on `DocPage` now, which is the
 * shell `/methodology` and `/corrections` already wear — so the trail, the
 * rail, the reading measure and the progress line come with the shell.
 *
 * `SectionPage` was the named target and cannot serve this route: it resolves
 * its lede through `getSectionPageNode`, and `/information-war` is
 * deliberately absent from `SITE_NAVIGATION` (VA-15). The two shells are one
 * behaviour under two names — `rails="toc"` here is `withToc` there — so the
 * reader gets exactly what the plan asked for.
 */

const HEADLINE = "This is an information war.";
const LEDE =
  "AI-scale research, evidence-led publication and human-governed rules — and the architecture that keeps a source, a claim, the evidence and an assessment from blurring into one output.";

const REPORT_NODES = ["A", "B", "C", "D", "E"].map((letter, index) => ({ letter, x: 46 + index * 92 }));

const RULES = [
  {
    heading: "Trace the source family",
    body: "Preserve origin and provenance. Several copies of one account are not independent corroboration, and a source being real does not make every claim inside it true.",
  },
  {
    heading: "Track narrative evolution",
    body: "Compare timing, framing, propagation, image or video provenance and amplification patterns. Similarity or simultaneous posting can justify investigation; it does not by itself prove coordination or malicious intent.",
  },
  {
    heading: "Make uncertainty explicit",
    body: "Separate attributed claims, forensic ambiguity, verified findings and editorial inference. Where evidence does not settle the question, the publication should say so.",
  },
  {
    heading: "Keep the record correctable",
    body: "Versioned publications retain change history. Automated assistance does not reduce responsibility: errors, withdrawals and significant revisions remain part of the public record.",
    href: "/corrections",
    linkText: "Correction policy",
  },
] as const;

export function InformationWarSystem() {
  return (
    <DocPage routeId="information-war" title={HEADLINE} tagline={LEDE} rails="toc">
      <SectionBlock heading="Repetition is not corroboration" id="problem">
        <p>
          The information environment can turn one claim into a wall of apparent confirmation. Lions of Zion uses
          technology to trace origin, source family, context, propagation and uncertainty — then makes those
          distinctions visible to the reader.
        </p>
        <figure className={styles.originFigure}>
          <svg viewBox="0 0 460 156" role="img" aria-label="Illustration: five reports can trace back to the same original source.">
            {REPORT_NODES.map(({ letter, x }) => (
              <g key={letter}>
                <rect className={styles.originNode} x={x - 38} y="1" width="76" height="30" />
                <text className={styles.originLabel} x={x} y="20">Report {letter}</text>
                <path className={styles.originWire} d={`M${x} 31 V84`} />
              </g>
            ))}
            <path className={styles.originWire} d="M46 84 H414" />
            <path className={styles.originTrunk} d="M230 84 V128" />
            <circle className={styles.originHalo} cx="230" cy="138" r="9" />
            <circle className={styles.originDot} cx="230" cy="138" r="4" />
          </svg>
          <div className={styles.originCount}>
            <strong>01</strong>
            <span>original source. Not five confirmations.</span>
          </div>
          <figcaption>Illustrative source relationship — not a measured case.</figcaption>
        </figure>
      </SectionBlock>

      <SectionBlock heading="How the system works" id="system">
        <p>
          AI can discover, compare, organize, draft and operate authorized editorial workflows. Different records take
          different paths, but none is allowed to blur source, evidence, authorship and assessment into one opaque
          output. Choose a journey and step through it.
        </p>
        <PipelineTrace />
      </SectionBlock>

      <SectionBlock heading="What keeps it accountable" id="cycle">
        <p>
          People define the mission, source standards, publishing permissions, provenance rules, escalation paths,
          corrections policy and safety boundaries. AI expands reach and speed; it does not become evidence and it does
          not eliminate accountability. A claim, the evidence behind it and an assessment of it are different things,
          and they are never interchangeable.
        </p>
        <ol className={styles.ruleLedger}>
          {RULES.map((rule, index) => (
            <li key={rule.heading}>
              <span className={styles.stepMark} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{rule.heading}</h3>
                <p>{rule.body}</p>
                {"href" in rule ? (
                  <Link href={rule.href}>
                    {rule.linkText} <Icon name="arrow-right" inline className="arrow" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <DailyCycle />
      </SectionBlock>

      <SectionBlock heading="A claim, put to the test" id="walkthrough">
        <p>
          Follow a circulating claim through source discovery, comparison and assessment. Examine both supporting and
          contradicting material, and keep propagation separate from proof.
        </p>
        <HomeEvidencePipeline />
      </SectionBlock>

      <SectionBlock heading="What the public can use" id="record">
        <p>
          Reporting to read. Evidence to inspect. Records to return to. Machine-authored work is disclosed, archive
          material keeps its own provenance, and readers can follow the sources behind consequential claims.
        </p>
        <OutputsFork />
        <p className={styles.askReadingLink}>
          Have a question about the record?{" "}
          <Link href="/ask">Open Ask <Icon name="arrow-right" inline className="arrow" /></Link>
        </p>
        <div className={styles.recordHeading} id="activity">
          <h3>From the published record</h3>
          <Link href="/updates">All updates <Icon name="arrow-right" inline className="arrow" /></Link>
        </div>
        <p className={styles.recordCaption}>Publication dates, not job activity. Times shown in Jerusalem time.</p>
        <Suspense fallback={<p className={styles.recordCaption}>Loading the published record…</p>}>
          <RecentActivity />
        </Suspense>
      </SectionBlock>

      {/* The ending is activation, not brand closure (Peak-End). The Support
          action is outlined, not filled: the masthead's Support Us is the one
          gold fill on screen, and a second one would split the accent. */}
      <section className={styles.support} aria-label="Support the work">
        <p className={styles.kicker}>For those who believe the record matters</p>
        {/* Deliberately without an id: the contents rail lists a document's
            sections, and the ending is not one of them. `SectionToc` resolves
            an entry through the heading's own id or its nearest id'd ancestor
            inside the body, so an un-id'd heading is simply not listed. */}
        <h2>Help keep evidence in the public’s hands.</h2>
        <p>
          Support the work behind the page: source research, documentation, public reporting and the technology that
          makes information manipulation easier to inspect.
        </p>
        <div className={styles.supportActions}>
          <Link href="/support-us" className={styles.supportLink}>
            Support Lions of Zion <Icon name="arrow-right" inline className="arrow" />
          </Link>
          <Link href="/methodology" className={styles.methodologyLink}>Read the methodology</Link>
        </div>
      </section>
    </DocPage>
  );
}
