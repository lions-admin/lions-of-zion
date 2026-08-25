import Image from 'next/image';
import Link from 'next/link';
import briefIcon from '@/assets/source/icons/geopolitical-brief.svg';
import type { AssessmentValue } from '@/server/contracts/enums';
import {
  CorrectionHistory,
  FigureRow,
  KnownUnknownPanel,
  PublicationMeta,
  SourceList,
  Timeline,
  VerificationBadge,
  type Source,
  type TimelineEntry,
} from '@/components/content';
import {
  geopoliticalReferenceBrief as brief,
  type BriefSource,
  type BriefStatus,
} from './geopolitical-reference';
import { ReadingProgress } from '@/components/sections/ReadingProgress';
import styles from './geopolitical-brief.module.css';

/**
 * `BriefStatus` (this page's own authoring vocabulary) has no 1:1 mapping
 * onto the real 9-value `AssessmentValue` (`server/contracts/enums.ts`) —
 * that enum is the shared source of truth for both the Zod schema and the
 * Postgres enum type, so it is not the thing to extend. Mapped here to the
 * closest real meaning. `Attributed` and `Corrected` are the genuinely
 * imprecise cases:
 *   - `Attributed` rests on one named official's public statement, not
 *     independently cross-checked — closer to "not yet independently
 *     assessed" than any other real value, though it understates that this
 *     is already a real, published record.
 *   - `Corrected` describes a workflow event (this item was wrong and has
 *     been fixed), not a verdict. The live status after a correction is
 *     whatever the corrected verdict now is; the correction itself belongs
 *     in `CorrectionHistory`, not here — `verified` is the reasonable
 *     default for "corrected and now considered right."
 */
const STATUS_TO_ASSESSMENT: Record<BriefStatus, AssessmentValue> = {
  Confirmed: 'verified',
  Attributed: 'unverified',
  Unverified: 'unverified',
  Disputed: 'contested',
  Corrected: 'verified',
};

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** Brief dates are authored as "07 Jan 2026" — converts to an ISO date for
 *  the <time dateTime> attribute Timeline entries expect. */
function toIsoDate(display: string): string {
  const [day, month, year] = display.split(' ');
  return `${year}-${MONTHS[month] ?? '01'}-${(day ?? '01').padStart(2, '0')}`;
}

/** `publishedAt` is authored as "24 Aug 2026 · 14:00 IDT" — only the date
 *  portion is needed for staleness, so the time/zone half is dropped. */
function toIsoDateOnly(publishedAt: string): string {
  return toIsoDate(publishedAt.split('·')[0].trim());
}

const STALE_AFTER_DAYS = 14;

/**
 * Evaluated at render time — for a statically-generated route that means
 * "as of the last build," not "as of this exact request." That's an
 * acceptable approximation for a two-week threshold; it is not the thing to
 * "fix" by forcing this route dynamic just for a staleness banner.
 */
function isBriefStale(publishedAt: string): boolean {
  const publishedMs = new Date(toIsoDateOnly(publishedAt)).getTime();
  if (Number.isNaN(publishedMs)) return false;
  const ageDays = (Date.now() - publishedMs) / (24 * 60 * 60 * 1000);
  return ageDays > STALE_AFTER_DAYS;
}

/** `BriefSource` (id, publisher, title, published, type, url) doesn't line
 *  up exactly with the shared `Source` shape — `published` has no exact
 *  home (`accessedAt` means "when we last checked it", not "when it was
 *  published"), but it's the only slot for a date and keeps the
 *  information visible rather than silently dropping it. */
function toSource(source: BriefSource): Source {
  return {
    id: source.id,
    label: source.title,
    kind: `${source.publisher} · ${source.type}`,
    url: source.url,
    accessedAt: source.published,
  };
}

