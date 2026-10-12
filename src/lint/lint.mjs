// Lint of what create or update will send: the server's schema (src/lint/jsonschema.mjs), checked
// locally before the round trip, plus pega-ctx's own checks. A finding is
// { level: 'error' | 'warning', pointer, message }, pointer relative to the content sent.
import { validate, fitTypes } from './jsonschema.mjs';
import { isDroppedField, withoutPersistence, declaredPz } from '../projection/persistence.mjs';
import { merge } from '../commands/template.mjs';

// create: content is the whole rule. update: content is the patch, base the decoded raw rule it
// applies to; the rule after the patch is checked, and an error outside the patch is only a warning
// (it is already so in Pega). schema: the server's schema, or undefined (missing: why).
export function lint({ operation, ruleClass, content, base, schema, missing }) {
  const keep = schema ? declaredPz(schema) : undefined;
  const findings = [...ownChecks(content, keep)];
  if (!schema) {
    findings.push({ level: 'warning', pointer: '', message: `not checked against a schema (${missing ?? 'no schema'}): only pega-ctx's checks` });
    return findings;
  }
  if (operation === 'update') {
    const after = fitTypes(withoutPersistence(merge(base ?? {}, content), true, keep), schema);
    for (const e of validate(after, schema)) {
      findings.push(touches(content, e.pointer) ? { level: 'error', ...e } : { level: 'warning', ...e, message: `${e.message} (already so in Pega, outside the patch)` });
    }
  } else {
    findings.push(...validate({ pxObjClass: ruleClass, ...content }, schema).map((e) => ({ level: 'error', ...e })));
  }
  findings.push(...derived(content, schema));
  return findings;
}

// Fields managed by Pega: at the top level the persistence list, at any depth the pz* keys,
// except the pz* fields the schema declares as content (declaredPz).
function ownChecks(content, keep) {
  const found = [];
  const walk = (v, pointer, root) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${pointer}/${i}`, false));
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      const p = `${pointer}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      if (isDroppedField(k, root, keep)) found.push({ level: 'error', pointer: p, message: `${k} is managed by Pega: remove it` });
      else walk(x, p, false);
    }
  };
  walk(content, '', true);
  return found;
}

// x-pega-autoDerived: the server recomputes the field from another one and drops the value sent.
function derived(content, schema) {
  const found = [];
  for (const [k, p] of Object.entries(schema.properties ?? {})) {
    const source = p['x-pega-deriveFrom'];
    if (!p['x-pega-autoDerived'] || !(k in content) || typeof source !== 'string' || !/^p[xyz]\w+$/.test(source) || !(source in content)) continue;
    if (content[k] !== content[source]) {
      found.push({ level: 'warning', pointer: `/${k}`, message: `the server derives ${k} from ${source}: ${JSON.stringify(content[k])} will become ${JSON.stringify(content[source])}` });
    }
  }
  return found;
}

// Does the patch hold this pointer, or one of its parents below the root?
function touches(patch, pointer) {
  const parts = pointer.split('/').slice(1).map((k) => k.replaceAll('~1', '/').replaceAll('~0', '~'));
  let o = patch;
  for (const k of parts) {
    if (!o || typeof o !== 'object' || !(k in o)) return false;
    o = o[k];
    if (Array.isArray(o) || typeof o !== 'object' || o === null) return true; // an array of the patch replaces the whole array
  }
  return parts.length > 0;
}

export const hasErrors = (findings) => findings.some((f) => f.level === 'error');

// One line per finding: `line N  /content/path: message`, errors first. lineOf: pointer → line in the
// draft file (src/lint/positions.mjs), absent when there is no file (direct create or update).
export function findingsText(findings, { lineOf, prefix = '' } = {}) {
  if (!findings.length) return 'lint: no problem';
  const sorted = [...findings].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  const counts = ['error', 'warning'].map((l) => [l, sorted.filter((f) => f.level === l).length]).filter(([, n]) => n);
  return [
    `lint: ${counts.map(([l, n]) => `${n} ${l}${n > 1 ? 's' : ''}`).join(', ')}`,
    ...sorted.map((f) => {
      const pointer = `${prefix}${f.pointer}` || '/';
      return `${f.level === 'error' ? 'error' : 'warning'}${lineOf ? ` line ${lineOf(pointer)}` : ''}  ${pointer}: ${f.message}`;
    }),
  ].join('\n');
}
