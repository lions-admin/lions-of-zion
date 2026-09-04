"use client";

/**
 * One exchange, as a pair of bubbles.
 *
 * This was a labelled record until 2026-09-04, and the docblock here argued
 * against bubbles: the bubble is a messaging metaphor — two people, equal
 * weight, ephemeral — where a question put to a verification desk and the
 * answer it returns are one document in three parts. The owner read that
 * argument and chose bubbles anyway; it is his call, and this note is here so
 * the next reader knows the shape was chosen rather than defaulted into.
 *
 * What the change keeps is the part the argument was really about. The
 * question bubble is a bubble. The answer is not a peer reply — it stays the
 * full-width side of the exchange, keeps the reading measure, and keeps its
 * sources in their own block underneath, because the citation list is the
 * point of this surface and a chat bubble is not a shape that can hold one.
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
        <div className={styles.turn} data-role="question">
          <p className={styles.bubble}>{question}</p>
        </div>
      ) : null}

      {answer ? (
        <div className={styles.turn} data-role="answer">
          {/* The label survives on the answer side only. On the question side
              the alignment says whose turn it is; on this side the reader is
              being told they are reading the desk, not a correspondent. */}
          <p className={styles.recordLabel}>Answer</p>
          <div className={styles.answer}>
            {paragraphs(answer.content).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <CitationList citations={answer.citations} />
        </div>
      ) : null}
    </article>
  );
}
