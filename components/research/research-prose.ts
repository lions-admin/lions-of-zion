/**
 * Block structure for research prose that arrived as flat paragraphs.
 *
 * `components/content/ResearchText` handles the *inline* markup the packets are
 * written in — `**bold**`, `*italic*`, `` `@handle` `` — and deliberately is
 * not a markdown parser. That left a gap nothing covered: the packets also
 * carry **block** structure, and the importer flattened it. A numbered list
 * arrives as `"…a double refutation: 1. Against the … 2. Against the …"` inside
 * one string, and a bulleted list as `"…tight coupling: - Jackson Hinkle … -
 * Iranian state media …"`. Rendered through `<p>`, the markers land on the page
 * as literal `1.` and `- ` in running text, which is what the network page was
 * doing with three of its four summary paragraphs.
 *
 * This module recovers that structure so the page can render lists as lists. It
 * is still not a markdown parser — it recognises exactly the two shapes the
 * imported text contains, and a horizontal rule, and treats everything else as
 * a paragraph.
 *
 * Nothing here loses text. Every character of a parsed paragraph reappears in
 * the blocks it produces, except the list markers themselves and a rule.
 */

export type ProseBlock =
  | { kind: 'para'; text: string }
  | { kind: 'list'; ordered: boolean; lead: string | null; items: string[] };

/**
 * A paragraph that is only a horizontal rule.
 *
 * The network packet's executive summary ends with a bare `"---"`, and so does
 * the tail of its second finding. It is a separator from the document the
 * packet was cut out of, not content, and it rendered as a stray `---` on the
 * page.
 */
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** A trailing rule glued onto the end of a real paragraph. */
const TRAILING_RULE = /\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * Marker scanners.
 *
 * Both require whitespace (or the string start) before the marker and after
 * it, which is what keeps them off ordinary prose: `01-hinkle-machine` and
 * `2026-09-06` carry no space around the hyphen, and this desk's prose uses
 * spaced em dashes (`—`) rather than spaced hyphens for parenthetical breaks,
 * so `—` is deliberately *not* a bullet marker here.
 */
const ORDERED_MARKER = /(?:^|\s)(\d{1,2})\.\s+/g;
const BULLET_MARKER = /(?:^|\s)[-*]\s+/g;

/**
 * The shortest run of text that counts as a list item.
 *
 * Two markers and a few words each is the shape of a flattened list. One
 * marker is a sentence that happens to contain a number and a full stop, and
 * a two-character "item" is punctuation the scanner misread.
 */
const MIN_ITEM_LENGTH = 20;
const MIN_ITEMS = 2;

type Split = { lead: string; items: string[] };

/** Cut a string at every marker position, returning the text before the first. */
function splitAtMarkers(text: string, pattern: RegExp, validate?: (captures: string[]) => boolean): Split | null {
  pattern.lastIndex = 0;
  const cuts: { start: number; end: number; capture: string }[] = [];
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    cuts.push({ start: match.index, end: match.index + match[0].length, capture: match[1] ?? '' });
  }
  if (cuts.length < MIN_ITEMS) return null;
  if (validate && !validate(cuts.map((cut) => cut.capture))) return null;

  const items: string[] = [];
  for (const [i, cut] of cuts.entries()) {
    const end = cuts[i + 1]?.start ?? text.length;
    items.push(text.slice(cut.end, end).trim());
  }
  if (items.some((item) => item.length < MIN_ITEM_LENGTH)) return null;

  return { lead: text.slice(0, cuts[0].start).trim(), items };
}

/**
 * Ordered markers must count from one, without gaps.
 *
 * This is the guard that keeps a year out of the list: "…the computed rebuild
 * of 6 September 2026. Each row is one change…" offers `2026.` as a candidate
 * marker, and a run that does not start at `1` is not an enumeration.
 */
function countsFromOne(captures: string[]): boolean {
  return captures.every((capture, i) => Number(capture) === i + 1);
}

