import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionBlock, SectionPage } from '@/components/sections/SectionPage';
import { ResearchText, RosterTable, SourceList } from '@/components/content';
import {
  CaseStoryHeader,
  EntityInspector,
  EvidenceLedger,
  EvidencePath,
  InvestigationProvider,
  InvestigationSectionNav,
  InvestigationTimeline,
  NarrativeLanes,
  RelationshipFlow,
  RoleMap,
  UnknownsPanel,
  type InvestigationSection,
} from '@/components/investigation';
import { CadenceFigure, EvidenceStrip, LagFigure, OverturnedList } from '@/components/research';
import {
  caseParams,
  getCase,
  getCaseIndex,
  type ResearchCase,
} from '@/lib/content/fake-resistance-cases';
import { buildInvestigationModel, type ElsewhereLink } from '@/lib/content/investigation-model';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

type Params = { params: Promise<{ slug: string }> };

/**
 * The reading order of a case — "follow the thread". A reader can jump
 * between these, but scrolled top to bottom they tell one story: the finding,
 * the people, the ideas, the movement, the time, the evidence, what cuts
 * against it, what is unknown, and where it all came from.
 */
const SECTIONS: InvestigationSection[] = [
  { id: 'finding', label: 'Finding' },
  { id: 'who', label: 'Who is involved' },
  { id: 'narratives', label: 'Narratives' },
  { id: 'flows', label: 'How material moved' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'counter', label: 'What cuts against it' },
  { id: 'unknowns', label: 'Unknowns and limits' },
  { id: 'sources', label: 'Sources' },
];

