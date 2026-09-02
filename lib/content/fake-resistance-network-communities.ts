/**
 * Which entity sits in which community — the join the research package does
 * not carry.
 *
 * `network.json` describes its seven communities with `communities[].nodes`,
 * and those strings are informal display labels written for a human reading a
 * report: `"Hinkle"`, `"Loupis__"`, `"Gage (schismatic)"`, `"IRGC personas"`.
 * Exactly **one** of the 32 of them is string-equal to a `roster[].name`, so
 * the two halves of the package cannot be joined mechanically, and any figure
 * that groups entities by community needs this table to exist.
 *
 * ## Where the assignments come from
 *
 * Not from guesswork against the labels. Every `roster[]` entry except four
 * carries a `note` whose first token is the research's own group tag — `G1`
 * through `G7`, matching `communities[].number` 1–7 in order. That tag is the
 * package's own machine-readable membership; this table is that derivation,
 * written out once, by hand, so it is reviewable in a diff rather than parsed
 * out of a free-text field at render time. A `note` is prose and the editorial
 * layer's whole job is to stop prose deciding what renders.
 *
 * ## Why it lives here and not beside `network.json`
 *
 * `scripts/import-research-cases.mjs` owns `content-packages/fake-resistance/`
 * and rewrites it wholesale. A judgment call parked in that directory is a
 * judgment call waiting to be reverted by the next import — which is the
 * reason `fake-resistance-editorial.ts` exists at all, and the same reason
 * applies here. This module is a sibling of it rather than part of it only
 * because it is a lookup table with no policy in it.
 *
 * ## What this table deliberately does *not* do
 *
 * It does not resolve the seven community labels that name an entity the
 * roster has no row for; those are recorded in `UNRESOLVED_LABELS` and stay
 * unresolved. Inventing an id for `"Grayzone"` or `"IRGC personas"` would put
 * an entity on a drawing that the research never entered into its own roster.
 */

/** A community number as `network.json` writes it — `"1"` … `"7"`. */
export type CommunityNumber = string;

/**
 * Entity id → community number, derived from each roster entry's own `G*`
 * note tag. Order follows the roster so a reviewer can read the two side by
 * side.
 */
const MEMBERSHIP: Record<string, CommunityNumber> = {
  // 1 · Hinkle production cell
  ent_hinkle: '1', // note: "G1 ORIGINATOR"
  ent_gulag: '1', // note: "G1 CLIPPER"
  ent_acp: '1', // note: "G1 party brand"

  // 2 · Fuentes-adjacent far right
  ent_fuentes: '2', // note: "G2 Detroit node"
  ent_shields: '2', // note: "G2"
  ent_parker: '2', // note: "G2 Detroit"
  ent_loupis: '2', // note: "G2 pivot persona"
  ent_gage: '2', // note: "G2 schismatic"
  ent_woodsyoutube: '2', // note: "G2" — see DISCREPANCIES below

  // 3 · Muslim personal-brand lane
  ent_sulaiman: '3', // note: "G3 ORIGINATOR-amplifier"
  ent_jvnior: '3', // note: "G3 personality"

  // 4 · Feeder aggregators
  ent_quds: '4', // note: "G4 aggregator"
  ent_tog: '4', // note: "G4 aggregator"
  ent_xie: '4', // note: "G4 archive project"
  ent_abujomaa: '4', // note: "G4 on-scene journalist" — see DISCREPANCIES
  ent_clashreport: '4', // note: "G4-expansion Iran-war wire"

  // 5 · Anti-empire journalists
  ent_blumenthal: '5', // note: "G5"
  ent_mate: '5', // note: "G5 corridor->platform bridge"
  ent_finkelstein: '5', // note: "G5 CLIPPED by Gulag"

  // 6 · Mega talk shows
  ent_candace: '6', // note: "G6 mega ideological"
  ent_nawfal: '6', // note: "G6 PLATFORM factory"
  ent_davesmith: '6', // note: "G6 libertarian"
  ent_judgenap: '6', // note: "G6 guest platform"

  // 7 · State / covert press
  ent_prestv: '7', // note: "G7 overt state"
  ent_mayadeen: '7', // note: "G7 aligned family"
  ent_marandi: '7', // note: "G7 frequent guest"
  ent_gbc: '7', // note: "G7 COORD_PERSONA 2026"
};

/**
 * The four roster entries that carry no group tag, each with the research's
 * own reason. These are not oversights in the package — three of them are
 * explicitly *not* members of a community, and a figure that quietly filed
 * them into one would be asserting something the research did not.
 */
export const UNGROUPED: Record<string, { role: string; why: string }> = {
  ent_desk: {
    role: 'Observer',
    why: 'The research desk itself. It observes the network; it is not in it.',
  },
  ent_sneako: {
    role: 'Bridge',
    why: 'Tagged "BRIDGE 01-02-03" — the research places this account across communities 1, 2 and 3 rather than inside any one of them.',
  },
  ent_kasparian: {
    role: 'Clipped subject',
    why: 'Tagged "clipped subject" — carried because material of hers was reused, not because the research placed her in the network.',
  },
  ent_yakoby_ref: {
    role: 'Stub endpoint',
    why: 'Tagged "Stub endpoint" — added so one recorded edge has a target. It is a reference point, not a mapped participant.',
  },
};

/**
 * Community labels that name an entity the roster has no row for. They are
 * counted in the report's community sizes and cannot be counted in any
 * drawing built from the entity data, which is a gap worth stating rather
 * than smoothing over: the prose describes a larger ecosystem than the
 * machine-readable roster covers.
 */
export const UNRESOLVED_LABELS: ReadonlyArray<{
  community: CommunityNumber;
  label: string;
}> = [
  { community: '3', label: 'Truthteller' },
  { community: '4', label: 'EoP' },
  { community: '5', label: 'Grayzone' },
  { community: '5', label: 'Medhurst' },
  { community: '5', label: 'Norton' },
  { community: '5', label: 'DropSite' },
  { community: '7', label: 'IRGC personas' },
];

/**
 * Where the entity notes and the community label lists disagree. Both are the
 * research's own, both are kept, and neither is edited to match the other.
 *
 * In each case the entity's `note` places it in a community whose label list
 * omits it. The note is treated as authoritative for grouping because it is a
 * field on the entity, while the label list is a summary written for a reader
 * — but the disagreement is recorded because it means the report's own
 * community sizes and this table's do not match.
 */
export const DISCREPANCIES: ReadonlyArray<{ id: string; community: CommunityNumber; note: string }> =
  [
    {
      id: 'ent_woodsyoutube',
      community: '2',
      note: 'Keith Woods is tagged G2 but is absent from community 2’s label list.',
    },
    {
      id: 'ent_abujomaa',
      community: '4',
      note: 'Motasem Dalloul is tagged G4 but is absent from community 4’s label list, which carries "EoP" instead.',
    },
  ];

/** The community an entity belongs to, or `undefined` if it is ungrouped. */
export function communityOf(entityId: string): CommunityNumber | undefined {
  return MEMBERSHIP[entityId];
}

/** The research's stated role for an entity that sits in no community. */
export function ungroupedRole(entityId: string): string | undefined {
  return UNGROUPED[entityId]?.role;
}

/** Every entity id this table places, for the coverage assertion in tests. */
export const MAPPED_IDS: readonly string[] = Object.keys(MEMBERSHIP);

/** Every entity id this table deliberately leaves out of a community. */
export const UNGROUPED_IDS: readonly string[] = Object.keys(UNGROUPED);
