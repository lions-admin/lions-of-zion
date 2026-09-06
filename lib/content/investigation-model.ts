/**
 * The investigation view model — one case, joined for reading.
 *
 * `fake-resistance-cases.ts` returns a case as the research delivered it:
 * roster, edges, narratives, chronology, graded findings and sources, each a
 * flat list. The investigation page needs the joins between them — which
 * accounts carry a narrative, which findings name an account, which events
 * touch it, what lag was measured on a connection — so that selecting one
 * thing can light up everything tied to it.
 *
 * This module computes those joins once, on the server, from the delivered
 * data and nothing else. Three rules:
 *
 * - **Nothing here upgrades a grade.** Confidence, identity status, evidence
 *   class and verdicts pass through untouched. A join is a pointer, not a
 *   claim.
 * - **A textual join is labelled as one.** Where the package carries no link
 *   table, an account is tied to a finding or narrative because the research's
 *   own sentence names it (`@handle` or full name). The page says "named in",
 *   never "responsible for".
 * - **Measurements travel with their qualifiers.** A lag never renders without
 *   its p-value, null model and sample size; a first-quoter record never
 *   without its tree state.
 *
 * Pure and synchronous, so it is unit-testable with no database and safe to
 * call from a prerendered route.
 */
import type {
  CadenceDay,
  CaseEntity,
  CaseExhibit,
  EvidenceClass,
  FirstSeenExhibit,
  ResearchCase,
  ResearchConfidence,
  ResearchSource,
  SynchronyPair,
} from './fake-resistance-cases';
import type { AssessmentValue } from '@/server/contracts/enums';
import { type EntityRole, roleOf } from './fake-resistance-roles';

export type InvestigationEntity = {
  id: string;
  name: string;
  handle?: string;
  type: CaseEntity['type'];
  identityStatus: CaseEntity['identityStatus'];
  role: EntityRole;
  followers?: number;
  note?: string;
  basis?: string;
  edgeIds: string[];
  narrativeIds: string[];
  eventIds: string[];
  claimIds: string[];
};

/**
 * How a connection should be drawn, decided by what kind of evidence it is.
 *
 * `flow` is an observed interaction with a direction (quote, repost, mention,
 * promotion). `reuse` is measured text or media similarity. `relationship`
 * is a documented tie (bio, filing, self-description). `inferred` is a
 * pattern consistent with coordination that was not established — it always
 * travels with a caveat. One line style per kind; never one "influence" score.
 */
export type FlowKind = 'flow' | 'reuse' | 'relationship' | 'inferred' | 'other';

export type MeasuredLag = {
  medianSeconds?: number;
  frac60?: number;
  frac300?: number;
  lead?: string;
  pValue?: number;
  nullModel?: string;
  n: number;
};

export type InvestigationEdge = {
  id: string;
  fromId: string;
  toId: string;
  from: string;
  to: string;
  relation: string;
  relationLabel: string;
  directed: boolean;
  evidenceClass: EvidenceClass;
  confidence?: ResearchConfidence;
  weight?: number;
  statement: string;
  indicators: string[];
  kind: FlowKind;
  pValue?: number;
  nullModel?: string;
  sampleN?: number;
  /** The synchrony measurement between the two accounts, where the case ran one. */
  lag?: MeasuredLag;
};

export type InvestigationNarrative = {
  id: string;
  title: string;
  summary?: string;
  frame?: string;
  audience?: string;
  status?: string;
  confidence?: ResearchConfidence;
  /** Accounts the research's own description of the narrative names. */
  carrierIds: string[];
  /** Findings whose statement names the narrative's carriers. */
  claimIds: string[];
  /** Any linked finding carries a contradicting source. */
  contested: boolean;
  firstSeen?: string;
  lastSeen?: string;
};

export type InvestigationEvent = {
  id: string;
  occurredAt?: string;
  type?: string;
  label: string;
  description: string;
  confidence?: ResearchConfidence;
  entityIds: string[];
};

export type SourceType =
  | 'x_post'
  | 'community_note'
  | 'fact_check'
  | 'archive'
  | 'official'
  | 'research'
  | 'press'
  | 'analysis'
  | 'other';

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  x_post: 'Primary X post',
  community_note: 'Community Note',
  fact_check: 'Fact check',
  archive: 'Archive capture',
  official: 'Official record',
  research: 'Research report',
  press: 'Press',
  analysis: 'Desk analysis',
  other: 'Other',
};

