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
  DRAWER_PEOPLE_LINKS,
  DRAWER_STANDARD_LINKS,
  SUPPORT_LINK,
  isCurrentChromeLink,
  isSectionOffBar,
} from "./navigation-model";
import { ChromeLinkGroup } from "./ChromeLink";
import styles from "./site-header.module.css";

/**
 * How far into a document the reader must be before the masthead retracts.
 *
 * The masthead is tall (up to 7rem of chrome); 120px past its own depth is the
 * sustained scroll the retraction asks for, and the same 120px is the runway
 * a scroll-up has to cover to bring it back — the sentinel's hysteresis band.
 * `IntersectionObserver.rootMargin` takes px or %, not rem, so this is a
 * literal; it sits between the phone's tall masthead (4.8rem) and the
 * desktop's (7rem), so one value serves both.
 */
const RETRACT_DEPTH = 120;

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
  return (
    <Icon
      className={styles.chevron}
      name="chevron-down"
      size={12}
      strokeWidth={1.25}
    />
  );
}

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
 * ── TWO MODES ────────────────────────────────────────────────────────────
 * At the top of a document the masthead is tall — the wordmark at display
 * size over its role line, and the section links beside it (on their own row
 * below 76.25rem, where one row cannot hold them). On sustained scroll-down
 * it retracts into a short bar — 3.5rem, the height of its own controls —
 * carrying the two tools; it returns on scroll-up, on keyboard focus, and at
 * the top of the page. `<main>` never reflows out from under the reader: the
 * document's offset reads `--header-h`, and the mode swap moves that one
 * token (`html[data-header-bar]` in `app/globals.css`), so every surface that
 * offsets by the masthead moves with it.
 *
 * ── THE NO-JAVASCRIPT CONTRACT ───────────────────────────────────────────
 * `filesPanel` may not be mounted on client state. It is always in the server
 * HTML and carries its state in the `hidden` attribute, and
 * `@media (scripting: none)` in the stylesheet turns it into a static index
 * in the flow. The mobile menu is a JS-only Dialog whose body renders only
 * while open; that is allowed because the files panel is the no-JS index. Do
 * not unmount `filesPanel`, and do not turn it into a Dialog. When the panels
 * were `{open ? <div/> : null}`, five of the eight destinations had no
 * reachable link anywhere on the site without JavaScript.
 * `scripts/ci-smoke.mjs` asserts all ten destinations are reachable — and
 * *visible* at 390px — by href from `/` with scripting off.
 *
 * The drawer is also a direct child of `<header>`, not a descendant of the
 * primary-link group. That is load-bearing too: while it lived inside the
 * group, the phone breakpoint's `display: none` on that group hid the drawer
 * along with it, so a phone with scripting off had *no* navigation at all —
 * the desktop-viewport smoke test could not see it.
 */
