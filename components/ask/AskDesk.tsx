"use client";

/**
 * The desk: transcript, the wait, and the box.
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
 * So the wait says what is happening and why, and shows the only honest
 * measurement available — elapsed seconds. `BorderBeam` is the one moving
 * thing: a project primitive, pure CSS, no JavaScript, and it decorates a
 * state that is also stated in words.
 *
 * ## Errors are records, not toasts
 *
 * A rate limit and an unconfigured gateway are different facts with different
 * remedies, and both are answers to the question that was just asked. They
 * belong in the transcript where the answer would have been, carrying the
 * API's own `detail` — which names the actual ceiling and window rather than a
 * number this component would have to keep in step with the server.
 */

import { useEffect, useRef } from "react";
import { BorderBeam } from "@/components/motion";
import { AnswerRecord } from "./AnswerRecord";
import { toExchanges } from "./exchanges";
import { AskComposer } from "./AskComposer";
import { useAskThread } from "./useAskThread";
import styles from "./ask.module.css";

const EXAMPLES = [
  "What has been published about the northern border?",
  "Is there anything here on claims that footage was staged?",
  "How does this desk decide that something is verified?",
];

export function AskDesk() {
  const { messages, status, problem, pending, elapsed, ask, lostThread, reset } = useAskThread();
  const exchanges = toExchanges(messages);
  const tail = useRef<HTMLDivElement>(null);

  /* Move to the newest record when one arrives — but never on first paint, and
     never past the composer. `block: "nearest"` keeps a restored transcript
     where the reader left it instead of yanking the page. */
  const count = exchanges.length;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    /* `behavior` has to be decided here: an explicit `"smooth"` overrides the
       CSS, so the reduced-motion kill switch in `globals.css` cannot reach it.
       This is the one place on these two surfaces where that is true. */
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tail.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [count, status]);

  /* What a screen reader is told when the wait ends. The answer arrives as a
     new record far up the page and nothing else would announce it. */
  const settled = exchanges.at(-1);
  const announcement =
    status === "idle" && settled?.answer
      ? `Answer received, ${settled.answer.citations.length === 0
          ? "citing nothing"
          : `citing ${settled.answer.citations.length} ${settled.answer.citations.length === 1 ? "source" : "sources"}`}.`
      : "";

  const unavailable = problem?.code === "NOT_IMPLEMENTED";
  const busy = status === "asking";

  return (
    <div className={styles.desk}>
      {lostThread ? (
        <p className={styles.systemNote}>
          An earlier conversation from this browser could not be reopened. A thread is tied to
          the network connection that started it, so changing network loses the link to it —
          the transcript is not deleted, it is simply no longer addressable from here.
        </p>
      ) : null}

      {count === 0 && !busy && !problem ? <AskPrimer onPick={ask} disabled={busy} /> : null}

      <div className={styles.transcript}>
        {exchanges.map((exchange) => (
          <AnswerRecord key={exchange.key} exchange={exchange} />
        ))}

        {busy && pending ? (
          <article className={styles.record}>
            <p className={styles.recordLabel}>Question</p>
            <p className={styles.question}>{pending}</p>
            <Waiting elapsed={elapsed} />
          </article>
        ) : null}

        {problem && !unavailable ? (
          <article className={styles.record} data-tone="alert">
            {pending ? (
              <>
                <p className={styles.recordLabel}>Question</p>
                <p className={styles.question}>{pending}</p>
              </>
            ) : null}
            <p className={styles.recordLabel}>Not answered</p>
            <p className={styles.problemLead}>
              {problem.code === "RATE_LIMITED"
                ? "You have reached the limit on questions."
                : "The question did not get an answer."}
            </p>
            <p className={styles.problemDetail}>{problem.detail}</p>
            {problem.code === "RATE_LIMITED" ? (
              <p className={styles.problemDetail}>
                Nothing was lost — ask again once the window has passed.
              </p>
            ) : null}
          </article>
        ) : null}

        <div ref={tail} aria-hidden="true" />
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>

      {unavailable ? (
        <div className={styles.unavailable}>
          <p className={styles.problemLead}>This desk&rsquo;s assistant is not connected here.</p>
          <p className={styles.problemDetail}>{problem.detail}</p>
          <p className={styles.problemDetail}>
            Nothing you can do in this browser will change that, so the box is closed rather than
            left to fail again. The corpus itself is searchable in the meantime.
          </p>
        </div>
      ) : (
        <AskComposer
          onAsk={ask}
          disabled={busy || status === "restoring"}
          hint={
            busy ? "Waiting for the current answer before the next question." : undefined
          }
        />
      )}

      <div className={styles.deskFoot}>
        <p className={styles.deskFootNote}>
          Answers are composed from what this desk has published, and every one lists what it
          used. An answer with nothing under it found nothing, and says so.
        </p>
        {count > 0 ? (
          <button type="button" className={styles.resetButton} onClick={reset}>
            Start a new conversation
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Waiting({ elapsed }: { elapsed: number }) {
  return (
    <div className={styles.waiting} role="status" aria-live="polite">
      {/* The default ink tone, not gold. `components/motion/README.md` reserves
          gold for the one primary control on a screen, and a border beam is a
          state marker — which is exactly what the signal tone is for. */}
      <BorderBeam duration={9} size={120} />
      <p className={styles.waitingLead}>Searching the index, then composing.</p>
      <p className={styles.waitingBody}>
        The answer arrives whole. Nothing is streamed here on purpose: every citation is checked
        against what retrieval actually returned before a word of the answer is stored, so a
        fabricated source is refused rather than shown to you and withdrawn. It can take up to two
        minutes.
      </p>
      <p className={styles.waitingClock}>
        <span className={styles.waitingSeconds}>{String(elapsed).padStart(2, "0")}</span>
        <span>seconds elapsed</span>
      </p>
    </div>
  );
}

function AskPrimer({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className={styles.primer}>
      <p className={styles.primerLead}>
        Ask about what this desk has published, and the claims behind it.
      </p>
      <p className={styles.primerBody}>
        The assistant reads the published corpus before answering and lists what it used. It will
        say when it found nothing rather than filling the gap — an answer with no sources under it
        is conversation, not a finding.
      </p>
      <ul className={styles.primerExamples}>
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button type="button" className={styles.primerExample} disabled={disabled} onClick={() => onPick(example)}>
              {example}
              <span className={styles.primerExampleArrow} aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
