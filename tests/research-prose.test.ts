import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseRefutation,
  parseResearchParagraph,
  parseResearchProse,
  refutationLabel,
  splitClaimFromEvidence,
} from '@/components/research/research-prose';

/**
 * The block structure the importer flattened, and the guards that keep the
 * recovery off ordinary prose.
 *
 * The bug this covers was visible in production: `/fake-resistance/network`
 * opened its central finding as "…a double refutation: 1. Against the
 * 'monolithic conspiracy' model: … 2. Against the 'overlapping bot fabric'
 * model: …" set as one running paragraph, and a second block as "…tight,
 * empirical coupling: - Jackson Hinkle and @WelcomeTheGulag function as an
 * int…". The markers were reaching the page as literal text.
 *
 * The risk in fixing it is the opposite failure — a scanner eager enough to
 * cut ordinary sentences into list items — so most of what follows is the
 * negative case.
 */
describe('parseResearchParagraph', () => {
  it('recovers a flattened enumeration and drops the markers', () => {
    const blocks = parseResearchParagraph(
      'The central finding of this investigation is a double refutation: 1. Against the "monolithic conspiracy" model: The network is not a single unified machine. 2. Against the "overlapping bot fabric" model: Commercial claims are contradicted by primary data.',
    );

    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block.kind).toBe('list');
    if (block.kind !== 'list') return;
    expect(block.ordered).toBe(true);
    expect(block.lead).toBe('The central finding of this investigation is a double refutation:');
    expect(block.items).toHaveLength(2);
    expect(block.items[0]).toMatch(/^Against the "monolithic conspiracy" model:/);
    expect(block.items[1]).toMatch(/^Against the "overlapping bot fabric" model:/);
    expect(block.items.join(' ')).not.toMatch(/^\d+\./);
  });

  it('recovers a flattened bulleted run', () => {
    const blocks = parseResearchParagraph(
      'At the same time, specific sub-structures show tight, empirical coupling: - Jackson Hinkle and @WelcomeTheGulag function as an integrated clip-mill. - Iranian state media accounts operate coordinated broadcast bursts. - Recycled conflict media remains the primary vector.',
    );

    const [block] = blocks;
    expect(block.kind).toBe('list');
    if (block.kind !== 'list') return;
    expect(block.ordered).toBe(false);
    expect(block.items).toHaveLength(3);
    expect(block.items[0]).toMatch(/^Jackson Hinkle/);
  });

  it('drops a paragraph that is only a horizontal rule', () => {
    expect(parseResearchParagraph('---')).toEqual([]);
    expect(parseResearchParagraph('  ***  ')).toEqual([]);
  });

  it('strips a rule glued to the end of a real paragraph', () => {
    const [block] = parseResearchParagraph('Recycled conflict media remains the vector. ---');
    expect(block).toEqual({
      kind: 'para',
      text: 'Recycled conflict media remains the vector.',
    });
  });

  /* The guard that matters most. An enumeration counts from one; a sentence
     that happens to end on a year does not, and used to be the thing a naive
     `\d+\.` scanner cut a paragraph in half on. */
  it('leaves a sentence that merely contains a number and a full stop alone', () => {
    const text =
      'The cross-case record has two dated states: the hand-drawn reading published on 26 August 2026 and the computed rebuild of 6 September 2026. Each row is one change in interpretation between them.';
    expect(parseResearchParagraph(text)).toEqual([{ kind: 'para', text }]);
  });

  it('leaves spaced em dashes and hyphenated identifiers alone', () => {
    const text =
      'This synthesis integrates findings from eight investigations (01-hinkle-machine through 08-cross-cluster-network) — a combined corpus — and grades each edge.';
    expect(parseResearchParagraph(text)).toEqual([{ kind: 'para', text }]);
  });

  it('needs at least two markers before it will cut a paragraph', () => {
    const text = 'The flow runs in stages. 1. Seeding is the first of them and the rest follow.';
    expect(parseResearchParagraph(text)).toEqual([{ kind: 'para', text }]);
  });

  it('refuses a run whose items are too short to be items', () => {
    const text = 'Scores were - a - b - c across the sample and nothing further was recorded.';
    expect(parseResearchParagraph(text)).toEqual([{ kind: 'para', text }]);
  });
});

