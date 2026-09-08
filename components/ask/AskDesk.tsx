"use client";

/**
 * The desk: transcript, the wait, and the box — in one of two orders.
 *
 * `layout="dock"` (the default, and what the drawer mounts) is header,
 * conversation, composer: the box at the foot in every state, the suggested
 * questions filling the empty transcript above it. `layout="page"` (`/ask`)
 * is the other way up: the box first, the suggestions as chips under it, the
 * transcript below. On the page the drawer's order put the box below the fold
 * at 390px, under a lede and three bordered rows, and the first screen of a
 * page whose whole job is a question should be the place to type it (UX-24).
 * The page's one line of provenance promise is its lede — "Every answer shows
 * what it was built from — or says it found nothing." — so the desk does not
 * say it a second time 300px lower; in the drawer the same promise is the
 * dialog's own description.
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

import { Button } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import { BorderBeam } from "@/components/motion";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputProvider,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import {
  Suggestion,
  Suggestions,
} from "@/components/ai-elements/suggestion";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { AnswerRecord } from "./AnswerRecord";
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

/* The provider is here and not inside `PromptInput` so the input's text can be
   set from outside the box — which is what "take the failed question back into
   the composer and edit it" needs. `PromptInput` is self-managing without it;
   with it, `usePromptInputController` reaches the same state from the desk. */
export function AskDesk({ layout = "dock" }: { layout?: AskDeskLayout }) {
  return (
    <PromptInputProvider>
      <AskDeskBody layout={layout} />
    </PromptInputProvider>
  );
}

