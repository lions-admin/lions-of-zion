/**
 * Who plays what part in a case — the role map's join.
 *
 * The research rosters describe an entity in three prose fields (`note`,
 * `publicInterestBasis`, and the tag at the head of a note), and none of them
 * is a machine-readable role. The role map on a case page needs one: a reader
 * should be able to see who originates, who clips, who amplifies, and who is
 * merely a comparison account, without opening a graph.
 *
 * Two layers, in order:
 *
 * 1. **Structural rules** that read fields, not prose — the desk's own
 *    entity, the control-account id convention every packet uses, the
 *    lookalike guard, and the identity grade. These are exact and need no
 *    judgment.
 * 2. **An explicit table**, per case, for the principal accounts. This is a
 *    reading of the case reports written out once so it can be reviewed in a
 *    diff, exactly as `fake-resistance-network-communities.ts` did for the
 *    community join. A role is a description of what the research found an
 *    account doing; it is never stronger than the edges and findings beside it.
 *
 * Anything neither layer names falls to a type-based default (`person`,
 * `organization`, `account`) and is listed under "Also in this file" — present
 * on the page, assigned no part in the story.
 */
import type { CaseEntity } from './fake-resistance-cases';

export type EntityRole =
  | 'originator'
  | 'clipper'
  | 'amplifier'
  | 'platform'
  | 'aggregator'
  | 'journalist'
  | 'brand'
  | 'subject'
  | 'context'
  | 'control'
  | 'unresolved'
  | 'referenced'
  | 'desk'
  | 'other';

export type RoleDefinition = {
  role: EntityRole;
  label: string;
  /** One sentence a reader needs to know what the part means in this research. */
  meaning: string;
};

/** Display order: the story's supply chain first, apparatus last. */
export const ROLE_ORDER: readonly RoleDefinition[] = [
  {
    role: 'originator',
    label: 'Originator / source',
    meaning: 'Where material enters the sample: the account or outlet that first publishes it.',
  },
  {
    role: 'clipper',
    label: 'Clipper or captioner',
    meaning: 'Cuts, captions or repackages material for others to carry.',
  },
  {
    role: 'amplifier',
    label: 'Amplifier',
    meaning: 'Carries material onward — quotes, reposts, relays — supplying reach and framing.',
  },
  {
    role: 'aggregator',
    label: 'Aggregator / wire',
    meaning: 'High-volume feeds that redistribute footage and claims to broad thematic audiences.',
  },
  {
    role: 'platform',
    label: 'Platform or show',
    meaning: 'A show, podcast or mega-account that hosts guests or references viral material.',
  },
  {
    role: 'journalist',
    label: 'Journalist / outlet',
    meaning: 'Named journalists and outlets with a byline record; treated as press, not as a network node.',
  },
  {
    role: 'brand',
    label: 'Organisation / brand',
    meaning: 'A party, company or institutional account that anchors the accounts around it.',
  },
  {
    role: 'subject',
    label: 'Clipped subject',
    meaning: 'Someone whose material was reused. Present because of what was done with their words, not for anything they did.',
  },
  {
    role: 'context',
    label: 'Named in context',
    meaning: 'Officials, institutions or researchers named in an exhibit. Not participants.',
  },
  {
    role: 'control',
    label: 'Control or comparison',
    meaning: 'Harvested identically as a baseline. Without controls an anomaly claim cannot be read.',
  },
  {
    role: 'unresolved',
    label: 'Unresolved or lookalike',
    meaning: 'The operator was not identified, or the handle is a lookalike, retired or recycled shell.',
  },
  {
    role: 'referenced',
    label: 'Referenced from another file',
    meaning: 'A pointer to an account examined fully in a sibling case file.',
  },
  {
    role: 'desk',
    label: 'The research desk',
    meaning: 'This investigation’s own analyst entity. It observes the network; it is not in it.',
  },
  {
    role: 'other',
    label: 'Also in this file',
    meaning: 'Listed in the roster without a stated part in the story.',
  },
];

export const ROLE_LABEL: Record<EntityRole, string> = Object.fromEntries(
  ROLE_ORDER.map((d) => [d.role, d.label]),
) as Record<EntityRole, string>;

/**
 * The principal parts, per case, as the reports describe them.
 *
 * Only entities that carry a part in the story are listed. Everything else
 * falls to the structural rules or to the type default. A control account is
 * never listed here: the id convention decides that, so a re-import that adds
 * a control cannot promote it by omission.
 */
