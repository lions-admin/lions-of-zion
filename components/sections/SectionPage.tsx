/**
 * Dossier layout for the eight section pages: a file opened from the scan.
 *
 * The rail carries the section's identity — its emblem, a mono file header
 * whose index is the node's real position in `defaultNodes` — and the content
 * sits on a translucent panel with the corpus still drifting behind it
 * (`ScanBackdrop`). Everything derives from the nav contract in
 * `components/particle-nav/config.ts`, so the hover card, the lede here, and
 * the page metadata stay one sentence in one place. The panel closes with a
 * file footer: prev/next in reading order (wrapping at the ends), the full
 * eight-file index, and the way back to the scan.
 */
import Link from 'next/link';
import { defaultNodes } from '@/components/particle-nav/config';
import { ScanBackdrop } from './ScanBackdrop';
import { AskAboutFileCta } from './AskAboutFileCta';
import styles from './sections.module.css';

/*
 * Rail emblems come from the same source artwork the icon bakes are cut from.
 * The SDF PNGs in `public/icons` carry their distance field in an opaque black
 * frame — correct for the GPU sampler, a black square in an `<img>` — so the
 * DOM uses the white source glyphs and tints them gold in CSS, the same way
 * the Geopolitical Brief's rail does.
 */
import fakeResistanceEmblem from '@/assets/source/icons/fake-resistance.svg';
import geopoliticalBriefEmblem from '@/assets/source/icons/geopolitical-brief.svg';
import israelsStoryEmblem from '@/assets/source/icons/israels-story.svg';
import octoberSevenEmblem from '@/assets/source/icons/october-7.svg';
import ourHeroesEmblem from '@/assets/source/icons/our-heroes.svg';
import supportUsEmblem from '@/assets/source/icons/support-us.svg';
import warUpdateEmblem from '@/assets/source/icons/war-update.svg';
import weAreEmblem from '@/assets/source/icons/we-are.svg';

const emblems: Record<string, { src: string }> = {
  'fake-resistance': fakeResistanceEmblem,
  'geopolitical-brief': geopoliticalBriefEmblem,
  'israels-story': israelsStoryEmblem,
  'october-7': octoberSevenEmblem,
  'our-heroes': ourHeroesEmblem,
  'support-us': supportUsEmblem,
  'war-update': warUpdateEmblem,
  'we-are': weAreEmblem,
};

const pad = (n: number) => String(n).padStart(2, '0');

export interface SectionPageProps {
  /** Route id — must match a `defaultNodes` entry. */
  id: string;
  title: string;
  /** Defaults to the node's `description`, the same sentence the hover card shows. */
  tagline?: string;
  /** `muted`: the backdrop nearly holds its breath (October 7). */
  register?: 'default' | 'muted';
  /** `ember`: data accents take the hostile-stream ramp (Fake Resistance). */
  accent?: 'gold' | 'ember';
  /** `quiet`: a more opaque panel over a dimmer scan, for long reading. */
  surface?: 'default' | 'quiet';
  /** Optional right-hand rail, shown only at ≥1220px, in the brief's evidence-rail voice. */
  aside?: React.ReactNode;
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
  const index = defaultNodes.findIndex((node) => node.id === id);
  if (index === -1) throw new Error(`SectionPage: unknown section id "${id}"`);
  const node = defaultNodes[index];
  const lede = tagline ?? node.description;

  const total = defaultNodes.length;
  const prevIndex = (index + total - 1) % total;
  const nextIndex = (index + 1) % total;
  const prev = defaultNodes[prevIndex];
  const next = defaultNodes[nextIndex];

  const pageClass = [
    styles.page,
    register === 'muted' ? styles.registerMuted : '',
    accent === 'ember' ? styles.accentEmber : '',
    surface === 'quiet' ? styles.surfaceQuiet : '',
  ].join(' ');

  const shellClass = [styles.shell, aside ? styles.shellWithAside : '']
    .join(' ')
    .trim();

  return (
    <main className={pageClass}>
      <ScanBackdrop routeId={id} register={register} />
      <div className={shellClass}>
        <aside className={styles.rail}>
          <div className={styles.railInner}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the
                emblem is a static white glyph tinted in CSS; next/image's
                optimizer adds nothing to an already-tiny SVG */}
            <img
              src={emblems[id].src}
              alt=""
              className={styles.emblem}
              width={100}
              height={100}
            />
            <div className={styles.fileMeta}>
              <span className={styles.fileIndex}>
                File {pad(index + 1)} / {pad(total)}
              </span>
              <span className={styles.fileRoute}>{node.href}</span>
              <span className={styles.fileStatus}>Reference edition</span>
              <span className={styles.metaRule} aria-hidden="true" />
            </div>
            <Link href="/" className={styles.back}>
              ← Back to the scan
            </Link>
          </div>
        </aside>

        <article className={styles.panel}>
          <header>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
            <div className={styles.ledeRule} aria-hidden="true" />
          </header>
          <div className={styles.body}>{children}</div>

          <footer className={styles.fileFooter}>
            <div className={styles.footerRule} aria-hidden="true" />
            <nav className={styles.fileNav} aria-label="Adjacent files">
              <Link href={prev.href} className={styles.fileNavLink}>
                <span className={styles.fileNavMeta}>
                  ← Prev file {pad(prevIndex + 1)} / {pad(total)}
                </span>
                <span className={styles.fileNavLabel}>{prev.label}</span>
              </Link>
              <Link
                href={next.href}
                className={`${styles.fileNavLink} ${styles.fileNavNext}`}
              >
                <span className={styles.fileNavMeta}>
                  Next file {pad(nextIndex + 1)} / {pad(total)} →
                </span>
                <span className={styles.fileNavLabel}>{next.label}</span>
              </Link>
            </nav>

            <nav className={styles.destinations} aria-label="All files">
              <span className={styles.destinationsKicker}>
                Index · {pad(total)} files
              </span>
              <ul className={styles.destinationsList}>
                {defaultNodes.map((entry, i) => (
                  <li key={entry.id}>
                    <Link
                      href={entry.href}
                      className={styles.destination}
                      aria-current={entry.id === id ? 'page' : undefined}
                    >
                      <span className={styles.destinationIndex} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.askCtaRow}>
              <AskAboutFileCta href={node.href} />
            </div>

            <nav className={styles.docLinks} aria-label="Policy pages">
              <Link href="/methodology">Methodology</Link>
              <span aria-hidden="true">·</span>
              <Link href="/corrections">Corrections</Link>
            </nav>

            <p className={styles.closeLine}>
              File closed · <Link href="/">Return to the scan</Link>
            </p>
          </footer>
        </article>

        {aside ? (
          <aside className={styles.sideRail}>
            <div className={styles.sideRailInner}>{aside}</div>
          </aside>
        ) : null}
      </div>
    </main>
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
      <div className={styles.blockHeading}>
        <span className={styles.blockTick} aria-hidden="true" />
        <h2 id={anchor}>{heading}</h2>
      </div>
      {children}
    </section>
  );
}
