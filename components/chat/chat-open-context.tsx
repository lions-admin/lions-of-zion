'use client';

/**
 * Shared chat-open state.
 *
 * `ParticleChatLauncher` and anything that wants to open the chat from a
 * different subtree (a section page's "Ask the Lion about this file" CTA)
 * are siblings under `<body>` with nothing between them until this provider.
 * Mounted once in `app/layout.tsx`, wrapping both.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ChatOpenState = {
  open: boolean;
  /** Pre-fills the composer on the next mount; never auto-sent. */
  initialQuestion: string | null;
};

type ChatOpenContextValue = {
  state: ChatOpenState;
  openChat: (starterQuestion?: string) => void;
  closeChat: () => void;
};

const ChatOpenContext = createContext<ChatOpenContextValue | null>(null);

export function ChatOpenProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChatOpenState>({ open: false, initialQuestion: null });

  const openChat = useCallback((starterQuestion?: string) => {
    setState({ open: true, initialQuestion: starterQuestion ?? null });
  }, []);

  const closeChat = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const value = useMemo(() => ({ state, openChat, closeChat }), [state, openChat, closeChat]);

  return <ChatOpenContext.Provider value={value}>{children}</ChatOpenContext.Provider>;
}

export function useChatOpen(): ChatOpenContextValue {
  const context = useContext(ChatOpenContext);
  if (!context) throw new Error('useChatOpen must be used within a ChatOpenProvider');
  return context;
}
