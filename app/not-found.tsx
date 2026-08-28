/**
 * 404 — a route the scan does not index.
 *
 * Speaks in the signal-room voice of the section pages and re-offers the
 * whole nav contract: the eight destinations come straight from
 * `defaultNodes`, so this index can never drift from the orbit.
 */
import Link from 'next/link';
import { SITE_NAVIGATION } from '@/lib/site-navigation';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.shell}>
        <header>
          <p className={styles.code}>404 · Signal lost</p>
          <h1 className={styles.title}>File not found</h1>
          <p className={styles.lede}>
            The scan holds no file at this address. The record may have been
            moved, renamed, or it never existed. The network itself is intact.
          </p>
          <div className={styles.rule} aria-hidden="true" />
          <Link href="/" className={styles.back}>
            ← Back to the scan
          </Link>
        </header>

        <nav className={styles.index} aria-label="All destinations">
          <p className={styles.indexHeading}>Open files · monitoring active</p>
          <ul className={styles.list}>
            {SITE_NAVIGATION.map((node, index) => (
              <li key={node.id}>
                <Link href={node.href} className={styles.entry}>
                  <span className={styles.entryIndex}>
                    File {String(index + 1).padStart(2, '0')} /{' '}
                    {String(SITE_NAVIGATION.length).padStart(2, '0')}
                  </span>
                  <span className={styles.entryLabel}>{node.displayName}</span>
                  <span className={styles.entryDescription}>{node.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
