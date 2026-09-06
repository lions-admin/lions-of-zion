import type { CaseEntity } from '@/lib/content/fake-resistance-cases';
import type { FlowKind } from '@/lib/content/investigation-model';
import styles from './investigation.module.css';

/**
 * The small text labels the investigation surfaces share. Text, never colour
 * alone: an identity grade or a line kind must survive a monochrome print and
 * a screen reader.
 */

export const TYPE_LABEL: Record<CaseEntity['type'], string> = {
  person: 'Person',
  organization: 'Organisation',
  account: 'Account',
};

export const IDENTITY_LABEL: Record<CaseEntity['identityStatus'], string> = {
  confirmed: 'Identity confirmed',
  probable: 'Identity probable',
  unresolved: 'Identity unresolved',
};

export const KIND_LABEL: Record<FlowKind, string> = {
  flow: 'Observed flow',
  reuse: 'Measured reuse',
  relationship: 'Documented tie',
  inferred: 'Inferred coordination',
  other: 'Observed',
};

export const KIND_MEANING: Record<FlowKind, string> = {
  flow: 'Seen happening in public posts — a quote, repost, mention or promotion, with a direction.',
  reuse: 'Near-identical text or media measured between the two accounts, earliest instance first.',
  relationship: 'Stated on the record: a bio, a filing, a public self-description.',
  inferred:
    'A pattern consistent with coordination, tested against a null model. Not established — read the p-value and the sample size.',
  other: 'Seen happening in public posts.',
};

export function TypeLabel({ type }: { type: CaseEntity['type'] }) {
  return <span className={styles.typeLabel}>{TYPE_LABEL[type] ?? type}</span>;
}

export function IdentityLabel({ status }: { status: CaseEntity['identityStatus'] }) {
  return (
    <span className={styles.identityLabel} data-identity={status}>
      {IDENTITY_LABEL[status] ?? status}
    </span>
  );
}

export function KindLabel({ kind }: { kind: FlowKind }) {
  return (
    <span className={styles.kindLabel} data-kind={kind} title={KIND_MEANING[kind]}>
      <span className={styles.kindRule} aria-hidden="true" />
      {KIND_LABEL[kind]}
    </span>
  );
}

/** A date the reader can read, from the ISO stamp the research recorded. */
export function dateLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "8 min", "2 h 14 min", "3 d" — a lag a reader can hold in their head. */
export function durationLabel(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${(seconds / 86400).toFixed(1)} d`;
}

/** p-values as the research prints them, never rounded up to "significant". */
export function pValueLabel(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  if (value < 0.001) return `p = ${value.toExponential(1)}`;
  return `p = ${value.toFixed(3)}`;
}
