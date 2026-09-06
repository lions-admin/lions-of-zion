import { EditorialIntro } from './EditorialIntro';
import { JourneyLink } from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';
const steps=[['Source','Where the information originated.'],['Evidence','Preserved material and its provenance.'],['Information item','The claim or event being examined.'],['Assessment','What the available evidence supports.'],['Review','Checks depend on the publication path.'],['Publication','Reporting, analysis and their qualifications.'],['Public record','Indexed reporting can be searched; archive records can be browsed.']];
export function HomeSystemSection(){return <section className={`${styles.section} ${styles.system}`} aria-labelledby="home-system-title" data-home-section="system">
 <p className={styles.kicker}>Behind every record</p><div className={styles.systemHead}><h2 id="home-system-title">From a source.<br/>To something you can examine.</h2><p>This is the architecture behind the desk—not a live activity monitor. Sources, claims, assessments and published records remain distinct.</p></div>
 <ol className={styles.pipeline}>{steps.map(([name,description])=><li key={name}><strong>{name}</strong><span>{description}</span></li>)}</ol>
 <p className={styles.systemCaveat}>A conceptual reading path, not a universal approval chain. Automated briefings, external packages and human assessments follow different review paths. Archive testimony and documentation remain a separate preserved record.</p>
 <dl className={styles.systemBranches}><div><dt>Publication paths</dt><dd>Human assessment · automated briefing · external import. Review requirements differ; publication alone is not a verification verdict.</dd></div><div><dt>Preservation path</dt><dd>Testimony / documentation → archive record → reader-controlled access. Sensitive material is never a homepage preview.</dd></div></dl>
 <div className={styles.purpose}><p className={styles.kicker}>Why this work matters</p><h3>Repetition is not verification.</h3><p>Amplification can make a claim feel established before the evidence catches up. This is one possible mechanism—not a measurement of every narrative.</p></div>
 <ol className={styles.narrativePath} aria-label="An explanatory narrative pathway"><li>A claim begins</li><li>Others amplify it</li><li>Repetition can feel like consensus</li><li>Checking may take longer</li></ol>
 <p className={styles.deskResponse}>Our response: preserve the material, examine the claim, publish what the available record supports.</p>
 <div className={styles.systemActions}><JourneyLink href="/information-war#system">Explore how the system works</JourneyLink><JourneyLink href="/information-war#problem">Why this work matters</JourneyLink><EditorialIntro compact autoOpen={false}/></div>
 </section>;}
