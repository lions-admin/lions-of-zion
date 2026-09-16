"use client";

/**
 * The transcript scroller, and the one button that returns to its live edge.
 *
 * Trimmed on 2026-09-17 (Midnight Signal, workstream F) to the four pieces
 * the ask desk actually uses — the stick-to-bottom scroller, its content
 * column, the empty state and the scroll button. What was deleted was never
 * mounted here: `ConversationDownload` and `messagesToMarkdown` offered the
 * transcript as a Markdown file, which this desk refuses on the same grounds
 * `AnswerRecord` refuses to render one, and nothing else in the file had a
 * caller at all.
 *
 * The scroller is `use-stick-to-bottom`, kept deliberately: it anchors the
 * transcript on its live edge, releases when the reader scrolls away, and
 * hands the button its state — without this component owning a scroll ref or
 * reading the motion preference by hand. `role="log"` on the scroller root
 * is the conversation's live region: an arriving answer is announced by the
 * region that contains it, and nothing else in the desk builds a second
 * sentence about the same event.
 */
import type { ComponentProps, HTMLAttributes } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export function Conversation({ className, ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={className}
      initial="smooth"
      resize="smooth"
      role="log"
      aria-relevant="additions"
      {...props}
    />
  );
}

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export function ConversationContent({ className, ...props }: ConversationContentProps) {
  return <StickToBottom.Content className={className} {...props} />;
}

export type ConversationEmptyStateProps = HTMLAttributes<HTMLDivElement>;

export function ConversationEmptyState({ className, ...props }: ConversationEmptyStateProps) {
  return <div className={className} {...props} />;
}

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export function ConversationScrollButton({ className, ...props }: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className={className}
      iconOnly
      aria-label="Scroll to the latest"
      onClick={handleScrollToBottom}
      type="button"
      variant="secondary"
      {...props}
    >
      <Icon name="arrow-down" size={16} />
    </Button>
  );
}
