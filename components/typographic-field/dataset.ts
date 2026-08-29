import matrixData from "@/public/matrix/matrix-fragments.en.json";

type SemanticLevel = 0 | 1 | 2;
type MatrixFragment = {
  category: string;
  text: string;
};

const NOISE_CATEGORIES = new Set([
  "hostile_narrative",
  "fake_headline",
  "hashtag",
  "public_actor",
]);
const SIGNAL_CATEGORIES = new Set(["fact_check"]);

const FRAGMENTS = matrixData.fragments as MatrixFragment[];
const LEVEL_BUCKETS: Record<SemanticLevel, string[]> = { 0: [], 1: [], 2: [] };

for (const fragment of FRAGMENTS) {
  const level: SemanticLevel = SIGNAL_CATEGORIES.has(fragment.category)
    ? 2
    : NOISE_CATEGORIES.has(fragment.category)
      ? 0
      : 1;
  LEVEL_BUCKETS[level].push(fragment.text);
}

export function generateRowStreams(rowCount: number, minCharsPerRow = 450) {
  const streams: Array<{
    text: string;
    asciiCodes: Uint8Array;
    length: number;
    level: SemanticLevel;
  }> = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const patternIndex = rowIndex % 12;
    const level: SemanticLevel = patternIndex === 11 ? 2 : patternIndex >= 7 ? 1 : 0;
    const entries = LEVEL_BUCKETS[level];
    let entryIndex = (rowIndex * 17 + (rowIndex % 7) * 43) % entries.length;
    const stride = 1 + (rowIndex % 5);
    const words: string[] = [];
    let currentLength = 0;

    while (currentLength < minCharsPerRow) {
      const entry = entries[entryIndex];
      words.push(entry);
      currentLength += entry.length + 1;
      entryIndex = (entryIndex + stride) % entries.length;
    }

    const text = `${words.join(" ")} `;
    const asciiCodes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      asciiCodes[index] = text.charCodeAt(index);
    }
    streams.push({ text, asciiCodes, length: text.length, level });
  }

  return streams;
}
