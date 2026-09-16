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
 * to carry.
 *
 * The shell now also serves the October 7 archive, whose longest testimonies
 * run fifteen sections, so `rails="toc"` opts one page into the contents rail
 * and the reading line. It is one rail rather than the section pages' pair:
 * there is no evidence margin here.
 *
 * `rails` and `SectionPage`'s `withToc` are the same switch under two names
 * — the two shells derive the progress bar, the rail and the contents control
 * from it identically, and that is deliberate: a reader should not be able to
 * tell which of the two rendered the page they are on.
 *
 * They are linked from the prose of the pages that mean them, and do not join
 * the radial nav itself (see `.ai/DECISIONS.md`).
 */
import { EditorialShell } from '@/components/site/EditorialShell';
import { Breadcrumb } from '@/components/site/Breadcrumb';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { SectionToc, SectionTocControl } from './SectionToc';
import styles from './sections.module.css';

export interface DocPageProps {
  /** This page's identity — a route id, and the shell's measurement key. */
  routeId: string;
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
   * file" rail above 1220px — the same pair `SectionPage`'s `withToc` turns
   * on, derived in the same place below. Off by default: `/methodology` and
   * `/corrections` are short policy pages with nothing to navigate.
   * `.ai/DECISIONS.md` asked for exactly this — a prop on the existing shell,
   * never a fork.
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
  /* Same one-line page class `SectionPage` builds, minus the accent it has no
     prop for. `.surfaceQuiet`, `.registerMuted` and `.withRails` were all
     here; all three only ever tuned the scan backdrop, and it is gone. */
  const pageClass = styles.page;

  return (
    <EditorialShell
      routeId={routeId}
      showProgress={withToc}
      className={pageClass}
      /* Hides the fixed top bar at ≥1220px, where the rail carries the depth
         line instead. `withToc` is false here means no bar at all, so the
         class is harmless either way — but deriving it identically to
         `SectionPage` is what keeps the two shells one behaviour. */
      progressTrackClassName={withToc ? styles.topProgressTrack : undefined}
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
            <Heading
              level="h1"
              size={titleScale === 'long' ? 'h2' : 'display'}
              className={titleScale === 'long' ? styles.titleLong : styles.title}
              lang={titleLang}
            >
              {title}
            </Heading>
            {tagline ? <p className={styles.lede}>{tagline}</p> : null}
            {dateline}
            <div className={styles.ledeRule} aria-hidden="true" />
          </header>
          {/* Same slot as `SectionPage`'s — under the header, never above the
              headline. See `SectionToc.tsx` for why the control and the rail
              are two components. The running-text grammar is the `Prose`
              primitive (stage 9); `.body` keeps the scroll offsets and the
              accent marker, and `data-toc-source` scopes the rail's heading
              scan to the page body. */}
          {withToc ? <SectionTocControl /> : null}
          <Prose className={styles.body} data-toc-source>
            {children}
          </Prose>
          {/* No closing apparatus — same reasoning as `SectionPage`. These
              two pages already link to each other from their own prose. */}
        </article>
      </div>
    </EditorialShell>
  );
}
