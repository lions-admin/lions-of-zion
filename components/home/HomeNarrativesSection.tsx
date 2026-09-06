import type { HomepageEdition } from '@/server/contracts/homepage';
import { VERIFICATION_STATES } from '@/components/live/publication-labels';
import { HomeMedia,HomeTime,HomeSources,JourneyLink,SectionHeading,SectionState } from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';
export function HomeNarrativesSection({section}:{section:HomepageEdition['fakeResistance']}){
 return <section className={`${styles.section} ${styles.investigations}`} aria-labelledby="home-narratives-title" data-home-section="fakeResistance">
 <SectionHeading id="home-narratives-title" kicker="The claim and the record" title="Narratives & fact checks" href="/fake-resistance" action="Explore the investigations"/>
 <p className={styles.sectionIntro}>What circulates is not always what the evidence establishes. Read the status before the claim.</p>
 <div className={styles.narrativeSpread}>{section.items.map(item=>{
 const status=item.kind==='watch'?VERIFICATION_STATES[item.verification as keyof typeof VERIFICATION_STATES]:null;
 return <article key={item.key} className={styles.investigation} data-home-record={item.key}>
 <div><HomeMedia media={item.media}/><HomeTime date={item.date} includeTime/></div>
 <div><p className={styles.verdict} data-tone={status?.tone??'neutral'}>{status?.label??'Research case'}<span>{status?.meaning??'Findings carry their own confidence and limitations.'}</span></p>
 <p className={styles.kicker}>{item.kind==='watch'?'Claim in circulation':'Research question'}</p>
 <h3><a href={item.href}>{item.kind==='watch'?item.claim:item.title}</a></h3>
 {item.kind==='case'&&<p className={styles.summary}>{item.question}</p>}
 <div className={styles.finding}><span>{item.kind==='watch'?'Finding':'From the research'}</span><p>{item.finding??(item.kind==='watch'&&item.verification==='unresolved'?'No finding has been reached. Monitoring is not confirmation.':'Read the record for the assessment and its limitations; no specific finding excerpt is selected here.')}</p></div>
 <p className={styles.sources}>{item.kind==='case'?`${item.sourceCount} sources in the case; source count is not a verdict.`:item.basis==='analysis'?'Lions of Zion editorial analysis · No source-backed finding is implied.':item.sources.length?'Source-backed monitoring record.':'No source link is available in this preview.'}</p>
 {!(item.kind==='watch'&&item.basis==='analysis')&&<HomeSources sources={item.sources}/>}
 <JourneyLink href={item.href}>{item.kind==='case'?'Read the investigation':item.basis==='analysis'?'Read the analysis':'Read the assessment'}</JourneyLink></div>
 </article>;})}</div><SectionState section={section}/></section>;
}
