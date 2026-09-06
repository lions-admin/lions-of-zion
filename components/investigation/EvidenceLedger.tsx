'use client';

import { useMemo, useState } from 'react';
import { ConfidenceChip, TechniqueChips, VerificationBadge } from '@/components/content';
import { Button } from '@/components/ui/Button';
import {
  SOURCE_TYPE_LABEL,
  type InvestigationClaim,
  type LedgerSource,
  type SourceType,
} from '@/lib/content/investigation-model';
import { pathState, useInvestigation } from './InvestigationProvider';
import { dateLabel } from './labels';
import styles from './investigation.module.css';

const SOURCE_TYPES: SourceType[] = [
  'x_post',
  'community_note',
  'fact_check',
  'archive',
  'official',
  'research',
  'press',
  'analysis',
  'other',
];

/**
 * The evidence ledger — one row per graded finding.
 *
 * `Claim → supporting observations → contradictory observations → current
 * reading → confidence → sources`, with supporting and contradicting evidence
 * side by side so the ledger cannot become a confirmation-only story. The
 * current reading is the researchers' own publication wording, untouched.
 *
 * Source types are distinguished in words. A Community Note is *contested
 * content* — a platform signal that other readers disputed the item — and it
 * is labelled that way; it is never read as "false".
 *
 * "Show evidence" opens the sources in place. No reader is sent to another
 * screen to see what a finding rests on.
 */
export function EvidenceLedger() {
  const { model, selection, active, related, toggle, interactive, entityById, narrativeById, inRange } =
    useInvestigation();
  const [mutedTypes, setMutedTypes] = useState<readonly SourceType[]>([]);

  const typeCounts = useMemo(() => {
    const out = new Map<SourceType, number>();
    for (const claim of model.claims) {
      for (const source of [...claim.supporting, ...claim.contradicting, ...claim.context]) {
        out.set(source.sourceType, (out.get(source.sourceType) ?? 0) + 1);
      }
    }
    return out;
  }, [model.claims]);

  const narrative = selection.narrative ? narrativeById.get(selection.narrative) : undefined;
  const rows = model.claims.filter(
    (claim) =>
      (!narrative || related.claims.has(claim.id)) && inRange(claim.observedAt),
  );
  const hidden = model.claims.length - rows.length;

  const isShown = (source: LedgerSource) => !mutedTypes.includes(source.sourceType);
  const toggleType = (type: SourceType) =>
    setMutedTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );

  return (
    <div className={styles.ledger}>
      <div className={styles.layerSwitch} role="group" aria-label="Kinds of source shown">
        {SOURCE_TYPES.filter((type) => (typeCounts.get(type) ?? 0) > 0).map((type) => (
          <Button
            key={type}
            type="button"
            variant="secondary"
            size="sm"
            className={styles.layerChip}
            isActive={!mutedTypes.includes(type)}
            tabIndex={interactive ? 0 : -1}
            onClick={() => toggleType(type)}
          >
            {SOURCE_TYPE_LABEL[type]}
            <span className={styles.layerCount}>{typeCounts.get(type)}</span>
          </Button>
        ))}
        {mutedTypes.length > 0 ? (
          <Button type="button" variant="text" size="sm" onClick={() => setMutedTypes([])}>
            Show every source type
          </Button>
        ) : null}
      </div>

      {narrative ? (
        <p className={styles.filterNote} role="status">
          Showing the findings tied to “{narrative.title}”.{' '}
          <Button type="button" variant="text" size="sm" onClick={() => toggle('narrative', narrative.id)}>
            Show every finding
          </Button>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className={styles.emptyNote} role="status">
          No graded finding matches the current selection and date range.
        </p>
      ) : (
        <ol className={styles.ledgerRows}>
          {rows.map((claim) => (
            <LedgerRow
              key={claim.id}
              claim={claim}
              path={pathState(active, related.claims.has(claim.id))}
              selected={selection.claim === claim.id}
              interactive={interactive}
              isShown={isShown}
              attributed={claim.attributedToId ? entityById.get(claim.attributedToId) : undefined}
              named={claim.entityIds
                .map((id) => entityById.get(id))
                .filter((e): e is NonNullable<typeof e> => Boolean(e))}
              selectedEntity={selection.entity}
              onFollowClaim={() => toggle('claim', claim.id)}
              onFollowEntity={(id) => toggle('entity', id)}
            />
          ))}
        </ol>
      )}
      {hidden > 0 ? (
        <p className={styles.subnote} role="status">
          {hidden} {hidden === 1 ? 'finding is' : 'findings are'} outside the current selection.
        </p>
      ) : null}
    </div>
  );
}

