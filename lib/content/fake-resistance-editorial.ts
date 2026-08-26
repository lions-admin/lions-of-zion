/**
 * The editorial pass, as data.
 *
 * `scripts/import-research-cases.mjs` is mechanical and re-runnable: it takes
 * what the packets say. This module is the layer of human judgment on top of
 * that — which technique a finding documents, which findings do not clear the
 * naming policy, and how each case is framed. Keeping the two apart is what
 * lets the research be re-imported without re-litigating a single editorial
 * decision.
 *
 * The governing decisions are in `.ai/DECISIONS.md` (2026-08-26):
 *
 * **The naming policy.** A living person is tied to an allegation only where
 * the packet grades the claim `verified` at high confidence *and* the same
 * conduct is already covered by mainstream reporting in that case's own
 * sources. Otherwise the page carries role labels and handles. `SUPPRESSED`
 * below is where that policy actually bites, with the reason recorded per
 * finding rather than as a silent deletion.
 *
 * **The frame.** The section presents these actors through how they
 * manipulate. `TECHNIQUES` maps a finding to the playbook chapter it
 * documents — and a tag is only correct if the finding's own wording
 * establishes it. Several findings that "feel" like a technique carry no tag
 * because the sentence does not support one; that restraint is the point,
 * and it is why six of the nine chapters shipped with no examples at all
 * until this pass.
 */
import { isTechniqueId } from './fake-resistance-playbook';

/**
 * Findings that document a manipulation technique, keyed by case slug then by
 * the research's own claim id.
 *
 * What is deliberately *not* tagged is as considered as what is:
 *
 * - Disconfirming findings (the mega-accounts relayed nothing; the corridor
 *   does not coordinate with the influencers) document no technique. They are
 *   the reason the rest is credible and they are not evidence of a move.
 * - Protected-category findings — the on-scene Gaza reporter, the
 *   document-based analyst, the evidence-preservation archive — are never
 *   tagged. The research classified them deliberately and this pass does not
 *   quietly reclassify them.
 * - Identity facts carry no tag on their own. That a commentator holds a real
 *   medical degree is a fact; it becomes authority laundering only if a
 *   finding documents the credential being used to carry a claim, and none
 *   here does.
 * - The research correcting its own earlier draft is not a subject's move.
 */
const TECHNIQUES: Record<string, Record<string, string[]>> = {
  'hinkle-machine': {
    claim_01: ['synchronized-amplification'],
    claim_03: ['identity-games'],
    claim_04: ['verdict-before-evidence'],
    claim_06: ['circular-sourcing'],
    claim_07: ['synchronized-amplification'],
    claim_09: ['identity-games'],
    claim_12: ['circular-sourcing'],
    claim_13: ['verdict-captioning'],
  },
  'manosphere-far-right': {
    claim_01_pivot_loupis: ['arousal-monetization'],
    claim_02_pivot_shields: ['arousal-monetization'],
    claim_05_gage_rename: ['identity-games'],
    claim_07_shields_hoax_amplify: ['verdict-before-evidence'],
    claim_11_kirk_israel_claims: ['verdict-before-evidence'],
    claim_13_loupis_main_active: ['identity-games'],
    claim_14_lookalikes_inactive: ['identity-games'],
  },
  'muslim-palestinian-influencers': {
    claim_01_sul_amplifier: ['manufactured-urgency'],
    claim_03_jvnior_gambling: ['arousal-monetization'],
    claim_04_jvniortrades_separate: ['identity-games'],
    claim_06_kirk_liability_in_lane: ['verdict-before-evidence'],
    claim_09_shared_upstream_landis: ['authority-laundering'],
    claim_11_sulaiman_adl_record: ['verdict-before-evidence'],
  },
  'aggregators-feeders': {
    claim_03_goyim_recycled: ['recycled-media'],
    claim_08_backup_architecture: ['identity-games'],
  },
  'grayzone-anti-empire': {
    claim_01_asymmetric_intersection: ['authority-laundering'],
    claim_03_no_russia_iran_criticism_sampled: ['verdict-before-evidence'],
  },
  'giant-amplifiers': {
    claim_03_opportunistic_vs_ideological: ['arousal-monetization'],
    claim_04_nawfal_factory: ['manufactured-urgency'],
    claim_05_matte_corridor_bridge: ['authority-laundering'],
    claim_06_stale_pod_branding: ['identity-games'],
  },
  'state-media-irgc-press': {
    claim_01_batch_cohort_split: ['synchronized-amplification', 'identity-games'],
    claim_02_card_factory: ['manufactured-urgency'],
    claim_03_overt_vs_covert: ['identity-games'],
    claim_04_seeds_touch_state_family: ['circular-sourcing'],
  },
};

