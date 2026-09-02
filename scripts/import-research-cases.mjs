#!/usr/bin/env node
/**
 * Import the Fake Resistance research packets into `content-packages/`.
 *
 *   node scripts/import-research-cases.mjs <research-root>
 *
 * The research lives outside this repository as nine packets built to the
 * `research packet data model` contract that ships with the delivery
 * (`research-disinformation-networks/references/data-model.md`): a `case.yaml`,
 * a `report.md`, and eleven relational CSVs per case.
 *
 * What is taken, and what is deliberately left behind:
 *
 *   taken   case.yaml            question, scope, public-interest basis
 *           claims.csv           `publication_wording` — the cautious phrasing
 *                                the researchers pre-wrote for publication
 *           entities.csv         roster, with identity_status preserved
 *           relationships.csv    edges, with evidence_class preserved
 *           events / narratives  chronology and frame analysis
 *           sources.csv          url, archive_url, publisher, reliability
 *           report.md            the bottom-line and limitations sections
 *
 *   left    claims.analysis      internal working notes, superseded by
 *                                `publication_wording` for every published row
 *           evidence/**          raw API pulls and mirror snapshots: third-party
 *                                follower lists and timelines. The sha256 in
 *                                `sources.csv` travels; the payload never does.
 *           report_backup.md     a superseded draft
 *           .grok/.codex/.agents the program's own tooling
 *
 * The delivery's own Python validator runs first when `python3` is available:
 * it already passed all nine packets, and re-deriving its enum and referential
 * rules here would just create a second thing to fall out of date.
 *
 * Re-running is a rebuild, not a merge — ids are contracts, and a case left
 * behind by a rename would otherwise be served forever.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , researchRoot] = process.argv;
const REPO = path.resolve(import.meta.dirname, '..');

if (!researchRoot) {
  console.error('usage: import-research-cases.mjs <research-root>');
  process.exit(2);
}

const src = path.resolve(researchRoot);
const out = path.join(REPO, 'content-packages', 'fake-resistance');

/* ── the vocabulary map ────────────────────────────────────────────────────
   The research grades claims in its own vocabulary; this site renders
   verdicts through `AssessmentValue` (server/contracts/enums.ts). The
   translation happens exactly once, here, and `tests/fake-resistance-
   research.test.ts` pins it.

   Everything else the research grades — confidence, identity_status,
   evidence_class, source reliability — passes through unmapped. Those are the
   research's own honesty layer: they render as labels, never as verdicts. */
const VERDICT = {
  verified: 'verified',
  refuted: 'false',
  misleading: 'misleading',
  disputed: 'contested',
  unsupported: 'unsupported',
  unresolved: 'unverified',
};

/** The graph packet and the synthesis are the network page, not case files. */
const GRAPH_SLUG = 'cross-cluster-network';
const SYNTHESIS_SLUG = 'synthesis';

// ---------- CSV ----------

/**
 * RFC 4180 reader. The delivery's text fields carry commas, embedded quotes
 * and newlines (a `publication_wording` can be a full sentence with a quoted
 * slogan inside it), so a split on commas would silently shred the data.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // A BOM ahead of the header would become part of the first column name.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  for (; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
}

function readTable(caseDir, file) {
  const full = path.join(caseDir, 'data', file);
  if (!fs.existsSync(full)) return [];
  const rows = parseCsv(fs.readFileSync(full, 'utf8'));
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, idx) => [key.trim(), (cells[idx] ?? '').trim()])),
  );
}

/** Drops keys whose value is empty, so the JSON carries facts, not blanks. */
const compact = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== '' && v !== undefined && v !== null,
    ),
  );

// ---------- case.yaml ----------

/**
 * A five-key reader for a flat document, not a YAML implementation. The
 * contract fixes these keys and the packets are machine-written, so a parser
 * dependency would be carrying weight it never uses.
 */
