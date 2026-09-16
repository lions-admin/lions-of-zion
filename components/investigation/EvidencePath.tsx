'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { politeLive } from '@/components/ui/live-region';
import { useInvestigation } from './InvestigationProvider';
import styles from './investigation.module.css';

/**
 * The persistent evidence path — what the reader is following right now.
 *
 * Selection is the one piece of state every section shares, and a reader
 * scrolling from the role map to the ledger needs to see it stated in words
 * rather than infer it from which rows are lit. So the path is a line that
 * pins under the section strip *once a selection exists* — with nothing
 * selected it is a hint in the flow, not a second sticky bar (progressive
 * disclosure, 2026-09-16; the pinning is `.path[data-active='yes']` in the
 * stylesheet). It never carries evidence itself; the sections do.
 */
export function EvidencePath() {
  const { selection, active, related, entityById, narrativeById, edgeById, claimById, clear, interactive } =
    useInvestigation();

  if (!interactive) return null;

  const parts: ReactNode[] = [];
  const entity = selection.entity ? entityById.get(selection.entity) : undefined;
  const narrative = selection.narrative ? narrativeById.get(selection.narrative) : undefined;
  const edge = selection.edge ? edgeById.get(selection.edge) : undefined;
  const claim = selection.claim ? claimById.get(selection.claim) : undefined;
  if (entity) parts.push(entity.handle ? `@${entity.handle}` : entity.name);
  if (narrative) parts.push(`“${narrative.title}”`);
  if (edge) {
    /* The one arrow glyph, not a typed character inside a string: the
       direction of a connection is drawn the way every other arrow on the
       site is. A marker, not an affordance, so it carries no `.arrow` travel;
       the word a screen reader gets instead is "to". */
    parts.push(
      <>
        {edge.from}
        {' '}
        <Icon name="arrow-right" inline />
        <span className={styles.srOnly}>to</span>
        {' '}
        {edge.to}
      </>,
    );
  }
  if (claim) parts.push(`finding ${claim.id.replace(/^claim_/, '').replace(/_/g, ' ')}`);
  const rangeText =
    selection.from || selection.to
      ? `${selection.from ?? 'start'} to ${selection.to ?? 'now'}`
      : '';

  return (
    <div className={styles.path} {...politeLive} data-active={active || rangeText ? 'yes' : 'no'}>
      {active ? (
        <>
          <span className={styles.pathLabel}>Following</span>
          <span className={styles.pathSubject}>
            {parts.map((part, index) => (
              <span key={index}>
                {index ? ' · ' : null}
                {part}
              </span>
            ))}
          </span>
          <span className={styles.pathCounts}>
            {related.entities.size} {related.entities.size === 1 ? 'account' : 'accounts'} ·{' '}
            {related.edges.size} {related.edges.size === 1 ? 'connection' : 'connections'} ·{' '}
            {related.narratives.size} {related.narratives.size === 1 ? 'narrative' : 'narratives'} ·{' '}
            {related.claims.size} {related.claims.size === 1 ? 'finding' : 'findings'} ·{' '}
            {related.events.size} {related.events.size === 1 ? 'event' : 'events'}
            {rangeText ? ` · ${rangeText}` : ''}
          </span>
          <Button type="button" variant="text" size="sm" onClick={clear} className={styles.pathClear}>
            Clear
          </Button>
        </>
      ) : rangeText ? (
        <>
          <span className={styles.pathLabel}>Range</span>
          <span className={styles.pathSubject}>{rangeText}</span>
          <Button type="button" variant="text" size="sm" onClick={clear} className={styles.pathClear}>
            Clear
          </Button>
        </>
      ) : (
        <span className={styles.pathHint}>
          Choose an account, a narrative, a connection or a finding to follow its evidence
          through this file. Every selection is also a link.
        </span>
      )}
    </div>
  );
}
