/**
 * What the research measured, shaped for the reading surface.
 *
 * The importer next door carries the *statements* a case makes — claims,
 * edges, roster, sources. This module carries the *measurements* underneath
 * them: how much was sampled and over what window, how many findings survived
 * external checking, when the accounts actually posted, how fast an amplifier
 * followed an originator, and the computed shape of the cross-case graph.
 *
 * Three rules govern everything here.
 *
 * **Nothing is computed that the research did not already compute.** The
 * p-values, null models, community assignments and centralities are read out
 * of `analysis/out/` and the case-08 `analysis_out/` directory, never
 * re-derived. Where this module counts (posts per day, notes per case) it is
 * counting rows in a delivered table, which is arithmetic, not analysis.
 *
 * **Every number travels with what qualifies it.** A synchrony row carries its
 * p-value, null model and sample size; a metrics block carries the
 * convenience-sample caveat the suite stamps on its own outputs; a capped
 * quote tree says it was capped. A figure that shows the number without the
 * qualifier is a figure this data model cannot produce.
 *
 * **Absence is not zero.** An empty quote tree is `empty_inconclusive` and is
 * kept as that word, never rendered as "0 amplifiers" (PROBE_REPORT §8.2).
 */
import fs from 'node:fs';
import path from 'node:path';

import { readCsvCaveat, readCsvFile } from './research-csv.mjs';

/** X's legacy `createdAt` is not ISO-8601, and some rows carry it verbatim. */
const TWITTER_DATE =
  /^[A-Z][a-z]{2} ([A-Z][a-z]{2}) (\d{2}) \d{2}:\d{2}:\d{2} [+-]\d{4} (\d{4})$/;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** `YYYY-MM-DD` for either date shape, or '' when the cell cannot be read. */
export function isoDay(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const m = value.match(TWITTER_DATE);
  if (!m) return '';
  const month = String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0');
  return month === '00' ? '' : `${m[3]}-${month}-${m[2]}`;
}

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Shared inputs every case needs: which handles are control accounts, and the
 * Phase-3 first-seen table.
 *
 * Controls are the comparison group the plan makes mandatory (§4.2) — without
 * them an anomaly claim is uninterpretable — so the cadence figure has to be
 * able to draw them apart from the subjects.
 */
export function researchContext(root) {
  const roster = readCsvFile(path.join(root, 'registry', 'roster.csv'));
  const controls = new Set(
    roster
      .filter((r) => r.control_flag === 'control' && r.handle)
      .map((r) => r.handle.toLowerCase()),
  );
  const phase3 = readCsvFile(
    path.join(root, 'analysis', 'out', 'phase3', 'phase3_exhibit_summary.csv'),
  );
  return { root, controls, phase3 };
}

/** Posting volume per day, subjects and controls kept apart. */
function cadence(contentItems, handleOf, controls) {
  const byDay = new Map();
  let undated = 0;
  for (const item of contentItems) {
    const day = isoDay(item.published_at);
    if (!day) {
      undated += 1;
      continue;
    }
    if (!byDay.has(day)) byDay.set(day, { date: day, subjects: 0, controls: 0 });
    const handle = handleOf(item.author_entity_id);
    byDay.get(day)[controls.has(handle) ? 'controls' : 'subjects'] += 1;
  }
  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, undated };
}

/**
 * The synchrony pairs the case measured, with the denominator that makes them
 * readable.
 *
 * `pairsTested` is not decoration: at α = 0.05 a case testing 465 pairs
 * expects ~23 significant results from chance alone, and case 07's report
 * makes exactly that argument against reading its own temporal edges as
 * coordination. A figure that shows the survivors without the count of tests
 * would invert the finding.
 */
