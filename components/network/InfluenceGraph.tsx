'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type {
  CaseEdge,
  CaseEntity,
  EvidenceClass,
  NetworkCommunity,
  ResearchConfidence,
} from '@/lib/content/fake-resistance-cases';
import { Button } from '@/components/ui/Button';
import { StatusState } from '@/components/ui/StatusState';
import { buildGraphLayout } from './layout';
import styles from './influence-graph.module.css';

/**
 * The influence network, drawn — and, below the seam, listed.
 *
 * `layout.ts` carries the argument for the form — an arc diagram, ordered by
 * component then community then degree. This file is what a reader touches,
 * and four rules govern it.
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
 * When a filter combination leaves nothing, the figure says so in words and
 * offers the way back (NET-004); it never presents an empty gutter as a
 * finding.
 *
 * **The drawing is the desktop form; the list is the mobile form** (NET-001).
 * Below the 45rem seam the plot and its inspector stand down and the same
 * data renders as an entity/relationship list — native `<details>` per
 * entity, each connection stated in full with its evidence class and
 * confidence as text. No graph interaction is required to reach any finding
 * on either form: the desktop DOM's roster is real markup, the page's own
 * edge list below the figure carries every statement, and the mobile list
 * works with no JavaScript at all.
 *
 * Motion (NET-003): the only animation in this figure is a travelling pulse
 * on a **documented** relationship's arc while its entity is selected —
 * selection state, not ambience. Observed and inferred edges are never
 * animated (their distinction stays in the line style and the text labels),
 * nothing moves when nothing is selected, and under reduced motion the pulse
 * is removed entirely, leaving the static lit arc it decorates.
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
  /**
   * The figure's async contract (NET-004). The current caller prerenders the
   * data at build time and never passes this; a future caller that fetches
   * the network can hand the state through instead of inventing its own
   * placeholder around the figure.
   */
  status?: 'loading' | 'error';
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

