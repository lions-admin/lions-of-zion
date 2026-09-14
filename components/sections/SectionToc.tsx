'use client';

/**
 * "In this file" — document navigation built from the rendered headings.
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
 * Without JavaScript neither control renders and the headings remain in the
 * document — the correct trade for a navigation aid.
 *
 * ── TWO EXPORTS, ONE CONTENTS ────────────────────────────────────────────
 *
 * `SectionToc` is the sticky rail, shown at ≥1220px in the shell's left
 * margin. `SectionTocControl` is the labelled trigger and its drawer
 * (NAV-006), shown below that seam.
 *
 * They are two components because they belong in two places in the document,
 * and that is the fix rather than the complication. While both rendered from
 * one node in the shell's `.tocRail`, the phone got
 * "On this page — The founding, 1947–1948" printed *above* the `<h1>`: the
 * reader was told where they were inside a document before being told which
 * document. The control now sits under the page's own header, where a
 * contents list belongs, and the rail stays in the margin, where a rail
 * belongs.
 *
 * Both read the same headings through `useDocumentHeadings`, so each keeps
 * its own `IntersectionObserver` over the same handful of sections. That is
 * the whole cost of the split, it is off the main thread, and only one of the
 * two is ever on screen; sharing one observer through a context would mean a
 * provider wrapping the shell to save nothing measurable.
 */
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ReadingProgress } from './ReadingProgress';
import styles from './sections.module.css';

type Heading = { id: string; label: string };

/** A contents list of one entry is noise, not navigation. */
const MIN_HEADINGS = 2;

function Chevron() {
  return (
    <svg className={styles.tocControlChevron} viewBox="0 0 10 6" aria-hidden="true" focusable="false">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/** Headings and section regions are not focusable unless we say so. */
function focusSectionTarget(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  if (target.tabIndex < 0) target.tabIndex = -1;
  target.scrollIntoView();
  target.focus({ preventScroll: true });
  const url = new URL(window.location.href);
  if (url.hash !== `#${id}`) {
    url.hash = id;
    history.pushState(null, '', url);
  }
}

/**
 * The rendered headings, and which of them the reader is inside.
 *
 * One `requestAnimationFrame` to let hydration and the web fonts settle, one
 * `IntersectionObserver` over the sections (never the headings), and nothing
 * else. Returns fewer than `MIN_HEADINGS` entries when the page has nothing
 * worth listing, which is each component's cue to render nothing at all.
 */
function useDocumentHeadings() {
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
      const marked = document.querySelector<HTMLElement>('[data-reading-scroll]');
      const source = document.querySelector<HTMLElement>('[data-toc-source]');
      if (!marked || !source) return;

      /* The reading routes scroll the document as of 2026-08-27, so the
         observer's root is the viewport — `null` — not the marked element.
         Passing a root that is not an ancestor scrollport makes every entry
         report `isIntersecting: false` for the whole page, and the rail would
         mark nothing without erroring. Guarded rather than assumed, so a route
         that declares its own scroller again still works. */
      const isScroller =
        ['auto', 'scroll'].includes(getComputedStyle(marked).overflowY) &&
        marked.scrollHeight > marked.clientHeight;
      const root = isScroller ? marked : null;

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
        { root, rootMargin: '-8% 0px -78% 0px' },
      );

      for (const { region } of found) observer.observe(region);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return { headings, activeId, setActiveId };
}

/**
 * The labelled control and its drawer — the shell mounts this inside the
 * page's own `<article>`, under the header. Hidden at ≥1220px, where the rail
 * below takes over.
 */
export function SectionTocControl() {
  const { headings, activeId, setActiveId } = useDocumentHeadings();
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingFocusId = useRef<string | null>(null);

  const closeSheet = useCallback(() => {
    setOpen(false);
    if (pendingFocusId.current) return;
    triggerRef.current?.focus();
  }, []);

  const onSheetNavigate = useCallback(
    (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      pendingFocusId.current = id;
      setActiveId(id);
      setOpen(false);
    },
    [setActiveId],
  );

  /* Dialog teardown (inert, native focus restore) finishes in its own effect.
     Wait a macrotask so the heading is not focused while the page is still
     inert, then move focus and scroll so the target clears the fixed header. */
  useEffect(() => {
    if (open) return;
    const id = pendingFocusId.current;
    if (!id) return;
    const timeout = window.setTimeout(() => {
      pendingFocusId.current = null;
      focusSectionTarget(id);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (headings.length < MIN_HEADINGS) return null;

  const activeLabel =
    headings.find((heading) => heading.id === activeId)?.label ?? headings[0].label;

  return (
    <>
      <div className={styles.tocControl}>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="md"
          className={styles.tocControlTrigger}
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          <span className={styles.tocControlCopy}>
            <span className={styles.tocControlKicker}>On this page</span>
            <span className={styles.tocControlCurrent}>{activeLabel}</span>
          </span>
          <Chevron />
        </Button>
      </div>

      <Dialog
        id={dialogId}
        open={open}
        onClose={closeSheet}
        title="On this page"
        variant="drawer"
      >
        <ol className={styles.tocSheetList}>
          {headings.map((heading, i) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={
                  heading.id === activeId ? styles.tocSheetLinkActive : styles.tocSheetLink
                }
                aria-current={heading.id === activeId ? 'true' : undefined}
                onClick={onSheetNavigate(heading.id)}
              >
                <span className={styles.tocNumber} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{heading.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}

/**
 * The sticky rail — the shell mounts this in its left margin, where it is
 * shown only at ≥1220px. Below that seam `SectionTocControl` above is the
 * contents list, and this renders nothing a reader can see.
 */
export function SectionToc() {
  const { headings, activeId } = useDocumentHeadings();

  if (headings.length < MIN_HEADINGS) return null;

  return (
    <nav className={styles.tocRailInner} aria-label="On this page">
      <p className={styles.tocTitle}>On this page</p>
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
      {/* One depth reading per screen: the shell's fixed top bar is hidden at
          this seam (`.topProgressTrack`) and this one takes over, so the
          reader never sees two progress indicators at once. */}
      <ReadingProgress
        trackClassName={styles.depthTrack}
        valueClassName={styles.depthValue}
      />
    </nav>
  );
}
