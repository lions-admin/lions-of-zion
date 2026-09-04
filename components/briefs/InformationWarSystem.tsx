import Link from "next/link";
import { Suspense } from "react";
import { EditorialShell } from "@/components/site/EditorialShell";
import { SourceConvergenceBeams } from "./InformationWarBeams";
import { SystemMap } from "./information-war/SystemMap";
import { OperationalStatus, RecentActivity } from "./information-war/LivePanels";
import {
  ClaimFlow,
  DailyCycle,
  NarrativePanel,
  OutputsFork,
  SignalJourney,
} from "./information-war/StorySections";
import styles from "./information-war-system.module.css";

/*
 * `/information-war` — the living intelligence-pipeline experience.
 *
 * Structure: hero with public-record status → the interactive seven-stage
 * map → recent public activity → signal-to-intelligence journey → narrative
 * intelligence → claim verification → daily cycle → outputs.
 *
 * Telemetry rule: only the public record is shown (latest publication
 * timestamps, collection cadence). Per-stage job state is staff-only and is
 * labelled "No telemetry available" wherever it would otherwise appear —
 * never a fabricated RUNNING/ACTIVE badge.
 *
 * Every diagram is server markup. Client JavaScript only rides the beams;
 * the CSS rail/bus plus visible captions carry the meaning without it and
 * under reduced motion.
 */

const PRESSURE_STAGES = [
  ["Event", "Something happens in the physical world."],
  ["Fragment", "A partial image, quote, or claim becomes the first usable unit."],
  ["Amplification", "Repetition increases visibility and can imitate independent confirmation."],
  ["Perception", "The repeated frame becomes the lens through which later facts are interpreted."],
  ["Pressure", "Public belief influences institutions, policy, and freedom of action."],
] as const;