function synchrony(root, caseDirName) {
  const dir = path.join(root, 'analysis', 'out', caseDirName);
  const pairsPath = path.join(dir, 'synchrony_pairs.csv');
  const rows = readCsvFile(pairsPath);
  const precise = readCsvFile(path.join(dir, 'synchrony_precise.csv'));

  const fromPairs = rows.map((r) => ({
    a: r.a,
    b: r.b,
    medianSeconds: num(r.dt_median_s),
    iqrSeconds: num(r.dt_iqr_s),
    frac60: num(r.frac_dt_leq_60s),
    frac300: num(r.frac_dt_leq_300s),
    lead: r.lead,
    effectSize: num(r.effect_size),
    pValue: num(r.p_value),
    nullModel: r.null_model,
    nulls: num(r.n_nulls),
    n: (num(r.n_a) ?? 0) + (num(r.n_b) ?? 0),
  }));
  const fromPrecise = precise.map((r) => {
    const [a, b] = (r.pair ?? '').split(/\s*(?:->|→|\|)\s*/);
    return {
      a: a ?? r.pair,
      b: b ?? '',
      medianSeconds: num(r.dt_median_seconds),
      iqrSeconds: num(r.dt_iqr_seconds),
      frac60: num(r.frac_dt_leq_60s),
      frac300: num(r.frac_dt_leq_300s),
      lead: r.lead,
      effectSize: num(r.effect_size),
      pValue: num(r.p_value),
      nullModel: r.null_model,
      nulls: num(r.n_nulls),
      n: (num(r.n_originator) ?? 0) + (num(r.n_amplifier) ?? 0),
      precise: true,
    };
  });

  const significant = fromPairs.filter((p) => (p.pValue ?? 1) < 0.05);
  const seen = new Set(fromPrecise.map((p) => `${p.a}|${p.b}`));
  const chosen = [
    ...fromPrecise,
    ...significant
      .filter((p) => !seen.has(`${p.a}|${p.b}`) && !seen.has(`${p.b}|${p.a}`))
      .sort((x, y) => (x.pValue ?? 1) - (y.pValue ?? 1) || (x.medianSeconds ?? 0) - (y.medianSeconds ?? 0)),
  ].slice(0, 12);

  return {
    pairs: chosen,
    pairsTested: fromPairs.length,
    significantPairs: significant.length,
    expectedByChance: fromPairs.length ? Math.round(fromPairs.length * 0.05) : 0,
    /* The suite writes its convenience-sample caveat either as a leading `#`
       line or as a column repeated on every row, depending on which writer
       produced the file. Both are the same sentence and it has to reach the
       page either way — a figure that loses its caveat is the failure mode
       this whole data model exists to prevent. */
    caveat: readCsvCaveat(pairsPath) || (rows[0]?.caveat ?? '').replace(/^CAVEAT:\s*/i, ''),
  };
}

/** Phase-3 quote-tree first-seen rows for one case. */
function firstSeen(phase3, caseDirName) {
  return phase3
    .filter((r) => r.case === caseDirName)
    .map((r) =>
      Object.fromEntries(
        Object.entries({
          exhibit: r.tweet_id,
          label: r.label,
          quotes: num(r.quotes_n),
          retweeters: num(r.retweeters_n),
          // `exhausted` is the difference between "nobody was earlier" and
          // "the page cap stopped us before we could see".
          treeState:
            r.quotes_verdict === 'populated'
              ? r.quotes_tree_exhausted === 'True'
                ? 'exhausted'
                : 'capped'
              : r.quotes_verdict,
          firstQuoter: r.first_quoter_handle,
          firstQuoterAt: r.first_quoter_createdAt,
          windowCaveat: r.first_quoter_window_caveat === 'no' ? '' : r.first_quoter_window_caveat,
          rosterLed: r.roster_led === 'True',
          quoteViews: num(r.downstream_reach_quote_views),
          retweeterFollowers: num(r.downstream_reach_retweeter_followers),
        }).filter(([, v]) => v !== undefined && v !== ''),
      ),
    );
}

/**
 * Everything the case page's evidence strip and figures need, computed from
 * the packet's own tables.
 */
export function caseStats(caseDir, ctx, { entities, sources, claims }) {
  const caseDirName = path.basename(caseDir);
  const contentItems = readCsvFile(path.join(caseDir, 'data', 'content_items.csv'));
  const notes = readCsvFile(path.join(caseDir, 'data', 'community_notes_join.csv'));

  const handleById = new Map(
    entities.filter((e) => e.handle).map((e) => [e.entity_id, e.handle.toLowerCase()]),
  );
  const handleOf = (id) => handleById.get(id) ?? '';

  const { days, undated } = cadence(contentItems, handleOf, ctx.controls);
  const dated = days.reduce((sum, d) => sum + d.subjects + d.controls, 0);

  const controlAccounts = new Set();
  const subjectAccounts = new Set();
  for (const e of entities) {
    if (!e.handle) continue;
    (ctx.controls.has(e.handle.toLowerCase()) ? controlAccounts : subjectAccounts).add(
      e.handle.toLowerCase(),
    );
  }

  const corroboration = {};
  for (const claim of claims) {
    const status = claim.external_corroboration_status;
    if (status) corroboration[status] = (corroboration[status] ?? 0) + 1;
  }

  const noted = new Set();
  const helpful = new Set();
  for (const row of notes) {
    if (!row.note_id) continue;
    noted.add(row.content_id);
    if (/HELPFUL/i.test(row.status ?? '')) helpful.add(row.content_id);
  }

  const independenceGroups = new Set(
    sources.map((s) => s.independence_group).filter(Boolean),
  );

  return {
    sampled: contentItems.length,
    undated,
    window: days.length ? { start: days[0].date, end: days[days.length - 1].date } : undefined,
    accounts: subjectAccounts.size + controlAccounts.size,
    subjectAccounts: subjectAccounts.size,
    controlAccounts: controlAccounts.size,
    sources: sources.length,
    independenceGroups: independenceGroups.size,
    corroboration,
    communityNotes: { items: contentItems.length, withNote: noted.size, helpful: helpful.size },
    cadence: { days, dated, undated },
    synchrony: synchrony(ctx.root, caseDirName),
    firstSeen: firstSeen(ctx.phase3, caseDirName),
  };
}

