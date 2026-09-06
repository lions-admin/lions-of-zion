'use client';

import { ResearchText } from '@/components/content';
import { Button } from '@/components/ui/Button';
import { ROLE_ORDER, type EntityRole } from '@/lib/content/fake-resistance-roles';
import type { InvestigationEntity } from '@/lib/content/investigation-model';
import { pathState, useInvestigation } from './InvestigationProvider';
import { IdentityLabel, TypeLabel } from './labels';
import styles from './investigation.module.css';

/** Groups a reader opens on purpose rather than by default. */
const COLLAPSED: ReadonlySet<EntityRole> = new Set(['control', 'other', 'referenced', 'desk']);

/**
 * The participants as parts in the story, not as a directory.
 *
 * Each role group is a native disclosure over its rows, and each row is a
 * native disclosure over a compact profile — handle, identity grade, the
 * research's own note, and what in this file touches the account. The
 * "Follow" control inside the profile is what lights the account's evidence
 * across the page; the disclosure itself needs no script.
 *
 * Follower counts are a snapshot and decay, so they are secondary metadata
 * inside the profile, never a column in the row.
 */
export function RoleMap() {
  const { model, selection, active, related, toggle, interactive, narrativeById } = useInvestigation();

  const filterNarrative = selection.narrative ? narrativeById.get(selection.narrative) : undefined;
  const visible = filterNarrative
    ? model.entities.filter((entity) => related.entities.has(entity.id))
    : model.entities;

  const groups = ROLE_ORDER.map((definition) => ({
    definition,
    entities: visible.filter((entity) => entity.role === definition.role),
  })).filter((group) => group.entities.length > 0);

  return (
    <div className={styles.roleMap}>
      {filterNarrative ? (
        <p className={styles.filterNote} role="status">
          Showing the {visible.length} {visible.length === 1 ? 'account' : 'accounts'} named in
          the narrative “{filterNarrative.title}”.{' '}
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => toggle('narrative', filterNarrative.id)}
          >
            Show everyone
          </Button>
        </p>
      ) : null}

      {groups.map(({ definition, entities }) => (
        <details
          key={definition.role}
          className={styles.roleGroup}
          open={!COLLAPSED.has(definition.role)}
          data-role={definition.role}
        >
          <summary className={styles.roleSummary}>
            <span className={styles.roleLabel}>{definition.label}</span>
            <span className={styles.roleCount}>{entities.length}</span>
            <span className={styles.roleMeaning}>{definition.meaning}</span>
          </summary>
          <ol className={styles.roleRows}>
            {entities.map((entity) => (
              <RoleRow
                key={entity.id}
                entity={entity}
                selected={selection.entity === entity.id}
                path={pathState(active, related.entities.has(entity.id))}
                interactive={interactive}
                onFollow={() => toggle('entity', entity.id)}
              />
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

function RoleRow({
  entity,
  selected,
  path,
  interactive,
  onFollow,
}: {
  entity: InvestigationEntity;
  selected: boolean;
  path: 'on' | 'off' | undefined;
  interactive: boolean;
  onFollow: () => void;
}) {
  return (
    <li className={styles.roleRow} data-path={path} data-selected={selected ? 'yes' : undefined} id={`entity-${entity.id}`}>
      <details className={styles.profile} open={selected || undefined}>
        <summary className={styles.profileSummary}>
          <span className={styles.entityName}>{entity.name}</span>
          <span className={styles.entityFacts}>
            {entity.handle ? <span className={styles.entityHandle}>@{entity.handle}</span> : null}
            <TypeLabel type={entity.type} />
            <IdentityLabel status={entity.identityStatus} />
          </span>
        </summary>
        <div className={styles.profileBody}>
          {entity.basis ? <p className={styles.profileBasis}>{entity.basis}</p> : null}
          {entity.note ? (
            <p className={styles.profileNote}>
              <ResearchText>{entity.note}</ResearchText>
            </p>
          ) : null}
          <dl className={styles.profileFacts}>
            {typeof entity.followers === 'number' ? (
              <div>
                <dt>Followers at retrieval</dt>
                <dd>{entity.followers.toLocaleString('en-US')}</dd>
              </div>
            ) : null}
            <div>
              <dt>In this file</dt>
              <dd>
                {entity.edgeIds.length} {entity.edgeIds.length === 1 ? 'connection' : 'connections'} ·{' '}
                {entity.narrativeIds.length} {entity.narrativeIds.length === 1 ? 'narrative' : 'narratives'} ·{' '}
                {entity.claimIds.length} {entity.claimIds.length === 1 ? 'finding' : 'findings'} ·{' '}
                {entity.eventIds.length} {entity.eventIds.length === 1 ? 'event' : 'events'}
              </dd>
            </div>
          </dl>
          <div className={styles.profileActions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isActive={selected}
              tabIndex={interactive ? 0 : -1}
              onClick={onFollow}
            >
              {selected ? 'Following — stop' : 'Follow through the file'}
            </Button>
            {entity.claimIds.length > 0 ? (
              <a className={styles.profileLink} href="#evidence">
                Findings
              </a>
            ) : null}
            {entity.edgeIds.length > 0 ? (
              <a className={styles.profileLink} href="#flows">
                Connections
              </a>
            ) : null}
          </div>
        </div>
      </details>
    </li>
  );
}
