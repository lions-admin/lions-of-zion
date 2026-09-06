'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ConfidenceChip, EvidenceClassChip } from '@/components/content';
import { Button } from '@/components/ui/Button';
import type {
  CaseEdge,
  CaseEntity,
  EvidenceClass,
  NetworkCommunity,
  NetworkNode,
} from '@/lib/content/fake-resistance-cases';
import { flowKindOf, relationLabel } from '@/lib/content/investigation-model';
import { IdentityLabel, KindLabel, TypeLabel } from './labels';
import styles from './investigation.module.css';

const subscribeToNothing = () => () => {};

/** How many accounts the list names before the reader asks for the rest. */
const DEFAULT_ROWS = 40;

const EVIDENCE_ORDER: EvidenceClass[] = [
  'documented_relationship',
  'observed_interaction',
  'inferred_coordination',
];

const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  documented_relationship: 'Documented',
  observed_interaction: 'Observed',
  inferred_coordination: 'Inferred',
};

export type NetworkCaseLink = { caseId: string; slug: string; title: string };

export type NetworkExplorerProps = {
  roster: CaseEntity[];
  edges: CaseEdge[];
  communities: NetworkCommunity[];
  topNodes: NetworkNode[];
  cases: NetworkCaseLink[];
};

const handleKey = (value?: string) => (value ?? '').replace(/^@/, '').toLowerCase();

/**
 * The cross-case network as a readable list: filters by kind of relation,
 * evidence class and community; every account ranked by how many recorded
 * connections touch it; and a selected-entity inspector that restates the
 * account's placement, its strongest connections, and the case file that
 * examines it fully.
 *
 * At 188 connected accounts and 708 edges the arc diagram this section once
 * drew would be a wall taller than the page, and a force layout would be a
 * hairball with a random seed. So the orientation device here is the
 * community map above (server-rendered) and this list is the evidence:
 * every edge has a textual row, an evidence class and a confidence grade,
 * and nothing is drawn more firmly than the research graded it.
 *
 * URL state: `?entity=<id>` selects an account, so a case page can deep-link
 * into the network and a reader can hand the selection on.
 */