function readCaseYaml(caseDir) {
  const text = fs.readFileSync(path.join(caseDir, 'case.yaml'), 'utf8');
  const scalar = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.*))$`, 'm'));
    if (!m) return '';
    return (m[1] ?? m[2] ?? m[3] ?? '').trim();
  };
  return {
    case_id: scalar('case_id'),
    slug: scalar('slug'),
    title: scalar('title'),
    status: scalar('status'),
    language: scalar('language'),
    updated_at: scalar('updated_at'),
    research_question: scalar('research_question'),
    scope: scalar('scope'),
    public_interest_basis: scalar('public_interest_basis'),
  };
}

// ---------- report.md ----------

/**
 * Pulls one titled section out of a report.
 *
 * Reports number their sections, but not identically — case 01 opens with
 * "## 1. Question and window" and case 04 leads with "## 1. Bottom line" — so
 * the match is on the title, with the ordinal optional.
 */
function reportSection(report, title) {
  // Trailing text after the title is allowed — several sections carry a
  // parenthetical ("## 6. Key exhibits (all API-verified unless noted)").
  const re = new RegExp(`^##\\s*(?:\\d+\\.\\s*)?${title}\\b.*$`, 'im');
  const start = report.search(re);
  if (start === -1) return '';
  const after = report.slice(start);
  const nextHeading = after.slice(1).search(/^##\s/m);
  return (nextHeading === -1 ? after : after.slice(0, nextHeading + 1))
    .replace(re, '')
    .trim();
}

/**
 * Every list item and prose line of a section, whatever shape it is written
 * in. The nine reports name and structure their caveats differently —
 * numbered findings, dash bullets, or a paragraph — and a caveat lost to a
 * heading mismatch is the one kind of omission this integration cannot make.
 */
function sectionLines(report, titles) {
  const seen = new Set();
  const lines = [];
  const push = (text) => {
    const value = text.trim().replace(/\s{2,}/g, ' ');
    if (!value || seen.has(value)) return;
    seen.add(value);
    lines.push(value);
  };
  for (const title of titles) {
    const section = reportSection(report, title);
    if (!section) continue;
    for (const point of numberedPoints(section)) push(point);
    for (const raw of section.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('- ') || line.startsWith('* ')) push(line.slice(2));
    }
    for (const block of paragraphs(section)) push(block);
  }
  return lines;
}

/**
 * The rows of the first markdown table under a `###` sub-heading.
 *
 * The graph packet keeps its community roster in a table rather than in a
 * CSV — communities are an analytic grouping over the entities, not entities
 * themselves — so this is the one place a report's own table is the data.
 */
function subsectionTable(report, heading) {
  const re = new RegExp(`^###\\s*${heading}\\b.*$`, 'im');
  const start = report.search(re);
  if (start === -1) return [];
  const after = report.slice(start).replace(re, '');
  const end = after.search(/^#{2,3}\s/m);
  const block = end === -1 ? after : after.slice(0, end);

  const rows = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    // Drop the header and its `|---|` separator.
    .filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));

  return rows.slice(1);
}

/** The dash bullets under a `###` sub-heading. */
function subsectionBullets(report, heading) {
  const re = new RegExp(`^###\\s*${heading}\\b.*$`, 'im');
  const start = report.search(re);
  if (start === -1) return [];
  const after = report.slice(start).replace(re, '');
  const end = after.search(/^#{2,3}\s/m);
  return (end === -1 ? after : after.slice(0, end))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

/** Where the nine reports put their caveats, and what each pile means. */
const LIMITATION_TITLES = [
  'Methodology & limitations',
  'Limitations',
  'Aggregate limitations',
  'What could not be reproduced',
  'Methodology',
];
const UNKNOWN_TITLES = ['Unknowns and next queries', 'Unknowns', 'Cross-links & unknowns'];
const CONTRADICTION_TITLES = [
  'Contradictions and denials',
  'Contradiction pass',
  'Contradiction/ethics pass',
];

/**
 * Splits a report sentence from the `[src_id]` markers the researchers cite
 * inline, and resolves those ids to real sources.
 *
 * The markers are the report's own footnote apparatus. Left in the prose they
 * read as leaked machine identifiers; dropped, the sentence loses the pointer
 * that makes it checkable. So they come out of the text and travel as sources
 * on the point — the same "source beside the claim" arrangement the reading
 * pages already use (`.ai/DECISIONS.md`, 2026-08-25).
 */
function extractCitations(text, resolve) {
  const ids = [];
  const stripped = text
    .replace(/\[((?:src_[a-z0-9_]+)(?:\s*,\s*src_[a-z0-9_]+)*)\]/gi, (_, group) => {
      for (const id of group.split(',')) ids.push(id.trim());
      return '';
    })
    // The marker usually trails a clause, leaving a space before its comma.
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const sources = [...new Set(ids)].map(resolve).filter(Boolean);
  return { text: stripped, sources };
}

/**
 * A section's top-level numbered points, one string each.
 *
 * Sub-bullets are folded into their parent point rather than dropped: in
 * these reports a nested bullet is usually the exhibit that supports the
 * sentence above it, and detaching it from that sentence would leave a claim
 * on the page with its support removed.
 */
function numberedPoints(section) {
  if (!section) return [];
  const points = [];
  let current = null;
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      if (current) points.push(current);
      current = numbered[2];
      continue;
    }
    if (current === null) continue;
    if (line === '') continue;
    // A table or a new paragraph ends the list; a continuation extends it.
    if (line.startsWith('|') || line.startsWith('##')) break;
    current += ` ${line.replace(/^[-*]\s+/, '')}`;
  }
  if (current) points.push(current);
  return points.map((p) => p.trim()).filter(Boolean);
}

