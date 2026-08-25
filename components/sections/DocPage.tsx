/**
 * Lighter shell for pages that live outside the 8-file orbit (`/methodology`,
 * `/corrections`). Reuses `SectionPage`'s visual language — panel, block
 * headings, the scan backdrop — but has no `defaultNodes` entry to look up,
 * so it carries no file rail, no prev/next, no "File NN / 08" chrome. It
 * still ends with the all-8-destinations index for discoverability, without
 * adding these two pages to the radial nav itself (see `.ai/DECISIONS.md`).
 */
import Link from 'next/link';
import { defaultNodes } from '@/components/particle-nav/config';
import { ScanBackdrop } from './ScanBackdrop';
import styles from './sections.module.css';

export interface DocPageProps {
  /** Seeds the backdrop's corpus sample and doubles as this page's identity. */
  routeId: string;
  title: string;
  tagline: string;
  children: React.ReactNode;
}

export function DocPage({ routeId, title, tagline, children }: DocPageProps) {
  const pageClass = [styles.page, styles.surfaceQuiet].join(' ');

  return (
    <main className={pageClass}>
      <a href="#page-content" className={styles.skipLink}>
        Skip to content
      </a>
      <ScanBackdrop routeId={routeId} register="muted" />
      <div className={styles.docShell}>
        <div className={styles.docTopNav}>
          <Link href="/" className={styles.back}>
            ← Back to the scan
          </Link>
        </div>

        <article className={styles.panel} id="page-content">
          <header>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{tagline}</p>
            <div className={styles.ledeRule} aria-hidden="true" />
          </header>
          <div className={styles.body}>{children}</div>

          <footer className={styles.fileFooter}>
            <div className={styles.footerRule} aria-hidden="true" />
            <nav className={styles.destinations} aria-label="All files">
              <span className={styles.destinationsKicker}>
                Index · {String(defaultNodes.length).padStart(2, '0')} files
              </span>
              <ul className={styles.destinationsList}>
                {defaultNodes.map((entry, i) => (
                  <li key={entry.id}>
                    <Link href={entry.href} className={styles.destination}>
                      <span className={styles.destinationIndex} aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className={styles.closeLine}>
              <Link href="/">← Back to the scan</Link>
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}
