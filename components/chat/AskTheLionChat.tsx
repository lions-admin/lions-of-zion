'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ChatMessageView, Citation } from '@/server/contracts/chat';
import { starterQuestions } from './chat-context';
import styles from './ask-the-lion-chat.module.css';

const MAX_LENGTH = 10_000;
const COUNTER_THRESHOLD = 9_000;

/** Problem codes that mean the desk itself is unavailable, not this one turn. */
const OFFLINE_CODES = new Set(['INTERNAL_ERROR', 'UNAUTHENTICATED', 'NOT_IMPLEMENTED']);

const OFFLINE_NOTICE =
  'The verification desk is not connected yet. Answers will come from published, sourced material once it is.';

/** Friendly copy per retryable problem code. The raw server message never reaches the UI. */
const FAILURE_COPY: Record<string, string> = {
  VALIDATION_ERROR: 'That message could not be accepted as written. Adjust it and retry.',
  RATE_LIMITED: 'The desk is handling too many questions right now. Wait a moment, then retry.',
  NOT_FOUND: 'This conversation is no longer on file. Start a new thread and ask again.',
  CONFLICT: 'The desk could not record that message. Retry in a moment.',
  PRECONDITION_FAILED: 'The desk could not record that message. Retry in a moment.',
  FORBIDDEN: 'This question could not be taken from here.',
  NETWORK: 'The connection dropped before the desk answered. Check your network and retry.',
};

const GENERIC_FAILURE_COPY = 'The Lion could not answer right now. Retry in a moment.';

type DeskState = 'checking' | 'online' | 'offline';

type SendFailure = {
  code: string;
  requestId?: string;
};

type ChatUiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** ISO timestamp — the server's for answers, the client's for the user's turns. */
  createdAt: string;
  citations?: Citation[];
  /** Set on a user turn whose delivery failed with a retryable code. */
  failure?: SendFailure;
  /** Set on a user turn that could not be delivered because the desk is offline. */
  undelivered?: boolean;
};

/** Carries the problem `code` (and `requestId`) out of a failed response. */
class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly requestId?: string,
  ) {
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
        ? (data as { error?: { code?: unknown; requestId?: unknown } }).error
        : undefined;
    const code =
      typeof problem?.code === 'string'
        ? problem.code
        : response.status === 401
          ? 'UNAUTHENTICATED'
          : response.status >= 500
            ? 'INTERNAL_ERROR'
            : 'UNKNOWN';
    const requestId = typeof problem?.requestId === 'string' ? problem.requestId : undefined;
    throw new ApiRequestError(code, requestId);
  }
  return data as T;
}

function toFailure(cause: unknown): SendFailure {
  return cause instanceof ApiRequestError
    ? { code: cause.code, requestId: cause.requestId }
    : { code: 'NETWORK' };
}

