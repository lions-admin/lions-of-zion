'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ConfidenceChip, EvidenceClassChip, ResearchText, VerificationBadge } from '@/components/content';
import { Button } from '@/components/ui/Button';
import { ROLE_ORDER } from '@/lib/content/fake-resistance-roles';
import { useInvestigation } from './InvestigationProvider';
import { IdentityLabel, KIND_LABEL, KindLabel, TypeLabel, dateLabel, durationLabel, pValueLabel } from './labels';
import styles from './investigation.module.css';

/**
 * The selected entity, connection, narrative or finding, restated in words.
 *
 * Two mounts of the same component: `variant="rail"` sits in the page's right
 * rail above 1220px, sticky beside the reading column; `variant="sheet"` is
 * the bottom sheet below that width. Both read the same selection, and CSS
 * shows exactly one of them at any width. The sheet is not modal — the page
 * stays scrollable and usable behind it — and it closes on Escape, on its
 * own button, or by clearing the selection anywhere.
 *
 * Nothing here is new evidence. Every line restates something a section on
 * the page already carries, gathered in one place beside the reader's place
 * in the document.
 */
export function EntityInspector({ variant }: { variant: 'rail' | 'sheet' }) {
  const {
    model,
    selection,
    active,
    interactive,
    entityById,
    edgeById,
    narrativeById,
    claimById,
    eventById,
    toggle,
    select,
    clear,
  } = useInvestigation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== 'sheet' || !active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, active, clear]);

  if (!interactive) return null;
  if (variant === 'sheet' && !active) return null;

  const edge = selection.edge ? edgeById.get(selection.edge) : undefined;
  const entity = selection.entity ? entityById.get(selection.entity) : undefined;
  const narrative = selection.narrative ? narrativeById.get(selection.narrative) : undefined;
  const claim = selection.claim ? claimById.get(selection.claim) : undefined;

  const elsewhere = entity ? (model.elsewhere[entity.id] ?? []) : [];

  const heading = edge
    ? 'Selected connection'
    : entity
      ? 'Selected account'
      : narrative
        ? 'Selected narrative'
        : claim
          ? 'Selected finding'
          : 'Inspector';

  const panel = (
    <div
      ref={ref}
      className={styles.inspector}
      data-variant={variant}
      role={variant === 'sheet' ? 'dialog' : 'region'}
      aria-label={heading}
      aria-modal={variant === 'sheet' ? false : undefined}
    >
      <div className={styles.inspectorHead}>
        <span className={styles.inspectorKicker}>{heading}</span>
        {active ? (
          <Button type="button" variant="text" size="sm" onClick={clear}>
            {variant === 'sheet' ? 'Close' : 'Clear'}
          </Button>
        ) : null}
      </div>

      {!active ? (
        <p className={styles.inspectorRest}>
          {model.entities.length} entities, {model.edges.length} connections,{' '}
          {model.narratives.length} narratives, {model.claims.length} graded findings. Choose one
          to read it here beside the page.
        </p>
      ) : null}

      {edge ? (
        <div className={styles.inspectorBody}>
          <p className={styles.inspectorTitle}>
            {edge.from} {edge.directed ? '→' : '↔'} {edge.to}
          </p>
          <p className={styles.inspectorGrades}>
            <KindLabel kind={edge.kind} />
            <EvidenceClassChip value={edge.evidenceClass} />
            {edge.confidence ? <ConfidenceChip value={edge.confidence} /> : null}
          </p>
          <p className={styles.inspectorText}>{edge.statement}</p>
          <dl className={styles.inspectorFacts}>
            <div>
              <dt>Relation</dt>
              <dd>
                {edge.relationLabel} · {edge.directed ? 'directed' : 'undirected'} ·{' '}
                {KIND_LABEL[edge.kind]}
              </dd>
            </div>
            {edge.indicators.length > 0 ? (
              <div>
                <dt>Indicators</dt>
                <dd>{edge.indicators.map((i) => i.replace(/_/g, ' ')).join(', ')}</dd>
              </div>
            ) : null}
            {edge.lag ? (
              <div>
                <dt>Measured lag</dt>
                <dd>
                  median {durationLabel(edge.lag.medianSeconds)}
                  {edge.lag.pValue !== undefined ? ` · ${pValueLabel(edge.lag.pValue)}` : ''} · n ={' '}
                  {edge.lag.n.toLocaleString('en-US')}
                </dd>
              </div>
            ) : null}
            {edge.kind === 'inferred' ? (
              <div>
                <dt>Caveat</dt>
                <dd>
                  Inferred coordination is a statistical pattern, not an established relationship.
                  {edge.pValue !== undefined ? ` ${pValueLabel(edge.pValue)}.` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.inspectorActions}>
            <Button type="button" variant="ghost" size="sm" onClick={() => select({ edge: undefined, entity: edge.fromId })}>
              Follow {edge.from}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => select({ edge: undefined, entity: edge.toId })}>
              Follow {edge.to}
            </Button>
            <a className={styles.profileLink} href={`#edge-${edge.id}`}>
              Go to the row
            </a>
          </p>
        </div>
      ) : entity ? (
        <div className={styles.inspectorBody}>
          <p className={styles.inspectorTitle}>{entity.name}</p>
          <p className={styles.inspectorGrades}>
            {entity.handle ? <span className={styles.entityHandle}>@{entity.handle}</span> : null}
            <TypeLabel type={entity.type} />
            <IdentityLabel status={entity.identityStatus} />
          </p>
          <dl className={styles.inspectorFacts}>
            <div>
              <dt>Part in this file</dt>
              <dd>
                {ROLE_ORDER.find((d) => d.role === entity.role)?.label ?? entity.role}
                <span className={styles.inspectorMeaning}>
                  {ROLE_ORDER.find((d) => d.role === entity.role)?.meaning}
                </span>
              </dd>
            </div>
            {entity.basis ? (
              <div>
                <dt>Why it is here</dt>
                <dd>{entity.basis}</dd>
              </div>
            ) : null}
            {typeof entity.followers === 'number' ? (
              <div>
                <dt>Followers at retrieval</dt>
                <dd>{entity.followers.toLocaleString('en-US')}</dd>
              </div>
            ) : null}
          </dl>
          {entity.note ? (
            <p className={styles.inspectorText}>
              <ResearchText>{entity.note}</ResearchText>
            </p>
          ) : null}

          {entity.edgeIds.length > 0 ? (
            <>
              <h4 className={styles.inspectorSub}>Connections ({entity.edgeIds.length})</h4>
              <ul className={styles.inspectorList}>
                {entity.edgeIds.map((id) => {
                  const row = edgeById.get(id);
                  if (!row) return null;
                  const outward = row.fromId === entity.id;
                  const other = outward ? row.to : row.from;
                  return (
                    <li key={id}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className={styles.inspectorRowButton}
                        onClick={() => select({ edge: id })}
                      >
                        <span>
                          {row.directed ? (outward ? 'to' : 'from') : 'with'} <b>{other}</b> —{' '}
                          {row.relationLabel}
                        </span>
                        <KindLabel kind={row.kind} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {entity.narrativeIds.length > 0 ? (
            <>
              <h4 className={styles.inspectorSub}>Narratives ({entity.narrativeIds.length})</h4>
              <ul className={styles.inspectorList}>
                {entity.narrativeIds.map((id) => {
                  const row = narrativeById.get(id);
                  if (!row) return null;
                  return (
                    <li key={id}>
                      <a className={styles.profileLink} href={`#narrative-${id}`}>
                        {row.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {entity.claimIds.length > 0 ? (
            <>
              <h4 className={styles.inspectorSub}>Findings ({entity.claimIds.length})</h4>
              <ul className={styles.inspectorList}>
                {entity.claimIds.map((id) => {
                  const row = claimById.get(id);
                  if (!row) return null;
                  return (
                    <li key={id}>
                      <a className={styles.profileLink} href={`#${id}`}>
                        <VerificationBadge assessment={row.verdict} /> {row.statement}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {entity.eventIds.length > 0 ? (
            <>
              <h4 className={styles.inspectorSub}>Events ({entity.eventIds.length})</h4>
              <ul className={styles.inspectorList}>
                {entity.eventIds.map((id) => {
                  const row = eventById.get(id);
                  if (!row) return null;
                  return (
                    <li key={id}>
                      <a className={styles.profileLink} href={`#event-${id}`}>
                        {row.occurredAt ? `${dateLabel(row.occurredAt)} · ` : ''}
                        {row.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          <h4 className={styles.inspectorSub}>Where this appears elsewhere</h4>
          <ul className={styles.inspectorList}>
            {elsewhere.map((link) => (
              <li key={link.slug}>
                <Link
                  className={styles.profileLink}
                  href={`/fake-resistance/cases/${link.slug}${
                    entity.handle ? `?handle=${encodeURIComponent(entity.handle)}` : ''
                  }`}
                >
                  {link.title}
                </Link>
              </li>
            ))}
            {entity.handle ? (
              <li>
                <Link
                  className={styles.profileLink}
                  href={`/fake-resistance/network?handle=${encodeURIComponent(entity.handle)}`}
                >
                  The cross-case network
                </Link>
              </li>
            ) : null}
            {elsewhere.length === 0 && !entity.handle ? (
              <li className={styles.inspectorMeaning}>Only in this file.</li>
            ) : null}
          </ul>
          <p className={styles.inspectorActions}>
            <a className={styles.profileLink} href={`#entity-${entity.id}`}>
              Go to the role map
            </a>
          </p>
        </div>
      ) : narrative ? (
        <div className={styles.inspectorBody}>
          <p className={styles.inspectorTitle}>{narrative.title}</p>
          <p className={styles.inspectorGrades}>
            {narrative.confidence ? <ConfidenceChip value={narrative.confidence} /> : null}
            <span className={styles.stateLabel} data-state={narrative.contested ? 'contested' : 'uncontested'}>
              {narrative.contested ? 'Contested' : 'No contradicting source attached'}
            </span>
          </p>
          {narrative.summary ? <p className={styles.inspectorText}>{narrative.summary}</p> : null}
          <p className={styles.inspectorActions}>
            {narrative.carrierIds.map((id) => {
              const row = entityById.get(id);
              if (!row) return null;
              return (
                <Button key={id} type="button" variant="ghost" size="xs" className={styles.entityChip} onClick={() => toggle('entity', id)}>
                  {row.handle ? `@${row.handle}` : row.name}
                </Button>
              );
            })}
          </p>
          <p className={styles.inspectorActions}>
            <a className={styles.profileLink} href={`#narrative-${narrative.id}`}>
              Go to the lane
            </a>
          </p>
        </div>
      ) : claim ? (
        <div className={styles.inspectorBody}>
          <p className={styles.inspectorGrades}>
            <VerificationBadge assessment={claim.verdict} />
            {claim.confidence ? <ConfidenceChip value={claim.confidence} /> : null}
            {claim.observedAt ? <time dateTime={claim.observedAt}>{dateLabel(claim.observedAt)}</time> : null}
          </p>
          <p className={styles.inspectorText}>{claim.statement}</p>
          <dl className={styles.inspectorFacts}>
            <div>
              <dt>Evidence</dt>
              <dd>
                {claim.supporting.length} supporting · {claim.contradicting.length} contradicting
                {claim.context.length ? ` · ${claim.context.length} context` : ''}
              </dd>
            </div>
            {claim.attributedTo ? (
              <div>
                <dt>Attributed to</dt>
                <dd>{claim.attributedTo}</dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.inspectorActions}>
            <a className={styles.profileLink} href={`#${claim.id}`}>
              Go to the ledger row
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );

  /* The sheet is fixed to the viewport, and the page shell's entry animation
     leaves a transform on the reading panel — which would make "fixed" mean
     "fixed to the panel". A portal onto <body> keeps it on the viewport. */
  if (variant === 'sheet') return createPortal(panel, document.body);
  return panel;
}
