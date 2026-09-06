import Link from "next/link";
import { Suspense } from "react";
import { EditorialShell } from "@/components/site/EditorialShell";
import { PipelineTrace } from "./information-war/PipelineTrace";
import { RecentActivity } from "./information-war/LivePanels";
import { DailyCycle, OutputsFork } from "./information-war/StorySections";
import styles from "./information-war-system.module.css";

export function InformationWarSystem() {
  return (
    <EditorialShell routeId="information-war" register="silent" className={styles.page} progressTrackClassName={styles.progressTrack}>
      <section className={styles.hero} id="page-content" aria-labelledby="war-heading">
        <div className={styles.heroTopline}><p className={styles.eyebrow}>Lions of Zion / Inside the evidence desk</p><a href="#system">Explore the architecture <span aria-hidden="true">↘</span></a></div>
        <div className={styles.heroGrid}>
          <div>
            <h1 id="war-heading"><span>{"This is an "}</span><em>{"information "}</em><span>war.</span></h1>
            <p className={styles.heroStatement}>Not a contest to speak louder.<br />A responsibility to show the evidence.</p>
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
            <p>Five headlines can repeat one claim. A fragment can lose its context. The work is to trace the source, separate the claim from the finding, and make the distinction public.</p>
          </div>
        </div>
        <nav className={styles.chapterNav} aria-label="On this page">
          <a href="#system"><span>01</span> How the system works <span aria-hidden="true">↓</span></a>
          <a href="#cycle"><span>02</span> What keeps it accountable <span aria-hidden="true">↓</span></a>
          <a href="#record"><span>03</span> What the public can use <span aria-hidden="true">↓</span></a>
        </nav>
      </section>

      <section className={styles.section} id="system" aria-labelledby="system-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / The architecture</p><h2 id="system-heading">Many ways in.<br /><em>A traceable way out.</em></h2></div>
          <p>Collection, research and submitted editions do not all take the same path. Follow a journey. Open a step. See what it receives, what it produces, and where its limits are.</p></div>
        <PipelineTrace />
      </section>

      <section className={`${styles.section} ${styles.accountability}`} id="cycle" aria-labelledby="cycle-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / The standard</p><h2 id="cycle-heading">The source is not<br /><em>the conclusion.</em></h2></div><p>A convincing interface is not evidence. The system is useful only if readers can distinguish what was said, what supports it, and what remains unresolved.</p></div>
        <div className={styles.evidenceLedger}>
          <div><span className={styles.eyebrow}>Keep the distinctions</span><h3>Claim.<br />Evidence.<br /><em>Assessment.</em></h3><p>Three different things.<br />Never interchangeable.</p></div>
          <ol>
            <li><span>01</span><div><h3>Preserve the origin</h3><p>Keep source references and provenance. Treat several copies of one account differently from independent corroboration. Source-family grouping helps; it does not replace source research.</p></div></li>
            <li><span>02</span><div><h3>Make uncertainty explicit</h3><p>A circulating claim is not a confirmed finding. Sourced reporting and the desk’s own analysis must be distinguishable. Where the material does not settle a question, say so.</p></div></li>
            <li><span>03</span><div><h3>Keep the record correctable</h3><p>Versioned publication records retain a change history. Corrections and withdrawals are part of maintaining a record, not evidence that the original publication was infallible.</p><Link href="/corrections">Correction policy <span aria-hidden="true">↗︎</span></Link></div></li>
          </ol>
        </div>
        <DailyCycle />
      </section>

      <section className={styles.section} id="record" aria-labelledby="record-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / In public</p><h2 id="record-heading">The work,<br /><em>in the open.</em></h2></div><p>Reporting to read. Records to return to. Sources to inspect. Explore the public side of the system, then open a publication below and follow the material behind it.</p></div>
        <OutputsFork />
        <p className={styles.askReadingLink}>Have a question about the record? <Link href="/ask">Open Ask <span aria-hidden="true">↗︎</span></Link></p>
        <div className={styles.recordHeading} id="activity"><h3>From the published record</h3><Link href="/updates">All updates <span aria-hidden="true">↗︎</span></Link></div>
        <p className={styles.recordCaption}>Publication dates, not job activity. Times shown in Jerusalem time.</p>
        <Suspense fallback={<p className={styles.emptyRecord}>Loading the published record…</p>}><RecentActivity /></Suspense>
      </section>

      <section className={styles.support} aria-labelledby="support-heading">
        <p className={styles.eyebrow}>For those who believe the record matters</p>
        <h2 id="support-heading">Help keep evidence<br /><em>in the public’s hands.</em></h2>
        <div><p>Support the work behind the page: source research, documentation, public reporting and the tools that make the record accessible.</p>
          <Link href="/support-us" className={styles.supportLink}>Support Lions of Zion <span aria-hidden="true">↗︎</span></Link>
          <Link href="/methodology" className={styles.methodologyLink}>Read the methodology</Link></div>
      </section>
    </EditorialShell>
  );
}
