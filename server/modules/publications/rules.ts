/**
 * Pure, database-free publication policy. Unit-tested directly, the way
 * `assessments/rules.ts` is.
 *
 * ## Why this file exists — VA-46
 *
 * A developing story reached Production where the headline described one
 * version of events, the summary described the updated version, the body still
 * described the previous one, and the correction log claimed the story had been
 * updated. The Lebanon record.
 *
 * The transaction was never the problem. `applyEditorial` already writes the
 * row, the version, the correction entry and the reindex emit inside one
 * `recordVersion` transaction, so nothing was half-committed. The problem is
 * **semantic**: `updatePublicationSchema` makes every content field optional
 * and only `changeSummary` required, and the service spreads whatever subset
 * arrived onto the stored row. So an operation may legally carry a change
 * summary and nothing else — writing no content at all while appending a
 * correction-log row that says it did.
 *
 * Two rules close that, and both are about **coherence**, not quality. This is
 * deliberate: the launch-period ruling (`docs/editorial-dna.md` §11,
 * 2026-09-06) says minimum enforcement only, and no editorial gate may be added
 * back uninvited. Neither rule here judges whether an update is *good*. They
 * only refuse an update that is internally inconsistent with its own claim.
 *
 * 1. **A claimed change must be an applied change.** An operation that leaves
 *    every field as it already stands is refused, because the correction log it
 *    would write is a statement about the world that did not happen.
 * 2. **The reader-visible trio moves together.** Headline, summary and body are
 *    what a reader meets. A developing-story update that revises the headline or
 *    the deck must restate the body in the same operation, so the three cannot
 *    drift into describing three different versions of the same event.
 *
 * Rule 2 applies to the **machine editorial path only**. A human fixing a typo
 * in a headline through the admin console is not the failure mode this exists
 * for, and forcing them to resubmit a 200 kB body would be a gate rather than a
 * guard. `publicationService.update` therefore carries rule 1 alone.
 */

/** What a reader meets: the three fields that must describe one version. */
export interface ContentTrio {
  title: string;
  summary: string | null;
  body: string;
}

/** The subset of an update operation that touches the trio. */
export interface ContentPatch {
  title?: string | undefined;
  summary?: string | undefined;
  body?: string | undefined;
}

const TRIO_KEYS = ["title", "summary", "body"] as const;

/** `null` and `""` are the same absence for a summary; the column is nullable
 *  but the contract trims, so a blank arrives as `""` and the stored value as
 *  `null`. Comparing them raw would report a change that is not one. */
function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "") === (right ?? "");
}

/**
 * Which of the trio this patch actually changes — present, and different from
 * what is stored. A resent identical field is not a change.
 */
export function changedTrioFields(before: ContentTrio, patch: ContentPatch): string[] {
  return TRIO_KEYS.filter((key) => patch[key] !== undefined && !sameText(patch[key], before[key]));
}

/**
 * Whether this operation applies anything at all beyond the trio.
 *
 * `undefined` means "not sent" for every field in `updatePublicationSchema`, so
 * an explicit `null` (clearing `editorialTopic`, say) counts as a change and a
 * missing key does not. `changeSummary` is excluded by the caller: it is the
 * claim, never the application.
 */
export function appliesNonContentFields(fields: Record<string, unknown>): boolean {
  return Object.entries(fields).some(([key, value]) => (
    !(TRIO_KEYS as readonly string[]).includes(key) && value !== undefined
  ));
}

/**
 * The coherence check for a machine editorial update.
 *
 * Returns the reason it is incoherent, or `null` when it is fine. The caller
 * turns a reason into a `VALIDATION_ERROR`, which rolls the operation back
 * before anything becomes public.
 */
export function incoherentEditorialUpdate(
  before: ContentTrio,
  fields: ContentPatch & Record<string, unknown>,
): string | null {
  const changed = changedTrioFields(before, fields);

  if (!changed.length && !appliesNonContentFields(fields)) {
    return "This update applies no change. Its change summary would record a revision that did not happen; send the fields the update actually revises.";
  }

  const revisesReaderFacing = changed.includes("title") || changed.includes("summary");
  if (revisesReaderFacing && fields.body === undefined) {
    return "A developing-story update that revises the headline or the summary must restate the body in the same operation, so the three cannot describe different versions of the same event.";
  }

  return null;
}

/**
 * The narrower check for the human path: refuse an edit that applies nothing.
 *
 * The trio rule is deliberately absent here — see the file header.
 */
export function emptyHumanUpdate(
  before: ContentTrio,
  fields: ContentPatch & Record<string, unknown>,
): boolean {
  return !changedTrioFields(before, fields).length && !appliesNonContentFields(fields);
}
