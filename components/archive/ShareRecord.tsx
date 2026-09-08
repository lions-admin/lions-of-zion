'use client';

/**
 * The share affordance that closes every archive record.
 *
 * Two different jobs stay deliberately separate:
 *  - "Post on X" is the ordinary X Web Intent. It opens the X composer with
 *    the record text/link and never asks Lions of Zion for account write access.
 *  - Locally held source media gets an additional "Share original …" action
 *    that hands the actual file to the operating-system share sheet so the
 *    reader can choose X, Facebook, or another installed app.
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
        <ButtonLink
          href={xHref}
          variant="secondary"
          size="md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Post on X
        </ButtonLink>

        {xMedia ? <XMediaPostButton {...xMedia} returnTo={returnTo} /> : null}

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
