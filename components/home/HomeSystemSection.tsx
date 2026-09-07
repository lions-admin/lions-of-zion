import dynamic from "next/dynamic";
import { AmplificationFigure } from "./AmplificationFigure";
import { JourneyLink } from "./HomeJourneyPrimitives";
import styles from "./homepage-journey.module.css";

const EditorialIntro = dynamic(
  () => import("./EditorialIntro").then((mod) => mod.EditorialIntro),
  { ssr: true }
);

/**
 * One proof of method, and the two doors out of it (VA-21).
 *
 * This band used to be a second product: a five-stage investigation
 * walkthrough, two branch explanations, an amplification lesson and a
 * rotating figure. Measured at 375px on 2026-09-07 it was 3,517px — 29% of
 * the whole homepage — so a reader met a complete course in method after
 * having met four chapters of reporting.
 *
 * What is here now is the smallest thing that still makes the argument: the
 * source-counting test, one interaction that performs it
 * (`AmplificationFigure`'s trace toggle), the provenance distinction, and
 * two links — How it works and Methodology.
 *
 * Nothing was deleted. The five-stage walkthrough moved to
 * `/information-war`, where the architecture is the page's job. The branch
 * explanations were **not** moved, because that page already carries them:
 * `OutputsFork` names News & Analysis "with the sources and context behind
 * the reporting" and the October 7 archive as "separate from the daily news
 * cycle" — the same two sentences. Copying them across would have replaced
 * one duplication with another.
 */
export function HomeSystemSection() {
  return (
    <section id="home-system" className={`${styles.section} ${styles.system}`}
      aria-labelledby="home-system-title" data-home-section="system">
      <header className={styles.systemHead}>
        <div>
          <p className={styles.kicker}>Behind the desk</p>
          <h2 id="home-system-title">More copies.<br />Not more evidence.</h2>
        </div>
        <p>A claim travels through posts, headlines and reposts. If every version
          points back to one origin, repetition has added no independent
          confirmation. Trace one chain below—it is the test behind every record here.</p>
      </header>
      <AmplificationFigure />
      <p className={styles.systemNote}>Human assessments, machine-authored editorial runs and historical records follow different provenance and review paths.</p>
      <div className={styles.systemActions}>
        <JourneyLink href="/information-war">How it works</JourneyLink>
        <JourneyLink href="/methodology">Methodology</JourneyLink>
        <EditorialIntro compact autoOpen={false} />
      </div>
    </section>
  );
}
