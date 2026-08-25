/**
 * Adapters between the brief's private authoring vocabulary and the shared
 * content library.
 *
 * These lived inside `GeopoliticalBrief.tsx` while the brief was their only
 * consumer. The home page's front-page band now merges brief developments
 * into a cross-section milestone list, so they are shared rather than
 * duplicated — the mapping decisions below are judgment calls that must not
 * be made twice and differently.
 */
import type { AssessmentValue } from '@/server/contracts/enums';
import type { Source, TimelineEntry } from '@/components/content';
import {
  geopoliticalReferenceBrief as brief,
  type BriefSource,
  type BriefStatus,
} from './geopolitical-reference';

/**
 * `BriefStatus` (the brief's own authoring vocabulary) has no 1:1 mapping
 * onto the real 9-value `AssessmentValue` (`server/contracts/enums.ts`) —
 * that enum is the shared source of truth for both the Zod schema and the
 * Postgres enum type, so it is not the thing to extend. Mapped here to the
 * closest real meaning. `Attributed` and `Corrected` are the genuinely
 * imprecise cases:
 *   - `Attributed` rests on one named official's public statement, not
 *     independently cross-checked — closer to "not yet independently
 *     assessed" than any other real value, though it understates that this
 *     is already a real, published record.
 *   - `Corrected` describes a workflow event (this item was wrong and has
 *     been fixed), not a verdict. The live status after a correction is
 *     whatever the corrected verdict now is; the correction itself belongs
 *     in `CorrectionHistory`, not here — `verified` is the reasonable
 *     default for "corrected and now considered right."
 */
export const STATUS_TO_ASSESSMENT: Record<BriefStatus, AssessmentValue> = {
  Confirmed: 'verified',
  Attributed: 'unverified',
  Unverified: 'unverified',
  Disputed: 'contested',
  Corrected: 'verified',
};

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** Brief dates are authored as "07 Jan 2026" — converts to an ISO date for
 *  the <time dateTime> attribute Timeline entries expect. */
export function toIsoDate(display: string): string {
  const [day, month, year] = display.split(' ');
  return `${year}-${MONTHS[month] ?? '01'}-${(day ?? '01').padStart(2, '0')}`;
}

/** `publishedAt` is authored as "24 Aug 2026 · 14:00 IDT" — only the date
 *  portion is needed for staleness, so the time/zone half is dropped. */
export function toIsoDateOnly(publishedAt: string): string {
  return toIsoDate(publishedAt.split('·')[0].trim());
}

/** `BriefSource` (id, publisher, title, published, type, url) doesn't line
 *  up exactly with the shared `Source` shape — `published` has no exact
 *  home (`accessedAt` means "when we last checked it", not "when it was
 *  published"), but it's the only slot for a date and keeps the
 *  information visible rather than silently dropping it. */
export function toSource(source: BriefSource): Source {
  return {
    id: source.id,
    label: source.title,
    kind: `${source.publisher} · ${source.type}`,
    url: source.url,
    accessedAt: source.published,
  };
}

/**
 * The brief's three developments as shared timeline entries.
 *
 * Ids are prefixed `brief-` rather than the brief's own `development-N`:
 * once these entries are merged with War Update's and October 7's in one
 * list, an index-derived id is no longer unique across the merge.
 */
export function briefDevelopmentEntries(): TimelineEntry[] {
  const sourceMap = new Map(brief.sources.map((source) => [source.id, source]));
  return brief.developments.map((development, index) => ({
    id: `brief-development-${index}`,
    datetime: toIsoDate(development.date),
    dateLabel: development.date,
    title: development.title,
    body: development.body,
    assessment: STATUS_TO_ASSESSMENT[development.status],
    sources: development.sourceIds
      .map((sourceId) => sourceMap.get(sourceId))
      .filter((source): source is BriefSource => Boolean(source))
      .map(toSource),
  }));
}
