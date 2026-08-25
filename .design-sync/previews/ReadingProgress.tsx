import { ReadingProgress } from 'lions-of-zion';

/**
 * Depth of read. It measures the nearest `[data-reading-scroll]` container and
 * scales a 2px gradient line pinned to the top of the viewport — blue at the
 * start of the document, gold at the end.
 *
 * Two things make it easy to preview wrongly, both learned the hard way:
 * without a `[data-reading-scroll]` ancestor the effect returns early and the
 * bar stays at `scaleX(0)` — invisible, and indistinguishable from broken. And
 * because the default track is `position: fixed`, this card is
 * `cardMode: "single"`.
 *
 * A container with nothing to scroll reports progress `1`, so the line below
 * is at full extent: the honest still image of a document read to the end.
 */
export function Track() {
  return (
    <div data-reading-scroll style={{ position: 'relative', minHeight: '5rem' }}>
      <ReadingProgress />
      <p style={{ margin: 0, paddingTop: '1.25rem' }}>
        The line above spans the top of the viewport. It is blue where the reader
        started and gold where the file ends.
      </p>
    </div>
  );
}
