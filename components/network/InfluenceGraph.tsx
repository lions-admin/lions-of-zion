'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type {
  CaseEdge,
  CaseEntity,
  EvidenceClass,
  NetworkCommunity,
  ResearchConfidence,
} from '@/lib/content/fake-resistance-cases';
import { buildGraphLayout } from './layout';
import styles from './influence-graph.module.css';

/**
 * The influence network, drawn.
 *
 * `layout.ts` carries the argument for the form — an arc diagram, ordered by
 * component then community then degree. This file is what a reader touches,
 * and three rules govern it.
 *
 * **The grades are the drawing.** Evidence class and confidence are what this
 * research is careful about, so they are what the ink is spent on. A line's
 * *solidity* is its evidence class and its *weight* is its confidence, in one
 * grammar that runs through the whole figure: **the less established a thing
 * is, the less solid it is drawn.** A documented relationship is a solid rule;
 * an observed interaction is dashed; an inferred coordination is dotted and
 * faint. The same rule shapes the nodes — a confirmed identity is a filled
 * mark, a probable or unresolved one is hollow. Nothing in here can make an
 * inference look like a record, which is the one way a figure like this
 * ordinarily lies.
 *
 * **Nothing is coloured by community.** Seven categorical hues do not exist in
 * this palette, and a seven-colour node-link chart of named real people joined
 * by arrows is, visually, a conspiracy board — the exact rhetoric this section
 * documents other people using. Community is carried by *position* instead:
 * members sit together, bracketed and numbered in the gutter. Ember marks the
 * network's own structure when a reader lights it up; gold stays on the desk's
 * apparatus. That is the accent rule the rest of this page already follows.
 *
 * **Filtering never moves a node.** The controls hide arcs and dim rows; the
 * ordering is fixed for the life of the page. A reader who turns off inferred
 * edges is looking at the same drawing with less in it, not a new one — so
 * what the filter removed is legible, which is the entire point of having one.
 *
 * Everything the drawing says is also in the DOM beside it: the ordered list
 * of entities is the figure's own markup, the panel restates a selection in
 * words, and the page's edge list below carries every statement in full. The
 * `<svg>` is `aria-hidden` because it repeats them, not because it hides them.
 * With no JavaScript the arcs and the roster render exactly as they do here;
 * only the controls, which would do nothing, take themselves away.
 */

const subscribeToNothing = () => () => {};

export type InfluenceGraphProps = {
  roster: CaseEntity[];
  edges: CaseEdge[];
  communities: NetworkCommunity[];
};

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

const EVIDENCE_HINT: Record<EvidenceClass, string> = {
  documented_relationship: 'Stated on the record, by the parties or by reporting.',
  observed_interaction: 'Seen happening in public posts — behaviour, not a declared tie.',
  inferred_coordination: 'A pattern consistent with coordination that was not established.',
};

const CONFIDENCE_ORDER: ResearchConfidence[] = ['high', 'medium', 'low'];

const CONFIDENCE_LABEL: Record<ResearchConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const TYPE_LABEL: Record<CaseEntity['type'], string> = {
  person: 'Person',
  organization: 'Organization',
  account: 'Account',
};

const IDENTITY_LABEL: Record<CaseEntity['identityStatus'], string> = {
  confirmed: 'Identity confirmed',
  probable: 'Identity probable',
  unresolved: 'Identity unresolved',
};

/** Relations arrive as the research's own constant names; these are words. */
function relationText(relation: string): string {
  return relation.replace(/_/g, ' ').toLowerCase();
}

