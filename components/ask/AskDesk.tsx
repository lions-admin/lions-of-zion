"use client";

/**
 * The desk: transcript, the wait, and the box — in one of two orders.
 *
 * `layout="dock"` (the default, and what the drawer mounts) is conversation
 * then composer: the box at the foot in every state, the suggested questions
 * filling the empty transcript above it. `layout="page"` (`/ask`) is the other
 * way up: the box first, the suggestions as chips under it, the transcript
 * below. On the page the drawer's order put the box below the fold at 390px,
 * under a lede and three bordered rows, and the first screen of a page whose
 * whole job is a question should be the place to type it (UX-24). The page's
 * one line of provenance promise is its lede — "Every answer shows what it was
 * built from — or says it found nothing." — so the desk does not say it a
 * second time 300px lower; in the drawer the same promise is the dialog's own
 * description.
 *
 * ## The vendored stack is gone (owner decision 3, 2026-09-16)
 *
 * This file imported `PromptInput`, `Conversation`, `Message` and `Suggestions`
 * from `components/ai-elements`, which imported ten `components/shadcn`
 * modules, which imported Tailwind, Radix, cmdk and lucide — about 3,960 lines
 * and a second icon family beside `Icon`'s twenty-seven marks, all of it
 * reachable from one feature. Every part that was actually load-bearing has a
 * primitive here already: `FieldControl multiline` grows with its content,
 * `Button` is the control hierarchy, `Card` is the row, and the transcript is
 * a `role="log"`. What the registry added on top of those was overrides — six
 * rules in `ask.module.css` existed only to undo its borders and its `w-max`
 * rail — and a scroll-pinning library. See `AskField` and `AnswerRecord`.
 *
 * The scroller went with it. `Conversation` stuck the view to the live edge
 * through `use-stick-to-bottom`, which is the right behaviour for a streaming
 * chat and the wrong one here: this endpoint answers whole, so there is no
 * edge that moves, and pinning the viewport to the bottom of a long answer
 * lands the reader at the sources rather than at the first sentence. The
 * transcript is an ordinary block that grows downward; the browser keeps the
 * reading position, which is what a reader expects of a document.
 *
 * ## The waiting state is where the guarantee gets explained
 *
 * This endpoint does not stream, and it is slow — up to two minutes by its own
 * `maxDuration`. Both are consequences of the thing that makes it worth using:
 * a citation is checked against what retrieval actually returned at the moment
 * the answer is written, so a fabricated source is refused by the database
 * instead of appearing on screen and being taken back. A token-by-token
 * animation faked over that would be a lie about the mechanism, and this site
 * documents people who do that for a living.
 *
 * So `asking` is thinking, not streaming. The wait says what is happening and
 * why, and shows the only honest measurement available — elapsed seconds.
 * **The clock sits outside the transcript's live region**, which is the whole
 * reason the wait is not rendered inside it: a ticking number inside a
 * `role="log"` is a screen reader counting out loud for two minutes.
 * `BorderBeam` is the one moving thing, and only around the active waiting
 * answer; it unmounts on success, error, or abort. Under
 * `prefers-reduced-motion` the beam is gone and the waiting panel keeps a
 * static emphasized border.
 *
 * ## Errors are records, not toasts
 *
 * A rate limit and an unconfigured gateway are different facts with different
 * remedies, and both are answers to the question that was just asked. They
 * belong where the answer would have been, carrying the API's own `detail` —
 * which names the actual ceiling and window rather than a number this
 * component would have to keep in step with the server — and, for a rate
 * limit, the `Retry-After` the response actually sent, counted down.
 *
 * A failure is announced **once**: the problem record is the assertive region
 * and it sits outside the transcript's polite `role="log"`, so the two cannot
 * both narrate the same event.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import { assertiveLive, politeLive, silentLive } from "@/components/ui/live-region";
import { BorderBeam } from "@/components/motion";
import { SuggestionChips } from "@/components/search/instrument";
import { AnswerRecord } from "./AnswerRecord";
import { AskField } from "./AskField";
import { toExchanges } from "./exchanges";
import { useAskThread } from "./useAskThread";
import styles from "./ask.module.css";
import deskStyles from "./ask-desk.module.css";

/* The questions an activist actually arrives with (UX-24, copy table) —
   a video, a claim, an event — rather than questions about the desk. */
const EXAMPLES = [
  "Is this video really from Gaza?",
  "Who first posted this claim?",
  "What does the record say about the Nova festival?",
];

export type AskDeskLayout = "page" | "dock";

export interface AskDeskProps {
  layout?: AskDeskLayout;
  /**
   * Put the cursor in the box on mount. The drawer does; `/ask` does not,
   * because the page has a heading and a lede a reader arrives to read.
   * Search's overlay makes the same distinction for the same reason — the two
   * are one instrument.
   */
  autoFocus?: boolean;
  /**
   * A question to open the box with. `/search` hands its unmatched query over
   * this way — "Ask the desk about this" carries the words already typed
   * rather than asking for them again. It fills the field; it does not send,
   * because the reader is the one asking.
   */
  initialQuestion?: string;
}

