"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  BAR_LINKS,
  FILE_LINKS,
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
  return (
    <svg className={styles.chevron} viewBox="0 0 10 6" aria-hidden="true" focusable="false">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
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
 * ── THE NO-JAVASCRIPT CONTRACT ───────────────────────────────────────────
 * Neither panel may be mounted on client state. Both are always in the server
 * HTML and carry their state in the `hidden` attribute, and
 * `@media (scripting: none)` in the stylesheet turns the file drawer into a
 * static index in the flow. This is not defensive style: when the panels were
 * `{open ? <div/> : null}`, five of the eight destinations had no reachable
 * link anywhere on the site without JavaScript. `scripts/ci-smoke.mjs` asserts
 * all ten destinations are reachable by href from `/` with scripting off.
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
      } else if (filesOpen) {
        setFilesOpen(false);
        filesTriggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
      setFilesOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [filesOpen, menuOpen]);

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
  /* The reader is inside one of the eight, but this width's bar cannot show
     which. The trigger then carries the same gold mark a bar link would, so
     "you are here" always has somewhere to live. */
  const hereInDrawer = isSectionOffBar(activeSection);
  const hereInFiles = FILE_LINKS.some((link) => current(link.href));

  const renderFileCell = (link: ChromeLink) => (
    <Link
      key={link.href}
      href={link.href}
      className={styles.fileCell}
      aria-current={current(link.href) ? "page" : undefined}
      onClick={closePanels}
    >
      <span className={styles.fileIndex}>{link.index}</span>
      <span className={styles.fileName}>{link.label}</span>
      <span className={styles.fileDescription}>{link.description}</span>
    </Link>
  );

  const renderReferenceCell = (link: ChromeLink) => (
    <Link
      key={link.href}
      href={link.href}
      className={styles.referenceCell}
      aria-current={current(link.href) ? "page" : undefined}
      onClick={closePanels}
    >
      <span className={styles.referenceName}>{link.label}</span>
      <span className={styles.referenceDescription}>{link.description}</span>
    </Link>
  );

  const renderSheetRow = (link: ChromeLink) => (
    <Link
      key={link.href}
      href={link.href}
      className={styles.sheetRow}
      aria-current={current(link.href) ? "page" : undefined}
      onClick={closePanels}
    >
      <span className={styles.sheetIndex}>{link.index ?? "·"}</span>
      <span className={styles.sheetName}>{link.label}</span>
    </Link>
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
          <button
            ref={filesTriggerRef}
            type="button"
            className={styles.filesTrigger}
            aria-expanded={filesOpen}
            aria-controls={filesPanelId}
            data-here={hereInDrawer || undefined}
            onClick={() => setFilesOpen((open) => !open)}
          >
            All files
            <span className={styles.filesCount}>08</span>
            <Chevron />
          </button>

          <Link
            href={SUPPORT_LINK.href}
            className={styles.support}
            aria-current={current(SUPPORT_LINK.href) ? "page" : undefined}
            onClick={closePanels}
          >
            {SUPPORT_LINK.label}
          </Link>

          <button
            ref={menuTriggerRef}
            type="button"
            className={styles.menuTrigger}
            aria-expanded={menuOpen}
            aria-controls={menuPanelId}
            data-here={hereInFiles || undefined}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
            <span className={styles.menuGlyph} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The drawer. Always rendered; `hidden` carries the state. */}
      <div className={styles.filesPanel} id={filesPanelId} hidden={!filesOpen}>
        <div className={styles.filesInner}>
          <div className={styles.panelHead}>
            <span className={styles.panelEyebrow}>The eight files</span>
            <span className={styles.panelCount}>01 — 08</span>
          </div>

          <nav className={styles.fileGrid} aria-label="All sections">
            {FILE_LINKS.map(renderFileCell)}
          </nav>

          <div className={styles.panelHead}>
            <span className={styles.panelEyebrow}>Reference</span>
          </div>

          <nav className={styles.referenceGrid} aria-label="Reference pages">
            {REFERENCE_LINKS.map(renderReferenceCell)}
          </nav>
        </div>
      </div>

      {/* The phone sheet. Same rule: always rendered, `hidden` toggled. */}
      <div className={styles.menuPanel} id={menuPanelId} hidden={!menuOpen}>
        <nav className={styles.sheetGroup} aria-label="All sections">
          <span className={styles.sheetLabel}>Files</span>
          {FILE_LINKS.map(renderSheetRow)}
        </nav>
        <nav className={styles.sheetGroup} aria-label="Reference pages">
          <span className={styles.sheetLabel}>Reference</span>
          {REFERENCE_LINKS.map(renderSheetRow)}
        </nav>
      </div>
    </header>
  );
}
