"use client";

import { useEffect } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import styles from "./article.module.css";

/**
 * Database / render failure for a publication record.
 *
 * Must be a Client Component so `reset` can re-render the segment
 * (Next.js `error.tsx` convention). Distinct from `not-found.tsx`: that
 * page is a missing publicId; this one is a record the desk could not read.
 */
export default function ArticleError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  /* Next 16.3 prefers `retry` (re-fetch then re-render) for a temporary
     database miss. `reset` only re-renders the already-failed tree. */
  const recover = retry ?? reset;

  return (
    <>
      <SiteHeader />
      <main
        className={styles.page}
        data-reading-scroll
        data-public-shell
        data-family="dossier"
      >
        <div className={styles.recovery} id="page-content">
          <StatusState
            status="error"
            eyebrow="SERVICE STATUS"
            title="This record could not be read"
            description="The published article is intact. The desk could not reach the database just now. This is a service failure, not a missing record."
            actionText="Try again"
            onAction={() => recover()}
          />
          <nav className={styles.recoveryNav} aria-label="Recovery">
            <ButtonLink href="/geopolitical-brief" variant="ghost" size="md">
              Daily Brief
            </ButtonLink>
            <ButtonLink href="/search" variant="text" size="md">
              Search
            </ButtonLink>
          </nav>
          {error.digest ? <p className={styles.recoveryRef}>Ref {error.digest}</p> : null}
        </div>
      </main>
    </>
  );
}
