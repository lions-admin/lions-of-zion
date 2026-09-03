"use client";

/**
 * The desk: evidence boundary, transcript, the wait, and the box.
 *
 * Layout before a submit (idle / primer): primer examples, evidence-boundary
 * notice, then the composer. The notice used to sit under the box, which meant
 * a reader could send a question without seeing what corpus is searched or
 * what an unsupported answer means. It is now above the composer in every
 * state that still has one.
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
 * why, and shows the only honest measurement available — elapsed seconds,
 * which are never announced. `BorderBeam` is the one moving thing, and only
 * around the active waiting answer; it unmounts on success, error, or abort.
 * Under `prefers-reduced-motion` the beam is gone and the waiting panel keeps
 * a static emphasized border.
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
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardEyebrow } from "@/components/ui/Card";
import { StatusState } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
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
  const { messages, status, problem, pending, elapsed, ask, cancel, lostThread, reset } =
    useAskThread();
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
     new record far up the page and nothing else would announce it. Elapsed
     seconds never enter this string. */
  const settled = exchanges.at(-1);
  const announcement =
    status === "idle" && settled?.answer
      ? `Answer received, ${settled.answer.citations.length === 0
          ? "citing nothing"
          : `citing ${settled.answer.citations.length} ${settled.answer.citations.length === 1 ? "source" : "sources"}`}.`
      : "";

  const unavailable = problem?.code === "NOT_IMPLEMENTED";
  const busy = status === "asking";
  const hasHistory = count > 0;

  return (
    <div className={styles.desk}>
      {lostThread ? (
        <p className={styles.systemNote}>
          An earlier conversation from this browser could not be reopened. A thread is tied to
          the network connection that started it, so changing network loses the link to it —
          the transcript is not deleted, it is simply no longer addressable from here.
        </p>
      ) : null}

      {status === "restoring" ? (
        <p className={styles.systemNote} {...politeLive} aria-busy="true">
          Reopening the last conversation from this browser.
        </p>
      ) : null}

      {count === 0 && status === "idle" ? <AskPrimer onPick={ask} disabled={busy} /> : null}

      <div className={styles.transcript}>
        {exchanges.map((exchange) => (
          <AnswerRecord key={exchange.key} exchange={exchange} />
        ))}

        {busy && pending ? (
          <Waiting question={pending} elapsed={elapsed} onStop={cancel} />
        ) : null}

        {problem && !unavailable ? (
          <ProblemRecord
            code={problem.code}
            detail={problem.detail}
            question={pending}
          />
        ) : null}

        <div ref={tail} aria-hidden="true" />
      </div>

      <p className={styles.srOnly} {...politeLive}>
        {announcement}
      </p>

      {unavailable ? (
        /* StatusState error already uses role="alert" (assertiveLive). */
        <StatusState
          status="error"
          title="This desk's assistant is not connected here."
          description={`${problem.detail} The corpus itself is searchable in the meantime.`}
          actionText="Search the corpus"
          actionHref="/search"
        />
      ) : (
        <div className={styles.deskPrompt}>
          <EvidenceBoundary />
          <AskComposer
            onAsk={ask}
            disabled={busy || status === "restoring"}
            label={hasHistory ? "Follow-up" : "Your question"}
            placeholder={hasHistory ? "Ask a follow-up…" : undefined}
            hint={
              busy
                ? "Waiting for the current answer before the next question."
                : status === "restoring"
                  ? "Reopening the last conversation."
                  : undefined
            }
          />
          {hasHistory ? (
            <div className={styles.deskFoot}>
              <Button type="button" variant="ghost" size="md" onClick={reset}>
                Start a new conversation
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EvidenceBoundary() {
  return (
    <Card
      variant="note"
      as="aside"
      className={styles.boundary}
      aria-labelledby="ask-boundary-title"
    >
      <CardEyebrow id="ask-boundary-title">Evidence boundary</CardEyebrow>
      <CardDescription className={styles.boundaryBody}>
        This desk searches the published corpus it holds — the same record Search reads.
        Every answer lists the documents it used. An answer with nothing under it found
        nothing in that corpus: treat it as conversation, not as a finding.
      </CardDescription>
    </Card>
  );
}

function Waiting({
  question,
  elapsed,
  onStop,
}: {
  question: string;
  elapsed: number;
  onStop: () => void;
}) {
  return (
    <article className={styles.record} aria-busy="true">
      <p className={styles.recordLabel}>Question</p>
      <p className={styles.question}>{question}</p>
      <div className={styles.waiting}>
        {/* The default ink tone, not gold. Gold is reserved for the one
            primary control on a screen; a border beam is a state marker. */}
        <BorderBeam duration={9} size={120} />
        {/* Live region is the lead only. The elapsed clock ticks every second and
            must not sit inside a polite region or it would re-announce the wait. */}
        <p className={styles.waitingLead} {...politeLive}>
          Searching the index, then composing.
        </p>
        <p className={styles.waitingBody}>
          The answer arrives whole. Nothing is streamed here on purpose: every citation is checked
          against what retrieval actually returned before a word of the answer is stored, so a
          fabricated source is refused rather than shown to you and withdrawn. It can take up to two
          minutes.
        </p>
        <div className={styles.waitingMeta}>
          <p className={styles.waitingClock}>
            <span className={styles.waitingSeconds}>{String(elapsed).padStart(2, "0")}</span>
            <span>seconds elapsed</span>
          </p>
          <Button type="button" variant="ghost" size="md" onClick={onStop}>
            Stop
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProblemRecord({
  code,
  detail,
  question,
}: {
  code: string;
  detail: string;
  question: string | null;
}) {
  const rateLimited = code === "RATE_LIMITED";
  return (
    <article className={styles.record} data-tone="alert" {...assertiveLive}>
      {question ? (
        <>
          <p className={styles.recordLabel}>Question</p>
          <p className={styles.question}>{question}</p>
        </>
      ) : null}
      <p className={styles.recordLabel}>Not answered</p>
      <p className={styles.problemLead}>
        {rateLimited ? "You have reached the limit on questions." : "The question did not get an answer."}
      </p>
      <p className={styles.problemDetail}>{detail}</p>
      {rateLimited ? (
        <p className={styles.problemDetail}>
          Nothing was lost — ask again once the window has passed.
        </p>
      ) : null}
    </article>
  );
}

function AskPrimer({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className={styles.primer}>
      <p className={styles.primerLead}>
        Ask about what this desk has published, and the claims behind it.
      </p>
      <ul className={styles.primerExamples}>
        {EXAMPLES.map((example) => (
          <li key={example}>
            <Button type="button" variant="ghost" size="md" disabled={disabled} onClick={() => onPick(example)}>
              {example}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
