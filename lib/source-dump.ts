/**
 * Strip a pipeline-style source dump out of article prose — VA-56.
 *
 * Some published bodies end with the raw shape the composer used while
 * assembling the record:
 *
 *     Sources:
 *     - https://www.reuters.com/…
 *     - https://apnews.com/…
 *
 * The reader already has that information, better presented, in the structured
 * "Public sources" stack directly beneath the prose. Printing it twice makes an
 * edited article look like a machine's scratch file, which is the opposite of
 * what the page is for.
 *
 * ## The rule this will not break
 *
 * A page may never print a citation and then deny having sources.
 * `publicSourceState` reads the body for absolute URLs precisely to catch that:
 * with an empty stack and a URL in the text it reports `pending` rather than
 * `unsourced`. So stripping is allowed **only when the information survives**:
 *
 * 1. the structured stack is non-empty, and
 * 2. every address in the block being removed is already in that stack.
 *
 * If either fails, the body is returned untouched and the reader keeps the
 * duplicated block — visible clutter is a smaller harm than a silently
 * disappeared source. That is also the fallback when the block cannot be parsed
 * confidently at all.
 *
 * Inline citations are deliberately out of scope. A URL inside a sentence, or a
 * markdown link a writer put in the prose on purpose, is content; only a
 * trailing block that is *nothing but* a heading and addresses is removed.
 */

/** `https://www.reuters.com/a/b?x=1#f` and `reuters.com/a/b` compare equal. */
function canonicalAddress(raw: string): string {
  let value = raw.trim().replace(/[).,;\]]+$/, "");
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    value = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    return value.split(/[?#]/)[0]!.replace(/\/+$/, "").toLowerCase();
  }
}

const HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(sources?|references?|links?)\s*:?\s*(?:\*\*)?\s*$/i;
const URL_IN_LINE = /https?:\/\/\S+/g;

/**
 * Remove a trailing source block when the stack already carries every address
 * in it. Returns the body unchanged in every uncertain case.
 *
 * The heading is found first and the block validated afterwards, rather than
 * the other way round. Composers label their entries — `- Israel Innovation
 * Authority, September 6, 2026: https://…` — so a scan that only recognises
 * bare addresses stops at the first labelled line and finds nothing. What makes
 * a line part of the block is that it *carries* an address, not that it is one.
 */
export function stripSourceDump(
  body: string,
  stackUrls: readonly string[],
  options: { allowEmpty?: boolean } = {},
): string {
  if (!body.trim() || stackUrls.length === 0) return body;

  const stack = new Set(stackUrls.map(canonicalAddress));
  const lines = body.split(/\r?\n/);

  // The last heading in the text; a "Sources:" mid-article is not a dump.
  let headingAt = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (HEADING.test(lines[i]!)) { headingAt = i; break; }
  }
  if (headingAt === -1) return body;

  const block = lines.slice(headingAt + 1).filter((line) => line.trim());
  if (!block.length) return body;

  /* Every line after the heading must carry an address and nothing but
     bookkeeping around it, and every address must already be in the stack.
     One prose line, or one address the stack lacks, and the block stays. */
  for (const line of block) {
    const urls = line.match(URL_IN_LINE) ?? [];
    if (!urls.length) return body;
    if (!urls.every((url) => stack.has(canonicalAddress(url)))) return body;
  }

  const kept = lines.slice(0, headingAt).join("\n").replace(/\s+$/, "");
  /* A whole *passage* may legitimately be nothing but the dump, and the caller
     drops it. A whole *body* may not: emptying the article would be worse than
     the clutter, so it stays whole unless the caller opts in. */
  if (kept.trim()) return kept;
  return options.allowEmpty ? "" : body;
}
