// Drafts: the JSON that create or update will send to Pega, written to .pega/drafts/<Type>/<Class>/<Name>.json
// to be read, corrected by hand if needed, then sent as is by `pega-ctx send`.
// A draft is { "pega-ctx": header, "content": what create-rule receives (or the patch of update-rule) }.
// Made to be read: two-space indentation, identity fields first, and the JSON that Pega stores
// as a string (pxViewMetadata…) unfolded as an object, folded back on sending.
import { createHash } from 'node:crypto';
import { writable } from '../mcp/tools.mjs';

export const HEADER = 'pega-ctx';

// Fields shown first, in this order, when present: what the rule is, then how it is named.
const FIRST = ['pxObjClass', 'pyClassName', 'pyRuleName', 'pyLabel', 'pyDescription'];

// Fingerprint of a raw rule: an update draft remembers the rule it was written against.
export const fingerprint = (raw) => createHash('sha256').update(raw ?? '').digest('hex').slice(0, 16);

// header: { operation, id, type, ruleClass, ... }; content: the object to send.
// schema: the "$schema" path for the editor (src/lint/editor.mjs), if there is one.
export function draftText(header, content, { schema } = {}) {
  const unfolded = [];
  const body = unfold(order(content, header.type), '', unfolded);
  const draft = { ...(schema ? { $schema: schema } : {}), [HEADER]: { ...header, ...(unfolded.length ? { unfolded } : {}) }, content: body };
  return `${JSON.stringify(draft, null, 2)}\n`;
}

// The draft as written (by pega-ctx or by hand) → { header, content } ready to send, strings folded back.
export function readDraft(text, file = 'draft') {
  let o;
  try {
    o = JSON.parse(text);
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${e.message}): fix it, or write it again with --draft`);
  }
  const header = o?.[HEADER];
  if (!header || typeof header !== 'object') throw new Error(`${file}: no "${HEADER}" header: write the draft with create --draft or update --draft`);
  if (!['create', 'update'].includes(header.operation)) throw new Error(`${file}: "${HEADER}".operation is "${header.operation}", expected create or update`);
  if (!o.content || typeof o.content !== 'object' || Array.isArray(o.content)) throw new Error(`${file}: "content" must be a JSON object`);
  const content = structuredClone(o.content);
  for (const pointer of header.unfolded ?? []) fold(content, pointer);
  return { header, content };
}

// Key fields first (the type's key from the server's schemas), then FIRST, then the rest as it came.
function order(content, type) {
  const key = writable(type)?.key ?? [];
  const first = [...new Set([FIRST[0], ...key, ...FIRST.slice(1)])].filter((k) => k in content);
  return Object.fromEntries([...first.map((k) => [k, content[k]]), ...Object.entries(content).filter(([k]) => !first.includes(k))]);
}

// A string holding a JSON object or array becomes that object; its JSON pointer is recorded.
function unfold(v, pointer, unfolded) {
  if (typeof v === 'string' && /^\s*[{[]/.test(v)) {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object') {
        unfolded.push(pointer);
        return parsed;
      }
    } catch {
      // not JSON: left as a string
    }
    return v;
  }
  if (Array.isArray(v)) return v.map((x, i) => unfold(x, `${pointer}/${i}`, unfolded));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unfold(x, `${pointer}/${escape(k)}`, unfolded)]));
  return v;
}

const escape = (k) => k.replaceAll('~', '~0').replaceAll('/', '~1');
const unescape = (k) => k.replaceAll('~1', '/').replaceAll('~0', '~');

// Folds back the value at a JSON pointer into a string. A pointer whose value was removed by hand is ignored.
function fold(o, pointer) {
  const parts = pointer.split('/').slice(1).map(unescape);
  const last = parts.pop();
  let parent = o;
  for (const p of parts) parent = parent?.[p];
  if (parent && parent[last] !== undefined && typeof parent[last] === 'object') parent[last] = JSON.stringify(parent[last]);
}