export function SiteHeader({ activeSection, home = false }: SiteHeaderProps) {
  const [filesOpen, setFilesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filesPanelId = useId();
  const menuPanelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const filesTriggerRef = useRef<HTMLButtonElement>(null);
  const filesPanelRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  /* One reading of the session for the whole tree, from the provider mounted
     in `app/layout.tsx`. See the account control below for what it is allowed
     to say in each state. */
  const session = usePublicSession();

  /* Files panel is not a Dialog, so Escape, outside-click and focus-out live
     here. The drawer receives focus when it opens (it is a dropdown panel,
     not a modal, so focus moves without a trap) and closes when focus leaves
     the header entirely — tabbing onward into the document is a close, the
     same gesture outside-click is for a pointer. The menu Dialog owns its own
     cancel/backdrop/focus-return; handling those again would race
     `showModal()` and skip focus return. */
  useEffect(() => {
    const panel = filesPanelRef.current;
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
    /* Only a target still inside the header keeps the drawer open: the
       trigger that opened it, or a control in the bar. Focus passing into
       the document — or `null`, the end of a click navigation — closes it. */
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && headerRef.current?.contains(next)) return;
      setFilesOpen(false);
    };

    if (panel) panel.addEventListener("focusout", handleFocusOut);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      panel?.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
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

  /* ── The scroll sentinel (MOTION-002 / PERF-007) ──────────────────────────
   *
   * The 1px `sentinel` element sits at the very top of the document; one
   * IntersectionObserver — never a scroll listener — watches it. The root is
   * expanded 120px *above* the viewport, so the sentinel is inside it while
   * the reader is within the retract depth and leaves it the moment the
   * document has scrolled 120px past its own top — sustained scroll, not a
   * jitter threshold — and returns the moment a scroll-up crosses back into
   * the band. Callbacks, not frames; no measuring loop. The observer is
   * disconnected on unmount.
   *
   * Keyboard return: `focusin` on the header brings the tall masthead back —
   * a tabbing reader must see what they are tabbing into — and the last
   * reading is restored on `focusout`, so focus passing *through* the
   * masthead on its way down the document does not leave it permanently
   * expanded. `lastDeep` is a ref, not state, so neither handler re-renders
   * unless the mode actually changes.
   */
  const [scrolled, setScrolled] = useState(false);
  const [retracted, setRetracted] = useState(false);
  const lastDeepRef = useRef(false);
  const focusWithinRef = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const deep = entry ? !entry.isIntersecting : false;
        lastDeepRef.current = deep;
        setScrolled(deep);
        if (focusWithinRef.current) return;
        /* Retraction changes the masthead's height; a drawer open under it
           would be positioned against a header that just changed, so the
           swap closes it from here, at the source of the change, rather
           than from an effect watching the flag. */
        setRetracted(deep);
        if (deep) setFilesOpen(false);
      },
      /* Positive, not negative: the root grows 120px *above* the viewport,
         and the sentinel — 1px at the document's top — falls out of it after
         120px of scroll. A negative top margin would shrink the root from
         the top and put the sentinel outside it at every scroll position,
         including the first. */
      { rootMargin: `${RETRACT_DEPTH}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const focusIn = () => {
      focusWithinRef.current = true;
      setRetracted(false);
    };
    const focusOut = (event: FocusEvent) => {
      if (header.contains(event.relatedTarget as Node)) return;
      focusWithinRef.current = false;
      if (lastDeepRef.current) {
        setRetracted(true);
        setFilesOpen(false);
      }
    };
    header.addEventListener("focusin", focusIn);
    header.addEventListener("focusout", focusOut);
    return () => {
      header.removeEventListener("focusin", focusIn);
      header.removeEventListener("focusout", focusOut);
    };
  }, []);

  /* The mode swap, on the document: `--header-h` re-points at the short bar's
     token (see `app/globals.css`), so the shell's padding, every
     `scroll-margin-top` and the drawer's max-height follow the masthead's
     mode from the one token. Removed on unmount so nothing leaks. */
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-header-bar", retracted);
    return () => root.removeAttribute("data-header-bar");
  }, [retracted]);

  /* The drawer receives focus when it opens (it is a dropdown panel, not a
     modal, so focus moves without a trap) and closes when focus leaves the
     header entirely — tabbing onward into the document is a close, the same
     gesture outside-click is for a pointer. */
  useEffect(() => {
    if (filesOpen) filesPanelRef.current?.focus();
  }, [filesOpen]);

  const closePanels = () => {
    setFilesOpen(false);
    setMenuOpen(false);
  };

  /* The two tools open their own surfaces; the drawer has no business being
     open underneath one. */
  const closeForTools = () => setFilesOpen(false);

  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  /* `/account` is excluded everywhere: it has its own permanent control in the
     bar, which takes `aria-current` itself, so a trigger or a drawer cell
     would otherwise say "here" for a file already marked one control away.
     The Menu trigger carries the mark whenever the bar is not showing the
     file's own control — an off-bar file, or a bar destination while the
     barNav is retracted away. The stylesheet paints that mark only in the
     contexts where the bar genuinely cannot show it. */
  const barCurrent = BAR_LINKS.some((link) => current(link.href));
  const hereInDrawer =
    isSectionOffBar(activeSection) || (retracted && barCurrent);
  const hereInMenu = isSectionOffBar(activeSection) || barCurrent;

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
   * The drawer and the mobile sheet are built from the shared `ChromeLink` —
   * the same anchor the colophon draws, with the same current-page rule, the
   * same focus ring and the same 44px floor.
   *
   * The first group is the bar's complement: the four destinations the bar
   * shows at rest, rendered here only where the bar cannot show them
   * (retracted, or below the phone seam) — see `menuBarOnly` in the
   * stylesheet. The two groups under it are the destinations no bar control
   * ever shows. The always-rendered drawer remains the no-JavaScript
   * navigation fallback; see the contract at the top of this file.
   */
  const renderNavigation = () => (
    <div className={styles.navigationContent}>
      {/* The bar's complement. Visible only where the bar itself is not
          showing these four — retracted, or below the phone seam — so the
          drawer is never a duplicate of the bar, and a destination is never
          stranded in either state. */}
      <ChromeLinkGroup
        label="Reporting & evidence"
        links={BAR_LINKS}
        current={current}
        className={`${styles.menuRow} ${styles.menuBarOnly}`}
        onNavigate={closePanels}
        measureId="header-menu-reporting"
      />
      <div className={styles.menuLayout}>
        <ChromeLinkGroup
          label="People & purpose"
          links={DRAWER_PEOPLE_LINKS}
          current={current}
          density="detail"
          size="feature"
          onNavigate={closePanels}
          measureId="header-menu-people"
        />
        <ChromeLinkGroup
          label="Standards"
          links={DRAWER_STANDARD_LINKS}
          current={current}
          density="detail"
          size="standard"
          onNavigate={closePanels}
          measureId="header-menu-standards"
        />
      </div>
    </div>
  );

  return (
    <>
      {/* The retract sentinel: one 1px element at the very top of the
          document, and the observer in the effects above watches it. A
          sibling of the header, never a child — the header is
          `position: fixed`, and a sentinel inside it would be pinned to the
          viewport and always visible. */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <header
        ref={headerRef}
        className={styles.header}
        data-home={home || undefined}
        data-scrolled={scrolled || undefined}
        data-retracted={retracted || undefined}
        /* The view-transition hook the transition CSS reads: the fixed bar is
           named `chrome` in `app/globals.css` and never crossfades with the
           page (see the note in `site-header.module.css`). */
        data-vt-chrome=""
        /* Every click in the bar is `click_nav`, the brand and the support
          link included. Nothing here reports an exposure: the bar is on
          screen on every page, so one would only restate the page view. */
        data-measure-nav=""
      >
        <a href="#page-content" className={styles.skipLink}>
          Skip to content
        </a>
        <div className={styles.bar}>
          <Link
            href="/"
            className={styles.brand}
            onClick={closePanels}
            data-measure-id="header-brand"
            data-measure-exposure="none"
          >
            <span className={styles.brandName}>Lions of Zion</span>
            <span className={styles.brandRole}>Evidence, not narratives</span>
          </Link>

          <nav
            className={styles.barNav}
            aria-label="Sections"
            data-measure-id="header-sections"
            data-measure-exposure="none"
          >
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
              see `AskDock` for why one home won (UX-07, UX-08). They close the
              drawer on their way past: an interaction with a tool closes the
              panel behind it. */}
            <div className={styles.deskActions}>
              <AskDock
                current={activeSection === "ask"}
                onActivate={closeForTools}
              />
              <SearchLauncher
                variant="icon"
                className={styles.deskSearch}
                current={activeSection === "search"}
                showHint
                onActivate={closeForTools}
              />
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
                screen-reader-only — the composed `.srOnly` box, like
                `.accountLabel` — and the gold-outlined glyph carries it. */}
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
                <span
                  className={`${styles.accountMark} ${styles.accountAvatar}`}
                  aria-hidden="true"
                >
                  {initials}
                </span>
              ) : (
                <span
                  className={`${styles.accountMark} ${styles.accountGlyph}`}
                  aria-hidden="true"
                >
                  <Icon name="account" size={16} strokeWidth={1.5} />
                </span>
              )}
              {/* Same reasoning as the Menu trigger below: in a span the phone
                can make screen-reader-only, because `display: none` would take
                the link's accessible name with it and leave a bare glyph. */}
              <span className={styles.accountLabel}>{accountLabel}</span>
              {signedInAs ? (
                <span className={styles.accountWho}>
                  , signed in as {signedInAs}
                </span>
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
                moment it was hidden. The phone rule composes the shared
                `.srOnly` instead, so the word survives for anyone who cannot
                see the glyph. */}
              <span className={styles.menuLabel}>
                {menuOpen ? "Close" : "Menu"}
              </span>
              <Icon
                className={styles.menuIcon}
                name={menuOpen ? "close" : "menu"}
                size={17}
                strokeWidth={1.45}
              />
            </Button>
          </div>
        </div>

        {/* The drawer. Always rendered; `hidden` carries the state, focus and
          `focusout` close it. */}
        <div
          ref={filesPanelRef}
          className={styles.filesPanel}
          id={filesPanelId}
          hidden={!filesOpen}
          tabIndex={-1}
        >
          <div className={styles.filesInner}>{renderNavigation()}</div>
        </div>

        {/* Mounted for the drawer's whole life, not only while open: an open
            modal `<dialog>` that is *removed* from the document never runs the
            platform's focus-restoration steps, so Escape left the reader on
            `body` — and with the trigger unmounted, its own `aria-controls`
            pointed at a missing id besides. Persistent mounting gives the id
            a target in every state and lets the platform's own close steps
            return focus. The filesPanel stays the no-JS index (VA-42). */}
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
          {renderNavigation()}
        </Dialog>
      </header>
    </>
  );
}
