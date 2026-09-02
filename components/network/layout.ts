import type { CaseEdge, CaseEntity, NetworkCommunity } from '@/lib/content/fake-resistance-cases';
import { communityOf, ungroupedRole } from '@/lib/content/fake-resistance-network-communities';

/**
 * The geometry of the influence graph, computed once on the server.
 *
 * ## Why an arc diagram and not a node-link graph
 *
 * The figure this replaces carried a standing objection in its own docstring:
 * a node-link diagram of ~30 accounts "would draw a hairball and say the
 * opposite of what the data found". The objection is right about hairballs and
 * wrong about this data, and the difference is worth writing down because it
 * is the whole reason this file exists.
 *
 * A hairball is what a *force-directed* layout produces on a *dense* graph.
 * The synthesis graph is neither. Of 31 roster rows, 13 carry no edge at all —
 * they are context the research collected, not connections it drew. That
 * leaves **18 entities joined by 21 edges**: a density of about 14%, an
 * average degree of 2.3, and two connected components. At that size and that
 * sparsity a node-link drawing is not merely possible, it is the form the data
 * is asking for; the hairball risk lives above roughly fifty nodes and a
 * hundred edges, and this is a third of the first and a fifth of the second.
 *
 * What is true is that a *force-directed* layout would still be wrong here,
 * for reasons that have nothing to do with density: it is non-deterministic,
 * so the same evidence would draw a different picture on each build, and its
 * node positions carry no meaning a reader can name. An evidence page cannot
 * ship a diagram whose shape is an artifact of a random seed.
 *
 * So the layout is an **arc diagram**: nodes on one axis in a stated order,
 * edges as arcs beside them. Three properties make it the right form here.
 *
 * 1. **Node positions mean something and can be stated.** The order is
 *    component, then community, then degree — printed in the gutter, and
 *    reproducible by hand from the data.
 * 2. **It cannot hairball.** Positions are a one-dimensional ordering, so
 *    arcs nest and cross in a bounded, readable way instead of piling into a
 *    centre of mass.
 * 3. **It degrades to a list**, which is what this site needs more than it
 *    needs a picture. Strip the arcs and the remaining DOM is a labelled,
 *    ordered roster — legible with no JavaScript, on a phone, and to a screen
 *    reader, with no second component to maintain.
 *
 * The ordering also does the explaining. Arcs inside a community are short and
 * hug the axis; arcs between communities swing wide. The research's headline
 * finding — dense inside groups, sparsely bridged between them — is the shape
 * of the drawing rather than a caption under it.
 *
 * ## Geometry units
 *
 * Every number below is a viewBox unit, not a pixel. The arc layer renders
 * with `preserveAspectRatio="none"` over a box whose real height is
 * `rows × --row-h` in CSS, so these units only ever have to agree with each
 * other. Changing a type token changes the row height and the arcs follow with
 * no constant here to keep in sync.
 */

/** One row's height, in viewBox units. */
export const ROW_H = 32;

/** Width of the arc gutter, in viewBox units. */
export const ARC_W = 200;

/** Keeps the widest arc off the gutter's outer edge. */
const ARC_PAD = 8;

export type GraphNode = {
  entity: CaseEntity;
  /** 0-based position in the ordering. */
  row: number;
  /** How many edges touch this entity. */
  degree: number;
  /** `"1"`–`"7"`, or undefined for an entity the research placed in none. */
  community?: string;
  /** For an ungrouped entity, the research's own word for what it is. */
  role?: string;
  /** 0-based connected-component index, largest component first. */
  component: number;
};

export type GraphArc = {
  edge: CaseEdge;
  fromRow: number;
  toRow: number;
  /** Rows spanned — the arc's radius, and how far apart the ordering puts them. */
  span: number;
  /** SVG path data for the arc layer. */
  d: string;
};

/** A contiguous run of rows sharing a community, bracketed in the gutter. */
export type GraphGroup = {
  key: string;
  /** The community's name, or the research's role word for ungrouped rows. */
  label: string;
  /** `"1"`–`"7"` where there is one. */
  number?: string;
  startRow: number;
  endRow: number;
  size: number;
};

export type GraphComponent = {
  index: number;
  startRow: number;
  endRow: number;
  size: number;
};

export type GraphLayout = {
  nodes: GraphNode[];
  arcs: GraphArc[];
  groups: GraphGroup[];
  components: GraphComponent[];
  /** Roster entries carrying no edge. Named below the figure, not drawn in it. */
  isolated: CaseEntity[];
  /** viewBox for the arc layer. */
  viewBox: string;
  rowCount: number;
};

/** Edges the research recorded twice in the same direction would double-count. */
const edgeKey = (edge: CaseEdge) => `${edge.fromId}|${edge.toId}|${edge.relation}`;

/**
 * Component, then community, then degree — and every tie broken by a stable
 * value so two builds of the same data produce the same picture.
 */