export type LedgerSource = ResearchSource & { sourceType: SourceType };

export type InvestigationClaim = {
  id: string;
  statement: string;
  verdict: AssessmentValue;
  confidence?: ResearchConfidence;
  observedAt?: string;
  attributedTo?: string;
  attributedToId?: string;
  techniques: string[];
  /** Accounts the statement names, plus the attributed author. */
  entityIds: string[];
  supporting: LedgerSource[];
  contradicting: LedgerSource[];
  context: LedgerSource[];
  contested: boolean;
};

export type FirstQuoterRecord = FirstSeenExhibit & { quoterId?: string };

/** Another published case file that examines the same handle. */
export type ElsewhereLink = { slug: string; title: string };

export type InvestigationModel = {
  slug: string;
  entities: InvestigationEntity[];
  edges: InvestigationEdge[];
  narratives: InvestigationNarrative[];
  events: InvestigationEvent[];
  claims: InvestigationClaim[];
  firstQuoters: FirstQuoterRecord[];
  window?: { start: string; end: string };
  cadence: CadenceDay[];
  /** An earlier reading of this case was overturned by its own new data. */
  updated: boolean;
  /**
   * Entity id → the other case files that carry the same handle. Filled by
   * the page from the case index, so a held case drops out automatically.
   */
  elsewhere: Record<string, ElsewhereLink[]>;
};

const FLOW_RELATIONS = new Set([
  'quote',
  'retweet',
  'reply',
  'mention',
  'mentioned_by',
  'promotes',
  'amplifies',
  'republished_by',
  'clipped_by',
  'clips',
  'engages',
  'no_engagement',
  'aggregates_from',
  'feeds',
  'platforms',
  'hosts_debate',
  'appeared_with',
  'attacks',
  'blocked',
  'followed',
  'follows',
  'produced_for',
  'praises',
  'defends',
  'bridges_to',
  'supports',
]);

const REUSE_RELATIONS = new Set([
  'caption_copy',
  'co_url_similarity',
  'images_similarity',
  'temporal_similarity',
  'co_occur_overlap',
  'echoes',
  'parallel_brand',
  'parallel_show',
  'same_attention_market',
]);

/** "chapter_of_inverse" → "chapter of", "QUOTE" → "quote". */
export function relationLabel(relation: string): string {
  return relation.replace(/_inverse$/, '').replace(/_/g, ' ').toLowerCase();
}

export function flowKindOf(relation: string, evidenceClass: EvidenceClass): FlowKind {
  if (evidenceClass === 'inferred_coordination') return 'inferred';
  const key = relation.toLowerCase();
  if (REUSE_RELATIONS.has(key)) return 'reuse';
  if (evidenceClass === 'documented_relationship') return 'relationship';
  if (FLOW_RELATIONS.has(key)) return 'flow';
  return 'other';
}

/**
 * What kind of thing a source is, read from its `kind` and URL. A Community
 * Note is contested content, not a verdict, which is why it is its own type
 * rather than a fact check.
 */
