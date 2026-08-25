import Image from 'next/image';
import Link from 'next/link';
import lionReference from '@/assets/reference/crowned-lion-particle-reference.png';
import { geopoliticalReferenceBrief as brief } from '@/components/briefs/geopolitical-reference';
import type { NavNode } from './types';
import styles from './styles.module.css';

const GROUPS: { label: string; intent: NonNullable<NavNode['intent']> }[] = [
  { label: 'Now', intent: 'now' },
  { label: 'Understand & verify', intent: 'understand' },
  { label: 'Trust & participate', intent: 'participate' },
];

export function HomeSignalLayer({ nodes }: { nodes: NavNode[] }) {
  return (
    <>
      <div className={styles.desktopOrientation}>
        <header className={styles.desktopBrand}>
          <span className={styles.brandKicker}>Independent evidence network</span>
          <strong>Lions of Zion</strong>
          <p>Truth has a signal.</p>
        </header>

        <Link href="/geopolitical-brief" className={styles.desktopLatest}>
          <span className={styles.latestEyebrow}>{brief.edition}</span>
          <strong>{brief.title}</strong>
          <span>{brief.headline}</span>
          <small>{brief.publishedAt} · {brief.status}</small>
        </Link>

        <div className={styles.desktopLegend} aria-label="Navigation groups">
          <span data-intent="now">Now</span>
          <span data-intent="understand">Understand / verify</span>
          <span data-intent="participate">Trust / participate</span>
        </div>
      </div>

      {/* Order is the message here: after a 47-second intro, whatever this
          screen leads with is what the visitor believes they landed on. It led
          with the latest-brief card once, and a full-width card reading
          "REFERENCE BRIEF · CONFIRMED" made the home page read as the brief
          itself. The eight destinations come first; the brief is a card on the
          menu, not the menu. */}
      <section className={styles.mobileHome} aria-labelledby="mobile-home-title">
        <div className={styles.mobileScanField} aria-hidden="true" />
        <div className={styles.mobileHomeInner}>
          <header className={styles.mobileBrand}>
            <span>Independent evidence network</span>
            <h1 id="mobile-home-title">Lions of Zion</h1>
            <p>Verified developments, documented context, and sources you can inspect.</p>
          </header>

          <div className={styles.mobileLion} aria-hidden="true">
            <Image src={lionReference} alt="" sizes="9rem" />
          </div>

          <nav className={styles.mobileSections} aria-label="Explore Lions of Zion">
            {GROUPS.map((group) => {
              const groupNodes = nodes.filter((node) => node.intent === group.intent);
              return (
                <section key={group.intent} className={styles.mobileGroup}>
                  <h2>{group.label}</h2>
                  <div className={styles.mobileGrid}>
                    {groupNodes.map((node) => (
                      <Link key={node.id} href={node.href} className={styles.mobileSectionLink}>
                        <strong>{node.label}</strong>
                        <span>{node.description}</span>
                        <i aria-hidden="true">↗</i>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </nav>

          <Link href="/geopolitical-brief" className={styles.mobileLatest}>
            <span className={styles.mobileLatestMeta}>
              <span>{brief.edition}</span>
              <span data-status="confirmed">{brief.status}</span>
            </span>
            <strong>{brief.title}</strong>
            <p>{brief.headline}</p>
            <small>Open evidence desk <span aria-hidden="true">↗</span></small>
          </Link>

          <p className={styles.mobileFootnote}>
            Reference edition · sources and status travel with every published item.
          </p>
        </div>
      </section>
    </>
  );
}
