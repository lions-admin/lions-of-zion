import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraphLayout } from '@/components/network/layout';
import {
  UNGROUPED,
  communityIndex,
  communityOf,
} from '@/lib/content/fake-resistance-network-communities';
import type { CaseEdge, ResearchNetwork } from '@/lib/content/fake-resistance-cases';

/**
 * The drawing is only as honest as the join beneath it.
 *
 * That join used to be a hand-written table of entity ids, and most of this
 * file was a tripwire on it: assertions that a re-import had not added an
 * entity the table did not cover, or renamed a group tag it keyed on. The
 * Phase-2c rebuild made the research compute its own partition and ship the
 * membership, so the table is gone and those tripwires with it.
 *
 * What replaces them is the assertion the old arrangement could not make: that
 * the join is *derived from the package* rather than maintained beside it, and
 * that the inferential layer of the graph carries the statistics that entitle
 * it to be drawn at all.
 */
async function loadNetwork(): Promise<ResearchNetwork> {
  const file = path.join(process.cwd(), 'content-packages/fake-resistance/network.json');
  return JSON.parse(await readFile(file, 'utf8')) as ResearchNetwork;
}

/**
 * The account-level drawing is fed the inferential layer only — 61 accounts,
 * not 188. The observed layer is real and stays in the data; a node-link
 * drawing of it would be a hairball whose shape is an artefact of the layout.
 */
function coordinationLayer(network: ResearchNetwork) {
  const edges: CaseEdge[] = network.edges.filter(
    (edge) => edge.evidenceClass === 'inferred_coordination',
  );
  const touched = new Set(edges.flatMap((edge) => [edge.fromId, edge.toId]));
  return { edges, roster: network.roster.filter((entity) => touched.has(entity.id)) };
}

describe('influence network community mapping', () => {
  it('derives every placement from the package, not from a table beside it', async () => {
    const network = await loadNetwork();
    const index = communityIndex(network.communities);
    const declared = new Set(network.communities.map((c) => c.id));

    expect(index.size).toBeGreaterThan(0);
    for (const id of index.values()) expect(declared.has(id)).toBe(true);
  });

  it('places a roster entity by its own handle, and places no one twice', async () => {
    const network = await loadNetwork();
    const index = communityIndex(network.communities);

    const seen = new Set<string>();
    for (const community of network.communities) {
      for (const handle of community.members) {
        expect(seen.has(handle), `${handle} is in two communities`).toBe(false);
        seen.add(handle);
      }
    }

    const placed = network.roster.filter((entity) => communityOf(entity, index) !== undefined);
    expect(placed.length).toBeGreaterThan(0);
    for (const entity of placed) {
      expect(entity.handle && seen.has(entity.handle.toLowerCase())).toBe(true);
    }
  });

  it('leaves an entity unplaced only when it carries no handle to place it by', async () => {
    const network = await loadNetwork();
    const index = communityIndex(network.communities);
    for (const entity of network.roster) {
      if (communityOf(entity, index) !== undefined) continue;
      // Either it has no handle at all, or its handle is not a node in the
      // computed graph — both are honest reasons to sit outside a community,
      // and neither is a mapping that fell out of date.
      const unplaceable = !entity.handle || !index.has(entity.handle.toLowerCase());
      expect(unplaceable, `${entity.id} is unplaced for no stated reason`).toBe(true);
    }
  });

  it('keeps the research desk out of the network it observed', async () => {
    const network = await loadNetwork();
    const index = communityIndex(network.communities);
    for (const id of Object.keys(UNGROUPED)) {
      const entity = network.roster.find((e) => e.id === id);
      if (!entity) continue;
      expect(communityOf(entity, index)).toBeUndefined();
    }
  });

  it('counts each community as exactly the members it lists', async () => {
    const network = await loadNetwork();
    for (const community of network.communities) {
      expect(community.members).toHaveLength(community.size);
      expect(community.subjects + community.controls).toBe(community.size);
      for (const hub of community.hubs) expect(community.members).toContain(hub);
    }
    const total = network.communities.reduce((sum, c) => sum + c.size, 0);
    expect(total).toBe(network.metrics.nodes);
  });
});

