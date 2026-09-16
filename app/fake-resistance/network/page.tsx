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
import {
  CommunityMap,
  OverturnedList,
  ResearchParagraphs,
  ResearchProse,
  parseResearchProse,
} from '@/components/research';
import { NetworkExplorer, NetworkFindingHeader } from '@/components/investigation';
import { getCaseIndex, getResearchNetwork } from '@/lib/content/fake-resistance-cases';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';
import { publicationHubCrumb } from '@/lib/publication-routing';
import { pageMetadata } from '@/lib/page-metadata';
import { Icon } from '@/components/ui/Icon';

const TAGLINE =
  'What the case files add up to when the network is computed rather than drawn by hand — and which of the earlier readings that killed.';
const PAGE_URL = `${SITE_URL}/fake-resistance/network`;

export const metadata: Metadata = pageMetadata({
  title: 'The network',
  description: TAGLINE,
  path: "/fake-resistance/network",
});

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

  /* One corrections record, not two. `overturned` and `synthesisOverturned`
     used to render in separate sections — "What the rebuild overturned" and
     "How the reading changed over time" — and the second of them listed the
     first one's rows again, so every synthesis correction appeared on the page
     twice, in two presentations, under two headings. They are the same kind of
     row (`CaseOverturned`) and they belong in one place. */
  const overturned = [...network.synthesisOverturned, ...network.overturned];

  /* The summary's real block structure, recovered from the flat strings the
     importer produced. Three of its four paragraphs carry list markers inside
     them — `1.`/`2.` for the double refutation, `- ` for the coupling
     observations — and the fourth is a bare `---` left over from the document
     the packet was cut out of. `research-prose.ts` has the detail.

     The ordered list is the central finding, and it goes to the header: a
     reader must meet the refutation before the corpus statistics, not three
     paragraphs after them. The methods sentence goes with it, demoted to the
     corroboration it is. What remains — the coupling observations — is the
     body of "What was mapped". */
  const summaryBlocks = parseResearchProse(network.executiveSummary);
  const refutations = summaryBlocks.find((block) => block.kind === 'list' && block.ordered);
  const methods = summaryBlocks.find((block) => block.kind === 'para');
  const summaryBody = summaryBlocks.filter(
    (block) => block !== refutations && block !== methods,
  );

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
      breadcrumb={[publicationHubCrumb('fakeResistance')]}
      title="The network"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Finding first, then the evidence for it. The page used to open on
          "This synthesis integrates empirical findings from eight targeted
          investigations …, analyzing a combined corpus of 33,354 posts" — a
          methods sentence — and put the result, a double refutation, into the
          next block of running prose with its two halves flattened into the
          paragraph. The case pages were given this treatment deliberately;
          this page never got it. `NetworkFindingHeader` has the reasoning. */}
      <NetworkFindingHeader
        question={network.question}
        /* Desk copy, and the only sentence in this header that the research
           did not write. It says in plain words what the two refusals below
           have in common: both are popular explanations, and both fail. */
        lede="The central result is a refutation, and it cuts in two directions at once. Two ready-made explanations of this network are in circulation — one says it is a single machine, the other that it is one bot fabric spanning every camp — and the data withdraws both."
        findings={
          refutations?.kind === 'list' ? refutations.items : network.findings
        }
        metrics={network.metrics}
        corroboration={methods?.kind === 'para' ? methods.text : undefined}
      />

      {summaryBody.length > 0 ? (
        <SectionBlock heading="Where the coupling is tight">
          <p>
            The refutations above are about the network as a whole. They do not
            say that nothing in it is coordinated — these are the sub-structures
            the corpus shows locking together, each with the test behind it.
          </p>
          <ResearchProse blocks={summaryBody} />
        </SectionBlock>
      ) : null}

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

      {overturned.length > 0 ? (
        <SectionBlock heading="What the rebuild overturned" id="timeline">
          <p>
            These are readings this section published in August that its own
            new data withdrew. They are listed before the findings, not after
            them, because a reader who met the earlier version deserves the
            correction first. The cross-case record has two dated states: the
            hand-drawn reading of{' '}
            <time dateTime="2026-08-26">26 August 2026</time> and the computed
            rebuild of <time dateTime="2026-09-06">6 September 2026</time>. Each
            row below is one change in interpretation between them.
          </p>
          <OverturnedList rows={overturned} />
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

      <SectionBlock heading="Findings that survived the contradiction pass" id="findings">
        <p>
          Each of these was tested against evidence that would have broken it,
          and held. Some of them cut against the premise the research started
          from — those are kept exactly as they came out, because a program
          that only ever confirms itself is not worth reading.
        </p>
        {/* The packet's own findings, in full and in its own words. The two
            refutations the header summarises are the first of them; this is
            where they are stated at length with the measurements attached. */}
        <ol className={styles.findings}>
          {network.findings.map((finding) => (
            <li key={finding.slice(0, 40)}>
              <ResearchParagraphs paragraphs={[finding]} />
            </li>
          ))}
        </ol>
      </SectionBlock>

      <SectionBlock heading="Explore the connections" id="explore">
        <p>
          Every recorded connection in the merged corpus, as a list a reader can
          filter and check: by the kind of relation, by the class of evidence
          behind it, and by computed community. Choose an account to read its
          placement, its strongest connections, and the case file that
          examines it in full. Nothing here is drawn; every edge is a sentence
          with a grade.
        </p>
        <NetworkExplorer
          roster={network.roster}
          edges={network.edges}
          communities={network.communities}
          topNodes={network.topNodes}
          cases={cases.map((entry) => ({
            caseId: entry.caseId,
            slug: entry.slug,
            title: entry.title.split(':')[0].trim(),
          }))}
        />
      </SectionBlock>

      <SectionBlock heading="What the network does not prove" id="does-not-prove">
        <ul className={styles.bridges}>
          <li>
            An edge is an observation, not an allegiance. A quote, a mention or
            a follow records that one account touched another in public; it does
            not say why, and it does not say the two agree.
          </li>
          <li>
            A community is a computed partition of a convenience sample. It says
            which accounts interact more with each other than with the rest of
            this sample — not that they know each other, and nothing about
            accounts the sample never harvested.
          </li>
          <li>
            An inferred coordination signal is a timing pattern that a null model
            could not explain. It is not proof of instruction, shared staffing or
            shared ownership, and the research caps single-trace signals at low
            confidence however small their p-value.
          </li>
          <li>
            Mention edges are text-derived and include ordinary fan-to-celebrity
            tagging; caption-copy direction rests on the earliest timestamp in
            the sample; follow sets are single-page and recency-biased. Each of
            these is stated in the limitations below and none is smoothed over
            in the list above.
          </li>
        </ul>
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

        {/* The ledger, behind a deliberate disclosure.

            Every one of these pairs stays on the page — this is the evidence
            the section rests on and none of it is dropped. What changed is
            that it no longer stands between the finding and the reader by
            default: the tested pairs rendered inline were 238 of this page's
            782 paragraphs, and a reader met them before reaching the
            limitations that qualify them.

            Native `<details>`, so it opens with scripting off and prints open
            with the rest of the file's disclosures. The test behind each edge
            is a definition list rather than a run-on sentence: a claim and its
            measurements are two different things to read, and setting them as
            one line of prose is the density problem in miniature. */}
        <details className={styles.ledger}>
          <summary>
            <span className={styles.ledgerTitle}>Every tested pair</span>
            <span className={styles.ledgerNote}>
              {coordinationEdges.length} pairs · what each one asserts, the
              p-value, the null model it was tested against and the sample size
            </span>
          </summary>
          <ul className={styles.edges}>
            {coordinationEdges.map((edge) => (
              <li key={edge.id}>
                <div className={styles.edgeHead}>
                  <span className={styles.edgePair}>
                    {edge.from} <Icon name="arrow-right" inline /> {edge.to}
                  </span>
                  <EvidenceClassChip value={edge.evidenceClass} />
                </div>
                <p>{edge.statement}</p>
                {edge.pValue ? (
                  <dl className={styles.edgeTest}>
                    <div>
                      <dt>p</dt>
                      <dd>{edge.pValue}</dd>
                    </div>
                    <div>
                      <dt>Null model</dt>
                      <dd>{edge.nullModel}</dd>
                    </div>
                    <div>
                      <dt>n</dt>
                      <dd>{Number(edge.sampleN).toLocaleString('en')}</dd>
                    </div>
                    {edge.analysisOutput ? (
                      <div>
                        <dt>Output</dt>
                        <dd>{edge.analysisOutput}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
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
          <ResearchParagraphs paragraphs={network.limitations} />
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
