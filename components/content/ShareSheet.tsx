'use client';

/**
 * The app-owned share sheet (UX-06, UX-19, UX-22).
 *
 * One trigger on the page, every target inside. The article used to lay four
 * share controls across the top of the body and the October 7 showcase five
 * across each card — Hick's law at the moment of least commitment. A reader
 * who has decided to share gets the whole menu here, in a dialog that is
 * named, closes on Escape and returns focus to the control that opened it
 * (`components/ui/Dialog` owns all three). The controls themselves are the
 * shared `ShareControls`, so copy, the system sheet, the intent links and the
 * one status line behave exactly as they do everywhere else.
 *
 * With scripting off the trigger cannot open anything, so the pre-composed
 * intent links — which need no script — are printed in a `<noscript>` beside
 * it. A no-JS reader keeps the two targets that work for them rather than a
 * button that does nothing.
 */
import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { ShareControls, type ShareTarget } from '@/components/support/ShareControls';
import styles from './share-sheet.module.css';

export type ShareSheetProps = {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name — "Share this testimony". */
  title: string;
  /** One sentence under the title: what travels with the link. */
  description?: string;
  /** The canonical URL every target receives. */
  url: string;
  /** Title handed to the system sheet. Falls back to `title`. */
  shareTitle?: string;
  /** What the clipboard receives and the sheet sends — the whole post. */
  text: string;
  /** Pre-composed intent links, in the order they appear. */
  targets?: readonly ShareTarget[];
  /** Native controls that are not intent links — original archive media. */
  actions?: ReactNode;
  copyLabel?: string;
};

export function ShareSheet({
  open,
  onClose,
  title,
  description,
  url,
  shareTitle,
  text,
  targets = [],
  actions,
  copyLabel = 'Copy the link and the text',
}: ShareSheetProps) {
  return (
    <>
      <Dialog open={open} onClose={onClose} title={title} description={description}>
        <ShareControls
          url={url}
          title={shareTitle ?? title}
          text={text}
          copyLabel={copyLabel}
          actions={actions}
          targets={targets}
          className={styles.controls}
        />
      </Dialog>
      {targets.length ? (
        <noscript>
          <p className={styles.noScript}>
            {targets.map((target, index) => (
              <span key={target.href}>
                {index ? ' · ' : null}
                <a href={target.href} target="_blank" rel="noopener noreferrer">
                  {target.label}
                </a>
              </span>
            ))}
          </p>
        </noscript>
      ) : null}
    </>
  );
}
