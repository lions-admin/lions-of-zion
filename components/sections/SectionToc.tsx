'use client';

/**
 * "In this file" — the left rail's document navigation.
 *
 * Built from the rendered headings rather than from a per-page list, because
 * `SectionBlock` already slugifies its heading into an anchor id
 * (`SectionPage.tsx`). Reading the DOM means the rail cannot drift from the
 * content and no page has to declare its own contents twice.
 *
 * Numbering is honest here in a way the deleted file index was not: the
 * sections of one document *are* a sequence you read top to bottom. The eight
 * orbit files were not, which is why that apparatus went (`.ai/DECISIONS.md`).
 *
 * Without JavaScript the rail is absent and the headings remain in the
 * document — the correct trade for a navigation aid, and the same one the
 * scan's DOM links already make.
 */
import { useEffect, useState } from 'react';
import { ReadingProgress } from './ReadingProgress';
import styles from './sections.module.css';

type Heading = { id: string; label: string };

/** A contents list of one entry is noise, not navigation. */
const MIN_HEADINGS = 2;

export function SectionToc() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    /*
     * Discovery runs on the next frame rather than in the effect body. Two
     * reasons, and they point the same way: the headings are an external
     * system to subscribe to (setting state straight from an effect body is
     * the cascading-render pattern React lints against), and one frame in,
     * hydration has settled and the web fonts have had their chance, so the
     * regions the observer measures are the ones the reader will see.
     */
    const frame = requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>('[data-reading-scroll]');
      const source = document.querySelector<HTMLElement>('[data-toc-source]');
      if (!scroller || !source) return;

      /*
     * Two anchor patterns are in use. `SectionBlock` puts the slug on the h2
     * itself; Israel's Story numbers its chapters and puts the id on the
     * surrounding `<article>`. Resolving through the nearest id'd ancestor
     * covers both without either page declaring its contents a second time.
       * The ancestor must be *inside* the body — `closest` would otherwise
       * climb out to `#page-content` and give every heading the same anchor.
       */
      const found = Array.from(source.querySelectorAll<HTMLHeadingElement>('h2'))
        .map((h) => {
          const anchor = h.id ? h : h.closest<HTMLElement>('[id]');
          const usable = anchor && anchor !== source && source.contains(anchor);
          return {
            id: usable ? anchor.id : '',
            label: h.textContent?.trim() ?? '',
            /*
             * What gets observed is the whole section, not the heading. A
             * heading is a few pixels tall and clears the active band almost
             * immediately, which reads correctly scrolling down and wrongly
             * scrolling back up. A section occupies the band for as long as
             * the reader is actually inside it.
             */
            region: h.closest<HTMLElement>('section, article') ?? h,
          };
        })
        .filter((h) => h.id.length > 0 && h.label.length > 0);

      if (found.length < MIN_HEADINGS) return;
      setHeadings(found.map(({ id, label }) => ({ id, label })));
      setActiveId(found[0].id);

      /*
       * The active band is a strip near the top of the scrollport. If nothing
       * is in it — a gap between sections — the previous mark stands rather
       * than clearing, because the reader has not left anything.
       */
      const visible = new Set<HTMLElement>();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const target = entry.target as HTMLElement;
            if (entry.isIntersecting) visible.add(target);
            else visible.delete(target);
          }
          const first = found.find((h) => visible.has(h.region));
          if (first) setActiveId(first.id);
        },
        { root: scroller, rootMargin: '-8% 0px -78% 0px' },
      );

      for (const { region } of found) observer.observe(region);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  if (headings.length < MIN_HEADINGS) return null;

  return (
    <nav className={styles.tocRailInner} aria-label="In this file">
      <p className={styles.tocTitle}>In this file</p>
      <ol className={styles.tocList}>
        {headings.map((heading, i) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={heading.id === activeId ? styles.tocLinkActive : styles.tocLink}
              aria-current={heading.id === activeId ? 'true' : undefined}
            >
              <span className={styles.tocNumber} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{heading.label}</span>
            </a>
          </li>
        ))}
      </ol>
      {/* One instance, two positions: the bar is fixed to the top of the
          viewport below the rail breakpoint and sits here above it, so the
          reader never sees two progress indicators at once. */}
      <ReadingProgress
        trackClassName={styles.depthTrack}
        valueClassName={styles.depthValue}
      />
    </nav>
  );
}
