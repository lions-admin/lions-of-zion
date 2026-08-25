import { GeopoliticalBrief } from 'lions-of-zion';

/**
 * The one page in the system with its own layout: a left rail carrying the
 * evidence contract and depth of read, and a centred reading measure beside it.
 * Its content is the static reference cut in `geopolitical-reference.ts`, so
 * this renders the real brief rather than a mock of one.
 *
 * It is a full page rather than a part — previewed at full card width.
 */
export function ReferenceBrief001() {
  return <GeopoliticalBrief />;
}
