import type { CommunityEdge, NetworkCommunity, NetworkMetrics } from '@/lib/content/fake-resistance-cases';
import styles from './research.module.css';

/**
 * The computed network at the level where it is legible: five communities and
 * the traffic between them.
 *
 * ## Why this replaced a seven-community diagram
 *
 * The section used to draw seven communities joined by five bridges. That was
 * a person's reading of a 21-edge hand-built table. The rebuild computed the
 * partition instead — Louvain over 188 accounts and 595 observed edges — and
 * it came back with five communities, one of which holds about 150 of the
 * accounts. The old picture is not a simplification of the new one; it is a
 * different claim, and it was wrong.
 *
 * ## Why an aggregate and not the accounts
 *
 * 188 nodes is past the size where any node-link drawing tells the truth: the
 * result is a hairball whose shape is an artefact of the layout algorithm.
 * What the graph actually found is at community scale — one dominant subject
 * mass, a small aggregator lane, a smaller state-media lane, two satellites —
 * and that is five circles and nine flows, which a reader can hold. The
 * account-level drawing on this page is the coordination layer, which is
 * 61 accounts and is the only layer whose edges are inferential.
 *
 * ## What the drawing encodes
 *
 * Area is membership. Position is fixed by size, left to right, so two builds
 * of the same data produce the same picture. Line weight is the volume of
 * observed interaction between two communities. Nothing is coloured by
 * community: seven categorical hues over named real people joined by arrows is
 * a conspiracy board, which is the rhetoric this section documents other
 * people using.
 *
 * Control accounts are counted separately inside each circle's label. They are
 * the comparison group — ordinary press and institutional accounts harvested
 * the same way — and a reader who does not know they are in the graph would
 * read their presence in a community as a finding about them.
 */
export function CommunityMap({
  communities,
  communityEdges,
  metrics,
  caveat,
}: {
  communities: NetworkCommunity[];
  communityEdges: CommunityEdge[];
  metrics: NetworkMetrics;
  caveat: string;
}) {
  if (communities.length === 0) return null;

  const width = 720;
  const height = 260;
  const maxSize = Math.max(...communities.map((c) => c.size));
  const radius = (size: number) => 22 + Math.sqrt(size / maxSize) * 48;

  const slot = width / communities.length;
  const placed = communities.map((community, i) => ({
    community,
    x: slot * i + slot / 2,
    y: height / 2,
    r: radius(community.size),
  }));
  const byId = new Map(placed.map((p) => [p.community.id, p]));

  const crossing = communityEdges.filter((e) => !e.internal);
  const maxWeight = Math.max(1, ...crossing.map((e) => e.weight));

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.communityMap}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metrics.nodes ?? 0} accounts in ${communities.length} computed communities, joined by ${crossing.length} measured flows between them.`}
      >
        {crossing.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const mid = (from.x + to.x) / 2;
          const lift = height / 2 - 42 - Math.abs(to.x - from.x) / 12;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              className={styles.communityFlow}
              d={`M ${from.x} ${from.y - from.r} Q ${mid} ${lift} ${to.x} ${to.y - to.r}`}
              style={{ strokeWidth: 1 + (edge.weight / maxWeight) * 5 }}
            />
          );
        })}

        {placed.map(({ community, x, y, r }) => (
          <g key={community.id}>
            <circle className={styles.communityCircle} cx={x} cy={y} r={r} />
            <text className={styles.communitySize} x={x} y={y + 5} textAnchor="middle">
              {community.size}
            </text>
            <text className={styles.communityLabel} x={x} y={y + r + 18} textAnchor="middle">
              {community.label}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className={styles.caption}>
        {metrics.nodes?.toLocaleString('en')} accounts and{' '}
        {metrics.edges?.toLocaleString('en')} observed interaction edges, partitioned into{' '}
        {metrics.communities} communities with {metrics.bridges} structural bridges. Circle
        area is membership; a line between two circles is the volume of observed
        interaction between them, and the arcs above the circles are the crossings. {caveat}
      </figcaption>

      <ul className={styles.communityList}>
        {communities.map((community) => (
          <li key={community.id} className={styles.communityItem}>
            <p className={styles.communityHead}>
              <span className={styles.communityIndex}>
                {String(community.id).padStart(2, '0')}
              </span>
              <b>{community.label}</b>
              <span className={styles.communityCount}>
                {community.size} accounts
                {community.controls > 0
                  ? ` · ${community.controls} of them controls`
                  : ''}
              </span>
            </p>
            {community.note ? <p className={styles.communityNote}>{community.note}</p> : null}
            <p className={styles.communityHubs}>
              <span>Most connected</span>{' '}
              {community.hubs.map((handle) => `@${handle}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
