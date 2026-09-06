import { describe, expect, it } from 'vitest';
import { getCase, getCaseIndex } from '@/lib/content/fake-resistance-cases';
import {
  ROLE_ORDER,
  ROLE_TABLE_SLUGS,
  principalIds,
  roleOf,
} from '@/lib/content/fake-resistance-roles';
import {
  buildInvestigationModel,
  flowKindOf,
  sourceTypeOf,
} from '@/lib/content/investigation-model';

/**
 * The investigation surface joins a case's flat lists into one view model and
 * assigns each entity a part in the story. Both are hand-reviewable tables
 * over a package that can be re-imported, so these are the tripwires: a
 * re-import that renames an entity, drops one, or changes a source role
 * breaks the arithmetic here rather than the page.
 */
async function allCases() {
  const index = await getCaseIndex();
  const records = await Promise.all(index.map((entry) => getCase(entry.slug)));
  return records.filter((record): record is NonNullable<typeof record> => record !== null);
}

describe('entity roles', () => {
  it('names only entities that exist in the case they are named for', async () => {
    const records = await allCases();
    const bySlug = new Map(records.map((record) => [record.slug, record]));
    for (const slug of ROLE_TABLE_SLUGS) {
      const record = bySlug.get(slug);
      expect(record, `role table names a case that is not published: ${slug}`).toBeDefined();
      const ids = new Set(record!.roster.map((entity) => entity.id));
      const stray = principalIds(slug).filter((id) => !ids.has(id));
      expect(stray, `${slug}: role table names entities the roster lacks`).toEqual([]);
    }
  });

  it('gives every entity a role the map can render', async () => {
    const known = new Set(ROLE_ORDER.map((d) => d.role));
    for (const record of await allCases()) {
      for (const entity of record.roster) {
        expect(known.has(roleOf(record.slug, entity))).toBe(true);
      }
    }
  });

  it('never lets the table promote an unresolved identity or a control account', async () => {
    for (const record of await allCases()) {
      for (const entity of record.roster) {
        const role = roleOf(record.slug, entity);
        // Controls are decided by id before anything else; an unresolved
        // identity is decided before the table can name a participant.
        if (/^ent_(?:ctl|ctrl)[_-]/.test(entity.id)) expect(role).toBe('control');
        else if (entity.identityStatus === 'unresolved') expect(role).toBe('unresolved');
      }
    }
  });
});

describe('the investigation model', () => {
  it('points every connection, carrier and named account at a roster entity', async () => {
    for (const record of await allCases()) {
      const model = buildInvestigationModel(record);
      const ids = new Set(model.entities.map((e) => e.id));
      for (const edge of model.edges) {
        expect(ids.has(edge.fromId), `${record.slug} ${edge.id} from`).toBe(true);
        expect(ids.has(edge.toId), `${record.slug} ${edge.id} to`).toBe(true);
      }
      for (const narrative of model.narratives) {
        for (const id of narrative.carrierIds) expect(ids.has(id)).toBe(true);
      }
      for (const claim of model.claims) {
        for (const id of claim.entityIds) expect(ids.has(id)).toBe(true);
      }
      for (const event of model.events) {
        for (const id of event.entityIds) expect(ids.has(id)).toBe(true);
      }
    }
  });

  it('keeps supporting and contradicting evidence apart, by the research’s own source role', async () => {
    for (const record of await allCases()) {
      const model = buildInvestigationModel(record);
      for (const claim of model.claims) {
        for (const source of claim.supporting) expect(source.sourceRole).not.toBe('contradicting');
        for (const source of claim.contradicting) expect(source.sourceRole).toBe('contradicting');
        expect(claim.contested).toBe(claim.contradicting.length > 0);
        const original = record.exhibits.find((e) => e.id === claim.id);
        expect(claim.statement).toBe(original?.statement);
        expect(claim.confidence).toBe(original?.confidence);
        expect(claim.verdict).toBe(original?.verdict);
      }
    }
  });

  it('never grades an edge differently from the research', async () => {
    for (const record of await allCases()) {
      const model = buildInvestigationModel(record);
      for (const edge of model.edges) {
        const original = record.edges.find((e) => e.id === edge.id);
        expect(edge.evidenceClass).toBe(original?.evidenceClass);
        expect(edge.confidence).toBe(original?.confidence);
        if (edge.evidenceClass === 'inferred_coordination') expect(edge.kind).toBe('inferred');
        if (edge.evidenceClass === 'documented_relationship') {
          expect(edge.kind).toBe('relationship');
        }
      }
    }
  });

  it('back-links every entity to exactly the things that reference it', async () => {
    for (const record of await allCases()) {
      const model = buildInvestigationModel(record);
      for (const entity of model.entities) {
        const edges = model.edges.filter((e) => e.fromId === entity.id || e.toId === entity.id);
        expect(entity.edgeIds).toEqual(edges.map((e) => e.id));
        const claims = model.claims.filter((c) => c.entityIds.includes(entity.id));
        expect(entity.claimIds).toEqual(claims.map((c) => c.id));
      }
    }
  });

  it('is deterministic', async () => {
    const [record] = await allCases();
    const a = buildInvestigationModel(record);
    const b = buildInvestigationModel(JSON.parse(JSON.stringify(record)));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('typing helpers', () => {
  it('reads a Community Note as contested content, not a fact check', () => {
    expect(sourceTypeOf({ id: 's', label: 'x', kind: 'X (Twitter) Community Notes' })).toBe(
      'community_note',
    );
    expect(sourceTypeOf({ id: 's', label: 'x', kind: 'AFP Fact Check' })).toBe('fact_check');
    expect(sourceTypeOf({ id: 's', label: 'x', kind: 'X', url: 'https://x.com/a/status/1' })).toBe(
      'x_post',
    );
    expect(sourceTypeOf({ id: 's', label: 'x', kind: 'Internet Archive Wayback Machine' })).toBe(
      'archive',
    );
  });

  it('never draws an inferred edge as a flow', () => {
    expect(flowKindOf('QUOTE', 'inferred_coordination')).toBe('inferred');
    expect(flowKindOf('QUOTE', 'observed_interaction')).toBe('flow');
    expect(flowKindOf('CAPTION_COPY', 'observed_interaction')).toBe('reuse');
    expect(flowKindOf('authored', 'documented_relationship')).toBe('relationship');
  });
});
