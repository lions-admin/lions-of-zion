'use client';

import { useEffect, useState } from 'react';
import styles from './investigation.module.css';

export type InvestigationSection = { id: string; label: string };

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

  return (
    <nav className={styles.sectionNav} aria-label="Sections of this case">
      <ol className={styles.sectionNavList}>
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
