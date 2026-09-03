'use client';

/**
 * The site's one share control (SUPPORT-003).
 *
 * There were two: `ShareVerifiedButton` on /support-us, which rewrote its own
 * label to say "Copied" and swallowed every failure silently, and
 * `ShareRecord` in the archive, which got it right — a fixed label, one status
 * line, outcomes announced. This is the archive's behaviour generalised, and
 * it is deliberately shaped so `ShareRecord` can be migrated onto it without
 * changing what an archive record offers:
 *
 *  - `targets` carries pre-composed intent links (X, Facebook), server-side,
 *    so they work with scripting off. The archive already composes those.
 *  - The system sheet appears only where `navigator.share` exists, probed
 *    through `useSyncExternalStore` so the prerendered HTML never promises it.
 *  - Copying is always offered, because it is the one path that works
 *    everywhere and the one whose success can be announced.
 *
 * Two rules the old support-us control broke:
 *
 *  - **The control's label never changes.** Feedback that rewrites the button
 *    is how a reader loses the thing they just pressed. The outcome goes to
 *    one status line beside it, seen and announced alike.
 *  - **A failure exposes the link itself.** A clipboard write can be refused
 *    (no permission, an insecure origin, a browser that has no clipboard at
 *    all) and the share sheet can be dismissed or blocked. When that happens
 *    the reader is handed the URL in plain text to copy by hand, rather than
 *    a control that did nothing and said nothing.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button, ButtonLink, type ButtonVariant } from '@/components/ui/Button';
import styles from './share-controls.module.css';

/**
 * Whether this browser can open the system share sheet. Nothing to subscribe
 * to — the answer cannot change for the life of the document — and the server
 * snapshot is `false` so the first paint offers only what it can deliver.
 */
const NO_SUBSCRIBE = () => () => {};
const probeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverShare = () => false;

/** A pre-composed external intent link. Composed on the server; works no-JS. */
export type ShareTarget = { label: string; href: string };

export type ShareControlsProps = {
  /** The canonical URL every target receives, and the one shown on failure. */
  url: string;
  /** Title handed to the system sheet. */
  title: string;
  /** What the sheet sends and the clipboard receives — the whole post. */
  text: string;
  targets?: readonly ShareTarget[];
  /** Emphasis of the copy control. Secondary unless this is the one act of a
   *  surface's state, in which case the caller spends its single gold here. */
  copyVariant?: ButtonVariant;
  copyLabel?: string;
  /** Sentence above the row, saying what is being shared. */
  lead?: ReactNode;
  className?: string;
};

type CopyState = 'idle' | 'copied' | 'failed';

export function ShareControls({
  url,
  title,
  text,
  targets = [],
  copyVariant = 'secondary',
  copyLabel = 'Copy the link',
  lead,
  className,
}: ShareControlsProps) {
  const canShare = useSyncExternalStore(NO_SUBSCRIBE, probeShare, serverShare);
  const [state, setState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Only a cleanup: a reader who navigates away mid-flash leaves no timer
     behind to fire against an unmounted component. */
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const clearTimer = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  };

  const copy = async () => {
    clearTimer();
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setState('copied');
      /* Success flashes and goes. A failure does not: it carries the link the
         reader still has to copy by hand, and 2.5 seconds is not long enough
         to read a URL, let alone select one. */
      resetTimer.current = setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('failed');
    }
  };

  const systemShare = async () => {
    clearTimer();
    try {
      await navigator.share({ title, text, url });
      setState('idle');
    } catch (cause) {
      /* A dismissed sheet is not a failure and needs no notice. Anything the
         browser refuses outright does — and the reader gets the link. */
      const dismissed = cause instanceof DOMException && cause.name === 'AbortError';
      setState(dismissed ? 'idle' : 'failed');
    }
  };

  return (
    <div className={[styles.share, className].filter(Boolean).join(' ')}>
      {lead ? <p className={styles.lead}>{lead}</p> : null}

      <div className={styles.row}>
        <Button type="button" variant={copyVariant} size="md" onClick={() => void copy()}>
          {copyLabel}
        </Button>

        {canShare ? (
          <Button type="button" variant="secondary" size="md" onClick={() => void systemShare()}>
            Share…
          </Button>
        ) : null}

        {targets.map((target) => (
          <ButtonLink
            key={target.href}
            href={target.href}
            variant="secondary"
            size="md"
            target="_blank"
            rel="noopener noreferrer"
          >
            {target.label}
          </ButtonLink>
        ))}
      </div>

      {/* One place for the outcome. Polite, not assertive: nothing here blocks
          a reader — the failure branch hands over the link in the same breath
          (STATE-002). `data-state` carries the outcome to the ok/danger inks. */}
      <div
        className={styles.status}
        role="status"
        aria-live="polite"
        data-state={state === 'idle' ? undefined : state}
      >
        {state === 'copied' ? <p className={styles.statusLine}>Copied — paste it anywhere.</p> : null}
        {state === 'failed' ? (
          <p className={styles.statusLine}>
            This browser would not hand over the clipboard. The link is{' '}
            <a className={styles.directLink} href={url}>
              {url}
            </a>{' '}
            — copy it from here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
