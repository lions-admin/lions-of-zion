'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './archive.module.css';

type Props = {
  pkg: 'october7' | 'hamas-massacre';
  recordId: string;
  mediaId: string;
  locale?: string;
  assetUrl: string;
  medium: 'video' | 'image';
  returnTo: string;
  compact?: boolean;
};

type State = 'idle' | 'preparing' | 'ready' | 'downloaded' | 'failed';
type ShareAttempt = 'shared' | 'dismissed' | 'activation-expired' | 'unsupported';

/**
 * Historical component name retained for compatibility with the archive call
 * sites. This action no longer posts through the X API and never starts social
 * OAuth. It hands the original archive file to the operating system share
 * sheet. The separate "Post on X" action remains a normal X Web Intent.
 */
export function XMediaPostButton({
  mediaId,
  assetUrl,
  medium,
  compact = false,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const preparedFile = useRef<File | null>(null);
  const label = compact
    ? 'Share original'
    : medium === 'video'
      ? 'Share original video'
      : 'Share original image';

  const share = async () => {
    if (state === 'preparing') return;

    if (preparedFile.current) {
      const result = await shareFile(preparedFile.current);
      if (result === 'shared' || result === 'dismissed') setState('idle');
      else if (result === 'activation-expired') setState('ready');
      else downloadOriginal(assetUrl, setState);
      return;
    }

    setState('preparing');
    try {
      const response = await fetch(assetUrl, { cache: 'force-cache', mode: 'cors' });
      if (!response.ok) throw new Error('media fetch failed');

      const blob = await response.blob();
      if (!blob.size) throw new Error('empty media file');

      const type = blob.type || (medium === 'video' ? 'video/mp4' : 'image/jpeg');
      const file = new File([blob], mediaFilename(assetUrl, mediaId, medium), { type });
      preparedFile.current = file;

      // Web Share needs transient user activation. Small files can be ready
      // during the original tap; larger videos may outlive it. If activation
      // has expired, retain the prepared file and make the next tap immediate.
      const activation = (
        navigator as Navigator & { userActivation?: { isActive: boolean } }
      ).userActivation;
      if (activation?.isActive === false) {
        setState('ready');
        return;
      }

      const result = await shareFile(file);
      if (result === 'shared' || result === 'dismissed') setState('idle');
      else if (result === 'activation-expired') setState('ready');
      else downloadOriginal(assetUrl, setState);
    } catch {
      // Never fall back to account authorization. If this browser cannot hand
      // the File to a native share target, deliver the original media instead.
      downloadOriginal(assetUrl, setState);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={compact ? 'text' : 'secondary'}
        size="md"
        className={compact ? styles.mediaAction : undefined}
        isLoading={state === 'preparing'}
        onClick={() => void share()}
      >
        {label}
      </Button>
      <span
        className={styles.shareStatus}
        role="status"
        aria-live="polite"
        data-state={state === 'failed' ? 'failed' : state === 'ready' ? 'copied' : undefined}
      >
        {state === 'ready'
          ? `${medium === 'video' ? 'Video' : 'Image'} ready — tap ${label} again, then choose X, Facebook, or another app.`
          : state === 'downloaded'
            ? `Direct file sharing is unavailable here. The original ${medium} was downloaded instead.`
            : state === 'failed'
              ? `Couldn’t prepare the original ${medium}. Use Download instead.`
              : null}
      </span>
    </>
  );
}

async function shareFile(file: File): Promise<ShareAttempt> {
  if (typeof navigator.share !== 'function') return 'unsupported';
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
    return 'unsupported';
  }

  try {
    // Files only: the destination composer receives the actual archived media.
    // The direct X composer and record/caption sharing remain separate actions.
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return 'dismissed';
    if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
      return 'activation-expired';
    }
    return 'unsupported';
  }
}

function mediaFilename(assetUrl: string, mediaId: string, medium: 'video' | 'image'): string {
  let extension = medium === 'video' ? 'mp4' : 'jpg';
  try {
    const name = new URL(assetUrl).pathname.split('/').pop() ?? '';
    const candidate = name.includes('.') ? name.split('.').pop() : null;
    if (candidate && /^[a-z0-9]{2,5}$/i.test(candidate)) extension = candidate.toLowerCase();
  } catch {
    // The archive layer supplies absolute URLs; fallback extension is enough if
    // a malformed value ever reaches this boundary.
  }
  return `october-7-${mediaId}.${extension}`;
}

function downloadOriginal(assetUrl: string, setState: (state: State) => void) {
  try {
    const url = new URL(assetUrl);
    url.searchParams.set('download', '1');
    setState('downloaded');
    window.location.assign(url.toString());
  } catch {
    setState('failed');
  }
}
