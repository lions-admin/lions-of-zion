'use client';

/**
 * How a record ends: the archive named and counted, one sentence, one control.
 *
 * "Post on X" never asks Lions of Zion for account write access. Without
 * source media it is the ordinary X Web Intent, which opens the composer with
 * the record text and link. With locally held source media it is
 * `XMediaPostButton`: the same link, except that on a device able to hand
 * files to apps it delivers the actual video or image with a short caption
 * through the operating-system share sheet (owner instruction, 2026-09-13).
 *
 * **One path, not three (2026-09-16).** The row carried "Post on X", "Share on
 * Facebook" and a third control that was the same act again under a system
 * name — three brand-coloured buttons under a witness's account, and a reader
 * asked to choose between them at the one moment the page should be asking for
 * nothing. The single control is the share the device can actually make: the
 * X composer carrying the file where there is one, the operating system's own
 * sheet where there is not, and the caption on the clipboard where neither is
 * possible. Where a reader wants a particular network, the sheet is where the
 * networks live, and the per-file actions on each media block are untouched.
 *
 * Above it, the line that says where this record sits — "One of 179 accounts
 * held here", linked to the index. An archive's ending should name the archive
 * (Peak-End); this one used to end on three logos.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button, politeLive } from '@/components/ui';
import { XMediaPostButton } from './XMediaPostButton';
import { groupDigits } from '@/lib/content/archive-display';
import styles from './archive.module.css';

const NO_SUBSCRIBE = () => () => {};
const probeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverShare = () => false;

export type ShareRecordProps = {
  url: string;
  title: string;
  xHref: string;
  caption: string;
  /**
   * The archive this record belongs to, named and counted — "One of 179
   * accounts held here". The count is the index's own length, not a number
   * written into this file, so it cannot drift from what the index shows.
   */
  archive: { href: string; total: number; noun: string };
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

export function ShareRecord({ url, title, xHref, caption, archive, xMedia }: ShareRecordProps) {
  const canShare = useSyncExternalStore(NO_SUBSCRIBE, probeShare, serverShare);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {/* Where this record sits, and how much else is here. A count is a
          reason to stay; "More in this archive" below it is the way. */}
      <p className={styles.shareHolding}>
        One of{' '}
        <Link className={styles.shareHoldingLink} href={archive.href}>
          {groupDigits(archive.total)} {archive.noun}
        </Link>{' '}
        held here.
      </p>
      <p className={styles.shareLead}>
        This record is kept public so it can be seen — sharing it carries it
        further.
      </p>
      <div className={styles.shareRow}>
        {/* One control. With source media it delivers the file and the
            caption where the device allows and is the plain composer link
            everywhere else; without media it is the device's own sheet, or
            the caption on the clipboard where there is no sheet. */}
        {xMedia ? (
          <XMediaPostButton
            {...xMedia}
            shareTitle={title}
            shareUrl={url}
            xHref={xHref}
          />
        ) : canShare ? (
          <Button type="button" variant="secondary" size="md" onClick={systemShare}>
            Share this record…
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="md" onClick={copyCaption}>
            Copy link and caption
          </Button>
        )}

        <span
          className={styles.shareStatus}
          {...politeLive}
          data-state={copyState === 'idle' ? undefined : copyState}
        >
          {copyState === 'copied' ? 'Copied — the caption and the link are on your clipboard.' : null}
          {copyState === 'failed' ? 'Couldn’t copy. Select the address bar to copy the link.' : null}
        </span>
      </div>
    </div>
  );
}
