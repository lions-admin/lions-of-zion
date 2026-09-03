import type { CaseEdge, CaseEntity, NetworkCommunity } from '@/lib/content/fake-resistance-cases';
import { InfluenceGraph } from '@/components/network';

export type NetworkFigureProps = {
  roster: CaseEntity[];
  edges: CaseEdge[];
  communities: NetworkCommunity[];
  /** Passed through to the figure's async contract — see `InfluenceGraph`. */
  status?: 'loading' | 'error';
};

/**
 * The network's figure, as this package's content library exposes it.
 *
 * The drawing itself lives in `components/network/` — see `layout.ts` for why
 * it is an arc diagram and `InfluenceGraph.tsx` for the visual grammar. This
 * file stays because it is the name the content barrel exports and the network
 * page imports, and moving that name would be a change to a shared index for
 * no reader-facing gain.
 *
 * ## What replaced what
 *
 * Until 2026-09-02 this rendered a ring of seven discs sized by community
 * membership, on the argument that "a conventional node-link diagram of ~30
 * accounts would draw a hairball and say the opposite of what the data found".
 * Half of that was right and is preserved in the replacement: a force-directed
 * layout would have been unreadable *and* non-deterministic, and community
 * hues would have drawn a conspiracy board.
 *
 * The other half was an over-reading of the data. Thirteen of the thirty-one
 * roster entries carry no edge at all, which leaves eighteen entities and
 * twenty-one edges — about 14% density, average degree 2.3. That is not a
 * hairball; it is a sparse graph, and the ring hid three things it should have
 * shown: which entity is the hub (one has seven edges and the next has four),
 * that the edge data splits into two components that nothing joins, and how
 * well each connection is evidenced. The last of those is the point of the
 * research, and the ring could not say it at all.
 */
export function NetworkFigure({ roster, edges, communities, status }: NetworkFigureProps) {
  /* Degenerate data used to return null here, which made an empty roster
     indistinguishable from a figure that never existed. The figure now owns
     its empty, error, and loading states (NET-004) and says which one it is
     in, so everything passes through. */
  return (
    <InfluenceGraph roster={roster} edges={edges} communities={communities} status={status} />
  );
}