/**
 * Findings that do not clear the naming policy, and are therefore not
 * published. The reason is recorded here rather than the row being deleted,
 * so a later editor can see the judgment instead of rediscovering the gap.
 *
 * Both entries below are `low` confidence claims that would put a named
 * person, or a specific accusation about one, in front of readers on thinner
 * evidence than this desk publishes on. Neither is deleted from the research;
 * they are simply not this site's to assert.
 */
const SUPPRESSED: Record<string, Record<string, string>> = {
  'hinkle-machine': {
    claim_10:
      'Contested at low confidence, and it concerns who threatened whom between two named living people. The documented, charged conduct in this window is the arrested man\'s threats against the congressman, which the case chronology already carries. Publishing the disputed counter-claim would put this site behind an assertion its own sources call unresolved.',
  },
  'muslim-palestinian-influencers': {
    claim_12_truthteller_fee:
      'A single peer\'s unverified claim about pay-to-unblock behaviour, graded contested at low confidence and resting on one mirror snapshot. Named in the integration brief as an item not to publish unless re-sourced; it was not re-sourced.',
  },
};

/**
 * Bottom-line points that are the research's own bookkeeping rather than a
 * finding — a note about how an entity stayed classified between runs, not
 * anything a reader learns from.
 *
 * Matched on a distinctive fragment rather than by position, so re-importing
 * cannot silently drop a different point when the order changes. Kept
 * deliberately short: a section that hides inconvenient findings behind
 * "not a finding" would be doing the thing it documents, so the bar is that
 * the point makes a claim about the research's filing, not about the world.
 */
const NOT_A_FINDING: Record<string, { fragment: string; reason: string }[]> = {
  'state-media-irgc-press': [
    {
      fragment: 'dual-home',
      reason:
        'Records that two entities kept their existing classifications between research runs. It asserts nothing about the accounts themselves — the classifications it refers to are already visible in the roster.',
    },
  ],
};

/**
 * How each case is framed, in the section's own voice.
 *
 * The owner's direction is that this section presents these actors as
 * manipulators and perception engineers, and the frame has to be stated
 * rather than left for the reader to infer from a roster. Each `frame` runs
 * above the case's findings; each `guard`, where present, is the boundary the
 * research itself insisted on and this site does not cross.
 */
export type CaseFraming = {
  /** One paragraph naming what this file is really about. */
  frame: string;
  /** A limit the research imposed on how its own subjects may be described. */
  guard?: string;
};

