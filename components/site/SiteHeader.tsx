"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePublicSession } from "@/components/auth/PublicSessionProvider";
import { SearchLauncher } from "@/components/search/SearchLauncher";
import { AskDock } from "@/components/ask/AskDock";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { publicDisplayName, publicInitials } from "@/lib/public-session";
import {
  ACCOUNT_LINK,
  BAR_LINKS,
  REPORTING_LINKS,
  ABOUT_LINKS,
  SECTION_LINKS,
  REFERENCE_LINKS,
  SUPPORT_LINK,
  isCurrentChromeLink,
  isSectionOffBar,
} from "./navigation-model";
import { ChromeLinkGroup } from "./ChromeLink";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  /**
   * A section id (`october-7`), a bare route id (`methodology`), or
   * `information-war`. `EditorialShell` derives it; the routes that mount this
   * header directly pass nothing, and nothing is marked current.
   */
  activeSection?: string;
  home?: boolean;
}

/** The one chevron in the chrome. 10px, currentColor, rotates when open. */
function Chevron() {
  return <Icon className={styles.chevron} name="chevron-down" size={12} strokeWidth={1.25} />;
}

/**
 * What the desktop menu shows: only what the bar cannot. The bar carries the
 * three reporting destinations, the system page, Support and the account, so
 * the drawer is the rest — The People of Israel, We Are, and the three
 * reference pages — five links, not the twelve it listed until 2026-09-15
 * (Hick: a menu that repeats the bar is a second decision about the same
 * thing). The bar's own destinations still appear in the drawer *below the
 * width at which the bar hides them*, because there they are what the drawer
 * is for; that group is hidden by the stylesheet at the widths where the bar
 * shows them, and it is what the no-JavaScript index on a phone reads.
 */
const OFF_BAR_ABOUT = ABOUT_LINKS.filter((link) => !BAR_LINKS.some((bar) => bar.href === link.href));
const OFF_BAR_REFERENCE = REFERENCE_LINKS.filter((link) => link.href !== ACCOUNT_LINK.href);

/** How far the page scrolls before the tall masthead becomes the bar. */
const BAR_AT = 48;
/** How far a sustained scroll down runs before the bar retracts. */
const RETRACT_AFTER = 160;
/** The smallest scroll delta that counts as a direction. */
const DIRECTION_DEADBAND = 4;

/**
 * The masthead.
 *
 * Three jobs, in this order: say whose desk this is, say where the reader is,
 * and say where they can go. It is a full-bleed bar rather than the floating
 * centred pill it replaced, because a pill of six anonymous links is the
 * generic product-nav this site is least able to afford — the whole argument
 * of a verification desk is that it is *somebody's* desk, and the masthead is
 * where that is stated.
 *
 * ── TWO MODES, ONE BAR (2026-09-15) ────────────────────────────────────────
 * At the top of a document the masthead is tall: the nameplate at its own
 * size with the role line under it, the way a publication opens. Once the
 * page has scrolled it is the bar — the same controls, shorter — and on a
 * sustained scroll down it retracts out of the way of the reading, returning
 * the moment the reader scrolls up, reaches the top, opens a panel or moves
 * focus into it. `<main>` is offset by `--header-h`, the tall height, at all
 * times: nothing reflows, and a retracted bar is a transform, not a layout.
 * The state is three data attributes set from one passive scroll listener;
 * no rAF, no observer.
 *
 * ── THE NO-JAVASCRIPT CONTRACT ───────────────────────────────────────────
 * `filesPanel` may not be mounted on client state. It is always in the server
 * HTML and carries its state in the `hidden` attribute, and
 * `@media (scripting: none)` in the stylesheet turns it into a static index
 * in the flow. The mobile menu is a JS-only Dialog; that is allowed because
 * the files panel is the no-JS index. Do not unmount `filesPanel`, and do not
 * turn it into a Dialog. When the panels were `{open ? <div/> : null}`, five
 * of the eight destinations had no reachable link anywhere on the site without
 * JavaScript. `scripts/ci-smoke.mjs` asserts all ten destinations are
 * reachable by href from `/` with scripting off.
 *
 * The drawer is also a direct child of `<header>`, not a descendant of the
 * primary-link group. That is load-bearing too: while it lived inside the
 * group, the phone breakpoint's `display: none` on that group hid the drawer
 * along with it, so a phone with scripting off had *no* navigation at all —
 * the desktop-viewport smoke test could not see it.
 *
 * ── THE SKIP LINK ────────────────────────────────────────────────────────
 * It lives here, as the header's first child, since 2026-09-15. It used to be
 * `EditorialShell`'s, which meant the three routes that mount this header
 * directly — the root error boundary, the 404 and the cover — either shipped
 * none or shipped a different one. One control, one target: `#page-content`,
 * which every route's `<main>` or masthead carries.
 */
