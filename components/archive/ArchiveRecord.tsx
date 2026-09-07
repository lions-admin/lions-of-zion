import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  type ArchiveMedia,
  type ArchivePackageName,
  type ArchiveRecord as Record,
  type ArchiveVersion,
  displayTitle,
  displayWitness,
} from '@/lib/content/archive';
import { firstArchiveSourceMedia } from '@/lib/content/archive-share';
import { buildXShareText, facebookShareUrl, xIntentUrl } from '@/lib/content/share-text';
import { ArchiveBlocks, type ArchiveSensitivity } from './ArchiveBlocks';
import { ShareRecord } from './ShareRecord';
import styles from './archive.module.css';

/** Which archive this record came from, and therefore how it is read. */
export type ArchiveRecordVariant = 'testimony' | 'documentation';

/** The record either side of this one, in its index's own order. */
export type ArchiveNeighbour = { href: string; title: string; witness?: string | null };

export type ArchiveRecordProps = {
  pkg: ArchivePackageName;
  variant: ArchiveRecordVariant;
  record: Record;
  version: ArchiveVersion;
  media: Map<string, ArchiveMedia>;
  /** `/october-7/testimonies/<slug>` — the default-language URL for this record. */
  basePath: string;
  /** Human name of the archive this came from, shown in the october7 credit. */
  sourceLabel: string;
  /** Absolute canonical URL of the page being rendered — what gets shared. */
  shareUrl: string;
  /** The source's own name for the category it filed this under, if any. */
  categoryName?: string | null;
  /** What this record holds behind a stated choice. */
  sensitivity: ArchiveSensitivity;
  previous?: ArchiveNeighbour | null;
  next?: ArchiveNeighbour | null;
};

const LANGUAGE_NAMES: Readonly<globalThis.Record<string, string>> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
};

export type ArchiveDatelineProps = {
  variant: ArchiveRecordVariant;
  record: Record;
  version: ArchiveVersion;
  basePath: string;
  categoryName?: string | null;
};