describe('splitClaimFromEvidence', () => {
  it('separates the bold finding from the statistics behind it', () => {
    const { claim, evidence } = splitClaimFromEvidence(
      '**The "70%" figure is dead; the production-cell coupling is not.** Over the deep sample, 287 of Hinkle\'s 790 non-retweet posts (36.3%) are quote-posts of @WelcomeTheGulag; 92.0% land within one hour.',
    );

    expect(claim).toBe('The "70%" figure is dead; the production-cell coupling is not.');
    expect(evidence).toMatch(/^Over the deep sample/);
    expect(evidence).not.toContain('70%');
  });

  it('leaves a point with nothing substantial behind the claim as one paragraph', () => {
    const text = '**The flow is strictly one-way.** Zero of 800 posts.';
    expect(splitClaimFromEvidence(text)).toEqual({ claim: null, evidence: text });
  });

  it('leaves an unemphasised point alone', () => {
    const text =
      'Mention edges are text-derived and include ordinary fan-to-celebrity tagging; caption-copy direction rests on the earliest timestamp in the sample.';
    expect(splitClaimFromEvidence(text)).toEqual({ claim: null, evidence: text });
  });
});

describe('parseRefutation', () => {
  it('turns the packet’s own model name into a plain-language label', () => {
    const { model, statement } = parseRefutation(
      'Against the "monolithic conspiracy" model: The network is not a single unified machine directed by a hidden hand.',
    );
    expect(model).toBe('monolithic conspiracy');
    expect(statement).toBe(
      'The network is not a single unified machine directed by a hidden hand.',
    );
    expect(refutationLabel(model!)).toBe('Not a monolithic conspiracy');
  });

  it('picks the article from the model name', () => {
    expect(refutationLabel('overlapping bot fabric')).toBe('Not an overlapping bot fabric');
  });

  it('falls back to the finding itself when it is not written as a refutation', () => {
    const text = 'Recycled conflict media remains the primary vector of factual vulnerability.';
    expect(parseRefutation(text)).toEqual({ model: null, statement: text });
  });

  /* The degraded case must never be a blank label. A caller renders the label
     only when `model` is set, so a packet that stops writing refutations gets
     its sentence with no label rather than a heading with nothing in it. */
  it('never returns an empty model for a non-empty finding', () => {
    for (const text of [
      'Recycled conflict media remains the primary vector.',
      'Against the model: something that does not match the shape.',
      'AGAINST THE "shouting" MODEL: case matters, so this does not match.',
    ]) {
      const { model, statement } = parseRefutation(text);
      expect(model === null || model.length > 0).toBe(true);
      expect(statement.length).toBeGreaterThan(0);
    }
  });

  /* The fallback path is exactly where a flattened list would hide, so it is
     parsed rather than passed through raw. Reading the unparsed string here
     would put `1.` back on the page in the one branch nobody looks at. */
  it('does not leak list markers when a finding is itself a flattened list', () => {
    const { model, statement } = parseRefutation(
      'The reading rests on two legs: 1. The follower census refutes the bot thesis outright. 2. The timing test survives every null model it was run against.',
    );
    expect(model).toBeNull();
    expect(statement).toBe('The reading rests on two legs:');
    expect(statement).not.toMatch(/\d+\.\s/);
  });

  it('returns an empty statement for an empty finding, so a caller can drop the row', () => {
    expect(parseRefutation('')).toEqual({ model: null, statement: '' });
    expect(parseRefutation('   ---  ')).toEqual({ model: null, statement: '' });
  });
});

/**
 * The regression this exists to prevent, measured against the real packet
 * rather than a fixture: nothing the network page renders as prose may still
 * carry a literal list marker.
 */
describe('the network packet as published', () => {
  it('leaves no literal list marker in any rendered block', async () => {
    const raw = await readFile(
      path.join(process.cwd(), 'content-packages', 'fake-resistance', 'network.json'),
      'utf8',
    );
    const network = JSON.parse(raw) as {
      executiveSummary: string[];
      findings: string[];
      limitations: string[];
    };

    const blocks = parseResearchProse([
      ...network.executiveSummary,
      ...network.findings,
      ...network.limitations,
    ]);
    const rendered = blocks.flatMap((block) =>
      block.kind === 'para' ? [block.text] : [block.lead ?? '', ...block.items],
    );

    for (const text of rendered) {
      expect(text, text.slice(0, 80)).not.toMatch(/(?:^|:\s)\s*(?:\d+\.|[-*])\s+\S/);
      expect(text, text.slice(0, 80)).not.toMatch(/-{3,}\s*$/);
    }

    // And the central finding did survive as a list rather than as prose.
    const ordered = blocks.filter((block) => block.kind === 'list' && block.ordered);
    expect(ordered).not.toHaveLength(0);
  });
});
