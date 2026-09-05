/**
 * Fake Resistance research — the case-file seam.
 *
 * `content-packages/fake-resistance/` holds what
 * `scripts/import-research-cases.mjs` took out of the nine research packets
 * that live outside this repository. See `.ai/DECISIONS.md` for decisions that govern what
 * may appear on these pages: the naming policy, and the frame the section is
 * published in.
 *
 * Like the rest of `lib/content/`, this is the seam a real published-content
 * query would land on: callers ask for a case by slug, not for a file.
 *
 * These accessors are `async` and that is safe — none of this is in the home
 * route's render path. Every consumer prerenders at build time.
 *
 * `lib/content/fake-resistance.ts` is a different, older seam: the three
 * reference exhibits on the section's root page. The two do not share data and
 * neither reads the other.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssessmentValue } from '@/server/contracts/enums';
import type { Source } from '@/components/content';
import {
  type CaseFraming,
  EDITORIAL_STAGE,
  PUBLICATION,
  canonicalPathFor,
  framingFor,
  isBookkeeping,
  isSuppressed,
  readable,
  suppressedCount,
  techniquesFor,
} from './fake-resistance-editorial';

/**
 * Where a case sits in the delivery's own lifecycle.
 *
 * The packets arrive at `right_of_reply`; this site does not run that process
 * (owner decision, `.ai/DECISIONS.md`), so a case enters at `editorial_review`
 * and advances as the passes complete. `held` keeps a case out of the index
 * and out of `generateStaticParams` — one field, no code fork.
 */
export type CaseLifecycle = 'editorial_review' | 'legal_review' | 'ready' | 'published' | 'held';

/** Lifecycle states whose pages are built and linked. */
const VISIBLE: readonly CaseLifecycle[] = ['editorial_review', 'legal_review', 'ready', 'published'];

/**
 * Two gates, and both must open.
 *
 * `EDITORIAL_STAGE` is the global one: it is what the editorial pass advances,
 * and setting it to `held` withdraws every case at once. The `lifecycle` in a
 * case's own JSON is the per-case one, so a single case can still be pulled by
 * editing its file.
 *
 * This used to be wrong in a way worth remembering. `getCase()` overrode the
 * JSON with `EDITORIAL_STAGE` while `getCaseIndex()` filtered on the JSON, so
 * the flag that reads like the publication switch withdrew nothing: the index,
 * the sitemap and `generateStaticParams` all still listed every case. Both
 * gates are now checked in one place, by both callers.
 */
function isPublishable(jsonLifecycle: CaseLifecycle): boolean {
  return VISIBLE.includes(EDITORIAL_STAGE) && VISIBLE.includes(jsonLifecycle);
}

/**
 * The research's own confidence grade. Rendered as a label beside a finding,
 * never converted into a verdict — an assessment of *how well we know* is not
 * an assessment of *what is true*, and collapsing the two would overstate
 * every medium-confidence line on the site.
 */
export type ResearchConfidence = 'high' | 'medium' | 'low';

/** How well an account's operator is known. Never upgraded by this site. */
export type IdentityStatus = 'confirmed' | 'probable' | 'unresolved';

/**
 * What kind of evidence stands behind an edge. `inferred_coordination` is the
 * weakest and is labeled as such wherever it renders.
 */
export type EvidenceClass =
  | 'documented_relationship'
  | 'observed_interaction'
  | 'inferred_coordination';

export type ResearchSource = Source & {
  publishedAt?: string;
  retrievedAt?: string;
  reliability?: 'high' | 'medium' | 'low' | 'unknown';
  sourceRole?: string;
  /** Proof the packet held a file; the file itself is never published. */
  sha256?: string;
};

/** A finding from the report's bottom line, with the sources it cited. */
export type CasePoint = {
  text: string;
  sources: ResearchSource[];
};

/**
 * One graded claim as cleared for publication.
 *
 * `statement` is the researchers' own `publication_wording` — the cautious
 * phrasing they wrote separately from their working notes. The internal
 * `analysis` field is never imported.
 */
export type CaseExhibit = {
  id: string;
  statement: string;
  verdict: AssessmentValue;
  confidence?: ResearchConfidence;
  observedAt?: string;
  attributedTo?: string;
  /** Manipulation techniques this exhibit documents. Set in the editorial pass. */
  techniques: string[];
  sources: ResearchSource[];
};

export type CaseEntity = {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'account';
  handle?: string;
  platform?: string;
  identityStatus: IdentityStatus;
  jurisdiction?: string;
  /** Follower count at the moment the research retrieved it. Decays. */
  followers?: number;
  note?: string;
  publicInterestBasis?: string;
};

export type CaseEdge = {
  id: string;
  from: string;
  to: string;
  fromId: string;
  toId: string;
  relation: string;
  direction?: string;
  evidenceClass: EvidenceClass;
  confidence?: ResearchConfidence;
  weight?: string;
  statement: string;
  indicators?: string[];
};