const PRINCIPALS: Record<string, Record<string, EntityRole>> = {
  'hinkle-machine': {
    ent_gulag_account: 'clipper',
    ent_acct_jacksonhinkle: 'amplifier',
    ent_hinkle_person: 'amplifier',
    ent_acpmain_account: 'brand',
    ent_acp_org: 'brand',
    ent_hazaldin: 'brand',
    ent_legittargets_account: 'platform',
    ent_chapter_ny: 'amplifier',
    ent_chapter_ca: 'amplifier',
    ent_chapter_pa: 'amplifier',
    ent_chapter_mn: 'amplifier',
    ent_chapter_va: 'amplifier',
    ent_chapter_ok: 'amplifier',
    ent_chapter_me: 'amplifier',
    ent_chapter_nc: 'amplifier',
    ent_chapter_ontario: 'amplifier',
    ent_kasparian: 'subject',
    ent_irib: 'originator',
    ent_randyfine: 'context',
    ent_cyabra: 'context',
    ent_ncri: 'context',
    ent_tuckercarlson_person: 'platform',
    ent_candaceo_person: 'platform',
  },
  'manosphere-far-right': {
    ent_loupis_person: 'amplifier',
    ent_acct_drloupis: 'amplifier',
    ent_acct_drloupis__: 'amplifier',
    ent_gage_person: 'amplifier',
    ent_acct_lucasgagex: 'amplifier',
    ent_shields_person: 'platform',
    ent_acct_jakeshieldsajj: 'platform',
    ent_acct_shieldsclips: 'clipper',
    ent_acct_censoredmen: 'clipper',
    ent_fuentes_person: 'platform',
    ent_acct_nickjfuentes: 'platform',
    ent_parker_person: 'amplifier',
    ent_acct_samparkersenate: 'amplifier',
    ent_acct_basedsamparker: 'amplifier',
    ent_woods_person: 'amplifier',
    ent_acct_keithwoodsyt: 'amplifier',
    ent_acct_europa: 'aggregator',
    ent_dawson_person: 'amplifier',
    ent_acct_ryliberty: 'amplifier',
    ent_peters_person: 'platform',
    ent_acct_realstewpeters: 'platform',
    ent_acct_sneako: 'platform',
    ent_acct_myron: 'platform',
    ent_carroll_person: 'amplifier',
    ent_acct_iancarroll: 'amplifier',
    ent_jvnior_account: 'referenced',
    ent_sulaiman_account: 'referenced',
  },
  'muslim-palestinian-influencers': {
    ent_sulaiman_person: 'amplifier',
    ent_acct_sulaiman: 'amplifier',
    ent_jvnior_person: 'amplifier',
    ent_acct_jvnior: 'amplifier',
    ent_lowkey_person: 'amplifier',
    ent_acct_lowkey: 'amplifier',
    ent_galloway_person: 'platform',
    ent_acct_galloway: 'platform',
    ent_acct_sneako: 'platform',
    ent_hijab_person: 'other',
    ent_acct_hijab: 'other',
    ent_haqiqatjou_person: 'amplifier',
    ent_acct_haqiqatjou: 'amplifier',
    ent_yakoby_account: 'context',
    ent_awesomejew_account: 'context',
    ent_nawfal_account: 'platform',
    ent_rainbet_org: 'brand',
    ent_acct_hinkle_ref: 'referenced',
    ent_acct_gulag_ref: 'referenced',
    ent_acct_landis_ref: 'referenced',
    ent_acct_timesofgaza: 'aggregator',
    ent_acct_eyeonpalestine: 'aggregator',
    ent_x_stewpeters: 'referenced',
    ent_x_adamemedia: 'originator',
  },
  'aggregators-feeders': {
    ent_acct_qudsnen: 'aggregator',
    ent_acct_qudsn_en: 'aggregator',
    ent_acct_timesofgaza: 'aggregator',
    ent_acct_eyeonpal: 'aggregator',
    ent_acct_onlinepaleng: 'aggregator',
    ent_acct_xisraelexposed: 'originator',
    ent_intifada_org: 'journalist',
    ent_abunimah_person: 'journalist',
    ent_winstanley_person: 'journalist',
    ent_mee_org: 'journalist',
    ent_palestinechron_org: 'journalist',
    ent_mondoweiss_org: 'journalist',
    ent_ytirawi_person: 'journalist',
    ent_abujomaa_person: 'journalist',
    ent_clashreport_account: 'aggregator',
    ent_acct_sulaiman: 'referenced',
  },
  'grayzone-anti-empire': {
    ent_blumenthal_p: 'journalist',
    ent_acct_blumenthal: 'journalist',
    ent_grayzone_org: 'journalist',
    ent_acct_grayzone: 'journalist',
    ent_parampil_p: 'journalist',
    ent_acct_parampil: 'journalist',
    ent_mate_p: 'journalist',
    ent_acct_mate: 'journalist',
    ent_medhurst_p: 'journalist',
    ent_acct_medhurst: 'journalist',
    ent_norton_p: 'journalist',
    ent_acct_norton: 'journalist',
    ent_mintpress_org: 'journalist',
    ent_acct_mintpress: 'journalist',
    ent_khalek_p: 'journalist',
    ent_acct_khalek: 'journalist',
    ent_btnews_org: 'journalist',
    ent_acct_btnews: 'journalist',
    ent_martin_p: 'journalist',
    ent_acct_martin: 'journalist',
    ent_cohen_p: 'journalist',
    ent_acct_cohen: 'journalist',
    ent_johnstone_p: 'journalist',
    ent_acct_johnstone: 'journalist',
    ent_halper_p: 'journalist',
    ent_acct_halper: 'journalist',
    ent_murray_p: 'journalist',
    ent_acct_murray: 'journalist',
    ent_finkelstein_p: 'journalist',
    ent_acct_finkelstein: 'journalist',
    ent_dropsite_org: 'journalist',
    ent_acct_dropsite: 'journalist',
    ent_cradle_org: 'journalist',
    ent_acct_cradle: 'journalist',
    ent_shehada_p: 'journalist',
    ent_acct_shehada: 'journalist',
    ent_acct_hinkle_ref: 'referenced',
    ent_acct_gulag_ref: 'referenced',
    ent_clashreport_ref: 'referenced',
    ent_acct_lowkey: 'referenced',
  },
  'giant-amplifiers': {
    ent_nawfal_account: 'platform',
    ent_candace_person: 'platform',
    ent_acct_candace: 'platform',
    ent_acct_candacepod: 'platform',
    ent_lucre_account: 'amplifier',
    ent_wallace_account: 'amplifier',
    ent_davesmith_person: 'platform',
    ent_acct_davesmith: 'platform',
    ent_iversen_p: 'platform',
    ent_iversen_show: 'platform',
    ent_judgenap_org: 'platform',
    ent_macgregor_p: 'platform',
    ent_macgregor_acct: 'platform',
    ent_ritter_p: 'platform',
    ent_ritter_acct: 'platform',
    ent_jones_person: 'journalist',
    ent_jones_acct: 'journalist',
    ent_moatstv_account: 'platform',
    ent_galloway_acct: 'platform',
    ent_yakoby_ref: 'referenced',
    ent_mate_p: 'referenced',
    ent_domlucre_backup: 'amplifier',
  },
  'state-media-irgc-press': {
    ent_prestv_account: 'originator',
    ent_acct_presstvextra: 'originator',
    ent_acct_ptvbreaking: 'originator',
    ent_acct_mayadeen_news: 'originator',
    ent_acct_mayadeen_live: 'originator',
    ent_acct_mayadeen_en: 'originator',
    ent_mayadeen_org: 'brand',
    ent_cradle_ref: 'referenced',
    ent_gbc_press: 'amplifier',
    ent_irgc_press: 'amplifier',
    ent_irgc_global: 'amplifier',
    ent_acct_bmx_press: 'amplifier',
    ent_marandi_person: 'platform',
    ent_acct_crayzone: 'unresolved',
  },
};

