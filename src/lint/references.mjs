// Semantic lint: what the content cites, resolved against the mirror. The schema says the shape; this
// says whether the rules the draft cites exist. The content is projected like a mirrored rule (same
// projection, same references), each `sure` reference is looked up on its class and the parent classes
// (src/mirror/graph.mjs), then among the drafts waiting to be sent, then anywhere in the mirror.
// A finding is { level, pointer, message }, the message starting with `ref:`.
// Pega resolves, pega-ctx looks: a reference missing here may live in an application the mirror does
// not follow (pega-ctx live <id> brings it in), and a Pega rule the application does not override
// (px, py, pz names) is never in the mirror: a warning, not an error.
import { project } from '../projection/index.mjs';
import { resolver } from '../mirror/graph.mjs';
import { isParentClass, items, filled } from '../projection/common.mjs';
import { splitId } from '../mirror/files.mjs';
import { merge } from '../commands/template.mjs';
import { TYPES } from '../mcp/tools.mjs';
import { decodeToon } from '../mcp/toon.mjs';

const PEGA_NAME = /^p[xyz][A-Z]/;
// Available: Yes runs, Final runs (and cannot be overridden); the others do not run.
const NOT_RUN = { No: 'no', Blocked: 'blocked', Withdrawn: 'withdrawn' };
// `D_Page[Param: value, Other: value]`: a data page called with parameters.
const DATA_PAGE_CALL = /\b(D_\w+)\[([^\]]*)\]/g;

// operation, type, content, base: as lint() gets them (content is the patch of an update, base the raw
// rule it applies to). index: the mirror's index; drafts: identifiers of the other drafts waiting;
// readRaw: id → raw TOON of a mirrored rule (availability, data page parameters).
export function referenceFindings({ operation, type, content, base, index = [], drafts = [], readRaw = () => undefined }) {
  const update = operation === 'update';
  const rule = { pxObjClass: TYPES[type], ...(update ? merge(base ?? {}, content) : content) };
  let references;
  try {
    ({ references } = project(rule, { index, resolve: resolver(index), line: { type } }));
  } catch (e) {
    return [{ level: 'warning', pointer: '', message: `ref: references not checked, the content does not project (${e.message})` }];
  }
  const known = new Set(index.map((r) => r.id));
  const draftIds = new Set(drafts);
  const inDrafts = resolver(drafts.map((id) => ({ id, ...splitId(id) })));
  const findings = [];
  const add = (level, pointer, message) => findings.push({ level, pointer, message: `ref: ${message}` });

  for (const r of references) {
    if (r.confidence !== 'sure') continue;
    const { type: t, class: cls, name } = splitId(r.to);
    // For an update, only what the patch itself cites: the rest is already so in Pega.
    const pointer = locate(content, name);
    if (update && pointer === undefined) continue;
    const at = pointer ?? '';
    const cited = `${t} ${name} (${r.via})`;
    if (known.has(r.to)) {
      const raw = readRaw(r.to);
      const available = raw ? decodeToon(raw).pyRuleAvailable : undefined;
      if (NOT_RUN[available]) add('warning', at, `${cited} is available: ${NOT_RUN[available]} (${r.to}): Pega will not run it`);
      continue;
    }
    const draft = inDrafts(r.to);
    if (draftIds.has(draft)) {
      add('warning', at, `${cited} is only a draft waiting to be sent: pega-ctx send ${draft} first`);
      continue;
    }
    const elsewhere = index.filter((x) => x.type === t && x.name === name && !isParentClass(x.class, cls)).map((x) => x.class);
    if (elsewhere.length) {
      add('warning', at, `${cited} exists on ${elsewhere.join(', ')} only, not a parent of ${cls}: Pega will not find it from ${cls}; check the class or the name`);
    } else if (PEGA_NAME.test(name)) {
      add('warning', at, `${cited} is not in the mirror on ${cls} or a parent class: a Pega rule the application does not override, or a typo`);
    } else {
      add('error', at, `${cited} is missing from the mirror on ${cls} and its parents: create it first, fix the name, or pega-ctx live ${r.to} if it lives in an application the mirror does not follow`);
    }
  }

  findings.push(...dataPageParameters(content, rule.pyClassName ?? '', index, readRaw));
  return findings;
}

// A data page called with parameters: the names passed against the names the data page declares.
// Without the bracket syntax nothing is checked (a view passes its parameters elsewhere).
function dataPageParameters(content, cls, index, readRaw) {
  const resolve = resolver(index);
  const known = new Set(index.map((r) => r.id));
  const findings = [];
  const seen = new Set();
  for (const { pointer, text } of texts(content)) {
    for (const m of text.matchAll(DATA_PAGE_CALL)) {
      const [call, page, inner] = m;
      if (seen.has(call)) continue;
      seen.add(call);
      const id = resolve(`DataPage:${cls}:${page}`);
      if (!known.has(id)) continue; // missing: reported with the references, or not a reference the projection knows
      const raw = readRaw(id);
      if (!raw) continue;
      const declared = items(decodeToon(raw).pyParameters).map((p) => p.pyParametersParamName).filter(filled);
      const passed = [...inner.matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*:/g)].map((x) => x[1]);
      const unknown = passed.filter((p) => !declared.includes(p));
      const missing = declared.filter((p) => !passed.includes(p));
      if (unknown.length) {
        findings.push({ level: 'error', pointer, message: `ref: ${page} has no parameter ${unknown.join(', ')} (declared: ${declared.join(', ') || 'none'}): fix the name, or add it to the data page` });
      }
      if (missing.length) {
        findings.push({ level: 'warning', pointer, message: `ref: ${page} is called without ${missing.join(', ')}, which it declares: check that the parameter is optional` });
      }
    }
  }
  return findings;
}

// Every string of the content with its JSON pointer, strings holding JSON (pxViewMetadata…) unfolded
// as the draft file shows them: the pointer then matches the file's lines.
function texts(content) {
  const out = [];
  const walk = (v, pointer) => {
    if (typeof v === 'string') {
      out.push({ pointer, text: v });
      if (/^\s*[{[]/.test(v)) {
        try {
          const parsed = JSON.parse(v);
          if (parsed && typeof parsed === 'object') walk(parsed, pointer);
        } catch {
          // not JSON: a plain string
        }
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${pointer}/${i}`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${pointer}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`);
  };
  walk(content, '');
  return out;
}

// The pointer of the first string equal to the name, else of the first string citing it as a word
// (`.Name`, `@P .Name`, inside an expression); undefined when the content does not cite it.
function locate(content, name) {
  const all = texts(content);
  const exact = all.find((s) => s.text.trim() === name);
  if (exact) return exact.pointer;
  const word = new RegExp(`(?<![\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`);
  return all.find((s) => word.test(s.text))?.pointer;
}
