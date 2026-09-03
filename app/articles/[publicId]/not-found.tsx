import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./article.module.css";

/**
 * Missing publication — a publicId that is not in the published file.
 *
 * Distinct from the site-wide 404 (no such route) and from `error.tsx`
 * (the desk could not read the record). Recovery is back to the Daily Brief
 * or Search, not the full destination index.
 */
export default function ArticleNotFound() {
  return (
    <EditorialShell
      routeId="articles"
      register="muted"
      showProgress={false}
      className={styles.page}
      skipLinkClassName={styles.skipLink}
      progressTrackClassName={styles.progressTrack}
      progressValueClassName={styles.progressValue}
    >
      <article className={styles.article} id="page-content">
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/geopolitical-brief">Daily Brief</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent}>Record not found</span>
        </nav>
        <header className={styles.head}>
          <p className={styles.kicker}>Missing record</p>
          <h1>No published article at this address</h1>
          <p className={styles.summary}>
            Nothing in the public file matches this identifier. The record may
            have been withdrawn, not yet published, or the address is wrong.
            This is not a database failure.
          </p>
        </header>
        <nav className={styles.recoveryNav} aria-label="Find a published record">
          <ButtonLink href="/geopolitical-brief" variant="secondary" size="md">
            Daily Brief
          </ButtonLink>
          <ButtonLink href="/search" variant="ghost" size="md">
            Search
          </ButtonLink>
        </nav>
      </article>
    </EditorialShell>
  );
}
