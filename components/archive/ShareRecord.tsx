'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import { XMediaPostButton } from './XMediaPostButton';
import styles from './archive.module.css';

const NO_SUBSCRIBE = () => () => {};
const probeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverShare = () => false;

export type ShareRecordProps = {
  url: string;
  title: string;
  /** Text-only fallback. Used only when the record has no usable source media. */
  xHref: string;
  facebookHref: string;
  caption: string;
  /**
   * The documentary source asset chosen from this record's own content blocks.
   * Never a cover, thumbnail or OpenGraph image.
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
  const returnTo = `${new URL(url).pathname}${new URL(url).search}`;

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
      // The reader closed the sheet, or the browser refused. Nothing was shared.
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
        This record is kept public so it can be seen — sharing it carries it further.
      </p>
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