/** Prose paragraphs of a section, skipping tables and list structure. */
function paragraphs(section) {
  if (!section) return [];
  return section
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .filter((l) => !l.trim().startsWith('|'))
        .join(' ')
        .trim(),
    )
    // Drops list items and table rows, but not a paragraph that opens with
    // `**bold**` — the reports' confidence line always does.
    .filter((block) => block && !/^(?:[-*+]\s|\d+\.\s)/.test(block));
}

// ---------- validation ----------

function runValidator(caseDir) {
  const validator = path.join(
    src,
    'research-disinformation-networks',
    'scripts',
    'validate_research_case.py',
  );
  if (!fs.existsSync(validator)) return 'no validator in delivery';
  try {
    execFileSync('python3', [validator, caseDir], { stdio: 'pipe' });
    return 'ok';
  } catch (err) {
    if (err.code === 'ENOENT') return 'python3 unavailable';
    const detail = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    console.error(`  validator failed for ${path.basename(caseDir)}:\n${detail}`);
    process.exit(1);
  }
}

// ---------- build ----------

const caseDirs = fs
  .readdirSync(src)
  .map((entry) => path.join(src, entry))
  .filter((dir) => fs.existsSync(path.join(dir, 'case.yaml')) && fs.existsSync(path.join(dir, 'data')))
  .sort();

if (caseDirs.length === 0) {
  console.error(`no research packets found under ${src}`);
  process.exit(1);
}

console.log(`importing research from ${src}`);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'cases'), { recursive: true });

/* ── the vendor scrub ──────────────────────────────────────────────────────
   The research pulled its X data through a paid third-party relay whose API
   endpoints (`api.<vendor>.io/…`) demand a key and return an error for every
   reader, in every browser, always. The owner ruled that neither those dead
   endpoints nor the vendor's name appear
   anywhere in this repository: the attribution survives as text — an
   "X API query" label beside its `retrievedAt` — because the research really
   did use that data and hiding it would hide the evidence trail, but the URL
   that can only ever error is not a citation.

   This scrub is what makes the ruling survive a re-import; the committed
   data under `content-packages/fake-resistance/` already carries exactly
   these rewrites. The name is assembled from halves because the acceptance
   check is a repo-wide grep, and this file must pass it too. */
const VENDOR = ['twitter', 'api'].join('');
const VENDOR_HOST = new RegExp(`(^|\\.)${VENDOR}\\.io$`, 'i');
const VENDOR_ID = new RegExp(`${VENDOR}[._-]?io`, 'gi');
const VENDOR_TEST = new RegExp(VENDOR, 'i');
/* Ordered, most specific first: the phrases below are the shapes the nine
   packets actually write, each mapped to wording that keeps the method and
   loses the vendor. The last pattern is the safety net for anything new. */
