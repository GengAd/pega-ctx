// Reads a rule in Pega right now, updates raw/, its digest, its index line and its outgoing edges,
// without recomputing the rest (the other digests' Cited by wait for the next sync).
// Shared by live, create and update.
import { decodeToon } from '../mcp/toon.mjs';
import { project } from '../projection/index.mjs';
import { indexLine, versionDescending } from './lines.mjs';
import { resolver, build } from './graph.mjs';
import { citedBy } from './rebuild.mjs';
import { rulesetOwners, withApplication } from './stack.mjs';

// Returns { id, key, digest, state: 'same' | 'different' | 'new' } or throws if Pega does not know it.
export async function refresh(m, pega, { type, class: cls, name }) {
  // list() by type and class, then the name ignoring case: a CaseType is in upper case there.
  const versions = (await pega.list({ type, class: cls }))
    .filter((r) => r.class === cls && r.name.toLowerCase() === name.toLowerCase())
    .sort(versionDescending);
  if (!versions.length) throw new Error(`${type}:${cls}:${name} not found in Pega: check the name with pega-ctx search, or the branch if it was just created`);
  const toon = await pega.read(versions[0].key);
  const o = decodeToon(toon);
  const line = withApplication(indexLine(type, versions, o), rulesetOwners(m.readStackData(), m.readStack()));

  const index = m.readIndex().filter((l) => l.id !== line.id);
  const resolve = resolver([...index, line]);
  const projected = project(toon, { line, index: [...index, line], otherVersions: line.rulesets, resolve });

  const graph = m.readGraph();
  const edges = graph.edges.filter((e) => e.from !== line.id);
  const added = build([{ id: line.id, references: projected.references }]).edges;
  const updatedGraph = { edges: [...edges, ...added].sort((a, b) => a.from.localeCompare(b.from)) };

  const digest = projected.markdown + citedBy(updatedGraph, line.id);
  const previous = m.readDigest(line.id);
  m.writeRaw(line.id, toon);
  m.writeDigest(line.id, digest);
  m.writeIndex([...index, { ...line, refs: projected.references.map((r) => r.to) }].sort((a, b) => a.id.localeCompare(b.id)));
  m.writeGraph(updatedGraph);
  const state = previous === undefined ? 'new' : previous === digest ? 'same' : 'different';
  return { id: line.id, key: versions[0].key, digest, state };
}
