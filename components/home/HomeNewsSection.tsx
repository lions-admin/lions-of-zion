import type { HomepageEdition } from '@/server/contracts/homepage';
import { HomeMedia,HomeSources,HomeTime,JourneyLink,SectionHeading,SectionState } from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';
export function HomeNewsSection({section}:{section:HomepageEdition['news']}){
 return <section id="home-news" className={styles.section} aria-labelledby="home-news-title" data-home-section="news">
 <SectionHeading id="home-news-title" kicker="The present" title="News & Analysis" href="/geopolitical-brief" action="View all News & Analysis"/>
 <div className={styles.newsSpread} data-count={section.items.length}>{section.items.map(item=><article key={item.key} data-home-record={item.key}>
 <HomeMedia media={item.media}/><div className={styles.byline}><span>{item.category}</span><HomeTime date={item.date} includeTime/></div>
 <h3><a href={item.href}>{item.title}</a></h3><p className={styles.summary}>{item.summary}</p>
 {item.whyItMatters&&<div className={styles.context}><span>Why it matters</span><p>{item.whyItMatters}</p></div>}
 <HomeSources sources={item.sources}/><JourneyLink href={item.href}>{item.category==='Daily Brief'?'Read the daily brief':'Read the story'}</JourneyLink>
 </article>)}</div><SectionState section={section} cover="/images/homepage/covers/news.svg" href="/geopolitical-brief" action="View all News &amp; Analysis"/></section>;
}
