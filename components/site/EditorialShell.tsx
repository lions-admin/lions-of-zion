import type { ReactNode } from "react";
import { ReadingProgress } from "@/components/sections/ReadingProgress";
import { ScanBackdrop } from "@/components/sections/ScanBackdrop";
import { resolveSiteSectionId } from "@/lib/site-navigation";
import { routeFamily } from "./route-family";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./editorial-shell.module.css";

interface EditorialShellProps {
  routeId: string;
  backdropSeed?: string;
  register?: "default" | "muted";
  showProgress?: boolean;
  className: string;
  /**
   * Escape hatch, and the last caller of it is `app/account`. The shell styles
   * its own skip link (CLEAN-002); passing a class replaces that styling
   * wholesale rather than adding to it, so a caller that passes one owns the
   * whole control including its coarse target floor and its focus transform.
   */
  skipLinkClassName?: string;
  /** Deltas over `ReadingProgress`'s own bar, not replacements for it — see
   *  the note in `reading-progress.module.css`. Both optional; most routes
   *  want the bar exactly as the primitive draws it. */
  progressTrackClassName?: string;
  progressValueClassName?: string;
  children: ReactNode;
}

/**
 * What the reader is told, in the order the machine says it.
 *
 * `/information-war` keeps its own id: `resolveSiteSectionId` folds it onto
 * `geopolitical-brief`, which is right for the scan backdrop and wrong for the
 * chrome — it would light up a bar link for a page the reader is not on.
 *
 * The `?? routeId` fallback is what lets `/methodology` and `/corrections`
 * mark themselves current. They are not in `SITE_NAVIGATION`, so
 * `resolveSiteSectionId` returns `undefined` for them and every reference link
 * in the header and footer used to render unmarked.
 */
function activeChromeSection(routeId: string): string {
  if (routeId === "information-war") return routeId;
  return resolveSiteSectionId(routeId) ?? routeId;
}

/**
 * The shell every reading route wears: skip link, masthead, the document, the
 * colophon.
 *
 * Three structural notes, each of them a fix rather than a preference.
 *
 * **The header and the footer are siblings of `<main>`, not children of it.**
 * `<header>` maps to the `banner` landmark and `<footer>` to `contentinfo`
 * only when neither is inside `main`/`article`/`section`. The masthead used to
 * render inside `<main>`, so the site had no banner landmark on any route and
 * its primary navigation was announced as part of the article.
 *
 * **The skip link stays first in the DOM**, ahead of the masthead, so it is
 * still the first thing a keyboard reaches. `.skipHost` exists only to give it
 * a stacking context above `--z-header`: the link is `position: fixed` at the
 * top-left corner, which is now under a full-bleed bar rather than beside a
 * centred pill, and at a lower z-index it would have opened behind it. The
 * link's own styling is this module's, not the page's — there were five
 * copies of it before CLEAN-002.
 *
 * **The footer is mounted here rather than in `app/layout.tsx`.** The root
 * layout wraps `/`, `/admin`, `/particle-demo` and `/pipeline` as well, and the
 * home scene owns exactly one viewport — see the 2026-09-02 entry in
 * `.ai/DECISIONS.md`.
 */
export function EditorialShell({
  routeId,
  backdropSeed,
  register = "default",
  showProgress = true,
  className,
  skipLinkClassName,
  progressTrackClassName,
  progressValueClassName,
  children,
}: EditorialShellProps) {
  const activeSection = activeChromeSection(routeId);
  const family = routeFamily(routeId);

  return (
    <>
      <div className={styles.skipHost}>
        <a href="#page-content" className={skipLinkClassName ?? styles.skipLink}>
          Skip to content
        </a>
      </div>
      <SiteHeader activeSection={activeSection} />
      <main className={className} data-reading-scroll data-public-shell data-family={family}>
        <p className={styles.familyContext}>{family === "desk" ? "Desk" : family === "institution" ? "Institution" : "Dossier"}</p>
        {showProgress ? (
          <ReadingProgress
            trackClassName={progressTrackClassName}
            valueClassName={progressValueClassName}
          />
        ) : null}
        <ScanBackdrop routeId={routeId} seed={backdropSeed} register={register} />
        {children}
      </main>
      <SiteFooter activeSection={activeSection} />
    </>
  );
}
