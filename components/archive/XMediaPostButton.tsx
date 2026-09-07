'use client';

import { useState } from 'react';
import type { XArchiveMediaPostInput, XArchiveMediaPostResponse } from '@/server/contracts/x-media-share';
import { Button } from '@/components/ui/Button';
import styles from './archive.module.css';

type Props = XArchiveMediaPostInput & {
  medium: 'video' | 'image';
  returnTo: string;
  compact?: boolean;
};

type State =
  | { kind: 'idle' }
  | { kind: 'posting' }
  | { kind: 'posted'; url: string }
  | { kind: 'failed'; message: string };

export function XMediaPostButton({
  pkg,
  recordId,
  mediaId,
  locale,
  assetUrl,
  medium,
  returnTo,
  compact = false,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const label = medium === 'video' ? 'Post video on X' : 'Post image on X';

  const post = async () => {
    if (state.kind === 'posting') return;
    setState({ kind: 'posting' });
    try {
      const response = await fetch('/api/october-7/x-post', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pkg, recordId, mediaId, locale, assetUrl }),
      });

      if (response.status === 401 || response.status === 403) {
        const destination = `/auth/x?return_to=${encodeURIComponent(returnTo)}`;
        window.location.assign(destination);
        return;
      }

      const body = (await response.json().catch(() => null)) as XArchiveMediaPostResponse | null;
      if (response.ok && body?.status === 'posted') {
        setState({ kind: 'posted', url: body.postUrl });
        return;
      }

      if (body?.status === 'media_unavailable') {
        setState({
          kind: 'failed',
          message: 'The original archive media is unavailable for native X posting. Use Download or share the record link instead.',
        });
        return;
      }

      if (body?.status === 'post_failed') {
        setState({ kind: 'failed', message: 'X received the media but could not publish the post. Nothing was posted.' });
        return;
      }

      setState({ kind: 'failed', message: 'X could not prepare this original media for posting. Nothing was posted.' });
    } catch {
      setState({ kind: 'failed', message: 'Native X posting is unavailable right now. Nothing was posted.' });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={compact ? 'text' : 'secondary'}
        size={compact ? 'sm' : 'md'}
        className={compact ? styles.mediaAction : undefined}
        isLoading={state.kind === 'posting'}
        onClick={() => void post()}
      >
        {label}
      </Button>
      <span
        className={styles.shareStatus}
        role="status"
        aria-live="polite"
        data-state={state.kind === 'failed' ? 'failed' : state.kind === 'posted' ? 'copied' : undefined}
      >
        {state.kind === 'posted' ? (
          <a href={state.url} target="_blank" rel="noopener noreferrer">Posted on X — view post.</a>
        ) : state.kind === 'failed' ? (
          state.message
        ) : null}
      </span>
    </>
  );
}
