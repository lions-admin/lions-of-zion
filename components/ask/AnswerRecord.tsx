"use client";

/**
 * One exchange — and, once it has settled, a citable document.
 *
 * This was a labelled record until 2026-09-04, then a pair of AI Elements
 * bubbles until 2026-09-16, when the vendored registry that drew them was
 * deleted (owner decision 3). What survived both moves is the distinction the
 * original argument was really about: the question is a bubble, because it is
 * one person's utterance; the answer is not a peer reply. It keeps the full
 * width, the reading measure, and its sources in their own block underneath,
 * because the citation list is the point of this surface and a chat bubble is
 * not a shape that can hold one.
 *
 * ## The authorship line (VA-47)
 *
 * Every settled answer carries one caption under "Answer": *Written by the
 * Lions of Zion editorial system from the records cited below.* Until now the
 * only statement that a machine wrote this was the drawer's own description,
 * 300px up and gone the moment the transcript scrolled — and `AskDock`'s
 * comment claimed each record already stated its authorship, which it did not.
 * On a site that exists to say who wrote what and from which source, an
 * unattributed answer is the single largest credibility gap it can have. It is
 * in the record, next to the words it is about, and it travels with the copy.
 *
 * ## The turn ends somewhere
 *
 * Peak-End: a reading surface ends by design. An answer's ending is what makes
 * it usable elsewhere — a stable anchor (`#answer-<id>`, the id the database
 * allocated, so a link into a transcript survives a reload), the time it was
 * written in the data face, and one action that copies the answer with its
 * numbered sources and the authorship line attached. Nothing is quoted from
 * this desk without them.
 *
 * ## Two things this deliberately does not do
 *
 * The answer's text is split into paragraphs on blank lines and rendered as
 * text. It is **not** parsed as Markdown: the model's output is untrusted
 * input, a Markdown renderer is a meaningful attack surface for exactly one
 * visual gain (bold), and a stray asterisk shown as an asterisk is a better
 * failure than a link this desk did not write.
 *
 * And the citations are rendered from the settled message only — there is no
 * pending state in which a number could be printed and then change. The
 * endpoint does not stream; an answer and its sources arrive together.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CitationList } from "./CitationList";
import type { Exchange } from "./exchanges";
import styles from "./ask.module.css";

/** The one sentence. Exported so the desk's tests and copy audits read it here. */
export const ANSWER_AUTHORSHIP =
  "Written by the Lions of Zion editorial system from the records cited below";

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The document that leaves this page when the reader copies the answer. */
function citableText(exchange: Exchange): string {
  const { question, answer } = exchange;
  if (!answer) return "";
  const lines: string[] = [];
  if (question) lines.push(`Question: ${question}`, "");
  lines.push(answer.content.trim(), "", `${ANSWER_AUTHORSHIP}.`);
  if (answer.citations.length) {
    lines.push("", "Sources");
    answer.citations.forEach((citation, index) => {
      const ordinal = String(index + 1).padStart(2, "0");
      const title = citation.title ?? "Untitled record";
      lines.push(citation.href ? `${ordinal}. ${title} — ${citation.href}` : `${ordinal}. ${title}`);
    });
  } else {
    lines.push("", "No document in the index was cited for this answer.");
  }
  return lines.join("\n");
}

/** Machine value, machine face. Falls back to the raw stamp if it will not parse. */
function writtenAt(iso: string): { label: string; dateTime: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { label: iso, dateTime: iso };
  return {
    label: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    dateTime: date.toISOString(),
  };
}

export function AnswerRecord({ exchange }: { exchange: Exchange }) {
  const { question, answer } = exchange;
  const [copied, setCopied] = useState(false);
  const anchor = answer ? `answer-${answer.id}` : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citableText(exchange));
      setCopied(true);
    } catch {
      /* Clipboard denied (permissions, insecure origin). The button says so
         rather than claiming a copy that did not happen. */
      setCopied(false);
    }
  };

  return (
    <article className={styles.record} id={anchor}>
      {question ? (
        <div className={styles.question}>
          {/* The alignment says whose turn this is, so the label is for the
              reader who cannot see the alignment. */}
          <p className={styles.srOnly}>Question</p>
          <p className={styles.questionText}>{question}</p>
        </div>
      ) : null}

      {answer ? (
        <div className={styles.answerBlock}>
          <p className={styles.recordLabel}>Answer</p>
          <p className={styles.authorship}>{ANSWER_AUTHORSHIP}.</p>
          <div className={styles.answer}>
            {paragraphs(answer.content).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <CitationList citations={answer.citations} />
          <footer className={styles.recordFoot}>
            <time className={styles.recordTime} dateTime={writtenAt(answer.createdAt).dateTime}>
              {writtenAt(answer.createdAt).label}
            </time>
            <Button type="button" variant="text" size="sm" onClick={copy}>
              {copied ? "Copied with sources" : "Copy with sources"}
            </Button>
          </footer>
        </div>
      ) : null}
    </article>
  );
}
