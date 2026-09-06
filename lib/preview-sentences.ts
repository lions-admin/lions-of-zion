/**
 * A phone's preview of a summary ends on a full stop, not on whatever word the
 * last line happened to run out under.
 *
 * `previewSentences` divides a text into the sentences a preview shows and the
 * remainder it may hide. The first sentence always shows; each sentence after
 * it is added while the shown text stays within `budget` characters. The words
 * are the text as written — nothing is rewritten or summarised — and a line
 * clamp on the paragraph remains the backstop for a single sentence longer
 * than the budget. Pure and deterministic, so the server and the client agree
 * on the split.
 */

/* A full stop after one of these is not the end of a sentence. A missing entry
   costs a longer preview, which the line clamp then bounds; a false split
   would end the preview on "Maj.-Gen." instead. */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "gen", "maj", "lt", "col", "sgt", "cpl",
  "capt", "cmdr", "adm", "brig", "ret", "st", "mt", "no", "vs", "etc", "approx",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov",
  "dec", "inc", "ltd", "co", "corp", "rep", "sen", "gov", "pres", "hon", "rev",
  "fig", "al",
]);

/* Sentence-ending punctuation, any closing quote or bracket, whitespace, then
   something a sentence begins with. */
const BOUNDARY = /[.!?…]+["”’)\]]*\s+(?=["“‘(\[]?[A-Z0-9])/g;

function endsInAbbreviation(sentence: string): boolean {
  const token = sentence.replace(/[.!?…]+["”’)\]]*$/, "").match(/(\S+)$/)?.[1];
  if (!token) return false;
  const bare = token.replace(/^["“‘(\[]+/, "");
  if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(bare)) return true; // U.S., e.g., i.e.
  const word = bare.match(/([A-Za-z]+)[^A-Za-z]*$/)?.[1];
  if (!word) return false;
  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(BOUNDARY)) {
    const end = match.index + match[0].length;
    const candidate = text.slice(start, end).trim();
    if (endsInAbbreviation(candidate)) continue;
    sentences.push(candidate);
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

export function previewSentences(
  text: string,
  budget: number,
): { shown: string; hidden: string } {
  const sentences = splitSentences(text.trim());
  if (sentences.length === 0) return { shown: "", hidden: "" };
  let shown = sentences[0];
  let next = 1;
  while (
    next < sentences.length &&
    shown.length + 1 + sentences[next].length <= budget
  ) {
    shown = `${shown} ${sentences[next]}`;
    next += 1;
  }
  return { shown, hidden: sentences.slice(next).join(" ") };
}
