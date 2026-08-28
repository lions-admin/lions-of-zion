"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND_LOGO_DATA_URL } from "@/app/brand-logo";
import {
  SITE_NAVIGATION,
  getSiteNavigationItem,
  type SiteSectionId,
} from "@/lib/site-navigation";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  activeSection?: SiteSectionId;
}

export function SiteHeader({ activeSection }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const activeItem = activeSection ? getSiteNavigationItem(activeSection) : undefined;
  const activeIndex = activeItem
    ? SITE_NAVIGATION.findIndex((item) => item.id === activeItem.id)
    : -1;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className={styles.header} data-menu-open={open || undefined}>
      <div className={styles.rail}>
        <Link href="/" className={styles.brand} aria-label="Lions of Zion home">
          <Image
            src={BRAND_LOGO_DATA_URL}
            alt="Lions of Zion"
            width={382}
            height={136}
            unoptimized
            priority
          />
        </Link>

        <div className={styles.currentFile} aria-label="Current section">
          <span>
            {activeIndex >= 0
              ? `FILE ${String(activeIndex + 1).padStart(2, "0")} / ${String(SITE_NAVIGATION.length).padStart(2, "0")}`
              : "PUBLIC RECORD"}
          </span>
          <strong>{activeItem?.displayName ?? "Reading desk"}</strong>
        </div>

        <button
          ref={triggerRef}
          type="button"
          className={styles.indexButton}
          aria-label={open ? "Close public file index" : "Open public file index"}
          aria-expanded={open}
          aria-controls="site-file-index"
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.indexCopy}>
            <small>THE PUBLIC FILES</small>
            <strong>{open ? "Close index" : "Open index"}</strong>
          </span>
          <span className={styles.indexGlyph} aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </div>

      {open ? (
        <div className={styles.drawer} id="site-file-index">
          <div className={styles.drawerIntro}>
            <p>PUBLIC INDEX / 08 FILES</p>
            <h2>Move through the record.</h2>
            <span>Evidence, context, memory, and response—organized by purpose.</span>
          </div>
          <nav className={styles.fileGrid} aria-label="Public site sections">
            {SITE_NAVIGATION.map((item, index) => (
              <Link
                ref={index === 0 ? firstLinkRef : undefined}
                href={item.href}
                key={item.id}
                className={styles.fileLink}
                aria-current={item.id === activeSection ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span className={styles.fileNumber}>{String(index + 1).padStart(2, "0")}</span>
                {/* These are tiny monochrome source emblems; optimization adds no value. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.emblem} alt="" width="30" height="30" />
                <span className={styles.fileText}>
                  <strong>{item.displayName}</strong>
                  <small>{item.description}</small>
                </span>
                <span className={styles.fileArrow} aria-hidden="true">↗</span>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
