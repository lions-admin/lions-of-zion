/**
 * Pages that live outside the 8-file orbit (`/methodology`, `/corrections`).
 *
 * Same shell as `SectionPage` — identity band, centred measure, short footer —
 * minus the file numbering, since these two have no `defaultNodes` entry.
 * They were a visibly third layout variant before Phase 2 (their back-link
 * floated disconnected above a panel); the three variants are one system now.
 * They still close with the eight-file index for discoverability, without
 * joining the radial nav itself (see `.ai/DECISIONS.md`).
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
      <div className={styles.shell}>
        <div className={styles.identityBand}>
          <Link href="/" className={styles.wordmark}>
            Lions of Zion
          </Link>
          <span className={styles.identityMeta}>
            <span className={styles.identitySep} aria-hidden="true">
              ·
            </span>
            <span className={styles.identityRoute}>/{routeId}</span>
          </span>
          <Link href="/" className={styles.identityExit}>
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
            <div className={styles.footerRow}>
              <nav aria-label="All files">
                <ul className={styles.indexRow}>
                  {defaultNodes.map((entry, i) => (
                    <li key={entry.id}>
                      <Link
                        href={entry.href}
                        className={styles.indexNum}
                        aria-label={entry.label}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <nav className={styles.docLinks} aria-label="Policy pages">
                <Link href="/methodology">Methodology</Link>
                <span aria-hidden="true">·</span>
                <Link href="/corrections">Corrections</Link>
              </nav>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
