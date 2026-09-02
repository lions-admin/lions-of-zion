"use client";

/**
 * One exchange, set as a record rather than as a pair of chat bubbles.
 *
 * The bubble is a messaging metaphor: two people, equal weight, ephemeral. It
 * is the wrong shape here. A question put to a verification desk and the
 * answer it returns are one document with three parts — the question asked,
 * the answer given, and what the answer rests on — and that is what this
 * renders: a labelled record with a rule under the question, the answer in the
 * reading measure, and the sources below in their own ruled block.
 *
 * The answer's text is split into paragraphs on blank lines and rendered as
 * text. It is deliberately **not** parsed as Markdown: the model's output is
 * untrusted input, a Markdown renderer is a meaningful attack surface for
 * exactly one visual gain (bold), and a stray asterisk shown as an asterisk is
 * a better failure than a link this desk did not write.
 */

import { CitationList } from "./CitationList";
import type { Exchange } from "./exchanges";
import styles from "./ask.module.css";

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function AnswerRecord({ exchange }: { exchange: Exchange }) {
  const { question, answer } = exchange;

  return (
    <article className={styles.record}>
      {question ? (
        <>
          <p className={styles.recordLabel}>Question</p>
          <p className={styles.question}>{question}</p>
        </>
      ) : null}

      {answer ? (
        <>
          <p className={styles.recordLabel}>Answer</p>
          <div className={styles.answer}>
            {paragraphs(answer.content).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <CitationList citations={answer.citations} />
        </>
      ) : null}
    </article>
  );
}
