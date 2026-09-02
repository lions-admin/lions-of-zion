/**
 * Turning a flat transcript into records.
 *
 * Kept out of the component that renders it so the pairing rule can be tested
 * on its own — it is the one piece of logic on this surface that can be wrong
 * in a way nobody notices: an answer attached to the wrong question is a
 * misattribution, on a page whose whole subject is attribution.
 */

import type { ChatMessageView } from "@/server/contracts/chat";

export interface Exchange {
  key: string;
  question: string;
  answer: ChatMessageView | null;
}

/**
 * Pairs the transcript into exchanges.
 *
 * The transcript arrives ordered by the `seq` the database allocated, so a
 * question is always followed by its answer. Two shapes are handled anyway,
 * because neither is impossible: an unanswered question at the tail (a turn
 * whose answer failed after the question was persisted — the service writes
 * them in separate transactions), and an answer with no question before it.
 *
 * A `system` message belongs to neither side and is dropped rather than shown.
 * None is written today, and inventing a rendering for one that may arrive
 * later would be guessing at its meaning.
 */
export function toExchanges(messages: ChatMessageView[]): Exchange[] {
  const exchanges: Exchange[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      exchanges.push({ key: message.id, question: message.content, answer: null });
      continue;
    }
    if (message.role !== "assistant") continue;
    const open = exchanges.at(-1);
    if (open && !open.answer) open.answer = message;
    else exchanges.push({ key: message.id, question: "", answer: message });
  }
  return exchanges;
}
