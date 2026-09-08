/**
 * VA-48.6 — where a retired duplicate's URL goes.
 *
 * The model is one event → one canonical record. When VA-48.4's sweep finds
 * two records covering the same event, the weaker one is archived through the
 * ops path (`archive_publication`, a reversible transition to `archived`) and
 * the stronger one keeps publishing. Archiving alone answers half the problem:
 * the record leaves the public corpus, so search stops offering it — but its
 * URL, which may sit in someone's history, in a shared link or in a search
 * index, starts returning 404.
 *
 * A 404 is the wrong answer there. The reader asked for a story that exists;
 * it just lives at the other address now. So a retired publicId resolves to
 * the canonical one with a permanent redirect, and the repository's standing
 * rule — historical URLs are preserved — is kept in the only way that survives
 * a merge.
 *
 * **This map is deliberately empty until a merge is actually performed.** The
 * mechanism ships before the data: an entry may only be added when the
 * corresponding record has really been archived, or the redirect would shadow
 * a live record. The article page consults this map *after* a lookup has
 * already failed, so even a stale entry can never hide a publication that is
 * still published — the record wins, the map is only a rescue.
 *
 * Adding an entry, in order:
 *   1. Archive the duplicate via the ops path, never by editing the database.
 *   2. Add `[retired publicId]: canonical publicId` below, with the sweep row
 *      that justified it.
 *   3. Confirm the retired URL now 308s to the canonical article.
 */

/** Retired publicId → the canonical publicId that superseded it. */
export const SUPERSEDED_PUBLICATIONS: Readonly<Record<string, string>> = Object.freeze({
  /* Populated per merge. See VA-48.4's sweep table in
     docs/audits/2026-09-07-production-ux-integrity-implementation.md for the
     confirmed pairs awaiting the merge, and the "flagged but NOT duplicates"
     note directly beneath it for the two pairs that must never appear here. */
});

/**
 * The canonical address for a retired publicId, or null if this id was never
 * retired.
 *
 * A one-hop lookup on purpose. If a canonical record is itself later retired,
 * every entry pointing at it must be repointed at the new canonical id rather
 * than left to chain — a chain is how a redirect loop is built by accident,
 * and how a reader ends up two hops from what they clicked.
 */
export function supersededBy(publicId: string): string | null {
  const target = SUPERSEDED_PUBLICATIONS[publicId];
  if (!target || target === publicId) return null;
  return target;
}
