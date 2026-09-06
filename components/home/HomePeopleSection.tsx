import type { HomepageEdition } from '@/server/contracts/homepage';
import { HomeMedia, HomeSources, JourneyLink, PREVIEW_BUDGET, PreviewText, SectionAction, SectionHeading, SectionState, rankOf } from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';

/** One public chapter for people, work and context. Legacy collections stay
 * addressable at their existing routes while the homepage gives them one home. */
export function HomePeopleSection({ people, heroes, history }: {
  people: HomepageEdition['people']; heroes: HomepageEdition['heroes']; history: HomepageEdition['israelsStory'];
}) {
  const live = people?.items ?? [];
  const hasLegacy = heroes.items.length > 0 || history.items.length > 0;
  return <section id="home-people" className={`${styles.section} ${styles.editorial} ${styles.peopleChapter}`} aria-labelledby="home-people-title" data-home-section="people">
    <SectionHeading id="home-people-title" kicker="People, work, context" title="The People of Israel" />
    <p className={styles.sectionIntro}>People and the work they do: courage, science, invention and the context that makes each record legible.</p>
    <div className={styles.peopleStack}>
    {live.length ? <div className={styles.featureSpread}>{live.map((item, index) => <article key={item.key} data-rank={rankOf(index)}>
      <HomeMedia media={item.media} portrait={item.category === 'People' || item.category === 'Courage & Service'} />
      <div><p className={styles.kicker}>{item.category}</p><h3>{item.title}</h3><p className={styles.summary}><PreviewText text={item.summary} budget={PREVIEW_BUDGET[rankOf(index)]} /></p><HomeSources sources={item.sources} /><JourneyLink href={item.href}>Read the record</JourneyLink></div>
    </article>)}</div> : null}
    {heroes.items.length ? <div className={styles.legacyPeople}><p className={styles.kicker}>Courage &amp; service</p><div className={styles.peopleSpread}>{heroes.items.map((item, index) => <article key={item.key} data-rank={rankOf(index)}>
      <HomeMedia media={item.media} portrait /><div className={styles.personIntro}><p className={styles.kicker}>{item.role}</p><h3>{item.title}</h3><p className={styles.meta}>{item.meta}</p></div><p className={styles.summary}><PreviewText text={item.summary} budget={PREVIEW_BUDGET[rankOf(index)]} /></p><HomeSources sources={item.sources} /><JourneyLink href={item.href}>Read the full story</JourneyLink>
    </article>)}</div></div> : null}
    {history.items.length ? <div className={styles.contextShelf}><div><p className={styles.kicker}>History &amp; context</p><h3>Beyond the current headline</h3><p>Context remains part of the record. These chapters preserve their sources and their original addresses.</p></div><ol>{history.items.map(item => <li key={item.key}>
      <div><JourneyLink href={item.href}>{item.title}</JourneyLink>{item.contested ? <p className={styles.verdict} data-tone="warn"><span className={styles.verdictLabel}>Contested</span><span className={styles.verdictMeaning}>The chapter records disagreement; it does not settle it.</span></p> : null}</div>
      <span>{item.era}</span>
    </li>)}</ol></div> : null}
    {!live.length && !hasLegacy && people ? <SectionState section={people} /> : null}
    </div>
    <SectionAction href="/people-of-israel">Explore The People of Israel</SectionAction>
  </section>;
}
