"use client";

/**
 * The desk: transcript, the wait, and the box — in one of two orders.
 *
 * `layout="dock"` (the default, and what the drawer mounts) is header,
 * conversation, monitor, composer: the box at the foot in every state, the
 * suggested questions filling the empty transcript above it. `layout="page"`
 * (`/ask`) is the other way up: the box first, the suggestions as chips under
 * it, the transcript below. On the page the drawer's order put the box below
 * the fold at 390px, under a lede and three bordered rows, and the first
 * screen of a page whose whole job is a question should be the place to type
 * it (UX-24). The page's one line of provenance promise is its lede — "Every
 * answer shows what it was built from — or says it found nothing." — so the
 * desk does not say it a second time 300px lower; in the drawer the same
 * promise is the dialog's own description.
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
 * why. The only honest measurement available — elapsed seconds — is the
 * monitor strip between the transcript and the composer, deliberately
 * **outside** the `role="log"` live region: a clock that re-announces itself
 * every second inside a polite region is a wait that talks over its own
 * answer. The strip's signal rule runs a bounded sweep (1.4s, registered in
 * `tests/motion-runtime.test.ts` as a processing indicator — a bounded
 * operation that is genuinely running) and exists only while a request is in
 * flight. Under `prefers-reduced-motion` the sweep is a static emphasized
 * rule.
 *
 * ## Errors are records, not toasts
 *
 * A rate limit and an unconfigured gateway are different facts with different
 * remedies, and both are answers to the question that was just asked. They
 * belong in the transcript where the answer would have been, carrying the
 * API's own `detail` — which names the actual ceiling and window rather than a
 * number this component would have to keep in step with the server. A rate
 * limit that answers with `Retry-After` says the same thing as a countdown:
 * one sentence with the number, decremented in place, quiet — the failure was
 * already announced assertively, and a ticking number inside an assertive
 * region would re-announce it every second.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import { SuggestionChips } from "@/components/ui/SuggestionChips";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { AnswerRecord } from "./AnswerRecord";
import { AskComposer } from "./AskComposer";
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

export function AskDesk({
  layout = "dock",
  autoFocus = false,
  initialQuestion,
}: {
  layout?: AskDeskLayout;
  /** Focus the box when the desk mounts — the drawer opens this way. */
  autoFocus?: boolean;
  /** A question the reader arrived with (`/ask?q=…`), seeded into the box. */
  initialQuestion?: string;
}) {
  /* The seed state lives here rather than inside the composer so "take the
     failed question back into the box and edit it" (STATE-003) can reach the
     box from the error record. The nonce is what lets the *same* question be
     recalled twice; a bare string prop would compare equal and be ignored. */
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(() =>
    initialQuestion?.trim() ? { text: initialQuestion.trim(), nonce: 1 } : null,
  );
  const nonce = useRef(1);

  const { messages, status, problem, pending, elapsed, ask, retry, recall, cancel, lostThread, reset } =
    useAskThread();
  const exchanges = toExchanges(messages);

  /* STATE-003. The composer clears on submit, so a failed turn would otherwise
     leave the reader with the question visible in an error record and no way
     back to it but retyping. Two ways back: send it again unchanged, or take it
     into the box and edit it. */
  const recallIntoComposer = useCallback(() => {
    const question = recall();
    if (question) {
      nonce.current += 1;
      setSeed({ text: question, nonce: nonce.current });
    }
  }, [recall]);

  /* `settled` is still the last exchange — the state chip below reads it. What
     went with the transcript rewrite is the announcement string it used to
     build: `Conversation` is a `role="log"` region with
     `aria-relevant="additions"`, so the arriving answer is announced by the
     region that contains it. Building a second sentence about the same event
     and putting it in a second live region announced it twice. */
  const settled = exchanges.at(-1);

  const unavailable = problem?.code === "NOT_IMPLEMENTED";
  const busy = status === "submitting" || status === "loading";
  const hasHistory = exchanges.length > 0;
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
  const showPrimer = exchanges.length === 0 && status === "idle";

  /* The transcript is AI Elements' `Conversation`, which is the same job
     the `MessageScroller` here did for an hour and is the one Vercel keeps
     in step with its own chat SDK. It sticks to the live edge, releases
     when the reader scrolls away, and offers the button back — all of it
     without this component owning a ref or reading a motion preference,
     which is what stood here before it. */
  const transcript = (
    <Conversation className={styles.transcriptFrame}>
      <ConversationContent className={styles.transcript}>
        {/* In the drawer the primer lives *inside* the transcript, as its
            empty state: it occupies the space it is explaining, and the
            moment a question is asked it gives it up. On the page the
            transcript starts empty and the primer is the chip row under the
            composer instead. */}
        {showPrimer && !onPage ? (
          <ConversationEmptyState className={styles.deskEmpty}>
            <AskPrimer onPick={ask} disabled={busy} />
          </ConversationEmptyState>
        ) : null}

        {exchanges.map((exchange) => (
          <AnswerRecord key={exchange.key} exchange={exchange} />
        ))}

        {busy && pending ? (
          <Waiting
            question={pending}
            phase={status === "submitting" ? "submitting" : "loading"}
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
      </ConversationContent>
      <ConversationScrollButton className={styles.scrollButton} />
    </Conversation>
  );

  /* The monitor: the elapsed-seconds sentence and the stop, outside the
     `role="log"` region the transcript is. It renders only while a request
     is in flight, so the strip appears — and the sweep starts — at the
     moment the wait begins, well inside the 100ms a pending state owes. */
  const monitor = busy && pending ? (
    <div className={styles.waitMonitor} data-busy="">
      <p className={styles.waitMonitorSentence}>
        <span className={styles.waitMonitorSeconds}>{elapsed}</span>
        {" "}
        {elapsed === 1 ? "second so far." : "seconds so far."}
      </p>
      <Button type="button" variant="ghost" size="md" onClick={cancel}>
        Stop
      </Button>
    </div>
  ) : null;

  const composer = unavailable ? (
    /* StatusState error already uses role="alert" (assertiveLive). */
    <StatusState
      status="error"
      title="This desk's assistant is not connected here."
      description={`${problem.detail} Everything published here is still searchable.`}
      actionText="Search the site"
      actionHref="/search"
      headingLevel={onPage ? 2 : 3}
    />
  ) : (
    <AskComposer
      onAsk={ask}
      disabled={status === "restoring"}
      autoFocus={autoFocus}
      busy={busy}
      onStop={cancel}
      onReset={hasHistory ? reset : undefined}
      seed={seed ?? undefined}
      placeholder={hasHistory ? "Ask a follow-up…" : "Ask about a claim, a video, a source…"}
    />
  );

  return (
    <div
      className={onPage ? `${styles.desk} ${deskStyles.page}` : styles.desk}
      data-ask-state={visibleState}
      data-ask-layout={layout}
    >
      {lostThread ? (
        <p className={styles.systemNote}>
          This browser could not reopen your earlier conversation — a thread is
          tied to the network that started it, so changing networks loses the
          link.
        </p>
      ) : null}

      {status === "restoring" ? (
        <p className={styles.systemNote} {...politeLive} aria-busy="true">
          Reopening the last conversation from this browser.
        </p>
      ) : null}

      {onPage ? (
        <>
          {composer}
          {showPrimer && !unavailable ? (
            <SuggestionChips
              listLabel="Suggested questions"
              queries={EXAMPLES}
              onPick={ask}
              disabled={busy}
            />
          ) : null}
          {transcript}
          {monitor}
        </>
      ) : (
        <>
          {transcript}
          {monitor}
          {composer}
        </>
      )}
    </div>
  );
}

/* The pending question renders as the same bubble it will keep once the
   answer lands under it — the turn does not change shape when it resolves.
   The label goes, because the alignment already says whose turn this is. */
function Waiting({
  question,
  phase,
}: {
  question: string;
  phase: "submitting" | "loading";
}) {
  return (
    <article className={styles.record} aria-busy="true">
      <Message from="user">
        <MessageContent className={styles.turnUser}>{question}</MessageContent>
      </Message>
      <div className={styles.waiting}>
        {/* The default ink tone, not gold. Gold is reserved for the one
            primary control on a screen; a sweep is a state marker. The sweep
            itself is the rule under the plate, on the monitor strip — see
            `.waitMonitor` — and stays there so the log region never holds
            anything that moves. */}
        <p className={styles.waitingLead} {...politeLive}>
          {phase === "submitting" ? "Sending the question." : "Searching the index, then composing."}
        </p>
        <p className={styles.waitingBody}>
          The answer arrives whole. Nothing is streamed here on purpose: every citation is checked
          against what retrieval actually returned before a word of the answer is stored, so a
          fabricated source is refused rather than shown to you and withdrawn. It can take up to two
          minutes.
        </p>
      </div>
    </article>
  );
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
  return (
    <article className={styles.record} data-tone="alert" {...assertiveLive}>
      {question ? (
        <Message from="user">
          <MessageContent className={styles.turnUser}>{question}</MessageContent>
        </Message>
      ) : null}
      <p className={styles.recordLabel}>Not answered</p>
      <p className={styles.problemLead}>
        {rateLimited ? "You have reached the limit on questions." : "The question did not get an answer."}
      </p>
      <p className={styles.problemDetail}>{detail}</p>
      {rateLimited ? (
        <RetryCountdown key={retryAfter ?? "none"} retryAfter={retryAfter} />
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

/**
 * The `Retry-After` the API sent, said as one sentence and counted down in
 * place. `aria-live="off"` because the ancestor record is `role="alert"`:
 * the failure was announced once, and a number that ticks every second
 * inside an assertive region would re-announce the failure with it. When the
 * window passes the sentence says so, and the edit path above is the way
 * back in.
 */
function RetryCountdown({ retryAfter }: { retryAfter: number | null }) {
  /* Initialised at mount and decremented by its own timer; the `key` on the
     call site re-mounts the countdown when a new failure arrives with a new
     window, which is the render-time reset without an effect writing state
     during one. */
  const [left, setLeft] = useState(retryAfter ?? 0);
  const counting = left > 0 && retryAfter !== null;

  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => {
      setLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [counting]);

  if (retryAfter === null) {
    return (
      <p className={styles.problemDetail}>
        Nothing was lost — ask again once the window has passed.
      </p>
    );
  }

  return (
    <p className={styles.problemDetail} aria-live="off" data-counting={left > 0 ? "" : undefined}>
      {left > 0
        ? `You can ask again in ${left} ${left === 1 ? "second" : "seconds"}.`
        : "You can ask again now."}
    </p>
  );
}

function AskPrimer({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className={styles.primer}>
      {/* The lead sentence that stood here is gone. It said "ask about what
          this desk has published, and the claims behind it" — which is what
          the three examples below it demonstrate, at the size of a heading,
          above a panel whose whole job is the box at the foot. */}
      <p className={styles.primerIntro}>
        Ask about anything this desk has published, or the claims behind it.
      </p>
      <p className={styles.primerLabel}>Suggested questions</p>
      {/* The rows the registry's `Suggestions` rail used to carry. The rail
          set `whitespace-nowrap` and scrolled sideways; these are whole
          sentences, so they were re-graded into full-width rows reading from
          the start edge — prompts a reader chooses between, not chips in a
          row. The start-edge mark is what says "this is a thing you take"
          without spending an icon on it. */}
      <ul className={styles.primerRows}>
        {EXAMPLES.map((example) => (
          <li key={example}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={disabled}
              onClick={() => onPick(example)}
            >
              <span className={styles.primerRowText}>{example}</span>
              <span className={styles.primerRowArrow} aria-hidden="true">↵</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
