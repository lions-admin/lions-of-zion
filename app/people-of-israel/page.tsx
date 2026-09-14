import { ActivationBand } from '@/components/content';
import { SITE_URL } from '@/lib/site-config';
import { formatDay } from '@/lib/format-date';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EditorialShell } from '@/components/site/EditorialShell';
import { HubMasthead, HubUpdated } from '@/components/site/HubMasthead';
import { getOurHeroesEdition, type HeroProfile } from '@/lib/content/our-heroes';
import { getIsraelsStoryEdition } from '@/lib/content/israels-story';
import { homepageMedia } from '@/lib/content/homepage-media';
import { listPublicPublications } from '@/lib/publications';
import {
  publicationHref,
  publicationCta,
  PUBLICATION_SECTION_LABELS,
  SECTIONS_BY_HOMEPAGE_SECTION,
} from '@/lib/publication-routing';
import { previewSentences } from '@/lib/preview-sentences';
import { pageMetadata } from '@/lib/page-metadata';
import { measureCard, measurePublicationCard } from '@/components/measurement/attrs';
import type { PublicPublication } from '@/server/contracts/publication';
import type { PublicationSection } from '@/server/contracts/enums';
import styles from './page.module.css';

/* The hub's lede (docs/audits/2026-09-08-copy-table.md, UX-02). */
const DESCRIPTION = 'The people the narrative leaves out — with the sources, so you can show them.';
/**
 * The sections are derived, not written out — VA-57.
 *
 * This file used to carry its own `Partial<Record<PublicationSection, string>>`
 * of eight labels, and it had already drifted from `lib/publication-routing.ts`
 * in three places: "Achievements" against "Israeli achievement", and
 * "International Cooperation" against "International cooperation". Being
 * `Partial` was the worse half — a new `people` section added to `DESTINATIONS`
 * got no lane here and simply never appeared, which is exactly the failure
 * `LiveBriefHub` had when it hard-coded `["daily_brief", "israel_update"]` and
 * left every `news` record rendered by nothing until 2026-09-06.
 *
 * `SECTIONS_BY_HOMEPAGE_SECTION.people` is the same derivation the homepage
 * band uses, so a section reaches this hub and its own card with one label.
 */
const PEOPLE_SECTIONS = SECTIONS_BY_HOMEPAGE_SECTION.people;
const LABELS: Record<PublicationSection, string> = PUBLICATION_SECTION_LABELS;

export const metadata: Metadata = pageMetadata({
  title: 'The People of Israel',
  description: DESCRIPTION,
  path: '/people-of-israel',
});


/**
 * One record in the merged list, its section as the kicker.
 *
 * UX-16: the hub used to render Innovation, Technology & AI and Science &
 * Medicine as three headed groups of one or two cards each, which told the
 * reader the section was unfinished. One list, newest first, with the section
 * named on each entry, carries the same information without the empty rooms.
 */
function RecordRow({ publication, rank }: { publication: PublicPublication; rank: number }) {
  const image = publication.media;
  return <li>
    <article className={image ? `${styles.record} ${styles.recordWithMedia}` : styles.record}
      {...measurePublicationCard('people-record', publication, `people:${rank}`)}>
      <div className={styles.recordBody}>
        <p className={styles.recordMeta}>
          <span className={styles.kicker}>{LABELS[publication.section]}</span>
          <time dateTime={publication.publishedAt}>{formatDay(publication.publishedAt)}</time>
        </p>
        <h3><Link href={publicationHref(publication.publicId)}>{publication.title}</Link></h3>
        {publication.summary ? <p className={styles.recordSummary}>{publication.summary}</p> : null}
        <Link className={styles.read} href={publicationHref(publication.publicId)}>{publicationCta(publication.section)} <span aria-hidden="true">→</span></Link>
      </div>
      {image ? <Link className={styles.recordImage} href={publicationHref(publication.publicId)} tabIndex={-1} aria-hidden="true">
        <Image src={image.src} alt="" width={image.width} height={image.height} sizes="(max-width: 45rem) 6rem, 9rem" />
      </Link> : null}
    </article>
  </li>;
}

