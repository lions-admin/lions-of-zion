import type { HomepageEdition } from '@/server/contracts/homepage';
import { HomeMedia, HomeSources, JourneyLink, PREVIEW_BUDGET, PreviewText, SectionAction, SectionHeading, SectionState, rankOf } from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';
import { homepageBand } from '@/lib/homepage-bands';
import { measureContentId } from "@/components/measurement/attrs";

const BAND = homepageBand('people');

/**
 * One featured-slot pick (`heroes.items[0]` is always Courage & service,
 * `heroes.items[1]` is always Fallen — `server/modules/featured-slots`
 * guarantees the order, so this component only names the position, never
 * infers it from the record's own `role`). Each gets its own heading: the
 * two used to share one "Courage & service" label over both picks, which
 * read as one repeated card rather than two different kinds of record.
 */
function HeroBlock({ heading, item, fallen = false }: {
  heading: string; item: HomepageEdition['heroes']['items'][number]; fallen?: boolean;
}) {
  return <div className={fallen ? `${styles.heroBlock} ${styles.heroBlockFallen}` : styles.heroBlock} data-hero-block={fallen ? 'fallen' : 'courage'}>
    <h3 className={styles.heroBlockHeading}>{heading}</h3>
    <article className={styles.heroCard} data-measure-id={`home-heroes-${item.key}`} data-measure-section="people" data-measure-content={measureContentId(item.key)} data-measure-type="publication" data-measure-placement={`heroes:${fallen ? 'fallen' : 'courage'}`} data-measure-card>
      <HomeMedia media={item.media} portrait />
      <div className={styles.personIntro}>
        <p className={styles.kicker}>{item.role}</p>
        <h4>{item.title}</h4>
        <p className={styles.meta}>{item.meta}</p>
      </div>
      <p className={styles.summary}><PreviewText text={item.summary} budget={PREVIEW_BUDGET.companion} /></p>
      <HomeSources sources={item.sources} />
      {/* UX-05: a person profile — "Read their story". */}
      <JourneyLink href={item.href}>Read their story</JourneyLink>
    </article>
  </div>;
}

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
    {live.length ? <div className={styles.featureSpread}>{live.map((item, index) => <article key={item.key} data-rank={rankOf(index)} data-measure-id={`home-people-${item.key}`} data-measure-section="people" data-measure-content={measureContentId(item.key)} data-measure-type="publication" data-measure-placement={`people:${rankOf(index)}`} data-measure-card>
      {/* The frame is decided at the source (`homepage-adapters.ts`) from the record's section, not by comparing label strings here. */}
      <HomeMedia media={item.media} portrait={item.portrait} />
      <div><p className={styles.kicker}>{item.category}</p><h3>{item.title}</h3><p className={styles.summary}><PreviewText text={item.summary} budget={PREVIEW_BUDGET[rankOf(index)]} /></p><HomeSources sources={item.sources} />{/* UX-05: the verb is derived from the record's section (`cta`); a snapshot serialized before the field existed reads it as the story it is. */}<JourneyLink href={item.href}>{item.cta ?? "Read the story"}</JourneyLink></div>
    </article>)}</div> : null}
    {heroes.items.length ? <div className={styles.legacyPeople}>
      {heroes.items[0] ? <HeroBlock heading="Courage & service" item={heroes.items[0]} /> : null}
      {heroes.items[1] ? <HeroBlock heading="Fallen" item={heroes.items[1]} fallen /> : null}
      <SectionState section={heroes} />
    </div> : null}
    {history.items.length ? <div className={styles.contextShelf}><div><p className={styles.kicker}>History &amp; context</p><h3>Beyond the current headline</h3><p>Context remains part of the record. These chapters preserve their sources and their original addresses.</p></div><ol>{history.items.map(item => <li key={item.key}>
      <div><JourneyLink href={item.href}>{item.title}</JourneyLink>{item.contested ? <p className={styles.verdict} data-tone="warn"><span className={styles.verdictLabel}>Contested</span><span className={styles.verdictMeaning}>The chapter records disagreement; it does not settle it.</span></p> : null}</div>
      <span>{item.era}</span>
    </li>)}</ol></div> : null}
    {!live.length && !hasLegacy && people ? <SectionState section={people} /> : null}
    </div>
    {/* UX-05. One form for going to the whole section: "All of <Section>" with the journey arrow. */}
      <SectionAction href={BAND.hubHref}>All of {BAND.label}</SectionAction>
  </section>;
}
