/**
 * Section page shell: a file opened from the scan, set as a document.
 *
 * A document trail where the page has ancestors, then a genuinely centred
 * reading measure. There is no closing apparatus — the page ends where the
 * content ends.
 *
 * The identity band this shell used to open with (wordmark, file number,
 * route, the way out) is gone: the site header took that job, both shells
 * stopped rendering the band, and its 155 lines of CSS were deleted on
 * 2026-09-02 after a stale claim in CLAUDE.md had kept them alive. What
 * replaced it is better — `.documentTrail` renders the *whole* ancestry as
 * links rather than a single "← Back to {label}".
 *
 * Above 1220px both margins work, which is the whole of "the intelligence
 * desk" direction: the left rail navigates the document and shows depth of
 * read, and the right margin carries the source for the record beside it, so
 * the evidence sits next to the claim instead of in a footnote stack. That
 * placement is CSS only (`content.module.css`) — the citation stays inside its
 * entry in the markup, which is what keeps reading order, screen readers and
 * the no-JS page correct.
 */
import { EditorialShell } from '@/components/site/EditorialShell';
/* Deep import, not the `@/components/motion` barrel: the barrel re-exports
   three more client components, and importing it here would register all four
   as client entries for every page built on this shell to use one. */
import { Reveal } from '@/components/motion/Reveal';
import { Breadcrumb } from '@/components/site/Breadcrumb';
import { getSectionPageNode } from '@/lib/site-navigation';
import { SectionToc } from './SectionToc';
import styles from './sections.module.css';

export interface SectionPageProps {
  /** Route id — a `SITE_NAVIGATION` entry or a `LEGACY_SECTION_PAGES` entry. */
  id: string;
  title: string;
  /** Defaults to the node's `description`, the same sentence the hover card shows. */
  tagline?: string;
  /** `muted`: the backdrop nearly holds its breath (October 7). */
  register?: 'default' | 'muted' | 'silent';
  /** `ember`: data accents take the hostile-stream ramp (Fake Resistance). */
  accent?: 'gold' | 'ember';
  /** `quiet`: a dimmer scan behind the page, for long reading. */
  surface?: 'default' | 'quiet';
  /**
   * Some hub pages are clearer without an auto-generated contents rail.
   * Defaults to true so existing section pages keep their established behavior.
   */
  withToc?: boolean;
  /**
   * Optional page-level right rail, shown only at ≥1220px. Per-entry sources
   * reach the same margin on their own through `content.module.css`; this is
   * for a page that has something else standing to say there.
   */
  aside?: React.ReactNode;
  /**
   * Ancestors of this page, nearest root first — the same shape and the same
   * slot as `DocPage`'s. A hub's child page (`/fake-resistance/playbook`) passes
   * the trail down to its hub, so "back" steps one level up instead of
   * jumping past the parent straight to the scan. Every ancestor is its own
   * link. The eight orbit pages pass nothing and render no trail at all —
   * they have no ancestor but the scan, and the site header reaches it.
   */
  breadcrumb?: { href: string; label: string }[];
  children: React.ReactNode;
}

export function SectionPage({
  id,
  title,
  tagline,
  register = 'default',
  accent = 'gold',
  surface = 'default',
  withToc = true,
  aside,
  breadcrumb,
  children,
}: SectionPageProps) {
  /* A destination, or one of the legacy pages that kept its shell after its
     nav entry folded into a parent (`LEGACY_SECTION_PAGES`). Anything else is
     a route with no contract, and that stays a build-time throw. */
  const node = getSectionPageNode(id);
  if (!node) throw new Error(`SectionPage: unknown section id "${id}"`);
  const lede = tagline ?? node.description;

  const pageClass = [
    styles.page,
    /* Marks the shell as carrying rails, which widens the band the scan keeps
       out of. DocPage shares `.page` and deliberately does not take this. */
    styles.withRails,
    register === 'muted' ? styles.registerMuted : '',
    accent === 'ember' ? styles.accentEmber : '',
    surface === 'quiet' ? styles.surfaceQuiet : '',
  ].join(' ');

  const shellClass = [styles.shell, aside ? styles.shellWithAside : '']
    .join(' ')
    .trim();

  return (
    <EditorialShell
      routeId={id}
      register={register}
      className={pageClass}
      progressTrackClassName={styles.topProgressTrack}
    >
      <div className={shellClass}>
        {/* The trail a hub's child passes down — the shared `Breadcrumb`, the
            same one `DocPage` mounts, so the two shells agree on where a
            page's ancestors are written. The prop was accepted and dropped on
            the floor after the identity band that used to carry it was
            retired in favour of the site header; the five Fake Resistance
            branches and the two archive indexes pass it, and this is what
            renders it. */}
        {breadcrumb && breadcrumb.length > 0 ? (
          <Breadcrumb
            className={styles.documentTrail}
            trail={breadcrumb}
            current={title}
          />
        ) : null}

        {withToc ? (
          <div className={styles.tocRail}>
            <SectionToc />
          </div>
        ) : null}

        <article className={styles.panel} id="page-content">
          <header>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
            <div className={styles.ledeRule} aria-hidden="true" />
          </header>
          {/* `data-toc-source` scopes the rail's heading scan to the page body,
              so it can never pick up an h2 from the chat modal or the rail. */}
          <div className={styles.body} data-toc-source>
            {children}
          </div>
        </article>

        {aside ? (
          <aside className={styles.sideRail}>
            <div className={styles.sideRailInner}>{aside}</div>
          </aside>
        ) : null}
      </div>
    </EditorialShell>
  );
}

/** Anchor slugs keep any letter or digit (headings may be Hebrew), never punctuation. */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function SectionBlock({
  heading,
  id,
  children,
}: {
  heading: string;
  /** Anchor for the h2; derived from the heading when absent. */
  id?: string;
  children: React.ReactNode;
}) {
  const anchor = id ?? (slugify(heading) || undefined);
  return (
    <Reveal as="section" className={styles.block}>
      <div className={styles.blockHeading}>
        <h2 id={anchor}>{heading}</h2>
      </div>
      {children}
    </Reveal>
  );
}