/**
 * A hero profile with its portrait — the band that opens this hub.
 *
 * The portrait comes from the same registry the homepage uses, keyed the same
 * way (`hero:<id>`, with the profile's own `mediaRef` winning), so a profile
 * pictured on the cover is pictured here and a profile without a cleared
 * portrait is text-led rather than framed around a gap. The record itself —
 * the summary with its sources beside it — stays at `/our-heroes#<id>`; this
 * band opens the door and says who is behind it.
 */
/** The card's name and role are its anchor; a full biography already lives at
 *  the profile's own address, so the hub only ever shows a preview of it —
 *  the same sentence-budget technique the homepage's cards use
 *  (`lib/preview-sentences.ts`), sized for this card's own measure. */
const PROFILE_SUMMARY_BUDGET = 210;

function Profile({ profile, featured = false }: { profile: HeroProfile; featured?: boolean }) {
  const media = homepageMedia(`hero:${profile.id}`, profile.mediaRef);
  const href = `/our-heroes#${profile.id}`;
  const { shown, hidden } = previewSentences(profile.summary, PROFILE_SUMMARY_BUDGET);
  return <article className={styles.profile} data-featured={featured ? '' : undefined}
    {...measureCard({ id: `people-hero-${profile.id}`, section: 'people', content: `hero:${profile.id}`, type: 'profile', placement: featured ? 'heroes:lead' : undefined })}>
    {media ? <figure className={styles.portrait}>
      <span className={styles.portraitFrame}>
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          loading={featured ? 'eager' : 'lazy'}
          sizes="(max-width: 45rem) 100vw, (max-width: 64rem) 50vw, 30vw"
          style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
        />
      </span>
      <figcaption>
        {media.disclosure ? <span className={styles.disclosure}>{media.disclosure}</span> : null}
        <span>{media.credit}</span>
      </figcaption>
    </figure> : null}
    <div className={styles.profileBody}>
      <p className={styles.kicker}>{profile.role}</p>
      <h3><Link href={href}>{profile.name}</Link></h3>
      <p className={styles.profileMeta}>{profile.meta}</p>
      <p className={styles.profileSummary}>{shown}{hidden ? <span className={styles.profileSummaryRest}> {hidden}</span> : null}</p>
      <Link className={styles.read} href={href}>Read their story <span aria-hidden="true">→</span></Link>
    </div>
  </article>;
}

/** Newest records per People section. One query per section rather than one
 *  site-wide page filtered afterwards: the public list caps at 100 rows across
 *  every section, so a site-wide read would silently drop People records once
 *  the news desk alone passed that mark, and its length counted every
 *  publication on the site. */
const RECORDS_PER_SECTION = 25;

/** How many merged records the hub lists before pointing at `/updates`. */
const RECORDS_SHOWN = 24;

/** How many live History & Context records the `#history` section lists
 *  above the preserved chapters — a rail, not the full desk (which is what
 *  `#new-records` and `/updates` are already for). */
const HISTORY_RECORDS_SHOWN = 6;

