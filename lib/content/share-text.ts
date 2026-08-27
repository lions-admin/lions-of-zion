/**
 * The X-post version of a record — pure text shaping, no filesystem, no DOM.
 *
 * Every archive record offers a "share on X" affordance (owner decision,
 * `.ai/DECISIONS.md` 2026-08-27). The prefilled post is a quote from the
 * record plus an attribution line, and X appends the record's URL itself.
 * The rules this module enforces:
 *
 *  - **Plan for the 280-character account.** Premium accounts post longer,
 *    but a share that fits 280 works for everyone and there is no way to
 *    know who is sharing.
 *  - **A link always costs 23**, regardless of its length — X wraps every
 *    URL in t.co.
 *  - **Never cut mid-word or mid-sentence.** A blind `substring` over a
 *    survivor's testimony is exactly what must not happen here. The quote
 *    ends at a sentence boundary; if no whole sentence fits, it falls back
 *    to a clause boundary, then a word boundary, each marked with an
 *    ellipsis — never a cut inside a word.
 *
 * X does not count characters — it counts *weighted* code points
 * (twitter-text v3): most Latin, Cyrillic, Hebrew and Arabic code points
 * weigh 1, everything else (CJK among it) weighs 2. 661 of the archive's
 * 1,175 versions are not English, so the budget math uses that weighting
 * rather than `String.length` — a 230-"character" Japanese quote is really
 * a 460-weight post and would not fit.
 */

export const X_POST_LIMIT = 280;

/** Every URL costs this much on X, courtesy of t.co — even a short one. */
export const TCO_URL_WEIGHT = 23;

export const SHARE_ATTRIBUTION = '— Lions of Zion archive';

/**
 * The twitter-text v3 weight ranges: code points inside them weigh 1,
 * everything else weighs 2. (The config expresses these as weight 100/200
 * against a scale of 100; this is the same thing in small integers.)
 */
const WEIGHT_ONE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x10ff], // Latin, Greek, Cyrillic, Hebrew, Arabic, and more
  [0x2000, 0x200d], // general punctuation (spaces, ZWJ)
  [0x2010, 0x201f], // hyphens, dashes, curly quotes
  [0x2032, 0x2037], // primes
];

/** A string's length as X counts it. Iterates code points, not UTF-16 units. */
export function xWeightedLength(text: string): number {
  let total = 0;
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    total += WEIGHT_ONE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi) ? 1 : 2;
  }
  return total;
}

/** One space, one line: quotes read as flowing text, not as pasted layout. */
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Sentence terminators across the archive's eight languages: Latin plus the
 * CJK full stop and full-width marks the Japanese versions use.
 */
const SENTENCE = /[^.!?…。！？]+(?:[.!?…。！？]+[”’"')\]»]*)?/gu;

/** Clause separators — the fallback boundary when no whole sentence fits. */
const CLAUSE = /[,;:、，；：؛،—–]/gu;

/** Word boundary — the last resort, so a cut never lands inside a word. */
const WORD = /\s+/gu;

const ELLIPSIS = '…';

/**
 * The end offsets of every boundary `pattern` finds in `text`, plus the end
 * of the text itself.
 *
 * Offsets rather than split-and-rejoin: rejoining pieces with a chosen
 * separator re-punctuates the quote. Latin text survives that, but Japanese
 * does not — its sentences run together with no spaces, and rejoining them
 * with " " inserts spacing the witness did not write. Slicing the original
 * string can only ever return the original string's own characters.
 */
function boundaries(text: string, pattern: RegExp): number[] {
  const ends: number[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(re)) {
    const end = match.index + match[0].length;
    if (end > 0 && end < text.length) ends.push(end);
  }
  ends.push(text.length);
  return ends;
}

/** The longest prefix of `text` ending on one of `ends` that fits `budget`. */
function longestFitting(text: string, ends: number[], budget: number): string {
  let best = '';
  for (const end of ends) {
    const candidate = text.slice(0, end).trim();
    if (!candidate) continue;
    if (xWeightedLength(candidate) > budget) break;
    best = candidate;
  }
  return best;
}

/**
 * The longest run of *complete* sentences from the start of `text` that fits
 * `budget` (in X weight). Falls back to clause, then word boundaries, each
 * closed with an ellipsis; returns '' only when not even one word fits.
 */
export function buildShareQuote(text: string, budget: number): string {
  const clean = collapse(text);
  if (!clean || budget <= 0) return '';
  if (xWeightedLength(clean) <= budget) return clean;

  const bySentence = longestFitting(clean, boundaries(clean, SENTENCE), budget);
  if (bySentence) return bySentence;

  // Not even the first sentence fits, so the quote must end mid-sentence and
  // say so. The ellipsis costs weight of its own, so it comes out of the
  // budget rather than being appended past it.
  const shortened = budget - xWeightedLength(ELLIPSIS);
  if (shortened <= 0) return '';

  // A clause boundary first — it is the closest thing to a whole thought.
  const byClause = longestFitting(clean, boundaries(clean, CLAUSE), shortened);
  if (byClause) return `${byClause.replace(/[\s,;:、，；：؛،—–]+$/u, '')}${ELLIPSIS}`;

  // Last resort: whole words. Never a cut inside one.
  const byWord = longestFitting(clean, boundaries(clean, WORD), shortened);
  return byWord ? `${byWord}${ELLIPSIS}` : '';
}

/**
 * The source site's nav, which the crawler captured as the opening paragraph
 * of 367 of the 505 october7 versions — "October 7 \n> Gaza Border
 * Communities \n> Testimony of Noam G".
 *
 * `ArchiveBlocks.dropLeadingChrome` drops it before a reader sees it and the
 * importer drops it before it reaches an index row; without this a *shared*
 * post would have opened with it, which is the one copy of a record that
 * travels somewhere nobody can correct it. Matched on shape rather than on a
 * leading "October 7" — 37 versions open with a localised root — and only at
 * position zero, where the crawler put it.
 */
export function stripSourceBreadcrumb(text: string | null | undefined): string {
  const paragraphs = String(text ?? '').split(/\n\s*\n/);
  const first = paragraphs[0] ?? '';
  return paragraphs.length > 1 && first.includes('\n>') && first.length < 200
    ? paragraphs.slice(1).join('\n\n')
    : String(text ?? '');
}

export type ShareTextSource = {
  /** The record's title — the fallback when it has no usable body text. */
  title: string;
  /** The record's own words: `full_text`, or `excerpt`, whichever exists. */
  text?: string | null;
};

/**
 * The prefilled text for an X intent: a boundary-respecting quote and the
 * attribution line. The URL is *not* included — it travels in the intent's
 * own `url` parameter — but its fixed t.co cost is budgeted for.
 */
export function buildXShareText({ title, text }: ShareTextSource): string {
  // 280, minus the t.co link, minus the space X puts before it.
  const total = X_POST_LIMIT - TCO_URL_WEIGHT - 1;
  const budget = total - xWeightedLength(SHARE_ATTRIBUTION) - 1; // and "\n"
  const body = stripSourceBreadcrumb(text).trim();
  const quote = buildShareQuote(body || title, budget) || collapse(title);
  return `${quote}\n${SHARE_ATTRIBUTION}`;
}

/** An X post-intent URL with the text prefilled — X fills the composer. */
export function xIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://x.com/intent/post?${params.toString()}`;
}

/** Facebook takes only the link; the text comes from the page's OG tags. */
export function facebookShareUrl(url: string): string {
  const params = new URLSearchParams({ u: url });
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}
