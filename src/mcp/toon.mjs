// TOON decoder (Token-Oriented Object Notation): the Pega MCP returns its responses in this format.
// Covers what the server produces: indented objects, inline arrays, tabular arrays
// key[N]{a,b}:, "- " lists, quoted strings with JSON escapes.

const TRAILER = /^\[api: .*\]$/;
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
// key (quoted or bare), [N delimiter?], {fields}, then ":"
const HEADER = /^("(?:[^"\\]|\\.)*"|[^\s"\[\]{}:][^"\[\]{}:]*?)?(?:\[(\d+)([|\t])?\])?(?:\{([^}]*)\})?:(?: (.*))?$/;

// The raw rule as stored: without the response-time line (it changes on every call) nor trailing blanks.
export function cleanToon(text) {
  return (
    text
      .split('\n')
      .filter((l) => !TRAILER.test(l.trim()))
      .map((l) => l.trimEnd())
      .join('\n')
      .trim() + '\n'
  );
}

export function decodeToon(text) {
  const lines = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim() || TRAILER.test(raw.trim())) continue;
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, text: raw.trim() });
  }
  if (!lines.length) return {};
  const state = { lines, i: 0 };
  const first = header(lines[0].text);
  if (first && first.key === undefined && first.n !== undefined) {
    state.i = 1;
    return array(state, first, lines[0].indent);
  }
  if (!first) {
    if (lines.length === 1) return primitive(lines[0].text);
    throw new Error(`unreadable TOON line 1: ${lines[0].text.slice(0, 80)}`);
  }
  return object(state, lines[0].indent);
}

function header(text) {
  const m = text.match(HEADER);
  if (!m) return null;
  const [, key, n, delim, fields, rest] = m;
  if (key === undefined && n === undefined) return null;
  return {
    key: key === undefined ? undefined : key.startsWith('"') ? JSON.parse(key) : key,
    n: n === undefined ? undefined : Number(n),
    delim: delim ?? ',',
    fields: fields === undefined ? undefined : split(fields, delim ?? ',').map((c) => (c.startsWith('"') ? JSON.parse(c) : c)),
    rest: rest ?? '',
  };
}

// Reads the fields of an object while the lines are exactly at `indent`.
function object(state, indent, res = {}) {
  while (state.i < state.lines.length) {
    const l = state.lines[state.i];
    if (l.indent !== indent || l.text.startsWith('- ') || l.text === '-') break;
    const h = header(l.text);
    if (!h || h.key === undefined) throw new Error(`unreadable TOON: ${l.text.slice(0, 80)}`);
    state.i++;
    res[h.key] = value(state, h, indent);
  }
  return res;
}

// Value of a field already read; its children are the lines indented deeper than `indent`.
function value(state, h, indent) {
  if (h.n !== undefined) return array(state, h, indent);
  if (h.rest !== '') return primitive(h.rest);
  const next = state.lines[state.i];
  if (next && next.indent > indent) return object(state, next.indent);
  return {};
}

function array(state, h, indent) {
  if (h.n === 0) return [];
  if (h.fields) {
    const rows = [];
    for (let k = 0; k < h.n; k++) {
      const l = state.lines[state.i++];
      if (!l || l.indent <= indent) throw new Error(`TOON: array ${h.key} announces ${h.n} rows, has ${k}`);
      const vals = split(l.text, h.delim).map(primitive);
      rows.push(Object.fromEntries(h.fields.map((c, j) => [c, vals[j]])));
    }
    return rows;
  }
  if (h.rest !== '') return split(h.rest, h.delim).map(primitive);
  const items = [];
  while (state.i < state.lines.length) {
    const l = state.lines[state.i];
    if (l.indent <= indent || !(l.text.startsWith('- ') || l.text === '-')) break;
    state.i++;
    items.push(item(state, l.text === '-' ? '' : l.text.slice(2), l.indent));
  }
  return items;
}

// A "- …" list item: primitive, keyless array, or object whose first field is on the line.
function item(state, text, indent) {
  if (text === '') return {};
  const h = header(text);
  if (!h) return primitive(text);
  if (h.key === undefined) return array(state, h, indent);
  const fields = indent + 2;
  const res = { [h.key]: value(state, h, fields) };
  return object(state, fields, res);
}

function primitive(s) {
  s = s.trim();
  if (s.startsWith('"')) return JSON.parse(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (NUMBER.test(s)) return Number(s);
  return s;
}

// Splits on the delimiter outside quotes.
function split(s, delim) {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (inQuotes) {
      cur += c;
      if (c === '\\') cur += s[++k];
      else if (c === '"') inQuotes = false;
    } else if (c === '"') {
      inQuotes = true;
      cur += c;
    } else if (c === delim) {
      parts.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  parts.push(cur.trim());
  return parts;
}
