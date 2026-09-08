import { ActivationBand } from '@/components/content';
import { SITE_URL } from '@/lib/site-config';
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
import { pageMetadata } from '@/lib/page-metadata';
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

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(value));
}

/**
 * One record in the merged list, its section as the kicker.
 *
 * UX-16: the hub used to render Innovation, Technology & AI and Science &
 * Medicine as three headed groups of one or two cards each, which told the
 * reader the section was unfinished. One list, newest first, with the section
 * named on each entry, carries the same information without the empty rooms.
 */
function RecordRow({ publication }: { publication: PublicPublication }) {
  const image = publication.media;
  return <li>
    <article className={image ? `${styles.record} ${styles.recordWithMedia}` : styles.record}>
      <div className={styles.recordBody}>
        <p className={styles.recordMeta}>
          <span className={styles.kicker}>{LABELS[publication.section]}</span>
          <time dateTime={publication.publishedAt}>{dateLabel(publication.publishedAt)}</time>
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
function Profile({ profile, featured = false }: { profile: HeroProfile; featured?: boolean }) {
  const media = homepageMedia(`hero:${profile.id}`, profile.mediaRef);
  const href = `/our-heroes#${profile.id}`;
  return <article className={styles.profile} data-featured={featured ? '' : undefined}>
    {media ? <figure className={styles.portrait}>
      <Image
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading={featured ? 'eager' : 'lazy'}
        sizes="(max-width: 45rem) 100vw, (max-width: 64rem) 50vw, 30vw"
        style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
      />
      <figcaption>
        {media.disclosure ? <span className={styles.disclosure}>{media.disclosure}</span> : null}
        <span>{media.credit}</span>
      </figcaption>
    </figure> : null}
    <div className={styles.profileBody}>
      <p className={styles.kicker}>{profile.role}</p>
      <h3><Link href={href}>{profile.name}</Link></h3>
      <p className={styles.profileMeta}>{profile.meta}</p>
      <p className={styles.profileSummary}>{profile.summary}</p>
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
  const profiles = [heroes.featured, ...heroes.profiles];
  /* When this hub last changed: the newest live record, or the preserved
     collection's own edition when nothing live has been published yet. */
  const latest = records[0]?.publishedAt ?? heroes.publishedAt;

  return <EditorialShell routeId="people-of-israel" register="silent" className={styles.page}>
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
            ? <ol className={styles.recordList}>{shown.map(publication => <RecordRow key={publication.publicId} publication={publication} />)}</ol>
            : <p className={styles.empty}>No records have been published here yet. The profiles above and the story below are the standing collection.</p>}
          {records.length > shown.length
            ? <Link className={styles.sectionLink} href="/updates">Everything published, every section <span aria-hidden="true">→</span></Link>
            : null}
        </section>

        <section id="history" className={styles.history} aria-labelledby="history-title">
          <header className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Preserved collection</p>
              <h2 id="history-title">History &amp; context</h2>
            </div>
          </header>
          <p className={styles.historyLede}>Context is part of the evidence. The timeline keeps every cited chapter and anchor at its original address.</p>
          {/* Numbered because a timeline is sequential: the numeral is the
              chapter's place in the story, not a rank. */}
          <ol className={styles.chapters}>{history.chapters.slice(0, 4).map((chapter, index) => <li key={chapter.id}><Link href={`/israels-story#${chapter.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{chapter.title}</Link></li>)}</ol>
          <Link className={styles.sectionLink} href="/israels-story">All of Israel’s Story <span aria-hidden="true">→</span></Link>
        </section>
      </div>
      <ActivationBand
        share={{ url: `${SITE_URL}/people-of-israel`, text: 'The People of Israel — courage, invention and history, with the sources.' }}
      />
    </div>
  </EditorialShell>;
}
