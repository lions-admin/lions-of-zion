import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { SourceConvergenceBeams, SystemFlowBeams } from "./InformationWarBeams";
import styles from "./information-war-system.module.css";

/*
 * `/information-war` — the argument, then the machine (IW-001 rebuild).
 *
 * The factual transformation sequence is the only thing preserved from the
 * previous build: the five pressure stages, the seven system stages with
 * their checked `mechanism` sentences, the independence claim, and the
 * disclosure that this page carries no live telemetry. Everything rendered
 * around that — the photographic hero, the horizontal pressure strip, the
 * left-right convergence fan, the node-rail stage list, the closing
 * full-viewport display moment — is replaced.
 *
 * The rebuilt page is one column of five numbered sections, each with a
 * single reading path (kicker → heading → prose → list) and exactly one
 * explanatory diagram:
 *
 *   01 The battlefield        · speed asymmetry, two labelled rules
 *   02 How pressure forms     · escalation chain with a reach bar per stage
 *   03 The independence test  · five copies converging on one origin
 *   04 The system             · the seven-stage chain on one rail
 *   05 The output             · the record forking into its three surfaces
 *
 * Every diagram is server markup. The only client boundary is the two beam
 * hosts in `InformationWarBeams.tsx`, and neither diagram needs them to be
 * understood — CSS draws a fallback connector that stands down when the
 * measured wires mount.
 *
 * The hero is typographic (IW-002): the heading is one sentence whose
 * accessible text is exactly "This is an information war." — the line
 * breaks come from block spans that keep their word spaces, so what a
 * screen reader hears and what the page shows are the same sentence.
 */

/*
 * The seven stages, each carrying the rule that actually enforces it.
 *
 * Headings and kickers are sentence case in the source. The V3 system allows
 * uppercase only on data labels of two words or fewer — the stage `meta`
 * strings qualify and are transformed by the stylesheet; the stage names,
 * the hero and the footer line are headings and are not.
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
    /* Two words is the V3 ceiling for an uppercase data label, and the
       stage meta style transforms these — so "Clustering and triage"
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

/* The reading order, stated once and used twice: the hero's index and the
   sections' own ids. */
