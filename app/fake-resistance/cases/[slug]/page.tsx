import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionBlock, SectionPage } from '@/components/sections/SectionPage';
import {
  ConfidenceChip,
  EvidenceClassChip,
  KnownUnknownPanel,
  ResearchText,
  RosterTable,
  SourceList,
  TechniqueChips,
  Timeline,
  VerificationBadge,
} from '@/components/content';
import { caseParams, getCase } from '@/lib/content/fake-resistance-cases';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

type Params = { params: Promise<{ slug: string }> };

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
 * The research types its events in snake_case (`account_created`,
 * `platform_ban`). Rendered as a sentence-case label rather than shown raw —
 * an identifier on a reading surface is the site talking to itself.
 */
function eventTypeLabel(type?: string) {
  if (!type) return 'Event';
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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

  const unknowns = record.unknowns.length > 0 ? record.unknowns : record.limitations;
  const { lead, framing } = splitQuestion(record.question);

  return (
    <SectionPage
      id="fake-resistance"
      accent="ember"
      surface="quiet"
      breadcrumb={[{ href: '/fake-resistance', label: 'Fake Resistance' }]}
      title={shortTitle(record.title)}
      tagline={lead}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {record.framing ? (
        <SectionBlock heading="What this file is about">
          <p className={styles.frame}>{record.framing.frame}</p>
          {record.framing.guard ? (
            /* The boundary the research itself insisted on. It renders as
               prominently as the frame, because a frame without its limit is
               the thing this section documents other people doing. */
            <p className={styles.guard}>
              <span>Where this stops</span>
              {record.framing.guard}
            </p>
          ) : null}
        </SectionBlock>
      ) : null}

      <SectionBlock heading="What this file establishes">
        {framing ? (
          /* Kept and shown rather than dropped: a hypothesis stated before
             the evidence was gathered is part of the record, and reading it
             next to what was actually found is how a reader judges whether
             the research went looking for its own answer. */
          <p className={styles.framing}>{framing}</p>
        ) : null}

        {record.confidence ? (
          <p className={styles.confidence}>
            <ResearchText>{record.confidence}</ResearchText>
          </p>
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
      </SectionBlock>

      <SectionBlock heading="Who is in this file">
        <p>
          Every account below carries how well its operator is known. That
          grade comes from the research and is never raised here: an account
          whose operator was not identified reads as unresolved no matter how
          well documented its behaviour is.
        </p>
        <RosterTable entities={record.roster} />
      </SectionBlock>

      {record.exhibits.length > 0 ? (
        <SectionBlock heading="Graded findings">
          <p>
            Each finding is stated in the researchers&rsquo; own wording for
            publication, with the verdict, how confident they were, and the
            sources it rests on.
          </p>
          <ol className={styles.exhibits}>
            {record.exhibits.map((exhibit) => (
              <li key={exhibit.id} id={exhibit.id}>
                <div className={styles.exhibitMain}>
                  <div className={styles.exhibitHead}>
                    <VerificationBadge assessment={exhibit.verdict} />
                    {exhibit.confidence ? <ConfidenceChip value={exhibit.confidence} /> : null}
                    {exhibit.observedAt ? (
                      <time dateTime={exhibit.observedAt}>{dateLabel(exhibit.observedAt)}</time>
                    ) : null}
                  </div>
                  <p className={styles.exhibitStatement}>{exhibit.statement}</p>
                  <TechniqueChips ids={exhibit.techniques} />
                </div>
                {exhibit.sources.length > 0 ? (
                  <div className={styles.exhibitSources}>
                    <SourceList sources={exhibit.sources} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </SectionBlock>
      ) : null}

      {record.narratives.length > 0 ? (
        <SectionBlock heading="The frames being pushed">
          <p>
            What the accounts in this file are actually arguing, as recurring
            frames rather than individual posts. A frame is not a claim — it is
            the shape a claim is poured into, which is why the same one
            survives being repeatedly falsified.
          </p>
          <div className={styles.narratives}>
            {record.narratives.map((narrative) => (
              <article key={narrative.id} className={styles.narrative}>
                <h3>{narrative.title}</h3>
                {narrative.summary ? <p>{narrative.summary}</p> : null}
                {narrative.frame ? (
                  <p className={styles.narrativeFrame}>
                    <span>The move</span> {narrative.frame}
                  </p>
                ) : null}
                {narrative.audience ? (
                  <p className={styles.narrativeAudience}>
                    <span>Aimed at</span> {narrative.audience}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {record.chronology.length > 0 ? (
        <SectionBlock heading="Chronology">
          <Timeline
            variant="history"
            entries={record.chronology.map((event) => ({
              id: event.id,
              datetime: event.occurredAt ?? '',
              dateLabel: dateLabel(event.occurredAt),
              // The typed event is the headline and the researchers' sentence
              // is the record, which is the shape the timeline was built for.
              title: eventTypeLabel(event.type),
              body: event.description,
            }))}
          />
        </SectionBlock>
      ) : null}

      {record.edges.length > 0 ? (
        <SectionBlock heading="Connections">
          <p>
            Each connection carries the kind of evidence behind it:{' '}
            <strong>documented</strong> means stated on the record,{' '}
            <strong>observed</strong> means seen happening in public posts, and{' '}
            <strong>inferred</strong> means a pattern consistent with
            coordination that was not established.
          </p>
          <ul className={styles.edges}>
            {record.edges.map((edge) => (
              <li key={edge.id}>
                <div className={styles.edgeHead}>
                  <span className={styles.edgePair}>
                    {edge.from} <span aria-hidden="true">→</span> {edge.to}
                  </span>
                  <EvidenceClassChip value={edge.evidenceClass} />
                  {edge.confidence ? <ConfidenceChip value={edge.confidence} /> : null}
                </div>
                <p>{edge.statement}</p>
              </li>
            ))}
          </ul>
        </SectionBlock>
      ) : null}

      {record.contradictions.length > 0 ? (
        <SectionBlock heading="What cuts against this">
          <p>
            Evidence that contradicts the file&rsquo;s own conclusions, or
            that the subjects put forward themselves. It is here because a
            research file that only records what supports it is not a research
            file.
          </p>
          <ul className={styles.contradictions}>
            {record.contradictions.map((item) => (
              <li key={item.slice(0, 40)}>
                <ResearchText>{item}</ResearchText>
              </li>
            ))}
          </ul>
        </SectionBlock>
      ) : null}

      {unknowns.length > 0 ? (
        <SectionBlock heading="What is not established">
          <KnownUnknownPanel unknowns={unknowns} wouldChange={record.wouldChange} />
        </SectionBlock>
      ) : null}

      {record.limitations.length > 0 && record.unknowns.length > 0 ? (
        <SectionBlock heading="How this was gathered">
          {record.limitations.map((limitation) => (
            <p key={limitation.slice(0, 40)}>
              <ResearchText>{limitation}</ResearchText>
            </p>
          ))}
        </SectionBlock>
      ) : null}

      <SectionBlock heading="Sources">
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
    </SectionPage>
  );
}
