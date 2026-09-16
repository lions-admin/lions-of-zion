import Link from 'next/link';
import type { HomepageEdition } from '@/server/contracts/homepage';
import { RecordShare } from '@/components/motion/view-transition';
import { RECORD_TRANSITION_TYPE, recordViewNamesFromHref } from '@/lib/record-view-names';
import {
  HomeMedia,
  HomeSources,
  JourneyLink,
  PREVIEW_BUDGET,
  PreviewText,
  SectionAction,
  SectionHeading,
  SectionState,
} from './HomeJourneyPrimitives';
import styles from './homepage-journey.module.css';
import { homepageBand } from '@/lib/homepage-bands';
import { measureContentId } from '@/components/measurement/attrs';

const BAND = homepageBand('people');

/**
 * One row of the roster: a record this chapter names, dated or placed, and
 * opens somewhere else.
 *
 * The measurement keys travel with the row rather than being rebuilt from its
 * shape, so a record that used to be a full card and is now a line still
 * counts under the same id, section and placement — the content screen must
 * not see this change as six records disappearing and five new ones arriving.
 */
type RosterRow = {
  key: string;
  href: string;
  title: string;
  /** The row's one piece of context: a section label, a position, or an era. */
  meta: string;
  measureId: string;
  placement: string;
  contested?: boolean;
};

/**
 * The People chapter: one feature in full, and everything else as a roster.
 *
 * Measured at 390x844 on 2026-09-14 this band was 2,905px — 3.4 phone screens
 * of a 13.4-screen page, and the single largest thing on the homepage. It was
 * three stacked collections drawn as three different card templates: two live
 * features side by side, two preserved profiles with portraits, summaries and
 * sources, and a two-column history shelf with its own heading and standfirst.
 * A reader met six full records of one chapter before reaching the band that
 * explains how any of it is checked.
 *
 * What is here now is one lead feature and a roster of the rest. **Nothing was
 * deleted and no record lost a field**: Courage & service, the Fallen and
 * History & context are rendered in full at `/people-of-israel`, which already
 * carries the profiles (`#courage`), the live records (`#new-records`) and the
 * preserved timeline (`#history`) — this band names them and hands over.
 *
 * On a wide viewport the roster is the second column. That is also the fix for
 * the half-empty row the owner saw: the old `.featureSpread` put a single
 * text-led feature in a 1.35fr column and left the 0.85fr beside it blank, so
 * half the viewport was empty on the chapter with the most to show.
 */
