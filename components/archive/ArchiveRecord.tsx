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

/**
 * The identity band under the headline: who or what this is, and which
 * language you are reading it in.
 *
 * The two archives answer the first question with different facts, and the
 * band no longer pretends otherwise (OCT-004). A testimony is a person and a
 * date; an exhibit is a filing and a date. Neither prints a label whose value
 * is absent — the documentation archive carries no witness on any of its 335
 * records, and a `Witness —` pair on every one of them would be the band's own
 * boilerplate standing where the record's identity belongs.
 *
 * **The language switch stays here rather than in the closing provenance
 * block.** OCT-004 asks for a predictable record template, and it is one:
 * every record puts identity and language in the band, the material in the
 * middle, and provenance, source, share and the neighbours in the footer, in
 * that order, on all ~1,177 pages. Putting the switch at the foot would obey
 * the task's list literally and cost a reader who landed on the Japanese
 * version of a 7,525-word account the whole account before they could leave
 * it.
 */
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
  if (variant === 'testimony' && witness) {
    pairs.push({ label: 'Witness', value: witness });
  }
  if (variant === 'documentation' && categoryName) {
    pairs.push({ label: 'Filed under', value: categoryName });
  }
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

      {/* The language a reader is in has to be *stated*, not implied by which
          chip is inverted (OCT-006). The current one is a non-link marked
          `aria-current`, and the group is named, so a screen reader announces
          "Language of this record — English, current" rather than reading
          seven bare words in a row. */}
      {others.length ? (
        <nav className={styles.languages} aria-label="Language of this record">
          <span className={styles.languagesLabel}>Reading in</span>
          {/* Each label is itself written in the language it names
              ("Português", "日本語"), so it needs `lang` and not only
              `hrefLang` — that one describes the destination, not the text
              a screen reader is about to pronounce. */}
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
      ) : (
        <p className={styles.languageOnly}>
          Held in{' '}
          <span lang={version.locale}>
            {LANGUAGE_NAMES[version.locale] ?? version.locale}
          </span>{' '}
          only.
        </p>
      )}
    </>
  );
}

/**
 * One archive record, in one language — the shared shell both variants wear.
 *
 * The `<h1>`, the identity band and the language switch belong to the page
 * shell (`DocPage`); this renders what sits under the gold rule, in one order
 * that does not change between the two archives (OCT-004):
 *
 *   content warning → material → provenance → source → share → neighbours
 *
 * What changes between them is the *material*, and only that. A testimony is
 * an account, so it renders in the source's publication order with its figures
 * where the witness put them. An exhibit is a film or a photograph, so the
 * media is lifted above the description that names it — see `layout` in
 * `ArchiveBlocks`.
 *
 * The footer's source line is per package, and the asymmetry is an owner
 * decision (`.ai/DECISIONS.md`, 2026-08-27 — "Archive attribution splits by
 * package"): october7 keeps a single reduced credit, linked to the source
 * record; hamas-massacre carries none. Provenance still reaches machines
 * through the JSON-LD (`isBasedOn`/`holdingArchive`), untouched by the split.
 */
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
    // october7 holds first-person accounts; hamas-massacre holds documented
    // incidents. The closing line names each for what it is.
    kind: pkg === 'october7' ? 'testimony' : 'record',
  });

  const held = countMedia(version);
  const gated =
    sensitivity.gate === 'all'
      ? held.videos + held.images
      : sensitivity.gate === 'video'
        ? held.videos
        : 0;

  return (
    <>
      {/* The content warning, before the record rather than inside it. It says
          what is held and that nothing opens by itself — a reader who has
          decided not to look should learn that at the top of the page and not
          by scrolling into it. */}
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

      {/* The record's own words, declared in the record's own language.
          661 of the 1,175 versions are not English, and the root layout's
          `<html lang="en">` is the site's only `lang` — so a screen reader
          was reading a Portuguese or Japanese first-person account with
          English phoneme rules.

          Scoped to the blocks rather than to the whole page on purpose: the
          band above and the footer below stay English, so this is the exact
          seam where the language changes. `dir` is bound for the same reason,
          though every shipped version is `ltr` today.

          The same string `ArchiveRecordPage` sets as the `h1`, so a leading
          heading block that repeats it can be dropped. */}
      <div className={styles.material} lang={version.locale} dir={version.direction}>
        <ArchiveBlocks
          pkg={pkg}
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
              <dd>
                {record.available_languages.map((l) => LANGUAGE_NAMES[l] ?? l).join(', ')}
              </dd>
            </div>
          </dl>
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
        </section>

        <ShareRecord
          url={shareUrl}
          title={title}
          xHref={xIntentUrl(xText, shareUrl)}
          facebookHref={facebookShareUrl(shareUrl)}
          caption={`${xText}\n${shareUrl}`}
        />

        {/* The way on. Both archives are ordered — testimonies newest first,
            exhibits in their category's filing — and a reader who had just
            finished one record could reach the next only by a full round trip
            back through the index. Each link names the record it goes to, so
            it is a destination and not a direction. */}
        {previous || next ? (
          <nav className={styles.neighbours} aria-label="More in this archive">
            {previous ? (
              <Link className={styles.neighbour} href={previous.href} rel="prev">
                <span className={styles.neighbourWay}>Previous</span>
                <span className={styles.neighbourTitle}>{previous.title}</span>
                {previous.witness ? (
                  <span className={styles.neighbourWitness}>{previous.witness}</span>
                ) : null}
              </Link>
            ) : (
              <span className={styles.neighbourEnd}>This is the first record.</span>
            )}
            {next ? (
              <Link
                className={`${styles.neighbour} ${styles.neighbourNext}`}
                href={next.href}
                rel="next"
              >
                <span className={styles.neighbourWay}>Next</span>
                <span className={styles.neighbourTitle}>{next.title}</span>
                {next.witness ? (
                  <span className={styles.neighbourWitness}>{next.witness}</span>
                ) : null}
              </Link>
            ) : (
              <span className={`${styles.neighbourEnd} ${styles.neighbourNext}`}>
                This is the last record.
              </span>
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
    else if (block.type === 'image') images += 1;
  }
  return { videos, images };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What is behind the gates, counted — never described. */
function describeHeld(
  held: { videos: number; images: number },
  gate: ArchiveSensitivity['gate'],
): string {
  const parts: string[] = [];
  if (held.videos > 0) parts.push(plural(held.videos, 'film', 'films'));
  if (gate === 'all' && held.images > 0) {
    parts.push(plural(held.images, 'photograph', 'photographs'));
  }
  return parts.join(' and ');
}

/** What the archive holds of this record, stated rather than assumed. */
function describeHolding(
  held: { videos: number; images: number },
  version: ArchiveVersion,
): string {
  const words = (version.full_text ?? '').split(/\s+/).filter(Boolean).length;
  const parts: string[] = [];
  if (words > 0) parts.push(`${groupDigits(words)} words`);
  if (held.videos > 0) parts.push(plural(held.videos, 'film', 'films'));
  if (held.images > 0) parts.push(plural(held.images, 'photograph', 'photographs'));
  return parts.length ? parts.join(', ') : 'The record’s own text';
}

function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
