import Image from 'next/image';
import Link from 'next/link';
import briefIcon from '@/assets/source/icons/geopolitical-brief.svg';
import { geopoliticalReferenceBrief as brief } from './geopolitical-reference';
import { ReadingProgress } from './ReadingProgress';
import styles from './geopolitical-brief.module.css';

function Status({ value }: { value: string }) {
  return (
    <span className={styles.status} data-status={value.toLowerCase()}>
      <i aria-hidden="true" />
      {value}
    </span>
  );
}

export function GeopoliticalBrief() {
  const sourceMap = new Map(brief.sources.map((source) => [source.id, source]));
  const corrections: readonly { version: string; date: string; note: string }[] = brief.corrections;

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
        <ReadingProgress />
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
              <Status value={brief.status} />
            </div>
            <p className={styles.topic}>{brief.title}</p>
            <h1>{brief.headline}</h1>
            <p className={styles.dek}>{brief.dek}</p>

            <dl className={styles.publicationMeta}>
              <div>
                <dt>Published</dt>
                <dd>{brief.publishedAt}</dd>
              </div>
              <div>
                <dt>Coverage window</dt>
                <dd>{brief.coverageWindow}</dd>
              </div>
              <div>
                <dt>Source stack</dt>
                <dd>{brief.sourceCount} official records</dd>
              </div>
            </dl>
          </header>

          <section id="snapshot" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>01</span>
              <h2>Executive snapshot</h2>
            </div>
            <div className={styles.summary}>
              {brief.summary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <dl className={styles.figures}>
              {brief.figures.map((figure) => (
                <div key={figure.label}>
                  <dt>{figure.value}</dt>
                  <dd>{figure.label}</dd>
                </div>
              ))}
            </dl>
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
            <div className={styles.developmentList}>
              {brief.developments.map((development) => (
                <article key={development.title} className={styles.development}>
                  <div className={styles.developmentMeta}>
                    <time>{development.date}</time>
                    <Status value={development.status} />
                  </div>
                  <h3>{development.title}</h3>
                  <p>{development.body}</p>
                  <div className={styles.inlineSources} aria-label="Sources for this development">
                    {development.sourceIds.map((sourceId) => {
                      const source = sourceMap.get(sourceId);
                      if (!source) return null;
                      return (
                        <a key={sourceId} href={source.url} target="_blank" rel="noreferrer">
                          {source.publisher} <span aria-hidden="true">↗</span>
                        </a>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
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
            <div className={styles.unknownGrid}>
              <div>
                <h3>Not established by this record</h3>
                <ul>
                  {brief.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}
                </ul>
              </div>
              <div>
                <h3>What would change the assessment</h3>
                <ul>
                  {brief.changeConditions.map((condition) => <li key={condition}>{condition}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section id="sources" className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>06</span>
              <h2>Source stack</h2>
            </div>
            <ol className={styles.sourceList}>
              {brief.sources.map((source, index) => (
                <li key={source.id}>
                  <span className={styles.sourceNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <span>{source.publisher} · {source.type}</span>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} <span aria-hidden="true">↗</span>
                    </a>
                    <time>{source.published}</time>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <footer className={styles.corrections}>
            <div>
              <span>Correction history</span>
              <strong>{corrections.length > 0 ? `${corrections.length} recorded` : 'None recorded'}</strong>
            </div>
            {corrections.length > 0 ? (
              <ol className={styles.correctionEntries}>
                {corrections.map((correction) => (
                  <li key={`${correction.version}-${correction.date}`}>
                    <strong>{correction.version} · {correction.date}</strong>
                    <p>{correction.note}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No corrections recorded for this edition.</p>
            )}
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
              <div><dt>Status</dt><dd><Status value={brief.status} /></dd></div>
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
