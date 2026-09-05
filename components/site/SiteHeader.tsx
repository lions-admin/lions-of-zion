"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { SearchLauncher } from "@/components/search/SearchLauncher";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import {
  BAR_LINKS,
  REPORTING_LINKS,
  ABOUT_LINKS,
  SECTION_LINKS,
  REFERENCE_LINKS,
  SUPPORT_LINK,
  isCurrentChromeLink,
  isSectionOffBar,
  type ChromeLink,
} from "./navigation-model";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  /**
   * A section id (`october-7`), a bare route id (`methodology`), or
   * `information-war`. `EditorialShell` derives it; the routes that mount this
   * header directly pass nothing, and nothing is marked current.
   */
  activeSection?: string;
}

/** The one chevron in the chrome. 10px, currentColor, rotates when open. */
function Chevron() {
  return <Icon className={styles.chevron} name="chevron-down" size={12} strokeWidth={1.25} />;
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
 */
export function SiteHeader({ activeSection }: SiteHeaderProps) {
  const [filesOpen, setFilesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filesPanelId = useId();
  const menuPanelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const filesTriggerRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

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

  const closePanels = () => {
    setFilesOpen(false);
    setMenuOpen(false);
  };

  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  const hereInDrawer = isSectionOffBar(activeSection);
  const hereInMenu = [...SECTION_LINKS, ...REFERENCE_LINKS].some((link) => current(link.href));

  const renderMenuLink = (link: ChromeLink, primary = false) => (
    <Link key={link.href} href={link.href}
      className={primary ? styles.primaryMenuLink : styles.secondaryMenuLink}
      aria-current={current(link.href) ? "page" : undefined} onClick={closePanels}>
      <span className={styles.menuLinkTitle}>{link.label}</span>
      <span className={styles.menuLinkArrow} aria-hidden="true">↗</span>
      <span className={styles.menuLinkDescription}>{link.description}</span>
    </Link>
  );

  // The same hierarchy in the desktop dropdown and mobile dialog. The
  // always-rendered dropdown remains the no-JavaScript navigation fallback.
  const renderNavigation = () => (
    <div className={styles.navigationContent}>
      <div className={styles.menuLayout}>
        <nav className={styles.reportingMenu} aria-label="Reporting and evidence">
          <p className={styles.menuGroupLabel}>Reporting & evidence</p>
          {REPORTING_LINKS.map((link) => renderMenuLink(link, true))}
        </nav>
        <nav className={styles.aboutMenu} aria-label="People and purpose">
          <p className={styles.menuGroupLabel}>People & purpose</p>
          {ABOUT_LINKS.map((link) => renderMenuLink(link))}
        </nav>
      </div>
      <div className={styles.menuUtilities}>
        <nav aria-label="Standards and account">
          {REFERENCE_LINKS.map((link) => <Link key={link.href} href={link.href}
            aria-current={current(link.href) ? "page" : undefined} onClick={closePanels}>{link.label}</Link>)}
        </nav>
        <nav className={styles.menuTools} aria-label="Search and conversation">
          <Link href="/search" onClick={closePanels}>Search</Link>
          <Link href="/ask" onClick={closePanels}>Ask the desk <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
      <Link href={SUPPORT_LINK.href} className={styles.menuSupport} onClick={closePanels}>
        Support the work <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );

  return (
    <header ref={headerRef} className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} onClick={closePanels}>
          <span className={styles.brandName}>Lions of Zion</span>
          <span className={styles.brandRole}>Evidence desk</span>
        </Link>

        <nav className={styles.barNav} aria-label="Sections">
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
          <div className={styles.deskActions}>
            {/* The Ask control moved out of the chrome and onto the viewport
                as `AskDock`, mounted in `app/layout.tsx`. It is a panel that
                opens over the page now rather than a link away from it, so a
                reader mid-article keeps their place — and a second trigger
                up here would be two controls to one desk. */}
            <SearchLauncher variant="icon" className={styles.deskSearch} />
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
          >
            <Icon name="support" size={15} strokeWidth={1.5} />
            {SUPPORT_LINK.label}
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
      <div className={styles.filesPanel} id={filesPanelId} hidden={!filesOpen}>
        <div className={styles.filesInner}>
          {renderNavigation()}
        </div>
      </div>

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
  );
}