function orderNodes(
  entities: Map<string, CaseEntity>,
  degree: Map<string, number>,
  componentOf: Map<string, number>,
  componentSize: Map<number, number>,
): GraphNode[] {
  const ranked = [...degree.keys()]
    .map((id) => {
      const entity = entities.get(id);
      if (!entity) return null;
      const community = communityOf(id);
      return {
        entity,
        degree: degree.get(id) ?? 0,
        community,
        role: community ? undefined : ungroupedRole(id),
        component: componentOf.get(id) ?? 0,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  ranked.sort((a, b) => {
    // Largest component first: the main body of the network, then whatever
    // the edge data leaves standing apart from it.
    const sizeGap =
      (componentSize.get(b.component) ?? 0) - (componentSize.get(a.component) ?? 0);
    if (sizeGap !== 0) return sizeGap;
    if (a.component !== b.component) return a.component - b.component;

    // Ungrouped entities sort after every community, because they are the ones
    // the research declined to place — a bridge, a stub, a clipped subject.
    if ((a.community === undefined) !== (b.community === undefined)) {
      return a.community === undefined ? 1 : -1;
    }
    if (a.community !== b.community) {
      return (a.community ?? '').localeCompare(b.community ?? '', 'en', { numeric: true });
    }

    if (a.degree !== b.degree) return b.degree - a.degree;
    return a.entity.name.localeCompare(b.entity.name, 'en');
  });

  return ranked.map((node, row) => ({ ...node, row }));
}

/**
 * A quadratic arc from one row to another, bowing away from the axis.
 *
 * The control point sits at twice the bulge, which puts the curve's own
 * extreme at exactly `bulge` — so an arc's reach is its row span and nothing
 * else. Wide spans are clamped to the gutter rather than allowed to leave it;
 * past the clamp an arc flattens instead of disappearing.
 */
function arcPath(fromRow: number, toRow: number): string {
  const y1 = fromRow * ROW_H + ROW_H / 2;
  const y2 = toRow * ROW_H + ROW_H / 2;
  const span = Math.abs(toRow - fromRow);
  const bulge = Math.min((span * ROW_H) / 2, ARC_W - ARC_PAD);
  return `M 0 ${y1} Q ${(2 * bulge).toFixed(1)} ${(y1 + y2) / 2} 0 ${y2}`;
}

/**
 * Build the drawing from the roster and the edge list.
 *
 * Only entities the edge data actually connects are drawn. The other 13 are
 * returned in `isolated` and named beneath the figure — carrying them as
 * unconnected dots would imply the research looked at each and found nothing,
 * when in fact they are in the roster for other reasons entirely.
 */
export function buildGraphLayout(
  roster: CaseEntity[],
  edges: CaseEdge[],
  communities: NetworkCommunity[],
): GraphLayout {
  const entities = new Map(roster.map((entity) => [entity.id, entity]));

  // Only edges whose two ends are both in the roster can be drawn at all.
  const seen = new Set<string>();
  const usable = edges.filter((edge) => {
    if (!entities.has(edge.fromId) || !entities.has(edge.toId)) return false;
    if (edge.fromId === edge.toId) return false;
    const key = edgeKey(edge);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const degree = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)?.add(b);
  };
  for (const edge of usable) {
    touch(edge.fromId, edge.toId);
    touch(edge.toId, edge.fromId);
  }

  // Connected components, walked in sorted id order so the numbering is stable.
  const componentOf = new Map<string, number>();
  const componentSize = new Map<number, number>();
  let nextComponent = 0;
  for (const id of [...degree.keys()].sort()) {
    if (componentOf.has(id)) continue;
    const index = nextComponent++;
    const stack = [id];
    let size = 0;
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || componentOf.has(current)) continue;
      componentOf.set(current, index);
      size += 1;
      for (const neighbour of adjacency.get(current) ?? []) stack.push(neighbour);
    }
    componentSize.set(index, size);
  }

  const nodes = orderNodes(entities, degree, componentOf, componentSize);
  const rowOf = new Map(nodes.map((node) => [node.entity.id, node.row]));

  const arcs: GraphArc[] = usable.flatMap((edge) => {
    const fromRow = rowOf.get(edge.fromId);
    const toRow = rowOf.get(edge.toId);
    if (fromRow === undefined || toRow === undefined) return [];
    return [
      {
        edge,
        fromRow,
        toRow,
        span: Math.abs(toRow - fromRow),
        d: arcPath(fromRow, toRow),
      },
    ];
  });

  // Contiguous runs of the same community become one bracketed group. The runs
  // are contiguous by construction — the sort put them that way — so this only
  // has to notice where one ends.
  const communityName = new Map(communities.map((c) => [c.number, c.name]));
  const groups: GraphGroup[] = [];
  for (const node of nodes) {
    const key = `${node.component}:${node.community ?? node.role ?? 'none'}`;
    const last = groups.at(-1);
    if (last?.key === key) {
      last.endRow = node.row;
      last.size += 1;
      continue;
    }
    groups.push({
      key,
      label: node.community
        ? (communityName.get(node.community) ?? `Community ${node.community}`)
        : (node.role ?? 'Not placed in a community'),
      number: node.community,
      startRow: node.row,
      endRow: node.row,
      size: 1,
    });
  }

  const components: GraphComponent[] = [];
  for (const node of nodes) {
    const last = components.at(-1);
    if (last && last.index === node.component) {
      last.endRow = node.row;
      last.size += 1;
      continue;
    }
    components.push({
      index: node.component,
      startRow: node.row,
      endRow: node.row,
      size: 1,
    });
  }

  const isolated = roster
    .filter((entity) => !degree.has(entity.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  return {
    nodes,
    arcs,
    groups,
    components,
    isolated,
    viewBox: `0 0 ${ARC_W} ${Math.max(nodes.length, 1) * ROW_H}`,
    rowCount: nodes.length,
  };
}
