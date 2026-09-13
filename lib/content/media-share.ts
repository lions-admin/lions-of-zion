/**
 * What a native file share actually sends — decided here, away from the DOM.
 *
 * `navigator.share` is all-or-nothing: a payload the browser will not take
 * throws instead of degrading, and `navigator.canShare` is the only way to ask
 * first. The question this module answers is which of two payloads to send,
 * and it is worth isolating because the wrong answer is silent in both
 * directions — a caption dropped without warning, or a share refused outright
 * on a device that would have taken the file alone.
 *
 * The rule: prefer the file *with* its caption, because a video that arrives in
 * the X composer with no title and no link back is not a post. Fall back to the
 * file alone rather than to nothing, because the media is the part the reader
 * meant to share. Report `null` only when neither is accepted, which is the
 * caller's signal to save the file and open the composer instead.
 *
 * `canShare` is injected so this is testable without a browser; pass
 * `navigator.canShare?.bind(navigator)` at the call site.
 */

export type MediaSharePayload = { files: File[]; text?: string };

export type CanShare = (data: MediaSharePayload) => boolean;

export function chooseMediaSharePayload(
  file: File,
  text: string,
  canShare?: CanShare,
): MediaSharePayload | null {
  const withCaption: MediaSharePayload = { files: [file], text };
  /* No `canShare` at all means an older Web Share implementation. Files may
     still be refused at `share()` time, and the caller treats that throw as
     "unsupported" — asking a question the browser cannot answer would only
     suppress a share that might have worked. */
  if (!canShare) return withCaption;
  if (canShare(withCaption)) return withCaption;

  const filesOnly: MediaSharePayload = { files: [file] };
  return canShare(filesOnly) ? filesOnly : null;
}