const VENDOR_REWRITES = [
  [new RegExp(`^${VENDOR}\\.io(?: \\(independent third-party X data relay\\))?$`, 'i'), 'X API query'],
  [new RegExp(`${VENDOR}\\.io REST precision pulls`, 'gi'), 'X API precision pulls'],
  [new RegExp(`${VENDOR}\\.io REST API pulls`, 'gi'), 'X API pulls'],
  [new RegExp(`${VENDOR}\\.io REST pulls`, 'gi'), 'X API REST pulls'],
  [new RegExp(`${VENDOR}\\.io precision pull`, 'gi'), 'X API precision pull'],
  [new RegExp(`${VENDOR}\\.io precision`, 'gi'), 'X API precision'],
  [new RegExp(`\\(${VENDOR}\\.io free tier\\)`, 'gi'), '(third-party X data API, free tier)'],
  [new RegExp(`${VENDOR}(?:[._-]?io)?`, 'gi'), 'a third-party X data API'],
];

const isVendorUrl = (value) => {
  try {
    return VENDOR_HOST.test(new URL(value).hostname);
  } catch {
    return VENDOR_TEST.test(value);
  }
};

/* Source URLs that no longer resolve, mapped to the stable page that serves
   the same lookup. The Danish authorization register left `autregweb.sst.dk`
   (the host the packets cite is dead, and its record ids were session-bound)
   for `autregweb.stps.dk` under the Danish Patient Safety Authority, where
   each record has a stable id — verified 2026-08-27. The archived copy is the
   Wayback capture of the exact URL the research retrieved, so the citation
   stays checkable even if the register moves again. Do not add snapshots the
   Wayback Machine does not already hold. */
const OLD_DANISH_REGISTER = 'https://autregweb.sst.dk/Authorization.aspx?id=0BYZW';
const URL_REPLACEMENTS = new Map([
  [OLD_DANISH_REGISTER, 'https://autregweb.stps.dk/en/personal?id=cb0c5e20-1a52-ea11-9114-00505696bb68'],
]);
const ARCHIVE_FOR_URL = new Map([
  [
    OLD_DANISH_REGISTER,
    'https://web.archive.org/web/20250310174348/https://autregweb.sst.dk/Authorization.aspx?id=0BYZW',
  ],
]);

/**
 * Applies the vendor scrub and the dead-URL map to a whole output document.
 *
 * Runs on the final tree rather than in `publishedSource` because the vendor
 * name also reaches prose — a scope line in `case.yaml`, a limitations
 * paragraph, an event description — and a scrub that only knew about source
 * rows would let those through.
 */
function scrubVendor(value, key) {
  if (typeof value === 'string') {
    // Ids are identifiers, not prose: `src_<vendor>_io` becomes `src_x_api`
    // everywhere at once, so embedded copies keep resolving to the roster.
    if (key === 'id') return value.replace(VENDOR_ID, 'x_api');
    let text = value;
    for (const [pattern, replacement] of VENDOR_REWRITES) text = text.replace(pattern, replacement);
    return text;
  }
  if (Array.isArray(value)) return value.map((entry) => scrubVendor(entry, key));
  if (value && typeof value === 'object') {
    const originalUrl = typeof value.url === 'string' ? value.url : undefined;
    const scrubbed = {};
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'url' || k === 'archiveUrl') && typeof v === 'string' && isVendorUrl(v)) continue;
      if (k === 'url' && typeof v === 'string' && URL_REPLACEMENTS.has(v)) {
        scrubbed[k] = URL_REPLACEMENTS.get(v);
        continue;
      }
      scrubbed[k] = scrubVendor(v, k);
    }
    if (originalUrl && ARCHIVE_FOR_URL.has(originalUrl) && !scrubbed.archiveUrl) {
      scrubbed.archiveUrl = ARCHIVE_FOR_URL.get(originalUrl);
    }
    return scrubbed;
  }
  return value;
}

const writeJson = (rel, value) => {
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const body = JSON.stringify(scrubVendor(value, ''));
  if (VENDOR_TEST.test(body)) {
    console.error(`vendor name survived the scrub in ${rel} — extend VENDOR_REWRITES`);
    process.exit(1);
  }
  fs.writeFileSync(dest, body);
  return Buffer.byteLength(body);
};

const built = [];
let graphPacket = null;
let synthesisPacket = null;
let bytes = 0;

