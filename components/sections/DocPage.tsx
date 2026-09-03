/**
 * Pages that live outside the 8-file orbit (`/methodology`, `/corrections`).
 *
 * Same shell as `SectionPage` — document trail, centred measure — minus the
 * file numbering, since these two have no `defaultNodes` entry. They were a
 * visibly third layout variant before Phase 2 (their back-link floated
 * disconnected above a panel); the variants are one system now.
 *
 * Those two take no rails: they are short policy pages, not documents with
 * sections to navigate or records to cite, so there is nothing for a margin
 * to carry, and leaving `rails` at `'none'` is what keeps the scan reaching in
 * as far as it did — see the note on `.withRails` in sections.module.css.
 *
 * The shell now also serves the October 7 archive, whose longest testimonies
 * run fifteen sections, so `rails="toc"` opts one page into the contents rail
 * and the reading line. It is one rail rather than the section pages' pair:
 * there is no evidence margin here.
 *
 * They are linked from the prose of the pages that mean them and from the
 * scan, and do not join the radial nav itself (see `.ai/DECISIONS.md`).
 */
import { EditorialShell } from '@/components/site/EditorialShell';
import { Breadcrumb } from '@/components/site/Breadcrumb';
import { SectionToc } from './SectionToc';
import styles from './sections.module.css';

export interface DocPageProps {
  /** Seeds the backdrop's corpus sample and doubles as this page's identity. */
  routeId: string;
  /**
   * Overrides the backdrop seed where `routeId` is not unique to the page.
   *
   * `/methodology` and `/corrections` own their route and need nothing here.
   * The archive's ~1,177 routes all pass `routeId="october-7"`, so without
   * this every record drew the same nine corpus fragments in the same places.
   */
  backdropSeed?: string;
  title: string;
  /**
   * The one-line description under the title.
   *
   * Optional because an archive record has nothing page-specific to say here
   * — its two packages supply a constant per-package sentence, and printing
   * boilerplate between the headline and the gold rule made that rule close a
   * piece of chrome rather than the headline. Those records pass a `dateline`
   * instead. `/methodology` and `/corrections` keep their real taglines.
   */
  tagline?: string;

  dateline?: React.ReactNode;
  /**
   * Steps the title down when it is a caption rather than a headline.
   *
   * `--t-display` is a signal about importance and scale. The documentation
   * archive's titles are sentences its source wrote as whole paragraphs — the
   * longest runs 296 characters — and setting one of those in 44px display
   * serif reads as a layout error rather than as gravity.
   */
  titleScale?: 'default' | 'long';
  /**
   * Document navigation, for the pages long enough to need it.
   *
   * `'toc'` adds the reading-progress line at every width and the "In this
   * file" rail above 1220px. Off by default: `/methodology` and `/corrections`
   * are short policy pages with nothing to navigate, and the rail widens the
   * band the scan stays out of, which would quiet it across margins holding
   * nothing. `.ai/DECISIONS.md` asked for exactly this — a prop on the
   * existing shell, never a fork.
   */
  rails?: 'none' | 'toc';
  /**
   * BCP 47 tag for the title, when it is not in the page's language — an
   * archive record translated into Portuguese, say.
   *
   * Deliberately on the `<h1>` alone rather than on the `<main>`: this shell
   * also carries untranslated English chrome (the skip link, the document
   * trail, the tagline, and the record's own metadata and provenance
   * footer), so declaring the whole region foreign would trade one WCAG
   * 3.1.1 failure for a 3.1.2 one.
   */
  titleLang?: string;
  /**
   * Ancestors of this page, nearest root first, rendered as the document
   * trail above the headline.
   *
   * Without one the trail is just "Home / {title}". On a policy page that is
   * fine — `/methodology` and `/corrections` link to each other from their
   * own prose. On an archive record it is not: the prose is a witness account
   * that links to nothing, so moving to the next testimony would cost a full
   * round trip through the particle scene. Each ancestor is its own link, so
   * a deep page steps one level up rather than jumping past its parent
   * straight to the scan.
   */
  breadcrumb?: { href: string; label: string }[];
  children: React.ReactNode;
}

export function DocPage({
  routeId,
  backdropSeed,
  title,
  tagline,
  dateline,
  titleScale = 'default',
  rails = 'none',
  titleLang,
  breadcrumb,
  children,
}: DocPageProps) {
  const withToc = rails === 'toc';
  const pageClass = [
    styles.page,
    styles.surfaceQuiet,
    /* `register="muted"` was declared on the backdrop below and never applied
       here, so the prop cut the row count and left the opacity alone: every
       archive record ran the scan at 0.7 while the `/october-7` hub that owns
       those records ran it at 0.45. Applying the class is what makes the two
       agree. */
    styles.registerMuted,
    /* This shell carries one rail, not the section pages' pair, so widening
       the mask by a single rail is the arithmetic the audit asked for. It is
       not expressible: `.rowField`'s mask is symmetric about 50%, so a
       one-rail widening spends half of itself on the empty right margin and
       leaves the left 124px of the rail — where the contents list actually
       starts — with corpus rows still drifting behind it. `.withRails`
       protects the rail in full and over-quiets a margin that holds nothing,
       which is the cheaper of the two errors. Making it asymmetric means
       reworking the mask itself. */
    withToc ? styles.withRails : '',
  ]
    .join(' ')
    .trim();

  return (
    <EditorialShell
      routeId={routeId}
      backdropSeed={backdropSeed}
      register="muted"
      showProgress={withToc}
      className={pageClass}
      progressTrackClassName={styles.topProgressTrack}
    >
      <div className={styles.shell}>
        <Breadcrumb
          className={styles.documentTrail}
          trail={breadcrumb}
          current={title}
        />

        {withToc ? (
          <div className={styles.tocRail}>
            <SectionToc />
          </div>
        ) : null}

        <article className={styles.panel} id="page-content">
          <header>
            <h1
              className={
                titleScale === 'long' ? styles.titleLong : styles.title
              }
              lang={titleLang}
            >
              {title}
            </h1>
            {tagline ? <p className={styles.lede}>{tagline}</p> : null}
            {dateline}
            <div className={styles.ledeRule} aria-hidden="true" />
          </header>
          {/* `data-toc-source` scopes the rail's heading scan to the page body,
              so it can never pick up an h2 from the chat modal or the rail. */}
          <div className={styles.body} data-toc-source>
            {children}
          </div>
          {/* No closing apparatus — same reasoning as `SectionPage`. These
              two pages already link to each other from their own prose. */}
        </article>
      </div>
    </EditorialShell>
  );
}
