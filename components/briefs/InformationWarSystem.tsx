import Image from "next/image";
import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import styles from "./information-war-system.module.css";

const SYSTEM_STAGES = [
  {
    number: "01",
    name: "DISCOVER",
    detail: "Public reporting enters through monitored search queries and verified feeds.",
    meta: "GOOGLE SEARCH / RSS",
  },
  {
    number: "02",
    name: "PRESERVE",
    detail: "Each result keeps its publisher, URL, retrieval time, and original source family.",
    meta: "SOURCE LEDGER",
  },
  {
    number: "03",
    name: "TRIAGE",
    detail: "Relevant stories, atomic claims, duplicates, urgency, and possible narratives are separated.",
    meta: "STRUCTURED ANALYSIS",
  },
  {
    number: "04",
    name: "VERIFY",
    detail: "Supporting and contradicting evidence stay attached to consequential claims.",
    meta: "EVIDENCE GRAPH",
  },
  {
    number: "05",
    name: "PUBLISH",
    detail: "The system produces traceable English briefs, updates, and narrative analysis.",
    meta: "PUBLIC RECORD",
  },
] as const;

const PRESSURE_STAGES = [
  ["EVENT", "Something happens in the physical world."],
  ["FRAGMENT", "A partial image, quote, or claim becomes the first usable unit."],
  ["AMPLIFICATION", "Repetition increases visibility and can imitate independent confirmation."],
  ["PERCEPTION", "The repeated frame becomes the lens through which later facts are interpreted."],
  ["PRESSURE", "Public belief influences institutions, policy, and freedom of action."],
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
          <p>THE BATTLEFIELD IS PERCEPTION.</p>
          <h1 id="war-heading">
            <span>THIS IS AN</span>
            <span>INFORMATION</span>
            <span>WAR.</span>
          </h1>
          <p className={styles.heroStatement}>
            Events shape reality. Narratives shape what the world believes those events mean.
          </p>
          <a href="#system">Explore the system <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section className={styles.definition} aria-labelledby="definition-heading">
        <div className={styles.sectionIndex}>01 / THE BATTLEFIELD</div>
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
          <div className={styles.sectionIndex}>02 / HOW PRESSURE FORMS</div>
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
          <div className={styles.sectionIndex}>03 / THE INDEPENDENCE TEST</div>
          <h2 id="independence-heading">Repetition is not corroboration.</h2>
          <p>
            The system groups syndicated copies under their upstream source family. Five copies of one
            wire report count as one origin, not five independent confirmations.
          </p>
        </div>
        <div className={styles.sourceDiagram} role="img" aria-label="Five headlines converging into one upstream source family">
          <div className={styles.copies}>
            {["OUTLET A", "OUTLET B", "OUTLET C", "OUTLET D", "OUTLET E"].map((outlet) => (
              <span key={outlet}>{outlet}<i /></span>
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
            <small>COUNTED AS</small>
            <strong>ONE</strong>
            <span>UPSTREAM ORIGIN</span>
          </div>
        </div>
      </section>

      <section className={styles.system} id="system" aria-labelledby="system-heading">
        <div className={styles.systemSticky}>
          <div className={styles.sectionIndex}>04 / THE LIONS OF ZION SYSTEM</div>
          <h2 id="system-heading">From open signal to public record.</h2>
          <p>
            Collection is automated. The evidence chain remains visible. Every public article can be
            corrected, removed, and traced back to its supporting material.
          </p>
        </div>
        <ol className={styles.systemFlow}>
          {SYSTEM_STAGES.map((stage) => (
            <li key={stage.name}>
              <div className={styles.node}>
                <span>{stage.number}</span>
                <i aria-hidden="true" />
              </div>
              <div>
                <small>{stage.meta}</small>
                <h3>{stage.name}</h3>
                <p>{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.output} aria-labelledby="output-heading">
        <div className={styles.sectionIndex}>05 / THE OUTPUT</div>
        <h2 id="output-heading">Evidence must travel.</h2>
        <p>
          The system turns a daily field of public signals into three readable outputs: a strategic brief,
          focused news and war updates, and a dedicated record of narratives moving across the global information space.
        </p>
        <div className={styles.outputLines}>
          <span>DAILY BRIEF</span>
          <span>ISRAEL + WAR UPDATES</span>
          <span>NARRATIVE WATCH</span>
        </div>
        <Link href="/geopolitical-brief">Enter The Israel Brief <span aria-hidden="true">→</span></Link>
      </section>

      <footer className={styles.footer}>
        <span>LIONS OF ZION / TRUTH HAS A SIGNAL</span>
        <Link href="/methodology">Methodology</Link>
      </footer>
    </EditorialShell>
  );
}
