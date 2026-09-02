import Image from "next/image";
import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { SourceConvergenceBeams, SystemFlowBeams } from "./InformationWarBeams";
import styles from "./information-war-system.module.css";

/*
 * Headings and kickers are sentence case in the source. The V3 system allows
 * uppercase only on data labels of two words or fewer — the stage `meta`
 * strings and the diagram's labels qualify and are transformed by the
 * stylesheet; the stage names, the hero and the footer line are headings and
 * are not. The words are unchanged.
 */
const SYSTEM_STAGES = [
  {
    number: "01",
    name: "Discover",
    detail: "Public reporting enters through monitored search queries and verified feeds.",
    meta: "Google Search / RSS",
  },
  {
    number: "02",
    name: "Preserve",
    detail: "Each result keeps its publisher, URL, retrieval time, and original source family.",
    meta: "Source ledger",
  },
  {
    number: "03",
    name: "Triage",
    detail: "Relevant stories, atomic claims, duplicates, urgency, and possible narratives are separated.",
    meta: "Structured analysis",
  },
  {
    number: "04",
    name: "Verify",
    detail: "Supporting and contradicting evidence stay attached to consequential claims.",
    meta: "Evidence graph",
  },
  {
    number: "05",
    name: "Publish",
    detail: "The system produces traceable English briefs, updates, and narrative analysis.",
    meta: "Public record",
  },
] as const;

const PRESSURE_STAGES = [
  ["Event", "Something happens in the physical world."],
  ["Fragment", "A partial image, quote, or claim becomes the first usable unit."],
  ["Amplification", "Repetition increases visibility and can imitate independent confirmation."],
  ["Perception", "The repeated frame becomes the lens through which later facts are interpreted."],
  ["Pressure", "Public belief influences institutions, policy, and freedom of action."],
] as const;

export function InformationWarSystem() {
  return (
    <EditorialShell
      routeId="information-war"
      register="muted"
      className={styles.page}
      skipLinkClassName={styles.skipLink}
      progressTrackClassName={styles.progressTrack}
      progressValueClassName={styles.progressValue}
    >
      <section className={styles.hero} id="page-content" aria-labelledby="war-heading">
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            src="/posters/particle-nav.webp"
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <div className={styles.sweep} />
          <div className={styles.coordinates}>31.7683° N / 35.2137° E</div>
        </div>
        <div className={styles.heroCopy}>
          <p>The battlefield is perception.</p>
          <h1 id="war-heading">
            <span>This is an</span>
            <span>information</span>
            <span>war.</span>
          </h1>
          <p className={styles.heroStatement}>
            Events shape reality. Narratives shape what the world believes those events mean.
          </p>
          <a href="#system">Explore the system <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section className={styles.definition} aria-labelledby="definition-heading">
        <div className={styles.sectionIndex}>01 / The battlefield</div>
        <div>
          <h2 id="definition-heading">A claim can cross the world before the evidence reaches the room.</h2>
          <p>
            Information warfare is the contest to define meaning at speed. A true fragment can be stripped
            of context. An unresolved claim can be repeated as fact. Five headlines can look like five
            confirmations even when all five descend from one original report.
          </p>
          <p>
            The answer is not louder messaging. It is a faster, visible chain from source to claim,
            from claim to evidence, and from evidence to a public explanation.
          </p>
        </div>
      </section>

      <section className={styles.pressure} aria-labelledby="pressure-heading">
        <div className={styles.sectionIntro}>
          <div className={styles.sectionIndex}>02 / How pressure forms</div>
          <h2 id="pressure-heading">One event. Five transformations.</h2>
        </div>
        <ol className={styles.pressureFlow}>
          {PRESSURE_STAGES.map(([name, detail], index) => (
            <li key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i aria-hidden="true" />
              <h3>{name}</h3>
              <p>{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.independence} aria-labelledby="independence-heading">
        <div className={styles.sectionIntro}>
          <div className={styles.sectionIndex}>03 / The independence test</div>
          <h2 id="independence-heading">Repetition is not corroboration.</h2>
          <p>
            The system groups syndicated copies under their upstream source family. Five copies of one
            wire report count as one origin, not five independent confirmations.
          </p>
        </div>
        {/* The container, the `role="img"` and its label belong to
            `SourceConvergenceBeams`, which needs to be the measured host.
            Everything inside it is still rendered here on the server; the
            marks carry `data-beam-*` so the wires attach to points on the
            boxes' edges rather than to the boxes' centres. */}
        <SourceConvergenceBeams label="Five headlines converging into one upstream source family">
          <div className={styles.copies}>
            {["Outlet A", "Outlet B", "Outlet C", "Outlet D", "Outlet E"].map((outlet) => (
              <span key={outlet}>{outlet}<i data-beam-copy={outlet} /></span>
            ))}
          </div>
          <div className={styles.convergence}>
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
            <span>Upstream origin</span>
          </div>
        </SourceConvergenceBeams>
      </section>

      <section className={styles.system} id="system" aria-labelledby="system-heading">
        <div className={styles.systemSticky}>
          <div className={styles.sectionIndex}>04 / The Lions of Zion system</div>
          <h2 id="system-heading">From open signal to public record.</h2>
          <p>
            Collection is automated. The evidence chain remains visible. Every public article can be
            corrected, removed, and traced back to its supporting material.
          </p>
        </div>
        {/* `SystemFlowBeams` is a positioned wrapper and nothing else — the
            list, its order and its text are unchanged and still server
            markup. The stage marks are the beam anchors. */}
        <SystemFlowBeams>
          <ol className={styles.systemFlow}>
            {SYSTEM_STAGES.map((stage) => (
              <li key={stage.name}>
                <div className={styles.node}>
                  <span>{stage.number}</span>
                  <i aria-hidden="true" data-beam-node={stage.number} />
                </div>
                <div>
                  <small>{stage.meta}</small>
                  <h3>{stage.name}</h3>
                  <p>{stage.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </SystemFlowBeams>
      </section>

      <section className={styles.output} aria-labelledby="output-heading">
        <div className={styles.sectionIndex}>05 / The output</div>
        <h2 id="output-heading">Evidence must travel.</h2>
        <p>
          The system turns a daily field of public signals into three readable outputs: a strategic brief,
          focused news and war updates, and a dedicated record of narratives moving across the global information space.
        </p>
        <div className={styles.outputLines}>
          <span>Daily Brief</span>
          <span>Israel + war updates</span>
          <span>Narrative Watch</span>
        </div>
        <Link href="/geopolitical-brief">Enter The Israel Brief <span aria-hidden="true">→</span></Link>
      </section>

      <footer className={styles.footer}>
        <span>Lions of Zion / Truth has a signal</span>
        <Link href="/methodology">Methodology</Link>
      </footer>
    </EditorialShell>
  );
}
