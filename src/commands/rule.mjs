// pega-ctx rule <id> [--raw] [--cited-by]: the digest; --raw, the TOON from raw/ (for a script);
// --cited-by, the reverse tree on two levels.
import { mirror } from '../mirror/files.mjs';
import { incoming } from '../mirror/graph.mjs';
import { findRule, render } from './common.mjs';

export const help = 'pega-ctx rule <id> [--raw] [--cited-by]';

export function run({ positionals, options, root }) {
  const m = mirror(root);
  m.readConfig();
  const rule = findRule(m.readIndex(), positionals[0]);
  if (options.raw) {
    const raw = m.readRaw(rule.id);
    if (raw === undefined) return { code: 1, output: `raw rule missing from .pega/raw/ for ${rule.id}: pega-ctx sync --full` };
    return { code: 0, output: raw.trimEnd() };
  }
  const digest = m.readDigest(rule.id);
  if (digest === undefined) return { code: 1, output: `digest missing for ${rule.id}: pega-ctx sync` };
  let text = digest.trimEnd();
  let tree;
  if (options['cited-by']) {
    const graph = m.readGraph();
    tree = incoming(graph, rule.id).map((e) => ({ ...e, by: incoming(graph, e.from) }));
    const mark = (e) => (e.confidence === 'probable' ? ' ?' : '');
    const lines = tree.flatMap((e) => [`- ${e.from}${mark(e)} (${e.via})`, ...e.by.map((b) => `  - ${b.from}${mark(b)} (${b.via})`)]);
    text += `\n\n## Cited by, two levels\n${lines.length ? lines.join('\n') : 'none'}`;
  }
  return render(options, { id: rule.id, digest, citedBy: tree }, text);
}
