/**
 * Dossier layout for the eight section pages: a file opened from the scan.
 *
 * The rail carries the section's identity — its SDF emblem, a mono file
 * header whose index is the node's real position in `defaultNodes` — and the
 * content sits on a translucent panel with the corpus still drifting behind
 * it (`ScanBackdrop`). Everything derives from the nav contract in
 * `components/particle-nav/config.ts`, so the hover card, the lede here, and
 * the page metadata stay one sentence in one place.
 */
import Link from 'next/link';
import { defaultNodes } from '@/components/particle-nav/config';
import { ScanBackdrop } from './ScanBackdrop';
import styles from './sections.module.css';

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
  children: React.ReactNode;
}

export function SectionPage({
  id,
  title,
  tagline,
  register = 'default',
  accent = 'gold',
  children,
}: SectionPageProps) {
  const index = defaultNodes.findIndex((node) => node.id === id);
  if (index === -1) throw new Error(`SectionPage: unknown section id "${id}"`);
  const node = defaultNodes[index];
  const lede = tagline ?? node.description;

  const pageClass = [
    styles.page,
    register === 'muted' ? styles.registerMuted : '',
    accent === 'ember' ? styles.accentEmber : '',
  ].join(' ');

  return (
    <main className={pageClass}>
      <ScanBackdrop routeId={id} register={register} />
      <div className={styles.shell}>
        <aside className={styles.rail}>
          <div className={styles.railInner}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the SDF
                bake is blended and tinted in CSS; next/image would re-encode
                the distance field and soften the glyph */}
            <img
              src={node.iconSdfUrl}
              alt=""
              className={styles.emblem}
              width={512}
              height={512}
            />
            <div className={styles.fileMeta}>
              <span className={styles.fileIndex}>
                File {String(index + 1).padStart(2, '0')} / {String(defaultNodes.length).padStart(2, '0')}
              </span>
              <span className={styles.fileRoute}>{node.href}</span>
              <span className={styles.fileStatus}>Monitoring · active</span>
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
        </article>
      </div>
    </main>
  );
}

export function SectionBlock({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.block}>
      <div className={styles.blockHeading}>
        <span className={styles.blockTick} aria-hidden="true" />
        <h2>{heading}</h2>
      </div>
      {children}
    </section>
  );
}
