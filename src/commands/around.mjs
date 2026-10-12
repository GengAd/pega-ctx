// pega-ctx around <id> [--depth 2] [--types Flow,View] [--stage <name>]: the outgoing subgraph,
// digests concatenated from the closest to the farthest. Beyond forty rules, stops and says how to narrow.
import { mirror } from '../mirror/files.mjs';
import { outgoing } from '../mirror/graph.mjs';
import { findRule, render, listOption } from './common.mjs';

export const help = 'pega-ctx around <id> [--depth 2] [--types Flow,View] [--stage <name>]';
export const LIMIT = 40;

export function run({ positionals, options, root }) {
  const m = mirror(root);
  m.readConfig();
  const index = m.readIndex();
  const start = findRule(index, positionals[0]);
  const depth = options.depth === undefined ? 2 : Number(options.depth);
  if (!Number.isInteger(depth) || depth < 0) return { code: 1, output: '--depth expects a positive integer, for example --depth 2' };
  const types = listOption(options.types);
  const stage = typeof options.stage === 'string' ? options.stage.toLowerCase() : undefined;
  if (stage && start.type !== 'CaseType') return { code: 1, output: `--stage only applies to a CaseType; ${start.id} is a ${start.type}` };

  const graph = m.readGraph();
  const known = new Set(index.map((r) => r.id));
  // Breadth-first walk: the whole subgraph is walked, --types only filters what is rendered.
  const levels = new Map([[start.id, 0]]);
  const outside = new Set();
  let queue = [start.id];
  for (let n = 1; n <= depth && queue.length; n++) {
    const next = [];
    for (const id of queue) {
      let edges = outgoing(graph, id);
      if (stage && id === start.id) edges = edges.filter((e) => e.stage?.toLowerCase() === stage);
      for (const e of edges) {
        if (levels.has(e.to)) continue;
        if (!known.has(e.to)) {
          outside.add(e.to);
          continue;
        }
        levels.set(e.to, n);
        next.push(e.to);
      }
    }
    queue = next;
  }
  if (stage && levels.size === 1) {
    const stages = [...new Set(outgoing(graph, start.id).map((e) => e.stage).filter(Boolean))];
    return { code: 1, output: `no stage "${options.stage}" in ${start.id}: choose among ${stages.join(', ')}` };
  }

  const rendered = [...levels.keys()].filter((id) => id === start.id || !types.length || types.includes(id.split(':')[0]));
  if (rendered.length > LIMIT) {
    return { code: 1, output: `${rendered.length} rules: reduce the depth, filter with --types, or target a --stage` };
  }
  const digests = rendered.map((id) => m.readDigest(id)?.trimEnd() ?? `# ${id}\ndigest missing: pega-ctx sync`);
  const footer = outside.size ? [`outside the mirror: ${[...outside].join(', ')}`] : [];
  return render(options, { start: start.id, rules: rendered, outsideMirror: [...outside] }, [...digests, ...footer].join('\n\n---\n\n'));
}