export async function generateStaticParams() {
  return caseParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const record = await getCase(slug);
  if (!record) return {};

  const url = `${SITE_URL}/fake-resistance/cases/${slug}`;
  // The question, not the question plus the working hypothesis trailing it —
  // same rule as the lede, so a search result reads like the page does.
  const description = splitQuestion(record.question).lead;
  return {
    title: shortTitle(record.title),
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${shortTitle(record.title)} — LIONS OF ZION`,
      description,
    },
  };
}

/**
 * The packets title a case as a full research sentence — everything before
 * the colon is the name, everything after is the abstract. The page shows the
 * name and lets the question carry the rest.
 */
function shortTitle(title: string) {
  const [head] = title.split(':');
  return head.trim();
}

/**
 * Splits a research question into the question itself and whatever framing
 * trails it.
 *
 * Two of the packets append their working hypothesis or a scope note after
 * the question mark ("Working hypothesis under test: …"). That belongs on the
 * page — it is how the research declared what it set out to test, before it
 * knew the answer — but not in the lede, where it reads as the site talking
 * to itself. So the lede takes the question and the body takes the rest.
 */
function splitQuestion(question: string): { lead: string; framing: string } {
  const end = question.indexOf('?');
  if (end === -1) return { lead: question, framing: '' };
  return {
    lead: question.slice(0, end + 1).trim(),
    framing: question.slice(end + 1).trim(),
  };
}

/**
 * "Where this appears elsewhere": for each account in this file, the other
 * published case files that carry the same handle. Built from the index
 * rather than a stored table, so a held case drops out of the links on its
 * own and a handle rename in one packet cannot leave a stale pointer.
 */
async function crossCaseLinks(record: ResearchCase): Promise<Record<string, ElsewhereLink[]>> {
  const index = await getCaseIndex();
  const others = (
    await Promise.all(
      index.filter((entry) => entry.slug !== record.slug).map((entry) => getCase(entry.slug)),
    )
  ).filter((other): other is ResearchCase => other !== null);
  const bySlugHandles = others.map((other) => ({
    slug: other.slug,
    title: shortTitle(other.title),
    handles: new Set(
      other.roster
        .map((entity) => entity.handle?.replace(/^@/, '').toLowerCase())
        .filter((handle): handle is string => Boolean(handle)),
    ),
  }));
  const out: Record<string, ElsewhereLink[]> = {};
  for (const entity of record.roster) {
    const handle = entity.handle?.replace(/^@/, '').toLowerCase();
    if (!handle) continue;
    const links = bySlugHandles
      .filter((other) => other.handles.has(handle))
      .map(({ slug, title }) => ({ slug, title }));
    if (links.length > 0) out[entity.id] = links;
  }
  return out;
}

/** A date the reader can read, from the ISO stamp the research recorded. */
function dateLabel(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const record = await getCase(slug);
  if (!record) notFound();

  const url = `${SITE_URL}/fake-resistance/cases/${slug}`;

  /* The joins the investigation surface reads — which accounts a narrative
     names, which findings touch an account, what lag a connection carries —
     computed once here, on the server, from the delivered record. */
  const elsewhere = await crossCaseLinks(record);
  const model = buildInvestigationModel(record, { elsewhere });

  /* An analysis of an information environment, not a report of an event and
     not a fact-check of one claim — so `AnalysisNewsArticle` is the honest
     type. Individual graded claims are not wrapped as `ClaimReview` here:
     that schema asserts this desk reviewed a specific public claim, which is
     true of the reference exhibits on the section's root page and not of a
     research finding about how a network behaves. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AnalysisNewsArticle',
    headline: shortTitle(record.title),
    alternativeHeadline: record.title,
    description: splitQuestion(record.question).lead,
    url,
    dateModified: record.updatedAt,
    inLanguage: record.language,
    author: { '@type': 'Organization', name: 'Lions of Zion', url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: 'Lions of Zion', url: SITE_URL },
  };

  const { lead, framing } = splitQuestion(record.question);

  return (
    <InvestigationProvider model={model}>
      <SectionPage
        id="fake-resistance"
        accent="ember"
        surface="quiet"
        breadcrumb={[{ href: '/fake-resistance', label: 'Fake Resistance' }]}
        title={shortTitle(record.title)}
        tagline={lead}
        aside={<EntityInspector variant="rail" />}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Below the rails breakpoint this is the case navigator; above it
            the shell's own contents rail carries the same nine headings. */}
        <InvestigationSectionNav sections={SECTIONS} />

        {/* The file's face sheet: what this record is, in figures, before any
            prose — every value is the research's own bookkeeping (`caseId`,
            `updatedAt`, the counts, the publication record), not a summary
            written here. */}
        <dl className={styles.fileFacts}>
          <div className={styles.fileFact}>
            <dt>File</dt>
            <dd>{record.caseId}</dd>
          </div>
          <div className={styles.fileFact}>
            <dt>Updated</dt>
            <dd>
              <time dateTime={record.updatedAt}>{dateLabel(record.updatedAt)}</time>
            </dd>
          </div>
          {record.publication ? (
            <div className={styles.fileFact}>
              <dt>Published</dt>
              <dd>
                <time dateTime={record.publication.publishedAt}>
                  {dateLabel(record.publication.publishedAt)}
                </time>
              </dd>
            </div>
          ) : null}
          <div className={styles.fileFact}>
            <dt>Entities</dt>
            <dd>{record.counts.entities}</dd>
          </div>
          <div className={styles.fileFact}>
            <dt>Graded findings</dt>
            <dd>{record.counts.exhibits}</dd>
          </div>
          <div className={styles.fileFact}>
            <dt>Connections</dt>
            <dd>{record.counts.edges}</dd>
          </div>
          <div className={styles.fileFact}>
            <dt>Sources</dt>
            <dd>{record.counts.sources}</dd>
          </div>
        </dl>

        {/* Above the fold: the plain-language finding, three facts, and the
            update marker. Methodology and figures come later. */}
        <CaseStoryHeader record={record} model={model} />

        {/* The persistent evidence path: what the reader is following. */}
        <EvidencePath />

        <SectionBlock heading="Finding" id="finding">
          {record.framing ? (
            <>
              <p className={styles.frame}>{record.framing.frame}</p>
              {record.framing.guard ? (
                /* The boundary the research itself insisted on. It renders as
                   prominently as the frame, because a frame without its limit
                   is the thing this section documents other people doing. */
                <p className={styles.guard}>
                  <span>Where this stops</span>
                  {record.framing.guard}
                </p>
              ) : null}
            </>
          ) : null}

          {framing ? (
            /* Kept and shown rather than dropped: a hypothesis stated before
               the evidence was gathered is part of the record, and reading it
               next to what was actually found is how a reader judges whether
               the research went looking for its own answer. */
            <p className={styles.framing}>{framing}</p>
          ) : null}

          <ol className={styles.bottomLine}>
            {record.bottomLine.map((point) => (
              <li key={point.text.slice(0, 40)}>
                {/* The point and its sources are siblings, so above 1220px the
                    citation moves into the right margin beside the claim it
                    supports — `marginNote`, content.module.css. */}
                <div className={styles.pointMain}>
                  <p>
                    <ResearchText>{point.text}</ResearchText>
                  </p>
                </div>
                {point.sources.length > 0 ? (
                  <div className={styles.pointSources}>
                    <SourceList sources={point.sources} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          {/* What was looked at, beside what was concluded from it. It sits
              inside the finding rather than after it because the size and
              shape of a sample is part of reading the finding. */}
          <EvidenceStrip stats={record.stats} />
        </SectionBlock>

        {record.overturned.length > 0 ? (
          <SectionBlock heading="What changed" id="what-changed">
            <p>
              This file was published in August and rebuilt in September on a
              far larger sample. These are the readings the new data withdrew or
              narrowed — kept here, before the rest, because a desk that only
              ever adds to its conclusions is not checking them.
            </p>
            <OverturnedList rows={record.overturned} />
          </SectionBlock>
        ) : null}

        <SectionBlock heading="Who is involved" id="who">
          <p>
            The participants as parts in the story, not as a directory. Every
            account carries how well its operator is known; that grade comes
            from the research and is never raised here. Open a row for the
            account&rsquo;s profile, and follow it to light up everything in
            this file that touches it.
          </p>
          <RoleMap />
          <details className={styles.rosterFallback}>
            <summary>The full roster as a table</summary>
            <RosterTable entities={record.roster} />
          </details>
        </SectionBlock>

        <SectionBlock heading="Narratives" id="narratives">
          <p>
            The recurring frames the accounts in this file push, each as a
            lane: what the frame is, who the research names as carrying it,
            over what dates, and which graded findings document it. A frame is
            not a claim — it is the shape a claim is poured into — and sharing
            one does not make two accounts coordinated.
          </p>
          <NarrativeLanes />
        </SectionBlock>

        <SectionBlock heading="How material moved" id="flows">
          <p>
            Every recorded connection, typed by the evidence behind it. An
            observed flow, a measured reuse, a documented tie and an inferred
            coordination signal are four different claims of four different
            strengths, and they are kept as four layers rather than blended
            into one score.
          </p>
          <RelationshipFlow />
          {record.stats.synchrony.pairs.length > 0 ? (
            <div className={styles.figureBlock}>
              <h3 className={styles.figureHeading}>How fast one follows the other</h3>
              <p>
                The delay between one account posting and another following
                it, with the null model each pair was tested against and the
                sample size. This replaces a statistic an earlier version of
                this research published — &ldquo;70% same-hour
                amplification&rdquo; — which was computed against no null
                model at all.
              </p>
              <LagFigure stats={record.stats} />
            </div>
          ) : null}
        </SectionBlock>

        <SectionBlock heading="Timeline" id="timeline">
          <p>
            Two levels: the key events the research dated — account creation,
            platform actions, bursts, corrections — and, underneath, the
            activity band of posting volume against the control accounts.
            Choose a date range to focus the rest of the file on that
            interval.
          </p>
          <InvestigationTimeline
            band={
              record.stats.cadence.days.length > 0 ? (
                <CadenceFigure stats={record.stats} />
              ) : undefined
            }
          />
        </SectionBlock>

        <SectionBlock heading="Evidence" id="evidence">
          <p>
            One row per graded finding, in the researchers&rsquo; own wording
            for publication: the claim, the observations that support it, the
            observations that contradict it, the verdict and confidence they
            assigned, and the sources. Supporting and contradicting evidence
            sit side by side on purpose.
          </p>
          <EvidenceLedger />
        </SectionBlock>

        <SectionBlock heading="What cuts against it" id="counter">
          {record.contradictions.length > 0 ? (
            <>
              <p>
                Evidence that contradicts the file&rsquo;s own conclusions, or
                that the subjects put forward themselves. It is here because a
                research file that only records what supports it is not a
                research file.
              </p>
              <ul className={styles.contradictions}>
                {record.contradictions.map((item) => (
                  <li key={item.slice(0, 40)}>
                    <ResearchText>{item}</ResearchText>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              This file records no separate contradiction pass. Contradicting
              sources attached to individual findings are shown in the
              evidence ledger above; the absence of a pass is a limit of the
              file, not a sign that nothing cuts against it.
            </p>
          )}
        </SectionBlock>

        <SectionBlock heading="Unknowns and limits" id="unknowns">
          <UnknownsPanel record={record} model={model} />
        </SectionBlock>

        <SectionBlock heading="Sources" id="sources">
          <p>
            Every source this file rests on, with the date it was retrieved.
            Engagement figures and follower counts are snapshots from that
            moment and drift afterwards. How this desk grades and corrects what
            it publishes is set out in the{' '}
            <Link href="/methodology">methodology</Link>.
          </p>
          {record.withheld > 0 ? (
            /* Disclosed rather than quietly dropped. A section that documents
               other people publishing thin claims about named individuals does
               not get to hold back its own reasoning about the same thing. */
            <p className={styles.withheld}>
              {record.withheld === 1
                ? 'One finding from this research is not published here.'
                : `${record.withheld} findings from this research are not published here.`}{' '}
              Each was graded at low confidence by the researchers and would
              have tied a named living person to an allegation on thinner
              evidence than this desk publishes on. They remain in the research
              record; they are not this site&rsquo;s to assert.
            </p>
          ) : null}
          <SourceList sources={record.sources} />
        </SectionBlock>

        {/* The bottom-sheet form of the inspector, below the rails breakpoint. */}
        <EntityInspector variant="sheet" />
      </SectionPage>
    </InvestigationProvider>
  );
}
