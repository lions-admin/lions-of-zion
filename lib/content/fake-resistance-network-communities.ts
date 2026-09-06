/**
 * Which entity sits in which community.
 *
 * ## What changed, and why this file shrank
 *
 * This used to be a hand-written table of 28 entity ids mapped to seven
 * communities, derived by a person from `G1`–`G7` tags in the roster's prose
 * notes. It existed for one reason, stated in its own docstring: *the research
 * package does not carry the join.*
 *
 * It carries it now. The Phase-2c rebuild replaced the seven hand-asserted
 * communities with a Louvain partition computed over the merged cross-case
 * graph — 188 nodes, 595 edges, five communities — and the packet ships every
 * community's full membership as handles. So the mapping is read from the
 * data instead of maintained beside it, and the drawing changes when the
 * research does rather than when someone remembers to edit this file.
 *
 * The join key is the **handle**, lowercased. That is the packet's own key for
 * a computed node, and the roster carries handles for 212 of its 213 entries.
 * It is not `platform_user_id`, which the research uses for identity across
 * cases, because the analysis outputs are keyed on handle; and it is not the
 * display name, which is prose.
 *
 * ## What survives from the old table
 *
 * `UNGROUPED`. Some entities are deliberately not in any community, and the
 * research says why — the desk that did the observing is not a participant in
 * what it observed. Those are role words a person wrote, not a computation, so
 * they stay here where a reviewer can see them in a diff.
 */
import type { CaseEntity, NetworkCommunity } from './fake-resistance-cases';

/**
 * Entities that carry no handle and therefore cannot be placed by the
 * computed partition, each with the reason it is not a member of anything.
 *
 * A figure that quietly filed these into a community would be asserting
 * something the research did not.
 */
export const UNGROUPED: Record<string, { role: string; why: string }> = {
  ent_desk: {
    role: 'Observer',
    why: 'The research desk itself. It observes the network; it is not in it.',
  },
};

/** A community id as the computed partition writes it — `0` … `4`. */
export type CommunityId = number;

/**
 * Handle → community, built once from the payload the importer wrote.
 *
 * Callers pass the communities they are already rendering, so there is no
 * second copy of the membership anywhere in the app.
 */
export function communityIndex(communities: NetworkCommunity[]): Map<string, CommunityId> {
  const index = new Map<string, CommunityId>();
  for (const community of communities) {
    for (const handle of community.members) index.set(handle.toLowerCase(), community.id);
  }
  return index;
}

/** The community an entity belongs to, or `undefined` if it is not placed. */
export function communityOf(
  entity: Pick<CaseEntity, 'handle'>,
  index: Map<string, CommunityId>,
): CommunityId | undefined {
  return entity.handle ? index.get(entity.handle.toLowerCase()) : undefined;
}

/** The research's stated role for an entity that sits in no community. */
export function ungroupedRole(entityId: string): string | undefined {
  return UNGROUPED[entityId]?.role;
}