export type CaseNarrative = {
  id: string;
  title: string;
  summary?: string;
  frame?: string;
  audience?: string;
  status?: string;
  confidence?: ResearchConfidence;
};

export type CaseEvent = {
  id: string;
  occurredAt?: string;
  type?: string;
  description: string;
  confidence?: ResearchConfidence;
};

export type ResearchCase = {
  slug: string;
  caseId: string;
  title: string;
  question: string;
  scope: string;
  publicInterestBasis: string;
  updatedAt: string;
  language: string;
  lifecycle: CaseLifecycle;
  /** The researchers' self-graded certainty, as one sentence. */
  confidence: string;
  bottomLine: CasePoint[];
  limitations: string[];
  unknowns: string[];
  contradictions: string[];
  wouldChange: string[];
  roster: CaseEntity[];
  exhibits: CaseExhibit[];
  edges: CaseEdge[];
  narratives: CaseNarrative[];
  chronology: CaseEvent[];
  sources: ResearchSource[];
  counts: { sources: number; entities: number; exhibits: number; edges: number };
  /** From the editorial pass: how this file is framed, and its guard. */
  framing?: CaseFraming;
  /** How many findings the naming policy withheld from this case. */
  withheld: number;
  /** Set once the case is live: the contract's publication record. */
  publication?: { publishedAt: string; canonicalPath: string };
};

export type ResearchCaseSummary = Pick<
  ResearchCase,
  'slug' | 'caseId' | 'title' | 'question' | 'lifecycle' | 'updatedAt' | 'counts'
>;

export type ResearchIndex = {
  contract: string;
  importedFrom: string;
  updatedAt: string;
  cases: ResearchCaseSummary[];
};

/**
 * An analytic grouping over the entities, not an entity itself — which is why
 * the packet keeps it in the report rather than in a CSV.
 */
export type NetworkCommunity = {
  number: string;
  name: string;
  nodes: string[];
  binding: string;
};

export type ResearchNetwork = {
  updatedAt: string;
  question: string;
  communities: NetworkCommunity[];
  bridges: string[];
  edges: CaseEdge[];
  roster: CaseEntity[];
  sources: ResearchSource[];
  findings: string[];
  executiveSummary: string[];
  wouldChange: string[];
  limitations: string[];
  unknowns: string[];
};

const ROOT = path.join(process.cwd(), 'content-packages', 'fake-resistance');

/**
 * Package-level files are read once per process. A build renders every case
 * page from the same index; re-parsing it per page is wasted work. Individual
 * cases are not cached — each is read by exactly one page.
 */
const cache = new Map<string, Promise<unknown>>();

/**
 * Source labels are written by the research desk and carry the same program
 * shorthand its prose does — "Assembled relationship_evidence rows from cases
 * 01-07". A citation is a reading surface like any other.
 */
const readableSource = <T extends ResearchSource>(source: T): T => ({
  ...source,
  label: readable(source.label),
});

function readPackageFile<T>(file: string): Promise<T> {
  let hit = cache.get(file) as Promise<T> | undefined;
  if (!hit) {
    hit = readFile(path.join(ROOT, file), 'utf8').then((raw) => JSON.parse(raw) as T);
    cache.set(file, hit);
  }
  return hit;
}

export function getResearchIndex(): Promise<ResearchIndex> {
  return readPackageFile<ResearchIndex>('index.json');
}

export async function getResearchNetwork(): Promise<ResearchNetwork> {
  const network = await readPackageFile<ResearchNetwork>('network.json');
  // Same rewrite the case pages get — the synthesis leans hardest on program
  // shorthand, because it is the packet that talks about the other packets.
  return {
    ...network,
    question: readable(network.question),
    findings: network.findings.map(readable),
    executiveSummary: network.executiveSummary.map(readable),
    bridges: network.bridges.map(readable),
    wouldChange: network.wouldChange.map(readable),
    limitations: network.limitations.map(readable),
    unknowns: network.unknowns.map(readable),
    sources: network.sources.map(readableSource),
    edges: network.edges.map((edge) => ({ ...edge, statement: readable(edge.statement) })),
    communities: network.communities.map((community) => ({
      ...community,
      binding: readable(community.binding),
    })),
  };
}

/** The cases that are built and linked, in the packets' own order. */
export async function getCaseIndex(): Promise<ResearchCaseSummary[]> {
  const index = await getResearchIndex();
  return index.cases
    .filter((entry) => isPublishable(entry.lifecycle))
    // The imported state is where a case arrives; the editorial pass is what
    // moves it on. `getCase()` reports the same field the same way.
    .map((entry) => ({ ...entry, lifecycle: EDITORIAL_STAGE }));
}

