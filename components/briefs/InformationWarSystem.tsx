import Image from "next/image";
import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { SourceConvergenceBeams, SystemFlowBeams } from "./InformationWarBeams";
import styles from "./information-war-system.module.css";

/*
 * The seven stages, each carrying the rule that actually enforces it.
 *
 * Headings and kickers are sentence case in the source. The V3 system allows
 * uppercase only on data labels of two words or fewer — the stage `meta`
 * strings and the diagram's labels qualify and are transformed by the
 * stylesheet; the stage names, the hero and the footer line are headings and
 * are not.
 *
 * `detail` says what the stage is for. `mechanism` says what stops it being
 * skipped, and every one of those sentences was checked against the code
 * before it was written here — the migration, the constraint or the schema
 * refinement is named in the comment beside it. A page arguing that evidence
 * must be traceable does not get to make untraceable claims about itself.
 *
 * This replaced a five-stage version (Discover / Preserve / Triage / Verify /
 * Publish). The two stages it gained are not decoration: analysis and
 * verification were folded into "Verify", which flattened the single most
 * important distinction in the system — writing an assessment and having a
 * second person approve it are different acts with different guarantees.
 */
const SYSTEM_STAGES = [
  {
    number: "01",
    name: "Source",
    detail: "Public reporting enters through monitored search queries and verified feeds.",
    meta: "Source ledger",
    /* `source_family` — the grouping the independence test above runs on. */
    mechanism:
      "Every source belongs to a named family. That is what lets five syndicated copies of one wire report be counted as one origin instead of five.",
  },
  {
    number: "02",
    name: "Ingestion",
    detail: "Each result keeps its publisher, URL, retrieval time, and original source family.",
    meta: "Provenance record",
    /* `evidence_provenance_is_append_only` — migration 0005. */
    mechanism:
      "Provenance is append-only in the database. A record of where something came from and when it was fetched cannot be edited afterwards, only added to.",
  },
  {
    number: "03",
    name: "Detection",
    detail: "Relevant stories, atomic claims, duplicates, and candidate narratives are separated.",
    /* Two words is the V3 ceiling for an uppercase data label, and
       `.systemFlow small` transforms these — so "Clustering and triage"
       would have shipped as a three-word shout. */
    meta: "Clustering",
    mechanism:
      "Reports of the same event are clustered before anything is written about them, so volume never reaches an editor disguised as corroboration.",
  },
  {
    number: "04",
    name: "Analysis",
    detail:
      "A claim is assessed against the material on record, and the assessment states what it could not establish.",
    meta: "Assessment record",
    /* `item_assessment_states_its_gaps` (0006) and the immutability trigger
       in 0007 — an assessment cannot be rewritten after the fact. */
    mechanism:
      "An assessment scores ten separate confidence dimensions, and a database constraint refuses one that leaves its known gaps blank. Once written it is immutable: a changed finding is a new assessment, not an edited one.",
  },
  {
    number: "05",
    name: "Evidence",
    detail: "Supporting and contradicting material stays attached to the statements it bears on.",
    meta: "Evidence chain",
    /* `createPublicationSchema`'s passage refinement, server/contracts. */
    mechanism:
      "A publication is refused unless every passage cites the evidence under it. The single exception is a Narrative Watch record published as our own analysis, which must cite nothing anywhere — never partly.",
  },
  {
    number: "06",
    name: "Verification",
    detail: "Nothing publishes on the say-so of whoever wrote it.",
    meta: "Publish gate",
    /* `enforce_publication_publish_gate`, migration 0031. Both branches are
       stated because the two publication routes have different guarantees,
       and `/updates` marks which route each entry took. */
    mechanism:
      "A database trigger holds the gate, so no code path reaches publication around it. An editor's publication must be approved by a human who is not the author. An automatic one must carry its run provenance and have passed all twelve named quality checks — and may not also claim human approval.",
  },
  {
    number: "07",
    name: "Publication",
    detail: "The record goes public, and stays correctable.",
    meta: "Public record",
    /* `entity_version_is_append_only` and `audit_log_is_append_only`, 0001. */
    mechanism:
      "Every published record is versioned and every version is kept. A correction is a new version with a stated reason, and the history travels with the record rather than replacing it.",
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
          {/* The one thing this diagram must say about itself. Seven stages
              drawn with a moving signal on them look exactly like a monitor,
              and no public telemetry endpoint exists — the per-stage run and
              queue figures behind `/api/v1/admin/briefing` are staff-only. A
              diagram implying live numbers it does not have would be the same
              move this page spends five sections documenting, so the page
              says plainly what it is and points at the two surfaces that do
              carry live output. */}
          <p className={styles.systemDisclosure}>
            <strong>This diagram describes how the system is built, not what it is
            doing right now.</strong>{" "}
            It carries no live counters and no status figures, because the
            per-stage telemetry is internal and we would rather draw nothing
            than draw a number we cannot show you. What the system has actually
            produced is public: every entry is in the{" "}
            <Link href="/updates">updates feed</Link>, and every checked claim is
            on the <Link href="/fact-check">fact-check desk</Link>.
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
                  {/* The rule under the stage. Set apart because it is a
                      different kind of sentence — checkable rather than
                      descriptive — and a reader should be able to tell which
                      claims on this page they could go and verify. */}
                  <p className={styles.mechanism}>{stage.mechanism}</p>
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
          a chronological record of everything published, and a desk of checked claims with the sources
          each one rests on.
        </p>
        {/* These three were inert `<span>`s naming outputs a reader then had
            to go and find. They are the outputs, so they are the way to them. */}
        <nav className={styles.outputLines} aria-label="Where the system publishes">
          <Link href="/geopolitical-brief">
            The Daily Brief
            <small>Today&rsquo;s edition, with the lead and the featured story</small>
          </Link>
          <Link href="/updates">
            Updates
            <small>Every entry, newest first, with the minute and route it published by</small>
          </Link>
          <Link href="/fact-check">
            Fact check
            <small>Claims in circulation, the verdict, and the evidence chain</small>
          </Link>
        </nav>
      </section>

      <footer className={styles.footer}>
        <span>Lions of Zion / Truth has a signal</span>
        <Link href="/methodology">Methodology</Link>
      </footer>
    </EditorialShell>
  );
}
