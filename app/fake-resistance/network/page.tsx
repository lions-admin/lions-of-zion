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
import { CommunityMap, OverturnedList } from '@/components/research';
import { getCaseIndex, getResearchNetwork } from '@/lib/content/fake-resistance-cases';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

const TAGLINE =
  'What the case files add up to when the network is computed rather than drawn by hand — and which of the earlier readings that killed.';
const PAGE_URL = `${SITE_URL}/fake-resistance/network`;

export const metadata: Metadata = {
  title: 'The network',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: 'The network — LIONS OF ZION', description: TAGLINE },
};

export default async function Page() {
  const [network, cases] = await Promise.all([getResearchNetwork(), getCaseIndex()]);

  /* The account-level drawing shows the inferential layer only. The observed
     layer is 589 edges over 183 accounts — real, and far past the size where a
     drawing of it says anything a reader can check. It stays in the data and
     in the per-case files, where it is read a case at a time. */
  const coordinationEdges = network.edges.filter(
    (edge) => edge.evidenceClass === 'inferred_coordination',
  );
  const inCoordination = new Set(coordinationEdges.flatMap((edge) => [edge.fromId, edge.toId]));
  const coordinationRoster = network.roster.filter((entity) => inCoordination.has(entity.id));

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

      <SectionBlock heading="Five communities, computed">
        <p>
          The single most important result here is a negative one, and it is
          not the one this section published in August. Mapping {cases.length}{' '}
          case files against each other used to produce seven communities
          joined by five bridges — a reading a person made from a
          twenty-one-edge table. Running the partition over the merged corpus
          instead gives{' '}
          <strong>
            {network.metrics.communities} communities across{' '}
            {network.metrics.nodes?.toLocaleString('en')} accounts
          </strong>
          , one of which holds about four fifths of them. Neither picture is a
          single machine with a single hand behind it. But the old one was also
          not a simplification of this one; it was a different claim, and the
          data withdrew it.
        </p>

        <CommunityMap
          communities={network.communities}
          communityEdges={network.communityEdges}
          metrics={network.metrics}
          caveat={network.caveat}
        />
      </SectionBlock>

      {network.pipeline.length > 0 ? (
        <SectionBlock heading="How material moves">
          <p>
            The flow the corpus shows runs in four stages. Each is a role
            rather than an organisation: the same account can seed one item and
            amplify the next.
          </p>
          <ol className={styles.findings}>
            {network.pipeline.map((stage) => (
              <li key={stage.slice(0, 40)}>
                <ResearchText>{stage}</ResearchText>
              </li>
            ))}
          </ol>
        </SectionBlock>
      ) : null}

      {network.synthesisOverturned.length > 0 ? (
        <SectionBlock heading="What the rebuild overturned">
          <p>
            These are readings this section published in August that its own
            new data withdrew. They are listed before the findings, not after
            them, because a reader who met the earlier version deserves the
            correction first.
          </p>
          <OverturnedList rows={network.synthesisOverturned} />
        </SectionBlock>
      ) : null}

      <SectionBlock heading="Where the communities touch">
        <p>
          {network.metrics.bridges} edges in this graph are structural bridges:
          remove one and the two sides it joins stop being connected through
          it. They run through individual accounts rather than through
          structures — an account that appears in two lanes, a wire several of
          them read, a guest who moves between shows. The count is computed;
          the earlier version of this page listed five bridges that a person
          had picked out.
        </p>
        {network.bridges.length > 0 ? (
          <ul className={styles.bridges}>
            {network.bridges.map((bridge) => (
              <li key={bridge.slice(0, 40)}>
                <ResearchText>{bridge}</ResearchText>
              </li>
            ))}
          </ul>
        ) : null}
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

      <SectionBlock heading="The coordination layer">
        <p>
          Of the {network.metrics.edges?.toLocaleString('en')} observed edges in
          the graph, {network.metrics.coordinationEdges} are inferential: pairs
          of accounts whose behaviour matched more closely than a null model
          says it should have. They are the only edges here that assert
          anything beyond &ldquo;this happened&rdquo;, and every one of them
          carries the test behind it — the p-value, the null it was tested
          against, and the sample size. An edge without those does not publish.
        </p>
        <p>
          The drawing is deliberately the small layer. Drawing all{' '}
          {network.metrics.nodes} accounts would produce a hairball whose shape
          is an artefact of the layout; the {coordinationRoster.length} accounts
          below are the ones the coordination test actually touched.
        </p>

        <NetworkFigure
          roster={coordinationRoster}
          edges={coordinationEdges}
          communities={network.communities}
        />

        <p className={styles.edgeNote}>
          A matched behavioural signal is not proof of coordination, and the
          research caps it accordingly: a pair that matched on a single trace
          is held at low confidence however small its p-value, because two
          accounts covering the same news on the same rhythm will match on one
          trace all day. {network.caveat}
        </p>

        <ul className={styles.edges}>
          {coordinationEdges.map((edge) => (
            <li key={edge.id}>
              <div className={styles.edgeHead}>
                <span className={styles.edgePair}>
                  {edge.from} <span aria-hidden="true">→</span> {edge.to}
                </span>
                <EvidenceClassChip value={edge.evidenceClass} />
              </div>
              <p>{edge.statement}</p>
              {edge.pValue ? (
                <p className={styles.edgeTest}>
                  p = {edge.pValue} · {edge.nullModel} · n ={' '}
                  {Number(edge.sampleN).toLocaleString('en')}
                  {edge.analysisOutput ? ` · ${edge.analysisOutput}` : ''}
                </p>
              ) : null}
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
      <SectionBlock heading="The consciousness war">
        <p>
          The fight over what happened has its own name in Hebrew:{" "}
          <span lang="he" dir="rtl">
            מלחמת התודעה
          </span>{" "}
          — the consciousness war. Its premise is that what people believe
          about a war is territory, contested with the same seriousness as
          ground — and that the decisive weapons are not arguments but
          logistics: banked material, standing networks, and rails that move a
          claim faster than any check can follow it.
        </p>
        <p>
          October 7 demonstrated how much of that war was in place before it
          had a subject. In the days immediately after the attack — while
          verification desks were still finding their footing — footage from
          Arma 3, a military simulation game released in 2013, was already
          circulating as combat video, one flagged post alone drawing more
          than three million views. The game&rsquo;s own studio had publicly asked
          people to stop doing this in November 2022, citing the same misuse
          across earlier conflicts. Nothing had to be invented; the technique
          was already routine.
        </p>
        <p>
          The networks were standing too, and this part is documented rather
          than inferred. The operation researchers call Doppelgänger was
          running from at least May 2022. Spamouflage had been active since
          2019, and the largest single takedown of it on record was announced
          five weeks before the attack. Platform enforcement, government
          designations, research-institute analysis and forensic reporting
          each register the same infrastructure independently, and all of it
          predates October 7. The event supplied the occasion; the machinery
          did not need building.
        </p>
      </SectionBlock>

      <SectionBlock heading="The machine">
        <p>
          The supply chain has four links. A claim is seeded by a small set of
          originating accounts; amplifier networks that exist to move volume
          pick it up; accounts that look organic launder it into traffic that
          looks like consensus; and real people carry it the rest of the way,
          believing they found it themselves. Recycled imagery — footage from
          other conflicts, other years, other continents — is the raw material
          at the top of the chain, and it is where all three exhibits in{" "}
          <Link href="/fake-resistance/official-narrative">
            the official-narrative file
          </Link>{" "}
          came apart.
        </p>
        {/* Stated rather than glossed over: the second link is the one those
            three exhibits do not document. Claiming otherwise would be the
            same move the exhibits exist to expose. */}
        <p>
          The second link is the one those case files cannot show you.
          Documenting an amplifier network takes account-level evidence
          gathered over time, which is what{" "}
          <Link href="/fake-resistance/network">the network file</Link> is for.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
