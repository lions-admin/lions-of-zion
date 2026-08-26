import type { ReactNode } from 'react';
import styles from './content.module.css';

/**
 * Renders the light inline markup the research reports are written in.
 *
 * The packets' prose carries three constructs, and all of them are load-
 * bearing rather than decorative: `**bold**` marks the clause the researchers
 * consider the finding, `*italic*` marks the word a sentence turns on ("the
 * aggregators supply a *different* pipeline"), and `` `@handle` `` marks an
 * account so it reads as a handle rather than as a name. Rendering them is
 * what keeps the emphasis the researchers placed; stripping them would leave
 * a flatter sentence, and leaving the asterisks in would leak raw markup onto
 * the page.
 *
 * This is deliberately not a markdown parser. It handles exactly the three
 * constructs the imported text contains, and it works by splitting the string
 * into React nodes, so nothing ever reaches `dangerouslySetInnerHTML`.
 *
 * Order matters in the alternation: `**` must be tried before `*`, or the
 * bold delimiters match as two empty italics.
 */
const PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

export function ResearchText({ children }: { children: string }): ReactNode {
  const parts = children.split(PATTERN).filter((part) => part !== '');

  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 12)}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className={styles.handle}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}
