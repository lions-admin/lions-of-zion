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
  /**
   * BCP 47 tag for the title, when it is not in the page's language — an
   * archive record translated into Portuguese, say.
   *
   * Deliberately on the `<h1>` alone rather than on the `<main>`: this shell
   * also carries untranslated English chrome (the skip link, the wordmark,
   * "← Back to the scan", the tagline, and the record's own metadata and
   * provenance footer), so declaring the whole region foreign would trade one
   * WCAG 3.1.1 failure for a 3.1.2 one.
   */
  titleLang?: string;
  /**
   * Ancestors of this page, nearest root first, rendered in the identity band.
   *
   * The band's `/{routeId}` is an inert `<span>`, and the only other exits are
   * two links to `/`. On a policy page that is fine — those link to each other
   * from their own prose. On an archive record it is not: the prose is a
   * witness account that links to nothing, so moving to the next testimony
   * costs a full round trip through the particle scene.
   */
  breadcrumb?: { href: string; label: string }[];
  children: React.ReactNode;
}

export function DocPage({
  routeId,
  title,
  tagline,
  titleLang,
  breadcrumb,
  children,
}: DocPageProps) {
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
            {breadcrumb?.length ? (
              <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                {breadcrumb.map((crumb) => (
                  <span key={crumb.href}>
                    <Link href={crumb.href}>{crumb.label}</Link>
                    <span aria-hidden="true"> / </span>
                  </span>
                ))}
              </nav>
            ) : (
              <span className={styles.identityRoute}>/{routeId}</span>
            )}
          </span>
          <Link href="/" className={styles.identityExit}>
            ← Back to the scan
          </Link>
        </div>

        <article className={styles.panel} id="page-content">
          <header>
            <h1 className={styles.title} lang={titleLang}>
              {title}
            </h1>
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
