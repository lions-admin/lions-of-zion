/**
 * The research delivery's CSV reader, shared by the importer and the stats
 * builder so there is one definition of how a packet row is read.
 */
import fs from 'node:fs';

/**
 * RFC 4180 reader. The delivery's text fields carry commas, embedded quotes
 * and newlines (a `publication_wording` can be a full sentence with a quoted
 * slogan inside it), so a split on commas would silently shred the data.
 */
export function parseCsv(text) {
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

/**
 * A CSV file as objects. The analysis suite prefixes some of its outputs with
 * a `#` caveat line (`analysis/common.py:write_csv`); those lines are dropped
 * here and the caveat travels separately, on the payload that carries the
 * numbers.
 */
export function readCsvFile(fullPath) {
  if (!fs.existsSync(fullPath)) return [];
  let text = fs.readFileSync(fullPath, 'utf8');
  while (text.startsWith('#')) text = text.slice(text.indexOf('\n') + 1);
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, idx) => [key.trim(), (cells[idx] ?? '').trim()])),
  );
}

/** The leading `#` caveat line of an analysis output, if it carries one. */
export function readCsvCaveat(fullPath) {
  if (!fs.existsSync(fullPath)) return '';
  const text = fs.readFileSync(fullPath, 'utf8');
  if (!text.startsWith('#')) return '';
  return text.slice(1, text.indexOf('\n')).replace(/^\s*CAVEAT:\s*/i, '').trim();
}