/** The identity band under the headline. */
export function ArchiveDateline({
  variant,
  record,
  version,
  basePath,
  categoryName,
}: ArchiveDatelineProps) {
  const others = record.available_languages.filter((l) => l !== version.locale);
  const published = formatDate(record.publication_date);
  const witness = record.witness_name ? displayWitness(record.witness_name) : null;

  const pairs: { label: string; value: ReactNode }[] = [];
  if (variant === 'testimony' && witness) pairs.push({ label: 'Witness', value: witness });
  if (variant === 'documentation' && categoryName) pairs.push({ label: 'Filed under', value: categoryName });
  if (published) {
    pairs.push({
      label: 'Published',
      value: <time dateTime={record.publication_date ?? undefined}>{published}</time>,
    });
  }

  return (
    <>
      {pairs.length > 0 ? (
        <dl className={styles.recordMeta}>
          {pairs.map((pair) => (
            <div key={pair.label} className={styles.metaPair}>
              <dt>{pair.label}</dt>
              <dd>{pair.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {others.length ? (
        <nav className={styles.languages} aria-label="Language of this record">
          <span className={styles.languagesLabel}>Reading in</span>
          <span
            className={styles.languageCurrent}
            lang={version.locale}
            aria-current="true"
          >
            {LANGUAGE_NAMES[version.locale] ?? version.locale}
          </span>
          <span className={styles.languagesAlso}>also in</span>
          {others.map((locale) => (
            <Link
              key={locale}
              className={styles.languageLink}
              href={locale === record.default_language ? basePath : `${basePath}/${locale}`}
              hrefLang={locale}
              lang={locale}
            >
              {LANGUAGE_NAMES[locale] ?? locale}
            </Link>
          ))}
        </nav>
      ) : (
        <p className={styles.languageOnly}>
          Held in{' '}
          <span lang={version.locale}>{LANGUAGE_NAMES[version.locale] ?? version.locale}</span>{' '}
          only.
        </p>
      )}
    </>
  );
}

export function ArchiveRecord({
  pkg,
  variant,
  record,
  version,
  media,
  sourceLabel,
  shareUrl,
  categoryName,
  sensitivity,
  previous,
  next,
}: ArchiveRecordProps) {
  const title = displayTitle(version.title);
  const xText = buildXShareText({
    title,
    text: version.full_text ?? version.excerpt ?? null,
    kind: pkg === 'october7' ? 'testimony' : 'record',
  });
  const sourceMedia = firstArchiveSourceMedia(pkg, version, media);

  const held = countMedia(version);
  const gated =
    sensitivity.gate === 'all'
      ? held.videos + held.images
      : sensitivity.gate === 'video'
        ? held.videos
        : 0;

  return (
    <>
      {gated > 0 ? (
        <aside className={styles.advisory} aria-labelledby="record-advisory">
          <p className={styles.advisoryLabel} id="record-advisory">
            <span className={styles.advisoryMark} aria-hidden="true" />
            Content advisory
          </p>
          <p className={styles.advisoryText}>
            {sensitivity.note} This record holds {describeHeld(held, sensitivity.gate)}.
            {gated === 1 ? ' It stays' : ' They stay'} covered until you choose to open{' '}
            {gated === 1 ? 'it' : 'them'}; nothing here plays by itself.
          </p>
        </aside>
      ) : null}

      <div className={styles.material} lang={version.locale} dir={version.direction}>
        <ArchiveBlocks
          pkg={pkg}
          recordId={record.canonical_story_id}
          locale={version.locale}
          blocks={version.content_blocks}
          media={media}
          sensitivity={sensitivity}
          layout={variant === 'documentation' ? 'exhibit' : 'record'}
          renderedTitle={title}
          shareUrl={shareUrl}
          shareTitle={title}
        />
      </div>

      <footer className={styles.recordFooter}>
        <section className={styles.provenance} aria-labelledby="record-provenance">
          <h2 className={styles.provenanceHeading} id="record-provenance">
            About this record
          </h2>
          <dl className={styles.provenanceList}>
            <div className={styles.provenancePair}>
              <dt>Archive</dt>
              <dd>{sourceLabel}</dd>
            </div>
            {categoryName ? (
              <div className={styles.provenancePair}>
                <dt>Filed under</dt>
                <dd>{categoryName}</dd>
              </div>
            ) : null}
            <div className={styles.provenancePair}>
              <dt>Held here</dt>
              <dd>{describeHolding(held, version)}</dd>
            </div>
            <div className={styles.provenancePair}>
              <dt>Languages</dt>
              <dd>{record.available_languages.map((l) => LANGUAGE_NAMES[l] ?? l).join(', ')}</dd>
            </div>
          </dl>
          {pkg === 'october7' ? (
            <p className={styles.sourceCredit}>
              Archived from {sourceLabel}
              {version.source_url ? (
                <>
                  {' — '}
                  <a href={version.source_url} rel="noopener noreferrer nofollow">
                    {hostOf(version.source_url)}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </section>

        <ShareRecord
          url={shareUrl}
          title={title}
          xHref={xIntentUrl(xText, shareUrl)}
          facebookHref={facebookShareUrl(shareUrl)}
          caption={`${xText}\n${shareUrl}`}
          xMedia={sourceMedia ? {
            ...sourceMedia,
            recordId: record.canonical_story_id,
            locale: version.locale,
          } : undefined}
        />

        {previous || next ? (
          <nav className={styles.neighbours} aria-label="More in this archive">
            {previous ? (
              <Link className={styles.neighbour} href={previous.href} rel="prev">
                <span className={styles.neighbourWay}>Previous</span>
                <span className={styles.neighbourTitle}>{previous.title}</span>
                {previous.witness ? <span className={styles.neighbourWitness}>{previous.witness}</span> : null}
              </Link>
            ) : (
              <span className={styles.neighbourEnd}>This is the first record.</span>
            )}
            {next ? (
              <Link className={`${styles.neighbour} ${styles.neighbourNext}`} href={next.href} rel="next">
                <span className={styles.neighbourWay}>Next</span>
                <span className={styles.neighbourTitle}>{next.title}</span>
                {next.witness ? <span className={styles.neighbourWitness}>{next.witness}</span> : null}
              </Link>
            ) : (
              <span className={`${styles.neighbourEnd} ${styles.neighbourNext}`}>This is the last record.</span>
            )}
          </nav>
        ) : null}
      </footer>
    </>
  );
}

function countMedia(version: ArchiveVersion) {
  let videos = 0;
  let images = 0;
  for (const block of version.content_blocks ?? []) {
    if (block.type === 'video') videos += 1;
    if (block.type === 'image') images += 1;
  }
  return { videos, images };
}

function describeHeld(held: ReturnType<typeof countMedia>, gate: ArchiveSensitivity['gate']) {
  const videos = gate === 'video' || gate === 'all' ? held.videos : 0;
  const images = gate === 'all' ? held.images : 0;
  const parts: string[] = [];
  if (videos) parts.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`);
  if (images) parts.push(`${images} ${images === 1 ? 'image' : 'images'}`);
  return parts.join(' and ');
}

function describeHolding(held: ReturnType<typeof countMedia>, version: ArchiveVersion) {
  const parts: string[] = [];
  if (held.videos) parts.push(`${held.videos} ${held.videos === 1 ? 'video' : 'videos'}`);
  if (held.images) parts.push(`${held.images} ${held.images === 1 ? 'image' : 'images'}`);
  if (version.full_text || version.excerpt) parts.push('text');
  return parts.length ? parts.join(', ') : 'text';
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function hostOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
