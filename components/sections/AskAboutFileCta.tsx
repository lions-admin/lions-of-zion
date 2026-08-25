'use client';

import { useChatOpen } from '@/components/chat/chat-open-context';
import { starterQuestions } from '@/components/chat/chat-context';
import styles from './sections.module.css';

/**
 * Opens the shared chat with this page's first starter question pre-filled
 * (never auto-sent — see `chat-open-context.tsx`). The only client boundary
 * this CTA introduces; `SectionPage` itself stays a Server Component.
 */
export function AskAboutFileCta({ href }: { href: string }) {
  const { openChat } = useChatOpen();
  const [firstStarter] = starterQuestions(href);

  return (
    <button type="button" className={styles.askCta} onClick={() => openChat(firstStarter)}>
      Ask the Lion about this file
    </button>
  );
}
