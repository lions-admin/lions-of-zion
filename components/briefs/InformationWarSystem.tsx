import Link from "next/link";
import { Suspense } from "react";
import { EditorialShell } from "@/components/site/EditorialShell";
import { PipelineTrace } from "./information-war/PipelineTrace";
import { RecentActivity } from "./information-war/LivePanels";
import { DailyCycle, OutputsFork } from "./information-war/StorySections";
import { HomeEvidencePipeline } from "@/components/home/HomeEvidencePipeline";
import styles from "./information-war-system.module.css";

export function InformationWarSystem() {
  return (
    <EditorialShell routeId="information-war" register="silent" className={styles.page} progressTrackClassName={styles.progressTrack}>
      <section className={styles.hero} id="page-content" aria-labelledby="war-heading">
        <div className={styles.heroTopline}>
          <p className={styles.eyebrow}>Lions of Zion / Israeli-built information-integrity technology</p>
          <a href="#system">Explore the architecture <span aria-hidden="true">↘</span></a>
        </div>
        <div className={styles.heroGrid}>
          <div>
            <h1 id="war-heading"><span>{"This is an "}</span><em>{"information "}</em><span>war.</span></h1>
            <p className={styles.heroStatement}>AI-scale research.<br />Evidence-led publication.<br />Human-governed rules.</p>
            <a className={styles.heroJump} href="#system">Follow the evidence <span aria-hidden="true">↓</span></a>
          </div>
          <div className={styles.problem} id="problem">
            <p className={styles.eyebrow}>The problem / Repetition ≠ corroboration</p>
            <figure className={styles.originDiagram}>
              <div className={styles.reportLabels} aria-hidden="true">{["A", "B", "C", "D", "E"].map((letter) => <span key={letter}>Report {letter}<i /></span>)}</div>
              <svg viewBox="0 0 460 200" preserveAspectRatio="none" role="img" aria-label="Illustration: five reports can trace back to the same original source.">
                {[46, 138, 230, 322, 414].map((x) => <path key={x} d={`M${x} 0 C${x} 115 230 70 230 184`} />)}
                <circle cx="230" cy="186" r="5" />
              </svg>
              <div className={styles.originCount}><strong>01</strong><span>original source.<br />Not five confirmations.</span></div>
              <figcaption>Illustrative source relationship — not a measured case.</figcaption>
            </figure>
            <p>
              The information environment can turn one claim into a wall of apparent confirmation.
              Lions of Zion uses technology to trace origin, source family, context, propagation and
              uncertainty — then makes those distinctions visible to the reader.
            </p>
          </div>
        </div>
        <nav className={styles.chapterNav} aria-label="On this page">
          <a href="#system"><span>01</span> How the system works <span aria-hidden="true">↓</span></a>
          <a href="#cycle"><span>02</span> What keeps it accountable <span aria-hidden="true">↓</span></a>
          <a href="#record"><span>03</span> What the public can use <span aria-hidden="true">↓</span></a>
        </nav>
      </section>

      <section className={styles.section} id="system" aria-labelledby="system-heading">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>01 / The architecture</p><h2 id="system-heading">Machine scale.<br /><em>Visible provenance.</em></h2></div>
          <p>
            AI can discover, compare, organize, draft and operate authorized editorial workflows.
            Different records take different paths, but none is allowed to blur source, evidence,
            authorship and assessment into one opaque output.
          </p>
        </div>
        <PipelineTrace />
      </section>

      <section className={`${styles.section} ${styles.accountability}`} id="cycle" aria-labelledby="cycle-heading">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>02 / The standard</p><h2 id="cycle-heading">AI-powered.<br /><em>Human-governed.</em></h2></div>
          <p>
            People define the mission, source standards, publishing permissions, provenance rules,
            escalation paths, corrections policy and safety boundaries. AI expands reach and speed;
            it does not become evidence and it does not eliminate accountability.
          </p>
        </div>
        <div className={styles.evidenceLedger}>
          <div>
            <span className={styles.eyebrow}>Keep the distinctions</span>
            <h3>Claim.<br />Evidence.<br /><em>Assessment.</em></h3>
            <p>Different things.<br />Never interchangeable.</p>
          </div>
          <ol>
            <li><span>01</span><div><h3>Trace the source family</h3><p>Preserve origin and provenance. Several copies of one account are not independent corroboration, and a source being real does not make every claim inside it true.</p></div></li>
            <li><span>02</span><div><h3>Track narrative evolution</h3><p>Compare timing, framing, propagation, image or video provenance and amplification patterns. Similarity or simultaneous posting can justify investigation; it does not by itself prove coordination or malicious intent.</p></div></li>
            <li><span>03</span><div><h3>Make uncertainty explicit</h3><p>Separate attributed claims, forensic ambiguity, verified findings and editorial inference. Where evidence does not settle the question, the publication should say so.</p></div></li>
            <li><span>04</span><div><h3>Keep the record correctable</h3><p>Versioned publications retain change history. Automated assistance does not reduce responsibility: errors, withdrawals and significant revisions remain part of the public record.</p><Link href="/corrections">Correction policy <span aria-hidden="true">↗︎</span></Link></div></li>
          </ol>
        </div>
        <DailyCycle />
        <section className={styles.section} id="walkthrough" aria-labelledby="walkthrough-heading">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>A worked example</p><h2 id="walkthrough-heading">Put the narrative<br /><em>to the test.</em></h2></div>
            <p>Follow a circulating claim through source discovery, comparison and assessment. Examine both supporting and contradicting material, and keep propagation separate from proof.</p>
          </div>
          <HomeEvidencePipeline />
        </section>
      </section>

      <section className={styles.section} id="record" aria-labelledby="record-heading">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>03 / In public</p><h2 id="record-heading">The work,<br /><em>in the open.</em></h2></div>
          <p>Reporting to read. Evidence to inspect. Records to return to. Machine-authored work is disclosed, archive material keeps its own provenance, and readers can follow the sources behind consequential claims.</p>
        </div>
        <OutputsFork />
        <p className={styles.askReadingLink}>Have a question about the record? <Link href="/ask">Open Ask <span aria-hidden="true">↗︎</span></Link></p>
        <div className={styles.recordHeading} id="activity"><h3>From the published record</h3><Link href="/updates">All updates <span aria-hidden="true">↗︎</span></Link></div>
        <p className={styles.recordCaption}>Publication dates, not job activity. Times shown in Jerusalem time.</p>
        <Suspense fallback={<p className={styles.emptyRecord}>Loading the published record…</p>}><RecentActivity /></Suspense>
      </section>

      <section className={styles.support} aria-labelledby="support-heading">
        <p className={styles.eyebrow}>For those who believe the record matters</p>
        <h2 id="support-heading">Help keep evidence<br /><em>in the public’s hands.</em></h2>
        <div>
          <p>Support the work behind the page: source research, documentation, public reporting and the technology that makes information manipulation easier to inspect.</p>
          <Link href="/support-us" className={styles.supportLink}>Support Lions of Zion <span aria-hidden="true">↗︎</span></Link>
          <Link href="/methodology" className={styles.methodologyLink}>Read the methodology</Link>
        </div>
      </section>
    </EditorialShell>
  );
}
