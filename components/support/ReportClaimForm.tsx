'use client';

/**
 * The public, unauthenticated "report a claim for review" form — wired to
 * `POST /api/v1/reports` (`app/api/v1/reports/route.ts`), the only write
 * path in the system open to a stranger. The endpoint returns a minimal
 * receipt and never echoes submitted content back, so this form doesn't
 * either. Same problem+json parsing pattern as `AskTheLionChat.tsx`, kept
 * local rather than shared since it's a small, self-contained piece.
 */
import { FormEvent, useRef, useState } from 'react';
import { Button, Field, assertiveLive, politeLive } from '@/components/ui';
import styles from './support.module.css';

const FAILURE_COPY: Record<string, string> = {
  VALIDATION_ERROR: 'That report could not be accepted as written. Check the fields and retry.',
  RATE_LIMITED: 'Too many reports submitted from here recently. Wait a moment, then retry.',
};
const GENERIC_FAILURE = 'The report could not be sent right now. Retry in a moment.';

/* The desk's own address. Named in the no-JavaScript notice and in the failure
   path, so neither tier tells a reader their report went nowhere without also
   telling them where it can go. */
const REPORTS_INBOX = 'admin@lionsofzion.io';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'sent'; publicId: string; receivedAt: string };

class ApiRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ApiRequestError';
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const problem =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error?: { code?: unknown } }).error
        : undefined;
    const code = typeof problem?.code === 'string' ? problem.code : 'UNKNOWN';
    throw new ApiRequestError(code);
  }
  return data as T;
}

export function ReportClaimForm() {
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterNote, setReporterNote] = useState('');
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [touched, setTouched] = useState(false);
  const urlRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const hasContent = Boolean(url.trim() || body.trim());
  const submitting = state.status === 'submitting';
  /* The guard covers two fields at once, so it is described by both of them
     rather than left to sit between them as a loose alert. */
  const guardTripped = touched && !hasContent;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!hasContent) {
      /* Announcing the message is not enough when it names neither of the
         four fields it means: move the caret to the first field that would
         satisfy it. */
      urlRef.current?.focus();
      return;
    }
    if (submitting) return;

    setState({ status: 'submitting' });
    const payload: Record<string, string> = {};
    if (url.trim()) payload.url = url.trim();
    if (body.trim()) payload.body = body.trim();
    if (reporterEmail.trim()) payload.reporterEmail = reporterEmail.trim();
    if (reporterNote.trim()) payload.reporterNote = reporterNote.trim();

    try {
      const receipt = await readResponse<{ publicId: string; status: string; receivedAt: string }>(
        await fetch('/api/v1/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      );
      setState({ status: 'sent', publicId: receipt.publicId, receivedAt: receipt.receivedAt });
    } catch (cause) {
      const code = cause instanceof ApiRequestError ? cause.code : 'NETWORK';
      setState({ status: 'error', message: FAILURE_COPY[code] ?? GENERIC_FAILURE });
    }
  };

  if (state.status === 'sent') {
    return (
      <div className={styles.receipt} {...politeLive}>
        <p>Report received — reference {state.publicId}.</p>
        <small>
          Submitted anonymously unless you gave an email. It will be reviewed by the desk; nothing
          you sent is published without that review.
        </small>
      </div>
    );
  }

  return (
    /*
      A11Y-007. Two different messages describe this form as a whole rather
      than any one field: the no-JavaScript notice (which is why the submit
      button is not there) and the send failure (which the API reports about
      the submission, not about a field). Both are referenced here so a reader
      inside the fields can reach them, while the per-field guard stays on the
      two fields it actually names. `aria-describedby` tolerates ids that are
      not in the document, so the failure id can be listed unconditionally —
      but it is listed conditionally anyway, because an empty reference is one
      more thing a future edit can get wrong.
    */
    <form
      className={styles.form}
      onSubmit={submit}
      aria-busy={submitting || undefined}
      aria-describedby={["report-noscript", state.status === 'error' ? "report-failure" : null].filter(Boolean).join(" ")}
    >
      {/*
        With scripting off this form has no submit path at all: there is no
        `action`, so the button performs a native GET to /support-us, the page
        reloads, and the reload reads as a successful send. Reporting success
        for something that was discarded is the "no false live state"
        principle inverted, so the button is removed in that tier rather than
        left to lie. A `<style>` inside `<noscript>` is the only way a
        prerendered page can change what it shows based on whether scripting
        ran. Pointing the form at `/api/v1/reports` was considered and is
        worse: `server/http/handler.ts` `parseBody` calls `request.json()`,
        so a native form POST renders a raw problem+json page.
        The address below is the owner's, given for this purpose on
        2026-08-27. It is deliberately the same one in both tiers: a reader
        without scripting gets a channel that works, and a reader with it gets
        a fallback if the desk is down. A `mailto:` is safe to offer here
        precisely because it needs no scripting to follow.
      */}
      <noscript>
        <style>{`.${styles.form} button[type='submit'] { display: none; }`}</style>
        <p id="report-noscript" className={styles.fieldError}>
          This form needs JavaScript to send a report. Nothing typed here can reach the desk with
          it turned off — email <a href={`mailto:${REPORTS_INBOX}`}>{REPORTS_INBOX}</a> instead,
          with the link and what you believe is wrong with it.
        </p>
      </noscript>

      <Field
        ref={urlRef}
        id="report-url"
        label="Link to the claim"
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://…"
        disabled={submitting}
        error={guardTripped ? "A report needs a link or a description." : undefined}
      />

      <Field
        id="report-body"
        label="Or describe it"
        multiline
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What did you see, and where?"
        disabled={submitting}
        error={guardTripped ? "A report needs a link or a description." : undefined}
      />

      <Field
        id="report-email"
        label="Email (optional)"
        type="email"
        value={reporterEmail}
        onChange={(event) => setReporterEmail(event.target.value)}
        placeholder="Only if you want a follow-up"
        disabled={submitting}
      />

      <Field
        id="report-note"
        label="Anything else the desk should know (optional)"
        multiline
        rows={2}
        value={reporterNote}
        onChange={(event) => setReporterNote(event.target.value)}
        disabled={submitting}
      />

      {state.status === 'error' ? (
        <p id="report-failure" className={styles.fieldError} {...assertiveLive}>
          {state.message}{' '}
          {/* STATE-003: the fields below still hold everything that was typed —
              nothing here clears them — and saying so is the difference
              between a reader pressing the button again and a reader assuming
              the report is gone and leaving. */}
          Nothing you typed was cleared; the button sends it again as it stands.
          {' '}
          {/* A failed send with no alternative leaves a reader who found a real
              error with nowhere to put it. */}
          You can also email <a href={`mailto:${REPORTS_INBOX}`}>{REPORTS_INBOX}</a>.
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={submitting}
        isLoading={submitting}
      >
        {submitting ? 'Sending…' : 'Send report'}
      </Button>
    </form>
  );
}