const FRAMING: Record<string, CaseFraming> = {
  'hinkle-machine': {
    frame:
      'This is the one production cell the research could prove: a large account, a clip supplier feeding it, and a party brand, moving the same material within minutes of each other. It is also the least covert operation in the section — the routing is declared in the principal\'s own bio, which is what makes it possible to document rather than infer.',
    guard:
      'Who operates the clip account was not established. The behaviour is documented; the operator is not, and a devoted-fan explanation was not eliminated.',
  },
  'manosphere-far-right': {
    frame:
      'A cluster that did not begin as Middle East commentary and arrived through what performed. The file tracks the pivot itself — what these accounts posted before October 2023 and what became their high-reach content after — because a pivot visible in an account\'s own timeline is the clearest evidence there is that content is being selected by reach rather than by conviction.',
  },
  'muslim-palestinian-influencers': {
    frame:
      'A personal-brand lane where the commercial layer is disclosed and the editorial effect is still visible: high-arousal formats, breaking-news framing over other people\'s reporting, and monetisation that rewards the most alarming available reading of the day.',
    guard:
      'The research went looking for collaboration inside this lane and found feuding instead. Where it expected a network it documented a fight, and that correction is published with the rest.',
  },
  'aggregators-feeders': {
    frame:
      'The supply side. These accounts do not caption claims so much as hand other accounts the raw material — footage, casualty frames, breaking cards — and the formats they hand over shape what the accounts downstream can say. The file\'s central result is that the pipeline everyone assumes exists is two pipelines, and the influencers drink from the one nobody was watching.',
    guard:
      'This category is not one kind of account and must not be read as one. It contains named-source journalism, an on-scene reporter filing from Gaza, a document-based analyst, and an anonymous evidence-preservation archive — classifications the research assigned deliberately, and which stand here unchanged. Nothing in this file is a finding that they are inauthentic.',
  },
  'grayzone-anti-empire': {
    frame:
      'The authority mine. This corridor is where the influencer machines go for credibility they cannot generate themselves: credentialed, named, years-deep journalism, clipped out of context and re-captioned. The traffic runs almost entirely one way — the influencers take twenty times more from this corridor than it ever gives back — which is what makes it a supply of authority rather than a partner.',
    guard:
      'These are real journalists and outlets with documented editorial practices, not anonymous accounts, and the research states plainly that merging them into a fake-influencer frame is unsupported. What this file documents is a one-sided editorial line in its sampled windows and the use others make of their output — not coordination, which was tested for and not found.',
  },
  'giant-amplifiers': {
    frame:
      'The distribution layer, and the file that most cuts against the story this section might otherwise tell. The research tested whether million-view accounts relay the material the smaller accounts produce, and found that on the posts it tested they simply did not. What the layer does show is business model as editorial policy: the accounts that never touch the conflict, and the ones for which it is the product.',
  },
  'state-media-irgc-press': {
    frame:
      'Industrial cadence. Anonymous branded personas created in the same narrow window publish identical breaking-news cards on a one-to-two-minute clock across unrelated subjects — a format designed to remove the pause in which a reader would check something. This file keeps declared state outlets and anonymous personas as separate categories throughout.',
    guard:
      'A direct pipe from these personas into the influencer accounts was looked for and not established. That negative is recorded as a finding, not smoothed over.',
  },
};

/**
 * The research talks about itself in program shorthand — "case-05", "groups
 * 01/03", "the seed five", "NAMED_PERSON". Inside a nine-packet program that
 * is precise and useful. On a public page it is the site talking to itself:
 * a reader has no way to know what group 03 is, and the shorthand makes
 * careful sentences read like leaked internal notes.
 *
 * These rewrites replace the identifier with the thing it names. They change
 * no claim — only the label a claim uses to point at another part of the
 * research. Anything not listed here is left exactly as the researchers
 * wrote it.
 */
const FILE_NAMES: Record<string, string> = {
  '1': 'the Hinkle production cell',
  '2': 'the far-right cluster',
  '3': 'the Muslim personal-brand lane',
  '4': 'the aggregators',
  '5': 'the journalism corridor',
  '6': 'the mega-amplifiers',
  '7': 'the state and covert press',
  '8': 'the network map',
  '9': 'the synthesis',
};

