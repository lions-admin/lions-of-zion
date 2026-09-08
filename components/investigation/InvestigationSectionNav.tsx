'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './investigation.module.css';

import type { InvestigationSection } from './labels';

export type { InvestigationSection };

/**
 * The sticky section strip — the case navigator below the rails breakpoint.
 *
 * Above 1220px the section shell already carries a sticky contents rail built
 * from the page's headings (`SectionToc`), and two navigators on one screen
 * would be one too many; this strip hides itself there. Below it, the shell's
 * contents control is a drawer behind a button, which is the wrong shape for
 * a nine-section investigation a reader jumps around in — so the strip is a
 * horizontally scrollable row of native links that stays at the top.
 *
 * Native anchors, not buttons: a section is a place, and a link to it works
 * with no JavaScript, in a new tab, and from a shared URL. The only script
 * here marks which section is in view.
 */
export function InvestigationSectionNav({ sections }: { sections: InvestigationSection[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  /* VA-54. Nine no-wrap pills are about 1319px of strip inside a 343px phone,
     and the scrollbar is hidden by design — so a reader is given no sign that
     six of the nine sections exist. `data-overflow` says which way there is
     more to see and the stylesheet fades that edge. */
  const [edges, setEdges] = useState<"none" | "end" | "start" | "both">("none");

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const slack = list.scrollWidth - list.clientWidth;
    if (slack <= 1) return setEdges("none");
    const atStart = list.scrollLeft <= 1;
    const atEnd = list.scrollLeft >= slack - 1;
    setEdges(atStart ? "end" : atEnd ? "start" : "both");
  }, []);

  useEffect(() => {
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, sections]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return undefined;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        if (visible.size === 0) return;
        // The topmost visible heading is the section being read.
        const [top] = [...visible.entries()].sort((a, b) => a[1] - b[1]);
        setActiveId(top[0]);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [sections]);

  /* Follow the reader down the page. Without this the strip still shows
     section 01 while they are reading 07, which is worse than no strip: it
     reports a position that is not theirs. `nearest` never scrolls the page
     itself, only the strip. */
  useEffect(() => {
    if (!activeId) return;
    const current = listRef.current?.querySelector<HTMLElement>(`[href="#${CSS.escape(activeId)}"]`);
    if (!current) return;
    const still = typeof matchMedia === "function"
      && matchMedia("(prefers-reduced-motion: reduce)").matches;
    current.scrollIntoView({ inline: "nearest", block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [activeId]);

  return (
    <nav className={styles.sectionNav} aria-label="Sections of this case">
      <ol
        ref={listRef}
        className={styles.sectionNavList}
        data-overflow={edges}
        onScroll={measure}
      >
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={styles.sectionNavLink}
              aria-current={activeId === section.id ? 'location' : undefined}
            >
              <span className={styles.sectionNavIndex} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
