// pega-ctx rule <id> [--raw] [--cited-by]: the digest; --raw, the TOON from raw/ (for a script);
// --cited-by, the reverse tree on two levels.
// pega-ctx rule <Name> --on <Class>: the rules of that name the class can reach, in the order Pega
// looks (inheritance, then the stack), without choosing one (docs/decisions/0004).
import { mirror } from '../mirror/files.mjs';
import { incoming, inheritanceChain } from '../mirror/graph.mjs';
import { applicationOrder } from '../mirror/stack.mjs';
import { appTag } from './search.mjs';
import { findRule, render } from './common.mjs';

export const help = 'pega-ctx rule <id> [--raw] [--cited-by] | pega-ctx rule <[Type:]Name> --on <Class>';

export function run({ positionals, options, root }) {
  const m = mirror(root);
  m.readConfig();
  if (options.on !== undefined) return candidates(m, positionals[0], options);
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

function candidates(m, request, options) {
  if (typeof options.on !== 'string') return { code: 1, output: '--on expects a class: pega-ctx rule <[Type:]Name> --on <Class>' };
  if (!request) return { code: 1, output: 'missing name: pega-ctx rule <[Type:]Name> --on <Class>' };
  const parts = request.split(':');
  if (parts.length > 2) return { code: 1, output: `--on takes a name or Type:Name, not an identifier: pega-ctx rule ${parts[0]}:${parts.at(-1)} --on ${options.on}` };
  const [type, name] = parts.length === 2 ? parts : [undefined, parts[0]];
  const index = m.readIndex();
  const classes = [options.on, ...inheritanceChain(index, options.on)];
  const order = applicationOrder(m.readStackData(), m.readStack());
  const rank = (r) => (order.includes(r.application) ? order.indexOf(r.application) : order.length);
  const found = index
    .filter((r) => r.name.toLowerCase() === name.toLowerCase() && (!type || r.type === type) && classes.includes(r.class))
    .sort((a, b) => classes.indexOf(a.class) - classes.indexOf(b.class) || rank(a) - rank(b) || a.id.localeCompare(b.id));
  const text = [
    `## ${request} on ${options.on}`,
    'closest class first, then the stack (current application first); Pega decides among them (circumstances, availability, versions)',
    ...(found.length
      ? found.map((r, i) => `${i + 1}. ${appTag(r)}${r.id} — ${(r.rulesets ?? []).join(', ')}`)
      : [`none: no rule ${request} on ${options.on} or its parent classes in the mirror (pega-ctx stack --for ${options.on} shows the chain)`]),
  ].join('\n');
  return render(options, { name: request, class: options.on, classes, candidates: found.map(({ refs, ...r }) => r) }, text);
}
