import { createHash } from 'node:crypto';
/** An edited static record can keep its publication date; excerpts cannot. */
export function homepageContentRevision(record:unknown):string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
