'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { politeLive } from '@/components/ui/live-region';
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
  /**
   * The X Web Intent for this record. When present the control *is* "Post on
   * X": a real link to the composer that, on a device able to hand files to
   * apps, delivers the video instead. Absent, the control is the secondary
   * "Share original …" action beside a media block.
   */
  xHref?: string;
  compact?: boolean;
};

type State = 'idle' | 'preparing' | 'ready' | 'downloaded' | 'failed';
type ShareAttempt = 'shared' | 'dismissed' | 'activation-expired' | 'unsupported';

/**
 * Historical component name retained for compatibility with the archive call
 * sites. This action no longer posts through the X API and never starts social
 * OAuth. It hands the original archive file to the operating system share
 * sheet.
 *
 * **One X control, and the file never travels alone** (owner instruction,
 * 2026-09-13, twice). The record used to offer "Post on X", a Web Intent that
 * can carry text and a link and nothing else — X does not accept media on an
 * intent — beside a second "Share original video" action that carried the file
 * and nothing else. A reader who pressed the one that said X got a composer
 * with a quote and no video; a reader who found the other got a video with no
 * title and no way back. Both paths now carry the same short caption, the
 * record's title and its URL, built by `buildMediaShareText`, and when `xHref`
 * is given they are the same control:
 *
 *  - **Share sheet path.** `navigator.share({ files, text })`. The link lives
 *    inside `text` because Android targets routinely drop the separate `url`
 *    member once `files` is present. A browser that refuses the pair is asked
 *    again for the file alone rather than being given up on. The sheet is the
 *    platform's, so the reader still picks X on it — no web page can name the
 *    receiving app — but X then opens holding the video and the caption.
 *  - **Intent path.** Where files cannot be handed to apps at all — scripting
 *    off, a desktop browser, an old Web Share — the control is the plain link
 *    it renders as, and the composer opens with the text. Where the file was
 *    fetched and then refused, the original is saved to the device and the
 *    composer is opened beside it, so only the attachment is left to the
 *    reader. A blocked popup is offered as an ordinary link instead.
 *
 * Web Share needs transient user activation, and a large video fetched *after*
 * the tap outlives it on iOS. So the file is fetched ahead of the tap, once the
 * control scrolls into view on a device that can share files, and kept in a
 * ref; if it is still not ready when the reader taps, the tap that finishes
 * the fetch asks for one more.
 */
export function XMediaPostButton({
  mediaId,
  assetUrl,
  medium,
  shareTitle,
  shareUrl,
  xHref,
  compact = false,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const [composerHref, setComposerHref] = useState<string | null>(null);
  const preparedFile = useRef<File | null>(null);
  const prefetch = useRef<Promise<File | null> | null>(null);
  const root = useRef<HTMLSpanElement>(null);
  const primary = Boolean(xHref);
  const label = primary
    ? 'Post on X'
    : compact
      ? 'Share original'
      : medium === 'video'
        ? 'Share original video'
        : 'Share original image';

  const caption = buildMediaShareText(shareTitle, shareUrl);
  const composer = xHref ?? xIntentUrl(shareTitle, shareUrl);

  const prepare = () => {
    if (!prefetch.current) {
      prefetch.current = fetchOriginal(assetUrl, mediaId, medium).then((file) => {
        preparedFile.current = file;
        return file;
      });
    }
    return prefetch.current;
  };

  /* Fetch ahead of the tap, but only where the file could go somewhere: a
     browser with no file sharing would download a video for nothing. The
     wrapper is `display: contents`, so the control itself is what is observed. */
  useEffect(() => {
    const control = root.current?.firstElementChild;
    if (!control || !canShareFiles()) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void prepare();
    });
    observer.observe(control);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the asset is fixed for the control's life
  }, [assetUrl]);

  /* The file could not be handed over. Save it, then put the reader in front of
     the X composer with the caption already written, so the only step left is
     attaching what is now on their device. */
  const fallBackToDownload = () => {
    setState(downloadOriginal(assetUrl) ? 'downloaded' : 'failed');
    const opened = window.open(composer, '_blank', 'noopener,noreferrer');
    if (!opened) setComposerHref(composer);
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
    const file = await prepare();
    if (!file) {
      // Never fall back to account authorization. If the original cannot be
      // fetched at all, deliver it as a download and open the composer.
      fallBackToDownload();
      return;
    }

    // Small files can be ready during the original tap; larger videos may
    // outlive it. If activation has expired, keep the prepared file and make
    // the next tap immediate.
    const activation = (
      navigator as Navigator & { userActivation?: { isActive: boolean } }
    ).userActivation;
    if (activation?.isActive === false) {
      setState('ready');
      return;
    }

    settle(await shareFile(file, caption));
  };

  /* As "Post on X" the control is an anchor to the composer. The tap is taken
     over only where the file can actually go to an app; everywhere else the
     link does what a link does. */
  const interceptIntent = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!canShareFiles()) return;
    event.preventDefault();
    void share();
  };

  const status =
    state === 'ready'
      ? `${medium === 'video' ? 'Video' : 'Image'} ready — tap ${label} again, then choose X, Facebook, or another app. The title and the link travel with it.`
      : state === 'downloaded'
        ? `The original ${medium} was saved to your device and X was opened with the title and the link — attach the file there.`
        : state === 'failed'
          ? `Couldn’t prepare the original ${medium}. Use Download instead.`
          : null;

  return (
    <span ref={root} className={styles.mediaShare}>
      {primary ? (
        <ButtonLink
          href={composer}
          variant="secondary"
          size="md"
          target="_blank"
          rel="noopener noreferrer"
          isLoading={state === 'preparing'}
          onClick={interceptIntent}
        >
          {label}
        </ButtonLink>
      ) : (
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
      )}
      <span
        className={styles.shareStatus}
        {...politeLive}
        data-state={state === 'failed' ? 'failed' : state === 'ready' ? 'copied' : undefined}
      >
        {status}
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
    </span>
  );
}

/** Whether this browser can hand a file to an installed app at all. */
function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return true;
  try {
    return navigator.canShare({
      files: [new File([new Uint8Array(1)], 'probe.mp4', { type: 'video/mp4' })],
    });
  } catch {
    return false;
  }
}

async function fetchOriginal(
  assetUrl: string,
  mediaId: string,
  medium: 'video' | 'image',
): Promise<File | null> {
  try {
    const response = await fetch(assetUrl, { cache: 'force-cache', mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size) return null;
    const type = blob.type || (medium === 'video' ? 'video/mp4' : 'image/jpeg');
    return new File([blob], mediaFilename(assetUrl, mediaId, medium), { type });
  } catch {
    return null;
  }
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
 * stays where it is.
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
    return false;
  }
}