export function SiteHeader({ activeSection, home = false }: SiteHeaderProps) {
  const [filesOpen, setFilesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filesPanelId = useId();
  const menuPanelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const filesPanelRef = useRef<HTMLDivElement>(null);
  const filesTriggerRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  /* One reading of the session for the whole tree, from the provider mounted
     in `app/layout.tsx`. See the account control below for what it is allowed
     to say in each state. */
  const session = usePublicSession();

  /* Files panel is not a Dialog, so Escape and outside-click live here.
     The menu Dialog owns its own cancel/backdrop/focus-return; handling
     those again would race `showModal()` and skip focus return. */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!filesOpen) return;
      setFilesOpen(false);
      filesTriggerRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setFilesOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [filesOpen]);

  /* The drawer takes focus when it opens, so a keyboard reader lands in the
     list rather than having to tab past the rest of the bar to reach it, and
     it closes when focus leaves the header — Tab off the last link is the
     same as Escape. */
  useEffect(() => {
    if (!filesOpen) return;
    filesPanelRef.current?.focus({ preventScroll: true });
  }, [filesOpen]);

  /* The mobile sheet is a full-height surface over the document; the drawer is
     a dropdown and deliberately does not lock the page. */
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  /* Three booleans from one passive scroll listener: past the top (a shadow
     and a firmer ground), past the tall band (the bar), and on a sustained
     scroll down (retracted). Direction is measured with a deadband so a
     trackpad's jitter does not flicker the bar; the run length is measured so
     a single wheel notch does not take it away. */
  const [scrolled, setScrolled] = useState(false);
  const [mode, setMode] = useState<"tall" | "bar">("tall");
  const [retracted, setRetracted] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let run = 0;
    const read = () => {
      const y = window.scrollY;
      const delta = y - last;
      setScrolled(y > 8);
      setMode(y > BAR_AT ? "bar" : "tall");
      if (delta > DIRECTION_DEADBAND) run = Math.max(0, run) + delta;
      else if (delta < -DIRECTION_DEADBAND) run = Math.min(0, run) + delta;
      if (y <= BAR_AT || run < 0) setRetracted(false);
      else if (run > RETRACT_AFTER) setRetracted(true);
      last = y;
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  const closePanels = () => {
    setFilesOpen(false);
    setMenuOpen(false);
  };

  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  const hereInDrawer = isSectionOffBar(activeSection);
  /* `/account` is excluded: it has its own permanent control in the bar, which
     takes `aria-current` itself, so the phone's Menu trigger would otherwise
     say "here" for a file that is already marked one control to its left. */
  const hereInMenu = [...SECTION_LINKS, ...REFERENCE_LINKS].some(
    (link) => link.href !== ACCOUNT_LINK.href && current(link.href),
  );

  /* ── The account control ───────────────────────────────────────────────────
   *
   * Three renderings, and the third is the point of the whole thing.
   *
   * `known` is true only when the server actually answered. While the check is
   * in flight, and after one that failed, the identities are null — and reading
   * that as "signed out" would greet a signed-in reader with an invitation to
   * sign in because a request timed out. So the identities are read only on
   * `known`, and the word is the neutral sentence that is true in every state:
   * `Account`, linking to the page that owns sign-in and recovery. No error
   * text and no retry button live up here; the bar stays quiet.
   *
   * Google wins over X when both are signed in. The two are separate accounts
   * and are not merged — the account page shows them side by side — but this
   * is a way *to* that page rather than an identity display, so it needs one
   * mark and picks the older provider deterministically.
   *
   * The avatar is initials, never a remote picture. `img-src` does not include
   * `pbs.twimg.com`, and forwarding X's avatar would make every page load tell
   * X where this reader is; the contract drops the URL for exactly that reason.
   */
  const identity = session.known ? (session.google ?? session.x) : null;
  const initials = publicInitials(identity);
  const signedInAs = publicDisplayName(identity);
  /* Always `Account`, in every state — including `known` and signed out.
     Until 2026-09-08 the label became "Sign in" once the check answered, and
     because the server render cannot know, that was a word changing in the
     chrome about a second after paint on every signed-out page load (UX-03).
     The neutral sentence is true in all four states, the account page says
     the rest, and `ACCOUNT_LINK.description` already says what signing in is
     for. `known` still decides whether the mark may show initials. */
  const accountLabel = ACCOUNT_LINK.label;

  /*
   * The same cells in the desktop drawer and the mobile sheet, and every one
   * of them is the shared `ChromeLink` — the same anchor the colophon draws,
   * with the same current-page rule, the same focus ring and the same 44px
   * floor. The always-rendered drawer remains the no-JavaScript navigation
   * fallback; see the contract at the top of this file.
   *
   * `sheet` is the phone: it lists the bar's destinations too, because the
   * phone bar carries none. The desktop drawer lists them as well, in a group
   * the stylesheet shows only below the seam where the bar hides them.
   */
  const renderNavigation = (surface: "drawer" | "sheet") => (
    <div className={styles.navigationContent}>
      <div className={styles.menuLayout}>
        <ChromeLinkGroup
          label="Sections"
          links={REPORTING_LINKS}
          current={current}
          density="detail"
          size="feature"
          onNavigate={closePanels}
          className={surface === "drawer" ? styles.barMirror : undefined}
          measureId={`header-${surface}-reporting`}
        />
        <ChromeLinkGroup
          label="Also on this site"
          links={OFF_BAR_ABOUT}
          current={current}
          density="detail"
          size="standard"
          onNavigate={closePanels}
          measureId={`header-${surface}-people`}
        />
      </div>
      <ChromeLinkGroup
        label="Standards and reference"
        hiddenLabel
        links={OFF_BAR_REFERENCE}
        current={current}
        className={`${styles.menuRow} ${styles.menuReference}`}
        onNavigate={closePanels}
        measureId={`header-${surface}-reference`}
      />
    </div>
  );

  return (
    <header
      ref={headerRef}
      className={styles.header}
      data-home={home || undefined}
      data-mode={mode}
      data-scrolled={scrolled || undefined}
      data-retracted={retracted && !filesOpen && !menuOpen ? "" : undefined}
      /* Every click in the bar is `click_nav`, the brand and the support
         link included. Nothing here reports an exposure: the bar is on
         screen on every page, so one would only restate the page view. */
      data-measure-nav=""
      onBlur={(event) => {
        if (!filesOpen) return;
        const next = event.relatedTarget as Node | null;
        if (next && headerRef.current?.contains(next)) return;
        setFilesOpen(false);
      }}
    >
      <a href="#page-content" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} onClick={closePanels} data-measure-id="header-brand" data-measure-exposure="none">
          <span className={styles.brandName}>Lions of Zion</span>
          <span className={styles.brandRole}>Evidence, not narratives</span>
        </Link>

        <nav className={styles.barNav} aria-label="Sections" data-measure-id="header-sections" data-measure-exposure="none">
          {BAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.barLink}
              aria-current={current(link.href) ? "page" : undefined}
              onClick={closePanels}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.utility}>
          {/* The two tools, on every route. Ask was in this slot on the cover
              only and a viewport-fixed pill everywhere else until 2026-09-08;
              see `AskDock` for why one home won (UX-07, UX-08). Opening either
              closes the drawer: they are the same instrument and the reader
              has moved on. */}
          <div className={styles.deskActions} onClickCapture={() => setFilesOpen(false)}>
            <AskDock current={activeSection === "ask"} />
            <SearchLauncher variant="bar" current={activeSection === "search"} className={styles.deskSearch} />
          </div>
          <Button
            ref={filesTriggerRef}
            type="button"
            variant="ghost"
            size="md"
            className={styles.filesTrigger}
            aria-expanded={filesOpen}
            aria-controls={filesPanelId}
            data-here={hereInDrawer || undefined}
            data-measure-id="header-menu-toggle"
            data-measure-exposure="none"
            onClick={() => setFilesOpen((open) => !open)}
          >
            Menu
            <Chevron />
          </Button>

          <Link
            href={SUPPORT_LINK.href}
            className={styles.support}
            aria-current={current(SUPPORT_LINK.href) ? "page" : undefined}
            onClick={closePanels}
            data-measure-id="header-support"
            data-measure-exposure="none"
          >
            <Icon name="support" size={16} strokeWidth={1.5} />
            {/* Owner ruling 2026-09-11: Support Us stays in the bar at every
                width. Where the word does not fit, the phone makes it
                screen-reader-only — the same box `.accountLabel` and
                `.menuLabel` use — and the gold glyph carries it. */}
            <span className={styles.supportLabel}>{SUPPORT_LINK.label}</span>
          </Link>

          <Link
            href={ACCOUNT_LINK.href}
            className={styles.account}
            aria-current={current(ACCOUNT_LINK.href) ? "page" : undefined}
            onClick={closePanels}
            data-measure-id="header-account"
            data-measure-exposure="none"
          >
            {/* One slot, one size, whichever mark is in it — the bar may not
                reflow when the session check lands. */}
            {identity && initials ? (
              <span className={`${styles.accountMark} ${styles.accountAvatar}`} aria-hidden="true">
                {initials}
              </span>
            ) : (
              <span className={`${styles.accountMark} ${styles.accountGlyph}`} aria-hidden="true">
                <Icon name="account" size={16} strokeWidth={1.5} />
              </span>
            )}
            {/* Same reasoning as the Menu trigger below: in a span the phone
                can make screen-reader-only, because `display: none` would take
                the link's accessible name with it and leave a bare glyph. */}
            <span className={styles.accountLabel}>{accountLabel}</span>
            {signedInAs ? (
              <span className={styles.accountWho}>, signed in as {signedInAs}</span>
            ) : null}
          </Link>

          <Button
            ref={menuTriggerRef}
            type="button"
            variant="ghost"
            size="md"
            className={styles.menuTrigger}
            aria-expanded={menuOpen}
            aria-controls={menuPanelId}
            data-here={hereInMenu || undefined}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {/* In a span so the phone can hide it without taking the button's
                accessible name with it. `display: none` removes a node from the
                accessibility tree, and the icon beside this is decorative — a
                bare text node here would have left the trigger nameless the
                moment it was hidden. The mobile rule sets it screen-reader-only
                instead, so the word survives for anyone who cannot see the
                glyph. */}
            <span className={styles.menuLabel}>{menuOpen ? "Close" : "Menu"}</span>
            <Icon
              className={styles.menuIcon}
              name={menuOpen ? "close" : "menu"}
              size={17}
              strokeWidth={1.45}
            />
          </Button>
        </div>
      </div>

      {/* The drawer. Always rendered; `hidden` carries the state. */}
      <div
        className={styles.filesPanel}
        id={filesPanelId}
        hidden={!filesOpen}
        ref={filesPanelRef}
        tabIndex={-1}
        aria-label="Menu"
      >
        <div className={styles.filesInner}>
          {renderNavigation("drawer")}
        </div>
      </div>

      {/* The sheet's copy renders only while it is open: the drawer above is
          the server-rendered index, and a second copy of every destination in
          a closed `<dialog>` on every page was weight with no reader. */}
      <Dialog
        id={menuPanelId}
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          menuTriggerRef.current?.focus();
        }}
        title="Menu"
        description="Reporting, evidence and the people behind the work."
        variant="drawer"
        className={styles.mobilePanel}
      >
        {menuOpen ? renderNavigation("sheet") : null}
      </Dialog>
    </header>
  );
}
