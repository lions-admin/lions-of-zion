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
 * **An entry may only be added once the record it retires has really been
 * archived**, or the redirect would shadow a live record. The map shipped empty
 * on 2026-09-08 and was filled the same day, once the archives had actually
 * run. The article page consults it *after* a lookup has already failed, so
 * even a stale entry can never hide a publication that is still published —
 * the record wins, the map is only a rescue.
 *
 * Adding an entry, in order:
 *   1. Archive the duplicate via the ops path, never by editing the database.
 *   2. Add `[retired publicId]: canonical publicId` below, with the sweep row
 *      that justified it.
 *   3. Confirm the retired URL now 308s to the canonical article.
 */

/**
 * Retired publicId → the canonical publicId that superseded it.
 *
 * Every pair below was archived on 2026-09-08 by
 * `scripts/ops/retire-superseded.ts`, through `publications.transition()` —
 * the same service call the ops route makes — so each has a version row, an
 * audit row and its outbox emissions.
 *
 * **None of these targets was inferred.** Each retired record names its own
 * successor in its published summary ("Historical report: … For the current
 * verified account and later developments, read: …"), or says in its own title
 * what it is. The single exception is the September 3 pair at the bottom, which
 * declared nothing and was therefore held back for a human decision. That
 * distinction mattered: a scoring heuristic written
 * before this data was read would have archived the civil-defence *correction*
 * and kept the record that calls itself "Corrected duplicate", because the
 * duplicate is longer and better-sourced than the correction.
 */
export const SUPERSEDED_PUBLICATIONS: Readonly<Record<string, string>> = Object.freeze({
  /* Four records collapsed into one Israel–Lebanon escalation account; each
     names 0jqg3 in its own summary. `…v8bvd` is the record VA-46.6 examined
     and found coherent — it has been superseded since that step closed. */
  "3-said-killed-in-idf-strikes-in-lebanon-after-he-v8bvd": "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3",
  "ali-al-taher-remains-an-active-israel-hezbollah--hkoun": "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3",
  "ali-al-taher-ridge-remains-a-verified-israel-hez-mwq1v": "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3",
  "hezbollah-drones-and-israeli-strikes-drive-a-new-ztjo5": "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3",

  /* "Earlier report: … duplicates the House-vote event covered in the linked
     retained record." */
  "us-house-passes-bill-targeting-university-boycot-skxk2": "us-house-passes-bill-targeting-university-boycot-lhl1q",

  /* "Historical report: Malek Ghazi's initial return through the …" */
  "lebanese-detainee-returned-through-icrc-channel-bblkt": "lebanese-detainee-returned-through-icrc-channel-68if2",

  /* "Earlier report: … It is not an additional independent confirmation of a
     strike." */
  "iran-says-it-struck-a-u-s-unmanned-vessel-washin-anmgp": "iran-says-it-struck-an-unmanned-u-s-vessel-centc-8m6cq",

  /* "Historical report: Netanyahu's reported West Bank outpost-re…" */
  "netanyahu-orders-unauthorized-west-bank-outposts-kb1l1": "netanyahu-orders-removal-of-unauthorized-west-ba-ugzzx",

  /* Titled "Corrected duplicate: unsupported shelter-data expansion claim",
     against the correction it duplicates. */
  "israel-s-open-civil-defence-data-initiative-cont-mv6ck": "israel-s-open-civil-defence-data-initiative-cont-fgpr4",

  /* VA-57.1, owner decision 2026-09-08: redundant because the surviving record
     already carries the 78 g/g against ~100× correction itself. */
  "ben-gurion-university-aerogel-can-absorb-100-tim-cb3o1": "ben-gurion-university-team-develops-aerogel-that-0y2we",

  /* The one entry here that no record declared for itself. Two rewrites of the
     same September 3 edition, identical section for section; the kept one was
     published 2h38m later and attributes better. Owner decision 2026-09-08,
     taken after both bodies were read in full — and **not a strict
     improvement**: the retired record carried a defence-cooperation thread the
     rewrite dropped. Recorded because a later reader comparing the two will
     notice, and should find the loss acknowledged rather than discover it. */
  "israel-security-and-diplomacy-brief-september-3--xgjvx": "israel-security-diplomacy-and-anti-boycott-brief-4xspk",
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