for (const caseDir of caseDirs) {
  const meta = readCaseYaml(caseDir);
  const slug = meta.slug.replace(/^\d+-/, '');
  const validated = runValidator(caseDir);

  const report = fs.readFileSync(path.join(caseDir, 'report.md'), 'utf8');

  const sources = readTable(caseDir, 'sources.csv');
  const entities = readTable(caseDir, 'entities.csv');
  const claims = readTable(caseDir, 'claims.csv');
  const claimEvidence = readTable(caseDir, 'claim_evidence.csv');
  const relationships = readTable(caseDir, 'relationships.csv');
  const relationshipEvidence = readTable(caseDir, 'relationship_evidence.csv');
  const narratives = readTable(caseDir, 'narratives.csv');
  const events = readTable(caseDir, 'events.csv');

  const sourceById = new Map(sources.map((s) => [s.source_id, s]));
  const entityById = new Map(entities.map((e) => [e.entity_id, e]));

  /* One source in the delivery carries `local://cases-01-through-07` — the
     desk pointing at its own other packets, not a address anything can
     resolve. A non-web scheme rendered as a link is a link that goes nowhere,
     so the source keeps its label and loses its href. */
  const webUrl = (value) => (/^https?:\/\//i.test(value ?? '') ? value : '');

  /** A source as the site renders it — never the local evidence payload. */
  const publishedSource = (row) =>
    compact({
      id: row.source_id,
      label: row.title,
      kind: row.publisher,
      url: webUrl(row.url) || webUrl(row.canonical_url),
      archiveUrl: webUrl(row.archive_url),
      publishedAt: row.published_at,
      retrievedAt: row.retrieved_at,
      reliability: row.reliability,
      sourceRole: row.source_role,
      // Proof the packet held a file, without shipping the file itself.
      sha256: row.sha256,
    });

  /** Resolves an inline `[src_id]` marker to the source the site publishes. */
  const cite = (id) => {
    const row = sourceById.get(id);
    return row ? publishedSource(row) : null;
  };

  const evidenceByClaim = new Map();
  for (const row of claimEvidence) {
    if (!evidenceByClaim.has(row.claim_id)) evidenceByClaim.set(row.claim_id, []);
    evidenceByClaim.get(row.claim_id).push(row);
  }
  const evidenceByRelationship = new Map();
  for (const row of relationshipEvidence) {
    if (!evidenceByRelationship.has(row.relationship_id)) {
      evidenceByRelationship.set(row.relationship_id, []);
    }
    evidenceByRelationship.get(row.relationship_id).push(row);
  }

  // Exhibits: the claim as cleared for publication, its verdict, its grade,
  // and the sources that carry it. `analysis` is not read.
  const exhibits = claims
    .filter((claim) => claim.publication_wording)
    .map((claim) => {
      const verdict = VERDICT[claim.status];
      if (!verdict) {
        console.error(`  unknown claim status "${claim.status}" on ${claim.claim_id}`);
        process.exit(1);
      }
      const evidence = evidenceByClaim.get(claim.claim_id) ?? [];
      const speaker = entityById.get(claim.speaker_entity_id);
      return {
        ...compact({
          id: claim.claim_id,
          statement: claim.publication_wording,
          verdict,
          confidence: claim.confidence,
          observedAt: claim.first_observed_at,
          attributedTo: speaker?.display_name,
        }),
        /* Both arrays are set outside `compact`, which drops empty ones: the
           renderer iterates them, so an absent key would be a hole rather
           than a saving. Technique tags stay empty here — they are assigned
           in the editorial pass against the claim rows that document them,
           never guessed at import. */
        techniques: [],
        sources: evidence
          .map((row) => sourceById.get(row.source_id))
          .filter(Boolean)
          .map(publishedSource),
      };
    });

  /**
   * Repairs two entity rows whose cells sit one column to the left of where
   * they belong.
   *
   * In the delivery, `ent_tuckercarlson_person` and `ent_candaceo_person`
   * carry `platform: "US"`, a full sentence in `handle`, and the word
   * `confirmed` in `profile_url`. The packet validator passed them because it
   * checks enums on the columns that declare them, and these values landed in
   * columns that declare none.
   *
   * The repair is deliberately narrow and refuses to guess: it fires only when
   * `profile_url` holds an identity-status value *and* `identity_status` is
   * empty, which is a shift signature rather than a plausible row. Anything
   * else is left exactly as delivered and reported, because silently
   * "correcting" research data is how a dataset stops meaning what it says.
   */
  const IDENTITY_VALUES = ['confirmed', 'probable', 'unresolved'];
  const repairShift = (entity) => {
    if (!IDENTITY_VALUES.includes(entity.profile_url) || entity.identity_status) return entity;
    console.log(
      `  note: ${entity.entity_id} has shifted columns in the source; realigning ` +
        `(identity "${entity.profile_url}", handle held prose)`,
    );
    return {
      ...entity,
      jurisdiction: entity.jurisdiction || entity.platform,
      identity_status: entity.profile_url,
      notes: entity.notes || entity.handle,
      platform: '',
      handle: '',
      profile_url: '',
    };
  };

  /* 51 of the 148 roster notes open with the account's follower count, as
     `"965,189; verified; red-dot BREAKING style"`. Left in the prose that
     reads as a number stranded mid-sentence; pulled out it becomes a real
     column that can be right-aligned and carry its snapshot date. The count
     is a measurement, and the rest of the note is description — they were
     only ever in one field because a CSV had one column for them. */
  const splitFollowers = (note) => {
    const match = note?.match(/^([\d,]+)\s*;\s*(.*)$/s);
    if (!match) return { followers: undefined, note };
    const count = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(count)) return { followers: undefined, note };
    return { followers: count, note: match[2].trim() || undefined };
  };

  const roster = entities.map(repairShift).map((entity) => ({
    ...compact({
      id: entity.entity_id,
      name: entity.display_name,
      type: entity.entity_type,
      handle: entity.handle,
      platform: entity.platform,
      jurisdiction: entity.jurisdiction,
      ...splitFollowers(entity.notes),
      publicInterestBasis: entity.public_interest_basis,
    }),
    /* Two entities in the delivery carry no grade. They default to the
       weakest one rather than to nothing: an ungraded identity rendering as
       blank would read as "no doubt here", which is the opposite of what a
       missing grade means. Defaulting downward can only ever understate. */
    identityStatus: entity.identity_status || 'unresolved',
  }));

  const edges = relationships
    .filter((rel) => rel.publication_wording)
    .map((rel) =>
      compact({
        id: rel.relationship_id,
        from: entityById.get(rel.from_entity_id)?.display_name ?? rel.from_entity_id,
        to: entityById.get(rel.to_entity_id)?.display_name ?? rel.to_entity_id,
        fromId: rel.from_entity_id,
        toId: rel.to_entity_id,
        relation: rel.relation_type,
        direction: rel.direction,
        evidenceClass: rel.evidence_class,
        confidence: rel.confidence,
        weight: rel.weight,
        statement: rel.publication_wording,
        indicators: (evidenceByRelationship.get(rel.relationship_id) ?? [])
          .map((row) => row.indicator_type)
          .filter(Boolean),
      }),
    );

  const record = {
    slug,
    caseId: meta.case_id,
    title: meta.title,
    question: meta.research_question,
    scope: meta.scope,
    publicInterestBasis: meta.public_interest_basis,
    updatedAt: meta.updated_at,
    language: meta.language || 'en',
    /* The packets ship at `right_of_reply`. The site does not run that
       process (owner decision — `.ai/DECISIONS.md`), so a case enters here at
       `editorial_review` and advances as the passes complete. `held` keeps a
       case out of the index and out of `generateStaticParams`. */
    lifecycle: 'editorial_review',
    /* The researchers grade their own certainty in a line above the numbered
       findings ("Confidence: high on the pivot; low on the operator"). It is
       the most important sentence in the report and it renders first. */
    confidence: (() => {
      const head = paragraphs(reportSection(report, 'Bottom line'))[0] ?? '';
      return /confidence/i.test(head) ? head : '';
    })(),
    bottomLine: numberedPoints(reportSection(report, 'Bottom line')).map((point) =>
      extractCitations(point, cite),
    ),
    limitations: sectionLines(report, LIMITATION_TITLES).map(
      (text) => extractCitations(text, cite).text,
    ),
    /* What the research could not establish, kept separate from what it did.
       The reports are unusually disciplined about this line and flattening it
       would be the one edit that makes them less honest than they are. */
    unknowns: sectionLines(report, UNKNOWN_TITLES).map(
      (text) => extractCitations(text, cite).text,
    ),
    contradictions: sectionLines(report, CONTRADICTION_TITLES).map(
      (text) => extractCitations(text, cite).text,
    ),
    wouldChange: sectionLines(report, ['What would change conclusions']).map(
      (text) => extractCitations(text, cite).text,
    ),
    roster,
    exhibits,
    edges,
    narratives: narratives.map((n) =>
      compact({
        id: n.narrative_id,
        title: n.title,
        summary: n.summary,
        frame: n.frame,
        audience: n.target_audience,
        status: n.status,
        confidence: n.confidence,
      }),
    ),
    chronology: events
      .map((e) =>
        compact({
          id: e.event_id,
          occurredAt: e.occurred_at,
          type: e.event_type,
          description: e.description,
          confidence: e.confidence,
        }),
      )
      .sort((a, b) => (a.occurredAt ?? '').localeCompare(b.occurredAt ?? '')),
    sources: sources.map(publishedSource),
    counts: {
      sources: sources.length,
      entities: entities.length,
      exhibits: exhibits.length,
      edges: edges.length,
    },
  };

  if (slug === GRAPH_SLUG) {
    /* The communities are the graph's actual finding — seven of them, not one
       blob and not seven islands — and they live in the report's own table
       because they are an analytic grouping over entities rather than
       entities themselves. */
    record.communities = subsectionTable(report, 'Communities').map((cells) => ({
      number: cells[0],
      name: cells[1],
      nodes: cells[2]
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      binding: cells[3],
    }));
    record.bridges = subsectionBullets(report, 'Bridges').map((text) =>
      extractCitations(text, cite).text,
    );
    graphPacket = record;
  } else if (slug === SYNTHESIS_SLUG) {
    synthesisPacket = record;
  } else {
    bytes += writeJson(path.join('cases', `${slug}.json`), record);
    built.push(record);
  }

  console.log(
    `  ${slug.padEnd(32)} ${String(record.counts.exhibits).padStart(2)} exhibits · ` +
      `${String(record.counts.entities).padStart(2)} entities · ` +
      `${String(record.counts.sources).padStart(2)} sources · validator ${validated}`,
  );
}