const CONTROL_ID = /^ent_(?:ctl|ctrl)[_-]|_ctrl$|_ctl$/;
const LOOKALIKE = /lookalike|parody|recycled-handle|generation \d|retired|suspended|shell/i;

/**
 * The part an entity plays in a case, from the rules and the table above.
 *
 * Order matters: the desk and the controls are decided by id; a lookalike or
 * unresolved identity is decided by the research's own grade and guard labels
 * before any table entry can name it a participant. The table can only ever
 * place a *resolved* account.
 */
export function roleOf(slug: string, entity: CaseEntity): EntityRole {
  if (entity.id === 'ent_desk') return 'desk';
  if (CONTROL_ID.test(entity.id) || /\(control\)/i.test(entity.name)) return 'control';
  if (entity.identityStatus === 'unresolved') return 'unresolved';
  if (LOOKALIKE.test(entity.publicInterestBasis ?? '') || LOOKALIKE.test(entity.name)) {
    return 'unresolved';
  }
  const listed = PRINCIPALS[slug]?.[entity.id];
  if (listed) return listed;
  if (/referenced|stub|sibling case|cross-case pointer/i.test(entity.publicInterestBasis ?? '')) {
    return 'referenced';
  }
  return 'other';
}

/** Every case the table names — for the coverage test. */
export const ROLE_TABLE_SLUGS: readonly string[] = Object.keys(PRINCIPALS);

/** Every entity id the table names for a case — for the coverage test. */
export function principalIds(slug: string): readonly string[] {
  return Object.keys(PRINCIPALS[slug] ?? {});
}
