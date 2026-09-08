import type { CaseEntity } from '@/lib/content/fake-resistance-cases';
import type { FlowKind } from '@/lib/content/investigation-model';
import styles from './investigation.module.css';

/**
 * The small text labels the investigation surfaces share. Text, never colour
 * alone: an identity grade or a line kind must survive a monochrome print and
 * a screen reader.
 */

export type InvestigationSection = { id: string; label: string };

/**
 * The reading order of a case — "follow the thread". A reader can jump
 * between these, but scrolled top to bottom they tell one story: the finding,
 * the people, the ideas, the movement, the time, the evidence, what cuts
 * against it, what is unknown, and where it all came from.
 *
 * Declared here rather than in `InvestigationSectionNav.tsx` or the page: this
 * module carries no `'use client'` directive, so the page (a server
 * component) can call `caseSections()` directly. Next's RSC compiler treats
 * every named export of a `'use client'` module as a client reference, even a
 * plain, side-effect-free function — that first attempt failed at runtime
 * with "Attempted to call caseSections() from the server but caseSections is
 * on the client."
 */
export const BASE_CASE_SECTIONS: InvestigationSection[] = [
  { id: 'finding', label: 'Finding' },
  { id: 'who', label: 'Who is involved' },
  { id: 'narratives', label: 'Narratives' },
  { id: 'flows', label: 'How material moved' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'counter', label: 'What cuts against it' },
  { id: 'unknowns', label: 'Unknowns and limits' },
  { id: 'sources', label: 'Sources' },
];

/**
 * The section list for one case, "What changed" included when the case
 * actually renders that block.
 *
 * VA-54.3: the page's own `SectionBlock id="what-changed"` is conditional on
 * `record.overturned.length > 0` — it renders only for a case whose newer
 * data withdrew an earlier reading (Hinkle Machine is one). The nine-section
 * list above is static and never carried a tenth entry for it, so a reader
 * of an overturned case had a working `#what-changed` link inside
 * `CaseStoryHeader`'s update marker that the local table of contents itself
 * never offered — a real section with no stable, discoverable entry point in
 * the one navigation surface built for exactly that. The ≥1220px contents
 * rail (`SectionToc`) never had this gap: it reads live `h2` headings from
 * the DOM, so it always picked up "What changed" on its own. This strip
 * built its list by hand instead, and that is what had drifted.
 *
 * Inserted directly after "Finding", matching the page's own render order:
 * the block sits between the Finding `SectionBlock` and "Who is involved".
 */
export function caseSections(hasOverturned: boolean): InvestigationSection[] {
  if (!hasOverturned) return BASE_CASE_SECTIONS;
  const findingIndex = BASE_CASE_SECTIONS.findIndex((section) => section.id === 'finding');
  const insertAt = findingIndex + 1;
  return [
    ...BASE_CASE_SECTIONS.slice(0, insertAt),
    { id: 'what-changed', label: 'What changed' },
    ...BASE_CASE_SECTIONS.slice(insertAt),
  ];
}

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