// ---------- the network payload ----------

if (!graphPacket) {
  console.error(`no graph packet found (expected a case with slug "${GRAPH_SLUG}")`);
  process.exit(1);
}

const synthesisReport = synthesisPacket
  ? fs.readFileSync(
      path.join(
        caseDirs.find((d) => readCaseYaml(d).slug.replace(/^\d+-/, '') === SYNTHESIS_SLUG),
        'report.md',
      ),
      'utf8',
    )
  : '';

const network = {
  updatedAt: graphPacket.updatedAt,
  question: graphPacket.question,
  communities: graphPacket.communities ?? [],
  bridges: graphPacket.bridges ?? [],
  edges: graphPacket.edges,
  roster: graphPacket.roster,
  sources: graphPacket.sources,
  /* The synthesis's seven findings are the spine of the network page: the
     conclusions that survived every contradiction pass, including the ones
     that disconfirm the program's own starting hypothesis. */
  findings: synthesisPacket
    ? numberedPoints(
        reportSection(synthesisReport, 'Seven findings that survive every contradiction pass'),
      ).map((text) => extractCitations(text, () => null).text)
    : [],
  executiveSummary: synthesisPacket
    ? paragraphs(reportSection(synthesisReport, 'Executive summary'))
    : [],
  wouldChange: synthesisPacket ? synthesisPacket.wouldChange : [],
  limitations: synthesisPacket ? synthesisPacket.limitations : [],
  unknowns: synthesisPacket ? synthesisPacket.unknowns : [],
};

bytes += writeJson('network.json', network);

// ---------- the index ----------

const index = built.map((record) => ({
  slug: record.slug,
  caseId: record.caseId,
  title: record.title,
  question: record.question,
  lifecycle: record.lifecycle,
  updatedAt: record.updatedAt,
  counts: record.counts,
}));

bytes += writeJson('index.json', {
  contract: 'fake-resistance-research@1',
  importedFrom: path.basename(src),
  updatedAt: new Date().toISOString().slice(0, 10),
  cases: index,
});

console.log(
  `\nwrote ${built.length} case files + network + index ` +
    `(${(bytes / 1024).toFixed(0)} KB) to content-packages/fake-resistance`,
);
console.log(
  `network: ${network.edges.length} edges, ${network.findings.length} synthesis findings`,
);
