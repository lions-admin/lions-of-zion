import { SectionToc } from 'lions-of-zion';

/**
 * The "In this file" rail. It builds itself by scanning the rendered `h2`s and
 * cannot drift from the document, because there is no per-page list to keep in
 * sync.
 *
 * It needs **two** hooks in the page around it, and renders nothing without
 * both: a `[data-reading-scroll]` scroll container (it measures depth of read
 * against that element) and a `[data-toc-source]` region (which scopes the
 * heading scan to the page body, so a heading inside the chat modal can never
 * appear in the contents). It also needs at least two headings — a contents
 * list of one entry is noise, not navigation.
 *
 * The composition below is therefore the only render of it that is true.
 */
export function BuiltFromTheHeadings() {
  return (
    <div
      data-reading-scroll
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(10rem, 14rem) minmax(0, 1fr)',
        gap: '2.5rem',
        maxHeight: '30rem',
        overflowY: 'auto',
      }}
    >
      <SectionToc />
      <div data-toc-source>
        <h2 id="snapshot">Snapshot</h2>
        <p>What is established, in one paragraph, before any judgment is offered.</p>
        <h2 id="what-changed">What changed</h2>
        <p>Only the movement since the last edition — not a restatement of the file.</p>
        <h2 id="assessment">Assessment</h2>
        <p>The judgment, kept deliberately separate from the reporting above it.</p>
        <h2 id="known-unknowns">Known unknowns</h2>
        <p>What is not established, and what would change the assessment.</p>
        <h2 id="sources">Source stack</h2>
        <p>Every source the file rests on, numbered and dated.</p>
      </div>
    </div>
  );
}
