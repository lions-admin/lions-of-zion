import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionBlock, SectionPage } from '@/components/sections/SectionPage';
import { ConfidenceChip, EvidenceClassChip, ResearchText } from '@/components/content';
import {
  getCase,
  getCaseIndex,
  getResearchNetwork,
  type ResearchCase,
  type ResearchConfidence,
} from '@/lib/content/fake-resistance-cases';
import { getPlaybook } from '@/lib/content/fake-resistance-playbook';
import { ROLE_LABEL, type EntityRole } from '@/lib/content/fake-resistance-roles';
import { buildInvestigationModel } from '@/lib/content/investigation-model';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

const TAGLINE =
  'Investigations into accounts, narratives and propagation patterns on X: who is involved, what moves between them, what was actually observed, and how strong each conclusion is.';
const PAGE_URL = `${SITE_URL}/fake-resistance/social-media`;

/** How many cross-case findings the map opens with. */
const FINDINGS_SHOWN = 5;
/** How many threads of each kind the map lists. */
const THREADS_PER_KIND = 3;

/** Roles worth counting on a case row — the supply chain, not the apparatus. */
const STORY_ROLES: EntityRole[] = ['originator', 'clipper', 'amplifier', 'aggregator', 'platform', 'journalist'];

const CONFIDENCE_RANK: Record<ResearchConfidence, number> = { low: 0, medium: 1, high: 2 };

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

/** The first sentence of the editorial frame: what the case is about, in one line. */
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