const READING_ORDER = [
  ["battlefield", "The battlefield"],
  ["pressure", "How pressure forms"],
  ["independence", "The independence test"],
  ["system", "The system"],
  ["output", "The output"],
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
      {/* ── The threshold ─────────────────────────────────────────────
          Typographic, on the bare ground. The previous build set a
          grayscale photograph with scrims and a coordinates readout
          behind this heading; the readout implied instrumentation the
          page does not have, and the photograph fought the sentence.
          The sentence is the hero. */}
      <section className={styles.hero} id="page-content" aria-labelledby="war-heading">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The battlefield is perception.</p>
          {/* Three block spans set the intended line breaks; the word
              spaces live inside the spans, so the element's text — the
              accessible name — is exactly the sentence (IW-002). */}
          <h1 id="war-heading">
            <span>{"This is an "}</span>
            <span>{"information "}</span>
            <span>{"war."}</span>
          </h1>
          <p className={styles.heroStatement}>
            Events shape reality. Narratives shape what the world believes those events mean.
          </p>
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

      {/* ── 01 · The battlefield ──────────────────────────────────────
          Reading path: the definition. Diagram: the speed asymmetry the
          definition rests on — two rules covering the same interval,
          drawn to different lengths. Qualitative by design: the page
          carries no figures it cannot show. */}
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

      {/* ── 02 · How pressure forms ───────────────────────────────────
          Reading path: the five transformations, in order. Diagram: the
          reach bar under each stage — the frame's audience widens while
          the underlying facts do not change. The bar turns ember from
          Amplification on, where repetition starts imitating
          confirmation: the adversarial move, in the adversarial color. */}
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

      {/* ── 03 · The independence test ────────────────────────────────
          Reading path: the claim in prose. Diagram: five copies over one
          origin. The visible connector has two forms — a CSS bus for the
          no-JavaScript tier, measured wires once the beams mount — and
          the caption below states the relation in text, which is what
          remains authoritative under reduced motion. */}
      <section className={styles.section} id="independence" aria-labelledby="independence-heading">
        <p className={styles.index}>03 / The independence test</p>
        <div className={styles.sectionBody}>
          <h2 id="independence-heading">Repetition is not corroboration.</h2>
          <p>
            The system groups syndicated copies under their upstream source family. Five copies of one
            wire report count as one origin, not five independent confirmations.
          </p>
          {/* The container, the `role="img"` and its label belong to
              `SourceConvergenceBeams`, which needs to be the measured host.
              Everything inside it is still rendered here on the server; the
              marks carry `data-beam-*` so the wires attach to points on the
              boxes' edges rather than to the boxes' centres. */}
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

      {/* ── 04 · The system ───────────────────────────────────────────
          Reading path: the seven stages, each a step card carrying its
          description and the rule that enforces it. Diagram: the rail
          the cards hang on — one wire from Source to Publication, with
          the beams' packets riding it where motion is allowed. The intro
          column is sticky only where the viewport is wide AND tall
          enough to afford it (IW-003); everywhere else it reads inline
          ahead of the chain. */}
      <section className={styles.system} id="system" aria-labelledby="system-heading">
        <div className={styles.systemIntro}>
          <p className={styles.index}>04 / The Lions of Zion system</p>
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
            <strong>
              This diagram describes how the system is built, not what it is doing right now.
            </strong>{" "}
            It carries no live counters and no status figures, because the per-stage telemetry is
            internal and we would rather draw nothing than draw a number we cannot show you. What the
            system has actually produced is public: every entry is in the{" "}
            <Link href="/updates">updates feed</Link>, and every checked claim is on the{" "}
            <Link href="/fact-check">fact-check desk</Link>.
          </p>
        </div>
        {/* `SystemFlowBeams` is a positioned wrapper and nothing else — the
            list, its order and its text are unchanged and still server
            markup. The stage marks are the beam anchors. */}
        <SystemFlowBeams>
          <ol className={styles.stageChain}>
            {SYSTEM_STAGES.map((stage) => (
              <li key={stage.name}>
                <div className={styles.stageRail}>
                  <i aria-hidden="true" data-beam-node={stage.number} />
                </div>
                <div className={styles.stageBody}>
                  <p className={styles.stageMeta}>
                    <span>{stage.number}</span>
                    <span>{stage.meta}</span>
                  </p>
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

      {/* ── 05 · The output ───────────────────────────────────────────
          Reading path: what the system publishes. Diagram: the record
          forking into its three public surfaces — a rail with three
          stubs, each stub landing on the link that is the surface. */}
      <section className={styles.section} id="output" aria-labelledby="output-heading">
        <p className={styles.index}>05 / The output</p>
        <div className={styles.sectionBody}>
          <h2 id="output-heading">Evidence must travel.</h2>
          <p>
            The system turns a daily field of public signals into three readable outputs: a strategic
            brief, a chronological record of everything published, and a desk of checked claims with
            the sources each one rests on.
          </p>
          <nav className={styles.outputMap} aria-label="Where the system publishes">
            <p className={styles.outputRoot}>
              <i aria-hidden="true" />
              The public record
            </p>
            <Link href="/geopolitical-brief">
              <strong>The Daily Brief</strong>
              <small>Today&rsquo;s edition, with the lead and the featured story</small>
            </Link>
            <Link href="/updates">
              <strong>Updates</strong>
              <small>Every entry, newest first, with the minute and route it published by</small>
            </Link>
            <Link href="/fact-check">
              <strong>Fact check</strong>
              <small>Claims in circulation, the verdict, and the evidence chain</small>
            </Link>
          </nav>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Lions of Zion / Truth has a signal</span>
        <Link href="/methodology">Methodology</Link>
      </footer>
    </EditorialShell>
  );
}
