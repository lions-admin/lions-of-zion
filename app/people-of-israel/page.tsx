import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EditorialShell } from '@/components/site/EditorialShell';
import { HubMasthead } from '@/components/site/HubMasthead';
import { getOurHeroesEdition } from '@/lib/content/our-heroes';
import { getIsraelsStoryEdition } from '@/lib/content/israels-story';
import { listPublicPublications } from '@/lib/publications';
import { publicationHref } from '@/lib/publication-routing';
import { SITE_URL } from '@/lib/site-config';
import type { PublicPublication } from '@/server/contracts/publication';
import type { PublicationSection } from '@/server/contracts/enums';
import styles from './page.module.css';

const DESCRIPTION = 'People, courage, invention and the living record of Israel — with sources, context and a path to explore further.';
const LABELS: Partial<Record<PublicationSection, string>> = {
  people: 'People', courage_service: 'Courage & Service', innovation: 'Innovation',
  technology_ai: 'Technology & AI', science_medicine: 'Science & Medicine', achievement: 'Achievements',
  international_cooperation: 'International Cooperation', history_context: 'History & Context',
};
const ORDER = Object.keys(LABELS) as PublicationSection[];

export const metadata: Metadata = {
  title: 'The People of Israel', description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/people-of-israel` },
  openGraph: { title: 'The People of Israel — LIONS OF ZION', description: DESCRIPTION, type: 'website' },
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(value));
}

function PublicationCard({ publication }: { publication: PublicPublication }) {
  const image = publication.media;
  return <article className={styles.publication}>
    {image ? <Link className={styles.image} href={publicationHref(publication.publicId)}>
      <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" />
    </Link> : null}
    <div className={styles.publicationBody}>
      <p className={styles.meta}>{dateLabel(publication.publishedAt)} <span aria-hidden="true">·</span> {LABELS[publication.section]}</p>
      <h3><Link href={publicationHref(publication.publicId)}>{publication.title}</Link></h3>
      {publication.summary ? <p>{publication.summary}</p> : null}
      <Link className={styles.read} href={publicationHref(publication.publicId)}>Read the record <span aria-hidden="true">→</span></Link>
    </div>
  </article>;
}

/** Newest records per People section. One query per section rather than one
 *  site-wide page filtered afterwards: the public list caps at 100 rows across
 *  every section, so a site-wide read would silently drop People records once
 *  the news desk alone passed that mark, and its length counted every
 *  publication on the site. */
const RECORDS_PER_SECTION = 25;

export default async function Page() {
  const [sectionResults, heroes, history] = await Promise.all([
    Promise.all(ORDER.map(section =>
      listPublicPublications(`?section=${section}&limit=${RECORDS_PER_SECTION}`).catch((): PublicPublication[] => []),
    )),
    getOurHeroesEdition(), getIsraelsStoryEdition(),
  ]);
  const groups = ORDER.map((section, index) => ({
    section, label: LABELS[section]!, publications: sectionResults[index] ?? [],
  })).filter(group => group.publications.length > 0);
  const publishedRecords = groups.reduce((count, group) => count + group.publications.length, 0);
  const legacyHeroes = [heroes.featured, ...heroes.profiles];

  return <EditorialShell routeId="people-of-israel" register="muted" className={styles.page}>
    <div className={styles.hub}>
      <HubMasthead
        kicker="A living record"
        title={<>The People<br />of Israel</>}
        standfirst={DESCRIPTION}
        facts={[{ label: 'Published records', value: publishedRecords }, { label: 'Documented hero profiles', value: legacyHeroes.length }]}
        jumps={[
          ...(groups.length ? [{ href: '#new-records', label: 'New records' }] : []),
          { href: '#courage', label: 'Courage & service' }, { href: '#history', label: 'History & context' },
        ]}
      />

      {groups.length ? <section id="new-records" className={styles.records} aria-labelledby="new-records-title">
        <div className={styles.sectionHead}><p>Current work</p><h2 id="new-records-title">New records from the desk</h2></div>
        {groups.map(group => <section key={group.section} className={styles.group} aria-labelledby={`people-${group.section}`}>
          <h2 id={`people-${group.section}`}>{group.label}</h2>
          <div className={styles.grid}>{group.publications.map(publication => <PublicationCard key={publication.publicId} publication={publication} />)}</div>
        </section>)}
      </section> : null}

      <section id="courage" className={styles.legacy} aria-labelledby="courage-title">
        <div className={styles.legacyIntro}><p>Preserved collection</p><h2 id="courage-title">Courage &amp; service</h2><p>The existing profiles remain their own cited records. This collection opens a path into them without flattening their individual stories.</p></div>
        <ol className={styles.peopleList}>{legacyHeroes.map(person => <li key={person.id}><Link href={`/our-heroes#${person.id}`}><span>{person.name}</span><small>{person.role} · {person.meta}</small></Link></li>)}</ol>
        <Link className={styles.collectionLink} href="/our-heroes">Read all Our Heroes <span aria-hidden="true">→</span></Link>
      </section>

      <section id="history" className={styles.history} aria-labelledby="history-title">
        <div><p>Preserved collection</p><h2 id="history-title">History &amp; context</h2><p>Context is part of the evidence. The timeline remains accessible at its original address and keeps every cited chapter and anchor intact.</p><Link className={styles.collectionLink} href="/israels-story">Explore Israel’s Story <span aria-hidden="true">→</span></Link></div>
        <ol>{history.chapters.slice(0, 4).map((chapter, index) => <li key={chapter.id}><Link href={`/israels-story#${chapter.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{chapter.title}</Link></li>)}</ol>
      </section>
    </div>
  </EditorialShell>;
}
