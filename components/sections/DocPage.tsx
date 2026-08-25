/**
 * Pages that live outside the 8-file orbit (`/methodology`, `/corrections`).
 *
 * Same shell as `SectionPage` — identity band, centred measure — minus the
 * file numbering, since these two have no `defaultNodes` entry. They were a
 * visibly third layout variant before Phase 2 (their back-link floated
 * disconnected above a panel); the variants are one system now.
 *
 * They also take no rails: these are short policy pages, not documents with
 * sections to navigate or records to cite, so there is nothing for a margin
 * to carry. Omitting `withRails` is what keeps the scan reaching in as far as
 * it did — see the note on that class in sections.module.css.
 *
 * They are linked from the prose of the pages that mean them and from the
 * scan, and do not join the radial nav itself (see `.ai/DECISIONS.md`).
 */
import Link from 'next/link';
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
          {/* No closing apparatus — same reasoning as `SectionPage`. These
              two pages already link to each other from their own prose. */}
        </article>
      </div>
    </main>
  );
}