export function InfluenceGraph({ roster, edges, communities, status }: InfluenceGraphProps) {
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

  /** How many edges the current filters leave standing. */
  const shownCount = useMemo(
    () => layout.arcs.filter((arc) => isShown(arc.edge)).length,
    [layout.arcs, isShown],
  );

  const filtersActive = mutedClasses.length > 0 || mutedConfidence.length > 0;

  const resetFilters = useCallback(() => {
    setMutedClasses([]);
    setMutedConfidence([]);
  }, []);

  const selectedNode = layout.nodes.find((node) => node.entity.id === selected);
  const selectedEdges = selected
    ? layout.arcs
        .filter((arc) => arc.edge.fromId === selected || arc.edge.toId === selected)
        .map((arc) => arc.edge)
    : [];

  /**
   * The selection pulse (NET-003): only the selected entity's *documented*
   * relationships, only while a selection stands (hover alone does not arm
   * it), and only over arcs the filters have not hidden. Everything else about
   * an edge's grade stays where it always was — in the line style and the
   * words beside it.
   */
  const beamArcs =
    selected !== null
      ? layout.arcs.filter(
          (arc) =>
            arc.edge.evidenceClass === 'documented_relationship' &&
            isShown(arc.edge) &&
            (arc.edge.fromId === selected || arc.edge.toId === selected),
        )
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

  /* ── The figure's own async/degenerate states (NET-004) ─────────────────
     Each one is words, not an empty gutter: a reader who lands here in a
     state other than "drawn" is told what stands in the drawing's place. */

  if (status === 'loading') {
    return (
      <StatusState
        status="loading"
        eyebrow="Network figure"
        title="Assembling the network"
        description="The entity roster and its recorded connections are still loading. The findings below this figure do not depend on it."
      />
    );
  }

  if (status === 'error') {
    return (
      <StatusState
        status="error"
        eyebrow="Network figure"
        title="The network figure could not load"
        description="The connection data did not arrive. Every documented edge is also listed in full further down this page, so no finding is lost with the drawing."
      />
    );
  }

  if (edges.length === 0) {
    return (
      <StatusState
        status="empty"
        eyebrow="Network figure"
        title="No recorded connections"
        description="The research roster carries entities but no edges between them, so there is no network to draw. If the underlying research records a connection, it will appear here."
      />
    );
  }

  if (layout.rowCount === 0) {
    /* Edges exist but none joins two roster entities — the data is
       inconsistent with itself, which is an error, not an empty set. */
    return (
      <StatusState
        status="error"
        eyebrow="Network figure"
        title="The connection data does not match the roster"
        description="Every recorded edge names at least one entity the roster does not carry, so nothing can be drawn without guessing at an identity. The edge statements are listed in full further down this page."
      />
    );
  }

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
                <Button
                  key={value}
                  type="button"
                  variant="secondary"
                  size="md"
                  className={styles.chip}
                  data-evidence={value}
                  isActive={on}
                  disabled={count === 0}
                  title={EVIDENCE_HINT[value]}
                  onClick={() => toggle(mutedClasses, value, setMutedClasses)}
                >
                  <span className={styles.chipRule} aria-hidden="true" />
                  {EVIDENCE_LABEL[value]}
                  <span className={styles.chipCount}>{count}</span>
                </Button>
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
                <Button
                  key={value}
                  type="button"
                  variant="secondary"
                  size="md"
                  className={styles.chip}
                  data-confidence={value}
                  isActive={on}
                  disabled={count === 0}
                  onClick={() => toggle(mutedConfidence, value, setMutedConfidence)}
                >
                  <span className={styles.chipRule} aria-hidden="true" />
                  {CONFIDENCE_LABEL[value]}
                  <span className={styles.chipCount}>{count}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {filtersActive ? (
          <Button
            type="button"
            variant="text"
            size="md"
            className={styles.resetControl}
            onClick={resetFilters}
          >
            Show all connections
          </Button>
        ) : null}
      </div>

      {/* The desktop form: the arc plot. Below the seam it stands down in
          favour of the entity list — same data, no drawing (NET-001). */}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
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
                      keeps the count at three. The grid lives on Button's
                      inner content span, not on the control itself. */}
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
                </Button>
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
          {/* The selection pulse rides on top of the lit arc it decorates.
              `pathLength` normalises every arc to the same cycle, so short
              and long spans pulse at one cadence. Removed entirely under
              reduced motion — the lit arc underneath is the static state. */}
          {beamArcs.map((arc) => (
            <path
              key={`beam-${arc.edge.id}`}
              d={arc.d}
              pathLength={100}
              className={styles.beam}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      {/* The mobile form (NET-001): the same nodes in the same order, each a
          native disclosure over its own relationship records. No JavaScript,
          no drawing, no graph gesture stands between a reader and a finding. */}
      {shownCount === 0 ? (
        /* The empty-filter state, told where the mobile form can see it —
           the inspector panel that carries it on desktop is hidden below the
           seam. Only one of the two renders at any width. */
        <div className={styles.listFilterEmpty} role="status">
          <p className={styles.filterEmptyText}>
            No connections match the current filters — every evidence class or
            confidence grade still switched on has zero edges. Switch a filter
            back on, or show everything:
          </p>
          <Button type="button" variant="secondary" size="md" onClick={resetFilters}>
            Show all connections
          </Button>
        </div>
      ) : null}

      <ol className={styles.listView} aria-label="Entities and their recorded connections">
        {layout.nodes.map((node) => {
          const { entity } = node;
          const nodeArcs = layout.arcs.filter(
            (arc) => arc.edge.fromId === entity.id || arc.edge.toId === entity.id,
          );
          return (
            <li key={entity.id} className={styles.listEntity}>
              <details>
                <summary className={styles.listSummary}>
                  <span className={styles.listName}>{entity.name}</span>
                  <span className={styles.listFacts}>
                    {node.degree} connection{node.degree === 1 ? '' : 's'} ·{' '}
                    {TYPE_LABEL[entity.type]} · {IDENTITY_LABEL[entity.identityStatus]}
                    {node.community
                      ? ` · Community ${node.community}`
                      : node.role
                        ? ` · ${node.role}`
                        : ''}
                  </span>
                </summary>
                <ul className={styles.listEdges}>
                  {nodeArcs.map(({ edge }) => {
                    const outward = edge.fromId === entity.id;
                    const otherId = outward ? edge.toId : edge.fromId;
                    const directed = edge.direction !== 'undirected';
                    const shown = isShown(edge);
                    return (
                      <li key={edge.id} className={styles.listEdge} data-muted={shown ? undefined : 'yes'}>
                        <p className={styles.listEdgeHead}>
                          <span className={styles.listEdgePair}>
                            {directed ? (outward ? 'to' : 'from') : 'with'}{' '}
                            <b>{nameOf.get(otherId) ?? otherId}</b> — {relationText(edge.relation)}
                          </span>
                          <span className={styles.listGrade} data-evidence={edge.evidenceClass}>
                            {EVIDENCE_LABEL[edge.evidenceClass]}
                            {edge.confidence ? ` · ${CONFIDENCE_LABEL[edge.confidence]} confidence` : ''}
                          </span>
                        </p>
                        <p className={styles.listStatement}>{edge.statement}</p>
                        {!shown ? (
                          <p className={styles.listMutedNote}>
                            Hidden by the current filters.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>

      <p className={styles.groupKey}>
        {layout.groups.map((group) => (
          <span key={group.key} className={styles.groupKeyItem}>
            {group.number ? <b>{group.number}</b> : null}
            {group.label}
          </span>
        ))}
      </p>

      <div className={styles.panel} aria-live="polite">
        {shownCount === 0 ? (
          /* The empty-filter state (NET-004): every edge is muted. Words plus
             the way back, never a silently blank drawing. */
          <div className={styles.filterEmpty}>
            <p className={styles.filterEmptyText}>
              No connections match the current filters — every evidence class
              or confidence grade still switched on has zero edges. Switch a
              filter back on, or show everything:
            </p>
            <Button type="button" variant="secondary" size="md" onClick={resetFilters}>
              Show all connections
            </Button>
          </div>
        ) : selectedNode ? (
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
              <Button
                type="button"
                variant="text"
                size="sm"
                className={styles.panelClear}
                onClick={() => setSelected(null)}
              >
                Clear selection
              </Button>
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
        <p className={styles.captionArcGrammar}>
          Each row is one entity, ordered by the group the research placed it in;
          each arc is one recorded connection, reaching as far as the two rows are
          apart. A <b>solid</b> arc is a documented relationship, a <b>dashed</b>{' '}
          one an observed interaction, a <b>dotted</b> one inferred coordination —
          and a fainter line is a lower confidence grade. Nothing here is drawn
          more firmly than the research graded it.
        </p>
        <p className={styles.captionListGrammar}>
          Each entry is one entity, ordered by the group the research placed it
          in; open one to read its recorded connections, each labelled with the
          kind of evidence behind it — <b>documented</b>, <b>observed</b>, or{' '}
          <b>inferred</b> — and the researchers&rsquo; confidence grade. Nothing
          here is stated more firmly than the research graded it.
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
