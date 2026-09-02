import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraphLayout } from '@/components/network/layout';
import {
  DISCREPANCIES,
  MAPPED_IDS,
  UNGROUPED_IDS,
  UNRESOLVED_LABELS,
  communityOf,
} from '@/lib/content/fake-resistance-network-communities';
import type { ResearchNetwork } from '@/lib/content/fake-resistance-cases';

/**
 * The drawing is only as honest as the join beneath it, and both halves of
 * that join are hand-maintained against a package that can be re-imported.
 * These assertions are the tripwire: if a re-import adds an entity, drops one,
 * or renames a group tag, the mapping stops covering the roster and this fails
 * — rather than the figure quietly filing someone into the wrong community or
 * dropping them out of the picture.
 */
async function loadNetwork(): Promise<ResearchNetwork> {
  const file = path.join(process.cwd(), 'content-packages/fake-resistance/network.json');
  return JSON.parse(await readFile(file, 'utf8')) as ResearchNetwork;
}

describe('influence network community mapping', () => {
  it('places every roster entity, either in a community or explicitly outside one', async () => {
    const network = await loadNetwork();
    const placed = new Set([...MAPPED_IDS, ...UNGROUPED_IDS]);
    const missing = network.roster.map((e) => e.id).filter((id) => !placed.has(id));
    expect(missing).toEqual([]);
  });

  it('maps nothing that is not in the roster', async () => {
    const network = await loadNetwork();
    const rosterIds = new Set(network.roster.map((e) => e.id));
    const stray = [...MAPPED_IDS, ...UNGROUPED_IDS].filter((id) => !rosterIds.has(id));
    expect(stray).toEqual([]);
  });

  it('only ever names a community the package declares', async () => {
    const network = await loadNetwork();
    const numbers = new Set(network.communities.map((c) => c.number));
    for (const id of MAPPED_IDS) {
      expect(numbers.has(communityOf(id) ?? '')).toBe(true);
    }
  });

  it('agrees with each entity’s own group tag in the package', async () => {
    const network = await loadNetwork();
    for (const entity of network.roster) {
      const tag = /^G([1-7])\b/.exec(entity.note ?? '');
      if (!tag) continue;
      expect(communityOf(entity.id), `${entity.id} (note: ${entity.note})`).toBe(tag[1]);
    }
  });

  it('only records an unresolved label the package actually writes', async () => {
    const network = await loadNetwork();
    const byNumber = new Map(network.communities.map((c) => [c.number, c.nodes]));
    for (const entry of UNRESOLVED_LABELS) {
      expect(byNumber.get(entry.community), entry.community).toContain(entry.label);
    }
  });

  /**
   * The one assertion that proves the mapping is *complete* rather than merely
   * consistent. Which display label goes with which entity is a judgment a
   * test cannot re-derive — `"ACP"` is the initials of a name, `"ToG"` is an
   * abbreviation, `"Gage (schismatic)"` carries an annotation — so instead of
   * re-matching the labels, this counts them.
   *
   * For each community: the entities the mapping places there, minus the ones
   * placed by an entity tag the label list does not carry (recorded in
   * `DISCREPANCIES`), plus the labels recorded as resolving to no entity at
   * all, must equal the number of labels the package wrote. Every label is
   * then accounted for exactly once, and a re-import that adds, drops or
   * renames one breaks the arithmetic here rather than the drawing.
   */
  it('accounts for every community label exactly once', async () => {
    const network = await loadNetwork();
    const mappedPer = new Map<string, number>();
    for (const id of MAPPED_IDS) {
      const community = communityOf(id);
      if (!community) continue;
      mappedPer.set(community, (mappedPer.get(community) ?? 0) + 1);
    }

    for (const community of network.communities) {
      const mapped = mappedPer.get(community.number) ?? 0;
      const extra = DISCREPANCIES.filter((d) => d.community === community.number).length;
      const unresolved = UNRESOLVED_LABELS.filter(
        (l) => l.community === community.number,
      ).length;
      expect(
        mapped - extra + unresolved,
        `community ${community.number} (${community.name}): ` +
          `${mapped} mapped − ${extra} untagged + ${unresolved} unresolved`,
      ).toBe(community.nodes.length);
    }
  });
});

describe('influence graph layout', () => {
  it('draws only entities the edge data connects, and names the rest', async () => {
    const network = await loadNetwork();
    const layout = buildGraphLayout(network.roster, network.edges, network.communities);

    const connected = new Set(network.edges.flatMap((e) => [e.fromId, e.toId]));
    expect(layout.nodes).toHaveLength(connected.size);
    expect(layout.nodes.length + layout.isolated.length).toBe(network.roster.length);
    for (const entity of layout.isolated) expect(connected.has(entity.id)).toBe(false);
  });

  it('gives every node a unique, gapless row', async () => {
    const network = await loadNetwork();
    const layout = buildGraphLayout(network.roster, network.edges, network.communities);
    expect(layout.nodes.map((n) => n.row)).toEqual(layout.nodes.map((_, i) => i));
  });

  it('keeps each community contiguous, so a bracket can span it', async () => {
    const network = await loadNetwork();
    const layout = buildGraphLayout(network.roster, network.edges, network.communities);
    const seen = new Set<string>();
    let previous = '';
    for (const node of layout.nodes) {
      const key = `${node.component}:${node.community ?? 'none'}`;
      if (key === previous) continue;
      expect(seen.has(key), `${key} appears in two runs`).toBe(false);
      seen.add(key);
      previous = key;
    }
    // Every group the layout reports must cover exactly the rows it claims.
    for (const group of layout.groups) {
      expect(group.endRow - group.startRow + 1).toBe(group.size);
    }
  });

  it('never draws an arc between rows it did not place', async () => {
    const network = await loadNetwork();
    const layout = buildGraphLayout(network.roster, network.edges, network.communities);
    expect(layout.arcs).toHaveLength(network.edges.length);
    for (const arc of layout.arcs) {
      expect(arc.fromRow).toBeGreaterThanOrEqual(0);
      expect(arc.toRow).toBeLessThan(layout.rowCount);
      expect(arc.d).toMatch(/^M 0 [\d.]+ Q [\d.]+ [\d.]+ 0 [\d.]+$/);
    }
  });

  it('is deterministic — the same evidence draws the same picture', async () => {
    const network = await loadNetwork();
    const a = buildGraphLayout(network.roster, network.edges, network.communities);
    const b = buildGraphLayout([...network.roster], [...network.edges], network.communities);
    expect(b.nodes.map((n) => n.entity.id)).toEqual(a.nodes.map((n) => n.entity.id));
    expect(b.arcs.map((arc) => arc.d)).toEqual(a.arcs.map((arc) => arc.d));
  });

  it('does not invent a connection between the two components', async () => {
    const network = await loadNetwork();
    const layout = buildGraphLayout(network.roster, network.edges, network.communities);
    const componentOf = new Map(layout.nodes.map((n) => [n.entity.id, n.component]));
    for (const arc of layout.arcs) {
      expect(componentOf.get(arc.edge.fromId)).toBe(componentOf.get(arc.edge.toId));
    }
    // The prose bridges are not pairs of entities and must never become arcs.
    expect(layout.arcs.length).toBe(network.edges.length);
  });
});
