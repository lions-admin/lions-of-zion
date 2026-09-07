'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button, ButtonLink, type ButtonVariant } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import styles from './share-controls.module.css';

const NO_SUBSCRIBE = () => () => {};
const probeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverShare = () => false;

export type ShareTarget = { label: string; href: string };

export type ShareControlsProps = {
  url: string;
  title: string;
  text: string;
  targets?: readonly ShareTarget[];
  /** Real interactive share actions, such as authenticated native X media posting. */
  actions?: ReactNode;
  copyVariant?: ButtonVariant;
  copyLabel?: string;
  lead?: ReactNode;
  className?: string;
};

type CopyState = 'idle' | 'copied' | 'failed';

export function ShareControls({
  url,
  title,
  text,
  targets = [],
  actions,
  copyVariant = 'secondary',
  copyLabel = 'Copy the link',
  lead,
  className,
}: ShareControlsProps) {
  const canShare = useSyncExternalStore(NO_SUBSCRIBE, probeShare, serverShare);
  const [state, setState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const dismissed = cause instanceof DOMException && cause.name === 'AbortError';
      setState(dismissed ? 'idle' : 'failed');
    }
  };

  return (
    <div className={[styles.share, className].filter(Boolean).join(' ')}>
      {lead ? <p className={styles.lead}>{lead}</p> : null}

      <div className={styles.row}>
        <Button
          type="button"
          variant={copyVariant}
          size="md"
          leftIcon={<Icon name="document" size={16} />}
          onClick={() => void copy()}
        >
          {copyLabel}
        </Button>

        {canShare ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            leftIcon={<Icon name="share" size={16} />}
            onClick={() => void systemShare()}
          >
            Share…
          </Button>
        ) : null}

        {actions}

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
