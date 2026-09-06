'use client';

import { useMemo, useState } from 'react';
import { ConfidenceChip, EvidenceClassChip } from '@/components/content';
import { Button } from '@/components/ui/Button';
import type { FlowKind, InvestigationEdge } from '@/lib/content/investigation-model';
import { pathState, useInvestigation } from './InvestigationProvider';
import { KIND_LABEL, KIND_MEANING, KindLabel, dateLabel, durationLabel, pValueLabel } from './labels';
import styles from './investigation.module.css';

const LAYERS: FlowKind[] = ['flow', 'reuse', 'relationship', 'inferred', 'other'];

/**
 * How material moved — every recorded connection, typed and listed.
 *
 * This is the relationship view *and* its text fallback in one form: each
 * connection is a row that states its two ends, its direction, the kind of
 * evidence behind it, and its grade, with the rule under the row drawn in the
 * kind's line style (solid, dashed, dotted). Nothing about a connection is
 * only in a drawing, so the mobile form is the same list with the same words.
 *
 * The layers are separate on purpose. An observed quote, a measured caption
 * reuse, a documented affiliation and an inferred coordination signal are
 * four different claims with four different strengths; a single "influence"
 * line would let the weakest borrow the strongest's ink. A reader switches
 * layers off, never blends them, and an inferred edge always carries its
 * caveat in words.
 *
 * Where the case measured a lag between the two accounts, the row carries it
 * — with its p-value, null model and sample size, or not at all.
 */
