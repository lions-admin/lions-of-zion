import Link from "next/link";
import { Suspense } from "react";
import { PointerHighlight } from "@/components/motion/PointerHighlight";
import { EditorialShell } from "@/components/site/EditorialShell";
import { SourceConvergenceBeams } from "./InformationWarBeams";
import { PipelineTrace } from "./information-war/PipelineTrace";
import { OperationalStatus, RecentActivity } from "./information-war/LivePanels";
import { DailyCycle, OutputsFork } from "./information-war/StorySections";
import cardStyles from "@/components/ui/card.module.css";
import styles from "./information-war-system.module.css";

/*
 * `/information-war` — how a claim becomes pressure, and what this desk does
 * about it.
 *
 * ## Why this is four sections and was ten
 *
 * The page taught the same pipeline four times. `SystemMap` walked seven
 * stages; `SignalJourney` walked eight steps; a narrative panel walked four; a
 * claim flow walked seven — four ordered lists of one journey, two of them
 * through the same component and stylesheet with different data. Mapped
 * against each other they were the same stations renamed: `Detection` was
 * "Extracted"/"Clustered" was "Semantic clusters" was "Claim detected".
 *
 * Around them, "repetition is not corroboration" was stated six times — as a
 * whole section with its own diagram, then again in two stage mechanisms, in
 * two journey steps, and in a note. Sections 01 and 02 both argued that the
 * frame outruns the facts, with a bar diagram each. Sections 05 and 10 both
 * sent the reader to the updates feed and the fact-check desk. A ten-item
 * bento index sat at the top, a table of contents for a page you scroll.
 *
 * Ten sections, four ideas. So: the problem, the system, the rhythm, the
 * record. The four lists became one traced diagram — `PipelineTrace` — which
 * keeps every sentence they carried and drops the pretence that they were
 * different pictures.
 *
 * ## Telemetry rule, unchanged
 *
 * Only the public record is shown: latest publication timestamps, collection
 * cadence, what has actually published. Per-stage job state is internal, and
 * this page would rather draw nothing than draw a number it cannot show. The
 * travelling packet in the trace is an explanation of shape and says so — it
 * carries no counts and is `aria-hidden`.
 *
 * Every diagram is server markup. Client JavaScript rides the beams and moves
 * the packet; the rails, the step text and the captions carry the meaning
 * without it and under reduced motion.
 */

const READING_ORDER = [
  ["problem", "The problem"],
  ["system", "The system"],
  ["cycle", "The rhythm"],
  ["record", "The record"],
] as const;

