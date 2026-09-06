import type { HomepageEdition } from '@/server/contracts/homepage';
import { HomeMedia,HomeSources,JourneyLink,SectionHeading,SectionState } from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';
export function HomeHistorySection({section}:{section:HomepageEdition['israelsStory']}){
 return <section className={`${styles.section} ${styles.history}`} aria-labelledby="home-history-title" data-home-section="israelsStory">
 <SectionHeading id="home-history-title" kicker="Beyond the current headline" title="Israel’s Story" href="/israels-story" action="Explore Israel’s Story"/>
 <div className={styles.historySpread}>{section.items.map(item=><article key={item.key} data-home-record={item.key}>
 <p className={styles.era}>{item.era}</p><HomeMedia media={item.media}/><div><h3>{item.title}</h3>{item.contested&&<p className={styles.verdict}>Contested<span>The chapter records disagreement; it does not settle it.</span></p>}
 <p className={styles.summary}>{item.summary}</p>{item.whyItMatters&&<div className={styles.context}><span>Why it matters</span><p>{item.whyItMatters}</p></div>}
 <HomeSources sources={item.sources}/><JourneyLink href={item.href}>Read the chapter</JourneyLink></div>
 </article>)}</div><SectionState section={section}/></section>;
}
