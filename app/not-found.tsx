/**
 * 404 — a route the record does not hold.
 *
 * Speaks in the site's editorial register: a display headline, one honest
 * sentence, the way back, a search, and the index of what does exist. The
 * destinations come straight from the shared navigation model so this page
 * can never drift from the header and footer.
 */
import Link from 'next/link';
import { SECTION_LINKS, REFERENCE_LINKS } from '@/components/site/navigation-model';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page} id="page-content" tabIndex={-1}>
        <div className={styles.shell}>
          <header className={styles.notice}>
            <p className={styles.code}>
              <span>404</span>
              <span aria-hidden="true">·</span>
              <span>No record at this address</span>
            </p>
            <h1 className={styles.title}>This page is not on file.</h1>
            <p className={styles.lede}>
              The address may have been moved or renamed, or it never existed.
              Everything the desk has published is still here and still
              searchable.
            </p>
            <div className={styles.actions}>
              <ButtonLink href="/" variant="primary" size="md">
                Back to the front
              </ButtonLink>
              <ButtonLink
                href="/search"
                variant="secondary"
                size="md"
                leftIcon={<Icon name="search" size={15} strokeWidth={1.6} />}
              >
                Search the record
              </ButtonLink>
            </div>
          </header>

          <nav className={styles.index} aria-label="Where to go instead">
            <p className={styles.indexHeading}>Where to go instead</p>
            <ul className={styles.list}>
              {SECTION_LINKS.map((node) => (
                <li key={node.href}>
                  <Link href={node.href} className={styles.entry}>
                    <span className={styles.entryLabel}>{node.label}</span>
                    <span className={styles.entryDescription}>{node.description}</span>
                    <span className={styles.entryArrow} aria-hidden="true">↗︎</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className={styles.reference}>
              {REFERENCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.referenceLink}>{link.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/updates" className={styles.referenceLink}>Every publication</Link>
              </li>
            </ul>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