export function NetworkExplorer({ roster, edges, communities, topNodes, cases }: NetworkExplorerProps) {
  const interactive = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mutedRelations, setMutedRelations] = useState<readonly string[]>([]);
  const [mutedEvidence, setMutedEvidence] = useState<readonly EvidenceClass[]>([]);
  const [community, setCommunity] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  /* Read once after hydration, idempotently (StrictMode runs the effect
     twice); URL writes wait for `ready` so the arriving query is not wiped. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('entity');
    const handle = params.get('handle')?.replace(/^@/, '').toLowerCase();
    const match = roster.find(
      (e) => e.id === id || (handle !== undefined && handleKey(e.handle) === handle),
    );
    const frame = requestAnimationFrame(() => {
      if (match) setSelected(match.id);
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [roster]);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set('entity', selected);
    else url.searchParams.delete('entity');
    url.searchParams.delete('handle');
    history.replaceState(history.state, '', url);
  }, [ready, selected]);

  const entityById = useMemo(() => new Map(roster.map((e) => [e.id, e])), [roster]);
  const nodeByHandle = useMemo(
    () => new Map(topNodes.map((node) => [handleKey(node.handle), node])),
    [topNodes],
  );
  const caseById = useMemo(() => new Map(cases.map((c) => [c.caseId, c])), [cases]);
  const communityById = useMemo(() => new Map(communities.map((c) => [String(c.id), c])), [communities]);

  /** Community placement, where the computed partition names the account. */
  const communityOf = (entity: CaseEntity): NetworkCommunity | undefined => {
    const key = handleKey(entity.handle);
    if (!key) return undefined;
    const node = nodeByHandle.get(key);
    if (node?.community !== undefined) return communityById.get(String(node.community));
    return communities.find(
      (c) =>
        c.members.some((member) => handleKey(member) === key) ||
        c.hubs.some((hub) => handleKey(hub) === key),
    );
  };

  const relations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of edges) counts.set(edge.relation, (counts.get(edge.relation) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [edges]);

  const evidenceCounts = useMemo(() => {
    const counts = new Map<EvidenceClass, number>();
    for (const edge of edges) counts.set(edge.evidenceClass, (counts.get(edge.evidenceClass) ?? 0) + 1);
    return counts;
  }, [edges]);

  const inCommunity = (id: string) => {
    if (community === 'all') return true;
    const entity = entityById.get(id);
    if (!entity) return false;
    const placed = communityOf(entity);
    if (community === 'unplaced') return placed === undefined;
    return String(placed?.id) === community;
  };

  const shownEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          !mutedRelations.includes(edge.relation) &&
          !mutedEvidence.includes(edge.evidenceClass) &&
          (inCommunity(edge.fromId) || inCommunity(edge.toId)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inCommunity closes over the same state listed here
    [edges, mutedRelations, mutedEvidence, community],
  );

  const ranked = useMemo(() => {
    const degree = new Map<string, number>();
    for (const edge of shownEdges) {
      degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
      degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    }
    return [...degree.entries()]
      .map(([id, count]) => ({ entity: entityById.get(id), count }))
      .filter((row): row is { entity: CaseEntity; count: number } => row.entity !== undefined)
      .filter((row) => inCommunity(row.entity.id))
      .sort((a, b) => b.count - a.count || a.entity.name.localeCompare(b.entity.name, 'en'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inCommunity closes over `community`
  }, [shownEdges, entityById, community]);

  const filtersActive = mutedRelations.length > 0 || mutedEvidence.length > 0 || community !== 'all';
  const rows = showAll ? ranked : ranked.slice(0, DEFAULT_ROWS);

  const selectedEntity = selected ? entityById.get(selected) : undefined;
  const selectedEdges = selectedEntity
    ? edges
        .filter((edge) => edge.fromId === selectedEntity.id || edge.toId === selectedEntity.id)
        .sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))
    : [];
  const selectedNode = selectedEntity ? nodeByHandle.get(handleKey(selectedEntity.handle)) : undefined;
  const selectedCommunity = selectedEntity ? communityOf(selectedEntity) : undefined;

  const toggleIn = <T extends string>(list: readonly T[], value: T, set: (next: readonly T[]) => void) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className={styles.network}>
      <div className={styles.networkControls} role="group" aria-label="Filter the connections listed">
        <div className={styles.layerSwitch}>
          <span className={styles.laneLabel}>Relation</span>
          {relations.map(([relation, count]) => (
            <Button
              key={relation}
              type="button"
              variant="secondary"
              size="sm"
              className={styles.layerChip}
              isActive={!mutedRelations.includes(relation)}
              tabIndex={interactive ? 0 : -1}
              onClick={() => toggleIn(mutedRelations, relation, setMutedRelations)}
            >
              {relationLabel(relation)}
              <span className={styles.layerCount}>{count}</span>
            </Button>
          ))}
        </div>
        <div className={styles.layerSwitch}>
          <span className={styles.laneLabel}>Evidence</span>
          {EVIDENCE_ORDER.filter((value) => (evidenceCounts.get(value) ?? 0) > 0).map((value) => (
            <Button
              key={value}
              type="button"
              variant="secondary"
              size="sm"
              className={styles.layerChip}
              data-kind={flowKindOf('', value)}
              isActive={!mutedEvidence.includes(value)}
              tabIndex={interactive ? 0 : -1}
              onClick={() => toggleIn(mutedEvidence, value, setMutedEvidence)}
            >
              <span className={styles.kindRule} aria-hidden="true" />
              {EVIDENCE_LABEL[value]}
              <span className={styles.layerCount}>{evidenceCounts.get(value)}</span>
            </Button>
          ))}
        </div>
        <div className={styles.layerSwitch}>
          <label className={styles.rangeField}>
            <span>Community</span>
            <select
              value={community}
              tabIndex={interactive ? 0 : -1}
              onChange={(event) => setCommunity(event.target.value)}
            >
              <option value="all">Every community</option>
              {communities.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.id} · {c.label} ({c.size})
                </option>
              ))}
              <option value="unplaced">Not placed by the computed partition</option>
            </select>
          </label>
          {filtersActive ? (
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={() => {
                setMutedRelations([]);
                setMutedEvidence([]);
                setCommunity('all');
              }}
            >
              Show everything
            </Button>
          ) : null}
        </div>
      </div>

      <p className={styles.subnote} role="status">
        {shownEdges.length.toLocaleString('en-US')} of {edges.length.toLocaleString('en-US')}{' '}
        recorded connections shown, touching {ranked.length} accounts.
      </p>

      <div className={styles.networkBody}>
        <ol className={styles.networkList} aria-label="Accounts ranked by recorded connections">
          {rows.map(({ entity, count }) => {
            const placed = communityOf(entity);
            const node = nodeByHandle.get(handleKey(entity.handle));
            return (
              <li
                key={entity.id}
                className={styles.networkRow}
                data-selected={selected === entity.id ? 'yes' : undefined}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.networkRowButton}
                  isActive={selected === entity.id}
                  tabIndex={interactive ? 0 : -1}
                  onClick={() => setSelected(selected === entity.id ? null : entity.id)}
                >
                  <span className={styles.entityName}>{entity.name}</span>
                  <span className={styles.entityFacts}>
                    {entity.handle ? <span className={styles.entityHandle}>@{entity.handle}</span> : null}
                    <span className={styles.flowMeasure}>
                      {count} {count === 1 ? 'connection' : 'connections'}
                    </span>
                    {placed ? <span className={styles.typeLabel}>Community {placed.id}</span> : null}
                    {node?.control ? <span className={styles.typeLabel}>control</span> : null}
                    <IdentityLabel status={entity.identityStatus} />
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>

        <div className={styles.networkInspector} aria-live="polite">
          {selectedEntity ? (
            <>
              <div className={styles.inspectorHead}>
                <span className={styles.inspectorKicker}>Selected account</span>
                <Button type="button" variant="text" size="sm" onClick={() => setSelected(null)}>
                  Clear
                </Button>
              </div>
              <p className={styles.inspectorTitle}>{selectedEntity.name}</p>
              <p className={styles.inspectorGrades}>
                {selectedEntity.handle ? (
                  <span className={styles.entityHandle}>@{selectedEntity.handle}</span>
                ) : null}
                <TypeLabel type={selectedEntity.type} />
                <IdentityLabel status={selectedEntity.identityStatus} />
              </p>
              <dl className={styles.inspectorFacts}>
                <div>
                  <dt>Community</dt>
                  <dd>
                    {selectedCommunity
                      ? `${selectedCommunity.id} · ${selectedCommunity.label}`
                      : 'Not placed by the computed partition (not among the ranked accounts).'}
                  </dd>
                </div>
                {selectedNode ? (
                  <div>
                    <dt>Computed rank</dt>
                    <dd>
                      degree {selectedNode.degree ?? '—'}
                      {typeof selectedNode.pagerank === 'number'
                        ? ` · PageRank ${selectedNode.pagerank.toFixed(4)}`
                        : ''}
                      {selectedNode.control ? ' · control account' : ''}
                    </dd>
                  </div>
                ) : null}
                {selectedNode?.cases.length ? (
                  <div>
                    <dt>Examined in</dt>
                    <dd>
                      {selectedNode.cases.map((caseId) => {
                        const link = caseById.get(caseId);
                        return link ? (
                          <Link
                            key={caseId}
                            className={styles.profileLink}
                            href={`/fake-resistance/cases/${link.slug}${
                              selectedEntity.handle
                                ? `?handle=${encodeURIComponent(handleKey(selectedEntity.handle))}`
                                : ''
                            }`}
                          >
                            {link.title}
                          </Link>
                        ) : (
                          <span key={caseId}>{caseId}</span>
                        );
                      })}
                    </dd>
                  </div>
                ) : null}
                {selectedEntity.publicInterestBasis ? (
                  <div>
                    <dt>Why it is in the sample</dt>
                    <dd>{selectedEntity.publicInterestBasis}</dd>
                  </div>
                ) : null}
              </dl>
              <h4 className={styles.inspectorSub}>
                Recorded connections ({selectedEdges.length})
              </h4>
              <ul className={styles.inspectorList}>
                {selectedEdges.slice(0, 25).map((edge) => {
                  const outward = edge.fromId === selectedEntity.id;
                  const other = outward ? edge.to : edge.from;
                  const directed = edge.direction !== 'undirected';
                  return (
                    <li key={edge.id} className={styles.networkEdge}>
                      <span>
                        {directed ? (outward ? 'to' : 'from') : 'with'} <b>{other}</b> —{' '}
                        {relationLabel(edge.relation)}
                        {edge.weight ? ` · ${Number(edge.weight).toLocaleString('en-US')}` : ''}
                      </span>
                      <span className={styles.flowGrades}>
                        <KindLabel kind={flowKindOf(edge.relation, edge.evidenceClass)} />
                        <EvidenceClassChip value={edge.evidenceClass} />
                        {edge.confidence ? <ConfidenceChip value={edge.confidence} /> : null}
                      </span>
                      <span className={styles.flowStatement}>{edge.statement}</span>
                    </li>
                  );
                })}
                {selectedEdges.length > 25 ? (
                  <li className={styles.subnote}>
                    {selectedEdges.length - 25} more connections are in the full edge list below.
                  </li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className={styles.inspectorRest}>
              Choose an account to read its placement, its recorded connections and the case file
              that examines it. Every connection listed carries its evidence class and the
              researchers&rsquo; confidence grade.
            </p>
          )}
        </div>
      </div>

      {ranked.length > DEFAULT_ROWS ? (
        <p className={styles.subnote}>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show the ${DEFAULT_ROWS} most connected` : `Show all ${ranked.length} accounts`}
          </Button>
        </p>
      ) : null}
    </div>
  );
}