const READING_ORDER = [
  ["battlefield", "The battlefield"],
  ["pressure", "How pressure forms"],
  ["independence", "The independence test"],
  ["system", "The system"],
  ["activity", "Happening now"],
  ["journey", "Signal to intelligence"],
  ["narratives", "Narratives"],
  ["claims", "Claim analysis"],
  ["cycle", "Daily cycle"],
  ["output", "The output"],
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
            We continuously observe the information environment, identify important signals and narratives,
            verify claims, connect evidence, prioritize threats and turn them into actionable intelligence.
          </p>
          <Suspense>
            <OperationalStatus />
          </Suspense>
          <a className={styles.heroCta} href="#system">
            Explore the system <span aria-hidden="true">↓</span>
          </a>
        </div>
        <nav className={styles.heroIndex} aria-label="Reading order">
          {READING_ORDER.map(([id, name], index) => (
            <a key={id} href={`#${id}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {name}
            </a>
          ))}
        </nav>
      </section>

      <section className={styles.section} id="battlefield" aria-labelledby="battlefield-heading">
        <p className={styles.index}>01 / The battlefield</p>
        <div className={styles.sectionBody}>
          <h2 id="battlefield-heading">
            A claim can cross the world before the evidence reaches the room.
          </h2>
          <p>
            Information warfare is the contest to define meaning at speed. A true fragment can be
            stripped of context. An unresolved claim can be repeated as fact. Five headlines can look
            like five confirmations even when all five descend from one original report.
          </p>
          <p>
            The answer is not louder messaging. It is a faster, visible chain from source to claim,
            from claim to evidence, and from evidence to a public explanation.
          </p>
          <figure className={styles.speedDiagram}>
            <div className={styles.speedRow} data-tone="claim">
              <span>The claim, repeated</span>
              <i aria-hidden="true" />
            </div>
            <div className={styles.speedRow} data-tone="evidence">
              <span>The evidence behind it</span>
              <i aria-hidden="true" />
            </div>
            <figcaption>
              The same interval of time, measured from the same event. The gap between the two lines
              is where a narrative sets.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.section} id="pressure" aria-labelledby="pressure-heading">
        <p className={styles.index}>02 / How pressure forms</p>
        <div className={styles.sectionBody}>
          <h2 id="pressure-heading">One event. Five transformations.</h2>
          <ol className={styles.pressureSteps}>
            {PRESSURE_STAGES.map(([name, detail], index) => (
              <li key={name}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{name}</h3>
                  <p>{detail}</p>
                  <i className={styles.reach} aria-hidden="true" />
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.diagramNote}>Reach of the frame →. The facts have not changed.</p>
        </div>
      </section>

      <section className={styles.section} id="independence" aria-labelledby="independence-heading">
        <p className={styles.index}>03 / The independence test</p>
        <div className={styles.sectionBody}>
          <h2 id="independence-heading">Repetition is not corroboration.</h2>
          <p>
            The system groups syndicated copies under their upstream source family. Five copies of one
            wire report count as one origin, not five independent confirmations.
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
            Five copies → one origin. Syndication, not corroboration.
          </p>
        </div>
      </section>

      <section className={styles.system} id="system" aria-labelledby="system-heading">
        <div className={styles.systemIntro}>
          <p className={styles.index}>04 / The Lions of Zion system</p>
          <h2 id="system-heading">From open signal to public record.</h2>
          <p>
            Collection is automated and continuous. The evidence chain remains visible. Every public
            article can be corrected, removed, and traced back to its supporting material. Select any
            stage to inspect its inputs, outputs and guarantees.
          </p>
          <p className={styles.systemDisclosure}>
            <strong>
              This map describes how the system is built, with live state drawn only from the public
              record.
            </strong>{" "}
            Per-stage job telemetry is internal and we would rather draw nothing than draw a number we
            cannot show you: each stage below reports “No telemetry available” for its live state.
            What the system has actually produced is public — every entry is in the{" "}
            <Link href="/updates">updates feed</Link>, and every checked claim is on the{" "}
            <Link href="/fact-check">fact-check desk</Link>.
          </p>
        </div>
        <SystemMap />
      </section>

      <section className={styles.section} id="activity" aria-labelledby="activity-heading">
        <p className={styles.index}>05 / What is happening now</p>
        <div className={styles.sectionBody}>
          <h2 id="activity-heading">Recent pipeline activity — the public record.</h2>
          <p>
            The pipeline&rsquo;s internal job monitor is staff-only. What follows is what it has
            actually published: the newest public records, each reachable and traceable.
          </p>
          <Suspense>
            <RecentActivity />
          </Suspense>
        </div>
      </section>

      <section className={styles.section} id="journey" aria-labelledby="journey-heading">
        <p className={styles.index}>06 / From signal to intelligence</p>
        <div className={styles.sectionBody}>
          <h2 id="journey-heading">One signal, eight steps, under a minute to grasp.</h2>
          <p>
            Follow a single post from detection to the public record. Illustrative in shape;
            every published instance of it is linked from the activity and output sections.
          </p>
          <SignalJourney />
        </div>
      </section>

      <section className={styles.section} id="narratives" aria-labelledby="narratives-heading">
        <p className={styles.index}>07 / Narrative intelligence</p>
        <div className={styles.sectionBody}>
          <h2 id="narratives-heading">How narratives emerge.</h2>
          <NarrativePanel />
        </div>
      </section>

      <section className={styles.section} id="claims" aria-labelledby="claims-heading">
        <p className={styles.index}>08 / Claim and fake analysis</p>
        <div className={styles.sectionBody}>
          <h2 id="claims-heading">Suspicion is a process, not a verdict.</h2>
          <p>
            Complex verification is never reduced to a bare true/false. Uncertainty is written into
            the assessment — and only the summary reaches the public record.
          </p>
          <ClaimFlow />
        </div>
      </section>

      <section className={styles.section} id="cycle" aria-labelledby="cycle-heading">
        <p className={styles.index}>09 / The daily intelligence cycle</p>
        <div className={styles.sectionBody}>
          <h2 id="cycle-heading">Continuous intake, one daily edition.</h2>
          <DailyCycle />
        </div>
      </section>

      <section className={styles.section} id="output" aria-labelledby="output-heading">
        <p className={styles.index}>10 / The output</p>
        <div className={styles.sectionBody}>
          <h2 id="output-heading">Evidence must travel.</h2>
          <p>
            The system turns a daily field of public signals into three readable outputs: a strategic
            brief, a chronological record of everything published, and a desk of checked claims with
            the sources each one rests on.
          </p>
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
