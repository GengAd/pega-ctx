// Recomputes index.jsonl, graph.json, functions.md, conventions.md and digest/ entirely from raw/ and the index lines
// (it is fast, and avoids a partial state). `## Cited by` is added here, from the graph.
import { project, PROJECTIONS, MAX_REFERENCES, MAX_LINES } from '../projection/index.mjs';
import { resolver, build, incoming } from './graph.mjs';
import { rulesetOwners, withApplication } from './stack.mjs';
import { collect, renderFunctions } from './functions.mjs';
import { observe, renderConventions } from './conventions.mjs';
import { decodeToon } from '../mcp/toon.mjs';

// lines: [{ id, type, class, name, rulesets, description, updated, by }], without refs.
export function rebuild(m, lines) {
  const owners = rulesetOwners(m.readStackData(), m.readStack());
  const index = [...lines].map((l) => withApplication(l, owners)).sort((a, b) => a.id.localeCompare(b.id));
  const resolve = resolver(index);
  const projected = [];
  const missing = [];
  for (const line of index) {
    const toon = m.readRaw(line.id);
    if (toon === undefined) {
      missing.push(line.id);
      continue;
    }
    projected.push({ line, toon, ...project(toon, { line, index, otherVersions: line.rulesets ?? [], resolve }) });
  }
  const graph = build(projected);
  for (const p of projected) {
    const cited = citedBy(graph, p.id);
    let md = p.markdown + cited;
    // A hundred lines at most, Cited by included: projected again, keeping room for it.
    if (md.trimEnd().split('\n').length > MAX_LINES) {
      const reserve = cited.trimEnd().split('\n').length;
      md = project(p.toon, { line: p.line, index, otherVersions: p.line.rulesets ?? [], resolve, reserve }).markdown + cited;
    }
    m.writeDigest(p.id, md);
  }

  const final = projected.map((p) => ({ ...p.line, refs: p.references.map((r) => r.to) }));
  m.writeIndex(final);
  m.writeGraph(graph);
  m.writeConventions(renderConventions(observe(final)));
  m.writeFunctions(renderFunctions(collect(projected.map((p) => ({ id: p.id, rule: decodeToon(p.toon) })))));
  const kept = new Set(final.map((l) => l.id));
  for (const id of m.ids('digest')) if (!kept.has(id)) m.removeDigest(id);

  const withoutProjection = [...new Set(final.map((l) => l.type).filter((t) => !PROJECTIONS[t]))].sort();
  return { index: final, graph, withoutProjection, missing };
}

export function citedBy(graph, id) {
  const arrivals = incoming(graph, id);
  const lines = arrivals.slice(0, MAX_REFERENCES).map((e) => `- ${e.from}${e.confidence === 'probable' ? ' ?' : ''} (${e.via})`);
  if (arrivals.length > MAX_REFERENCES) lines.push(`… ${arrivals.length - MAX_REFERENCES} more: pega-ctx rule ${id} --cited-by`);
  return ['', '## Cited by', ...(lines.length ? lines : ['none']), ''].join('\n');
}
