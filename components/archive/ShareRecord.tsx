'use client';

/**
 * The share affordance that closes every archive record.
 *
 * Records with a locally held source image/video hand that original file to
 * the operating system share sheet. The reader then chooses X, Facebook or
 * another installed target. This deliberately avoids social-account OAuth and
 * does not ask Lions of Zion for permission to post, delete, read or retain
 * access to a reader's account.
 *
 * Text-only records keep ordinary URL share intents for X/Facebook. The generic
 * system sheet remains available for sharing the record text/link separately.
 */
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
  xHref: string;
  facebookHref: string;
  caption: string;
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
      // authorization flow should ever begin from here.
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
        {xMedia ? (
          <XMediaPostButton {...xMedia} returnTo={returnTo} />
        ) : (
          <>
            <ButtonLink
              href={xHref}
              variant="secondary"
              size="md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on X
            </ButtonLink>
            <ButtonLink
              href={facebookHref}
              variant="secondary"
              size="md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on Facebook
            </ButtonLink>
          </>
        )}

        {canShare ? (
          <Button type="button" variant="secondary" size="md" onClick={systemShare}>
            Share record…
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