/** "1, 2 and 3" — a list a person would say out loud. */
function joinNames(numbers: string[]): string {
  const names = numbers.map((n) => FILE_NAMES[String(Number(n))]).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} file`;
  return `the ${names.map((n) => n.replace(/^the /, '')).slice(0, -1).join(', ')} and ${names[names.length - 1].replace(/^the /, '')} files`;
}

/**
 * A reference to one or more sibling files, in any of the shapes the nine
 * reports write them: `case-05`, `group 03`, `cases 01–03`, `groups 01/02`,
 * `groups 01-05`. Handled as one rule with a captured number run rather than
 * as an enumeration of every pair, because an enumeration is exactly the kind
 * of list that silently misses the combination nobody thought of — which is
 * how "cases 01–02" reached a page and was caught by a test.
 */
const FILE_REFERENCE = /\b(?:case|group)s?[-\s](0?\d(?:\s*[-–—/,and\s]+0?\d)*)\b/gi;

const GLOSSARY: [RegExp, string][] = [
  // Table names from the research data model, which surface in source labels
  // ("Assembled relationship_evidence rows from …").
  [/\brelationship_evidence(?:\.csv)?\b/gi, 'the connection records'],
  [/\bclaim_evidence(?:\.csv)?\b/gi, 'the claim evidence records'],
  [/\bcontent_items(?:\.csv)?\b/gi, 'the archived post records'],
  [/\bentities\.csv\b/gi, 'the roster records'],
  [/\bsources\.csv\b/gi, 'the source records'],
  // The rewrites above can leave "the the" where the prose already had an
  // article ahead of the table name.
  [/\bthe the\b/gi, 'the'],
  [/\bthe seed five\b/gi, 'the five accounts this research started from'],
  [/\bseeds→/gi, 'the seed accounts → '],
  [/\bthe seeds\b/gi, 'the seed accounts'],
  // Entity-class tokens from the research data model.
  [/\bNAMED_PERSON\b/g, 'a named person'],
  [/\bANON_CLIP_FARM\b/g, 'an anonymous clip farm'],
  [/\bSTATE_ALIGNED\b/g, 'a state-aligned outlet'],
  [/\bLOOKALIKE-RISK\b/g, 'a lookalike risk'],
];

/** Rewrites program shorthand into what it refers to. */
export function readable(text: string): string {
  let out = text.replace(FILE_REFERENCE, (whole, run: string) => {
    const numbers = run.match(/\d+/g) ?? [];
    // A range written `01–05` means every file between the two ends.
    const isRange = /[-–—]/.test(run) && numbers.length === 2;
    const expanded = isRange
      ? Array.from(
          { length: Number(numbers[1]) - Number(numbers[0]) + 1 },
          (_, i) => String(Number(numbers[0]) + i),
        )
      : numbers;
    // Four or more files is "the case files" — naming seven of them inside a
    // sentence is worse than the shorthand was.
    if (expanded.length >= 4) return 'the case files';
    const named = joinNames(expanded);
    return named || whole;
  });
  for (const [pattern, replacement] of GLOSSARY) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Where the cases stand in the delivery's lifecycle now that this pass is
 * done.
 *
 * The importer writes `editorial_review` — the state a case arrives in. This
 * pass is what advances it: every case is framed, its findings are tagged,
 * the naming policy is applied, and its program shorthand is rewritten. What
 * remains is legal review of the files that name living people, which is not
 * a code change and not this layer's to declare complete.
 *
 * Set this back to `editorial_review` if the research is re-imported with new
 * or materially changed findings — the pass would then be stale, and a stale
 * pass silently claiming to be current is the failure this field exists to
 * prevent.
 */
export const EDITORIAL_STAGE = 'legal_review' as const;

export function techniquesFor(slug: string, claimId: string): string[] {
  const tags = TECHNIQUES[slug]?.[claimId] ?? [];
  // A tag naming a chapter that does not exist would render a dead chip; the
  // vocabulary is pinned by tests, so this is belt-and-braces at the seam.
  return tags.filter(isTechniqueId);
}

/** True when the naming policy keeps this finding off the page. */
export function isSuppressed(slug: string, claimId: string): boolean {
  return Boolean(SUPPRESSED[slug]?.[claimId]);
}

/** Why a finding is withheld, for the record. Not rendered to readers. */
export function suppressionReason(slug: string, claimId: string): string | undefined {
  return SUPPRESSED[slug]?.[claimId];
}

/** How many findings this pass withheld from a case. */
export function suppressedCount(slug: string): number {
  return Object.keys(SUPPRESSED[slug] ?? {}).length;
}

export function framingFor(slug: string): CaseFraming | undefined {
  return FRAMING[slug];
}

/** True when a bottom-line point is the research's filing, not a finding. */
export function isBookkeeping(slug: string, text: string): boolean {
  return (NOT_A_FINDING[slug] ?? []).some((entry) => text.includes(entry.fragment));
}

/** Every case the editorial pass has framed — used by tests. */
export const FRAMED_SLUGS = Object.keys(FRAMING);
export const TAGGED_SLUGS = Object.keys(TECHNIQUES);
export const SUPPRESSED_SLUGS = Object.keys(SUPPRESSED);
