'use client';

/**
 * The public, unauthenticated "report a claim for review" form — wired to
 * `POST /api/v1/reports` (`app/api/v1/reports/route.ts`), the only write
 * path in the system open to a stranger. The endpoint returns a minimal
 * receipt and never echoes submitted content back, so this form doesn't
 * either. Same problem+json parsing pattern as `AskTheLionChat.tsx`, kept
 * local rather than shared since it's a small, self-contained piece.
 */
import { FormEvent, useState } from 'react';
import styles from './support.module.css';

const FAILURE_COPY: Record<string, string> = {
  VALIDATION_ERROR: 'That report could not be accepted as written. Check the fields and retry.',
  RATE_LIMITED: 'Too many reports submitted from here recently. Wait a moment, then retry.',
};
const GENERIC_FAILURE = 'The report could not be sent right now. Retry in a moment.';

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

  const hasContent = Boolean(url.trim() || body.trim());
  const submitting = state.status === 'submitting';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!hasContent || submitting) return;

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
      <div className={styles.receipt} role="status">
        <p>Report received — reference {state.publicId}.</p>
        <small>
          Submitted anonymously unless you gave an email. It will be reviewed by the desk; nothing
          you sent is published without that review.
        </small>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="report-url">Link to the claim</label>
        <input
          id="report-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          disabled={submitting}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="report-body">Or describe it</label>
        <textarea
          id="report-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="What did you see, and where?"
          disabled={submitting}
        />
      </div>

      {touched && !hasContent ? (
        <p className={styles.fieldError}>A report needs a link or a description.</p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="report-email">Email (optional)</label>
        <input
          id="report-email"
          type="email"
          value={reporterEmail}
          onChange={(event) => setReporterEmail(event.target.value)}
          placeholder="Only if you want a follow-up"
          disabled={submitting}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="report-note">Anything else the desk should know (optional)</label>
        <textarea
          id="report-note"
          value={reporterNote}
          onChange={(event) => setReporterNote(event.target.value)}
          rows={2}
          disabled={submitting}
        />
      </div>

      {state.status === 'error' ? <p className={styles.fieldError}>{state.message}</p> : null}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}