export function AskDesk({ layout = "dock", autoFocus = false, initialQuestion }: AskDeskProps) {
  const { messages, status, problem, pending, elapsed, ask, retry, recall, cancel, lostThread, reset } =
    useAskThread();
  const exchanges = toExchanges(messages);

  /* STATE-003. The composer clears on submit, so a failed turn would otherwise
     leave the reader with the question visible in an error record and no way
     back to it but retyping. Two ways back: send it again unchanged, or take
     it into the box and edit it. The nonce is what lets the *same* question be
     recalled twice — a bare string would compare equal and be ignored. */
  const [seed, setSeed] = useState<{ text: string; nonce: number } | undefined>(
    initialQuestion ? { text: initialQuestion, nonce: 0 } : undefined,
  );
  const nonce = useRef(0);
  const recallIntoComposer = () => {
    const question = recall();
    if (question) setSeed({ text: question, nonce: ++nonce.current });
  };

  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    composerRef.current?.querySelector("textarea")?.focus();
  }, [autoFocus]);

  const count = exchanges.length;
  const settled = exchanges.at(-1);

  const unavailable = problem?.code === "NOT_IMPLEMENTED";
  const busy = status === "submitting" || status === "loading";
  const restoring = status === "restoring";
  const hasHistory = count > 0;
  const visibleState =
    busy
      ? status
      : problem
        ? "error"
        : settled?.answer
          ? settled.answer.citations.length > 0
            ? "success-with-sources"
            : "insufficient-evidence"
          : settled?.question
            ? "no-answer"
            : "idle";

  const onPage = layout === "page";
  const showPrimer = count === 0 && status === "idle";

  /* One `role="log"` holding settled records and nothing else. `aria-relevant`
     is additions, so an arriving answer is announced by the region that
     contains it — which is why no second sentence about the same event is
     built anywhere in this file. The wait and the failure render after it,
     outside it. */
  const transcript = (
    <div className={styles.transcriptFrame}>
      {showPrimer && !onPage && !unavailable ? (
        <AskPrimer onPick={ask} disabled={busy} />
      ) : null}

      <div
        className={styles.transcript}
        role="log"
        aria-relevant="additions"
        aria-label="Conversation with the desk"
      >
        {exchanges.map((exchange) => (
          <AnswerRecord key={exchange.key} exchange={exchange} />
        ))}
      </div>

      {busy && pending ? (
        <Waiting
          question={pending}
          elapsed={elapsed}
          phase={status === "submitting" ? "submitting" : "loading"}
          onStop={cancel}
        />
      ) : null}

      {problem && !unavailable ? (
        <ProblemRecord
          code={problem.code}
          status={problem.status}
          detail={problem.detail}
          retryAfter={problem.retryAfter}
          question={pending}
          onRetry={retry}
          onEdit={recallIntoComposer}
        />
      ) : null}
    </div>
  );

  const composer = unavailable ? (
    /* StatusState error already uses role="alert" (assertiveLive). */
    <StatusState
      status="error"
      title="This desk's assistant is not connected here."
      description={`${problem.detail} Everything published here is still searchable.`}
      actionText="Search the site"
      actionHref="/search"
    />
  ) : (
    <div ref={composerRef}>
      <AskField
        onAsk={ask}
        busy={busy}
        disabled={restoring}
        seed={seed}
        placeholder={hasHistory ? "Ask a follow-up…" : "Ask about a claim, a video, a source…"}
        hint={
          busy ? (
            /* The field stays live through the wait — this says why the send
               will not fire yet, rather than the box going grey under the
               cursor. */
            "The desk is answering. Draft the next question; it sends when this turn lands."
          ) : restoring ? (
            "Reopening the last conversation."
          ) : undefined
        }
      />
      {hasHistory ? (
        <div className={styles.deskFoot}>
          <Button type="button" variant="text" size="sm" onClick={reset}>
            New conversation
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={onPage ? `${styles.desk} ${deskStyles.page}` : styles.desk}
      data-ask-state={visibleState}
      data-ask-layout={layout}
    >
      {lostThread ? (
        /* One sentence with a verb. What stood here was three clauses of
           mechanism — RLS, network identity, "not deleted, simply no longer
           addressable" — which is true and is not what a reader who just lost
           a transcript needs in the first line. */
        <p className={styles.systemNote}>
          Start again: the earlier conversation belongs to the network it was opened on, and this
          browser can no longer reach it.
        </p>
      ) : null}

      {restoring ? (
        <p className={styles.systemNote} {...politeLive} aria-busy="true">
          Reopening the last conversation from this browser.
        </p>
      ) : null}

      {onPage ? (
        <>
          {composer}
          {showPrimer && !unavailable ? (
            <SuggestionChips
              label="Try one of these"
              queries={EXAMPLES}
              onPick={ask}
              disabled={busy}
              className={deskStyles.chips}
            />
          ) : null}
          {transcript}
        </>
      ) : (
        <>
          {transcript}
          {composer}
        </>
      )}
    </div>
  );
}

function Waiting({
  question,
  elapsed,
  phase,
  onStop,
}: {
  question: string;
  elapsed: number;
  phase: "submitting" | "loading";
  onStop: () => void;
}) {
  return (
    <article className={styles.record} aria-busy="true">
      <div className={styles.question}>
        <p className={styles.srOnly}>Question</p>
        <p className={styles.questionText}>{question}</p>
      </div>
      <div className={styles.waiting}>
        {/* The default ink tone, not gold. Gold is reserved for the one
            primary control on a screen; a border beam is a state marker. */}
        <BorderBeam duration={9} size={120} />
        {/* The lead is the only announced part of the wait. */}
        <p className={styles.waitingLead} {...politeLive}>
          {phase === "submitting" ? "Sending the question." : "Searching the index, then composing."}
        </p>
        <p className={styles.waitingBody}>
          The answer arrives whole. Nothing is streamed here on purpose: every citation is checked
          against what retrieval actually returned before a word of the answer is stored, so a
          fabricated source is refused rather than shown to you and withdrawn. It can take up to two
          minutes.
        </p>
        <div className={styles.waitingMeta}>
          {/* Explicitly silenced: it changes every second, and a region that
              was merely un-announced is one refactor away from being read. */}
          <p className={styles.waitingClock} {...silentLive}>
            <span className={styles.waitingSeconds}>{String(elapsed).padStart(2, "0")}</span>
            <span>seconds elapsed</span>
          </p>
          <Button type="button" variant="secondary" size="md" onClick={onStop}>
            Stop
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * A rate limit's remaining wait, counted down from the response's own header.
 *
 * Null whenever the server did not send a usable `Retry-After`; the copy then
 * says "once the window has passed" rather than inventing a number. Returns
 * null again the moment it reaches zero, so the sentence turns itself back
 * into "you can ask again" without a second state to keep in step.
 */
function useCountdown(seconds: number | null): number | null {
  const [left, setLeft] = useState(seconds);
  const [source, setSource] = useState(seconds);
  if (source !== seconds) {
    setSource(seconds);
    setLeft(seconds);
  }

  useEffect(() => {
    if (seconds === null) return;
    const until = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      setLeft(remaining > 0 ? remaining : null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  return left;
}

function ProblemRecord({
  code,
  status,
  detail,
  retryAfter,
  question,
  onRetry,
  onEdit,
}: {
  code: string;
  status: number;
  detail: string;
  retryAfter: number | null;
  question: string | null;
  onRetry: () => void;
  onEdit: () => void;
}) {
  /* The status as well as the code, for the same reason as the search
     panel's `PanelProblem`: the API nests its body under `error` and the
     shared `requestJson` reads the top level, so the code can arrive as
     `UNKNOWN` on a real rate limit. The status cannot. */
  const rateLimited = code === "RATE_LIMITED" || status === 429;
  const left = useCountdown(rateLimited ? retryAfter : null);

  return (
    <article className={styles.record} data-tone="alert" {...assertiveLive}>
      {question ? (
        <div className={styles.question}>
          <p className={styles.srOnly}>Question</p>
          <p className={styles.questionText}>{question}</p>
        </div>
      ) : null}
      <p className={styles.recordLabel}>Not answered</p>
      <p className={styles.problemLead}>
        {rateLimited ? "You have reached the limit on questions." : "The question did not get an answer."}
      </p>
      <p className={styles.problemDetail}>{detail}</p>
      {rateLimited ? (
        <p className={styles.problemDetail}>
          Nothing was lost —{" "}
          {left === null ? (
            "ask again once the window has passed."
          ) : (
            <>
              ask again in{" "}
              <span className={styles.countdown}>
                {left} {left === 1 ? "second" : "seconds"}
              </span>
              .
            </>
          )}
        </p>
      ) : null}
      {/* STATE-003: the question above is the only surviving copy of what was
          typed. It leaves here in one of two ways the reader chooses — sent
          again as written, or handed back to the box to be changed. Neither
          asks anyone to retype it. A rate limit is not offered an immediate
          resend, because the next attempt would fail the same way and spend
          another of the window's allowance; editing is still offered, and the
          edited question can be sent when the window has passed. */}
      {question ? (
        <div className={styles.problemActions}>
          {rateLimited ? null : (
            <Button type="button" variant="secondary" size="md" onClick={onRetry}>
              Ask this again
            </Button>
          )}
          <Button type="button" variant="ghost" size="md" onClick={onEdit}>
            Edit the question
          </Button>
        </div>
      ) : null}
    </article>
  );
}

/* The drawer's empty middle: an intro line and the same three suggestions the
   page shows as chips under its box, in the one chip primitive both surfaces
   use. The registry's horizontal pill rail that stood here set
   `whitespace-nowrap` on whole-sentence suggestions, so at 390px they ran off
   the drawer with the scrollbar that would have hinted at it rendered hidden. */
function AskPrimer({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className={styles.primer}>
      <p className={styles.primerIntro}>
        Ask about anything this desk has published, or the claims behind it.
      </p>
      <SuggestionChips
        label="Suggested questions"
        queries={EXAMPLES}
        onPick={onPick}
        disabled={disabled}
        className={deskStyles.chips}
      />
    </div>
  );
}
