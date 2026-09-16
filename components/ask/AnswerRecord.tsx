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
 *
 * ## The turn's ending (2026-09-17, Midnight Signal workstream F)
 *
 * An answer is now a document in its own right, and ends like one: a stable
 * anchor (`answer-<message id>`, so the turn can be linked to from anywhere
 * in the page), the time it was written, the authorship line, and a copy
 * action that takes the whole turn — question, answer, disclosure, sources —
 * with the citations attached. Copying the answer alone would be copying a
 * claim without the apparatus that makes it checkable; the citations travel
 * with it or the action does not exist.
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { CitationList } from "./CitationList";
import type { Exchange } from "./exchanges";
import type { Citation } from "@/server/contracts/chat";
import styles from "./ask.module.css";

/* VA-47. The ruling is shipped verbatim, under every answer. */
const AUTHORSHIP_LINE =
  "Written by the Lions of Zion editorial system from the records cited below.";

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The turn as one piece of citable text, citations numbered as rendered. */
function turnAsText(
  question: string | null,
  content: string,
  citations: Citation[],
): string {
  const sources = citations
    .map((citation, index) => {
      const where = citation.href ? ` — ${citation.href}` : " — indexed, no public page";
      const quote = citation.quote ? `\n    “${citation.quote}”` : "";
      return `${index + 1}. ${citation.title ?? "Untitled record"}${where}${quote}`;
    })
    .join("\n");

  return [
    question ? `Q: ${question}` : null,
    content,
    AUTHORSHIP_LINE,
    citations.length ? `Sources:\n${sources}` : "No document in the index was cited for this answer.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function AnswerRecord({ exchange }: { exchange: Exchange }) {
  const { question, answer } = exchange;
  const [copied, setCopied] = useState(false);

  const copyTurn = useCallback(async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(
        turnAsText(question || null, answer.content, answer.citations),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      /* Clipboard permission refused — the answer is still selectable text;
         the failure is not announced because the record itself is not lost. */
    }
  }, [answer, question]);

  return (
    <article className={styles.record} id={answer ? `answer-${exchange.key}` : undefined}>
      {question ? (
        <Message from="user">
          <MessageContent className={styles.turnUser}>{question}</MessageContent>
        </Message>
      ) : null}

      {answer ? (
        <Message from="assistant" className={styles.turnDesk}>
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
          <div className={styles.answerMeta}>
            <span className={styles.answerStamp}>
              {TIMESTAMP_FORMAT.format(new Date(answer.createdAt))}
            </span>
            <span className={styles.authorship}>{AUTHORSHIP_LINE}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyTurn}
              data-copied={copied ? "" : undefined}
            >
              {copied ? (
                <>
                  <Icon name="verified" size={14} />
                  Copied
                </>
              ) : (
                <>
                  <Icon name="share" size={14} />
                  Copy with citations
                </>
              )}
            </Button>
          </div>
        </Message>
      ) : null}
    </article>
  );
}
