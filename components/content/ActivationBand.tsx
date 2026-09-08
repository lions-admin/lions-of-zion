'use client';

/**
 * The activation band — how an article or a hub ends (UX-06, UX-20).
 *
 * `docs/editorial-dna.md` §9: the reader is not an audience; the point is that
 * they can act. Until this band, the last thing on an article was its version
 * changelog (Peak-End — the last screen is the one the reader keeps). Three
 * actions and no more, in a fixed order, because more than three is a menu
 * (Hick): trace the sources, take the sourced record with you, report a claim.
 *
 * Activation is sourced material and the ability to check it — never sending
 * a reader at a target. Nothing here links to a person or a post; the share
 * carries this record's own text and address.
 *
 * Props are plain strings so a server page can hand them straight in. When
 * `share.targets` is omitted the band composes X and Facebook itself from the
 * one share-text helper, so a hub needs only `{ text, url }`.
 */
import { useId, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { ShareTarget } from '@/components/support/ShareControls';
import { facebookShareUrl, xIntentUrl } from '@/lib/content/share-text';
import { ShareSheet } from './ShareSheet';
import styles from './activation-band.module.css';

export type ActivationBandShare = {
  /** The canonical address of the record being shared. */
  url: string;
  /** The whole post — what the clipboard receives and the sheet sends. */
  text: string;
  /** Title handed to the system sheet. Falls back to `text`. */
  title?: string;
  /** Pre-composed intent links. Omit to get X and Facebook from `url`/`text`. */
  targets?: readonly ShareTarget[];
};

export type ActivationBandProps = {
  /** Anchor of the page's own source list — `#sources`. Omitted when the
   *  record cites nothing by design; the band then opens with sharing. */
  sourcesHref?: string;
  share?: ActivationBandShare;
  /** The report form. Defaults to the site's one public report path. */
  reportHref?: string;
  heading?: string;
  className?: string;
};

export const ACTIVATION_HEADING = 'Check it yourself.';
export const ACTIVATION_LEAD = 'Everything here is sourced. Take the sources with you, not just the headline.';
export const REPORT_HREF = '/support-us#report';

export function ActivationBand({
  sourcesHref,
  share,
  reportHref = REPORT_HREF,
  heading = ACTIVATION_HEADING,
  className,
}: ActivationBandProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const headingId = useId();
  const targets: readonly ShareTarget[] = share?.targets ?? (share
    ? [
        { label: 'Share on X', href: xIntentUrl(share.text, share.url) },
        { label: 'Facebook', href: facebookShareUrl(share.url) },
      ]
    : []);

  return (
    <aside
      className={[styles.band, className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={styles.heading}>{heading}</h2>
      <p className={styles.lead}>{ACTIVATION_LEAD}</p>
      <div className={styles.actions}>
        {sourcesHref ? (
          <ButtonLink
            href={sourcesHref}
            variant="primary"
            size="md"
            leftIcon={<Icon name="source" size={16} />}
          >
            Trace the sources
          </ButtonLink>
        ) : null}
        {share ? (
          <Button
            type="button"
            /* The one solid fill goes to tracing when there is anything to
               trace; sharing is the primary act only on a record that cites
               nothing by design. */
            variant={sourcesHref ? 'secondary' : 'primary'}
            size="md"
            leftIcon={<Icon name="share" size={16} />}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            Share the sourced record
          </Button>
        ) : null}
        <ButtonLink
          href={reportHref}
          variant="secondary"
          size="md"
          leftIcon={<Icon name="correction" size={16} />}
        >
          Report a claim
        </ButtonLink>
      </div>
      {share ? (
        <ShareSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Share the sourced record"
          description="The link carries the date, the sources and the context — not only the headline."
          url={share.url}
          shareTitle={share.title ?? share.text}
          text={share.text}
          targets={targets}
          copyLabel="Copy the sourced record"
        />
      ) : null}
    </aside>
  );
}
