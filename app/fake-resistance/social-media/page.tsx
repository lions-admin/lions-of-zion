import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionBlock, SectionPage } from '@/components/sections/SectionPage';
import {
  Card,
  CardCount,
  CardCta,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { getCaseIndex } from '@/lib/content/fake-resistance-cases';
import { getPlaybook } from '@/lib/content/fake-resistance-playbook';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

const TAGLINE =
  'The influence-network research: the techniques, the cross-network synthesis, and seven documented case files.';
const PAGE_URL = `${SITE_URL}/fake-resistance/social-media`;

/** A date the reader can read, from the ISO stamp the research recorded. */
function updatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const metadata: Metadata = {
  title: 'The social-media front',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'The social-media front — LIONS OF ZION',
    description: TAGLINE,
  },
};

export default async function Page() {
  const [cases, playbook] = await Promise.all([getCaseIndex(), getPlaybook()]);

  /* An index over existing works, so the honest schema.org type is a
     collection page whose parts are the nine files it points at. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The social-media front',
    description: TAGLINE,
    url: PAGE_URL,
    author: { '@type': 'Organization', name: 'Lions of Zion', url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: 'Lions of Zion', url: SITE_URL },
    hasPart: [
      {
        '@type': 'Article',
        name: 'The playbook',
        url: `${SITE_URL}/fake-resistance/playbook`,
      },
      {
        '@type': 'AnalysisNewsArticle',
        name: 'The network',
        url: `${SITE_URL}/fake-resistance/network`,
      },
      ...cases.map((entry) => ({
        '@type': 'AnalysisNewsArticle',
        name: entry.title,
        description: entry.question,
        url: `${SITE_URL}/fake-resistance/cases/${entry.slug}`,
      })),
    ],
  };

  return (
    <SectionPage
      id="fake-resistance"
      breadcrumb={[{ href: '/fake-resistance', label: 'Fake Resistance' }]}
      accent="ember"
      surface="quiet"
      title="The social-media front"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SectionBlock heading="What this branch holds">
        <p>
          This is the social-media side of the investigation: the influence
          networks themselves, documented account by account. The research
          behind it graded every claim it publishes — confidence, identity
          status, evidence class — and those grades render exactly as the
          research assigned them, never upgraded. The playbook is about method
          and names no one; the case files document specific networks, with
          every source on record.
        </p>
        <p>
          The other side of the investigation — engineered claims that were
          aimed at the news record, and the corrections that unmade them — is
          a separate branch:{' '}
          <Link href="/fake-resistance/official-narrative">
            official narrative engineering
          </Link>
          .
        </p>
      </SectionBlock>

      <SectionBlock heading="The reference works">
        <p>
          Two works stand over the case files. Read the playbook first if you
          want the method; read the network file first if you want the map.
        </p>
        {/* Each preview answers the same four questions (INV-005): what the
            file is (title), what it asks or covers (description), what stands
            behind it (the evidence line), and where the card goes (the named
            destination). No card says "read more". */}
        <ul className={styles.fileIndex}>
          <li>
            <Card variant="row" href="/fake-resistance/playbook" className={styles.fileRow}>
              <CardHeader>
                <CardEyebrow>Reference — field manual</CardEyebrow>
                <CardCount>{playbook.length} chapters</CardCount>
              </CardHeader>
              <CardTitle>The playbook</CardTitle>
              <CardDescription>
                {playbook.length} manipulation techniques in full — the move, the
                psychology behind it, where it is documented here, and how to
                catch it.
              </CardDescription>
              <p className={styles.fileEvidence}>
                <span>Evidence basis</span>
                Editorial chapters about method; every example cited on it is
                published on this site.
              </p>
              <CardCta>Open the playbook</CardCta>
            </Card>
          </li>
          <li>
            <Card variant="row" href="/fake-resistance/network" className={styles.fileRow}>
              <CardHeader>
                <CardEyebrow>Reference — synthesis</CardEyebrow>
                <CardCount>{cases.length} case files, mapped</CardCount>
              </CardHeader>
              <CardTitle>The network</CardTitle>
              <CardDescription>
                What the case files add up to: seven communities, the documented
                bridges between them, and the findings that survived every
                attempt to break them — including the ones that cut against the
                premise.
              </CardDescription>
              <p className={styles.fileEvidence}>
                <span>Evidence basis</span>
                Cross-case research synthesis, graded edge by edge.
              </p>
              <CardCta>Open the network file</CardCta>
            </Card>
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock heading="The case files">
        <p>
          Seven documented investigations, each opened by the question it set
          out to answer. Every file carries its own sources, its own grades,
          and the findings that were withheld, with the reason counted on the
          page.
        </p>
        <ul className={styles.fileIndex}>
          {cases.map((entry, index) => (
            <li key={entry.slug}>
              <Card
                variant="row"
                href={`/fake-resistance/cases/${entry.slug}`}
                className={styles.fileRow}
              >
                <CardHeader>
                  <CardEyebrow>
                    Case file {String(index + 1).padStart(2, '0')}
                  </CardEyebrow>
                  <CardCount>
                    <time dateTime={entry.updatedAt}>
                      {updatedLabel(entry.updatedAt)}
                    </time>
                  </CardCount>
                </CardHeader>
                <CardTitle>{entry.title.split(':')[0].trim()}</CardTitle>
                <CardDescription>{entry.question}</CardDescription>
                <p className={styles.fileEvidence}>
                  <span>Evidence basis</span>
                  {entry.counts.exhibits} graded{' '}
                  {entry.counts.exhibits === 1 ? 'finding' : 'findings'} ·{' '}
                  {entry.counts.sources} sources on record ·{' '}
                  {entry.counts.entities} entities
                </p>
                <CardCta>Open the case file</CardCta>
              </Card>
            </li>
          ))}
        </ul>
      </SectionBlock>
    </SectionPage>
  );
}
