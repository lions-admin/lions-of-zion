"use client";

/**
 * The two rows of a turn — the reader's question and the desk's answer.
 *
 * These are the two components this desk kept from the AI Elements registry;
 * everything else that lived here — branch selectors, toolbars, tooltips —
 * never had a caller. The two that survived were thin `div`s carrying
 * Tailwind classes that `ask.module.css` then had to fight property by
 * property (the `.transcript :global(.is-user)` override exists only because
 * a literal class inside a `cn()` string could not be reached otherwise).
 *
 * On 2026-09-17 (Midnight Signal, workstream F) the vendored Tailwind stack
 * was deleted and these wrappers became what they always were to this desk:
 * two divs whose alignment and plate the ask stylesheet owns outright. The
 * shape was decided there before; now nothing else has an opinion about it.
 * `from` stays a prop because it says whose row this is, and the desk's
 * contract (`Message from="user" | "assistant"`) is unchanged.
 *
 * There is deliberately no Markdown rendering here — see `AnswerRecord`.
 */
import type { HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export function Message({ from, className, ...props }: MessageProps) {
  return <div data-from={from} className={className} {...props} />;
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageContent({ className, ...props }: MessageContentProps) {
  return <div className={className} {...props} />;
}