function LedgerRow({
  claim,
  path,
  selected,
  interactive,
  isShown,
  attributed,
  named,
  selectedEntity,
  onFollowClaim,
  onFollowEntity,
}: {
  claim: InvestigationClaim;
  path: 'on' | 'off' | undefined;
  selected: boolean;
  interactive: boolean;
  isShown: (source: LedgerSource) => boolean;
  attributed?: { id: string; name: string; handle?: string };
  named: { id: string; name: string; handle?: string }[];
  selectedEntity?: string;
  onFollowClaim: () => void;
  onFollowEntity: (id: string) => void;
}) {
  const supporting = claim.supporting.filter(isShown);
  const contradicting = claim.contradicting.filter(isShown);
  const context = claim.context.filter(isShown);
  const [open, setOpen] = useState(false);
  const evidenceId = `${claim.id}-evidence`;

  return (
    <li
      id={claim.id}
      className={styles.ledgerRow}
      data-path={path}
      data-selected={selected ? 'yes' : undefined}
      data-contested={claim.contested ? 'yes' : undefined}
    >
      <div className={styles.ledgerClaim}>
        <div className={styles.ledgerGrades}>
          <VerificationBadge assessment={claim.verdict} />
          {claim.confidence ? <ConfidenceChip value={claim.confidence} /> : null}
          {claim.observedAt ? (
            <time dateTime={claim.observedAt}>{dateLabel(claim.observedAt)}</time>
          ) : null}
          {claim.contested ? (
            <span className={styles.stateLabel} data-state="contested">
              Contradicting source attached
            </span>
          ) : null}
        </div>
        <p className={styles.ledgerStatement}>{claim.statement}</p>
        <p className={styles.ledgerAttribution}>
          {attributed ? (
            <>
              <span className={styles.laneLabel}>Attributed to</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={styles.entityChip}
                isActive={selectedEntity === attributed.id}
                tabIndex={interactive ? 0 : -1}
                onClick={() => onFollowEntity(attributed.id)}
              >
                {attributed.handle ? `@${attributed.handle}` : attributed.name}
              </Button>
            </>
          ) : claim.attributedTo ? (
            <>
              <span className={styles.laneLabel}>Attributed to</span>
              <span>{claim.attributedTo}</span>
            </>
          ) : null}
          {named.filter((e) => e.id !== attributed?.id).length > 0 ? (
            <>
              <span className={styles.laneLabel}>Names</span>
              {named
                .filter((e) => e.id !== attributed?.id)
                .map((entity) => (
                  <Button
                    key={entity.id}
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={styles.entityChip}
                    isActive={selectedEntity === entity.id}
                    tabIndex={interactive ? 0 : -1}
                    onClick={() => onFollowEntity(entity.id)}
                  >
                    {entity.handle ? `@${entity.handle}` : entity.name}
                  </Button>
                ))}
            </>
          ) : null}
        </p>
        <TechniqueChips ids={claim.techniques} />
      </div>

      <div className={styles.ledgerColumns}>
        <div className={styles.ledgerColumn} data-side="supporting">
          <span className={styles.ledgerColumnLabel}>Supporting</span>
          <span className={styles.ledgerColumnCount}>
            {supporting.length} {supporting.length === 1 ? 'source' : 'sources'}
            {context.length > 0 ? ` · ${context.length} context` : ''}
          </span>
        </div>
        <div className={styles.ledgerColumn} data-side="contradicting">
          <span className={styles.ledgerColumnLabel}>Contradicting</span>
          <span className={styles.ledgerColumnCount}>
            {contradicting.length > 0
              ? `${contradicting.length} ${contradicting.length === 1 ? 'source' : 'sources'}`
              : 'none attached'}
          </span>
        </div>
        <div className={styles.ledgerColumn} data-side="reading">
          <span className={styles.ledgerColumnLabel}>Current reading</span>
          <span className={styles.ledgerColumnCount}>
            as stated above, in the researchers’ publication wording
          </span>
        </div>
      </div>

      <div className={styles.ledgerActions}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={evidenceId}
          tabIndex={interactive ? 0 : -1}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide evidence' : 'Show evidence'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isActive={selected}
          tabIndex={interactive ? 0 : -1}
          onClick={onFollowClaim}
        >
          {selected ? 'Following — stop' : 'Follow this finding'}
        </Button>
      </div>

      {/* Without JavaScript `open` never flips, so the evidence is rendered
          and merely collapsed by the `hidden` attribute the script controls —
          which means it is in the document for a reader with no script, who
          sees it expanded. */}
      <div id={evidenceId} className={styles.ledgerEvidence} hidden={interactive && !open}>
        <SourceColumn label="Supporting observations" sources={supporting} side="supporting" />
        <SourceColumn label="Contradicting observations" sources={contradicting} side="contradicting" />
        {context.length > 0 ? (
          <SourceColumn label="Context" sources={context} side="context" />
        ) : null}
      </div>
    </li>
  );
}

function SourceColumn({
  label,
  sources,
  side,
}: {
  label: string;
  sources: LedgerSource[];
  side: 'supporting' | 'contradicting' | 'context';
}) {
  return (
    <div className={styles.sourceColumn} data-side={side}>
      <h4 className={styles.sourceColumnHeading}>{label}</h4>
      {sources.length === 0 ? (
        <p className={styles.sourceEmpty}>
          {side === 'contradicting'
            ? 'No contradicting source is attached to this finding. The file’s wider counter-evidence is in “What cuts against it”.'
            : 'No source of the selected types.'}
        </p>
      ) : (
        <ol className={styles.sourceRows}>
          {sources.map((source, index) => (
            <li key={`${source.id}-${index}`} className={styles.sourceRow} data-type={source.sourceType}>
              <span className={styles.sourceType}>
                {SOURCE_TYPE_LABEL[source.sourceType]}
                {source.sourceType === 'community_note' ? ' — contested content, not a verdict' : ''}
              </span>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  {source.label} <span aria-hidden="true">↗︎</span>
                </a>
              ) : (
                <span className={styles.sourceText}>{source.label}</span>
              )}
              <span className={styles.sourceMeta}>
                {source.kind ? `${source.kind}` : ''}
                {source.retrievedAt ? ` · retrieved ${dateLabel(source.retrievedAt)}` : ''}
                {source.reliability ? ` · reliability ${source.reliability}` : ''}
                {source.archiveUrl ? (
                  <>
                    {' · '}
                    <a href={source.archiveUrl} target="_blank" rel="noreferrer">
                      archived copy <span aria-hidden="true">↗︎</span>
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