function AskDeskBody({ layout }: { layout: AskDeskLayout }) {
  const controller = usePromptInputController();
  const { messages, status, problem, pending, elapsed, ask, retry, recall, cancel, lostThread, reset } =
    useAskThread();
  const exchanges = toExchanges(messages);

  /* STATE-003. The composer clears on submit, so a failed turn would otherwise
     leave the reader with the question visible in an error record and no way
     back to it but retyping. Two ways back: send it again unchanged, or take it
     into the box and edit it.
     The `seed` prop and its nonce that used to carry this are gone with
     `AskComposer` — `PromptInput` holds its own text, so the recall writes
     straight into it through the controller. Re-recalling the same question
     works without a nonce because the write is unconditional. */
  const recallIntoComposer = () => {
    const question = recall();
    if (question) controller.textInput.setInput(question);
  };

  /* Scroll position belongs to `Conversation` now. What stood here was an
     effect that moved a `tail` ref into view on every new record and had to
     read `prefers-reduced-motion` by hand, because an explicit `"smooth"`
     overrides the CSS kill switch in `globals.css`. The scroller anchors on the
     question instead of chasing the bottom, and reads the preference itself. */
  const count = exchanges.length;

  /* `settled` is still the last exchange — the state chip below reads it. What
     went with the transcript rewrite is the announcement string it used to
     build: `ConversationContent` is a `role="log"` with
     `aria-relevant="additions"`, so the arriving answer is announced by the
     region that contains it. Building a second sentence about the same event
     and putting it in a second live region announced it twice. */
  const settled = exchanges.at(-1);

  const unavailable = problem?.code === "NOT_IMPLEMENTED";
  const busy = status === "submitting" || status === "loading";
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
            question={pending}
            onRetry={retry}
            onEdit={recallIntoComposer}
          />
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
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
    /* One box, which is what a chat input is. `AskComposer` was a labelled
       form with its own counter and hint rows stacked under it — correct as
       a form, and a third block of chrome on a panel that already had two.
       `PromptInput` carries file attachments and a drop target this desk
       has no use for; they are inert with no `accept` and no menu mounted,
       and the parts used here are the textarea, the footer and the submit.
       `status` drives the button's own spinner and stop control, so the
       cancel path that lived in the composer's chrome is the button.
       The evidence boundary used to be rendered here as well as in the
       drawer's own description, which stated the same disclosure twice about
       200px apart and in two different typographic registers. One statement:
       the drawer's description, or the page's lede. */
    <PromptInput
      className={styles.deskPrompt}
      onSubmit={(message) => {
        const question = message.text.trim();
        if (question) ask(question);
      }}
    >
      <PromptInputBody>
        <PromptInputTextarea
          disabled={busy || status === "restoring"}
          placeholder={hasHistory ? "Ask a follow-up…" : "Ask about a claim, a video, a source…"}
        />
      </PromptInputBody>
      <PromptInputFooter>
        {hasHistory ? (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            New conversation
          </Button>
        ) : (
          <span />
        )}
        {/* UX-26. The registry's submit is a 32px glyph; `deskStyles.submit`
            makes it a 44px target and shows the word from 768. `children`
            replaces the registry's icon outright, so the label is passed
            only in the state where the button sends: while a turn is in
            flight it is the registry's spinner and stops the turn, and
            after a failure it is the registry's mark. The accessible name
            follows the visible word (WCAG 2.5.3), and the registry's own
            `aria-label` is spread before this one so it loses. */}
        <PromptInputSubmit
          className={`${styles.deskSubmit} ${deskStyles.submit}`}
          status={busy ? "submitted" : problem ? "error" : undefined}
          onStop={cancel}
          aria-label={busy ? "Stop" : "Send"}
        >
          {busy || problem ? undefined : (
            <>
              <span className={deskStyles.submitLabel}>Send</span>
              <span aria-hidden="true">↵</span>
            </>
          )}
        </PromptInputSubmit>
      </PromptInputFooter>
    </PromptInput>
  );

  return (
    <div
      className={onPage ? `${styles.desk} ${deskStyles.page}` : styles.desk}
      data-ask-state={visibleState}
      data-ask-layout={layout}
    >
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

      {onPage ? (
        <>
          {composer}
          {showPrimer && !unavailable ? <AskChips onPick={ask} disabled={busy} /> : null}
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

/* The page's suggested questions: plain chips, no label, no arrow glyph. The
   drawer's `AskPrimer` below renders the same three as full-width rows with
   an intro line, which is right for a drawer whose middle would otherwise be
   empty and wrong under a composer that is already the first thing on the
   page (UX-24). */
function AskChips({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <ul className={deskStyles.chips} aria-label="Suggested questions">
      {EXAMPLES.map((example) => (
        <li key={example}>
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={disabled}
            onClick={() => onPick(example)}
          >
            {example}
          </Button>
        </li>
      ))}
    </ul>
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
      {/* The pending question renders as the same bubble it will keep once the
          answer lands under it — the turn does not change shape when it
          resolves. The label goes, because the alignment already says whose
          turn this is. */}
      <Message from="user">
        <MessageContent>{question}</MessageContent>
      </Message>
      <div className={styles.waiting}>
        {/* The default ink tone, not gold. Gold is reserved for the one
            primary control on a screen; a border beam is a state marker. */}
        <BorderBeam duration={9} size={120} />
        {/* Live region is the lead only. The elapsed clock ticks every second and
            must not sit inside a polite region or it would re-announce the wait. */}
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
  status,
  detail,
  question,
  onRetry,
  onEdit,
}: {
  code: string;
  status: number;
  detail: string;
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
          <MessageContent>{question}</MessageContent>
        </Message>
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

function AskPrimer({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className={styles.primer}>
      {/* The lead sentence that stood here is gone. It said "ask about what
          this desk has published, and the claims behind it" — which is what
          the three examples below it demonstrate, at the size of a heading,
          above a panel whose whole job is the box at the foot.
          AI Elements' `Suggestions` is a horizontal rail of pills. Worth
          knowing about the trade it makes here: it sets `whitespace-nowrap`,
          and these three examples are whole sentences, so on a narrow drawer
          they scroll sideways instead of stacking. That is the library's
          shape — a row of short prompts — and these are long ones. If they
          read badly, the fix is shorter examples, not a re-styled rail. */}
      <p className={styles.primerIntro}>
        Ask about anything this desk has published, or the claims behind it.
      </p>
      <p className={styles.primerLabel}>Suggested questions</p>
      <Suggestions className={styles.primerExamples}>
        {EXAMPLES.map((example) => (
          <Suggestion
            key={example}
            suggestion={example}
            onClick={onPick}
            disabled={disabled}
          >
            <span className={styles.primerExampleText}>{example}</span>
            <span className={styles.primerExampleArrow} aria-hidden="true">↵</span>
          </Suggestion>
        ))}
      </Suggestions>
    </div>
  );
}