export function RelationshipFlow() {
  const { model, selection, active, related, toggle, interactive, entityById } = useInvestigation();
  const [muted, setMuted] = useState<readonly FlowKind[]>([]);

  const counts = useMemo(() => {
    const out = new Map<FlowKind, number>();
    for (const edge of model.edges) out.set(edge.kind, (out.get(edge.kind) ?? 0) + 1);
    return out;
  }, [model.edges]);

  const shown = useMemo(
    () =>
      [...model.edges]
        .filter((edge) => !muted.includes(edge.kind))
        .sort(
          (a, b) =>
            LAYERS.indexOf(a.kind) - LAYERS.indexOf(b.kind) ||
            (b.weight ?? 0) - (a.weight ?? 0) ||
            a.id.localeCompare(b.id),
        ),
    [model.edges, muted],
  );

  const toggleLayer = (kind: FlowKind) =>
    setMuted((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind],
    );

  if (model.edges.length === 0) {
    return (
      <p className={styles.emptyNote}>
        This file records no connection between its entities as a graded edge. Its findings stand
        on their own sources.
      </p>
    );
  }

  return (
    <div className={styles.flows}>
      <div className={styles.layerSwitch} role="group" aria-label="Kinds of connection shown">
        {LAYERS.filter((kind) => (counts.get(kind) ?? 0) > 0).map((kind) => {
          const on = !muted.includes(kind);
          return (
            <Button
              key={kind}
              type="button"
              variant="secondary"
              size="sm"
              className={styles.layerChip}
              data-kind={kind}
              isActive={on}
              tabIndex={interactive ? 0 : -1}
              title={KIND_MEANING[kind]}
              onClick={() => toggleLayer(kind)}
            >
              <span className={styles.kindRule} aria-hidden="true" />
              {KIND_LABEL[kind]}
              <span className={styles.layerCount}>{counts.get(kind)}</span>
            </Button>
          );
        })}
        {muted.length > 0 ? (
          <Button type="button" variant="text" size="sm" onClick={() => setMuted([])}>
            Show every kind
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className={styles.emptyNote} role="status">
          Every kind of connection is switched off. Switch one back on to read the connections.
        </p>
      ) : (
        <ol className={styles.flowList}>
          {shown.map((edge) => {
            const selected = selection.edge === edge.id;
            const fromEntity = entityById.get(edge.fromId);
            const toEntity = entityById.get(edge.toId);
            return (
              <li
                key={edge.id}
                id={`edge-${edge.id}`}
                className={styles.flowRow}
                data-kind={edge.kind}
                data-path={pathState(active, related.edges.has(edge.id))}
                data-selected={selected ? 'yes' : undefined}
              >
                <div className={styles.flowStrip}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={styles.entityChip}
                    isActive={selection.entity === edge.fromId}
                    tabIndex={interactive ? 0 : -1}
                    onClick={() => toggle('entity', edge.fromId)}
                  >
                    {edge.from}
                  </Button>
                  <span className={styles.flowArrow} data-directed={edge.directed ? 'yes' : 'no'}>
                    <span className={styles.flowRelation}>{edge.relationLabel}</span>
                    <span className={styles.flowLine} aria-hidden="true" />
                    <span className={styles.srOnly}>{edge.directed ? 'to' : 'with'}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={styles.entityChip}
                    isActive={selection.entity === edge.toId}
                    tabIndex={interactive ? 0 : -1}
                    onClick={() => toggle('entity', edge.toId)}
                  >
                    {edge.to}
                  </Button>
                </div>

                <div className={styles.flowGrades}>
                  <KindLabel kind={edge.kind} />
                  <EvidenceClassChip value={edge.evidenceClass} />
                  {edge.confidence ? <ConfidenceChip value={edge.confidence} /> : null}
                  {typeof edge.weight === 'number' ? (
                    <span className={styles.flowMeasure}>
                      weight {edge.weight.toLocaleString('en-US')}
                    </span>
                  ) : null}
                  {edge.lag ? (
                    <span className={styles.flowMeasure}>
                      median lag {durationLabel(edge.lag.medianSeconds)}
                      {edge.lag.pValue !== undefined ? ` · ${pValueLabel(edge.lag.pValue)}` : ''}
                    </span>
                  ) : null}
                  {edge.kind === 'inferred' && edge.pValue !== undefined ? (
                    <span className={styles.flowMeasure}>
                      {pValueLabel(edge.pValue)}
                      {edge.sampleN ? ` · n = ${edge.sampleN.toLocaleString('en-US')}` : ''}
                    </span>
                  ) : null}
                </div>

                <p className={styles.flowStatement}>{edge.statement}</p>

                {edge.kind === 'inferred' ? (
                  <p className={styles.flowCaveat}>
                    Inferred, not established: a statistical pattern consistent with coordination.
                    Shared ownership, staffing or instruction is not shown by this line.
                  </p>
                ) : null}

                <div className={styles.flowActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isActive={selected}
                    tabIndex={interactive ? 0 : -1}
                    onClick={() => toggle('edge', edge.id)}
                    aria-expanded={selected}
                    aria-controls={`edge-${edge.id}-evidence`}
                  >
                    {selected ? 'Hide evidence' : 'Show evidence'}
                  </Button>
                </div>

                {selected ? (
                  <EdgeEvidence
                    edge={edge}
                    id={`edge-${edge.id}-evidence`}
                    fromHandle={fromEntity?.handle}
                    toHandle={toEntity?.handle}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {model.firstQuoters.length > 0 ? <FirstQuoters /> : null}

      <p className={styles.flowKey}>
        A <b>solid</b> rule is a documented tie; a <b>dashed</b> rule an observed flow or
        measured reuse; a <b>dotted</b>, fainter rule an inferred coordination signal. An arrow
        means the research recorded a direction; a bare rule means it did not. Nothing here is
        drawn more firmly than the research graded it.
      </p>
    </div>
  );
}

/** The exact relation and what stands behind it, opened in place. */
function EdgeEvidence({
  edge,
  id,
  fromHandle,
  toHandle,
}: {
  edge: InvestigationEdge;
  id: string;
  fromHandle?: string;
  toHandle?: string;
}) {
  return (
    <dl className={styles.edgeEvidence} id={id}>
      <div>
        <dt>Relation</dt>
        <dd>
          {edge.relationLabel} · {edge.directed ? 'directed' : 'undirected'} · {KIND_LABEL[edge.kind]}
        </dd>
      </div>
      {fromHandle || toHandle ? (
        <div>
          <dt>Accounts</dt>
          <dd>
            {fromHandle ? `@${fromHandle}` : edge.from} {edge.directed ? '→' : '↔'}{' '}
            {toHandle ? `@${toHandle}` : edge.to}
          </dd>
        </div>
      ) : null}
      {edge.indicators.length > 0 ? (
        <div>
          <dt>Indicators recorded</dt>
          <dd>{edge.indicators.map((i) => i.replace(/_/g, ' ')).join(', ')}</dd>
        </div>
      ) : null}
      {typeof edge.weight === 'number' ? (
        <div>
          <dt>Research weight</dt>
          <dd>
            {edge.weight.toLocaleString('en-US')} — a reproducible measure documented in the report;
            weight never implies confidence.
          </dd>
        </div>
      ) : null}
      {edge.lag ? (
        <div>
          <dt>Measured lag</dt>
          <dd>
            median {durationLabel(edge.lag.medianSeconds)}
            {edge.lag.frac300 !== undefined
              ? ` · ${Math.round(edge.lag.frac300 * 100)}% within 5 min`
              : ''}
            {edge.lag.frac60 !== undefined ? ` · ${Math.round(edge.lag.frac60 * 100)}% within 60 s` : ''}
            {edge.lag.lead ? ` · lead: ${edge.lag.lead}` : ''}
            {edge.lag.pValue !== undefined ? ` · ${pValueLabel(edge.lag.pValue)}` : ''}
            {` · n = ${edge.lag.n.toLocaleString('en-US')}`}
            {edge.lag.nullModel ? ` · null model: ${edge.lag.nullModel}` : ''}
          </dd>
        </div>
      ) : null}
      {edge.kind === 'inferred' ? (
        <div>
          <dt>Null-model test</dt>
          <dd>
            {edge.pValue !== undefined ? pValueLabel(edge.pValue) : 'p-value not carried'}
            {edge.sampleN ? ` · n = ${edge.sampleN.toLocaleString('en-US')}` : ''}
            {edge.nullModel ? ` · ${edge.nullModel}` : ''}
          </dd>
        </div>
      ) : null}
      <div>
        <dt>Sources</dt>
        <dd>
          The sources for a connection are the sources of the findings that name its accounts;
          follow either account to see them in the ledger.
        </dd>
      </div>
    </dl>
  );
}

const TREE_STATE: Record<string, string> = {
  exhausted: 'tree read to the end',
  capped: 'page cap reached — an earlier quoter may exist',
  empty_inconclusive: 'empty result — inconclusive, not zero',
};

/**
 * Who quoted an exhibit first, from the Phase-3 quote trees. The tree state
 * travels with every row: "first" is only a finding when the tree was read to
 * its end.
 */
function FirstQuoters() {
  const { model, selection, toggle, interactive, entityById } = useInvestigation();
  return (
    <div className={styles.firstQuoters}>
      <h3 className={styles.subheading}>Who quoted first</h3>
      <p className={styles.subnote}>
        For each exhibit the research harvested the quote tree across X and recorded the earliest
        quoter. A capped or empty tree is stated as such, never rendered as “nobody”.
      </p>
      <ol className={styles.firstQuoterList}>
        {model.firstQuoters.map((row) => {
          const entity = row.quoterId ? entityById.get(row.quoterId) : undefined;
          return (
            <li key={row.exhibit} className={styles.firstQuoterRow} data-state={row.treeState}>
              <p className={styles.firstQuoterLabel}>{row.label ?? `Exhibit ${row.exhibit}`}</p>
              <p className={styles.firstQuoterFacts}>
                {row.firstQuoter ? (
                  <>
                    First quoter:{' '}
                    {entity ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className={styles.entityChip}
                        isActive={selection.entity === entity.id}
                        tabIndex={interactive ? 0 : -1}
                        onClick={() => toggle('entity', entity.id)}
                      >
                        @{row.firstQuoter}
                      </Button>
                    ) : (
                      <span>@{row.firstQuoter}</span>
                    )}
                    {row.firstQuoterAt ? (
                      <>
                        {' '}
                        at <time dateTime={row.firstQuoterAt}>{dateLabel(row.firstQuoterAt)}</time>
                      </>
                    ) : null}
                  </>
                ) : (
                  'No quoter recorded'
                )}
                {typeof row.quotes === 'number' ? ` · ${row.quotes} quotes` : ''}
                {typeof row.retweeters === 'number' ? ` · ${row.retweeters} retweeters` : ''}
                {row.treeState ? ` · ${TREE_STATE[row.treeState] ?? row.treeState}` : ''}
                {row.windowCaveat ? ` · ${row.windowCaveat}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
