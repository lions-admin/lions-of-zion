import type { Metadata } from 'next';
import { ArchiveRecordList } from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import { getDocumentationGroups } from '@/lib/content/documentation';
import { SITE_URL } from '@/lib/site-config';
import styles from '@/components/archive/archive.module.css';

const TAGLINE = 'The documentation record of October 7, filed as it was published.';
const PAGE_URL = `${SITE_URL}/october-7/documentation`;

export const metadata: Metadata = {
  title: 'Documentation',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
};

export default async function Page() {
  const groups = await getDocumentationGroups();
  const total = groups.reduce((sum, group) => sum + group.records.length, 0);

  // File numbers run through the whole archive, not per category — a number
  // that restarts at 001 six times is a row counter, not an identity. Each
  // group starts where the ones before it left off.
  const startAt = groups.map((_, i) =>
    groups.slice(0, i).reduce((sum, g) => sum + g.records.length, 1),
  );

  return (
    <DocPage routeId="october-7" title="Documentation" tagline={TAGLINE}>
      <p>
        {total} records archived from Hamas-Massacre.net, in English and
        Spanish, kept in the categories the source filed them under. Each is
        reproduced as published, with its credits intact.
      </p>
      <p>
        Much of this material is graphic. It is documentation of a massacre,
        and it is presented as documentation — described, dated and credited,
        so that what it shows can be checked rather than argued about.
      </p>

      {groups.map((group, i) => (
        <section key={group.slug}>
          <h2 className={styles.groupHeading}>{group.title}</h2>
          <p className={styles.groupCount}>
            {group.records.length} {group.records.length === 1 ? 'record' : 'records'}
          </p>
          <ArchiveRecordList
            records={group.records}
            startAt={startAt[i]}
            href={(entry) => `/october-7/documentation/${group.slug}/${entry.id}`}
          />
        </section>
      ))}
    </DocPage>
  );
}
