'use client';

import { FormEvent, useRef, useState } from 'react';
import styles from './ask-the-lion-chat.module.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ApiProblem = {
  error?: {
    message?: string;
  };
};

interface AskTheLionChatProps {
  onClose: () => void;
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & ApiProblem;
  if (!response.ok) {
    throw new Error(data.error?.message ?? 'The Lion could not answer right now.');
  }
  return data;
}

export function AskTheLionChat({ onClose }: AskTheLionChatProps) {
  const threadIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setError(null);
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

      const answer = await readResponse<{ id: string; role: 'assistant'; content: string }>(
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
        { id: answer.id, role: 'assistant', content: answer.content },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Lion could not answer right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="ask-the-lion-chat"
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ask-the-lion-title"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AI intelligence desk</p>
          <h2 id="ask-the-lion-title">Ask the Lion</h2>
        </div>
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close chat">
          <span aria-hidden="true" />
        </button>
      </header>

      <div className={styles.messages} aria-live="polite" aria-busy={sending}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <span className={styles.signal} aria-hidden="true" />
            <p>What would you like to verify?</p>
            <small>Ask about a claim, narrative, source, or current information campaign.</small>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={styles.message} data-role={message.role}>
              <span>{message.role === 'assistant' ? 'Lion' : 'You'}</span>
              <p>{message.content}</p>
            </article>
          ))
        )}

        {sending ? (
          <div className={styles.thinking} aria-label="The Lion is thinking">
            <i />
            <i />
            <i />
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      <form className={styles.composer} onSubmit={sendMessage}>
        <label htmlFor="ask-the-lion-input">Your question</label>
        <textarea
          id="ask-the-lion-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask the Lion…"
          rows={1}
          maxLength={10_000}
          autoFocus
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
          <span aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
