/**
 * Section page shell: a file opened from the scan, set as a document.
 *
 * One full-width identity band (wordmark, file number, route, status, the way
 * out), then a genuinely centred reading measure, then a two-row footer. The
 * shell this replaced offset the reading column against a 15rem emblem rail,
 * which pushed the text right of centre and spent ~320px on ceremony before
 * the first sentence — see `.ai/DESIGN-V2.md`.
 *
 * Everything derives from the nav contract in
 * `components/particle-nav/config.ts`, so the hover card, the lede here, and
 * the page metadata stay one sentence in one place.
 */
import Link from 'next/link';
import { defaultNodes } from '@/components/particle-nav/config';
import { ScanBackdrop } from './ScanBackdrop';
import { ReadingProgress } from './ReadingProgress';
import styles from './sections.module.css';

/*
 * Emblems come from the same source artwork the icon bakes are cut from.
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
    <main className={pageClass} data-reading-scroll>
      <a href="#page-content" className={styles.skipLink}>
        Skip to content
      </a>
      <ReadingProgress />
      <ScanBackdrop routeId={id} register={register} />
      <div className={shellClass}>
        <div className={styles.identityBand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the
              emblem is a static white glyph tinted in CSS; next/image's
              optimizer adds nothing to an already-tiny SVG */}
          <img
            src={emblems[id].src}
            alt=""
            className={styles.identityEmblem}
            width={26}
            height={26}
          />
          <Link href="/" className={styles.wordmark}>
            Lions of Zion
          </Link>
          <span className={styles.identityMeta}>
            <span className={styles.identitySep} aria-hidden="true">
              ·
            </span>
            <span>
              File {pad(index + 1)} / {pad(total)}
            </span>
            <span className={styles.identityRoute}>{node.href}</span>
            <span>Reference edition</span>
          </span>
          <Link href="/" className={styles.identityExit}>
            ← Back to the scan
          </Link>
        </div>

        <article className={styles.panel} id="page-content">
          <header>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
            <div className={styles.ledeRule} aria-hidden="true" />
          </header>
          <div className={styles.body}>{children}</div>
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
      {/* The tick that used to sit beside this heading was a counterweight to
          tracked capitals. A sentence-case serif heading carries itself. */}
      <div className={styles.blockHeading}>
        <h2 id={anchor}>{heading}</h2>
      </div>
      {children}
    </section>
  );
}
