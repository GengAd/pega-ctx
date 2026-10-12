// Graph: edges between rules. A reference carries the class of its context; it is matched to a
// rule of the index by name and parent class (the most specific wins). Pega resolves, pega-ctx looks:
// this is a reading of the name, not the engine's resolution.
import { isParentClass, classDepth } from '../projection/common.mjs';
import { splitId } from './files.mjs';

// Types whose name is unique in the application, whatever the class.
const BY_NAME_ONLY = new Set(['DataPage']);

export function resolver(index) {
  const ids = new Set(index.map((r) => r.id));
  const byTypeName = new Map();
  for (const r of index) {
    const key = `${r.type}:${r.name}`;
    if (!byTypeName.has(key)) byTypeName.set(key, []);
    byTypeName.get(key).push(r);
  }
  return (id) => {
    if (ids.has(id)) return id;
    const { type, class: cls, name } = splitId(id);
    const candidates = byTypeName.get(`${type}:${name}`) ?? [];
    if (BY_NAME_ONLY.has(type) && candidates.length === 1) return candidates[0].id;
    const parents = candidates.filter((r) => isParentClass(r.class, cls)).sort((a, b) => classDepth(b.class) - classDepth(a.class));
    return parents[0]?.id ?? id;
  };
}

// entries: [{ id, references: [{ to, via, confidence, stage? }] }], references already resolved.
export function build(entries) {
  const edges = [];
  for (const e of entries) {
    for (const r of e.references) {
      const edge = { from: e.id, to: r.to, via: r.via, confidence: r.confidence };
      if (r.stage) edge.stage = r.stage;
      edges.push(edge);
    }
  }
  // By source rule; within it, the projection's order (stages, shapes) is kept.
  edges.sort((a, b) => a.from.localeCompare(b.from));
  return { edges };
}

export const outgoing = (graph, id) => graph.edges.filter((e) => e.from === id);
export const incoming = (graph, id) => graph.edges.filter((e) => e.to === id);

// Classes of the index that are parents of `cls` by name, from the closest to the farthest.
export function inheritanceChain(index, cls) {
  const classes = [...new Set(index.map((r) => r.class))];
  return classes.filter((c) => c !== cls && isParentClass(c, cls)).sort((a, b) => classDepth(b) - classDepth(a));
}
