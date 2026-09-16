"use client";

import { useEffect } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import { publicationHubCrumb } from "@/lib/publication-routing";
import styles from "./article.module.css";

/**
 * Database / render failure for a publication record.
 *
 * Must be a Client Component so `reset` can re-render the segment
 * (Next.js `error.tsx` convention). Distinct from `not-found.tsx`: that
 * page is a missing publicId; this one is a record the desk could not read.
 *
 * The way out derives its label from `publicationHubCrumb`, as the 404 does:
 * until 2026-09-16 this boundary still called the desk "Daily Brief", a
 * section retired on 2026-09-05 — on the one page a reader meets only when
 * something has already gone wrong.
 */
const DESK = publicationHubCrumb("news");
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
            <ButtonLink href={DESK.href} variant="ghost" size="md">
              {DESK.label}
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