function failureCopy(failure: SendFailure): { text: string; unexpected: boolean } {
  const text = FAILURE_COPY[failure.code];
  return text ? { text, unexpected: false } : { text: GENERIC_FAILURE_COPY, unexpected: true };
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface AskTheLionChatProps {
  onClose: () => void;
}

export function AskTheLionChat({ onClose }: AskTheLionChatProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef<string | null>(null);
  const probedRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [deskState, setDeskState] = useState<DeskState>('checking');
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const offline = deskState === 'offline';
  const starters = useMemo(() => starterQuestions(pathname), [pathname]);

  /* One capability probe per mount, decided once. GET /api/v1/chat/threads is
     an anonymous read: with a database it answers 200, unprovisioned it
     answers 500 INTERNAL_ERROR. The ref survives StrictMode's double effect,
     so the request fires exactly once. */
  useEffect(() => {
    if (probedRef.current) return;
    probedRef.current = true;
    (async () => {
      try {
        const response = await fetch('/api/v1/chat/threads');
        await readResponse(response); // throws ApiRequestError with the problem code when not ok
        setDeskState('online');
      } catch (cause) {
        /* A desk-unavailable code — or an unparseable 5xx — opens offline. A
           transient network drop stays online so per-turn retry handles it. */
        setDeskState(OFFLINE_CODES.has(toFailure(cause).code) ? 'offline' : 'online');
      }
    })();
  }, []);

  /* Move focus into the dialog on open. A coarse pointer means focusing the
     textarea would raise the on-screen keyboard over the transcript, so the
     panel itself takes focus there instead. */
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      panelRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  }, []);

  /* Disabling the focused textarea when the desk goes offline drops focus to
     the body, outside the trap — catch it on the panel. */
  useEffect(() => {
    if (!offline) return;
    if (document.activeElement === document.body || document.activeElement === null) {
      panelRef.current?.focus();
    }
  }, [offline]);

  /* Keep the newest turn in view. `nearest` scrolls the transcript without
     also scrolling the document behind the fixed panel. */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }, [messages, sending]);

  /* Auto-grow up to the stylesheet's max-height, which clips and scrolls. */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const deliver = useCallback(
    async (content: string, retryId?: string) => {
      if (!content || sending || offline) return;

      const userId = retryId ?? crypto.randomUUID();
      if (retryId) {
        setMessages((current) =>
          current.map((message) =>
            message.id === retryId
              ? { ...message, failure: undefined, undelivered: undefined }
              : message,
          ),
        );
      } else {
        setMessages((current) => [
          ...current,
          { id: userId, role: 'user', content, createdAt: new Date().toISOString() },
        ]);
      }
      setSending(true);

      try {
        if (!threadIdRef.current) {
          const thread = await readResponse<{ id: string }>(
            await fetch('/api/v1/chat/threads', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-actor-label': 'public-site-visitor',
              },
              body: JSON.stringify({ title: content.slice(0, 120) }),
            }),
          );
          threadIdRef.current = thread.id;
        }

        const answer = await readResponse<ChatMessageView>(
          await fetch(`/api/v1/chat/threads/${threadIdRef.current}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-actor-label': 'public-site-visitor',
            },
            body: JSON.stringify({ content }),
          }),
        );

        setMessages((current) => [
          ...current,
          {
            id: answer.id,
            role: 'assistant',
            content: answer.content,
            citations: answer.citations,
            createdAt: answer.createdAt,
          },
        ]);
      } catch (cause) {
        const failure = toFailure(cause);
        if (OFFLINE_CODES.has(failure.code)) {
          /* The desk itself is unavailable. Say so once, plainly — no retry loop. */
          setDeskState('offline');
          setMessages((current) =>
            current.map((message) =>
              message.id === userId ? { ...message, undelivered: true } : message,
            ),
          );
        } else {
          setMessages((current) =>
            current.map((message) =>
              message.id === userId ? { ...message, failure } : message,
            ),
          );
        }
      } finally {
        setSending(false);
      }
    },
    [sending, offline],
  );

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || offline) return;
    setDraft('');
    void deliver(content);
  };

  const askStarter = (question: string) => {
    if (sending || offline) return;
    setDraft('');
    void deliver(question);
  };

  const startNewThread = () => {
    threadIdRef.current = null;
    setMessages([]);
    setExpandedCitation(null);
    setCopiedId(null);
  };

  const copyAnswer = async (message: ChatUiMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* Clipboard unavailable (permissions, insecure context) — do nothing. */
    }
  };

  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /* One polite live region announces only the newest development — the latest
     answer or failure — instead of re-reading the whole transcript. */
  const lastMessage = messages[messages.length - 1];
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const announcement = offline
    ? OFFLINE_NOTICE
    : lastMessage?.failure
      ? failureCopy(lastMessage.failure).text
      : lastAssistant
        ? `The Lion: ${lastAssistant.content}`
        : '';

  return (
    <section
      ref={panelRef}
      id="ask-the-lion-chat"
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-the-lion-title"
      tabIndex={-1}
      onKeyDown={trapFocus}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AI intelligence desk</p>
          <h2 id="ask-the-lion-title">Ask the Lion</h2>
        </div>
        <div className={styles.headerActions}>
          {messages.length > 0 ? (
            <button
              className={styles.newThread}
              type="button"
              onClick={startNewThread}
              disabled={sending}
            >
              New thread
            </button>
          ) : null}
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close chat">
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.messages} aria-busy={sending}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <span className={styles.signal} aria-hidden="true" />
            <p>What would you like to verify?</p>
            <small>Ask about a claim, narrative, source, or current information campaign.</small>
            {!offline ? (
              <div className={styles.starters}>
                {starters.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className={styles.starter}
                    onClick={() => askStarter(question)}
                    disabled={sending}
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message) => {
            const failure = message.failure ? failureCopy(message.failure) : null;
            const time = formatTime(message.createdAt);
            const citations = message.citations ?? [];
            const expandedIndex = citations.findIndex(
              (_, index) => expandedCitation === `${message.id}:${index}`,
            );
            return (
              <article key={message.id} className={styles.message} data-role={message.role}>
                <span className={styles.messageMeta}>
                  <span>{message.role === 'assistant' ? 'Lion' : 'You'}</span>
                  {time ? (
                    <time className={styles.timestamp} dateTime={message.createdAt}>
                      {time}
                    </time>
                  ) : null}
                  {message.role === 'assistant' ? (
                    <button
                      type="button"
                      className={styles.copy}
                      data-copied={copiedId === message.id ? '' : undefined}
                      onClick={() => void copyAnswer(message)}
                    >
                      {copiedId === message.id ? 'Copied' : 'Copy'}
                    </button>
                  ) : null}
                </span>
                <p>{message.content}</p>
                {citations.length > 0 ? (
                  <div className={styles.citations}>
                    <span className={styles.citationRow}>
                      {citations.map((citation, index) => {
                        const key = `${message.id}:${index}`;
                        const expanded = expandedCitation === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={styles.citationChip}
                            title={citation.quote ?? 'Cited source document'}
                            aria-expanded={expanded}
                            aria-label={`Citation ${index + 1}`}
                            onClick={() => setExpandedCitation(expanded ? null : key)}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </span>
                    {expandedIndex >= 0 ? (
                      <blockquote className={styles.citationQuote}>
                        {citations[expandedIndex].quote ??
                          'The cited document did not include a quotable excerpt.'}
                      </blockquote>
                    ) : null}
                  </div>
                ) : null}
                {message.undelivered ? (
                  <span className={styles.undelivered}>Not sent</span>
                ) : null}
                {failure ? (
                  <div className={styles.messageError}>
                    <p>{failure.text}</p>
                    {failure.unexpected && message.failure?.requestId ? (
                      <p className={styles.requestId}>Request {message.failure.requestId}</p>
                    ) : null}
                    <button
                      type="button"
                      className={styles.retry}
                      onClick={() => void deliver(message.content, message.id)}
                      disabled={sending}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}

        {sending ? (
          <div className={styles.thinking} aria-label="The Lion is thinking">
            <i />
            <i />
            <i />
          </div>
        ) : null}

        {offline ? (
          <div className={styles.offline} role="note">
            <p>{OFFLINE_NOTICE}</p>
          </div>
        ) : null}

        <div ref={endRef} aria-hidden="true" />
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>

      <form className={styles.composer} onSubmit={sendMessage}>
        <label htmlFor="ask-the-lion-input">Your question</label>
        {draft.length >= COUNTER_THRESHOLD ? (
          <span className={styles.counter} aria-live="polite">
            {draft.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
          </span>
        ) : null}
        <textarea
          ref={textareaRef}
          id="ask-the-lion-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={offline ? 'The desk is offline for now' : 'Ask the Lion…'}
          rows={1}
          maxLength={MAX_LENGTH}
          disabled={offline}
        />
        <button type="submit" disabled={offline || !draft.trim() || sending} aria-label="Send message">
          <span aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
