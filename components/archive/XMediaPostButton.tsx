'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildMediaShareText, xIntentUrl } from '@/lib/content/share-text';
import { chooseMediaSharePayload } from '@/lib/content/media-share';
import styles from './archive.module.css';

type Props = {
  pkg: 'october7' | 'hamas-massacre';
  recordId: string;
  mediaId: string;
  locale?: string;
  assetUrl: string;
  medium: 'video' | 'image';
  /** The record's own title. Becomes the short caption that travels with the file. */
  shareTitle: string;
  /** The record's canonical URL. Written into the caption, not passed beside it. */
  shareUrl: string;
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
 *
 * **The file never travels alone** (owner instruction, 2026-09-13). Until then
 * this shared `{ files }` and nothing else, so a reader who picked X from the
 * sheet arrived at an empty composer holding a video with no title and no link
 * back — and on a device where file sharing is refused, the video landed in the
 * gallery and the journey ended there. Both paths now carry the same short
 * caption: the record's title and its URL, built by `buildMediaShareText`.
 *
 *  - **Share sheet path.** `navigator.share({ files, text })`. The link lives
 *    inside `text` because Android targets routinely drop the separate `url`
 *    member once `files` is present. A browser that refuses the pair is asked
 *    again for the file alone rather than being given up on.
 *  - **Download path.** The original is saved, and the X composer is opened
 *    with the same title and link so the reader only has to attach the file
 *    they just received. A blocked popup is not a dead end: the composer is
 *    offered as an ordinary link, which no popup blocker can refuse.
 */
export function XMediaPostButton({
  mediaId,
  assetUrl,
  medium,
  shareTitle,
  shareUrl,
  compact = false,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const [composerHref, setComposerHref] = useState<string | null>(null);
  const preparedFile = useRef<File | null>(null);
  const label = compact
    ? 'Share original'
    : medium === 'video'
      ? 'Share original video'
      : 'Share original image';

  const caption = buildMediaShareText(shareTitle, shareUrl);

  /* The file could not be handed over. Save it, then put the reader in front of
     the X composer with the caption already written, so the only step left is
     attaching what is now on their device. */
  const fallBackToDownload = () => {
    setState(downloadOriginal(assetUrl) ? 'downloaded' : 'failed');
    const href = xIntentUrl(shareTitle, shareUrl);
    const opened = window.open(href, '_blank', 'noopener,noreferrer');
    if (!opened) setComposerHref(href);
  };

  const settle = (result: ShareAttempt) => {
    if (result === 'shared' || result === 'dismissed') setState('idle');
    else if (result === 'activation-expired') setState('ready');
    else fallBackToDownload();
  };

  const share = async () => {
    if (state === 'preparing') return;
    setComposerHref(null);

    if (preparedFile.current) {
      settle(await shareFile(preparedFile.current, caption));
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

      settle(await shareFile(file, caption));
    } catch {
      // Never fall back to account authorization. If this browser cannot hand
      // the File to a native share target, deliver the original media instead.
      fallBackToDownload();
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
          ? `${medium === 'video' ? 'Video' : 'Image'} ready — tap ${label} again, then choose X, Facebook, or another app. The title and the link travel with it.`
          : state === 'downloaded'
            ? `The original ${medium} was saved to your device and X was opened with the title and the link — attach the file there.`
            : state === 'failed'
              ? `Couldn’t prepare the original ${medium}. Use Download instead.`
              : null}
      </span>
      {composerHref ? (
        <a
          className={styles.mediaAction}
          href={composerHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open X and attach the {medium}
        </a>
      ) : null}
    </>
  );
}

async function shareFile(file: File, text: string): Promise<ShareAttempt> {
  if (typeof navigator.share !== 'function') return 'unsupported';

  /* The caption is what makes the shared file a post rather than an orphaned
     video. `chooseMediaSharePayload` decides whether this browser will take
     both, and falls back to the file alone before it gives up. */
  const payload = chooseMediaSharePayload(
    file,
    text,
    typeof navigator.canShare === 'function' ? navigator.canShare.bind(navigator) : undefined,
  );
  if (!payload) return 'unsupported';

  try {
    await navigator.share(payload);
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

/**
 * Save the original without leaving the record. The asset is served with a
 * download disposition under `?download=1`, so an anchor click hands it to the
 * browser's downloader and the page — and the X composer opened beside it —
 * stays where it is. `location.assign` used to do this and would have raced the
 * new tab.
 */
function downloadOriginal(assetUrl: string): boolean {
  try {
    const url = new URL(assetUrl);
    url.searchParams.set('download', '1');
    const anchor = document.createElement('a');
    anchor.href = url.toString();
    anchor.rel = 'noopener';
    anchor.download = '';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    // A malformed asset URL cannot reach here from the archive layer; if one
    // ever does, the composer link below is still offered.
    return false;
  }
}
