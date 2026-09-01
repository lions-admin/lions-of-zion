/**
 * Section page shell: a file opened from the scan, set as a document.
 *
 * One full-width identity band (wordmark, file number, route, status, the way
 * out), then a genuinely centred reading measure. There is no closing
 * apparatus — the page ends where the content ends.
 *
 * Above 1220px both margins work, which is the whole of "the intelligence
 * desk" direction: the left rail navigates the document and shows depth of
 * read, and the right margin carries the source for the record beside it, so
 * the evidence sits next to the claim instead of in a footnote stack. That
 * placement is CSS only (`content.module.css`) — the citation stays inside its
 * entry in the markup, which is what keeps reading order, screen readers and
 * the no-JS page correct.
 *
 * Everything derives from the navigation contract in
 * `lib/site-navigation.ts`, so the lede here and the page metadata stay one
 * sentence in one place.
 */
import { EditorialShell } from '@/components/site/EditorialShell';
import { getSiteNavigationItem } from '@/lib/site-navigation';
import { SectionToc } from './SectionToc';
import styles from './sections.module.css';

export interface SectionPageProps {
  /** Route id — must match a `SITE_NAVIGATION` entry. */
  id: string;
  title: string;
  /** Defaults to the node's `description`, the same sentence the hover card shows. */
  tagline?: string;
  /** `muted`: the backdrop nearly holds its breath (October 7). */
  register?: 'default' | 'muted';
  /** `ember`: data accents take the hostile-stream ramp (Fake Resistance). */
  accent?: 'gold' | 'ember';
  /** `quiet`: a dimmer scan behind the page, for long reading. */
  surface?: 'default' | 'quiet';
  /**
   * Optional page-level right rail, shown only at ≥1220px. Per-entry sources
   * reach the same margin on their own through `content.module.css`; this is
   * for a page that has something else standing to say there.
   */
  aside?: React.ReactNode;
  /**
   * Ancestors of this page, nearest root first — the same shape and band slot
   * as `DocPage`'s. A hub's child page (`/fake-resistance/playbook`) passes
   * the trail down to its hub: it replaces the inert route span with links,
   * and its last item becomes the exit link's target, so "back" steps one
   * level up instead of jumping past the parent straight home. The
   * eight section pages pass nothing and keep "← Back to Lions of Zion".
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
  aside,
  children,
}: SectionPageProps) {
  const node = getSiteNavigationItem(id);
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
      skipLinkClassName={styles.skipLink}
      progressTrackClassName={styles.topProgressTrack}
      progressValueClassName={styles.topProgressValue}
    >
      <div className={shellClass}>
        <div className={styles.tocRail}>
          <SectionToc />
        </div>

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
          {/* The page ends where the content ends.
              There was an apparatus here — prev/next, a numbered index of the
              other seven files, policy links — and all of it rested on a
              fiction: that these eight are a sequence you read through. They
              are not. The order is the orbit's spoke order, geometry rather
              than reading order, so "next file" pointed at nothing in
              particular. This site is a hub and spokes: the scan is how you
              get somewhere else, and the way back to it is in the identity
              band at the top of every page. Methodology and Corrections are
              linked in context, from sentences that actually mean them. */}
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
    <section className={styles.block}>
      {/* The tick that used to sit beside this heading was a counterweight to
          tracked capitals. A sentence-case serif heading carries itself. */}
      <div className={styles.blockHeading}>
        <h2 id={anchor}>{heading}</h2>
      </div>
      {children}
    </section>
  );
}
