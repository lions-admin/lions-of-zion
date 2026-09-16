"use client";

/**
 * The hub's jump row — the sticky, self-marking contents of one front.
 *
 * Three jobs, in one row of plain links:
 *
 * **Anchors only.** The jumps were the masthead's foot, and route links sat in
 * them beside the anchors, so the row mixed "where am I in this front" with
 * "leave this front". Route links are doors into other surfaces; they belong
 * in a hub's closing doors, where a reader has finished the front and is
 * choosing where to go. Here a jump that does not resolve to an id in the
 * document is dropped on mount, so a section that renders nothing (an empty
 * archive, an edition with no briefing) never keeps a link to nowhere.
 *
 * **Sticky.** `position: sticky` under the header: the row rides down the
 * front as a thin contents bar and stops at the hub container's end. The
 * offset is `--header-h`, the same token every scroll-margin on the site
 * reads, so the retracted masthead's mode is followed from one place.
 *
 * **Self-marking.** One `IntersectionObserver` over the sections the jumps
 * name — the same shape `SectionToc`'s heading observer uses, sized to a
 * hub's four or five sections. `aria-current="true"` lands on the section the
 * reader is inside; when nothing is in the band, the previous mark stands,
 * because the reader has not left anything. The observer is created in the
 * effect and disconnected in its cleanup — registered once, released always.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./hub-jump-nav.module.css";

export type HubJumpLink = { href: string; label: string };

export function HubJumpNav({ jumps }: { jumps: HubJumpLink[] }) {
  const [available, setAvailable] = useState<HubJumpLink[]>(jumps);
  const [activeId, setActiveId] = useState<string | null>(null);
  /* The jump list is static per page; the ref keeps the subscription effect's
     dependency list empty so the observer subscribes once and is released
     once. This effect is declared first, so the ref is current before the
     subscription reads it. */
  const jumpsRef = useRef(jumps);
  useEffect(() => {
    jumpsRef.current = jumps;
  }, [jumps]);

  useEffect(() => {
    /* Only anchors are jump-row material; a route link here is a caller bug,
       and dropping it beats silently navigating mid-front. */
    const anchors = jumpsRef.current.filter((jump) => jump.href.startsWith("#"));
    const found = anchors.filter((jump) => document.getElementById(jump.href.slice(1)) !== null);
    setAvailable((current) => (
      current.length === found.length && current.every((jump, i) => jump.href === found[i].href)
        ? current
        : found
    ));

    const targets = found
      .map((jump) => {
        const id = jump.href.slice(1);
        const el = document.getElementById(id);
        if (!el) return null;
        /* The region is the section around the anchor, not the anchor: a
           heading is a few pixels tall and clears the active band almost
           immediately (the same lesson `SectionToc` recorded). Falls back to
           the anchor itself when no section wraps it. */
        return el.closest<HTMLElement>("section, article") ?? el;
      })
      .filter((section): section is HTMLElement => section !== null);

    if (!targets.length) return;

    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) visible.add(target);
          else visible.delete(target);
        }
        const first = targets.find((target) => visible.has(target));
        if (first) setActiveId(first.id);
      },
      /* A band just under the sticky row: a section is "current" while its
         top is in the top eighth of the viewport. */
      { rootMargin: "-8% 0px -78% 0px" },
    );
    for (const target of targets) observer.observe(target);

    return () => observer.disconnect();
  }, []);

  if (!available.length) return null;

  return (
    <nav className={styles.jumps} aria-label="Jump to">
      {available.map((jump) => (
        <Link
          key={jump.href}
          href={jump.href}
          className={styles.jump}
          aria-current={jump.href === `#${activeId}` ? "true" : undefined}
        >
          {jump.label}
        </Link>
      ))}
    </nav>
  );
}
