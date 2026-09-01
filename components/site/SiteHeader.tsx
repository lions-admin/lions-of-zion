"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import styles from "./site-header.module.css";

type NavigationItem = {
  label: string;
  href: string;
  live?: boolean;
  description?: string;
};

const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
  { label: "Today", href: "/geopolitical-brief" },
  { label: "Investigations", href: "/information-war" },
  { label: "October 7", href: "/october-7" },
  { label: "Israel Explained", href: "/israels-story" },
];

const RESOURCE_NAVIGATION: readonly NavigationItem[] = [
  { label: "Methodology", href: "/methodology", description: "How evidence is sourced and assessed." },
  { label: "Corrections", href: "/corrections", description: "A public record of amendments." },
  { label: "Account", href: "/account", description: "Saved work and access." },
];

const EXPLORE_NAVIGATION: readonly NavigationItem[] = SITE_NAVIGATION.map((item) => ({
  label: item.displayName,
  href: item.href,
  description: item.description,
}));

interface SiteHeaderProps {
  activeSection?: string;
}

function isCurrent(activeSection: string | undefined, href: string) {
  if (!activeSection) return false;
  const section = href.slice(1);
  return activeSection === section || activeSection.startsWith(`${section}/`);
}

export function SiteHeader({ activeSection }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const mobilePanelId = useId();
  const explorePanelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const exploreTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (mobileOpen) {
        setMobileOpen(false);
        mobileTriggerRef.current?.focus();
      } else if (exploreOpen) {
        setExploreOpen(false);
        exploreTriggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMobileOpen(false);
      setExploreOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [exploreOpen, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const closePanels = () => {
    setMobileOpen(false);
    setExploreOpen(false);
  };

  const renderLink = (item: NavigationItem, mobile = false) => (
    <Link
      className={mobile ? styles.mobileLink : styles.navLink}
      href={item.href}
      key={`${mobile ? "mobile" : "desktop"}-${item.label}`}
      aria-current={isCurrent(activeSection, item.href) ? "page" : undefined}
      onClick={closePanels}
    >
      {item.live ? <span className={styles.liveDot} aria-hidden="true" /> : null}
      {item.label}
    </Link>
  );

  return (
    <header ref={headerRef} className={styles.header}>
      <nav className={styles.bar} aria-label="Primary navigation">
        <div className={styles.desktopNavigation}>
          <div className={styles.primaryLinks}>
            {PRIMARY_NAVIGATION.map((item) => renderLink(item))}
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <div
            ref={exploreRef}
            className={styles.exploreRoot}
            onPointerEnter={() => setExploreOpen(true)}
            onPointerLeave={() => setExploreOpen(false)}
            onFocusCapture={() => setExploreOpen(true)}
            onBlurCapture={(event) => {
              if (!exploreRef.current?.contains(event.relatedTarget as Node | null)) setExploreOpen(false);
            }}
          >
            <button
              ref={exploreTriggerRef}
              type="button"
              className={`${styles.navLink} ${styles.exploreTrigger}`}
              aria-expanded={exploreOpen}
              aria-controls={explorePanelId}
              onClick={() => setExploreOpen(true)}
            >
              Explore
              <span className={styles.menuIndicator} aria-hidden="true" />
            </button>

            {/* Rendered whether or not it is open. It used to be
                `{exploreOpen ? … : null}`, which meant the eight destinations
                existed only after hydration: with scripting off the header
                carried four links and nothing else. Visibility is CSS now, and
                the stylesheet opens this on `:hover` and `:focus-within` too,
                so the panel works before hydration and without JavaScript. */}
            <div
              className={styles.explorePanel}
              id={explorePanelId}
              data-open={exploreOpen || undefined}
            >
                <div className={styles.exploreHeading}>
                  <span className={styles.panelEyebrow}>Explore the system</span>
                  <span className={styles.panelIndex}>01—08</span>
                </div>
                <div className={styles.exploreColumns}>
                  <div className={styles.sectionIndex}>
                    {EXPLORE_NAVIGATION.map((item, index) => (
                      <Link className={styles.indexLink} href={item.href} key={item.href} onClick={closePanels}>
                        <span className={styles.indexNumber}>{String(index + 1).padStart(2, "0")}</span>
                        <span className={styles.indexCopy}>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <span className={styles.indexArrow} aria-hidden="true">↗</span>
                      </Link>
                    ))}
                  </div>
                  <div className={styles.resourceColumn}>
                    <span className={styles.panelEyebrow}>Resources</span>
                    {RESOURCE_NAVIGATION.map((item) => (
                      <Link className={styles.resourceLink} href={item.href} key={item.href} onClick={closePanels}>
                        <span>{item.label}</span>
                        <small>{item.description}</small>
                      </Link>
                    ))}
                  </div>
                </div>
            </div>
          </div>
          <Link className={`${styles.navLink} ${styles.accountLink}`} href="/account" onClick={closePanels}>
            Account
          </Link>
        </div>

        <button
          ref={mobileTriggerRef}
          type="button"
          className={styles.mobileTrigger}
          aria-expanded={mobileOpen}
          aria-controls={mobilePanelId}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span>Menu</span>
          <span className={styles.menuIndicator} aria-hidden="true" />
        </button>

        {/* Same fix, and it mattered more here: below 48rem the stylesheet sets
            `.desktopNavigation { display: none }`, so a phone with scripting
            off reached this panel — and therefore every link in the header —
            only through React state that never ran. It rendered no navigation
            at all. The panel is always in the document now. */}
        <div
          className={styles.mobilePanel}
          id={mobilePanelId}
          data-open={mobileOpen || undefined}
        >
          <span className={styles.mobileLabel}>Sections</span>
          {EXPLORE_NAVIGATION.map((item) => renderLink(item, true))}
          <span className={styles.mobileLabel}>Resources</span>
          <Link className={styles.mobileLink} href="/information-war" onClick={closePanels}>Investigations</Link>
          {RESOURCE_NAVIGATION.map((item) => renderLink(item, true))}
        </div>
      </nav>

      {/* Without JavaScript the trigger button is inert, so the panel is laid
          out as a plain static list instead of a dismissable overlay. Same
          `<noscript><style>` tactic the intro gate uses to hide itself — the
          class name is interpolated because CSS Modules hashes it. */}
      <noscript>
        <style>{`
          @media (max-width: 40rem) {
            .${styles.mobilePanel} {
              display: grid !important;
              position: static !important;
              width: auto !important;
              max-height: none !important;
              animation: none !important;
            }
            .${styles.mobileTrigger} { display: none !important; }
          }
        `}</style>
      </noscript>
    </header>
  );
}
