'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './content.module.css';

export type SensitiveContentProps = {
  /**
   * What the material *is*, in the source's own terms — "Film from The Nova
   * Party Massacre", "Photograph from Abductions to the Gaza Strip". Named
   * rather than implied: a reader deciding whether to look is owed the
   * category before the choice, not a euphemism after it.
   */
  category: string;
  /** One sentence stating what is behind the gate and where it came from. */
  warning: string;
  /**
   * `frame` fills the media frame it is placed inside (`MediaBlock`'s
   * `.frame`), so caption, credit and the provenance row stay outside the
   * gate and remain readable whether or not the reader opens it.
   * `block` is the standalone panel.
   */
  layout?: 'block' | 'frame';
  children: ReactNode;
};

/**
 * Material behind an explicit, stated choice.
 *
 * Five properties are the component, not decoration on it. Each one is a
 * defect somewhere else on the web, and none of them may be traded for a
 * nicer picture:
 *
 *  1. **Nothing is rendered until the reader asks.** `children` is not
 *     mounted while the gate is closed, so no image request is made, no video
 *     metadata is fetched, and nothing sits in the DOM for a screen reader,
 *     a text search, or a screenshot to find. This is also why there is no
 *     blurred preview: a blur is the content, delivered — it leaks the shape,
 *     the colour and the composition, and it un-blurs with one line of CSS in
 *     any developer console.
 *  2. **The category is stated before the choice.** The button says what it
 *     will show and the panel above it says where the material came from.
 *  3. **It is reversible.** "Hide this material" unmounts it again, and
 *     Escape does the same from anywhere inside the revealed region.
 *  4. **Focus moves and comes back.** Revealing moves focus into the region
 *     (which is named, so it announces what was opened); hiding returns focus
 *     to the button that opened it, rather than dropping the reader at the top
 *     of the document.
 *  5. **It remembers nothing.** No storage, no cookie, no per-session flag —
 *     every reader makes the choice for themselves, every visit. A record
 *     that opened silently because of a decision taken ten minutes ago on a
 *     different record is not consent.
 *
 * Autoplay is impossible by construction rather than by attribute: the
 * `<video>` element does not exist until the reveal, and the archive's videos
 * carry `controls` + `preload="metadata"` and no `autoplay`.
 */
export function SensitiveContent({
  category,
  warning,
  layout = 'block',
  children,
}: SensitiveContentProps) {
  const [revealed, setRevealed] = useState(false);
  const baseId = useId();
  const regionId = `${baseId}-region`;
  const categoryId = `${baseId}-category`;

  const revealRef = useRef<HTMLButtonElement | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  /* Focus is moved only in response to a press, never on mount — a record
     holding four gated figures must not fight the reader for the caret. */
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (revealed) regionRef.current?.focus();
    else revealRef.current?.focus();
  }, [revealed]);

  const reveal = useCallback(() => {
    moveFocus.current = true;
    setRevealed(true);
  }, []);

  const hide = useCallback(() => {
    moveFocus.current = true;
    setRevealed(false);
  }, []);

  return (
    <div
      className={styles.sensitive}
      data-sensitive=""
      data-layout={layout}
      data-state={revealed ? 'shown' : 'hidden'}
    >
      {revealed ? null : (
        <div className={styles.sensitiveGate}>
          <p className={styles.sensitiveCategory} id={categoryId}>
            <span className={styles.sensitiveMark} aria-hidden="true" />
            {category}
          </p>
          <p className={styles.sensitiveWarning}>{warning}</p>
          <Button
            ref={revealRef}
            type="button"
            variant="secondary"
            size="md"
            aria-expanded={false}
            aria-controls={regionId}
            onClick={reveal}
          >
            Show this material
          </Button>
        </div>
      )}

      {/* The region exists in both states so `aria-controls` always resolves;
          its *contents* do not, which is what keeps the material off the wire
          until it is asked for. */}
      <div
        ref={regionRef}
        id={regionId}
        className={styles.sensitiveRegion}
        tabIndex={-1}
        role="group"
        aria-label={`${category} — shown`}
        hidden={!revealed}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            hide();
          }
        }}
      >
        {revealed ? (
          <>
            <div className={styles.sensitiveMaterial}>{children}</div>
            <div className={styles.sensitiveClose}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                aria-expanded
                aria-controls={regionId}
                onClick={hide}
              >
                Hide this material
              </Button>
              <span className={styles.sensitiveHint}>
                {category}
                <span className={styles.sensitiveHintKey}> · Esc closes</span>
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