// ---------- the computed cross-case graph ----------

/**
 * Community labels as case 09 names them.
 *
 * The five communities are a computed result (Louvain over the merged graph),
 * but what each one *is* — an aggregator lane, a state-media lane — is a
 * reading the synthesis report states in prose. Parsing it here keeps the
 * label attached to the community it describes instead of retyping it into
 * the site, where it would drift the first time the research changed.
 */
function communityLabels(synthesisReport) {
  const section = synthesisReport.slice(
    Math.max(0, synthesisReport.search(/^##\s*\d*\.?\s*Network Architecture/im)),
  );
  const body = section.slice(1).search(/^##\s/m);
  const text = body === -1 ? section : section.slice(0, body + 1);
  const labels = new Map();
  const re = /\*\*Communit(?:y|ies)\s+([\d\s&and]+?)\s*[—–-]\s*([^(*:]+?)(?:\s*\(([^)]*)\))?:\*\*\s*([^\n]*)/gi;
  let m;
  while ((m = re.exec(text))) {
    const ids = m[1].match(/\d+/g) ?? [];
    for (const id of ids) {
      labels.set(Number(id), {
        label: m[2].trim(),
        // The report writes handles as code spans; on a page they are names.
        note: (m[4] ?? '').replace(/`([^`]+)`/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').trim(),
      });
    }
  }
  return labels;
}

/**
 * The cross-case network as the research computed it: 188 nodes, 595 edges,
 * five Louvain communities — not the 18-node hand-asserted sketch it replaced.
 *
 * At this size a node-link drawing of every account is a hairball, and the arc
 * diagram this repo already ships was argued for a graph a tenth as dense
 * (`components/network/layout.ts`). So the payload carries two levels: the
 * community aggregate, which is the finding, and the p-valued coordination
 * subgraph, which is the only layer whose edges are inferential and therefore
 * the only one small enough and serious enough to draw account by account.
 */
export function computedNetwork(root, synthesisReport) {
  const dir = path.join(root, '08-cross-cluster-network', 'analysis_out');
  const metricsDir = path.join(dir, 'network_metrics_computed');
  const summaryPath = path.join(metricsDir, 'metrics_summary.json');
  if (!fs.existsSync(summaryPath)) return null;

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const louvain = readCsvFile(path.join(metricsDir, 'louvain.csv'));
  const pagerank = readCsvFile(path.join(metricsDir, 'pagerank.csv'));
  const degrees = readCsvFile(path.join(metricsDir, 'degrees.csv'));
  const nodes = readCsvFile(path.join(dir, 'nodes.csv'));
  const interactions = readCsvFile(path.join(dir, 'interaction_edges.csv'));
  const coordination = readCsvFile(path.join(dir, 'coordination_carryover.csv'));

  const communityOf = new Map(louvain.map((r) => [r.node, Number(r.community)]));
  const pagerankOf = new Map(pagerank.map((r) => [r.node, num(r.pagerank)]));
  const degreeOf = new Map(degrees.map((r) => [r.node, num(r.total_degree)]));
  const nodeMeta = new Map(nodes.map((r) => [r.handle.toLowerCase(), r]));
  const labels = communityLabels(synthesisReport);

  const isControl = (handle) => (nodeMeta.get(handle)?.control_flag ?? '') === 'control';

  // ---- communities
  const byCommunity = new Map();
  for (const [handle, id] of communityOf) {
    if (!byCommunity.has(id)) {
      byCommunity.set(id, { id, size: 0, controls: 0, subjects: 0, members: [] });
    }
    const c = byCommunity.get(id);
    c.size += 1;
    c[isControl(handle) ? 'controls' : 'subjects'] += 1;
    c.members.push(handle);
  }
  const communities = [...byCommunity.values()]
    .map((c) => {
      const hubs = c.members
        .slice()
        .sort((a, b) => (pagerankOf.get(b) ?? 0) - (pagerankOf.get(a) ?? 0))
        .slice(0, 5);
      const named = labels.get(c.id);
      return {
        id: c.id,
        label: named?.label ?? `Community ${c.id}`,
        note: named?.note ?? '',
        size: c.size,
        subjects: c.subjects,
        controls: c.controls,
        hubs,
        // Full membership, so the site can join an entity to its community by
        // handle instead of maintaining a hand-written lookup table.
        members: c.members.slice().sort(),
        cases: [
          ...new Set(
            c.members
              .map((h) => nodeMeta.get(h)?.assigned_case ?? '')
              .flatMap((v) => v.split(';'))
              .filter(Boolean),
          ),
        ].sort(),
      };
    })
    .sort((a, b) => b.size - a.size);

  // ---- edges between communities (the level-1 drawing)
  const pairKey = (a, b) => (a <= b ? `${a}|${b}` : `${b}|${a}`);
  const between = new Map();
  let unplaced = 0;
  for (const e of interactions) {
    const a = communityOf.get(e.source_handle);
    const b = communityOf.get(e.target_handle);
    if (a === undefined || b === undefined) {
      unplaced += 1;
      continue;
    }
    const key = pairKey(a, b);
    if (!between.has(key)) {
      between.set(key, { from: Math.min(a, b), to: Math.max(a, b), weight: 0, edges: 0, internal: a === b });
    }
    const row = between.get(key);
    row.weight += num(e.weight) ?? 0;
    row.edges += 1;
  }
  const communityEdges = [...between.values()].sort((a, b) => b.weight - a.weight);

  // ---- the p-valued coordination subgraph (the level-2 drawing)
  const coordinationEdges = coordination
    .map((r) => ({
      a: r.author_a,
      b: r.author_b,
      pValue: num(r.min_p_bonferroni),
      traces: (r.traces ?? '')
        .split(';')
        .map((t) => t.split(':').pop())
        .filter(Boolean),
      multiTrace: r.multi_trace === 'True',
      confidenceCap: r.confidence_cap,
      sampleN: num(r.sample_n),
      nullModel: r.null_model,
      analysisOutput: (r.analysis_output_path ?? '').split('/').filter(Boolean).slice(-2).join('/'),
      communityA: communityOf.get(r.author_a),
      communityB: communityOf.get(r.author_b),
      crossCommunity:
        communityOf.get(r.author_a) !== undefined &&
        communityOf.get(r.author_b) !== undefined &&
        communityOf.get(r.author_a) !== communityOf.get(r.author_b),
      controlSide: isControl(r.author_a) || isControl(r.author_b),
    }))
    .sort((x, y) => (x.pValue ?? 1) - (y.pValue ?? 1));

  // ---- the accounts worth naming in the drawing
  const topNodes = [...communityOf.keys()]
    .map((handle) => ({
      handle,
      community: communityOf.get(handle),
      pagerank: pagerankOf.get(handle),
      degree: degreeOf.get(handle),
      control: isControl(handle),
      cases: (nodeMeta.get(handle)?.assigned_case ?? '').split(';').filter(Boolean),
    }))
    /* Ranked by degree, not PageRank. PageRank on a directed graph hands a
       high score to a sink with one in-edge from a hub — @yairlapid ranks
       third on a single edge — which would put an account the research barely
       touched at the top of a drawing about who is connected to whom. Degree
       is what `components/network/layout.ts` already orders by, and it says
       something a reader can check. PageRank travels as a field. */
    .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0) || (b.pagerank ?? 0) - (a.pagerank ?? 0))
    .slice(0, 40);

  return {
    metrics: {
      nodes: summary.summary?.n_nodes,
      edges: summary.summary?.n_edges,
      communities: summary.summary?.n_louvain_communities,
      bridges: summary.summary?.n_structural_bridges,
      maxKCore: summary.summary?.max_k_core,
      coordinationEdges: coordinationEdges.length,
      interactionEdges: interactions.length,
      unplacedInteractionEdges: unplaced,
    },
    caveat: summary.caveat ?? '',
    communities,
    communityEdges,
    coordinationEdges,
    topNodes,
  };
}
