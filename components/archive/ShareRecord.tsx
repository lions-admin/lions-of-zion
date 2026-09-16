'use client';

/**
 * The share affordance that closes every archive record.
 *
 * **One quiet path.** The record ends with the archive counted, one way to
 * pass it on, and the neighbours — not a row of social buttons. With source
 * media the one control is `XMediaPostButton`: the same "Post on X" link,
 * except that on a device able to hand files to apps it delivers the actual
 * video or image with a short caption through the operating-system share
 * sheet (owner instruction, 2026-09-13) — the sheet is where the reader picks
 * X, Facebook, or anything else. Without media the control is the system
 * sheet where the browser has one, and a copy of the caption where it does
 * not; the composer link for X then still exists in the caption the reader
 * carries.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui';
import { XMediaPostButton } from './XMediaPostButton';
import { politeLive } from '@/components/ui/live-region';
import styles from './archive.module.css';

const NO_SUBSCRIBE = () => () => {};
const probeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverShare = () => false;

export type ShareRecordProps = {
  url: string;
  title: string;
  xHref: string;
  caption: string;
  xMedia?: {
    pkg: 'october7' | 'hamas-massacre';
    mediaId: string;
    assetUrl: string;
    medium: 'video' | 'image';
  };
};

type CopyState = 'idle' | 'copied' | 'failed';

export function ShareRecord({ url, title, xHref, caption, xMedia }: ShareRecordProps) {
  const canShare = useSyncExternalStore(NO_SUBSCRIBE, probeShare, serverShare);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Dismissed/refused system sheet: nothing changed and no social-account
      // authorization flow starts from this control.
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
      <div className={styles.shareRow}>
        {/* One X control. With source media it delivers the file and the
            caption where the device allows and is the plain composer link
            everywhere else; without media the one quiet path is the system
            sheet where the browser has one, and a copy of the caption where
            it does not. */}
        {xMedia ? (
          <XMediaPostButton
            {...xMedia}
            shareTitle={title}
            shareUrl={url}
            xHref={xHref}
          />
        ) : (
          <>
            {canShare ? (
              <Button type="button" variant="text" size="md" onClick={systemShare}>
                Share record…
              </Button>
            ) : (
              <Button type="button" variant="text" size="md" onClick={copyCaption}>
                Copy caption
              </Button>
            )}
            <span
              className={styles.shareStatus}
              {...politeLive}
              data-state={copyState === 'idle' ? undefined : copyState}
            >
              {copyState === 'copied' ? 'Copied.' : null}
              {copyState === 'failed' ? 'Couldn’t copy.' : null}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
