'use client';

import { useId, type ReactNode } from 'react';
import { ConfidenceChip, ResearchText } from '@/components/content';
import { Button } from '@/components/ui/Button';
import { pathState, useInvestigation } from './InvestigationProvider';
import { dateLabel } from './labels';
import styles from './investigation.module.css';

const OCTOBER_7 = '2023-10-07';

/**
 * The two-level timeline: key events, and the activity band under them.
 *
 * The key events are the research's own chronology — account creation,
 * platform actions, narrative bursts, corrections. The activity band is the
 * server-rendered cadence figure handed in as `band` (posting volume,
 * subjects against controls); it is a server component, so it arrives as
 * children rather than being imported here.
 *
 * A date range narrows the rest of the case: events outside it are folded
 * away with a count, findings outside it drop out of the lanes and the
 * ledger. The default is the whole record; detail comes with selection.
 */
export function InvestigationTimeline({ band }: { band?: ReactNode }) {
  const { model, selection, active, related, setRange, toggle, interactive, entityById, inRange } =
    useInvestigation();
  const id = useId();

  const dated = model.events.filter((event) => event.occurredAt);
  const shown = model.events.filter((event) => inRange(event.occurredAt));
  const hidden = model.events.length - shown.length;
  const first = dated[0]?.occurredAt?.slice(0, 10);
  const last = dated.at(-1)?.occurredAt?.slice(0, 10);
  const rangeSet = Boolean(selection.from || selection.to);

  const presets: { label: string; from?: string; to?: string }[] = [
    { label: 'Whole record' },
    ...(model.window ? [{ label: 'Harvest window', from: model.window.start, to: model.window.end }] : []),
    { label: 'Before October 7, 2023', to: '2023-10-06' },
    { label: 'Since October 7, 2023', from: OCTOBER_7 },
  ];

  return (
    <div className={styles.timeline}>
      <div className={styles.rangeControls} role="group" aria-label="Focus the case on a date range">
        <div className={styles.rangePresets}>
          {presets.map((preset) => {
            const on =
              (preset.from ?? undefined) === selection.from && (preset.to ?? undefined) === selection.to;
            return (
              <Button
                key={preset.label}
                type="button"
                variant="secondary"
                size="sm"
                isActive={on}
                tabIndex={interactive ? 0 : -1}
                onClick={() => setRange(preset.from, preset.to)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
        <div className={styles.rangeInputs}>
          <label className={styles.rangeField}>
            <span>From</span>
            <input
              id={`${id}-from`}
              type="date"
              value={selection.from ?? ''}
              min={first}
              max={selection.to ?? last}
              tabIndex={interactive ? 0 : -1}
              onChange={(event) => setRange(event.target.value || undefined, selection.to)}
            />
          </label>
          <label className={styles.rangeField}>
            <span>To</span>
            <input
              id={`${id}-to`}
              type="date"
              value={selection.to ?? ''}
              min={selection.from ?? first}
              max={last}
              tabIndex={interactive ? 0 : -1}
              onChange={(event) => setRange(selection.from, event.target.value || undefined)}
            />
          </label>
          {rangeSet ? (
            <Button type="button" variant="text" size="sm" onClick={() => setRange(undefined, undefined)}>
              Clear range
            </Button>
          ) : null}
        </div>
      </div>

      {band ? (
        <div className={styles.activityBand}>
          <h3 className={styles.subheading}>Activity band</h3>
          <p className={styles.subnote}>
            Posting volume per day in the harvested sample, subjects above the axis and matched
            controls below it. A burst is only unusual next to the controls.
          </p>
          {band}
        </div>
      ) : null}

      <h3 className={styles.subheading}>Key events</h3>
      {shown.length === 0 ? (
        <p className={styles.emptyNote} role="status">
          No recorded event falls inside the selected range.{' '}
          <Button type="button" variant="text" size="sm" onClick={() => setRange(undefined, undefined)}>
            Show the whole record
          </Button>
        </p>
      ) : (
        <ol className={styles.eventList}>
          {shown.map((event) => (
            <li
              key={event.id}
              id={`event-${event.id}`}
              className={styles.eventRow}
              data-path={pathState(active, related.events.has(event.id))}
            >
              <div className={styles.eventMeta}>
                {event.occurredAt ? (
                  <time dateTime={event.occurredAt}>{dateLabel(event.occurredAt)}</time>
                ) : (
                  <span>Undated</span>
                )}
                <span className={styles.eventType}>{event.label}</span>
                {event.confidence ? <ConfidenceChip value={event.confidence} /> : null}
              </div>
              <p className={styles.eventText}>
                <ResearchText>{event.description}</ResearchText>
              </p>
              {event.entityIds.length > 0 ? (
                <p className={styles.eventEntities}>
                  <span className={styles.laneLabel}>Named</span>
                  {event.entityIds.map((entityId) => {
                    const entity = entityById.get(entityId);
                    if (!entity) return null;
                    return (
                      <Button
                        key={entityId}
                        type="button"
                        variant="ghost"
                        size="xs"
                        className={styles.entityChip}
                        isActive={selection.entity === entityId}
                        tabIndex={interactive ? 0 : -1}
                        onClick={() => toggle('entity', entityId)}
                      >
                        {entity.handle ? `@${entity.handle}` : entity.name}
                      </Button>
                    );
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {hidden > 0 ? (
        <p className={styles.subnote} role="status">
          {hidden} {hidden === 1 ? 'event is' : 'events are'} outside the selected range.
        </p>
      ) : null}
    </div>
  );
}
