import type { ReactNode } from "react";
import { ViewTransition } from "@/components/motion";
import { ReadingProgress } from "@/components/sections/ReadingProgress";
import { resolveActiveChromeSection } from "@/lib/site-navigation";
import { routeFamily } from "./route-family";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./editorial-shell.module.css";

interface EditorialShellProps {
  routeId: string;
  showProgress?: boolean;
  className: string;
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
 * This used to carry its own `if (routeId === "information-war") return routeId;`
 * because `resolveSiteSectionId` folded that route onto `geopolitical-brief`
 * and would otherwise have lit a bar link for a page the reader is not on.
 * VA-15 removed the fold at the source, so the special case here became a
 * second copy of one rule — and a second copy is how the two drift apart. The
 * rule now lives once, in `lib/site-navigation.ts`.
 */
const activeChromeSection = resolveActiveChromeSection;

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
 * **The skip link is the masthead's first child** (2026-09-15), so it is
 * still the first thing a keyboard reaches and every route that mounts the
 * header — the error boundary, the 404 and the cover included — ships the
 * same one with the same target. It was this shell's until then, which left
 * those three routes with none or with a divergent copy.
 *
 * **The footer is mounted here rather than in `app/layout.tsx`.** The root
 * layout wraps `/`, `/admin` and `/pipeline` as well, and the home scene owns
 * exactly one viewport — see the 2026-09-02 entry in `.ai/DECISIONS.md`.
 * (`/particle-demo` was a fourth until the particle subsystem was retired on
 * 2026-09-05.)
 */
export function EditorialShell({
  routeId,
  showProgress = true,
  className,
  progressTrackClassName,
  progressValueClassName,
  children,
}: EditorialShellProps) {
  const activeSection = activeChromeSection(routeId);
  const family = routeFamily(routeId);
  /* October 7 is the quiet exception by contract: the same crossfade, and
     nothing that travels. `routeFamily` already knows the route; the class
     names are read by `::view-transition-*` in `app/globals.css`. */
  const transition = routeId.startsWith("october-7") ? "page-quiet" : "page";

  return (
    <>
      <SiteHeader activeSection={activeSection} />
      {/* `data-family` drives density and measure from `app/globals.css`. It
          stays; the paragraph that used to print its value above every
          heading does not. "Desk" / "Dossier" / "Institution" is this
          system's own vocabulary for how densely a route is set — it tells a
          reader nothing, and it read as a label belonging to the content
          under it. (It drove scan strength too until the ambient backdrop was
          retired on 2026-09-14.) */}
      {/* The document is what transitions; the masthead above it and the
          colophon below it are siblings, so neither is inside the named
          group. `default="none"` keeps this wrapper out of every unrelated
          transition on the page — without it a shared-element morph would
          drag the whole document through its own crossfade. The wrapper
          lives here rather than in `app/layout.tsx` because a layout
          persists across a navigation, and a persisting element never fires
          enter or exit. */}
      <ViewTransition enter={transition} exit={transition} default="none">
      <main className={className} data-reading-scroll data-public-shell data-family={family}>
        {showProgress ? (
          <ReadingProgress
            trackClassName={progressTrackClassName}
            valueClassName={progressValueClassName}
          />
        ) : null}
        {/* Nothing sits between the ground and the document.
            `ScanBackdrop` used to mount here: 16 rows of the monitoring
            corpus drifting on 45–90s loops behind every reading page, at an
            effective 0.05–0.0765 alpha. Owner ruling, 2026-09-14 — it goes.
            Three reasons, any one of which is sufficient. It is what made a
            page read as dark-and-settling rather than simply rendered, and
            what left ghost text in the desktop margins. Its corpus is
            *hostile* material ("ANTI ISRAEL NARRATIVE: …", "PROPAGANDA
            STREAM: …"), so the site was wallpapering itself in the messaging
            it exists to refute. And it ran continuous compositing behind
            running text on twenty public routes. Do not reintroduce an
            ambient version of it here. */}
        {children}
      </main>
      </ViewTransition>
      <SiteFooter activeSection={activeSection} />
    </>
  );
}
