"use client";

/**
 * Where the conversation id lives: this browser, and nowhere else.
 *
 * A one-key store rather than a `useState` for three reasons, and the first is
 * the one that matters:
 *
 *   * **It is readable during render without a hydration mismatch.** Whether a
 *     stored conversation exists changes what the desk renders on its first
 *     paint, and the server cannot know the answer. `useSyncExternalStore` is
 *     the API built for exactly that: the server snapshot is `null`, the
 *     client's is the real value, and React reconciles the difference itself
 *     instead of warning about it. The alternative — set it in an effect — is
 *     a cascading render and is what `react-hooks/set-state-in-effect` exists
 *     to stop.
 *   * A second tab that starts or clears a conversation should not leave this
 *     one pointing at the wrong thread, and the `storage` event says when that
 *     happened.
 *   * Storage can throw outright (private mode, site data blocked). One place
 *     to swallow that, rather than a try/catch at every call site.
 *
 * `GET /api/v1/chat/threads` is deliberately not part of this: it lists every
 * anonymous thread, filtered only by an RLS policy that treats an HMAC of the
 * caller's IP as identity, so it would show a reader the questions of everyone
 * else behind the same router. The id lives here so that endpoint is never
 * needed.
 */

const KEY = "loz.ask.thread";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToThread(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readThread(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    /* A conversation that cannot be remembered still works while the tab is
       open — `useAskThread` keeps the live id in a ref regardless. */
    return null;
  }
}

/** The server has no browser storage, and must not pretend otherwise. */
export function readThreadOnServer(): null {
  return null;
}

export function writeThread(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* Ignored, as above. */
  }
  notify();
}
