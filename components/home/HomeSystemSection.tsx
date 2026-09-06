import { EditorialIntro } from "./EditorialIntro";
import { AmplificationFigure } from "./AmplificationFigure";
import { HomeEvidencePipeline } from "./HomeEvidencePipeline";
import { JourneyLink } from "./HomeJourneyPrimitives";
import { Icon } from "@/components/ui/Icon";
import styles from "./homepage-journey.module.css";

export function HomeSystemSection() {
  return (
    <section id="home-system" className={`${styles.section} ${styles.system}`}
      aria-labelledby="home-system-title" data-home-section="system">
      <header className={styles.systemHead}>
        <div>
          <p className={styles.kicker}>Inside an investigation</p>
          <h2 id="home-system-title">Put the narrative to the test.</h2>
        </div>
        <p>Follow a circulating claim from influencer networks to a published finding.
          Search both sides of the evidence. Examine the framing. See what holds up.</p>
      </header>
      <HomeEvidencePipeline />
      <div className={styles.systemBranches}>
        <article>
          <div className={styles.branchHeading}>
            <h3>Reporting you can trace.</h3>
          </div>
          <p>Briefings and investigations connect reporting to its sources.
            Read the evidence, the assessment and the limits—not just the headline.</p>
          <p className={styles.branchNote}>Human assessments, automated briefings and imported editions follow different review paths.</p>
          <JourneyLink href="/geopolitical-brief">Read the reporting</JourneyLink>
        </article>
        <article>
          <div className={styles.branchHeading}>
            <h3>Testimony kept intact.</h3>
          </div>
          <p>The October 7 archive keeps testimony and documentation in their own
            records, alongside—not inside—the daily news cycle.</p>
          <div className={styles.archiveChain} aria-label="Archive access">
            <span><Icon name="document" size={20} />Original material</span>
            <span><Icon name="archive" size={20} />Archive record</span>
            <span><Icon name="account" size={20} />You choose to view</span>
          </div>
          <p className={styles.branchNote}>Sensitive material stays behind a content warning. You decide when to open it.</p>
          <JourneyLink href="/october-7">Explore the archive</JourneyLink>
        </article>
      </div>
      <div className={styles.purpose}>
        <p className={styles.kicker}>Why the source matters</p>
        <h3>More copies.<br />Not more evidence.</h3>
        <p>A claim can travel through posts, headlines and reposts.
          If they all point back to the same source, repetition has not added
          independent confirmation.</p>
      </div>
      <AmplificationFigure />
      <div className={styles.systemActions}>
        <JourneyLink href="/information-war#system">Explore the full system</JourneyLink>
        <JourneyLink href="/information-war#problem">Understand amplification</JourneyLink>
        <EditorialIntro compact autoOpen={false} />
      </div>
    </section>
  );
}
