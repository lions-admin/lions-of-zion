import Link from 'next/link';
import {
  type ArchiveMedia,
  type ArchivePackageName,
  type ArchiveRecord as Record,
  type ArchiveVersion,
  displayTitle,
  displayWitness,
} from '@/lib/content/archive';
import { buildXShareText, facebookShareUrl, xIntentUrl } from '@/lib/content/share-text';
import { ArchiveBlocks } from './ArchiveBlocks';
import { ShareRecord } from './ShareRecord';
import styles from './archive.module.css';

export type ArchiveRecordProps = {
  pkg: ArchivePackageName;
  record: Record;
  version: ArchiveVersion;
  media: Map<string, ArchiveMedia>;
  /** `/october-7/testimonies/<slug>` — the default-language URL for this record. */
  basePath: string;
  /** Human name of the archive this came from, shown in the october7 credit. */
  sourceLabel: string;
  /** Absolute canonical URL of the page being rendered — what gets shared. */
  shareUrl: string;
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

export type ArchiveDatelineProps = Omit<
  ArchiveRecordProps,
  'pkg' | 'media' | 'sourceLabel' | 'shareUrl'
>;

/**
 * Who, when, from where — and the language switch — as the record's dateline.
 *
 * Lives in the page shell's `<header>` rather than at the top of the body,
 * which is what it is *for*: `DocPage`'s gold rule is supposed to close a
 * headline block, and with this below it the rule closed a per-package tagline
 * instead, leaving the record's own identity fenced between two horizontal
 * rules ~87px apart, both claiming to end the header. Rendered here and passed
 * up as `dateline`, the anatomy is the one DESIGN-V2 specifies and the one the
 * Geopolitical Brief's `<header>` already has: title, dateline, one rule, then
 * the first piece of actual content.
 *
 * It is a separate export rather than part of `ArchiveRecord` because it has
 * to render in a different place in the tree from the body it describes, and
 * `ArchiveRecordPage` is the one caller that holds both.
 */
export function ArchiveDateline({ record, version, basePath }: ArchiveDatelineProps) {
  const others = record.available_languages.filter((l) => l !== version.locale);
  const published = formatDate(record.publication_date);

  return (
    <>
      {/* No `Archive` pair any more. The source used to be named here *and*
          in the footer; the owner ruled one credit only, and the survivor is
          the footer's, because it is the one that can carry a link
          (`.ai/DECISIONS.md`, 2026-08-27). The `dl` itself is conditional
          now that the pair no longer guarantees it content. */}
      {record.witness_name || published ? (
        <dl className={styles.recordMeta}>
          {record.witness_name ? (
            <div className={styles.metaPair}>
              <dt>Witness</dt>
              <dd>{displayWitness(record.witness_name)}</dd>
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
        </dl>
      ) : null}

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
    </>
  );
}

/**
 * One archive record, in one language.
 *
 * The `<h1>` and the dateline belong to the page shell (`DocPage`), so this
 * renders what sits under the gold rule: the record's content blocks in
 * publication order, and the footer that closes it.
 *
 * The footer's shape is per package, and the asymmetry is an owner decision
 * (`.ai/DECISIONS.md`, 2026-08-27 — "Archive attribution splits by package"):
 *
 *  - **october7** keeps a single reduced credit line, and it is the linked
 *    one — the site address, pointing at the source record.
 *  - **hamas-massacre** carries no credit at all.
 *
 * Both close with the share block: the material is public, and the point of
 * holding it is that it travels. Provenance still reaches machines through
 * the JSON-LD (`isBasedOn`/`holdingArchive`), which is deliberately
 * untouched by the split.
 */
export function ArchiveRecord({
  pkg,
  version,
  media,
  sourceLabel,
  shareUrl,
}: ArchiveRecordProps) {
  const title = displayTitle(version.title);
  const xText = buildXShareText({
    title,
    text: version.full_text ?? version.excerpt ?? null,
    // october7 holds first-person accounts; hamas-massacre holds documented
    // incidents. The closing line names each for what it is.
    kind: pkg === 'october7' ? 'testimony' : 'record',
  });

  return (
    <>
      {/* The record's own words, declared in the record's own language.
          661 of the 1,175 versions are not English, and the root layout's
          `<html lang="en">` is the site's only `lang` — so a screen reader
          was reading a Portuguese or Japanese first-person account with
          English phoneme rules.

          Scoped to the blocks rather than to the whole page on purpose: the
          dateline above and the share footer below stay English, so this is
          the exact seam where the language changes. `dir` is bound for the
          same reason, though every shipped version is `ltr` today.

          The same string `ArchiveRecordPage` sets as the `h1`, so a leading
          heading block that repeats it can be dropped. */}
      <div lang={version.locale} dir={version.direction}>
        <ArchiveBlocks
          pkg={pkg}
          blocks={version.content_blocks}
          media={media}
          renderedTitle={title}
          shareUrl={shareUrl}
          shareTitle={title}
        />
      </div>

      <footer className={styles.recordFooter}>
        <ShareRecord
          url={shareUrl}
          title={title}
          xHref={xIntentUrl(xText, shareUrl)}
          facebookHref={facebookShareUrl(shareUrl)}
          caption={`${xText}\n${shareUrl}`}
        />
        {/* The one surviving credit, october7 only — small, and linked to the
            source record rather than the site's front door, so the claim can
            still be checked without the reader being pulled out mid-record. */}
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

/** The site address alone — "october7.org", not the record's whole slug. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}
