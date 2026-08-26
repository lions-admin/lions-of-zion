import Link from 'next/link';
import {
  type ArchiveMedia,
  type ArchivePackageName,
  type ArchiveRecord as Record,
  type ArchiveVersion,
  displayTitle,
} from '@/lib/content/archive';
import { ArchiveBlocks } from './ArchiveBlocks';
import styles from './archive.module.css';

export type ArchiveRecordProps = {
  pkg: ArchivePackageName;
  record: Record;
  version: ArchiveVersion;
  media: Map<string, ArchiveMedia>;
  /** `/october-7/testimonies/<slug>` — the default-language URL for this record. */
  basePath: string;
  /** Human name of the archive this came from, shown in the provenance note. */
  sourceLabel: string;
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

/**
 * One archive record, in one language.
 *
 * The `<h1>` belongs to the page shell (`DocPage`), so this renders everything
 * below it: the record's own metadata, the language switch, its content blocks
 * in publication order, and the provenance note that closes it.
 *
 * The provenance note is the one place a record links out, and it links to the
 * source *record* rather than the source site's front door. That is the shape
 * the decision asks for: a reader is never pulled out mid-sentence, but the
 * claim can always be checked.
 */
export function ArchiveRecord({
  pkg,
  record,
  version,
  media,
  basePath,
  sourceLabel,
}: ArchiveRecordProps) {
  const others = record.available_languages.filter((l) => l !== version.locale);
  const published = formatDate(record.publication_date);

  return (
    <>
      <div className={styles.recordHeader}>
        <dl className={styles.recordMeta}>
          {record.witness_name ? (
            <div className={styles.metaPair}>
              <dt>Witness</dt>
              <dd>{record.witness_name}</dd>
            </div>
          ) : null}
          {published ? (
            <div className={styles.metaPair}>
              <dt>Published</dt>
              <dd>
                <time dateTime={record.publication_date ?? undefined}>{published}</time>
              </dd>
            </div>
          ) : null}
          <div className={styles.metaPair}>
            <dt>Archive</dt>
            <dd>{sourceLabel}</dd>
          </div>
        </dl>

        {others.length ? (
          <nav className={styles.languages} aria-label="Languages">
            <span className={styles.languagesLabel}>Read in</span>
            {/* Each label is itself written in the language it names
                ("Português", "日本語"), so it needs `lang` and not only
                `hrefLang` — that one describes the destination, not the text
                a screen reader is about to pronounce. */}
            <span className={styles.languageCurrent} lang={version.locale}>
              {LANGUAGE_NAMES[version.locale] ?? version.locale}
            </span>
            {others.map((locale) => (
              <Link
                key={locale}
                className={styles.languageLink}
                href={
                  locale === record.default_language ? basePath : `${basePath}/${locale}`
                }
                hrefLang={locale}
                lang={locale}
              >
                {LANGUAGE_NAMES[locale] ?? locale}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {/* The record's own words, declared in the record's own language.
          661 of the 1,175 versions are not English, and the root layout's
          `<html lang="en">` is the site's only `lang` — so a screen reader
          was reading a Portuguese or Japanese first-person account with
          English phoneme rules.

          Scoped to the blocks rather than to the whole page on purpose: the
          metadata above and the provenance footer below stay English, so
          this is the exact seam where the language changes. `dir` is bound
          for the same reason, though every shipped version is `ltr` today.

          The same string `ArchiveRecordPage` sets as the `h1`, so a leading
          heading block that repeats it can be dropped. */}
      <div lang={version.locale} dir={version.direction}>
        <ArchiveBlocks
          pkg={pkg}
          blocks={version.content_blocks}
          media={media}
          renderedTitle={displayTitle(version.title)}
        />
      </div>

      <footer className={styles.provenance}>
        <p>
          Archived from {sourceLabel}. This record is reproduced as published —
          its text, its media and its credits are unaltered.
        </p>
        {version.source_url ? (
          <p>
            Source record:{' '}
            <a href={version.source_url} rel="noopener noreferrer nofollow">
              {displayUrl(version.source_url)}
            </a>
          </p>
        ) : null}
      </footer>
    </>
  );
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The URL without its scheme — a citation reads better than a raw link. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