/**
 * One case, or null when the slug is unknown or the case is held.
 *
 * A held case returns null rather than throwing: the route calls `notFound()`,
 * so holding a case removes its page without any other edit.
 */
export async function getCase(slug: string): Promise<ResearchCase | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  let record: ResearchCase;
  try {
    record = await readPackageFile<ResearchCase>(path.join('cases', `${slug}.json`));
  } catch (error) {
    // Only a missing file is "no such case". A SyntaxError from JSON.parse, or an
    // EACCES, means the packet is there and unreadable — rethrow, so a corrupted
    // case fails the build instead of rendering as a 404 nobody notices.
    // `lib/content/archive.ts` getRecord() has always done this; this loader did
    // not, and three of the seven published cases are named in no test.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!isPublishable(record.lifecycle)) return null;

  /* The editorial pass is applied here rather than at import, so re-importing
     the research cannot silently drop a withheld finding back onto the page
     or lose a technique tag. `lib/content/fake-resistance-editorial.ts` holds
     the judgments and the reasons. */
  const exhibits = record.exhibits
    .filter((exhibit) => !isSuppressed(slug, exhibit.id))
    .map((exhibit) => ({
      ...exhibit,
      statement: readable(exhibit.statement),
      techniques: techniquesFor(slug, exhibit.id),
      sources: exhibit.sources.map(readableSource),
    }));

  return {
    ...record,
    // The imported state is where a case arrives; the editorial pass is what
    // moves it on. See EDITORIAL_STAGE.
    lifecycle: EDITORIAL_STAGE,
    question: readable(record.question),
    exhibits,
    bottomLine: record.bottomLine
      .filter((point) => !isBookkeeping(slug, point.text))
      .map((point) => ({
        ...point,
        text: readable(point.text),
        sources: point.sources.map(readableSource),
      })),
    limitations: record.limitations.map(readable),
    unknowns: record.unknowns.map(readable),
    contradictions: record.contradictions.map(readable),
    wouldChange: record.wouldChange.map(readable),
    roster: record.roster.map((entity) =>
      entity.note ? { ...entity, note: readable(entity.note) } : entity,
    ),
    edges: record.edges.map((edge) => ({ ...edge, statement: readable(edge.statement) })),
    narratives: record.narratives.map((narrative) => ({
      ...narrative,
      summary: narrative.summary ? readable(narrative.summary) : narrative.summary,
      frame: narrative.frame ? readable(narrative.frame) : narrative.frame,
    })),
    chronology: record.chronology.map((event) => ({
      ...event,
      description: readable(event.description),
    })),
    sources: record.sources.map(readableSource),
    framing: framingFor(slug),
    withheld: suppressedCount(slug),
    // Only a published case carries a publication record — the contract's
    // `published_at` / `canonical_url` describe something that exists.
    publication:
      EDITORIAL_STAGE === 'published'
        ? { publishedAt: PUBLICATION.publishedAt, canonicalPath: canonicalPathFor(slug) }
        : undefined,
    counts: { ...record.counts, exhibits: exhibits.length },
  };
}

/** Every buildable case page. */
export async function caseParams(): Promise<{ slug: string }[]> {
  const cases = await getCaseIndex();
  return cases.map((entry) => ({ slug: entry.slug }));
}

/** A published finding that documents a technique, ready for the playbook. */
export type TechniqueExample = {
  techniqueId: string;
  caseSlug: string;
  caseTitle: string;
  href: string;
  statement: string;
  verdict: AssessmentValue;
  confidence?: ResearchConfidence;
};

/**
 * The exhibits documenting each technique, keyed by technique id.
 *
 * This runs in the direction that keeps the two halves honest: the playbook
 * does not keep its own list of examples, it asks which *published* findings
 * carry each tag. A case that is held, or a finding the naming policy
 * withholds, therefore disappears from the playbook automatically — a chapter
 * can never point at something the site is not showing.
 */
export async function getTechniqueExamples(): Promise<Map<string, TechniqueExample[]>> {
  const index = await getCaseIndex();
  const cases = await Promise.all(index.map((entry) => getCase(entry.slug)));
  const byTechnique = new Map<string, TechniqueExample[]>();

  for (const record of cases) {
    if (!record) continue;
    const caseTitle = record.title.split(':')[0].trim();
    for (const exhibit of record.exhibits) {
      for (const techniqueId of exhibit.techniques) {
        const list = byTechnique.get(techniqueId) ?? [];
        list.push({
          techniqueId,
          caseSlug: record.slug,
          caseTitle,
          href: `/fake-resistance/cases/${record.slug}#${exhibit.id}`,
          statement: exhibit.statement,
          verdict: exhibit.verdict,
          confidence: exhibit.confidence,
        });
        byTechnique.set(techniqueId, list);
      }
    }
  }

  return byTechnique;
}
