// Generic detection by name: any identifier cited in a string of the raw rule that equals the Name of a
// rule in the index, on the same class or a parent class, yields a `probable` edge.
// By token and not by whole string: a When cites its table inside an expression
// (`@pxEvaluateDecisionTable(…, "IgnoredRegistrationType")`), never alone.
import { isParentClass, ruleId } from './common.mjs';

// Generated or prose fields: they cite the rule itself or free text, not dependencies.
const IGNORED = new Set([
  'pyRuleName', 'pyLabel', 'pyDescription', 'pyStreamName', 'pyJavaClassName', 'pyJavaStream',
  'pySourceStream', 'pyXMLSignature', 'pyTaskStatusXml', 'pyLocaleReference', 'pyFlowKey', 'pyMemo',
]);

// type: the rule's type (a FlowAction and its View share a name, only the identifier tells them apart).
// index: [{ id, type, class, name }]. alreadySure: identifiers already extracted by the projection.
export function probableReferences(o, type, index, alreadySure = new Set()) {
  if (!index?.length) return [];
  const byName = new Map();
  for (const r of index) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }
  const self = ruleId(type, o.pyClassName, o.pyRuleName);
  const found = new Map();
  const tokens = (s) => s.match(/[A-Za-z_][\w]*/g) ?? [];
  const walk = (v, key) => {
    if (key && (IGNORED.has(key) || key.startsWith('pz'))) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x));
    if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => walk(x, k));
    if (typeof v !== 'string') return;
    for (const t of tokens(v)) {
      if (t === o.pyRuleName) continue; // the rule naming itself
      for (const r of byName.get(t) ?? []) {
        if (r.id === self || alreadySure.has(r.id) || found.has(r.id)) continue;
        if (isParentClass(r.class, o.pyClassName)) found.set(r.id, { to: r.id, via: 'name match', confidence: 'probable' });
      }
    }
  };
  walk(o);
  return [...found.values()];
}
