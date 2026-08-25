import { ChatOpenProvider, AskTheLionChat } from 'lions-of-zion';

/**
 * The accessible chat modal: `aria-modal`, a focus trap, Escape to close, and
 * focus returned to whatever opened it.
 *
 * It reads `useChatOpen()`, so it throws outside `ChatOpenProvider` — the
 * provider is part of the preview because that composition is the only render
 * of it that is true.
 *
 * The panel is `position: fixed`, so this card is `cardMode: "single"`.
 *
 * On mount it probes the desk once with an anonymous `GET /api/v1/chat/threads`.
 * With no database provisioned that answers 500 and the panel opens in its
 * **offline** state — the correct behaviour rather than a failure, and the
 * state every visitor sees today.
 */
export function TheDesk() {
  return (
    <ChatOpenProvider>
      <AskTheLionChat onClose={() => {}} />
    </ChatOpenProvider>
  );
}
