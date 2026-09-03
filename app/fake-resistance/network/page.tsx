import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionBlock, SectionPage } from '@/components/sections/SectionPage';
import {
  EvidenceClassChip,
  KnownUnknownPanel,
  NetworkFigure,
  ResearchText,
  SourceList,
} from '@/components/content';
import { Card, CardDescription, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { getCaseIndex, getResearchNetwork } from '@/lib/content/fake-resistance-cases';
import { UNRESOLVED_LABELS } from '@/lib/content/fake-resistance-network-communities';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

const TAGLINE =
  'What the seven case files add up to — and the conclusions that survived every attempt to break them.';
const PAGE_URL = `${SITE_URL}/fake-resistance/network`;

export const metadata: Metadata = {
  title: 'The network',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: 'The network — LIONS OF ZION', description: TAGLINE },
};

export default async function Page() {
  const [network, cases] = await Promise.all([getResearchNetwork(), getCaseIndex()]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AnalysisNewsArticle',
    headline: 'The network',
    description: TAGLINE,
    url: PAGE_URL,
    dateModified: network.updatedAt,
    author: { '@type': 'Organization', name: 'Lions of Zion', url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: 'Lions of Zion', url: SITE_URL },
  };

  return (
    <SectionPage
      id="fake-resistance"
      accent="ember"
      surface="quiet"
      breadcrumb={[{ href: '/fake-resistance', label: 'Fake Resistance' }]}
      title="The network"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SectionBlock heading="What was mapped">
        <p>{network.question}</p>
        {network.executiveSummary.map((para) => (
          <p key={para.slice(0, 40)}>
            <ResearchText>{para}</ResearchText>
          </p>
        ))}
      </SectionBlock>

      <SectionBlock heading="Seven communities, not one operation">
        <p>
          The single most important result here is a negative one. Mapping{' '}
          {cases.length} case files against each other produced seven distinct
          communities joined by a handful of documented bridges — not one
          coordinated operation, and not seven sealed islands either. Anyone
          describing this ecosystem as a single machine with a single hand
          behind it is describing something the evidence did not find.
        </p>

        <NetworkFigure
          roster={network.roster}
          edges={network.edges}
          communities={network.communities}
        />

        <ul className={styles.communityList}>
          {network.communities.map((community) => (
            <Card as="li" key={community.number} variant="row">
              <CardHeader>
                <CardEyebrow>{String(community.number).padStart(2, '0')}</CardEyebrow>
              </CardHeader>
              <CardTitle>{community.name}</CardTitle>
              <CardDescription>{community.nodes.join(' · ')}</CardDescription>
              <p className={styles.communityBinding}>
                <span>What holds it together</span> {community.binding}
              </p>
            </Card>
          ))}
        </ul>

        <p className={styles.communityNote}>
          The lists above are the report&rsquo;s own, and{' '}
          {UNRESOLVED_LABELS.length} of the names in them —{' '}
          <span className={styles.communityNoteNames}>
            {UNRESOLVED_LABELS.map((entry) => entry.label).join(', ')}
          </span>{' '}
          — belong to accounts the research did not enter into its entity
          roster. They are counted in a community here and cannot be counted in
          the drawing above, which is built from the roster. The gap is the
          report&rsquo;s, and it is left visible rather than closed by guessing
          at an identity.
        </p>
      </SectionBlock>

      <SectionBlock heading="The bridges between them">
        <p>
          Where the communities touch, they touch through individuals rather
          than through structures — an account that appears in two lanes, a
          wire that several of them read, a guest who moves between shows.
          These are the documented crossings:
        </p>
        <ul className={styles.bridges}>
          {network.bridges.map((bridge) => (
            <li key={bridge.slice(0, 40)}>
              <ResearchText>{bridge}</ResearchText>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock heading="Findings that survived the contradiction pass">
        <p>
          Each of these was tested against evidence that would have broken it,
          and held. Some of them cut against the premise the research started
          from — those are kept exactly as they came out, because a program
          that only ever confirms itself is not worth reading.
        </p>
        <ol className={styles.findings}>
          {network.findings.map((finding) => (
            <li key={finding.slice(0, 40)}>
              <ResearchText>{finding}</ResearchText>
            </li>
          ))}
        </ol>
      </SectionBlock>

      <SectionBlock heading="Documented edges">
        <p>
          Every connection below was observed or documented, and each carries
          the kind of evidence that stands behind it: <strong>documented</strong>{' '}
          means stated on the record, <strong>observed</strong> means seen
          happening in public posts, and <strong>inferred</strong> means a
          pattern consistent with coordination that was not established.
        </p>
        <ul className={styles.edges}>
          {network.edges.map((edge) => (
            <li key={edge.id}>
              <div className={styles.edgeHead}>
                <span className={styles.edgePair}>
                  {edge.from} <span aria-hidden="true">→</span> {edge.to}
                </span>
                <EvidenceClassChip value={edge.evidenceClass} />
              </div>
              <p>{edge.statement}</p>
            </li>
          ))}
        </ul>
      </SectionBlock>

      {network.unknowns.length > 0 || network.wouldChange.length > 0 ? (
        <SectionBlock heading="What is not established">
          <KnownUnknownPanel
            unknowns={network.unknowns.length > 0 ? network.unknowns : network.limitations}
            wouldChange={network.wouldChange}
          />
        </SectionBlock>
      ) : null}

      {network.limitations.length > 0 ? (
        <SectionBlock heading="How this was gathered, and what that limits">
          {network.limitations.map((limitation) => (
            <p key={limitation.slice(0, 40)}>
              <ResearchText>{limitation}</ResearchText>
            </p>
          ))}
          <p>
            The <Link href="/methodology">methodology</Link> sets out how this
            desk sources, grades and corrects everything it publishes.
          </p>
        </SectionBlock>
      ) : null}

      {network.sources.length > 0 ? (
        <SectionBlock heading="Sources">
          <SourceList sources={network.sources} />
        </SectionBlock>
      ) : null}
    </SectionPage>
  );
}