/** The research's confidence grades on a case, as a range. */
function confidenceRange(record: ResearchCase): { low?: ResearchConfidence; high?: ResearchConfidence } {
  const grades = record.exhibits
    .map((e) => e.confidence)
    .filter((g): g is ResearchConfidence => Boolean(g))
    .sort((a, b) => CONFIDENCE_RANK[a] - CONFIDENCE_RANK[b]);
  return { low: grades[0], high: grades.at(-1) };
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
  const [index, playbook, network] = await Promise.all([
    getCaseIndex(),
    getPlaybook(),
    getResearchNetwork(),
  ]);
  const records = (await Promise.all(index.map((entry) => getCase(entry.slug)))).filter(
    (record): record is ResearchCase => record !== null,
  );

  const communityOfCase = new Map<string, string[]>();
  for (const community of network.communities) {
    for (const caseId of community.cases) {
      const list = communityOfCase.get(caseId) ?? [];
      if (!list.includes(community.label)) list.push(community.label);
      communityOfCase.set(caseId, list);
    }
  }

  /* The cross-case findings: the synthesis's own headline conclusion, then
     the readings its rebuild overturned — each a short, plain statement of
     what the data now shows. Data-driven, so a re-import moves them. */
  const findings = [
    ...network.findings.slice(0, 1),
    ...network.synthesisOverturned.map((row) => row.now),
  ].slice(0, FINDINGS_SHOWN);

  const byWeight = (relation: string) =>
    network.edges
      .filter((edge) => edge.relation === relation)
      .sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))
      .slice(0, THREADS_PER_KIND);
  const threads = [
    { kind: 'Caption reuse', hint: 'Near-identical text measured between two accounts, later copying earlier.', edges: byWeight('CAPTION_COPY') },
    { kind: 'Observed quote relays', hint: 'One account quoting another, counted across the merged corpus.', edges: byWeight('QUOTE') },
  ];
  const coordination = network.coordinationEdges
    .filter((edge) => edge.crossCommunity && !edge.controlSide)
    .slice(0, THREADS_PER_KIND);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The social-media front',
    description: TAGLINE,
    url: PAGE_URL,
    author: { '@type': 'Organization', name: 'Lions of Zion', url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: 'Lions of Zion', url: SITE_URL },
    hasPart: [
      { '@type': 'Article', name: 'The playbook', url: `${SITE_URL}/fake-resistance/playbook` },
      { '@type': 'AnalysisNewsArticle', name: 'The network', url: `${SITE_URL}/fake-resistance/network` },
      ...records.map((record) => ({
        '@type': 'AnalysisNewsArticle',
        name: record.title,
        description: record.question,
        url: `${SITE_URL}/fake-resistance/cases/${record.slug}`,
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

      <SectionBlock heading="What the research found" id="findings">
        <p>
          Seven case files and a cross-case network, read together. Every grade on these pages —
          confidence, identity status, evidence class — is the research&rsquo;s own and is never
          raised here. These are the conclusions that held across the files:
        </p>
        <ol className={styles.findings}>
          {findings.map((finding) => (
            <li key={finding.slice(0, 60)}>
              <ResearchText>{finding}</ResearchText>
            </li>
          ))}
        </ol>
        <p className={styles.findingsNote}>
          The full synthesis, with what it overturned, is the{' '}
          <Link href="/fake-resistance/network">network file</Link>.
        </p>
      </SectionBlock>

      <SectionBlock heading="The case files" id="cases">
        <p>
          Each file is an investigation into one part of the system. The line under a name says
          what part that is; the facts say how much stands behind it and how sure the research
          was.
        </p>
        <ol className={styles.constellation}>
          {records.map((record, position) => {
            const model = buildInvestigationModel(record);
            const range = confidenceRange(record);
            const roleCounts = STORY_ROLES.map((role) => ({
              role,
              count: model.entities.filter((e) => e.role === role).length,
            })).filter((r) => r.count > 0);
            const contested = model.claims.filter((c) => c.contested).length;
            const communities = communityOfCase.get(record.caseId) ?? [];
            const lead = record.question.split('?')[0].trim() + (record.question.includes('?') ? '?' : '');
            return (
              <li key={record.slug} className={styles.caseRow}>
                <span className={styles.caseIndex} aria-hidden="true">
                  {String(position + 1).padStart(2, '0')}
                </span>
                <div className={styles.caseBody}>
                  <h3 className={styles.caseTitle}>
                    <Link href={`/fake-resistance/cases/${record.slug}`}>
                      {record.title.split(':')[0].trim()}
                    </Link>
                  </h3>
                  {record.framing ? (
                    <p className={styles.casePart}>{firstSentence(record.framing.frame)}</p>
                  ) : null}
                  <p className={styles.caseQuestion}>{lead}</p>
                  <dl className={styles.caseFacts}>
                    <div>
                      <dt>Updated</dt>
                      <dd>
                        <time dateTime={record.updatedAt}>{updatedLabel(record.updatedAt)}</time>
                        {model.updated ? <span className={styles.caseUpdated}> · reading revised</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>
                        {record.counts.exhibits} graded {record.counts.exhibits === 1 ? 'finding' : 'findings'} ·{' '}
                        {record.counts.sources} sources · {record.counts.edges} connections
                        {contested > 0 ? ` · ${contested} with contradicting sources` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd className={styles.caseConfidence}>
                        {range.low && range.high ? (
                          range.low === range.high ? (
                            <ConfidenceChip value={range.high} />
                          ) : (
                            <>
                              <ConfidenceChip value={range.low} /> to <ConfidenceChip value={range.high} />
                            </>
                          )
                        ) : (
                          'Not graded'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Who is involved</dt>
                      <dd>
                        {roleCounts.length > 0
                          ? roleCounts
                              .map((r) => `${r.count} ${ROLE_LABEL[r.role].toLowerCase()}`)
                              .join(' · ')
                          : `${record.counts.entities} entities`}
                      </dd>
                    </div>
                    {communities.length > 0 ? (
                      <div>
                        <dt>In the network</dt>
                        <dd>{communities.join(' · ')}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <Link href={`/fake-resistance/cases/${record.slug}`} className={styles.caseOpen}>
                    Follow the thread <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </SectionBlock>

      <SectionBlock heading="Cross-case threads" id="threads">
        <p>
          The strongest measured flows in the merged corpus, each between two named accounts.
          They are listed here because they are how the files connect; each is documented in
          full, with its evidence class, on the network page.
        </p>
        {threads.map((group) =>
          group.edges.length > 0 ? (
            <div key={group.kind} className={styles.threadGroup}>
              <h3 className={styles.threadKind}>{group.kind}</h3>
              <p className={styles.threadHint}>{group.hint}</p>
              <ol className={styles.threads}>
                {group.edges.map((edge) => (
                  <li key={edge.id} className={styles.thread}>
                    <span className={styles.threadPair}>
                      {edge.from} <span aria-hidden="true">{edge.direction === 'undirected' ? '↔' : '→'}</span>{' '}
                      {edge.to}
                    </span>
                    <span className={styles.threadGrades}>
                      <EvidenceClassChip value={edge.evidenceClass} />
                      {edge.confidence ? <ConfidenceChip value={edge.confidence} /> : null}
                      {edge.weight ? (
                        <span className={styles.threadMeasure}>
                          {Number(edge.weight).toLocaleString('en-US')} instances
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.threadStatement}>{edge.statement}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null,
        )}
        {coordination.length > 0 ? (
          <div className={styles.threadGroup}>
            <h3 className={styles.threadKind}>Computed coordination signals across communities</h3>
            <p className={styles.threadHint}>
              Inferred, not established: a timing pattern tested against a null model. The
              research caps single-trace signals at low confidence, and the cap is shown.
            </p>
            <ol className={styles.threads}>
              {coordination.map((edge) => (
                <li key={`${edge.a}|${edge.b}`} className={styles.thread} data-kind="inferred">
                  <span className={styles.threadPair}>
                    @{edge.a} <span aria-hidden="true">↔</span> @{edge.b}
                  </span>
                  <span className={styles.threadGrades}>
                    <EvidenceClassChip value="inferred_coordination" />
                    {edge.confidenceCap ? (
                      <span className={styles.threadMeasure}>confidence cap: {edge.confidenceCap}</span>
                    ) : null}
                    {edge.pValue !== undefined ? (
                      <span className={styles.threadMeasure}>
                        p = {edge.pValue < 0.001 ? edge.pValue.toExponential(1) : edge.pValue.toFixed(3)}
                      </span>
                    ) : null}
                    {edge.sampleN ? (
                      <span className={styles.threadMeasure}>n = {edge.sampleN.toLocaleString('en-US')}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <p className={styles.findingsNote}>
          <Link href="/fake-resistance/network">Open the network file</Link> for every edge, the
          five computed communities, and what the network does not prove.
        </p>
      </SectionBlock>

      <SectionBlock heading="The reference works" id="reference">
        <ul className={styles.reference}>
          <li>
            <Link href="/fake-resistance/playbook">The playbook</Link>
            <span>
              {playbook.length} manipulation techniques — the move, the psychology behind it,
              where it is documented here, and how to catch it. Method; names no one.
            </span>
          </li>
          <li>
            <Link href="/fake-resistance/network">The network</Link>
            <span>
              What the case files add up to when the graph is computed rather than drawn by
              hand: {network.metrics.communities} communities across{' '}
              {network.metrics.nodes?.toLocaleString('en-US')} accounts, graded edge by edge.
            </span>
          </li>
          <li>
            <Link href="/fake-resistance/official-narrative">Official narrative engineering</Link>
            <span>
              The other side of the investigation: engineered claims aimed at the news record,
              and the corrections that unmade them.
            </span>
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock heading="Method and limits" id="method">
        <p className={styles.method}>
          These pages distinguish three kinds of relationship and never blend them.{' '}
          <strong>Documented</strong> means stated on the record — a bio, a filing, a public
          self-description. <strong>Observed</strong> means seen happening in public posts — a
          quote, a repost, a mention, a measured reuse of text. <strong>Inferred</strong> means a
          pattern consistent with coordination, tested against a null model, that was not
          established; it always travels with its p-value and sample size. An identity is{' '}
          <strong>unresolved</strong> until the research resolved it, however well documented the
          account&rsquo;s behaviour is.
        </p>
        <p className={styles.method}>
          <ResearchText>{network.caveat}</ResearchText>
        </p>
        <p className={styles.method}>
          How this desk sources, grades and corrects what it publishes is set out in the{' '}
          <Link href="/methodology">methodology</Link>; corrections are logged on the{' '}
          <Link href="/corrections">corrections page</Link>.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
