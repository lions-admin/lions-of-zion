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
 * Historical filename retained to keep this focused fix compatible with the
 * archive call sites. The behavior is intentionally no longer X OAuth/API
 * posting: the browser hands the original archive file to the operating
 * system's native share sheet. X, Facebook and other installed share targets
 * receive the actual video/image from the reader's device context, so Lions
 * of Zion never asks for write access to the reader's social account.
 */
export function XMediaPostButton({
  mediaId,
  assetUrl,
  medium,
  compact = false,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const preparedFile = useRef<File | null>(null);
  const label = medium === 'video' ? 'Share video' : 'Share image';

  const share = async () => {
    if (state === 'preparing') return;

    if (preparedFile.current) {
      const result = await shareFile(preparedFile.current);
      if (result === 'shared' || result === 'dismissed') setState('idle');
      else if (result === 'activation-expired') setState('ready');
      else downloadOriginal(assetUrl, medium, mediaId, setState);
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

      // Web Share requires transient user activation. A small file may finish
      // downloading while the original tap is still active; a larger video may
      // not. In the latter case we keep the prepared File in memory and the
      // next tap opens the native sheet immediately — still with no OAuth.
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
      else downloadOriginal(assetUrl, medium, mediaId, setState);
    } catch {
      // If the CDN cannot be fetched as a File by this browser, fall back to
      // the archive's public original-download path rather than starting an
      // account authorization flow.
      downloadOriginal(assetUrl, medium, mediaId, setState);
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
          ? `${medium === 'video' ? 'Video' : 'Image'} ready — tap ${label} again, then choose X or Facebook.`
          : state === 'downloaded'
            ? `Direct app sharing is unavailable here. The original ${medium} was downloaded instead.`
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
    // Files only: this deliberately optimizes for the user request that the
    // original media itself arrives attached in the destination composer.
    // Link/caption sharing remains available separately in the archive UI.
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
    // The asset URL is generated by the archive layer; fallback extension is
    // enough to name the File if a malformed value ever reaches this boundary.
  }
  return `october-7-${mediaId}.${extension}`;
}

function downloadOriginal(
  assetUrl: string,
  medium: 'video' | 'image',
  mediaId: string,
  setState: (state: State) => void,
) {
  try {
    const url = new URL(assetUrl);
    url.searchParams.set('download', '1');
    setState('downloaded');
    window.location.assign(url.toString());
  } catch {
    void medium;
    void mediaId;
    setState('failed');
  }
}