export function HomePeopleSection({ people, heroes, history }: {
  people: HomepageEdition['people']; heroes: HomepageEdition['heroes']; history: HomepageEdition['israelsStory'];
}) {
  const live = people?.items ?? [];
  const [lead, ...moreLive] = live;
  const roster: RosterRow[] = [
    ...moreLive.map((item) => ({
      key: item.key,
      href: item.href,
      title: item.title,
      meta: item.category,
      measureId: `home-people-${item.key}`,
      placement: 'people:companion',
    })),
    /* `heroes.items[0]` is always the Courage & service pick and
       `heroes.items[1]` always the Fallen one — `server/modules/featured-slots`
       guarantees the order, so the row names the position rather than
       inferring it from the record's own `role`. The two used to be separate
       cards precisely so they could not read as one repeated template; as
       rows, the position is what keeps them apart. */
    ...heroes.items.slice(0, 2).map((item, index) => ({
      key: item.key,
      href: item.href,
      title: item.title,
      meta: index === 0 ? 'Courage & service' : 'Fallen',
      measureId: `home-heroes-${item.key}`,
      placement: `heroes:${index === 0 ? 'courage' : 'fallen'}`,
    })),
    ...history.items.map((item) => ({
      key: item.key,
      href: item.href,
      title: item.title,
      meta: item.era,
      measureId: `home-israels-story-${item.key}`,
      placement: 'history:chapter',
      contested: item.contested,
    })),
  ];
  const contested = roster.some((row) => row.contested);
  const shows = Boolean(lead) || roster.length > 0;

  return (
    <section
      id="home-people"
      className={`${styles.section} ${styles.editorial} ${styles.peopleChapter}`}
      aria-labelledby="home-people-title"
      data-home-section="people"
    >
      {/* No standfirst. The one that stood here — "People and the work they
          do: courage, science, invention and the context that makes each
          record legible" — restated the kicker above it in longer words and
          cost most of the screen the first record should have had. */}
      <SectionHeading id="home-people-title" kicker="People, work, context" title="The People of Israel" />
      <div className={styles.peopleStack} data-lead={lead ? 'true' : 'false'}>
        {lead ? (
          <article
            /* The chapter lead is one of the band's rationed arrivals (head
               + two records); the roster below it is never enrolled. */
            className={`${styles.peopleLead} ${styles.enterRecord}`}
            data-rank="lead"
            data-home-record={lead.key}
            data-measure-id={`home-people-${lead.key}`}
            data-measure-section="people"
            data-measure-content={measureContentId(lead.key)}
            data-measure-type="publication"
            data-measure-placement="people:lead"
            data-measure-card
          >
            <h3>
              <RecordShare name={recordViewNamesFromHref(lead.href)?.headline ?? null}>
                <Link href={lead.href} transitionTypes={recordViewNamesFromHref(lead.href) ? [RECORD_TRANSITION_TYPE] : undefined}>
                  {lead.title}
                </Link>
              </RecordShare>
            </h3>
            <div className={styles.byline}><span>{lead.category}</span></div>
            {/* The frame is decided at the source (`homepage-adapters.ts`)
                from the record's section, not by comparing label strings. */}
            <RecordShare name={recordViewNamesFromHref(lead.href)?.plate ?? null}>
              <HomeMedia media={lead.media} portrait={lead.portrait} />
            </RecordShare>
            <p className={styles.summary}>
              <PreviewText text={lead.summary} budget={PREVIEW_BUDGET.lead} />
            </p>
            <HomeSources sources={lead.sources} />
            {/* UX-05: the verb is derived from the record's section (`cta`); a
                snapshot serialized before the field existed reads it as the
                story it is. */}
            <JourneyLink href={lead.href}>{lead.cta ?? 'Read the story'}</JourneyLink>
          </article>
        ) : null}
        {roster.length ? (
          <div className={styles.roster}>
            <p className={styles.kicker}>Also in this chapter</p>
            <ol>
              {roster.map((row) => (
                <li
                  key={row.key}
                  data-home-record={row.key}
                  data-measure-id={row.measureId}
                  data-measure-section="people"
                  data-measure-content={measureContentId(row.key)}
                  data-measure-type="publication"
                  data-measure-placement={row.placement}
                  data-measure-card
                >
                  <JourneyLink href={row.href} variant="quiet">{row.title}</JourneyLink>
                  <p className={styles.rosterMeta}>
                    <span>{row.meta}</span>
                    {/* Not colour alone: the flag is a word, and the note
                        below the list says what the word means. */}
                    {row.contested ? <span className={styles.rosterFlag}>Contested</span> : null}
                  </p>
                </li>
              ))}
            </ol>
            {/* One closing paragraph, not two. The <strong> is what makes the
                flag above legible without colour; the sentence after it is the
                handover the section action below then performs. */}
            <p className={styles.rosterNote}>
              {contested ? (
                <>
                  <strong>Contested</strong> marks a chapter that records disagreement rather
                  than settling it.{' '}
                </>
              ) : null}
              {/* Named, not pointed at: the band's one action sits above the
                  roster on a wide viewport and below it on a phone, so "below"
                  would be wrong half the time. */}
              Courage &amp; service, the Fallen and History &amp; context are kept in
              full in the section itself.
            </p>
          </div>
        ) : null}
      </div>
      {!shows && people ? <SectionState section={people} /> : null}
      {/* UX-05. One form for going to the whole section: "All of <Section>"
          with the journey arrow. It is also the handover the roster's closing
          line promises, so there is one link out of this band and not two. */}
      <SectionAction href={BAND.hubHref}>All of {BAND.label}</SectionAction>
    </section>
  );
}