/** One paragraph string as the blocks it actually contains. */
export function parseResearchParagraph(paragraph: string): ProseBlock[] {
  const text = paragraph.trim();
  if (text === '' || RULE.test(text)) return [];

  const body = text.replace(TRAILING_RULE, '').trim();
  if (body === '') return [];

  const ordered = splitAtMarkers(body, ORDERED_MARKER, countsFromOne);
  const split = ordered ?? splitAtMarkers(body, BULLET_MARKER);
  if (!split) return [{ kind: 'para', text: body }];

  return [
    {
      kind: 'list',
      ordered: ordered !== null,
      lead: split.lead === '' ? null : split.lead,
      items: split.items,
    },
  ];
}

/** A run of paragraph strings as the blocks they actually contain. */
export function parseResearchProse(paragraphs: readonly string[]): ProseBlock[] {
  return paragraphs.flatMap(parseResearchParagraph);
}

/**
 * The claim, separated from the numbers that corroborate it.
 *
 * Every point in a case's bottom line is written the same way: the finding as
 * a bold opening sentence, then the measurements that establish it, all in one
 * paragraph. On `hinkle-machine` that puts `**The "70%" figure is dead; the
 * production-cell coupling is not.**` immediately in front of "287 of Hinkle's
 * 790 non-retweet posts (36.3%) … median lag 512 s ≈ 8.5 min; p25 95 s; p75
 * 1261 s; max 23.7 h" — the finding is first, and then instantly drowned.
 *
 * Splitting them lets a page set the claim as a claim and the numbers as
 * numbers. The split is only offered when there is enough behind the claim to
 * be worth separating; a short point stays one paragraph rather than becoming
 * a heading with a fragment under it.
 */
const LEAD_EMPHASIS = /^\*\*([^*]+)\*\*\s*/;
const MIN_CORROBORATION_LENGTH = 80;

export function splitClaimFromEvidence(text: string): { claim: string | null; evidence: string } {
  const trimmed = text.trim();
  const match = LEAD_EMPHASIS.exec(trimmed);
  if (!match) return { claim: null, evidence: trimmed };

  const evidence = trimmed.slice(match[0].length).trim();
  if (evidence.length < MIN_CORROBORATION_LENGTH) return { claim: null, evidence: trimmed };

  return { claim: match[1].trim(), evidence };
}

/**
 * `Against the "monolithic conspiracy" model: …` read as a refutation.
 *
 * The network packet writes its central finding as two refusals, each naming
 * the model it kills in quotation marks. Deriving the plain-language label
 * from that name rather than writing one by hand keeps the header honest if
 * the research changes what it refutes: nothing here invents a claim, it only
 * turns the packet's own phrasing around.
 *
 * ## What a packet that stops using this phrasing gets
 *
 * A null `model` and the sentence itself as the `statement`. A caller must
 * render the label only when `model` is set, so the degraded case is a finding
 * stated in the research's own words with no label above it — never a blank
 * label, and never a heading with nothing under it.
 *
 * The `statement` is taken from the *parsed* finding rather than the raw
 * string, because the raw string is exactly where a flattened list hides. A
 * finding written as `"…: 1. … 2. …"` would otherwise fall through to the
 * unparsed text and put `1.` back on the page — reintroducing, in the fallback
 * path, the bug this module exists to fix. When the finding parses to a list,
 * its lead is the statement, and its first item if it has no lead.
 */
const REFUTATION = /^Against the ["“”']([^"“”']+)["“”']\s+model:\s*/;
const VOWEL = /^[aeiou]/i;

export function parseRefutation(finding: string): { model: string | null; statement: string } {
  const [first] = parseResearchParagraph(finding);
  const text =
    first === undefined
      ? ''
      : first.kind === 'para'
        ? first.text
        : (first.lead ?? first.items[0] ?? '');

  const match = REFUTATION.exec(text);
  if (!match) return { model: null, statement: text };
  return { model: match[1], statement: text.slice(match[0].length).trim() };
}

/** "monolithic conspiracy" → "Not a monolithic conspiracy". */
export function refutationLabel(model: string): string {
  return `Not ${VOWEL.test(model) ? 'an' : 'a'} ${model}`;
}
