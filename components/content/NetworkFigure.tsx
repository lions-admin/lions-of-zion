import type { NetworkCommunity } from '@/lib/content/fake-resistance-cases';
import styles from './content.module.css';

export type NetworkFigureProps = {
  communities: NetworkCommunity[];
  /** How many cross-community bridges the research documented. */
  bridgeCount: number;
};

/**
 * The graph's actual finding, drawn.
 *
 * The research's headline is negative: seven communities, sparsely bridged —
 * "zero one-blob collapse and zero seven-island separation". A conventional
 * node-link diagram of ~30 accounts would draw a hairball and say the
 * opposite of what the data found, so this figure plots the finding rather
 * than the raw edge list: each community is one disc sized by its membership,
 * arranged on a ring, with the bridge count stated between them.
 *
 * It is inline SVG computed at build time from the imported data, not a
 * committed artifact and not a client-side graph library — the page has to
 * carry its content with no JavaScript like every other reading page here.
 * A `<title>` and the table beneath it carry the same information for anyone
 * who cannot see the drawing.
 */
const SIZE = 520;
const CENTER = SIZE / 2;
const RING = 168;

type Anchor = 'start' | 'middle' | 'end';

/** Radius from membership: area, not radius, tracks node count. */
const discRadius = (count: number) => 26 + Math.sqrt(Math.max(count, 1)) * 9;

export function NetworkFigure({ communities, bridgeCount }: NetworkFigureProps) {
  if (communities.length === 0) return null;

  const placed = communities.map((community, i) => {
    // Start at twelve o'clock so the first community reads as the top of a
    // list rather than as a point on an arbitrary circle.
    const angle = (i / communities.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...community,
      x: CENTER + Math.cos(angle) * RING,
      y: CENTER + Math.sin(angle) * RING,
      r: discRadius(community.nodes.length),
      // Labels on the left half are right-aligned so text runs outward from
      // the ring on both sides instead of overlapping it.
      anchor: (Math.cos(angle) < -0.3
        ? 'end'
        : Math.cos(angle) > 0.3
          ? 'start'
          : 'middle') as Anchor,
    };
  });

  const caption = `${communities.length} communities, ${bridgeCount} documented bridges between them`;

  return (
    <figure className={styles.networkFigure}>
      <div className={styles.networkScroll}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={styles.networkSvg}
          role="img"
          aria-labelledby="network-figure-title"
        >
          <title id="network-figure-title">{caption}</title>

          {/* The ring is the ecosystem, drawn as a boundary rather than as a
              set of connections: what the research found is that these groups
              share a space, not a command structure. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING}
            className={styles.networkRing}
            fill="none"
            strokeDasharray="2 7"
          />

          {placed.map((community) => (
            <g key={community.number}>
              <circle
                cx={community.x}
                cy={community.y}
                r={community.r}
                className={styles.networkDisc}
              />
              <text
                x={community.x}
                y={community.y + 4}
                className={styles.networkCount}
                textAnchor="middle"
              >
                {community.nodes.length}
              </text>
              <text
                x={
                  community.anchor === 'end'
                    ? community.x - community.r - 8
                    : community.anchor === 'start'
                      ? community.x + community.r + 8
                      : community.x
                }
                y={
                  community.anchor === 'middle'
                    ? community.y < CENTER
                      ? community.y - community.r - 10
                      : community.y + community.r + 18
                    : community.y + 4
                }
                className={styles.networkLabel}
                textAnchor={community.anchor}
              >
                {community.name}
              </text>
            </g>
          ))}

          <text x={CENTER} y={CENTER - 6} className={styles.networkCenter} textAnchor="middle">
            {bridgeCount} bridges
          </text>
          <text x={CENTER} y={CENTER + 14} className={styles.networkCenterSub} textAnchor="middle">
            no command structure
          </text>
        </svg>
      </div>
      <figcaption className={styles.networkCaption}>
        Each disc is one community; its number is how many core accounts the
        research placed in it. The groups share an information space and a
        handful of documented bridges — not a shared command structure, which
        the research looked for and did not find.
      </figcaption>
    </figure>
  );
}