export function sourceTypeOf(source: ResearchSource): SourceType {
  const kind = (source.kind ?? '').toLowerCase();
  const url = (source.url ?? '').toLowerCase();
  if (/community note/.test(kind)) return 'community_note';
  if (/fact[- ]?check|factcheck/.test(kind) || /factcheck|fact-check/.test(url)) return 'fact_check';
  if (/wayback|archive\.(org|today|ph)|internet archive|archive project|archive/.test(kind) || /web\.archive\.org|archive\.(today|ph|is)/.test(url)) {
    return 'archive';
  }
  if (/treasury|council of the european|court|department|ministry|^eu$|official|register|authorization|x corp/.test(kind)) {
    return 'official';
  }
  if (/local analysis|analysis|api query|api|toolchain|scripts\/|mirror|track b|harvest|sample|batch verification|registry\//.test(kind)) {
    return 'analysis';
  }
  if (/^x$|^x \(|twitter|x\.com|nitter|sotwe|twstalker|periscope/.test(kind) || /(^|\/\/)(www\.)?(x|twitter)\.com\//.test(url)) {
    return 'x_post';
  }
  if (/arxiv|ncri|cyabra|isd|institute|research|wikipedia|adl|splc|hatewatch|clemson|shadowgraph|asd at gmf|keywiki|rationalwiki|vatnik/.test(kind)) {
    return 'research';
  }
  if (kind) return 'press';
  return 'other';
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Matcher = { id: string; pattern: RegExp };

/**
 * One regex per entity: its handle as `@handle`, and its name where the name
 * is specific enough to be a reference rather than a word. Two-character
 * names and names that are just a handle are skipped; the handle pattern
 * covers them.
 */
function buildMatchers(entities: CaseEntity[]): Matcher[] {
  const matchers: Matcher[] = [];
  for (const entity of entities) {
    if (entity.id === 'ent_desk') continue;
    const parts: string[] = [];
    if (entity.handle) parts.push(`@${escapeRegExp(entity.handle.replace(/^@/, ''))}(?![\\w])`);
    const bareName = entity.name.replace(/\s*\((?:account|control|operator)\)\s*$/i, '').trim();
    if (!bareName.startsWith('@') && bareName.length >= 4 && /\s/.test(bareName)) {
      parts.push(`(?<![\\w@])${escapeRegExp(bareName)}(?![\\w])`);
    }
    if (parts.length === 0) continue;
    matchers.push({ id: entity.id, pattern: new RegExp(parts.join('|'), 'i') });
  }
  return matchers;
}

function mentionsOf(text: string | undefined, matchers: Matcher[]): string[] {
  if (!text) return [];
  const ids: string[] = [];
  for (const matcher of matchers) if (matcher.pattern.test(text)) ids.push(matcher.id);
  return ids;
}

/** `attributedTo` is a name or an `@handle`; resolve it to a roster id. */
function attributedId(exhibit: CaseExhibit, entities: CaseEntity[]): string | undefined {
  const value = exhibit.attributedTo?.trim();
  if (!value) return undefined;
  const lower = value.toLowerCase();
  const byHandle = entities.find(
    (e) => e.handle && `@${e.handle.replace(/^@/, '').toLowerCase()}` === lower,
  );
  if (byHandle) return byHandle.id;
  const byName = entities.find((e) => e.name.toLowerCase() === lower);
  return byName?.id;
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

const handleKey = (value?: string) => (value ?? '').replace(/^@/, '').toLowerCase();

function lagFor(
  pairs: SynchronyPair[],
  a: CaseEntity | undefined,
  b: CaseEntity | undefined,
): MeasuredLag | undefined {
  const ha = handleKey(a?.handle);
  const hb = handleKey(b?.handle);
  if (!ha || !hb) return undefined;
  const pair = pairs.find((p) => {
    const pa = handleKey(p.a);
    const pb = handleKey(p.b);
    return (pa === ha && pb === hb) || (pa === hb && pb === ha);
  });
  if (!pair) return undefined;
  return {
    medianSeconds: pair.medianSeconds,
    frac60: pair.frac60,
    frac300: pair.frac300,
    lead: pair.lead,
    pValue: pair.pValue,
    nullModel: pair.nullModel,
    n: pair.n,
  };
}

/** The research types its events in snake_case; a reader gets a sentence-case label. */
export function eventTypeLabel(type?: string): string {
  if (!type) return 'Event';
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const asNumber = (value?: string) => {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export function buildInvestigationModel(
  record: ResearchCase,
  options: { elsewhere?: Record<string, ElsewhereLink[]> } = {},
): InvestigationModel {
  const entities = record.roster;
  const byId = new Map(entities.map((e) => [e.id, e]));
  const matchers = buildMatchers(entities);
  const stats = record.stats;
  const synchronyPairs = stats?.synchrony?.pairs ?? [];

  const edges: InvestigationEdge[] = record.edges.map((edge) => ({
    id: edge.id,
    fromId: edge.fromId,
    toId: edge.toId,
    from: edge.from,
    to: edge.to,
    relation: edge.relation,
    relationLabel: relationLabel(edge.relation),
    directed: edge.direction !== 'undirected',
    evidenceClass: edge.evidenceClass,
    confidence: edge.confidence,
    weight: asNumber(edge.weight),
    statement: edge.statement,
    indicators: uniq(edge.indicators ?? []),
    kind: flowKindOf(edge.relation, edge.evidenceClass),
    pValue: asNumber((edge as { pValue?: string }).pValue),
    nullModel: (edge as { nullModel?: string }).nullModel,
    sampleN: asNumber((edge as { sampleN?: string }).sampleN),
    lag: lagFor(synchronyPairs, byId.get(edge.fromId), byId.get(edge.toId)),
  }));

  const claims: InvestigationClaim[] = record.exhibits.map((exhibit) => {
    const attributedToId = attributedId(exhibit, entities);
    const named = mentionsOf(exhibit.statement, matchers);
    /* A packet can attach the same source to a claim twice (once per
       evidence row); it is one source, and the ledger lists it once. */
    const seen = new Set<string>();
    const typed = exhibit.sources
      .filter((source) => {
        const key = `${source.id}|${source.sourceRole ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((source) => ({
        ...source,
        sourceType: sourceTypeOf(source),
      }));
    const contradicting = typed.filter((s) => s.sourceRole === 'contradicting');
    return {
      id: exhibit.id,
      statement: exhibit.statement,
      verdict: exhibit.verdict,
      confidence: exhibit.confidence,
      observedAt: exhibit.observedAt,
      attributedTo: exhibit.attributedTo,
      attributedToId,
      techniques: exhibit.techniques,
      entityIds: uniq([...(attributedToId && attributedToId !== 'ent_desk' ? [attributedToId] : []), ...named]),
      supporting: typed.filter((s) => s.sourceRole !== 'contradicting' && s.sourceRole !== 'context'),
      contradicting,
      context: typed.filter((s) => s.sourceRole === 'context'),
      contested: contradicting.length > 0,
    };
  });

  const events: InvestigationEvent[] = record.chronology.map((event) => ({
    id: event.id,
    occurredAt: event.occurredAt,
    type: event.type,
    label: eventTypeLabel(event.type),
    description: event.description,
    confidence: event.confidence,
    entityIds: mentionsOf(event.description, matchers),
  }));

  const narratives: InvestigationNarrative[] = record.narratives.map((narrative) => {
    const carrierIds = uniq([
      ...mentionsOf(narrative.summary, matchers),
      ...mentionsOf(narrative.frame, matchers),
      ...mentionsOf(narrative.title, matchers),
    ]);
    const carriers = new Set(carrierIds);
    const linked = claims.filter((claim) => claim.entityIds.some((id) => carriers.has(id)));
    const dates = linked
      .map((claim) => claim.observedAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    return {
      id: narrative.id,
      title: narrative.title,
      summary: narrative.summary,
      frame: narrative.frame,
      audience: narrative.audience,
      status: narrative.status,
      confidence: narrative.confidence,
      carrierIds,
      claimIds: linked.map((claim) => claim.id),
      contested: linked.some((claim) => claim.contested),
      firstSeen: dates[0],
      lastSeen: dates.at(-1),
    };
  });

  const firstQuoters: FirstQuoterRecord[] = (stats?.firstSeen ?? []).map((row) => ({
    ...row,
    quoterId: entities.find((e) => handleKey(e.handle) === handleKey(row.firstQuoter))?.id,
  }));

  const modelEntities: InvestigationEntity[] = entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    handle: entity.handle ? entity.handle.replace(/^@/, '') : undefined,
    type: entity.type,
    identityStatus: entity.identityStatus,
    role: roleOf(record.slug, entity),
    followers: entity.followers,
    note: entity.note,
    basis: entity.publicInterestBasis,
    edgeIds: edges.filter((e) => e.fromId === entity.id || e.toId === entity.id).map((e) => e.id),
    narrativeIds: narratives.filter((n) => n.carrierIds.includes(entity.id)).map((n) => n.id),
    eventIds: events.filter((e) => e.entityIds.includes(entity.id)).map((e) => e.id),
    claimIds: claims.filter((c) => c.entityIds.includes(entity.id)).map((c) => c.id),
  }));

  return {
    slug: record.slug,
    entities: modelEntities,
    edges,
    narratives,
    events,
    claims,
    firstQuoters,
    window: stats?.window,
    cadence: stats?.cadence?.days ?? [],
    updated: (record.overturned?.length ?? 0) > 0,
    elsewhere: options.elsewhere ?? {},
  };
}
