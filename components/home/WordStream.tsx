import { corpusWords, type CorpusGroup } from "@/lib/home/signal-corpus";
import styles from "./word-stream.module.css";

const ROW_WORDS = 40;

/* Deterministic, because the server and the client must render the same
   words: `Math.random()` here is a hydration mismatch waiting for its first
   reader. */
function shuffle(words: string[], seed: number) {
  const out = [...words];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A band's own vocabulary as a single quiet line of drift — the cover's field,
 * flattened to one dimension. Ember in Fake Resistance, where the words are
 * the adversary's; ash or amber elsewhere. Never in October 7.
 */
export function WordStream({
  groups,
  tone = "ash",
  rows = 1,
  seed = 1,
}: {
  groups: CorpusGroup[];
  tone?: "ash" | "ember" | "amber";
  rows?: 1 | 2;
  seed?: number;
}) {
  const words = corpusWords(groups);
  return (
    <div className={styles.stream} data-tone={tone} aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => {
        const line = shuffle(words, seed + row * 613).slice(0, ROW_WORDS);
        return (
          <div key={row} className={styles.row} data-row={row}>
            {/* The track carries the line twice and travels exactly half its
                width, which is what makes the loop seamless. */}
            <div className={styles.track}>
              {[0, 1].map((copy) => (
                <span key={copy} className={styles.set}>
                  {line.map((word) => (
                    <span key={word} className={styles.word}>{word}</span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
