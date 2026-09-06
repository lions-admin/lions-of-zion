'use client';

import { ConfidenceChip, VerificationBadge } from '@/components/content';
import { Button } from '@/components/ui/Button';
import { pathState, useInvestigation } from './InvestigationProvider';
import { dateLabel } from './labels';
import styles from './investigation.module.css';

/** How many representative findings a lane shows before pointing at the ledger. */
const REPRESENTATIVE = 4;

/**
 * Recurring narratives as horizontal lanes.
 *
 * A lane shows how an idea travels — which accounts the research names as
 * carrying it, over what dates, with which graded findings — without
 * pretending that every account sharing a frame is coordinated. The join
 * between a narrative and its carriers is textual (the research's own
 * description names them), and the lane says so.
 *
 * "Contested" means at least one linked finding carries a contradicting
 * source. It is a state of the evidence, not a verdict on the narrative.
 */
export function NarrativeLanes() {
  const { model, selection, active, related, toggle, interactive, entityById, claimById, inRange } =
    useInvestigation();

  if (model.narratives.length === 0) {
    return (
      <p className={styles.emptyNote}>
        This file records no recurring narrative as a separate object; the frames it documents
        are inside its graded findings.
      </p>
    );
  }

  return (
    <ol className={styles.lanes}>
      {model.narratives.map((narrative) => {
        const selected = selection.narrative === narrative.id;
        const claims = narrative.claimIds
          .map((id) => claimById.get(id))
          .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
          .filter((claim) => inRange(claim.observedAt));
        const carriers = narrative.carrierIds
          .map((id) => entityById.get(id))
          .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
        return (
          <li
            key={narrative.id}
            id={`narrative-${narrative.id}`}
            className={styles.lane}
            data-path={pathState(active, related.narratives.has(narrative.id))}
            data-selected={selected ? 'yes' : undefined}
          >
            <div className={styles.laneHead}>
              <h3 className={styles.laneTitle}>{narrative.title}</h3>
              <span className={styles.laneGrades}>
                {narrative.confidence ? <ConfidenceChip value={narrative.confidence} /> : null}
                <span className={styles.stateLabel} data-state={narrative.contested ? 'contested' : 'uncontested'}>
                  {narrative.contested ? 'Contested' : 'No contradicting source attached'}
                </span>
                {narrative.status ? <span className={styles.stateLabel}>{narrative.status}</span> : null}
              </span>
            </div>

            <p className={styles.laneDates}>
              {narrative.firstSeen || narrative.lastSeen ? (
                <>
                  Observed in this file’s findings{' '}
                  {narrative.firstSeen ? (
                    <time dateTime={narrative.firstSeen}>{dateLabel(narrative.firstSeen)}</time>
                  ) : null}
                  {narrative.lastSeen && narrative.lastSeen !== narrative.firstSeen ? (
                    <>
                      {' '}
                      – <time dateTime={narrative.lastSeen}>{dateLabel(narrative.lastSeen)}</time>
                    </>
                  ) : null}
                </>
              ) : (
                'No dated finding is linked to this narrative.'
              )}
            </p>

            {narrative.summary ? <p className={styles.laneSummary}>{narrative.summary}</p> : null}
            {narrative.frame ? (
              <p className={styles.laneFrame}>
                <span>The move</span> {narrative.frame}
              </p>
            ) : null}
            {narrative.audience ? (
              <p className={styles.laneFrame}>
                <span>Aimed at</span> {narrative.audience}
              </p>
            ) : null}

            <div className={styles.laneCarriers}>
              <span className={styles.laneLabel}>
                {carriers.length > 0 ? 'Accounts named' : 'No account named in the research’s description'}
              </span>
              {carriers.map((entity) => (
                <Button
                  key={entity.id}
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={styles.entityChip}
                  isActive={selection.entity === entity.id}
                  tabIndex={interactive ? 0 : -1}
                  onClick={() => toggle('entity', entity.id)}
                >
                  {entity.handle ? `@${entity.handle}` : entity.name}
                </Button>
              ))}
            </div>

            {claims.length > 0 ? (
              <ol className={styles.laneClaims}>
                {claims.slice(0, REPRESENTATIVE).map((claim) => (
                  <li key={claim.id}>
                    <a href={`#${claim.id}`} className={styles.laneClaimLink}>
                      <span className={styles.laneClaimGrades}>
                        <VerificationBadge assessment={claim.verdict} />
                        {claim.observedAt ? (
                          <time dateTime={claim.observedAt}>{dateLabel(claim.observedAt)}</time>
                        ) : null}
                      </span>
                      <span className={styles.laneClaimText}>{claim.statement}</span>
                    </a>
                  </li>
                ))}
                {claims.length > REPRESENTATIVE ? (
                  <li className={styles.laneMore}>
                    <a href="#evidence">
                      {claims.length - REPRESENTATIVE} more in the evidence ledger
                    </a>
                  </li>
                ) : null}
              </ol>
            ) : (
              <p className={styles.laneEmpty}>
                {narrative.claimIds.length > 0
                  ? 'No linked finding falls inside the selected date range.'
                  : 'No graded finding in this file names one of this narrative’s carriers.'}
              </p>
            )}

            <div className={styles.laneActions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isActive={selected}
                tabIndex={interactive ? 0 : -1}
                onClick={() => toggle('narrative', narrative.id)}
              >
                {selected ? 'Following this narrative — stop' : 'Follow this narrative'}
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