export function InformationWarSystem() {
  return (
    <EditorialShell
      routeId="information-war"
      register="muted"
      className={styles.page}
      progressTrackClassName={styles.progressTrack}
    >
      <section className={styles.hero} id="page-content" aria-labelledby="war-heading">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The battlefield is perception.</p>
          <h1 id="war-heading">
            <span>{"This is an "}</span>
            <span>{"information "}</span>
            <span>{"war."}</span>
          </h1>
          <p className={styles.heroStatement}>
            We watch the information environment, separate claims from the commentary around them,
            check them against primary material, and publish what survives — with the evidence
            attached and the history kept.
          </p>
          <Suspense>
            <OperationalStatus />
          </Suspense>
          <a className={styles.heroCta} href="#system">
            Explore the system <span aria-hidden="true">↓</span>
          </a>
        </div>
        {/* Four cells, one per section. At ten it was a table of contents for a
            page the reader was already scrolling; at four it is a shape of the
            argument, which is worth showing before the argument starts. */}
        <nav className={styles.heroIndex} aria-label="Reading order">
          {READING_ORDER.map(([id, name], index) => (
            <a key={id} href={`#${id}`} className={cardStyles.pointerSurface}>
              <PointerHighlight />
              <span>{String(index + 1).padStart(2, "0")}</span>
              {name}
            </a>
          ))}
        </nav>
      </section>

      {/* 01 — what were three sections making one argument, each with its own
          diagram. The convergence beams survive as the diagram because they are
          the one that shows the mechanism rather than asserting it: five copies
          arriving at one origin is the claim, drawn. */}
      <section className={styles.section} id="problem" aria-labelledby="problem-heading">
        <p className={styles.index}>01 / The problem</p>
        <div className={styles.sectionBody}>
          <h2 id="problem-heading">Repetition is not corroboration.</h2>
          <p>
            Information warfare is the contest to define meaning at speed. A true fragment can be
            stripped of context. An unresolved claim can be repeated as fact. Five headlines can look
            like five confirmations even when all five descend from one original report — and by the
            time the evidence arrives, the frame it would have corrected has already set.
          </p>
          <p>
            The answer is not louder messaging. It is a faster, visible chain from source to claim,
            from claim to evidence, and from evidence to a public explanation.
          </p>
          <SourceConvergenceBeams label="Five syndicated copies of one wire report converging into a single upstream source family, counted as one origin">
            <div className={styles.copyRow}>
              {["Outlet A", "Outlet B", "Outlet C", "Outlet D", "Outlet E"].map((outlet) => (
                <span key={outlet}>
                  {outlet}
                  <i data-beam-copy={outlet} />
                </span>
              ))}
            </div>
            <div className={styles.busField} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className={styles.origin}>
              <i className={styles.originMark} data-beam-origin />
              <small>Counted as</small>
              <strong>One</strong>
              <span>Upstream source family</span>
            </div>
          </SourceConvergenceBeams>
          <p className={styles.diagramNote}>
            Every source belongs to a named family, and that is what lets five syndicated copies of
            one wire report be counted as one origin. The number that matters is distinct source
            families, not accounts or copies: twenty accounts in one family are one megaphone; three
            accounts across three families are a story actually spreading.
          </p>
        </div>
      </section>

      <section className={styles.system} id="system" aria-labelledby="system-heading">
        <div className={styles.systemIntro}>
          <p className={styles.index}>02 / The system</p>
          <h2 id="system-heading">From open signal to public record.</h2>
          <p>
            Seven stages, and three things that travel through them. Follow a signal, a narrative or
            a claim, and the stages each one stops at light up with what happens there. Collection is
            automated and continuous; the evidence chain stays visible; every public article can be
            corrected, removed, and traced back to the material under it.
          </p>
          <p className={styles.systemDisclosure}>
            <strong>
              This diagram describes how the system is built, with live state drawn only from the
              public record.
            </strong>{" "}
            Per-stage job telemetry is internal, and we would rather draw nothing than draw a number
            we cannot show you — so the packet moving down the rail is an explanation of shape, not a
            reading. Velocity, volume and reach figures are reported by platforms and are the most
            gameable numbers a hostile actor controls, so this page draws no dials for them. What the
            system has actually produced is public: every entry is in the{" "}
            <Link href="/updates">updates feed</Link>, and every checked claim is on the{" "}
            <Link href="/fact-check">fact-check desk</Link>.
          </p>
        </div>
        <PipelineTrace />
      </section>

      <section className={styles.section} id="cycle" aria-labelledby="cycle-heading">
        <p className={styles.index}>03 / The rhythm</p>
        <div className={styles.sectionBody}>
          <h2 id="cycle-heading">Continuous intake, one daily edition.</h2>
          <DailyCycle />
        </div>
      </section>

      {/* 04 — "what is happening now" and "the output" were two sections
          pointing at the same three surfaces. One section: what the system has
          published, and where it publishes. */}
      <section className={styles.section} id="record" aria-labelledby="record-heading">
        <p className={styles.index}>04 / The record</p>
        <div className={styles.sectionBody}>
          <h2 id="record-heading">Evidence must travel.</h2>
          <p>
            The pipeline&rsquo;s internal job monitor is staff-only. What follows is what it has
            actually published — the newest public records, each reachable and traceable — and the
            three surfaces everything lands on.
          </p>
          <Suspense>
            <RecentActivity />
          </Suspense>
          <OutputsFork />
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Lions of Zion / Truth has a signal</span>
        <Link href="/methodology">Methodology</Link>
      </footer>
    </EditorialShell>
  );
}
