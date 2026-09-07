'use client';

/**
 * The share affordance that closes every archive record — the replacement for
 * the provenance footer (`.ai/DECISIONS.md`, 2026-08-27: the material is
 * public, and the point of holding it is that it travels).
 *
 * Three targets, each built on what the platform actually allows:
 *
 *  - **X** — records with locally-held source media use the authenticated
 *    native-media posting flow; text-only records retain the post intent.
 *  - **Facebook** — `sharer.php` takes only the URL; the text comes from the
 *    page's own OpenGraph tags, which `archiveRecordMetadata` already emits.
 *  - **Instagram has no web intent at all.** Where `navigator.share` exists
 *    (phones, some desktops) a "Share…" button opens the system sheet, where
 *    Instagram appears if installed. Everywhere else the button copies the
 *    caption for pasting, and says so — "Copy caption", never a control
 *    dressed up as one-click posting. "No false live state" is a site
 *    principle, and a fake Instagram button is exactly that defect.
 *
 * The X media action needs a client boundary because it first checks the
 * server-side X write session and may start OAuth. Facebook and text-only X
 * remain plain anchors; the system-sheet/clipboard path retains the same
 * capability probe and honest fallback it had before native X posting.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import { XMediaPostButton } from './XMediaPostButton';
import styles from './archive.module.css';

/**
 * Whether this browser can open the system share sheet.
 *
 * `useSyncExternalStore` rather than a `useState` + `useEffect` probe: the
 * capability is external state React does not own, the server snapshot is
 * `false` so the prerendered HTML never promises a sheet, and there is no
 * setState-in-effect cascade. Nothing to subscribe to — the answer cannot
 * change for the life of the document — so `subscribe` is a no-op.
 */
const NO_SUBSCRIBE = () => () => {};
const probeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverShare = () => false;

export type ShareRecordProps = {
  /** The record page's canonical URL — the one link-based targets receive. */
  url: string;
  title: string;
  /** Prefilled X intent href, used only when no usable source media is held. */
  xHref: string;
  facebookHref: string;
  /** What "Copy caption" copies and the system sheet sends: quote,
      attribution, URL — a post someone can paste anywhere. */
  caption: string;
  /**
   * The documentary source asset chosen from this record's own content blocks.
   * Never a cover, thumbnail, OpenGraph image or generated derivative.
   */
  xMedia?: {
    pkg: 'october7' | 'hamas-massacre';
    recordId: string;
    mediaId: string;
    locale?: string;
    assetUrl: string;
    medium: 'video' | 'image';
  };
};

type CopyState = 'idle' | 'copied' | 'failed';

export function ShareRecord({ url, title, xHref, facebookHref, caption, xMedia }: ShareRecordProps) {
  const canShare = useSyncExternalStore(NO_SUBSCRIBE, probeShare, serverShare);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedUrl = new URL(url);
  const returnTo = `${parsedUrl.pathname}${parsedUrl.search}`;

  // Only a cleanup: a reader who navigates away mid-flash leaves no timer
  // behind to fire against an unmounted component.
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const flash = (state: CopyState) => {
    setCopyState(state);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), 2500);
  };

  const systemShare = async () => {
    try {
      await navigator.share({ title, text: caption, url });
    } catch {
      // The reader closed the sheet, or the browser refused. Either way
      // nothing was shared and nothing needs saying.
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      flash('copied');
    } catch {
      flash('failed');
    }
  };

  return (
    <div className={styles.share}>
      <p className={styles.shareLead}>
        This record is kept public so it can be seen — sharing it carries it
        further.
      </p>
      {/* `md`, not `sm`: the medium size is the Button system's 44px touch
          standard, and this row is pressed with a thumb as often as a mouse.
          The variant, faces, radius and every hover/active/focus/disabled
          state come from the shared Button so the archive speaks in the
          site's one control voice. */}
      <div className={styles.shareRow}>
        {xMedia ? (
          <XMediaPostButton {...xMedia} returnTo={returnTo} />
        ) : (
          <ButtonLink
            href={xHref}
            variant="secondary"
            size="md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on X
          </ButtonLink>
        )}
        <ButtonLink
          href={facebookHref}
          variant="secondary"
          size="md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on Facebook
        </ButtonLink>
        {canShare ? (
          <Button type="button" variant="secondary" size="md" onClick={systemShare}>
            Share…
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="md" onClick={copyCaption}>
            Copy caption
          </Button>
        )}
        {/* One place for the outcome, seen and announced alike. The button's
            own label never changes — feedback that rewrites the control is
            how a reader loses the thing they just pressed. `data-state`
            carries the outcome to the stylesheet's ok/danger inks. */}
        <span
          className={styles.shareStatus}
          role="status"
          aria-live="polite"
          data-state={copyState === 'idle' ? undefined : copyState}
        >
          {copyState === 'copied' ? 'Copied.' : null}
          {copyState === 'failed' ? 'Couldn’t copy.' : null}
        </span>
      </div>
    </div>
  );
}