export default async function Page() {
  const [sectionResults, heroes, history] = await Promise.all([
    Promise.all(PEOPLE_SECTIONS.map(section =>
      listPublicPublications(`?section=${section}&limit=${RECORDS_PER_SECTION}`).catch((): PublicPublication[] => []),
    )),
    getOurHeroesEdition(), getIsraelsStoryEdition(),
  ]);
  /* One list across every People section, newest first. A record carries
     exactly one section, so the merge cannot list anything twice. */
  const records = sectionResults.flat().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const shown = records.slice(0, RECORDS_SHOWN);
  /* `#new-records` already lists these newest-first across every People
     section — this is the same records filtered to one, for the `#history`
     rail. A record appearing in both lists is not a duplicate bug: they are
     two different labeled contexts (VA-16's own "current work" list and this
     section's "live, not yet part of the preserved collection"), the same
     way a live feature can appear on the homepage and on this hub already. */
  const liveHistory = records.filter((publication) => publication.section === 'history_context');
  const profiles = [heroes.featured, ...heroes.profiles];
  /* When this hub last changed: the newest live record, or the preserved
     collection's own edition when nothing live has been published yet. */
  const latest = records[0]?.publishedAt ?? heroes.publishedAt;

  return <EditorialShell routeId="people-of-israel" className={styles.page}>
    <div className={styles.hub}>
      <HubMasthead
        kicker="Who Israel is"
        title={<>The People<br />of Israel</>}
        standfirst={DESCRIPTION}
        status={<HubUpdated at={latest} />}
        jumps={[
          { href: '#courage', label: 'Courage & service' },
          { href: '#new-records', label: 'New records' },
          { href: '#history', label: 'History & context' },
        ]}
      />

      {/* UX-16 — the profiles lead. They are the richest thing this hub holds
          (portraits, a role, a story with sources behind it), and the DNA
          wants a reader here excited rather than shown an empty room. */}
      <section id="courage" className={styles.courage} aria-labelledby="courage-title">
        <header className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Our Heroes</p>
            <h2 id="courage-title">Courage &amp; service</h2>
          </div>
          <p className={styles.sectionCount}><span data-numeric="">{profiles.length}</span> {profiles.length === 1 ? 'profile' : 'profiles'}</p>
          <Link className={styles.sectionLink} href="/our-heroes">All of Our Heroes <span aria-hidden="true">→</span></Link>
        </header>
        {/* Which of the three kinds of thing on this hub these are. The hub
            merges live records with two preserved editions that kept their
            own addresses (`LEGACY_SECTION_PAGES`), and until 2026-09-14 the
            only thing saying so was a quiet "All of Our Heroes →" at the end
            of the head — so a reader had no way to tell a profile from a
            record beyond the picture. */}
        <p className={styles.sectionLede}>The preserved Our Heroes edition, kept at its own address. Every profile is built only from what named, mainstream press has already reported; the full record and its sources are on the profile’s own page.</p>
        <div className={styles.profiles}>
          {profiles.map((profile, index) => <Profile key={profile.id} profile={profile} featured={index === 0} />)}
        </div>
      </section>

      <div className={styles.columns}>
        <section id="new-records" className={styles.records} aria-labelledby="new-records-title">
          <header className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Current work</p>
              <h2 id="new-records-title">New records</h2>
            </div>
            {records.length ? <p className={styles.sectionCount}><span data-numeric="">{records.length}</span> {records.length === 1 ? 'record' : 'records'}</p> : null}
          </header>
          {shown.length
            ? <ol className={styles.recordList}>{shown.map((publication, index) => <RecordRow key={publication.publicId} publication={publication} rank={index + 1} />)}</ol>
            : <p className={styles.empty}>No records have been published here yet. The profiles above and the story below are the standing collection.</p>}
          {records.length > shown.length
            ? <Link className={styles.sectionLink} href="/updates">Everything published, every section <span aria-hidden="true">→</span></Link>
            : null}
        </section>

        <section id="history" className={styles.history} aria-labelledby="history-title">
          <header className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Live and preserved</p>
              <h2 id="history-title">History &amp; context</h2>
            </div>
          </header>
          <p className={styles.sectionLede}>Context is part of the evidence: new records as they publish, and the preserved Israel’s Story timeline, which keeps every cited chapter at its original address.</p>
          {/* New `history_context` publications, labeled as what they are —
              current work, not yet part of the preserved collection below.
              `records` already fetched every People section; this is that
              same list narrowed to one. */}
          {liveHistory.length ? <div className={styles.historyGroup}>
            <p className={styles.kicker}>New records</p>
            <ol className={styles.recordList}>{liveHistory.slice(0, HISTORY_RECORDS_SHOWN).map((publication, index) => <RecordRow key={publication.publicId} publication={publication} rank={index + 1} />)}</ol>
          </div> : null}
          <div className={styles.historyGroup}>
            <p className={styles.kicker}>Preserved collection</p>
            {/* Numbered because a timeline is sequential: the numeral is the
                chapter's place in the story, not a rank. */}
            <ol className={styles.chapters} data-measure-id="people-history-chapters" data-measure-section="people">{history.chapters.slice(0, 4).map((chapter, index) => <li key={chapter.id}><Link href={`/israels-story#${chapter.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{chapter.title}</Link></li>)}</ol>
          </div>
          <Link className={styles.sectionLink} href="/israels-story">All of Israel’s Story <span aria-hidden="true">→</span></Link>
        </section>
      </div>
      <ActivationBand
        share={{ url: `${SITE_URL}/people-of-israel`, text: 'The People of Israel — courage, invention and history, with the sources.' }}
      />
    </div>
  </EditorialShell>;
}
