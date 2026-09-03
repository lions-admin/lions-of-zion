'use client';

/**
 * "Share what's verified" — the honest version of a share-CTA. Composes
 * real, already-published content (the Geopolitical Brief, currently the
 * site's most-current verified edition) into a share payload via
 * `navigator.share()`, falling back to a clipboard copy where the Web
 * Share API isn't available. Never claims to share "this page" — Support
 * Us itself has no verified claim to point at, so the copy names what's
 * actually being shared instead of implying more than it does.
 */
import { useState } from 'react';
import { Button, politeLive } from '@/components/ui';
import { SITE_URL } from '@/lib/site-config';
import styles from './share-verified.module.css';

const SHARE_TEXT =
  "Lions of Zion's Geopolitical Brief — verified developments, sourced, with corrections tracked in the open.";
const SHARE_URL = `${SITE_URL}/geopolitical-brief`;

export function ShareVerifiedButton() {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lions of Zion — Geopolitical Brief', text: SHARE_TEXT, url: SHARE_URL });
        return;
      } catch {
        /* user cancelled or the share sheet failed — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — nothing more to do without a permission prompt */
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="md"
        className={styles.share}
        onClick={() => void share()}
      >
        {copied ? 'Copied — paste it anywhere' : "Share what's verified"}
      </Button>
      {/* Spreading politeLive onto the Button would set role="status" and drop
          the control. The copied label is announced from this sibling instead. */}
      <p className={styles.srOnly} {...politeLive}>
        {copied ? 'Copied — paste it anywhere' : ''}
      </p>
    </>
  );
}