describe('the inferential layer', () => {
  /**
   * The rule the whole research programme turns on: an edge that asserts
   * coordination publishes its test or it does not publish. The earlier pass
   * of this research inferred coordination from prose, and this assertion is
   * what stops that reaching a page again.
   */
  it('never draws an inferred edge without the test behind it', async () => {
    const network = await loadNetwork();
    const { edges } = coordinationLayer(network);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.pValue, edge.id).toBeTruthy();
      expect(Number(edge.pValue), edge.id).toBeLessThan(1);
      expect(edge.nullModel, edge.id).toBeTruthy();
      expect(Number(edge.sampleN), edge.id).toBeGreaterThan(0);
    }
  });

  it('carries the same test on the coordination table as on the edges', async () => {
    const network = await loadNetwork();
    for (const edge of network.coordinationEdges) {
      expect(edge.pValue).toBeGreaterThan(0);
      expect(edge.nullModel).toBeTruthy();
      expect(edge.sampleN).toBeGreaterThan(0);
      // A single-trace match is capped by the research however small its p.
      if (!edge.multiTrace) expect(edge.confidenceCap).toBeTruthy();
    }
  });

  it('states the denominator every community flow was measured against', async () => {
    const network = await loadNetwork();
    expect(network.metrics.nodes).toBeGreaterThan(0);
    expect(network.metrics.edges).toBeGreaterThan(0);
    expect(network.caveat).toMatch(/convenience sample/i);
    // No interaction edge may be silently dropped for want of a community.
    expect(network.metrics.unplacedInteractionEdges).toBe(0);
  });
});

describe('influence graph layout', () => {
  it('draws only entities the edge data connects, and names the rest', async () => {
    const network = await loadNetwork();
    const { roster, edges } = coordinationLayer(network);
    const layout = buildGraphLayout(roster, edges, network.communities);

    const connected = new Set(edges.flatMap((e) => [e.fromId, e.toId]));
    expect(layout.nodes).toHaveLength(connected.size);
    expect(layout.nodes.length + layout.isolated.length).toBe(roster.length);
    for (const entity of layout.isolated) expect(connected.has(entity.id)).toBe(false);
  });

  it('gives every node a unique, gapless row', async () => {
    const network = await loadNetwork();
    const { roster, edges } = coordinationLayer(network);
    const layout = buildGraphLayout(roster, edges, network.communities);
    expect(layout.nodes.map((n) => n.row)).toEqual(layout.nodes.map((_, i) => i));
  });

  it('keeps each community contiguous, so a bracket can span it', async () => {
    const network = await loadNetwork();
    const { roster, edges } = coordinationLayer(network);
    const layout = buildGraphLayout(roster, edges, network.communities);
    const seen = new Set<string>();
    let previous = '';
    for (const node of layout.nodes) {
      const key = `${node.component}:${node.community ?? 'none'}`;
      if (key === previous) continue;
      expect(seen.has(key), `${key} appears in two runs`).toBe(false);
      seen.add(key);
      previous = key;
    }
    for (const group of layout.groups) {
      expect(group.endRow - group.startRow + 1).toBe(group.size);
    }
  });

  it('never draws an arc between rows it did not place', async () => {
    const network = await loadNetwork();
    const { roster, edges } = coordinationLayer(network);
    const layout = buildGraphLayout(roster, edges, network.communities);
    for (const arc of layout.arcs) {
      expect(arc.fromRow).toBeGreaterThanOrEqual(0);
      expect(arc.toRow).toBeLessThan(layout.rowCount);
      expect(arc.d).toMatch(/^M 0 [\d.]+ Q [\d.]+ [\d.]+ 0 [\d.]+$/);
    }
  });

  it('is deterministic — the same evidence draws the same picture', async () => {
    const network = await loadNetwork();
    const { roster, edges } = coordinationLayer(network);
    const a = buildGraphLayout(roster, edges, network.communities);
    const b = buildGraphLayout([...roster], [...edges], network.communities);
    expect(b.nodes.map((n) => n.entity.id)).toEqual(a.nodes.map((n) => n.entity.id));
    expect(b.arcs.map((arc) => arc.d)).toEqual(a.arcs.map((arc) => arc.d));
  });

  it('does not invent a connection between components', async () => {
    const network = await loadNetwork();
    const { roster, edges } = coordinationLayer(network);
    const layout = buildGraphLayout(roster, edges, network.communities);
    const componentOf = new Map(layout.nodes.map((n) => [n.entity.id, n.component]));
    for (const arc of layout.arcs) {
      expect(componentOf.get(arc.edge.fromId)).toBe(componentOf.get(arc.edge.toId));
    }
  });
});
