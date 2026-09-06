'use client';

import { Button } from '@/components/ui/Button';
import { useInvestigation } from './InvestigationProvider';
import styles from './investigation.module.css';

/**
 * The persistent evidence path — what the reader is following right now.
 *
 * Selection is the one piece of state every section shares, and a reader
 * scrolling from the role map to the ledger needs to see it stated in words
 * rather than infer it from which rows are lit. So the path is a sticky line:
 * what is selected, how much of the file it touches, the date range if one
 * is set, and the way back. It never carries evidence itself; the sections do.
 */
export function EvidencePath() {
  const { selection, active, related, entityById, narrativeById, edgeById, claimById, clear, interactive } =
    useInvestigation();

  if (!interactive) return null;

  const parts: string[] = [];
  const entity = selection.entity ? entityById.get(selection.entity) : undefined;
  const narrative = selection.narrative ? narrativeById.get(selection.narrative) : undefined;
  const edge = selection.edge ? edgeById.get(selection.edge) : undefined;
  const claim = selection.claim ? claimById.get(selection.claim) : undefined;
  if (entity) parts.push(entity.handle ? `@${entity.handle}` : entity.name);
  if (narrative) parts.push(`“${narrative.title}”`);
  if (edge) parts.push(`${edge.from} → ${edge.to}`);
  if (claim) parts.push(`finding ${claim.id.replace(/^claim_/, '').replace(/_/g, ' ')}`);
  const rangeText =
    selection.from || selection.to
      ? `${selection.from ?? 'start'} to ${selection.to ?? 'now'}`
      : '';

  return (
    <div className={styles.path} role="status" aria-live="polite" data-active={active || rangeText ? 'yes' : 'no'}>
      {active ? (
        <>
          <span className={styles.pathLabel}>Following</span>
          <span className={styles.pathSubject}>{parts.join(' · ')}</span>
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
