import { ChatOpenProvider, AskAboutFileCta } from 'lions-of-zion';

/**
 * The foot of every dossier page. It reads `useChatOpen()`, so it throws
 * outside `ChatOpenProvider` — the composition below is the only render of it
 * that is true.
 *
 * Clicking it pre-fills the chat composer with a question about this file. It
 * never sends automatically.
 *
 * Deliberately ONE export: the component's only prop is `href`, which changes
 * where the question points and nothing about how it looks. A second cell
 * differing only by href would render identically and say nothing.
 */
export function AtTheFootOfAFile() {
  return (
    <ChatOpenProvider>
      <AskAboutFileCta href="/war-update" />
    </ChatOpenProvider>
  );
}
