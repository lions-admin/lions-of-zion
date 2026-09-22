import { ResearchText } from '@/components/content';
import { parseResearchProse, type ProseBlock } from './research-prose';
import styles from './research.module.css';

/**
 * Research prose, with the block structure the importer flattened.
 *
 * The packets' paragraphs carry lists inside them. Rendering each string
 * through a `<p>` put the markers on the page as literal text — "a double
 * refutation: 1. Against the 'monolithic conspiracy' model: … 2. Against the
 * 'overlapping bot fabric' model: …" set as one running paragraph, and a
 * bulleted run set as "tight, empirical coupling: - Jackson Hinkle and
 * @WelcomeTheGulag function as an int…". That is the "unedited text" a reader
 * sees, and it is also a reading problem: three findings inside one paragraph
 * are three findings nobody can scan.
 *
 * `research-prose.ts` recovers the structure; this renders it. Inline markup
 * still goes through `ResearchText`, so the emphasis the researchers placed
 * survives inside a list item exactly as it does inside a paragraph.
 */
export function ResearchProse({ blocks }: { blocks: ProseBlock[] }) {
  return (
    <>
      {blocks.map((block, i) =>
        block.kind === 'para' ? (
          <p key={`p-${i}-${block.text.slice(0, 24)}`} className={styles.prose}>
            <ResearchText>{block.text}</ResearchText>
          </p>
        ) : (
          <ProseList key={`l-${i}-${block.items[0].slice(0, 24)}`} block={block} />
        ),
      )}
    </>
  );
}

/** The same, from the raw paragraph strings a packet field carries. */
export function ResearchParagraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return <ResearchProse blocks={parseResearchProse(paragraphs)} />;
}

function ProseList({ block }: { block: Extract<ProseBlock, { kind: 'list' }> }) {
  const List = block.ordered ? 'ol' : 'ul';
  return (
    <>
      {block.lead ? (
        <p className={styles.proseLead}>
          <ResearchText>{block.lead}</ResearchText>
        </p>
      ) : null}
      <List className={block.ordered ? styles.proseOrdered : styles.proseBulleted}>
        {block.items.map((item) => (
          <li key={item.slice(0, 40)}>
            <ResearchText>{item}</ResearchText>
          </li>
        ))}
      </List>
    </>
  );
}