export function InfluenceGraph({ roster, edges, communities }: InfluenceGraphProps) {
  const layout = useMemo(
    () => buildGraphLayout(roster, edges, communities),
    [roster, edges, communities],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mutedClasses, setMutedClasses] = useState<readonly EvidenceClass[]>([]);
  const [mutedConfidence, setMutedConfidence] = useState<readonly string[]>([]);

  /**
   * The rows are real buttons, and without JavaScript they are real buttons
   * that do nothing — eighteen dead tab stops in the middle of a reading page.
   * They join the tab order once there is a runtime to answer them, and are
   * skipped otherwise. The drawing itself is unaffected either way.
   *
   * `useSyncExternalStore` rather than a mount effect: the server snapshot is
   * what the prerendered HTML carries and the client snapshot is what replaces
   * it at hydration, which is exactly the question being asked, with no
   * cascading render to schedule.
   */
  const interactive = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  const active = hovered ?? selected;

  const counts = useMemo(() => {
    const evidence = new Map<EvidenceClass, number>();
    const confidence = new Map<string, number>();
    for (const arc of layout.arcs) {
      evidence.set(arc.edge.evidenceClass, (evidence.get(arc.edge.evidenceClass) ?? 0) + 1);
      const grade = arc.edge.confidence ?? 'ungraded';
      confidence.set(grade, (confidence.get(grade) ?? 0) + 1);
    }
    return { evidence, confidence };
  }, [layout.arcs]);

  const isShown = useCallback(
    (edge: CaseEdge) =>
      !mutedClasses.includes(edge.evidenceClass) &&
      !mutedConfidence.includes(edge.confidence ?? 'ungraded'),
    [mutedClasses, mutedConfidence],
  );

  /** Rows whose every edge is filtered out: still in place, visibly stood down. */
  const liveRows = useMemo(() => {
    const live = new Set<string>();
    for (const arc of layout.arcs) {
      if (!isShown(arc.edge)) continue;
      live.add(arc.edge.fromId);
      live.add(arc.edge.toId);
    }
    return live;
  }, [layout.arcs, isShown]);

  const selectedNode = layout.nodes.find((node) => node.entity.id === selected);
  const selectedEdges = selected
    ? layout.arcs
        .filter((arc) => arc.edge.fromId === selected || arc.edge.toId === selected)
        .map((arc) => arc.edge)
    : [];

  const nameOf = useMemo(
    () => new Map(layout.nodes.map((node) => [node.entity.id, node.entity.name])),
    [layout.nodes],
  );

  const communityName = useMemo(
    () => new Map(communities.map((community) => [community.number, community.name])),
    [communities],
  );

  const toggle = <T extends string>(
    list: readonly T[],
    value: T,
    set: (next: readonly T[]) => void,
  ) => {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const componentBreaks = new Set(
    layout.components.slice(1).map((component) => component.startRow),
  );

  return (
    <figure className={styles.figure}>
      <div className={styles.controls} role="group" aria-label="Filter the connections drawn">
        <div className={styles.filterSet}>
          <span className={styles.filterLegend} id="graph-filter-evidence">
            Evidence
          </span>
          <div className={styles.chips} role="group" aria-labelledby="graph-filter-evidence">
            {EVIDENCE_ORDER.map((value) => {
              const count = counts.evidence.get(value) ?? 0;
              const on = !mutedClasses.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={styles.chip}
                  data-evidence={value}
                  aria-pressed={on}
                  disabled={count === 0}
                  title={EVIDENCE_HINT[value]}
                  onClick={() => toggle(mutedClasses, value, setMutedClasses)}
                >
                  <span className={styles.chipRule} aria-hidden="true" />
                  {EVIDENCE_LABEL[value]}
                  <span className={styles.chipCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.filterSet}>
          <span className={styles.filterLegend} id="graph-filter-confidence">
            Confidence
          </span>
          <div className={styles.chips} role="group" aria-labelledby="graph-filter-confidence">
            {CONFIDENCE_ORDER.map((value) => {
              const count = counts.confidence.get(value) ?? 0;
              const on = !mutedConfidence.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={styles.chip}
                  data-confidence={value}
                  aria-pressed={on}
                  disabled={count === 0}
                  onClick={() => toggle(mutedConfidence, value, setMutedConfidence)}
                >
                  <span className={styles.chipRule} aria-hidden="true" />
                  {CONFIDENCE_LABEL[value]}
                  <span className={styles.chipCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.plot} style={{ ['--rows' as string]: layout.rowCount }}>
        <div className={styles.brackets} aria-hidden="true">
          {layout.groups.map((group) => (
            <span
              key={group.key}
              className={styles.bracket}
              style={{
                ['--start' as string]: group.startRow,
                ['--size' as string]: group.size,
              }}
              data-numbered={group.number ? 'yes' : 'no'}
            >
              {group.number ?? '·'}
            </span>
          ))}
        </div>

        <ol className={styles.rows}>
          {layout.nodes.map((node) => {
            const { entity } = node;
            const connected =
              active !== null &&
              (active === entity.id ||
                layout.arcs.some(
                  (arc) =>
                    isShown(arc.edge) &&
                    ((arc.edge.fromId === active && arc.edge.toId === entity.id) ||
                      (arc.edge.toId === active && arc.edge.fromId === entity.id)),
                ));
            return (
              <li
                key={entity.id}
                className={styles.row}
                data-break={componentBreaks.has(node.row) ? 'yes' : undefined}
                data-dropped={liveRows.has(entity.id) ? undefined : 'yes'}
                data-related={active === null ? undefined : connected ? 'yes' : 'no'}
              >
                <button
                  type="button"
                  className={styles.node}
                  tabIndex={interactive ? 0 : -1}
                  aria-pressed={selected === entity.id}
                  onClick={() => setSelected(selected === entity.id ? null : entity.id)}
                  onPointerEnter={() => setHovered(entity.id)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(entity.id)}
                  onBlur={() => setHovered(null)}
                >
                  <span className={styles.name}>{entity.name}</span>
                  {/* Exactly three grid items: the name, the degree, the mark.
                      The two facts the mark encodes with shape and fill are
                      spelled out for a screen reader inside the degree, which
                      keeps the count at three. */}
                  <span className={styles.degree}>
                    {node.degree}
                    <span className={styles.srOnly}>
                      {' '}
                      connection{node.degree === 1 ? '' : 's'} ·{' '}
                      {TYPE_LABEL[entity.type]} · {IDENTITY_LABEL[entity.identityStatus]}
                    </span>
                  </span>
                  <span
                    className={styles.mark}
                    data-type={entity.type}
                    data-identity={entity.identityStatus}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ol>

        {/* The arcs. Every statement they make is in the list beside them and
            in the panel below, so they are decoration for a screen reader and
            the drawing for everyone else. `preserveAspectRatio="none"` lets
            the gutter be any width the layout gives it while the rows stay on
            the type grid; `non-scaling-stroke` keeps the hairlines hairlines
            through that stretch. */}
        <svg
          className={styles.arcs}
          viewBox={layout.viewBox}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {layout.arcs.map((arc) => {
            const touched = active !== null && (arc.edge.fromId === active || arc.edge.toId === active);
            return (
              <path
                key={arc.edge.id}
                d={arc.d}
                className={styles.arc}
                vectorEffect="non-scaling-stroke"
                data-evidence={arc.edge.evidenceClass}
                data-confidence={arc.edge.confidence ?? 'ungraded'}
                data-hidden={isShown(arc.edge) ? undefined : 'yes'}
                data-lit={active === null ? undefined : touched ? 'yes' : 'no'}
              />
            );
          })}
        </svg>
      </div>

      <p className={styles.groupKey}>
        {layout.groups.map((group) => (
          <span key={group.key} className={styles.groupKeyItem}>
            {group.number ? <b>{group.number}</b> : null}
            {group.label}
          </span>
        ))}
      </p>

      <div className={styles.panel} aria-live="polite">
        {selectedNode ? (
          <>
            <p className={styles.panelHead}>
              <span className={styles.panelName}>{selectedNode.entity.name}</span>
              <span className={styles.panelFacts}>
                {TYPE_LABEL[selectedNode.entity.type]}
                {selectedNode.entity.handle ? ` · @${selectedNode.entity.handle}` : ''}
                {' · '}
                {IDENTITY_LABEL[selectedNode.entity.identityStatus]}
                {' · '}
                {selectedNode.community
                  ? `${selectedNode.community} · ${communityName.get(selectedNode.community) ?? 'Community'}`
                  : (selectedNode.role ?? 'Not placed in a community')}
              </span>
            </p>
            <ul className={styles.panelEdges}>
              {selectedEdges.map((edge) => {
                const outward = edge.fromId === selectedNode.entity.id;
                const otherId = outward ? edge.toId : edge.fromId;
                const directed = edge.direction !== 'undirected';
                return (
                  <li key={edge.id} className={styles.panelEdge} data-muted={isShown(edge) ? undefined : 'yes'}>
                    <p className={styles.panelEdgeHead}>
                      <span className={styles.panelEdgePair}>
                        {directed ? (outward ? 'to' : 'from') : 'with'}{' '}
                        <b>{nameOf.get(otherId) ?? otherId}</b> — {relationText(edge.relation)}
                      </span>
                      <span className={styles.panelGrade} data-evidence={edge.evidenceClass}>
                        {EVIDENCE_LABEL[edge.evidenceClass]}
                        {edge.confidence ? ` · ${CONFIDENCE_LABEL[edge.confidence]} confidence` : ''}
                      </span>
                    </p>
                    <p className={styles.panelStatement}>{edge.statement}</p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className={styles.panelRest}>
            {layout.rowCount} entities carry a recorded connection, joined by{' '}
            {layout.arcs.length} edges into {layout.components.length}{' '}
            {layout.components.length === 1 ? 'cluster' : 'clusters'} with no edge
            running between them.{' '}
            <span className={styles.panelCue}>
              Choose a name to read the evidence behind its connections.
            </span>
          </p>
        )}
      </div>

      <figcaption className={styles.caption}>
        <p>
          Each row is one entity, ordered by the group the research placed it in;
          each arc is one recorded connection, reaching as far as the two rows are
          apart. A <b>solid</b> arc is a documented relationship, a <b>dashed</b>{' '}
          one an observed interaction, a <b>dotted</b> one inferred coordination —
          and a fainter line is a lower confidence grade. Nothing here is drawn
          more firmly than the research graded it.
        </p>
        <p>
          {layout.isolated.length > 0 ? (
            <>
              {layout.isolated.length} further{' '}
              {layout.isolated.length === 1 ? 'entity is' : 'entities are'} in the
              roster with no connection recorded between them and anyone else, so
              they are named rather than drawn:{' '}
              <span className={styles.isolated}>
                {layout.isolated.map((entity) => entity.name).join(', ')}
              </span>
              .{' '}
            </>
          ) : null}
          The bridges described below are written as prose rather than as pairs
          of entities, so none of them is drawn here — including the one that
          would join the drawing&rsquo;s two clusters. The gap between them is
          what the edge data contains, not a claim that nothing crosses it.
        </p>
      </figcaption>
    </figure>
  );
}