export function GeopoliticalBrief() {
  const sourceMap = new Map(brief.sources.map((source) => [source.id, source]));
  const corrections: readonly { version: string; date: string; note: string }[] = brief.corrections;
  const stale = isBriefStale(brief.publishedAt);

  const developmentEntries: TimelineEntry[] = brief.developments.map((development, index) => ({
    id: `development-${index}`,
    datetime: toIsoDate(development.date),
    dateLabel: development.date,
    title: development.title,
    body: development.body,
    assessment: STATUS_TO_ASSESSMENT[development.status],
    sources: development.sourceIds
      .map((sourceId) => sourceMap.get(sourceId))
      .filter((source): source is BriefSource => Boolean(source))
      .map(toSource),
  }));

  return (
    <main className={styles.page} data-reading-scroll>
      <span id="brief-top" aria-hidden="true" />
      <a href="#brief-content" className={styles.skipLink}>Skip to brief</a>
      <div className={styles.quietBackdrop} aria-hidden="true" />

      <header className={styles.siteHeader}>
        <Link href="/" className={styles.backLink} aria-label="Back to the scan">
          <span aria-hidden="true">←</span>
          <span>Back to the scan</span>
        </Link>
        <Link href="/" className={styles.wordmark}>Lions of Zion</Link>
        <div className={styles.headerContext}>
          <span>Geopolitical Brief</span>
          <small>{brief.edition}</small>
        </div>
        <ReadingProgress trackClassName={styles.progressTrack} valueClassName={styles.progressValue} />
      </header>

      <div className={styles.layout}>
        <aside className={styles.indexRail} aria-label="Brief navigation">
          <div className={styles.indexRailInner}>
            <div className={styles.railIdentity}>
              <span className={styles.iconFrame} aria-hidden="true">
                <Image src={briefIcon} alt="" />
              </span>
              <div>
                <span>Desk 01</span>
                <strong>Strategic picture</strong>
              </div>
            </div>

            <nav className={styles.contents} aria-label="On this page">
              <span>In this brief</span>
              <ol>
                <li><a href="#snapshot">Snapshot</a></li>
                <li><a href="#changes">What changed</a></li>
                <li><a href="#developments">Developments</a></li>
                <li><a href="#assessment">Assessment</a></li>
                <li><a href="#unknowns">Known unknowns</a></li>
                <li><a href="#sources">Sources</a></li>
              </ol>
            </nav>

            <div className={styles.railTrust}>
              <span>Coverage</span>
              <strong>{brief.coverageWindow}</strong>
              <span>Reviewed by</span>
              <strong>{brief.reviewedBy}</strong>
            </div>
          </div>
        </aside>

        <article className={styles.article} id="brief-content">
          <header className={styles.briefHeader}>
            <div className={styles.briefEyebrow}>
              <span>{brief.edition}</span>
              <VerificationBadge assessment={STATUS_TO_ASSESSMENT[brief.status]} />
            </div>
            <p className={styles.topic}>{brief.title}</p>
            <h1>{brief.headline}</h1>
            <p className={styles.dek}>{brief.dek}</p>

            <div className={styles.metaSpacer}>
              <PublicationMeta
                publishedAt={brief.publishedAt}
                coverageWindow={brief.coverageWindow}
                sourceCount={brief.sourceCount}
              />
            </div>
            {stale ? (
              <p className={styles.staleNotice} role="note">
                This edition is more than {STALE_AFTER_DAYS} days old —
                check for a newer one before treating it as current.
              </p>
            ) : null}
          </header>

          <section id="snapshot" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>01</span>
              <h2>Executive snapshot</h2>
            </div>
            <div className={styles.summary}>
              {brief.summary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <div className={styles.figuresSpacer}>
              <FigureRow figures={[...brief.figures]} />
            </div>
          </section>

          <section id="changes" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>02</span>
              <h2>What changed</h2>
            </div>
            <ol className={styles.changeList}>
              {brief.changes.map((change, index) => (
                <li key={change}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{change}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="developments" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>03</span>
              <h2>Verified developments</h2>
            </div>
            {developmentEntries.length > 0 ? (
              <Timeline variant="feed" entries={developmentEntries} />
            ) : (
              <p className={styles.sectionEmpty}>
                No developments recorded for this edition.
              </p>
            )}
          </section>

          <section id="assessment" className={`${styles.section} ${styles.assessment}`}>
            <div className={styles.sectionLabel}>
              <span>04</span>
              <h2>Assessment</h2>
            </div>
            <p className={styles.assessmentNotice}>Inference from the official record—not a reported event.</p>
            <p>{brief.assessment}</p>
          </section>

          <section id="unknowns" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>05</span>
              <h2>Known unknowns</h2>
            </div>
            <KnownUnknownPanel unknowns={[...brief.unknowns]} wouldChange={[...brief.changeConditions]} />
          </section>

          <section id="sources" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>06</span>
              <h2>Source stack</h2>
            </div>
            {brief.sources.length > 0 ? (
              <SourceList sources={brief.sources.map(toSource)} />
            ) : (
              <p className={styles.sectionEmpty}>
                No sources recorded for this edition.
              </p>
            )}
          </section>

          <footer className={styles.corrections}>
            <CorrectionHistory corrections={[...corrections]} />
          </footer>

          <div className={styles.closing}>
            <span className={styles.closingMark}>End of brief — Reference 001</span>
            <nav className={styles.closingNav} aria-label="Leave the brief">
              <Link href="/">
                <span aria-hidden="true">←</span> Return to the scan
              </Link>
              <Link href="/war-update">
                Next desk · War Update <span aria-hidden="true">→</span>
              </Link>
              <a href="#brief-top">
                Back to top <span aria-hidden="true">↑</span>
              </a>
            </nav>
            <nav className={styles.docLinks} aria-label="Policy pages">
              <Link href="/methodology">Methodology</Link>
              <span aria-hidden="true">·</span>
              <Link href="/corrections">Corrections</Link>
            </nav>
          </div>
        </article>

        <aside className={styles.evidenceRail} aria-label="Evidence summary">
          <div className={styles.evidenceRailInner}>
            <span className={styles.evidenceKicker}>Evidence contract</span>
            <dl>
              <div><dt>Status</dt><dd><VerificationBadge assessment={STATUS_TO_ASSESSMENT[brief.status]} /></dd></div>
              <div><dt>Primary records</dt><dd>{brief.sourceCount}</dd></div>
              <div><dt>Last reviewed</dt><dd>{brief.publishedAt}</dd></div>
              <div><dt>Corrections</dt><dd>{corrections.length > 0 ? `${corrections.length} recorded` : 'None recorded'}</dd></div>
            </dl>
            <p>Reporting and assessment are separated. Each development carries its own source links.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
